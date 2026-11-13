// Patterns are functions of time. A pattern answers one question:
// "which events begin between time a and time b?" Time is in bars, as
// exact rationals. Everything musical in Tine (phrases, chords, loops,
// randomness, controller input) is built by composing such functions,
// which is what makes live hot-swapping and look-ahead scheduling trivial.

import { R, ZERO, ONE } from "./rational";
import { Key, Pitch, Degree, DEFAULT_KEY } from "./pitch";
import { rand01 } from "./rng";

export interface Inputs {
  cc: (n: number, chan?: number) => number;        // 0..1
  held: () => number[];                             // currently held MIDI notes
}

export const NO_INPUTS: Inputs = { cc: () => 0, held: () => [] };

export interface Ctx {
  seed: number;
  voice: number;       // hash of voice name, keys randomness per voice
  key: Key;
  offset: R;           // global bar at which local bar 0 sits (sections)
  inputs: Inputs;
}

export function makeCtx(seed: number, voice = 0, key = DEFAULT_KEY, offset = ZERO, inputs = NO_INPUTS): Ctx {
  return { seed, voice, key, offset, inputs };
}

export type Params = Record<string, any>;
export interface Ev { s: R; e: R; v: any; p: Params }

export class Chord {
  // root and bass are optional metadata from chord symbols (c@7/e, changes("C7/E")),
  // used by root(), bass(), name() and the voicing functions.
  constructor(public notes: any[], public root?: any, public bass?: any) {}
  // the same chord with each note (and its root/bass) mapped
  map(f: (x: any) => any): Chord { return new Chord(this.notes.map(f), this.root === undefined ? undefined : f(this.root), this.bass === undefined ? undefined : f(this.bass)); }
  toString() { return `{${this.notes.map(String).join(" ")}}`; }
}

export class Rest { toString() { return "."; } }
export const REST = new Rest();

type Q = (a: R, b: R, ctx: Ctx) => Ev[];

export class Pat {
  sig?: (t: number, ctx: Ctx) => any;
  constructor(public query: Q, public items?: any[], public label?: string) {}
  toString() { return this.label ?? (this.items ? `[${this.items.map(String).join(" ")}]` : "<pattern>"); }
}

const EMPTY: Ev[] = [];
export const silence = new Pat(() => EMPTY, [], "silence");

// iterate the bars that intersect [a, b)
function* bars(a: R, b: R): Generator<{ c: number; lo: R; hi: R }> {
  for (let c = a.floor(); c < b.toNumber(); c++) {
    const cs = new R(c), ce = new R(c + 1);
    const lo = R.max(a, cs), hi = R.min(b, ce);
    if (lo.lt(hi)) yield { c, lo, hi };
  }
}

export function pure(v: any): Pat {
  if (v instanceof Pat) return v;
  const p = new Pat((a, b) => {
    const out: Ev[] = [];
    for (let c = a.ceil(); c < b.toNumber(); c++) out.push({ s: new R(c), e: new R(c + 1), v, p: {} });
    return out;
  }, undefined, String(v));
  p.items = [v];
  return p;
}

export function toPat(v: any): Pat {
  if (v instanceof Pat) return v;
  if (Array.isArray(v)) return seq(v.map(x => ({ pat: toPat(x), w: ONE })), v);
  if (v === null || v === undefined || v instanceof Rest) return restPat;
  return pure(v);
}

export const restPat = new Pat(() => EMPTY, [REST], ".");

// Children placed side by side inside one bar, each taking a share
// proportional to its weight.
export function seq(children: { pat: Pat; w: R }[], items?: any[]): Pat {
  const total = children.reduce((s, c) => s.add(c.w), ZERO);
  if (total.n === 0) return silence;
  let acc = ZERO;
  const slots = children.map(ch => { const x0 = acc.div(total); acc = acc.add(ch.w); return { pat: ch.pat, x0, w: ch.w.div(total) }; });
  return new Pat((a, b, ctx) => {
    const out: Ev[] = [];
    for (const { c, lo, hi } of bars(a, b)) {
      const C = new R(c);
      for (const sl of slots) {
        const gs = C.add(sl.x0), ge = gs.add(sl.w);
        const l = R.max(lo, gs), h = R.min(hi, ge);
        if (!l.lt(h)) continue;
        const toLocal = (t: R) => C.add(t.sub(gs).div(sl.w));
        const toGlobal = (u: R) => gs.add(u.sub(C).mul(sl.w));
        for (const ev of sl.pat.query(toLocal(l), toLocal(h), ctx)) {
          out.push({ s: toGlobal(ev.s), e: toGlobal(ev.e), v: ev.v, p: ev.p });
        }
      }
    }
    return out;
  }, items);
}

