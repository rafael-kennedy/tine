package tine.intellij.engine

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.intellij.codeInsight.daemon.DaemonCodeAnalyzer
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.runReadAction
import com.intellij.openapi.components.Service
import com.intellij.openapi.editor.Document
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.options.ShowSettingsUtil
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.psi.PsiManager
import com.intellij.util.Alarm
import com.intellij.util.messages.Topic
import tine.intellij.lang.TineFileType
import tine.intellij.settings.TineCli
import tine.intellij.settings.TineConfigurable
import java.io.File
import java.util.concurrent.CompletableFuture

/** A problem the engine found, placed in a file. Lines and columns count from 0. */
data class EngineProblem(
    val file: String, val line: Int, val col: Int, val endLine: Int, val endCol: Int,
    val message: String, val hint: String?, val runtime: Boolean,
)

/** What the transport shows. Replaced as a whole on every change. */
data class TransportState(
    val running: Boolean = false,       // the engine process is up
    val playing: Boolean = false,
    val bar: Double = 0.0,              // at the engine's render frame, see heardBar()
    val frame: Long = 0,
    val tempo: Double = 120.0,
    val meter: Pair<Int, Int> = 4 to 4,
    val section: String? = null,
    val mode: String = "live",
    val pending: Boolean = false,       // new code waits for the bar line
    val quantize: String = "bar",
    val main: String? = null,
    val files: List<String> = emptyList(),
    val voices: List<String> = emptyList(),
    val active: Set<String> = emptySet(),
)

interface TineEngineListener {
    fun stateChanged(state: TransportState) {}
    /** New code took over at this bar. */
    fun swapped(bar: Int) {}
    /** An evaluation was refused; the last good version keeps playing. */
    fun refused(problems: List<EngineProblem>) {}

    companion object {
        @JvmField val TOPIC: Topic<TineEngineListener> = Topic.create("Tine engine", TineEngineListener::class.java)
    }
}

/**
 * One `tine engine` per project, and the speaker it plays through. The editor
 * buffers are the truth: every evaluation sends the text of each unsaved Tine
 * document, so nothing needs saving to be heard.
 */
@Service(Service.Level.PROJECT)
class TineEngine(private val project: Project) : Disposable {
    @Volatile var state = TransportState(); private set
    private var client: EngineClient? = null
    private var audio: AudioOut? = null
    private val sampleRate = 44100
    private var stopping = false
    private var lastPlayingBar = 0.0
    @Volatile private var problems: List<EngineProblem> = emptyList()
    private val idle = Alarm(Alarm.ThreadToUse.POOLED_THREAD, this)
    private val activeAlarm = Alarm(Alarm.ThreadToUse.POOLED_THREAD, this)

    private fun publish(s: TransportState) {
        state = s
        ApplicationManager.getApplication().invokeLater({ if (!project.isDisposed) project.messageBus.syncPublisher(TineEngineListener.TOPIC).stateChanged(s) }, project.disposed)
    }
    private fun bus(f: (TineEngineListener) -> Unit) =
        ApplicationManager.getApplication().invokeLater({ if (!project.isDisposed) f(project.messageBus.syncPublisher(TineEngineListener.TOPIC)) }, project.disposed)

    // ---------- the process ----------

    @Synchronized
    private fun ensureRunning(): EngineClient? {
        client?.takeIf { it.alive }?.let { return it }
        val exe = TineCli.find()
        if (exe == null) { notifyMissing(); return null }
        stopping = false
        val a = AudioOut({ n -> client?.notify("pull", mapOf("frames" to n)) }, sampleRate, onProblem = { msg -> log(msg) })
        var self: EngineClient? = null
        val c = try {
            EngineClient(listOf(exe.absolutePath, "engine", "--rate", sampleRate.toString()), project.basePath?.let(::File),
                onNotify = ::onNotify, onAudio = { pcm, n -> a.accept(pcm, n) },
                // only the engine in use may restart itself; one that failed its handshake just ends
                onExit = { code, err -> if (self != null && self === client) onExit(code, err) })
                .also { self = it }
        } catch (e: Exception) { warn("Could not start the Tine engine", e.message ?: ""); return null }
        try {
            val hello = c.request("hello").get(5, java.util.concurrent.TimeUnit.SECONDS).asJsonObject
            if ((hello.get("protocol")?.asInt ?: 0) < 1) throw IllegalStateException("protocol ${hello.get("protocol")}")
        } catch (e: Exception) {
            c.close()
            val version = TineCli.version(exe)
            tooOld("${exe.path} is $version, which cannot play inside the IDE: it has no engine command. " +
                "Set a newer tine in Settings | Languages & Frameworks | Tine. The run configurations and the browser DAW still work.")
            return null
        }
        client = c; audio = a
        publish(state.copy(running = true))
        return c
    }

