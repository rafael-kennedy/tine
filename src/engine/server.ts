// `tine engine`: Tine as a headless audio engine for editors. The editor owns
// the audio device and pulls audio; the engine evaluates code, schedules notes
// and renders. Nothing here touches a sound card, so the same engine serves a
// JetBrains plugin through Java Sound today and a native output later.
//
// Protocol. Requests come in on stdin, one JSON object per line:
//   {"id": 1, "method": "eval", "params": {...}}
// Everything goes out on stdout as frames: one type byte, a 32-bit
// little-endian length, then the payload.
//   type 1: a JSON message (a response {id, result | error} or a notification {method, params})
//   type 2: audio: a 32-bit frame count, then that many stereo frames of 16-bit PCM
// The editor sends "pull" for each block it wants; the engine answers with one
// audio frame. So the audio device is the clock, and the engine never runs ahead
// of it by more than what the editor has asked for.
import { readFileSync } from "node:fs";
import { dirname, resolve, isAbsolute } from "node:path";
import { evaluate, parse, Scene, TineError, lineCol, StreamMixer, toPcm16, VERSION, SampleLibrary, renderNotes } from "../core";
import { EngineTransport, Quantize } from "./transport";

export interface Out { write(b: Uint8Array): void }

type Loc = { file: string; line: number; col: number; endLine: number; endCol: number };

export class Engine {
  main = "";
  buffers = new Map<string, string>();     // unsaved editor text by absolute path
  mixer: StreamMixer;
  transport: EngineTransport;
  files: string[] = [];                    // absolute paths the last good evaluation read
  private lastPos = -Infinity;
  private voiceErrors = new Set<string>();
  private lib: SampleLibrary | null = null;
  private libKey = "";
  private fetching = new Set<string>();
  private active = new Set<string>();      // voices that started a note since the last position
  version = 0;

  constructor(private out: Out, public sr = 44100, private io: EngineIO = nodeIO) {
    this.mixer = new StreamMixer(sr);
    this.transport = new EngineTransport(this.mixer);
    this.transport.onError = (v, e) => this.voiceError(v, e);
    this.transport.onSwap = bar => this.notify("swap", { bar });
    this.transport.onSection = name => this.notify("section", { name: name ?? null });
    this.transport.onEnd = () => this.notify("ended", {});
    this.transport.onNote = n => this.active.add(n.voice);
  }

  // ---------- framing ----------
  private frame(type: number, payload: Uint8Array) {
    const head = new Uint8Array(5);
    head[0] = type; new DataView(head.buffer).setUint32(1, payload.length, true);
    this.out.write(head); this.out.write(payload);
  }
  send(msg: any) { this.frame(1, new TextEncoder().encode(JSON.stringify(msg))); }
  notify(method: string, params: any) { this.send({ method, params }); }

  // ---------- files ----------
  private read(abs: string): string {
    const b = this.buffers.get(abs);
    return b !== undefined ? b : this.io.readFile(abs);
  }
  private abs(p: string) { return isAbsolute(p) ? p : resolve(dirname(this.main), p); }

  private loc(file: string, span?: { start: number; end: number }): Loc {
    let src = "";
    try { src = this.read(file); } catch { /* gone */ }
    const s = lineCol(src, span?.start ?? 0), e = lineCol(src, span?.end ?? (span?.start ?? 0) + 1);
    return { file, line: s.line, col: s.col, endLine: e.line, endCol: e.col };
  }
  private errorOut(e: unknown): any {
    if (!(e instanceof TineError)) return { message: String((e as Error)?.message ?? e), kind: "runtime", ...this.loc(this.main) };
    const at = this.loc(this.main, e.span);
    const origin = e.origin ? this.loc(this.abs(e.origin.file), e.origin.span) : null;
    // an error in a used file is placed there, and also on the use line (via)
    return { message: e.origin?.message ?? e.message, hint: e.hint ?? null, kind: e.kind, ...(origin ?? at), via: origin ? { ...at, message: e.message } : null };
  }

