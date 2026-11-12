// Tine.app launcher. Starts the bundled `tine daw` server for a file and opens
// it in the default browser (a browser tab, not a WKWebView, so Web MIDI keeps
// working in Chrome). One server per open file; all of them stop on Quit.
import AppKit
import Darwin

final class Session {
    let file: URL
    let process: Process
    var url: URL?
    init(file: URL, process: Process) { self.file = file; self.process = process }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    var sessions: [String: Session] = [:]   // keyed by resolved file path
    var aux: [String: Session] = [:]        // learn / theory servers
    var lastURL: URL?
    var openedSomething = false

    // The CLI lives in Contents/Helpers, not next to the launcher: on a
    // case-insensitive volume MacOS/tine and MacOS/Tine are the same file.
    let tineBinary = Bundle.main.bundleURL.appendingPathComponent("Contents/Helpers/tine")
    let docsDir = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Documents/Tine", isDirectory: true)

    // MARK: lifecycle

    func applicationDidFinishLaunching(_ note: Notification) {
        // Never start a server that is really this launcher (that recursion is
        // a process storm), and never run as a child of another launcher.
        if ProcessInfo.processInfo.environment["TINE_LAUNCHER_CHILD"] != nil
            || !FileManager.default.isExecutableFile(atPath: tineBinary.path)
            || sameFile(Bundle.main.executablePath!, tineBinary.path) {
            let a = NSAlert()
            a.messageText = "Tine is damaged"
            a.informativeText = "The tine command inside the app is missing or invalid. Please download Tine again."
            a.runModal()
            exit(1)
        }
        buildMenu()
        // Finder delivers "open these files" right after launch. Give it a moment
        // before falling back to the scratch piece.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [self] in
            if !openedSomething { openScratch() }
        }
    }

    func application(_ app: NSApplication, open urls: [URL]) {
        openedSomething = true
        for u in urls where u.isFileURL { openPiece(u) }
    }

    // Clicking the Dock icon brings the last DAW tab back.
    func applicationShouldHandleReopen(_ app: NSApplication, hasVisibleWindows: Bool) -> Bool {
        if let u = lastURL { NSWorkspace.shared.open(u) } else { openScratch() }
        return false
    }

    func applicationWillTerminate(_ note: Notification) {
        for s in Array(sessions.values) + Array(aux.values) where s.process.isRunning { s.process.terminate() }
    }

    func sameFile(_ a: String, _ b: String) -> Bool {
        let fm = FileManager.default
        guard let x = try? fm.attributesOfItem(atPath: a), let y = try? fm.attributesOfItem(atPath: b) else { return false }
        return (x[.systemFileNumber] as? Int) == (y[.systemFileNumber] as? Int)
            && (x[.systemNumber] as? Int) == (y[.systemNumber] as? Int)
    }

    // MARK: servers

    func openScratch() {
        try? FileManager.default.createDirectory(at: docsDir, withIntermediateDirectories: true)
        openPiece(docsDir.appendingPathComponent("scratch.tine"))
    }

    func openPiece(_ file: URL) {
        let key = file.resolvingSymlinksInPath().path
        if let s = sessions[key], s.process.isRunning, let u = s.url { show(u); return }
        NSDocumentController.shared.noteNewRecentDocumentURL(file)
        sessions[key] = launch(["daw", key], file: file)
    }

    func openAux(_ kind: String) {
        if let s = aux[kind], s.process.isRunning, let u = s.url { show(u); return }
        aux[kind] = launch([kind], file: URL(fileURLWithPath: "/"))
    }

    // Prefer the CLI's default port so browser-side preferences (kept per origin)
    // survive between launches; step up when a port is taken.
    func freePort(from start: Int = 7357) -> Int {
        let taken = Set((Array(sessions.values) + Array(aux.values)).compactMap { $0.url?.port })
        for p in start..<(start + 200) where !taken.contains(p) && portIsFree(p) { return p }
        return 0
    }

    func portIsFree(_ port: Int) -> Bool {
        let fd = socket(AF_INET, SOCK_STREAM, 0); if fd < 0 { return false }
        defer { close(fd) }
        var addr = sockaddr_in()
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_port = in_port_t(UInt16(port).bigEndian)
        addr.sin_addr.s_addr = inet_addr("127.0.0.1")
        return withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { Darwin.bind(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) == 0 }
        }
    }

    func launch(_ args: [String], file: URL) -> Session {
        let p = Process()
        p.executableURL = tineBinary
        p.arguments = args + ["--port", String(freePort()), "--no-open"]
        p.currentDirectoryURL = file.deletingLastPathComponent()
        var env = ProcessInfo.processInfo.environment
        env["TINE_LAUNCHER_CHILD"] = "1"
        p.environment = env
        let out = Pipe()
        p.standardOutput = out
        p.standardError = logHandle()
        let s = Session(file: file, process: p)
        var buffer = ""
        out.fileHandleForReading.readabilityHandler = { [weak self] h in
            let data = h.availableData
            if data.isEmpty { h.readabilityHandler = nil; return }
            buffer += String(decoding: data, as: UTF8.self)
            guard s.url == nil, let r = buffer.range(of: #"http://127\.0\.0\.1:\d+/"#, options: .regularExpression),
                  let u = URL(string: String(buffer[r])) else { return }
            DispatchQueue.main.async { s.url = u; self?.show(u) }
        }
        p.terminationHandler = { proc in
            if proc.terminationStatus != 0 && s.url == nil {
                DispatchQueue.main.async {
                    let a = NSAlert()
                    a.messageText = "Tine could not start"
                    a.informativeText = "The DAW server for \(file.lastPathComponent) exited. Details are in ~/Library/Logs/Tine.log."
                    a.runModal()
                }
            }
        }
        do { try p.run() } catch {
            let a = NSAlert(error: error); a.runModal()
        }
        return s
    }

    func show(_ u: URL) { lastURL = u; NSWorkspace.shared.open(u) }

    func logHandle() -> FileHandle {
        let logs = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Logs", isDirectory: true)
        let f = logs.appendingPathComponent("Tine.log")
        if !FileManager.default.fileExists(atPath: f.path) { FileManager.default.createFile(atPath: f.path, contents: nil) }
        let h = (try? FileHandle(forWritingTo: f)) ?? FileHandle.nullDevice
        h.seekToEndOfFile()
        return h
    }

    // MARK: menu actions

    @objc func newPiece(_ sender: Any?) {
        NSApp.activate(ignoringOtherApps: true)
        let panel = NSSavePanel()
        panel.title = "New Tine piece"
        panel.nameFieldStringValue = "untitled.tine"
        try? FileManager.default.createDirectory(at: docsDir, withIntermediateDirectories: true)
        panel.directoryURL = docsDir
        if panel.runModal() == .OK, var u = panel.url {
            if u.pathExtension != "tine" { u.appendPathExtension("tine") }
            try? FileManager.default.removeItem(at: u) // let tine write its seeded template
            openPiece(u)
        }
    }

    @objc func openDocument(_ sender: Any?) {
        NSApp.activate(ignoringOtherApps: true)
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = true
        panel.allowedFileTypes = ["tine"]
        panel.directoryURL = docsDir
        if panel.runModal() == .OK { panel.urls.forEach(openPiece) }
    }

    @objc func openLearn(_ sender: Any?) { openAux("learn") }
    @objc func openTheory(_ sender: Any?) { openAux("theory") }
    @objc func showDocsFolder(_ sender: Any?) {
        try? FileManager.default.createDirectory(at: docsDir, withIntermediateDirectories: true)
        NSWorkspace.shared.open(docsDir)
    }

    @objc func installCLI(_ sender: Any?) {
        let target = "/usr/local/bin/tine"
        let src = tineBinary.path.replacingOccurrences(of: "'", with: "'\\''")
        let script = "do shell script \"mkdir -p /usr/local/bin && ln -sf '\(src)' \(target)\" with administrator privileges"
        var err: NSDictionary?
        NSAppleScript(source: script)?.executeAndReturnError(&err)
        let a = NSAlert()
        if err == nil {
            a.messageText = "Installed the tine command"
            a.informativeText = "\(target) now points into Tine.app. Try `tine daw piece.tine` in a terminal. If you move the app, install again."
        } else {
            a.messageText = "Could not install the tine command"
            a.informativeText = (err?[NSAppleScript.errorMessage] as? String) ?? "Unknown error."
        }
        a.runModal()
    }

    func buildMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem(); main.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Tine", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Install Command Line Tool…", action: #selector(installCLI(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide Tine", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Quit Tine", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu

        let fileItem = NSMenuItem(); main.addItem(fileItem)
        let fileMenu = NSMenu(title: "File")
        fileMenu.addItem(withTitle: "New Piece…", action: #selector(newPiece(_:)), keyEquivalent: "n")
        fileMenu.addItem(withTitle: "Open…", action: #selector(openDocument(_:)), keyEquivalent: "o")
        let recent = NSMenuItem(title: "Open Recent", action: nil, keyEquivalent: "")
        let recentMenu = NSMenu(title: "Open Recent")
        recentMenu.addItem(withTitle: "Clear Menu", action: #selector(NSDocumentController.clearRecentDocuments(_:)), keyEquivalent: "")
        recent.submenu = recentMenu
        fileMenu.addItem(recent)
        fileMenu.addItem(.separator())
        fileMenu.addItem(withTitle: "Show Pieces Folder", action: #selector(showDocsFolder(_:)), keyEquivalent: "")
        fileItem.submenu = fileMenu

        let helpItem = NSMenuItem(); main.addItem(helpItem)
        let helpMenu = NSMenu(title: "Help")
        helpMenu.addItem(withTitle: "Learn Tine (Tutorial)", action: #selector(openLearn(_:)), keyEquivalent: "")
        helpMenu.addItem(withTitle: "Music Theory Course", action: #selector(openTheory(_:)), keyEquivalent: "")
        helpItem.submenu = helpMenu
        NSApp.helpMenu = helpMenu
        NSApp.mainMenu = main
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
