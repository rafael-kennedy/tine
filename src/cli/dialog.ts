// Native file dialogs for `tine daw`, so the DAW page can open and create
// pieces with no terminal. The server shows the dialog; the browser never sees
// a path it did not get from the user's own choice or the recent list.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, dirname } from "node:path";

type Run = (cmd: string[]) => Promise<{ code: number; out: string } | null>;

const run: Run = cmd => new Promise(res => {
  let out = "";
  try {
    const p = spawn(cmd[0], cmd.slice(1), { stdio: ["ignore", "pipe", "ignore"] });
    p.stdout.on("data", d => { out += d; });
    p.on("error", () => res(null));
    p.on("close", code => res({ code: code ?? 1, out: out.trim() }));
  } catch { res(null); }
});

const aq = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const ps = (s: string) => `'${s.replace(/'/g, "''")}'`;

// The dialog commands for this platform, in the order to try them.
// "activate" brings osascript's own dialog in front of the browser; it is the
// current process, so it needs no Automation permission.
export function dialogCommands(kind: "open" | "save", platform = process.platform, dir = homedir()): string[][] {
  if (platform === "darwin") {
    const pick = kind === "open"
      ? `POSIX path of (choose file of type {"tine"} with prompt "Open a Tine piece" default location (POSIX file ${aq(dir)}))`
      : `POSIX path of (choose file name with prompt "New Tine piece" default name "untitled.tine" default location (POSIX file ${aq(dir)}))`;
    return [["osascript", "-e", "tell me to activate", "-e", pick]];
  }
  if (platform === "win32") {
    const cls = kind === "open" ? "OpenFileDialog" : "SaveFileDialog";
    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      // an invisible topmost owner keeps the dialog in front of the browser
      "$o = New-Object System.Windows.Forms.Form -Property @{TopMost=$true; ShowInTaskbar=$false}",
      `$d = New-Object System.Windows.Forms.${cls}`,
      "$d.Filter = 'Tine pieces (*.tine)|*.tine|All files (*.*)|*.*'",
      `$d.InitialDirectory = ${ps(dir)}`,
      kind === "save" ? "$d.FileName = 'untitled.tine'" : "$d.Title = 'Open a Tine piece'",
      "if ($d.ShowDialog($o) -eq 'OK') { [Console]::Out.Write($d.FileName) }",
    ].join("; ");
    return [["powershell", "-NoProfile", "-STA", "-Command", script]];
  }
  return kind === "open"
    ? [["zenity", "--file-selection", "--title=Open a Tine piece", "--file-filter=Tine pieces | *.tine", "--file-filter=All files | *", `--filename=${dir}/`],
       ["kdialog", "--getopenfilename", dir, "*.tine"]]
    : [["zenity", "--file-selection", "--save", "--confirm-overwrite", "--title=New Tine piece", `--filename=${join(dir, "untitled.tine")}`],
       ["kdialog", "--getsavefilename", join(dir, "untitled.tine"), "*.tine"]];
}

export class NoDialog extends Error {}

// The chosen path, or null if the user cancelled. Throws NoDialog when this
// machine has no dialog tool (a Linux box without zenity or kdialog).
export async function chooseFile(kind: "open" | "save", dir?: string, runner: Run = run): Promise<string | null> {
  for (const cmd of dialogCommands(kind, process.platform, dir && existsSync(dir) ? dir : homedir())) {
    const r = await runner(cmd);
    if (!r) continue; // not installed: try the next one
    if (r.code !== 0 || !r.out) return null;
    let p = resolve(r.out.split("\n")[0]);
    if (kind === "save" && !/\.tine$/i.test(p)) p += ".tine";
    return p;
  }
  throw new NoDialog(process.platform === "linux" ? "no file dialog: install zenity or kdialog, or run tine daw path/to/piece.tine" : "no file dialog available");
}

// ---------- recent pieces ----------
const MAX_RECENT = 10;
export function recentFile() { return join(homedir(), ".tine", "recent.json"); }
export function readRecent(file = recentFile()): string[] {
  try { const j = JSON.parse(readFileSync(file, "utf8")); return Array.isArray(j) ? j.filter((p): p is string => typeof p === "string") : []; } catch { return []; }
}
export function pushRecent(path: string, file = recentFile()): string[] {
  const list = [path, ...readRecent(file).filter(p => p !== path)].slice(0, MAX_RECENT);
  try { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(list, null, 1)); } catch { /* read-only home: keep it in memory only */ }
  return list;
}

// ---------- who may call ----------
// Any web page can send requests to 127.0.0.1. Only the DAW page itself may
// open, create or save files: the Host must be ours (a rebinding domain fails
// that), and a request that carries an Origin must come from us.
export function sameOrigin(req: Request, port: number): boolean {
  const ours = [`127.0.0.1:${port}`, `localhost:${port}`];
  const host = req.headers.get("host");
  if (!host || !ours.includes(host)) return false;
  const origin = req.headers.get("origin");
  if (origin && !ours.some(o => origin === `http://${o}`)) return false;
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  return true;
}
