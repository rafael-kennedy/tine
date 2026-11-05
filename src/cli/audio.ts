import { spawn, spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename, extname } from "node:path";
import { Scene, renderNotes, mix, encodeWav, decodeWav, SampleData } from "../core";

export function loadSamples(dir?: string): Map<string, SampleData> {
  const m = new Map<string, SampleData>();
  if (!dir || !existsSync(dir)) return m;
  for (const f of readdirSync(dir)) {
    if (extname(f).toLowerCase() !== ".wav") continue;
    try { m.set(basename(f, extname(f)), decodeWav(readFileSync(join(dir, f)))); } catch { /* skip unreadable */ }
  }
  return m;
}

export function renderToWav(scene: Scene, bars?: number, sr = 44100, samples?: Map<string, SampleData>) {
  const { notes, seconds } = renderNotes(scene, bars, {});
  const [L, R] = mix(notes, seconds, sr, { tuningRef: scene.tuningRef, samples });
  return { wav: encodeWav([L, R], sr), seconds, notes };
}

function has(cmd: string): boolean {
  const r = spawnSync(process.platform === "win32" ? "where" : "which", [cmd], { stdio: "ignore" });
  return r.status === 0;
}

export async function playWav(wav: Uint8Array): Promise<boolean> {
  const dir = mkdtempSync(join(tmpdir(), "tine-"));
  const file = join(dir, "play.wav");
  writeFileSync(file, wav);
  let cmd: string[] | null = null;
  if (process.platform === "darwin") cmd = ["afplay", file];
  else if (process.platform === "win32") cmd = ["powershell", "-NoProfile", "-c", `(New-Object Media.SoundPlayer '${file}').PlaySync()`];
  else for (const c of [["paplay", file], ["aplay", "-q", file], ["pw-play", file], ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", file]]) if (has(c[0])) { cmd = c; break; }
  if (!cmd) return false;
  return new Promise(res => {
    const p = spawn(cmd![0], cmd!.slice(1), { stdio: "ignore" });
    p.on("exit", () => res(true));
    p.on("error", () => res(false));
  });
}

export function openBrowser(url: string) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try { spawn(cmd, args, { stdio: "ignore", detached: true }).unref(); } catch { /* headless */ }
}
