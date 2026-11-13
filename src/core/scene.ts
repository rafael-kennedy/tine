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
    let notes = resolveNotes(v.name, v.pat.query(a, b, ctx), ctx);
    if (notes.some(n => n.params.glide !== undefined)) notes = withGlide(notes, v, a, ctx);
    if (hasSlurs(notes, v, ctx)) notes = withSlurs(notes, v, ctx);
    return notes;
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

// A slurred or glissando note joins the next one into a single sound.
const linked = (n: Note) => !!n.params.slur || (n.params.gliss !== undefined && n.params.gliss !== false && Number(n.params.gliss) > 0);
// Runs break every RUN_BLOCK bars of the voice, so a slur that never ends
// (a loop slurred all the way round) still plays, and a window never has to
// look further than the end of its block.
const RUN_BLOCK = 4;

// Whether a voice slurs at all. A window can hold only the end of a run, so
// the notes in it are not enough to tell; the first bars of the voice are
// asked once, and any slur seen later is remembered.
const slurring = new WeakMap<VoiceDef, boolean>();
const marksSlur = (n: Note) => n.params.slur !== undefined || n.params.gliss !== undefined;
function hasSlurs(notes: Note[], v: VoiceDef, ctx: Ctx): boolean {
  if (notes.some(marksSlur)) { slurring.set(v, true); return true; }
  let s = slurring.get(v);
  if (s === undefined) {
    s = resolveNotes(v.name, v.pat.query(new R(0), new R(RUN_BLOCK), ctx), ctx).some(marksSlur);
    slurring.set(v, s);
  }
  return s;
}

// A run of slurred notes is played as one sound: its first note (the head)
// holds until the last ends and follows the run's pitches, and the others are
// marked slurIn so audio skips them (MIDI and scores still see every note).
// Like glide, this asks the pattern for the bars around the window, so the
// answer is the same live, in a render, and from any starting bar. A chord
// slurs voice by voice: the lowest note to the next lowest, and so on.
function withSlurs(notes: Note[], v: VoiceDef, ctx: Ctx): Note[] {
  const bars = new Map<number, Note[][]>();
  const onsetsOf = (k: number): Note[][] => {
    let g = bars.get(k);
    if (!g) {
      const lo = new R(k), hi = new R(k + 1);
      const ns = resolveNotes(v.name, v.pat.query(lo, hi, ctx), ctx).filter(n => !n.start.lt(lo) && n.start.lt(hi));
      g = [];
      for (const n of ns.sort((x, y) => x.start.cmp(y.start) || x.semi - y.semi)) {
        const last = g[g.length - 1];
        if (last && last[0].start.eq(n.start)) last.push(n); else g.push([n]);
      }
      bars.set(k, g);
    }
    return g;
  };
  // the note at the same place in the onset before (-1) or after (+1), within a bar
  const near = (n: Note, dir: -1 | 1): Note | undefined => {
    const k = Math.floor(n.start.toNumber());
    const groups = [...onsetsOf(k - 1), ...onsetsOf(k), ...onsetsOf(k + 1)];
    const gi = groups.findIndex(g => g[0].start.eq(n.start));
    if (gi < 0) return undefined;
    const at = groups[gi].findIndex(x => x.semi === n.semi);
    return groups[gi + dir]?.[at];
  };
  const span = (x: Note, y: Note) => y.start.sub(x.start).toNumber();
  const block = (x: Note) => Math.floor(x.start.toNumber() / RUN_BLOCK);
  return notes.map(n => {
    const prev = near(n, -1);
    if (prev && linked(prev) && block(prev) === block(n)) return { ...n, params: { ...n.params, slurIn: true } };
    if (!linked(n)) return n;
    const links: { at: number; semi: number; glide: number; gliss: number }[] = [];
    let cur = n, end = n.dur.toNumber();
    for (;;) {
      const next = near(cur, 1);
      if (!next || block(next) !== block(n)) break;
      const gl = cur.params.gliss !== undefined && cur.params.gliss !== false ? Math.min(1, Math.max(0, Number(cur.params.gliss))) : 0;
      links.push({ at: span(n, next), semi: next.semi - n.semi, glide: next.params.glide !== undefined ? Number(next.params.glide) || 0 : 0, gliss: gl });
      end = span(n, next) + next.dur.toNumber();
      if (!linked(next)) break;
      cur = next;
    }
    return links.length ? { ...n, params: { ...n.params, run: { links, end } } } : n;
  });
}

// The pitch path of a run, in seconds and semitones from its first note:
// pairs of [time, offset], joined by straight lines.
function runCurve(run: { links: { at: number; semi: number; glide: number; gliss: number }[] }, bs: number): number[] {
  const out: number[] = [];
  let prevAt = 0, prevSemi = 0;
  for (const l of run.links) {
    const t = l.at * bs;
    if (l.gliss > 0) out.push(t - (l.at - prevAt) * bs * l.gliss, prevSemi, t, l.semi);
    else if (l.glide > 0) out.push(t, prevSemi, t + l.glide, l.semi);
    else out.push(t, prevSemi, t + 0.004, l.semi);
    prevAt = l.at; prevSemi = l.semi;
  }
  return out;
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
  if (params.run !== undefined) { params.curve = runCurve(params.run, bs); params.runSec = params.run.end * bs; delete params.run; }
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