    private fun onExit(code: Int, stderr: String) {
        val wasPlaying = state.playing
        audio?.stop()
        client = null; audio = null
        publish(state.copy(running = false, playing = false, pending = false))
        if (stopping || project.isDisposed) return
        // On stage a crash must cost a beat or two, not the set: start again,
        // evaluate the same files, and pick up at the next bar.
        log("the engine stopped (exit $code), restarting. ${stderr.lines().lastOrNull { it.isNotBlank() } ?: ""}")
        if (wasPlaying && state.main != null) {
            ApplicationManager.getApplication().executeOnPooledThread {
                val from = kotlin.math.floor(lastPlayingBar).toInt() + 1
                play(state.main!!, fromBar = from)
            }
        }
    }

    override fun dispose() {
        stopping = true
        audio?.stop()
        client?.close()
    }

    // ---------- buffers ----------

    /** Text of every unsaved Tine document, plus `extra`, by absolute path. */
    private fun buffers(vararg extra: VirtualFile): Map<String, String> = runReadAction {
        val fdm = FileDocumentManager.getInstance()
        val out = LinkedHashMap<String, String>()
        for (doc in fdm.unsavedDocuments) {
            val f = fdm.getFile(doc) ?: continue
            if (f.fileType == TineFileType && f.isInLocalFileSystem) out[f.path] = doc.text
        }
        for (f in extra) fdm.getDocument(f)?.let { out[f.path] = it.text }
        out
    }

    /** The piece a file belongs to: the playing piece if the file is part of it, else the file itself. */
    /**
     * The piece a file belongs to. The playing piece if the file is part of it;
     * otherwise the file at the top of the use graph that reaches this file
     * (so Cmd+Enter in parts/drums.tine plays the song, not the drums alone);
     * otherwise the file itself.
     */
    fun mainFor(file: VirtualFile): String {
        if (state.main != null && file.path in state.files) return state.main!!
        return rootsOf(file).let { roots -> roots.firstOrNull { it == state.main } ?: roots.firstOrNull() } ?: file.path
    }

    /** Tine files in the project that use `file`, directly or through other files, and are used by none. */
    private fun rootsOf(file: VirtualFile): List<String> = runReadAction {
        val all = com.intellij.psi.search.FilenameIndex.getAllFilesByExt(project, "tine", com.intellij.psi.search.GlobalSearchScope.projectScope(project))
        val fdm = FileDocumentManager.getInstance()
        val uses = HashMap<String, List<String>>()   // file -> files it uses
        for (f in all) {
            val text = fdm.getDocument(f)?.text ?: continue
            uses[f.path] = USE.findAll(text).map { File(f.parent.path, it.groupValues[1]).normalize().path }.toList()
        }
        val usedBy = HashMap<String, MutableList<String>>()
        for ((from, tos) in uses) for (to in tos) usedBy.getOrPut(to) { mutableListOf() } += from
        // walk up from the file to every ancestor that nothing uses
        val roots = LinkedHashSet<String>(); val seen = HashSet<String>(); val todo = ArrayDeque(listOf(file.path))
        while (todo.isNotEmpty()) {
            val f = todo.removeFirst()
            if (!seen.add(f)) continue
            val parents = usedBy[f].orEmpty()
            if (parents.isEmpty()) { if (f != file.path) roots += f } else todo.addAll(parents)
        }
        roots.sorted()
    }

    /** Cmd+Shift+Enter: play this file on its own, even when it is part of a bigger piece. */
    fun auditionAlone(file: VirtualFile): CompletableFuture<Boolean> {
        val c = ensureRunning() ?: return CompletableFuture.completedFuture(false)
        if (state.playing) c.request("stop").get()
        return play(file.path, file)
    }

    fun isPartOfPiece(file: VirtualFile) = file.path in state.files

    // ---------- commands (call off the UI thread) ----------