  // ---------- evaluation ----------
  evalGraph(p: { main?: string; buffers?: Record<string, string>; closed?: string[]; active?: boolean }) {
    if (p.main) this.main = resolve(p.main);
    for (const [k, v] of Object.entries(p.buffers ?? {})) this.buffers.set(resolve(k), v);
    for (const k of p.closed ?? []) this.buffers.delete(resolve(k));
    if (!this.main) throw new Error("no main file: send eval with main");
    const files = [this.main];
    let scene: Scene;
    const seed = this.transport.scene?.seed;
    try {
      scene = evaluate(this.read(this.main), {
        seed, keepGoing: true,
        readFile: rel => { const a = this.abs(rel); if (!files.includes(a)) files.push(a); return this.read(a); },
      });
    } catch (e) {
      return { ok: false, errors: [this.errorOut(e)], files };
    }
    const errors = scene.errors.map(e => this.errorOut(e));
    // A file with errors still swaps in, as in the browser, but a voice that
    // failed to evaluate keeps its last good version: a typo never silences a part.
    const prev = this.transport.scene, kept: string[] = [];
    if (errors.length && prev) {
      const written = new Set(files.flatMap(f => { try { return parse(this.read(f)).stmts.filter(x => x.t === "voice").map(x => (x as any).name as string); } catch { return []; } }));
      for (const [k, v] of prev.voices) if (!scene.voices.has(k) && written.has(k.slice(k.lastIndexOf(".") + 1))) { scene.voices.set(k, v); kept.push(k); }
    }
    this.files = files;
    this.version++;
    this.voiceErrors.clear();
    void this.prepareSounds(scene);
    let swapped: string[] | undefined;
    if (p.active && this.transport.playing) swapped = this.transport.swapActive(scene, new Set(EngineTransport.voiceNames(scene)));
    else this.transport.load(scene);
    return { ok: errors.length === 0, errors, files, kept, swapped, pending: !!this.transport.pending, ...this.describe(scene) };
  }

  describe(s: Scene) {
    const v = (d: { name: string; span: any; file?: string; section?: string; active?: boolean }) =>
      ({ name: d.name, section: d.section ?? null, active: !!d.active, ...this.loc(d.file ? this.abs(d.file) : this.main, d.span) });
    return {
      tempo: s.tempo, meter: s.meter, key: String(s.key), seed: s.seed,
      form: s.form, voices: [...s.voices.values()].map(v),
      sections: [...s.sections.values()].map(x => ({ name: x.name, bars: x.bars, voices: [...x.voices.values()].map(v), ...this.loc(x.file ? this.abs(x.file) : this.main, x.span) })),
      prints: s.prints,
    };
  }

  // Samples: the bundled sounds, a samples folder, samples(...) lines. Remote
  // ones load in the background; until they arrive their notes are silent.
  private async prepareSounds(scene: Scene) {
    const key = [this.main, ...scene.sampleSources].join("|");
    if (key !== this.libKey || !this.lib) {
      this.libKey = key;
      try { this.lib = await this.io.loadSamples(scene, this.main); } catch (e) { this.notify("log", { text: `samples: ${(e as Error).message}` }); }
      this.mixer.sources.samples = this.lib ?? undefined;
    }
    try { this.mixer.sources.soundfont = await this.io.loadSoundfont(scene, this.main); } catch { /* reported by loader */ }
    this.mixer.sources.tuningRef = scene.tuningRef;
    if (this.lib) {
      try { await this.io.fetchNeeded(this.lib, renderNotes(scene, scene.form?.length ? undefined : 4, { onError: () => {} }).notes); }
      catch { /* a sound that cannot load stays silent */ }
    }
  }

  private voiceError(voice: string, e: unknown) {
    const key = `${this.version}:${voice}`;
    if (this.voiceErrors.has(key)) return;
    this.voiceErrors.add(key);
    const s = this.transport.scene;
    const def = s?.voices.get(voice) ?? [...(s?.sections.values() ?? [])].find(x => x.voices.has(voice))?.voices.get(voice);
    const at = def ? this.loc(def.file ? this.abs(def.file) : this.main, def.span) : this.loc(this.main);
    this.notify("voiceError", { voice, message: (e as Error)?.message ?? String(e), ...at });
  }

  // ---------- audio ----------
  pull(frames: number) {
    frames = Math.max(1, Math.min(16384, Math.floor(frames)));
    const t = this.transport;
    t.tick((this.mixer.frame + frames) / this.sr);
    const F = this.mixer.frame;
    if (F - this.lastPos >= this.sr * 0.04) { this.lastPos = F; this.position(F); }
    const [L, R] = this.mixer.render(frames);
    const pcm = toPcm16(L, R);
    const payload = new Uint8Array(4 + pcm.length);
    new DataView(payload.buffer).setUint32(0, frames, true);
    payload.set(pcm, 4);
    this.frame(2, payload);
  }