export function stack(pats: Pat[]): Pat {
  if (pats.length === 1) return pats[0];
  return new Pat((a, b, ctx) => pats.flatMap(p => p.query(a, b, ctx)));
}

// One child per bar, in turn. Each child only advances when it plays.
export function alt(pats: Pat[]): Pat {
  const n = pats.length;
  if (!n) return silence;
  return new Pat((a, b, ctx) => {
    const out: Ev[] = [];
    for (const { c, lo, hi } of bars(a, b)) {
      const i = ((c % n) + n) % n;
      const off = new R(Math.floor(c / n) - c);
      for (const ev of pats[i].query(lo.add(off), hi.add(off), ctx)) out.push({ s: ev.s.sub(off), e: ev.e.sub(off), v: ev.v, p: ev.p });
    }
    return out;
  });
}

export function fast(k: R, p: Pat): Pat {
  if (k.n <= 0) return silence;
  if (k.eq(ONE)) return p;
  return new Pat((a, b, ctx) => p.query(a.mul(k), b.mul(k), ctx).map(ev => ({ s: ev.s.div(k), e: ev.e.div(k), v: ev.v, p: ev.p })));
}

export function shift(t: R, p: Pat): Pat {
  if (t.n === 0) return p;
  return new Pat((a, b, ctx) => p.query(a.sub(t), b.sub(t), ctx).map(ev => ({ s: ev.s.add(t), e: ev.e.add(t), v: ev.v, p: ev.p })));
}

export function rev(p: Pat): Pat {
  return new Pat((a, b, ctx) => {
    const out: Ev[] = [];
    for (const { c } of bars(a, b)) {
      const m = new R(2 * c + 1);
      for (const ev of p.query(new R(c), new R(c + 1), ctx)) {
        const s = m.sub(ev.e), e = m.sub(ev.s);
        if (s.ge(a) && s.lt(b)) out.push({ s, e, v: ev.v, p: ev.p });
      }
    }
    return out;
  });
}

// choose a pattern per bar
export function perBarSelect(fn: (c: number, ctx: Ctx) => Pat): Pat {
  return new Pat((a, b, ctx) => {
    const out: Ev[] = [];
    for (const { c, lo, hi } of bars(a, b)) for (const ev of fn(c, ctx).query(lo, hi, ctx)) out.push(ev);
    return out;
  });
}

// Build a fresh pattern for each bar from a function of the bar number.
// Results are cached because the scheduler queries small slices of a bar.
export function perBar(fn: (bar: number, ctx: Ctx) => Pat): Pat {
  const cache = new Map<string, Pat>();
  return perBarSelect((c, ctx) => {
    const k = `${ctx.seed}|${ctx.voice}|${ctx.offset}|${c}`;
    let p = cache.get(k);
    if (!p) {
      p = fn(c, ctx);
      cache.set(k, p);
      if (cache.size > 256) cache.delete(cache.keys().next().value!);
    }
    return p;
  });
}

// State carried from bar to bar, without giving up replayability: the state
// at bar n is step(state at n-1, n), always computed forward from bar 0 and
// memoized. Looking ahead, rewinding or querying out of order therefore
// gives exactly the same states as playing straight through.
export const MAX_EVOLVE_BARS = 100_000;
export function evolve(init: any, step: (state: any, bar: number, ctx: Ctx) => any, view: (state: any, bar: number, ctx: Ctx) => Pat): Pat {
  const states = new Map<string, any[]>();
  const views = new Map<string, Pat>();
  const stateAt = (c: number, ctx: Ctx) => {
    if (c < 0) return init;
    if (c > MAX_EVOLVE_BARS) throw new Error(`evolve can look ahead at most ${MAX_EVOLVE_BARS} bars`);
    const k = `${ctx.seed}|${ctx.voice}|${ctx.offset}`;
    let arr = states.get(k);
    if (!arr) { arr = [init]; states.set(k, arr); if (states.size > 32) states.delete(states.keys().next().value!); }
    // arr[i] is the state at bar i; bar 0 starts from init
    while (arr.length <= c) arr.push(step(arr[arr.length - 1], arr.length, ctx));
    return arr[c];
  };
  return perBarSelect((c, ctx) => {
    const k = `${ctx.seed}|${ctx.voice}|${ctx.offset}|${c}`;
    let p = views.get(k);
    if (!p) { p = view(stateAt(c, ctx), c, ctx); views.set(k, p); if (views.size > 256) views.delete(views.keys().next().value!); }
    return p;
  });
}