    /**
     * Cmd+Enter. Evaluates the piece this file belongs to from the editor text.
     * Starts playing if nothing is playing.
     */
    fun evaluate(file: VirtualFile, active: Boolean = false): CompletableFuture<Boolean> {
        val c = ensureRunning() ?: return CompletableFuture.completedFuture(false)
        val main = mainFor(file)
        if (!state.playing && !active) return play(main, file)
        val params = mapOf("main" to main, "buffers" to buffers(file), "active" to active)
        return c.request("eval", params).thenApply { r -> afterEval(r.asJsonObject, main, quiet = active) }
            .exceptionally { e -> log("eval: ${e.message}"); false }
    }

    fun play(main: String, vararg extra: VirtualFile, fromBar: Int = 0): CompletableFuture<Boolean> {
        val c = ensureRunning() ?: return CompletableFuture.completedFuture(false)
        val mainFile = LocalFileSystem.getInstance().findFileByPath(main)
        val bufs = buffers(*listOfNotNull(mainFile).toTypedArray(), *extra)
        return c.request("eval", mapOf("main" to main, "buffers" to bufs)).thenCompose { r ->
            val ok = afterEval(r.asJsonObject, main, quiet = false)
            // a piece that does not evaluate at all has nothing to play
            if (r.asJsonObject.getAsJsonArray("voices") == null) return@thenCompose CompletableFuture.completedFuture(false)
            c.request("play", mapOf("fromBar" to fromBar)).thenApply { p ->
                audio?.start()
                idle.cancelAllRequests()
                publish(state.copy(playing = p.asJsonObject.get("playing")?.asBoolean ?: false, mode = p.asJsonObject.get("mode")?.asString ?: "live"))
                ok
            }
        }.exceptionally { e -> log("play: ${e.message}"); false }
    }

    fun stop() {
        val c = client ?: return
        c.request("stop").thenRun {
            publish(state.copy(playing = false, pending = false))
            // tails ring out, then the device is let go
            idle.cancelAllRequests()
            idle.addRequest({ if (!state.playing) audio?.stop() }, 4000)
        }
    }

    fun togglePlay(file: VirtualFile?) {
        if (state.playing) stop()
        else {
            val main = state.main ?: file?.let(::mainFor) ?: return
            play(main, *listOfNotNull(file).toTypedArray())
        }
    }

    fun setQuantize(q: String) {
        client?.request("quantize", mapOf("value" to q))
        publish(state.copy(quantize = q))
    }

    /** Active voices re-evaluate shortly after typing stops, with no Cmd+Enter. */
    fun documentChanged(doc: Document) {
        if (!state.playing) return
        val f = FileDocumentManager.getInstance().getFile(doc) ?: return
        if (f.fileType != TineFileType || f.path !in state.files) return
        if (!doc.charsSequence.contains("active voice")) return
        activeAlarm.cancelAllRequests()
        activeAlarm.addRequest({ evaluate(f, active = true) }, 150)
    }

    // ---------- replies and notifications ----------

    private fun afterEval(r: JsonObject, main: String, quiet: Boolean): Boolean {
        val errors = r.getAsJsonArray("errors")?.map { problem(it.asJsonObject, runtime = false) } ?: emptyList()
        val files = r.getAsJsonArray("files")?.map { it.asString } ?: listOf(main)
        val voices = r.getAsJsonArray("voices")?.map { it.asJsonObject.get("name").asString }
        problems = errors + problems.filter { it.runtime && it.file in files }
        publish(state.copy(
            main = main, files = files, voices = voices ?: state.voices,
            pending = r.get("pending")?.asBoolean ?: false,
            tempo = r.get("tempo")?.asDouble ?: state.tempo,
        ))
        if (errors.isNotEmpty() && !quiet) bus { it.refused(errors) }
        refreshAnnotations(files)
        return errors.isEmpty()
    }