  private position(frame: number) {
    const t = this.transport;
    const s = t.scene;
    this.notify("position", {
      frame, playing: t.playing, bar: t.playing ? t.currentBar(frame / this.sr) : 0,
      tempo: t.tempo(), meter: s?.meter ?? [4, 4], section: t.section ?? null, mode: t.mode,
      active: [...this.active], pending: !!t.pending,
    });
    this.active.clear();
  }

  // ---------- requests ----------
  handle(msg: any) {
    const P = msg.params ?? {};
    const reply = (result: any) => { if (msg.id !== undefined) this.send({ id: msg.id, result }); };
    try {
      switch (msg.method) {
        case "hello": return reply({ version: VERSION, sr: this.sr, protocol: 1 });
        case "eval": return reply(this.evalGraph(P));
        case "play": {
          if (P.main || P.buffers) { const r = this.evalGraph(P); if (!this.transport.scene) return reply({ ...r, playing: false }); }
          if (P.section !== undefined) this.transport.launch(P.section);
          if (P.loop !== undefined) this.transport.loopForm = !!P.loop;
          this.transport.start(Number(P.fromBar ?? 0));
          return reply({ playing: this.transport.playing, mode: this.transport.mode });
        }
        case "stop": this.transport.stop(); return reply({ playing: false });
        case "launch": this.transport.launch(P.section ?? null); return reply({});
        case "quantize": this.transport.quantize = (["bar", "beat", "now"].includes(P.value) ? P.value : "bar") as Quantize; return reply({});
        case "loop": this.transport.loopForm = !!P.value; return reply({});
        case "mute": case "solo": {
          const set = msg.method === "mute" ? this.transport.muted : this.transport.soloed;
          const on = P.value ?? !set.has(P.voice);
          if (on) set.add(P.voice); else set.delete(P.voice);
          this.transport.applyGains();
          return reply({ muted: [...this.transport.muted], soloed: [...this.transport.soloed] });
        }
        case "gain": this.transport.faders.set(P.voice, Number(P.value)); this.transport.applyGains(); return reply({});
        case "master": this.mixer.master = Math.max(0, Math.min(2, Number(P.value))); return reply({});
        case "pull": return this.pull(Number(P.frames ?? 1024));
        case "shutdown": reply(null); return this.io.exit();
        default: if (msg.id !== undefined) this.send({ id: msg.id, error: { message: `unknown method ${msg.method}` } });
      }
    } catch (e) {
      if (msg.id !== undefined) this.send({ id: msg.id, error: { message: (e as Error)?.message ?? String(e) } });
      else this.notify("log", { text: String((e as Error)?.message ?? e) });
    }
  }
}

export interface EngineIO {
  readFile(path: string): string;
  loadSamples(scene: Scene, main: string): Promise<SampleLibrary>;
  loadSoundfont(scene: Scene, main: string): Promise<any>;
  fetchNeeded(lib: SampleLibrary, notes: any[]): Promise<void>;
  exit(): void;
}

const nodeIO: EngineIO = {
  readFile: p => readFileSync(p, "utf8"),
  loadSamples: async (scene, main) => (await import("../cli/audio")).loadSamples(scene, { file: main, quiet: true }),
  loadSoundfont: async (scene, main) => (await import("../cli/audio")).loadSoundfont(scene, main, true),
  fetchNeeded: async (lib, notes) => (await import("../cli/audio")).fetchNeeded(lib, notes, true),
  exit: () => process.exit(0),
};

export function startEngine(sr = 44100) {
  // stdout carries frames only: anything printed goes to stderr
  console.log = (...a: any[]) => console.error(...a);
  const engine = new Engine({ write: b => { process.stdout.write(b); } }, sr);
  let buf = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk: string) => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg: any;
      try { msg = JSON.parse(line); } catch { engine.notify("log", { text: `not JSON: ${line.slice(0, 80)}` }); continue; }
      engine.handle(msg);
    }
  });
  process.stdin.on("end", () => process.exit(0));
}