export function mapEv(p: Pat, f: (ev: Ev, ctx: Ctx) => Ev | null): Pat {
  const np = new Pat((a, b, ctx) => {
    const out: Ev[] = [];
    for (const ev of p.query(a, b, ctx)) { const r = f(ev, ctx); if (r) out.push(r); }
    return out;
  });
  return np;
}

export function mapV(p: Pat, f: (v: any, ctx: Ctx) => any): Pat {
  const np = mapEv(p, (ev, ctx) => ({ ...ev, v: f(ev.v, ctx) }));
  if (p.items && !p.sig) np.items = p.items.map(v => (v instanceof Pat ? mapV(v, f) : v instanceof Rest ? v : f(v, makeCtx(0))));
  if (p.sig) { const s = p.sig; np.sig = (t, ctx) => f(s(t, ctx), ctx); }
  return np;
}

export function withCtx(p: Pat, f: (ctx: Ctx) => Ctx): Pat {
  const np = new Pat((a, b, ctx) => p.query(a, b, f(ctx)), p.items);
  if (p.sig) { const s = p.sig; np.sig = (t, ctx) => s(t, f(ctx)); }
  return np;
}

// Value of a pattern at time t: the event sounding at t, or a signal value.
export function sampleAt(v: any, t: R, ctx: Ctx): any {
  if (!(v instanceof Pat)) return v;
  if (v.sig) return v.sig(t.toNumber(), ctx);
  const c = t.floor();
  const evs = v.query(new R(c), new R(c + 1), ctx);
  let best: Ev | undefined;
  for (const ev of evs) if (ev.s.le(t) && (!best || ev.s.gt(best.s))) best = ev;
  if (!best) best = evs[0];
  return best ? best.v : undefined;
}

export function setParam(p: Pat, name: string, value: any): Pat {
  return mapEv(p, (ev, ctx) => ({ ...ev, p: { ...ev.p, [name]: sampleAt(value, ev.s, ctx) } }));
}

// A continuous signal; as a pattern it yields one sample per bar.
export function signal(fn: (t: number, ctx: Ctx) => any, label = "signal"): Pat {
  const p = new Pat((a, b, ctx) => {
    const out: Ev[] = [];
    for (let c = a.ceil(); c < b.toNumber(); c++) out.push({ s: new R(c), e: new R(c + 1), v: fn(c, ctx), p: {} });
    return out;
  }, undefined, label);
  p.sig = fn;
  return p;
}

// Sample a signal (or any pattern) n times per bar into discrete events.
export function segment(n: number, p: Pat): Pat {
  const step = new R(1, 1).div(R.of(n));
  return new Pat((a, b, ctx) => {
    const out: Ev[] = [];
    let k = a.div(step).ceil();
    for (;; k++) {
      const s = step.mul(new R(k));
      if (!s.lt(b)) break;
      out.push({ s, e: s.add(step), v: sampleAt(p, s, ctx), p: {} });
    }
    return out;
  });
}

export function filterEv(p: Pat, f: (ev: Ev, ctx: Ctx) => boolean): Pat {
  return mapEv(p, (ev, ctx) => (f(ev, ctx) ? ev : null));
}

// position-keyed randomness for an event
export function evRand(ctx: Ctx, salt: number, t: R, extra = 0): number {
  const g = t.add(ctx.offset);
  return rand01(ctx.seed, ctx.voice, salt, g.n, g.d, extra);
}

export function degrade(prob: number | Pat, salt: number, p: Pat): Pat {
  return filterEv(p, (ev, ctx) => evRand(ctx, salt, ev.s) >= Number(sampleAt(prob, ev.s, ctx)));
}

export function choice(opts: Pat[], salt: number): Pat {
  return perBarSelect((c, ctx) => {
    const r = rand01(ctx.seed, ctx.voice, salt, c + ctx.offset.toNumber());
    return opts[Math.floor(r * opts.length)];
  });
}

export function bjorklund(k: number, n: number): boolean[] {
  k = Math.max(0, Math.min(k, n));
  // Equivalent to Bjorklund's algorithm up to rotation; starts on a hit.
  return Array.from({ length: n }, (_, i) => (i * k) % n < k);
}

export function euclid(p: Pat, k: number, n: number, rot = 0): Pat {
  let bits = bjorklund(k, n);
  if (rot) { const r = ((rot % n) + n) % n; bits = [...bits.slice(r), ...bits.slice(0, r)]; }
  return seq(bits.map(b => ({ pat: b ? p : restPat, w: ONE })));
}

export function every(n: number, f: Pat, p: Pat, offset: number): Pat {
  return perBarSelect(c => ((((c - offset) % n) + n) % n === 0 ? f : p));
}

