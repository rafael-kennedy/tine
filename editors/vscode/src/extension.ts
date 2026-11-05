import * as vscode from "vscode";
import * as path from "path";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient/node";

let client: LanguageClient | undefined;

export function activate(ctx: vscode.ExtensionContext) {
  // The language server is bundled, so editing works without installing tine.
  const serverModule = ctx.asAbsolutePath(path.join("out", "server.js"));
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.stdio },
    debug: { module: serverModule, transport: TransportKind.stdio },
  };
  const clientOptions: LanguageClientOptions = { documentSelector: [{ scheme: "file", language: "tine" }, { scheme: "untitled", language: "tine" }] };
  client = new LanguageClient("tine", "Tine", serverOptions, clientOptions);
  client.start();

  // Playback commands use the tine executable in a terminal.
  const run = (sub: string, needsFile = true) => async () => {
    const ed = vscode.window.activeTextEditor;
    if (needsFile && (!ed || ed.document.languageId !== "tine")) { vscode.window.showWarningMessage("Open a .tine file first."); return; }
    if (ed && ed.document.isDirty) await ed.document.save();
    const exe = vscode.workspace.getConfiguration("tine").get<string>("path") || "tine";
    const term = vscode.window.terminals.find(t => t.name === "Tine") ?? vscode.window.createTerminal("Tine");
    term.show(true);
    const file = ed ? JSON.stringify(ed.document.fileName) : "";
    term.sendText(`${JSON.stringify(exe)} ${sub}${needsFile ? " " + file : ""}`);
  };
  ctx.subscriptions.push(
    vscode.commands.registerCommand("tine.daw", run("daw")),
    vscode.commands.registerCommand("tine.play", run("play")),
    vscode.commands.registerCommand("tine.render", run("render")),
    vscode.commands.registerCommand("tine.midi", run("midi")),
    vscode.commands.registerCommand("tine.pack", run("pack")),
    vscode.commands.registerCommand("tine.learn", run("learn", false)),
  );
}

export function deactivate() { return client?.stop(); }
