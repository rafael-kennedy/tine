import { spawn, spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync, readFileSync, existsSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, basename, extname, dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { Scene, renderNotes, mix, encodeWav, decodeWav, SampleData, SampleLibrary, TimedNote, parseSampleMap, sampleMapUrl } from "../core";

// The bundled CC0 library is embedded in the tine binary.
import packPath from "../../assets/samples/tine-samples.tsb" with { type: "file" };

let bundled: Uint8Array | null = null;
export function bundledPack(): Uint8Array {
  if (!bundled) bundled = new Uint8Array(readFileSync(packPath));
  return bundled;
}

const AUDIO = /\.(wav|flac|ogg|mp3|aiff?)$/i;

// A folder of sounds: files at the top are named by file name; a subfolder is
// a bank, like Dirt-Samples (bd/BT0A0A7.wav is "bd/BT0A0A7", and bank "bd").
export function addFolder(lib: SampleLibrary, dir: string, prefix = "") {
  if (!dir || !existsSync(dir) || !statSync(dir).isDirectory()) return 0;
  let n = 0;
  if (!prefix) lib.replaceBanks(readdirSync(dir).filter(f => statSync(join(dir, f)).isDirectory()));
  for (const f of readdirSync(dir).sort()) {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) { if (!prefix) n += addFolder(lib, full, f); continue; }
    if (!AUDIO.test(f)) continue;
    const name = (prefix ? prefix + "/" : "") + basename(f, extname(f));
    lib.add(name, () => decodeAudioFile(full), prefix || undefined);
    n++;
  }
  return n;
}

// WAV is read directly; other formats go through ffmpeg when it is installed.
function decodeAudioFile(path: string): SampleData {
  if (extname(path).toLowerCase() === ".wav") return decodeWav(readFileSync(path));
  return decodeAny(readFileSync(path), path);
}
function decodeAny(bytes: Uint8Array, name: string): SampleData {
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return decodeWav(bytes);
  if (!has("ffmpeg")) throw new Error(`${basename(name)}: only WAV can be read without ffmpeg installed`);
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", "pipe:0", "-ac", "1", "-f", "f32le", "-ar", "44100", "pipe:1"], { input: bytes, maxBuffer: 1 << 29 });
  if (r.status !== 0) throw new Error(`${basename(name)}: ffmpeg could not read it`);
  const b = r.stdout as Buffer;
  return { channels: [new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))], sr: 44100 };
}

// The sample library for a piece: the bundled sounds, the samples folder next
// to it (or --samples), and every samples(...) line in it.
export async function loadSamples(scene: Scene | null, opts: { dir?: string; file?: string; quiet?: boolean } = {}): Promise<SampleLibrary> {
  const lib = new SampleLibrary();
  lib.addPack(bundledPack());
  const dir = opts.dir ?? (opts.file ? join(dirname(resolve(opts.file)), "samples") : undefined);
  if (dir) addFolder(lib, dir);
  // a packed executable unpacks its piece's own sounds here (see pack in main.ts)
  const own = opts.file ? join(dirname(resolve(opts.file)), "piece-samples.tsb") : "";
  if (own && existsSync(own)) lib.addPack(new Uint8Array(readFileSync(own)));
  for (const src of scene?.sampleSources ?? []) {
    try {
      const local = opts.file ? resolve(dirname(resolve(opts.file)), src) : resolve(src);
      if (!/^(https?|github):/.test(src) && existsSync(local)) { addFolder(lib, local); continue; }
      const url = sampleMapUrl(src);
      const map = JSON.parse(new TextDecoder().decode(await cachedFetch(url)));
      lib.addRemotePack(parseSampleMap(map, url));
    } catch (e) { if (!opts.quiet) console.error(`samples("${src}"): ${(e as Error).message}`); }
  }
  return lib;
}

// Downloads are kept in ~/.cache/tine, so a pack is fetched once.
async function cachedFetch(url: string): Promise<Uint8Array> {
  const dir = join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "tine", "samples");
  const file = join(dir, createHash("sha1").update(url).digest("hex") + extname(new URL(url).pathname).slice(0, 6));
  if (existsSync(file)) return new Uint8Array(readFileSync(file));
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const b = new Uint8Array(await r.arrayBuffer());
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, b);
  return b;
}

// Fetch the remote sounds these notes need, before mixing.
export async function fetchNeeded(lib: SampleLibrary, notes: TimedNote[], quiet = false) {
  const want = new Set<string>();
  for (const n of notes) {
    const inst = String(n.params.inst ?? "");
    if (!inst.startsWith("sample:")) continue;
    const name = lib.resolve(inst.slice(7), n.params.sampleN, n.params.drum);
    if (name && lib.pendingUrl(name)) want.add(name);
    else if (!name && !quiet) { console.error(`no sample named "${inst.slice(7) || n.params.drum}"`); quiet = true; }
  }
  await Promise.all([...want].map(name => lib.fetch(name, cachedFetch, async b => decodeAny(b, name)).then(ok => { if (!ok && !quiet) console.error(`could not load sample "${name}"`); })));
}

export async function renderToWav(scene: Scene, bars?: number, sr = 44100, samples?: SampleLibrary) {
  const { notes, seconds } = renderNotes(scene, bars, {});
  const lib = samples ?? await loadSamples(scene);
  await fetchNeeded(lib, notes);
  const [L, R] = mix(notes, seconds, sr, { tuningRef: scene.tuningRef, samples: lib });
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
