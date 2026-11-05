// Turning a Scene into concrete, timed notes. Two modes:
//  - live: top-level voices loop forever (plus a launched section, in the DAW)
//  - form: sections play in the order of the `form` line, then the piece ends
import { R } from "./rational";
import { Scene, SectionDef, VoiceDef } from "./interp";
import { Ctx, makeCtx, resolveNotes, Inputs, NO_INPUTS, Note } from "./pattern";
import { hashStr } from "./rng";
import { Key } from "./pitch";
import { TineError } from "./errors";

export interface TimedNote {
  voice: string;
  bar: number;      // global position in bars
  bars: number;     // length in bars
  time: number;     // seconds from the start
  durSec: number;
  semi: number;
  vel: number;
  params: Record<string, any>;
  section?: string;
}

export interface Segment { section: SectionDef; startBar: number; bars: number; tempo: number; startSec: number; key: Key }

export function barSeconds(scene: Scene, tempo = scene.tempo) { return (scene.meter[0] * 60) / tempo; }

export function timeline(scene: Scene): { segments: Segment[]; bars: number; seconds: number } {
  const segs: Segment[] = [];
  let bar = 0, sec = 0;
  for (const item of scene.form ?? []) {
    const s = scene.sections.get(item.name);
    if (!s) continue;
    for (let k = 0; k < item.times; k++) {
      const tempo = s.tempo ?? scene.tempo;
      segs.push({ section: s, startBar: bar, bars: s.bars, tempo, startSec: sec, key: s.key ?? scene.key });
      bar += s.bars; sec += s.bars * barSeconds(scene, tempo);
    }
  }
  return { segments: segs, bars: bar, seconds: sec };
}

export interface QueryOptions {
  inputs?: Inputs;
  onError?: (voice: string, err: unknown) => void;   // a broken voice never stops the others
  muted?: Set<string>;
}

function queryVoice(v: VoiceDef, a: R, b: R, ctx: Ctx, opts: QueryOptions): Note[] {
  if (opts.muted?.has(v.name)) return [];
  try { return resolveNotes(v.name, v.pat.query(a, b, ctx), ctx); }
  catch (e) {
    if (opts.onError) { opts.onError(v.name, e); return []; }
    throw e instanceof TineError ? e : new TineError("runtime", `in voice '${v.name}': ${(e as Error).message}`, v.span);
  }
}

function finish(scene: Scene, n: Note, offsetBar: number, offsetSec: number, tempo: number, section?: string): TimedNote {
  const bs = barSeconds(scene, tempo);
  const local = n.start.toNumber();
  let bars = n.dur.toNumber();
  if (n.params.durBeats !== undefined) bars = Number(n.params.durBeats) / scene.meter[0];
  const params = { ...n.params }; delete params.durBeats;
  return { voice: n.voice, bar: offsetBar + local, bars, time: offsetSec + local * bs, durSec: bars * bs, semi: n.semi, vel: n.vel, params, section };
}

// Live mode. `section` (optional) is a launched section whose bar 0 sits at `sectionStart`.
export function liveNotes(scene: Scene, a: number, b: number, opts: QueryOptions & { section?: string; sectionStart?: number } = {}): TimedNote[] {
  const out: TimedNote[] = [];
  const A = R.approx(a), B = R.approx(b);
  const inputs = opts.inputs ?? NO_INPUTS;
  const sec = opts.section ? scene.sections.get(opts.section) : undefined;
  const voices = new Map(scene.voices);
  if (sec) for (const [k, v] of sec.voices) voices.set(k, v);
  const key = sec?.key ?? scene.key;
  const tempo = sec?.tempo ?? scene.tempo;
  for (const v of voices.values()) {
    const inSec = v.section !== undefined;
    const off = inSec ? opts.sectionStart ?? 0 : 0;
    const ctx = makeCtx(scene.seed, hashStr(v.name), key, R.approx(off), inputs);
    const offR = R.approx(off);
    for (const n of queryVoice(v, A.sub(offR), B.sub(offR), ctx, opts)) out.push(finish(scene, n, off, off * barSeconds(scene, tempo), tempo, v.section));
  }
  return out.sort((x, y) => x.bar - y.bar);
}

// Form mode: global bars [a, b) of the arranged piece.
export function formNotes(scene: Scene, a: number, b: number, opts: QueryOptions = {}): TimedNote[] {
  const { segments } = timeline(scene);
  const out: TimedNote[] = [];
  const inputs = opts.inputs ?? NO_INPUTS;
  for (const seg of segments) {
    const s0 = Math.max(a, seg.startBar), s1 = Math.min(b, seg.startBar + seg.bars);
    if (s0 >= s1) continue;
    const voices = new Map(scene.voices);
    for (const [k, v] of seg.section.voices) voices.set(k, v);
    for (const v of voices.values()) {
      const ctx = makeCtx(scene.seed, hashStr(v.name), seg.key, new R(seg.startBar), inputs);
      const lo = R.approx(s0 - seg.startBar), hi = R.approx(s1 - seg.startBar);
      for (const n of queryVoice(v, lo, hi, ctx, opts)) out.push(finish(scene, n, seg.startBar, seg.startSec, seg.tempo, seg.section.name));
    }
  }
  return out.sort((x, y) => x.bar - y.bar);
}

// Everything a file "means" as a finished piece: form if present, else `bars` bars of loop.
export function renderNotes(scene: Scene, bars?: number, opts: QueryOptions = {}): { notes: TimedNote[]; seconds: number; bars: number } {
  if (scene.form && scene.form.length) {
    const tl = timeline(scene);
    const n = bars ?? tl.bars;
    return { notes: formNotes(scene, 0, n, opts), seconds: tl.seconds * (n / tl.bars), bars: n };
  }
  const n = bars ?? 8;
  return { notes: liveNotes(scene, 0, n, opts), seconds: n * barSeconds(scene), bars: n };
}
