// Turning a Scene into concrete, timed notes. Two modes:
//  - live: top-level voices loop forever (plus a launched section, in the DAW)
//  - form: sections play in the order of the `form` line, then the piece ends
import { PRESETS } from "./synth";
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
  written?: { bar: number; bars: number }; // the note a score writes, if not the one that sounds
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
  onInexact?: (voice: string, count: number) => void; // timing that had to be rounded (see R.inexact)
}

function queryVoice(v: VoiceDef, a: R, b: R, ctx: Ctx, opts: QueryOptions): Note[] {
  if (opts.muted?.has(v.name)) return [];
  const before = R.inexact;
  try {
    const notes = resolveNotes(v.name, v.pat.query(a, b, ctx), ctx);
    return notes.some(n => n.params.glide !== undefined) ? withGlide(notes, v, a, ctx) : notes;
  }
  catch (e) {
    if (opts.onError) { opts.onError(v.name, e); return []; }
    throw e instanceof TineError ? e : new TineError("runtime", `in voice '${v.name}': ${(e as Error).message}`, v.span);
  } finally {
    if (opts.onInexact && R.inexact > before) opts.onInexact(v.name, R.inexact - before);
  }
}

// Glide needs the note before each one. A pattern is a function of time, so
// the note before the window is found by asking for the bar before it: the
// same answer live, in a render, from any starting bar.
function withGlide(notes: Note[], v: VoiceDef, a: R, ctx: Ctx): Note[] {
  const before = resolveNotes(v.name, v.pat.query(a.sub(new R(1)), a, ctx), ctx).filter(n => n.start.lt(a));
  const onsets = [...before, ...notes].sort((x, y) => x.start.cmp(y.start));
  return notes.map(n => {
    if (n.params.glide === undefined) return n;
    let prev: Note | undefined;
    for (const o of onsets) { if (!o.start.lt(n.start)) break; if (!prev || !o.start.eq(prev.start)) prev = o; }
    return prev ? { ...n, params: { ...n.params, glideFrom: prev.semi } } : n;
  });
}

function finish(scene: Scene, n: Note, offsetBar: number, offsetSec: number, tempo: number, section?: string): TimedNote {
  const bs = barSeconds(scene, tempo);
  const local = n.start.toNumber();
  let bars = n.dur.toNumber();
  if (n.params.durBeats !== undefined) bars = Number(n.params.durBeats) / scene.meter[0];
  const params = { ...n.params }; delete params.durBeats;
  if (params.loopAt !== undefined) { params.loopSec = Number(params.loopAt instanceof R ? params.loopAt.toNumber() : params.loopAt) * bs; delete params.loopAt; }
  // wobble is in cycles per bar, so it locks to the tempo
  const wob = params.wobble ?? PRESETS[String(params.inst)]?.wobble;
  if (wob !== undefined) { params.wobbleHz = Number(wob instanceof R ? wob.toNumber() : wob) / bs; delete params.wobble; }
  // the fm function switches the synth to its fm wave
  if (params.fm !== undefined && params.wave === undefined && (params.inst === undefined || params.inst === "synth")) { params.wave = "fm"; params.inst = "synth"; }
  if (params.duckRelease !== undefined) { params.duckSec = Number(params.duckRelease instanceof R ? params.duckRelease.toNumber() : params.duckRelease) * bs; delete params.duckRelease; }
  if (params.delayTime !== undefined) { params.delaySec = Number(params.delayTime instanceof R ? params.delayTime.toNumber() : params.delayTime) * bs; delete params.delayTime; }
  const written = n.written ? { written: { bar: offsetBar + n.written.start.toNumber(), bars: n.params.durBeats !== undefined ? bars : n.written.dur.toNumber() } } : {};
  return { voice: n.voice, bar: offsetBar + local, bars, time: offsetSec + local * bs, durSec: bars * bs, semi: n.semi, vel: n.vel, params, section, ...written };
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