    private fun onNotify(method: String, p: JsonObject) {
        when (method) {
            "position" -> {
                val bar = p.get("bar").asDouble
                if (p.get("playing").asBoolean) lastPlayingBar = bar
                val meter = p.getAsJsonArray("meter")
                publish(state.copy(
                    playing = p.get("playing").asBoolean, bar = bar, frame = p.get("frame").asLong,
                    tempo = p.get("tempo").asDouble, meter = meter[0].asInt to meter[1].asInt,
                    section = p.get("section")?.takeIf { !it.isJsonNull }?.asString, mode = p.get("mode").asString,
                    pending = p.get("pending").asBoolean, active = (p.getAsJsonArray("active") ?: JsonArray()).map { it.asString }.toSet(),
                ))
            }
            "swap" -> { publish(state.copy(pending = false)); bus { it.swapped(p.get("bar").asInt) } }
            "ended" -> { publish(state.copy(playing = false)); idle.addRequest({ if (!state.playing) audio?.stop() }, 4000) }
            "voiceError" -> {
                val pr = problem(p, runtime = true)
                problems = problems.filter { !(it.runtime && it.file == pr.file && it.line == pr.line) } + pr
                refreshAnnotations(listOf(pr.file))
            }
            "log" -> log(p.get("text")?.asString ?: "")
        }
    }

    private fun problem(o: JsonObject, runtime: Boolean) = EngineProblem(
        o.get("file").asString, o.get("line").asInt, o.get("col").asInt, o.get("endLine").asInt, o.get("endCol").asInt,
        (if (runtime) "while playing, voice ${o.get("voice")?.asString}: " else "") + o.get("message").asString,
        o.get("hint")?.takeIf { !it.isJsonNull }?.asString, runtime,
    )

    /** Runtime problems for a file: errors that only happen while playing. Evaluation errors come from the language server. */
    fun runtimeProblems(path: String): List<EngineProblem> = problems.filter { it.file == path && it.runtime }

    private fun refreshAnnotations(files: List<String>) {
        ApplicationManager.getApplication().invokeLater({
            if (project.isDisposed) return@invokeLater
            val psi = PsiManager.getInstance(project)
            for (path in files) {
                val vf = LocalFileSystem.getInstance().findFileByPath(path) ?: continue
                psi.findFile(vf)?.let { DaemonCodeAnalyzer.getInstance(project).restart(it) }
            }
        }, project.disposed)
    }

    /**
     * The bar being heard now. Positions come from the engine at its render
     * frame; the speaker is behind that by what is queued in the device.
     */
    fun heardBar(): Double {
        val s = state
        if (!s.playing) return s.bar
        val a = audio ?: return s.bar
        val heard = a.framesWritten - a.deviceQueued
        val ahead = (heard - s.frame).toDouble() / sampleRate     // seconds from that position; negative while the device lags
        val barSec = s.meter.first * 60.0 / s.tempo
        return (s.bar + ahead.coerceIn(-1.0, 1.0) / barSec).coerceAtLeast(0.0)
    }

    val underruns get() = audio?.underruns ?: 0

    // ---------- messages ----------

    private fun log(text: String) { if (text.isNotBlank()) com.intellij.openapi.diagnostic.Logger.getInstance(TineEngine::class.java).info("tine engine: $text") }

    private fun warn(title: String, text: String) {
        NotificationGroupManager.getInstance().getNotificationGroup("Tine")
            .createNotification(title, text, NotificationType.WARNING).notify(project)
    }

    /** Said where the person is looking: a hint at the caret, and a balloon with a button to the setting. */
    private fun tooOld(text: String) {
        ApplicationManager.getApplication().invokeLater({
            if (project.isDisposed) return@invokeLater
            com.intellij.openapi.fileEditor.FileEditorManager.getInstance(project).selectedTextEditor?.let {
                com.intellij.codeInsight.hint.HintManager.getInstance().showErrorHint(it, text)
            }
        }, project.disposed)
        NotificationGroupManager.getInstance().getNotificationGroup("Tine")
            .createNotification("Tine: this tine cannot play in the IDE", text, NotificationType.ERROR)
            .addAction(NotificationAction.createSimpleExpiring("Set path...") {
                ShowSettingsUtil.getInstance().showSettingsDialog(project, TineConfigurable::class.java)
            })
            .notify(project)
    }

    private fun notifyMissing() {
        NotificationGroupManager.getInstance().getNotificationGroup("Tine")
            .createNotification("Tine: cannot play", TineCli.NOT_FOUND, NotificationType.WARNING)
            .addAction(NotificationAction.createSimpleExpiring("Set path...") {
                ShowSettingsUtil.getInstance().showSettingsDialog(project, TineConfigurable::class.java)
            })
            .notify(project)
    }

    companion object {
        private val USE = Regex("""(?m)^\s*use\s+"([^"]+)"""")
        fun get(project: Project): TineEngine = project.getService(TineEngine::class.java)
    }
}