// Concatenate patterns in time, each lasting `bars` bars, looping overall.
export function arrange(parts: { pat: Pat; bars: number }[]): Pat {
  const total = parts.reduce((s, x) => s + x.bars, 0);
  if (!total) return silence;
  return new Pat((a, b, ctx) => {
    const out: Ev[] = [];
    for (const { c, lo, hi } of bars(a, b)) {
      const loop = Math.floor(c / total), pos = c - loop * total;
      let acc = 0;
      for (const part of parts) {
        if (pos < acc + part.bars) {
          const start = loop * total + acc; // global bar where part starts
          const off = new R(start);
          for (const ev of part.pat.query(lo.sub(off), hi.sub(off), ctx)) out.push({ s: ev.s.add(off), e: ev.e.add(off), v: ev.v, p: ev.p });
          break;
        }
        acc += part.bars;
      }
    }
    return out;
  });
}

// ---------- resolution to concrete notes ----------

export interface Note {
  voice: string;
  start: R;      // bars
  dur: R;        // bars
  semi: number;  // fractional MIDI note number
  vel: number;   // 0..1
  params: Params;
  // what a score writes, when it differs from what sounds: legato and
  // humanize change the performance, not the written note
  written?: { start: R; dur: R };
}

export function valueToSemis(v: any, key: Key): number[] {
  if (v === null || v === undefined || v instanceof Rest || v === false) return [];
  if (v instanceof Pitch) return [v.semi];
  if (v instanceof Degree) return [key.resolve(v)];
  if (v instanceof R) return [v.toNumber()];
  if (typeof v === "number") return [v];
  if (v instanceof Chord) return v.notes.flatMap(n => valueToSemis(n, key));
  if (v === true) return [60];
  if (typeof v === "string") return [60]; // a sample name: see resolveNotes
  if (typeof v === "object" && !(v instanceof Pat) && "note" in v) return valueToSemis(v.note, key);
  return [];
}

export function resolveNotes(voice: string, evs: Ev[], ctx: Ctx): Note[] {
  const out: Note[] = [];
  for (const ev of evs) {
    const key: Key = ev.p.key ?? ctx.key;
    const semis = valueToSemis(ev.v, key);
    if (!semis.length) continue;
    const legato = ev.p.legato !== undefined ? Number(ev.p.legato) : 1;
    const dur = ev.p.dur !== undefined ? R.of(Number(ev.p.dur)) : ev.e.sub(ev.s).mul(R.of(legato));
    let vel = ev.p.vel !== undefined ? Number(ev.p.vel) : 0.8;
    if (typeof ev.v === "object" && ev.v && "vel" in ev.v) vel = Number(ev.v.vel);
    const params = { ...ev.p };
    if (ev.v instanceof Pitch && ev.v.drum && params.inst === undefined) params.inst = "kit";
    // a drum name played through samples keeps its name, so it plays unpitched (and through the kit)
    if (ev.v instanceof Pitch && ev.v.drum && typeof params.inst === "string" && (params.inst.startsWith("sample:") || params.inst === "gm")) params.drum = ev.v.drum;
    // a string in a phrase is a sample name, played as recorded: ["bd_haus" . "sn_dolf" .]
    if (typeof ev.v === "string") { if (params.inst === undefined || params.inst === "sample:") params.inst = `sample:${ev.v}`; params.hit = true; }
    const nudge: R | undefined = params.nudge;
    delete params.key; delete params.vel; delete params.legato; delete params.dur; delete params.nudge;
    const wdur = ev.p.dur !== undefined ? dur : ev.e.sub(ev.s);
    const written = nudge || !wdur.eq(dur) ? { start: nudge ? ev.s.sub(nudge) : ev.s, dur: wdur } : undefined;
    // a chord symbol's root travels with its notes, so exports can name the chord (MusicXML harmony)
    if (ev.v instanceof Chord && ev.v.root !== undefined) { const r = valueToSemis(ev.v.root, key)[0]; if (r !== undefined) params.chordRoot = r; }
    if (params.chordRel !== undefined) { if (semis.length === 1) params.chordRoot = semis[0] + Number(params.chordRel); delete params.chordRel; }
    if (params.chordBassRel !== undefined) { if (semis.length === 1) params.chordBass = semis[0] + Number(params.chordBassRel); delete params.chordBassRel; }
    if (ev.v instanceof Chord && ev.v.bass !== undefined) { const b = valueToSemis(ev.v.bass, key)[0]; if (b !== undefined) params.chordBass = b; }
    for (const semi of semis) out.push({ voice, start: ev.s, dur, semi, vel: Math.max(0, Math.min(1, vel)), params, ...(written ? { written } : {}) });
  }
  return out;
}
