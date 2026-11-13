// The standard library. Each builtin carries a signature and a one-line doc;
// the language server and the tutorial read these, so documentation lives
// next to the code it documents.

import { R, ONE, ZERO } from "./rational";
import { Pitch, Degree, Key, Scale, CHORDS, SCALES, parseNote } from "./pitch";
import * as H from "./harmony";
const parseQuality = H.parseQuality;
import {
  Pat, Chord, Rest, REST, toPat, seq, stack, alt, fast, shift, rev, every, degrade, euclid, mapV, mapEv,
  setParam, signal, segment, sampleAt, perBar, perBarSelect, evolve, filterEv, evRand, withCtx, arrange, silence, Ev, Ctx,
} from "./pattern";
import { rand01, hashStr } from "./rng";
import { Env, Builtin, Closure, Rec, typeName, show, num, isNum, truthy, CallInfo } from "./values";
import { TineError } from "./errors";

type Impl = (args: any[], named: Record<string, any>, call: CallInfo) => any;
const DEFS: Builtin[] = [];
function def(name: string, sig: string, doc: string, category: string, impl: Impl) {
  DEFS.push(new Builtin(name, impl, sig, doc, category));
}
export function builtinList(): Builtin[] { return DEFS; }

const P = (x: any) => toPat(x);
const N = (x: any, d?: number) => (x === undefined ? d! : num(x));
const clamp01 = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
const RR = (x: any) => (x instanceof R ? x : R.of(num(x)));
const need = (args: any[], n: number, sig: string) => { if (args.length < n) throw new TineError("type", `expected at least ${n} argument${n > 1 ? "s" : ""}`, undefined, `usage: ${sig}`); };

function items(x: any): any[] {
  if (Array.isArray(x)) return x;
  if (x instanceof Pat && x.items) return x.items;
  if (x instanceof Chord) return x.notes;
  throw new TypeError(`expected a list like [a b c], got ${typeName(x)}`);
}
const list = (vals: any[]) => toPat(vals);

function fnCall(call: CallInfo, f: any, args: any[]): any { return call.interp.call(f, args, {}, call.span); }
function fnKeyed(call: CallInfo, f: any, args: any[], ctx: Ctx, keys: number[], salt: number) {
  return call.interp.callKeyed(f, args, ctx, keys.reduce((h, k) => (Math.imul(h, 31) + (k | 0)) | 0, 7), salt);
}
const asFn = (call: CallInfo, f: any) => (p: Pat) => P(fnCall(call, f, [p]));

// ---------- chords ----------

const DIATONIC: Record<string, number[]> = { "3": [0, 2, 4], "5": [0, 2, 4], "6": [0, 2, 4, 5], "7": [0, 2, 4, 6], "9": [0, 2, 4, 6, 8], "11": [0, 2, 4, 6, 8, 10], "13": [0, 2, 4, 6, 8, 10, 12] };

export function makeChord(root: any, q: string): Chord {
  // a slash bass: c@7/e, g@m7/c3
  const slash = q.match(/^(.*)\/([A-Ga-g](?:#|b)?\d?)$/);
  if (slash) {
    const c = makeChord(root, slash[1]);
    const given = slash[2];
    let b = parseNote(given);
    if (!/\d$/.test(given)) {
      // no octave given: the nearest such note below the chord
      const lowest = root instanceof Pitch ? root.semi : 60;
      let s = b.semi; while (s >= lowest) s -= 12; while (s + 12 < lowest) s += 12; b = new Pitch(s);
    }
    return new Chord([b, ...c.notes], c.root, b);
  }
  if (root instanceof Degree) {
    // numbers on a degree count diatonic chord tones (^5@7 is "five seven"),
    // except on an altered degree, where they name the quality (^b7@7 is a dominant seventh)
    if (DIATONIC[q] && root.acc === 0) return new Chord(DIATONIC[q].map(k => new Degree(root.deg, root.acc, root.shift + k)), root);
    const offs = parseQuality(q);
    if (!offs) throw new Error(`unknown chord quality '${q}'; try maj7, m7, 7, m7b5, dim7, 7b9, 7alt, maj7#11, 9sus4`);
    return new Chord(offs.map(o => new Degree(root.deg, root.acc + o, root.shift)), root);
  }
  const semi = root instanceof Pitch ? root.semi : isNum(root) ? num(root) : NaN;
  if (isNaN(semi)) throw new Error(`cannot build a chord on ${typeName(root)}`);
  const offs = parseQuality(q);
  if (!offs) throw new Error(`unknown chord quality '${q}'; try maj7, m7, 7, m7b5, dim7, 7b9, 7alt, maj7#11, 9sus4`);
  return new Chord(offs.map(o => new Pitch(semi + o)), new Pitch(semi));
}

function semisOf(v: any, key: Key): number[] {
  if (v instanceof Pitch) return [v.semi];
  if (v instanceof Degree) return [key.resolve(v)];
  if (isNum(v)) return [num(v)];
  if (v instanceof Chord) return v.notes.flatMap(n => semisOf(n, key));
  return [];
}

// ---------- registration ----------

export function registerBuiltins(env: Env) {
  for (const b of DEFS) env.set(b.name, b);
}

const cat = { time: "time", rand: "chance", pitch: "pitch", param: "sound", list: "lists", math: "math", gen: "generators", io: "input", misc: "misc" };

// ===== time =====
def("fast", "fast(p, n)", "Play p n times faster (n times per bar).", cat.time, ([p, n]) => fast(RR(n), P(p)));
def("slow", "slow(p, n)", "Stretch p over n bars.", cat.time, ([p, n]) => fast(ONE.div(RR(n)), P(p)));
def("late", "late(p, t)", "Delay p by t bars: in 4/4, 1/8 is an eighth note.", cat.time, ([p, t]) => shift(RR(t), P(p)));
def("early", "early(p, t)", "Shift p earlier by t bars.", cat.time, ([p, t]) => shift(RR(t).neg(), P(p)));
def("rev", "rev(p)", "Reverse p within each bar. On a list, reverses the list.", cat.time, ([p]) => {
  const q = P(p); const r = rev(q); if (q.items) r.items = [...q.items].reverse(); return r;
});
def("every", "every(p, n, f, at: n-1)", "Apply f on one bar out of every n (the last one by default, where fills belong).", cat.time, ([p, n, f], named, call) => {
  const k = Math.round(N(n)); const at = named.at !== undefined ? Math.round(N(named.at)) : k - 1;
  return every(k, asFn(call, f)(P(p)), P(p), at);
});
def("palindrome", "palindrome(p)", "Play p forwards, then backwards, alternating bars.", cat.time, ([p]) => alt([P(p), rev(P(p))]));
def("iter", "iter(p, n)", "Rotate the start of p by 1/n each bar.", cat.time, ([p, n]) => {
  const k = Math.round(N(n)); const q = P(p);
  return perBarSelect(c => shift(new R(-(((c % k) + k) % k), k), q));
});
def("off", "off(p, t, f)", "Layer p with a copy shifted by t bars and transformed by f.", cat.time, ([p, t, f], _n, call) => {
  const q = P(p); return stack([q, shift(RR(t), f ? asFn(call, f)(q) : q)]);
});
def("echo", "echo(p, times: 3, time: 1/8, decay: 0.6)", "Repeat each event, quieter each time.", cat.time, ([p, times, time, decay], named) => {
  const k = Math.round(N(named.times ?? times, 3)), dt = RR(named.time ?? time ?? new R(1, 8)), dc = N(named.decay ?? decay, 0.6);
  const q = P(p); const layers = [q];
  for (let i = 1; i <= k; i++) layers.push(mapEv(shift(dt.mul(new R(i)), q), ev => ({ ...ev, p: { ...ev.p, vel: (ev.p.vel ?? 0.8) * Math.pow(dc, i), echo: i } })));
  return stack(layers);
});
def("ply", "ply(p, n)", "Repeat each event n times within its own length. n may be a pattern.", cat.time, ([p, n]) => {
  const q = P(p);
  return new Pat((a, b, ctx) => {
    const out: Ev[] = [];
    // events that could start a repeat in [a,b) started at most 1 bar before
    for (const ev of q.query(new R(a.floor() - 1), b.add(ONE), ctx)) {
      const k = Math.max(1, Math.round(N(sampleAt(n, ev.s, ctx))));
      const step = ev.e.sub(ev.s).div(new R(k));
      for (let i = 0; i < k; i++) { const s = ev.s.add(step.mul(new R(i))); if (s.ge(a) && s.lt(b)) out.push({ s, e: s.add(step), v: ev.v, p: ev.p }); }
    }
    return out;
  });
});
def("swing", "swing(p, amount: 1/3, div: 8)", "Delay every second subdivision (eighths by default) by a fraction of a step. 1/3 gives triplet swing (long-short 2:1), 0.2 a lighter 3:2, 0 is straight.", cat.time, ([p, amount, div], named) => {
  const amt = N(named.amount ?? amount, 1 / 3), d = Math.round(N(named.div ?? div, 8));
  const grid = new R(1, d), q = P(p);
  return new Pat((a, b, ctx) => q.query(a.sub(grid), b, ctx).flatMap(ev => {
    const pos = ev.s.cyclePos().div(grid);
    let s = ev.s, e = ev.e;
    if (pos.isInt() && pos.n % 2 === 1) { const dt = grid.mul(R.of(amt)); s = s.add(dt); e = e.add(dt); }
    return s.ge(a) && s.lt(b) ? [{ ...ev, s, e }] : [];
  }));
});
def("humanize", "humanize(p, time: 0.004, vel: 0.1)", "Seeded random drift in timing (bars) and velocity. Replayable like all randomness.", cat.rand, ([p, time, vel], named, call) => {
  const dt = N(named.time ?? time, 0.004), dv = N(named.vel ?? vel, 0.1), salt = call.interp.salt(), q = P(p);
  return new Pat((a, b, ctx) => q.query(a, b, ctx).map(ev => {
    const j = R.approx((evRand(ctx, salt, ev.s, 1) * 2 - 1) * dt, 100000);
    return { ...ev, s: ev.s.add(j), e: ev.e.add(j), p: { ...ev.p, nudge: ev.p.nudge ? ev.p.nudge.add(j) : j, vel: Math.max(0, Math.min(1, (ev.p.vel ?? 0.8) + (evRand(ctx, salt, ev.s, 2) * 2 - 1) * dv)) } };
  }));
});
def("stack", "stack(a, b, ...)", "Play patterns at the same time.", cat.time, (args) => stack(args.map(P)));
def("cat", "cat(a, b, ...)", "One pattern per bar, in turn.", cat.time, (args) => alt(args.map(P)));
def("seq", "seq(a, b, ...)", "Squeeze patterns one after another into a single bar.", cat.time, (args) => seq(args.map(a => ({ pat: P(a), w: ONE })), args));
def("arrange", "arrange(p1, bars1, p2, bars2, ...)", "Chain patterns, each lasting the given number of bars, and loop the whole.", cat.time, (args) => {
  const parts: { pat: Pat; bars: number }[] = [];
  for (let i = 0; i + 1 < args.length; i += 2) parts.push({ pat: P(args[i]), bars: Math.round(N(args[i + 1])) });
  return arrange(parts);
});
def("poly", "poly(p, steps)", "Polymeter: step through p's elements at `steps` per bar, whatever its length.", cat.time, ([p, steps]) => {
  const q = P(p); const n = q.items?.length ?? 1; return fast(RR(steps).div(new R(n)), q);
});
def("euclid", "euclid(p, hits, steps, rot: 0)", "Spread `hits` events as evenly as possible over `steps` (Euclidean rhythm).", cat.time, ([p, k, n, rot], named) =>
  euclid(P(p), Math.round(N(k)), Math.round(N(n)), Math.round(N(named.rot ?? rot, 0))));
def("trunc", "trunc(p, fraction)", "Play only the first fraction of each bar.", cat.time, ([p, f]) => {
  const fr = RR(f); return filterEv(P(p), ev => ev.s.cyclePos().lt(fr));
});
def("per_bar", "per_bar(bar => pattern)", "Build each bar from a function of the bar number. Randomness inside is keyed to the bar.", cat.time, ([f], _n, call) => {
  const salt = call.interp.salt();
  return perBar((c, ctx) => P(call.interp.callKeyed(f, [new R(c)], ctx, c, salt)));
});
def("evolve", "evolve(start, (state, bar) => next, (state, bar) => pattern)", "Carry state from bar to bar. Bar 0 plays view(start); each later bar's state is step(previous state, bar). Replayable: states are always computed forward from bar 0.", cat.time, ([init, step, view], _n, call) => {
  const s1 = call.interp.salt(), s2 = call.interp.salt();
  return evolve(init,
    (st, bar, ctx) => call.interp.callKeyed(step, [st, new R(bar)], ctx, bar, s1),
    (st, bar, ctx) => P(view === undefined ? st : call.interp.callKeyed(view, [st, new R(bar)], ctx, bar, s2)));
});
def("loop", "loop(p, bars)", "Repeat the first `bars` bars of p forever.", cat.time, ([p, b]) => {
  const n = Math.max(1, Math.round(N(b))), q = P(p);
  return new Pat((a, bb, ctx) => {
    const out: Ev[] = [];
    for (let c = a.floor(); c < bb.toNumber(); c++) {
      const off = new R(c - (((c % n) + n) % n));
      const lo = R.max(a, new R(c)), hi = R.min(bb, new R(c + 1));
      for (const ev of q.query(lo.sub(off), hi.sub(off), ctx)) out.push({ ...ev, s: ev.s.add(off), e: ev.e.add(off) });
    }
    return out;
  });
});

// ===== chance =====
def("degrade", "degrade(p, amount: 0.5)", "Randomly drop events (seeded).", cat.rand, ([p, amt], named, call) => degrade(named.amount ?? amt ?? 0.5, call.interp.salt(), P(p)));
function sometimesBy(prob: any, p: Pat, f: (p: Pat) => Pat, salt: number): Pat {
  const fp = f(p);
  const keep = filterEv(p, (ev, ctx) => evRand(ctx, salt, ev.s) >= N(sampleAt(prob, ev.s, ctx)));
  const take = filterEv(fp, (ev, ctx) => evRand(ctx, salt, ev.s) < N(sampleAt(prob, ev.s, ctx)));
  return stack([keep, take]);
}
def("sometimes", "sometimes(p, prob, f)", "Apply f to each event with the given probability (seeded).", cat.rand, ([p, prob, f], _n, call) => {
  if (f === undefined) { f = prob; prob = 0.5; }
  return sometimesBy(prob, P(p), asFn(call, f), call.interp.salt());
});
def("often", "often(p, f)", "Apply f to about 75% of events.", cat.rand, ([p, f], _n, call) => sometimesBy(0.75, P(p), asFn(call, f), call.interp.salt()));
def("rarely", "rarely(p, f)", "Apply f to about 25% of events.", cat.rand, ([p, f], _n, call) => sometimesBy(0.25, P(p), asFn(call, f), call.interp.salt()));
def("maybe", "maybe(p, prob, f)", "Apply f to whole bars with the given probability (seeded).", cat.rand, ([p, prob, f], _n, call) => {
  const q = P(p), fq = asFn(call, f)(q), salt = call.interp.salt();
  return perBarSelect((c, ctx) => (rand01(ctx.seed, ctx.voice, salt, c + ctx.offset.toNumber()) < N(prob) ? fq : q));
});
def("dice", "dice(list, steps: 1)", "A new seeded random pick from list on each of `steps` steps per bar.", cat.rand, ([l, n], named, call) => {
  const xs = items(l), k = Math.round(N(named.steps ?? n, 1)), salt = call.interp.salt();
  const step = new R(1, k);
  return new Pat((a, b, ctx) => {
    const out: Ev[] = [];
    for (let i = a.div(step).ceil(); ; i++) {
      const s = step.mul(new R(i)); if (!s.lt(b)) break;
      const v = xs[Math.floor(evRand(ctx, salt, s) * xs.length)];
      for (const ev of P(v).query(new R(0), ONE, ctx)) out.push({ s: s.add(ev.s.mul(step)), e: s.add(ev.e.mul(step)), v: ev.v, p: ev.p });
    }
    return out;
  });
});
def("walk", "walk(list, steps: 8, stride: 1)", "A seeded random walk through list: each step moves at most `stride` places.", cat.rand, ([l, n, m], named, call) => {
  const xs = items(l), k = Math.round(N(named.steps ?? n, 8)), mx = Math.round(N(named.stride ?? m, 1)), salt = call.interp.salt();
  return perBar((c, ctx) => {
    let i = Math.floor(rand01(ctx.seed, ctx.voice, salt, c + ctx.offset.toNumber()) * xs.length);
    const vals: any[] = [];
    for (let s = 0; s < k; s++) {
      vals.push(xs[i]);
      const r = Math.floor(rand01(ctx.seed, ctx.voice, salt, c + ctx.offset.toNumber(), s + 1) * (2 * mx + 1)) - mx;
      i = Math.max(0, Math.min(xs.length - 1, i + r));
    }
    return list(vals);
  });
});
def("scramble", "scramble(p)", "Shuffle the elements of a phrase into a new seeded order each bar.", cat.rand, ([p], _n, call) => {
  const xs = items(p), salt = call.interp.salt();
  return perBar((c, ctx) => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand01(ctx.seed, ctx.voice, salt, c + ctx.offset.toNumber(), i) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return list(a);
  });
});
def("rand", "rand()", "A seeded random number in [0, 1). Same seed, same number.", cat.rand, (_a, _n, call) => call.interp.stream.next());
def("rand_int", "rand_int(lo, hi)", "A seeded random whole number from lo to hi inclusive.", cat.rand, ([lo, hi], _n, call) => {
  const a = Math.round(N(lo)), b = Math.round(N(hi)); return new R(a + Math.floor(call.interp.stream.next() * (b - a + 1)));
});
def("pick", "pick(list)", "One seeded random element of list.", cat.rand, ([l], _n, call) => { const xs = items(l); return xs[Math.floor(call.interp.stream.next() * xs.length)]; });
def("weighted", "weighted(list, weights)", "A seeded random element, chosen in proportion to weights.", cat.rand, ([l, w], _n, call) => {
  const xs = items(l), ws = items(w).map(x => N(x)); const tot = ws.reduce((s, x) => s + x, 0);
  let r = call.interp.stream.next() * tot;
  for (let i = 0; i < xs.length; i++) { r -= ws[i] ?? 0; if (r < 0) return xs[i]; }
  return xs[xs.length - 1];
});
def("shuffle", "shuffle(list)", "The list in a seeded random order (decided once).", cat.rand, ([l], _n, call) => {
  const a = [...items(l)];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(call.interp.stream.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return list(a);
});
def("chance", "chance(prob)", "true with the given probability (seeded).", cat.rand, ([p], _n, call) => call.interp.stream.next() < N(p, 0.5));

// ===== pitch =====
function mapPitch(v: any, f: (x: any) => any): any {
  if (v instanceof Chord) return v.map(f);
  if (v instanceof Rest || v === null || v === undefined) return v;
  return f(v);
}
function transposeVal(x: any, st: number): any {
  if (x instanceof Pitch) return x.drum ? x : new Pitch(x.semi + st);
  if (x instanceof Degree) return new Degree(x.deg, x.acc + st, x.shift);
  if (isNum(x)) return isNum(st) && x instanceof R && Number.isInteger(st) ? x.add(new R(st)) : num(x) + st;
  if (x instanceof Rec && "note" in x.fields) return new Rec({ ...x.fields, note: transposeVal(x.fields.note, st) });
  return x;
}
function pitchMapPat(p: any, valueArg: any, f: (x: any, k: number, ctx: Ctx, ev: Ev) => any): any {
  if (!(p instanceof Pat) && !(valueArg instanceof Pat)) return mapPitch(p, x => f(x, N(valueArg), null as any, null as any));
  const q = P(p);
  const np = mapEv(q, (ev, ctx) => ({ ...ev, v: mapPitch(ev.v, x => f(x, N(sampleAt(valueArg, ev.s, ctx)), ctx, ev)) }));
  if (q.items && !(valueArg instanceof Pat)) np.items = q.items.map(v => (v instanceof Pat ? pitchMapPat(v, valueArg, f) : mapPitch(v, x => f(x, N(valueArg), { key: SCALES && new Key(new Pitch(60), SCALES.major) } as any, null as any))));
  return np;
}
def("transpose", "transpose(p, semitones)", "Move by semitones (fractions allowed: 0.5 is a quarter tone). Works on notes, degrees, chords and patterns.", cat.pitch, ([p, st]) => pitchMapPat(p, st, (x, k) => transposeVal(x, k)));
def("octave", "octave(p, n)", "Move by n octaves (of the scale's period for degrees).", cat.pitch, ([p, n]) => pitchMapPat(p, n, (x, k) => (x instanceof Degree ? new Degree(x.deg, x.acc + 12 * k, x.shift) : transposeVal(x, 12 * k))));
def("step", "step(p, n)", "Move by n steps of the current scale (diatonic transposition).", cat.pitch, ([p, n]) => pitchMapPat(p, n, (x, k, ctx, ev) => {
  if (x instanceof Degree) return new Degree(x.deg, x.acc, x.shift + Math.round(k));
  if (x instanceof Pitch && !x.drum) {
    const key: Key = ev?.p?.key ?? ctx?.key; if (!key) return x;
    const idx = key.scale.indexOf(x.semi - key.root.semi);
    return new Pitch(key.root.semi + key.scale.semitoneOf(idx + Math.round(k)));
  }
  return x;
}));
def("degrees", "degrees(p)", "Treat numbers as 0-based scale steps: [0 2 4].degrees is [^1 ^3 ^5].", cat.pitch, ([p]) => pitchMapPat(p, 0, x => (isNum(x) ? new Degree(1, 0, Math.round(num(x))) : x)));
def("key", "key(root, scale) or p.key(root, scale)", "Make a key, or play p in a key. Degrees like ^3 resolve against it.", cat.pitch, (args) => {
  if (args[0] instanceof Pat || args[0] instanceof Degree || args[0] instanceof Chord) {
    const k = args[1] instanceof Key ? args[1] : new Key(args[1], args[2] ?? SCALES.major);
    // the key travels on each event (an inner .key wins), since degrees resolve when notes are played
    const q = withCtx(P(args[0]), ctx => ({ ...ctx, key: k }));
    const np = mapEv(q, ev => (ev.p.key ? ev : { ...ev, p: { ...ev.p, key: k } }));
    np.items = q.items;
    return np;
  }
  if (!(args[0] instanceof Pitch)) throw new TypeError("key needs a root note, like key(d, dorian)");
  return new Key(args[0], args[1] ?? SCALES.major);
});
def("chord", "chord(root, quality)", "A chord: chord(c4, \"maj7\") is the same as c4@maj7. With one text argument it reads a chord symbol: chord(\"Bb7#11\").", cat.pitch, ([r, q]) => {
  if (typeof r === "string" && q === undefined) { const c = H.parseSymbol(r); return c ?? REST; }
  return makeChord(r, String(q instanceof Pitch ? q.toString() : q));
});
def("invert", "invert(p, n: 1)", "Chord inversion: move the lowest n notes up an octave.", cat.pitch, ([p, n]) => {
  const k = Math.round(N(n, 1));
  const inv = (c: any, key: Key) => {
    if (!(c instanceof Chord)) return c;
    let s = semisOf(c, key).sort((a, b) => a - b);
    for (let i = 0; i < k; i++) { const lo = s.shift()!; s.push(lo + 12); }
    for (let i = 0; i > k; i--) { const hi = s.pop()!; s.unshift(hi - 12); }
    return new Chord(s.map(x => new Pitch(x)));
  };
  if (p instanceof Chord) return inv(p, new Key(new Pitch(60), SCALES.major));
  return mapEv(P(p), (ev, ctx) => ({ ...ev, v: inv(ev.v, ev.p.key ?? ctx.key) }));
});
// A note split out of a chord symbol (arp, strum) keeps where its root and
// bass sit, as intervals from the note, so scores can still name the chord
// after the notes are transposed.
function chordRel(c: Chord, nt: any, key: any, p: Record<string, any>): Record<string, any> {
  if (c.root === undefined) return p;
  const at = semisOf(nt, key)[0], r = semisOf(c.root, key)[0];
  if (at === undefined || r === undefined) return p;
  const out: Record<string, any> = { ...p, chordRel: r - at };
  if (c.bass !== undefined) { const b = semisOf(c.bass, key)[0]; if (b !== undefined) out.chordBassRel = b - at; }
  return out;
}
def("arp", "arp(p, mode: \"up\")", "Spread each chord's notes across its length. Modes: up, down, updown, downup, out, random.", cat.pitch, ([p, mode], named, call) => {
  const m = String(named.mode ?? mode ?? "up"), salt = call.interp.salt(), q = P(p);
  return new Pat((a, b, ctx) => {
    const out: Ev[] = [];
    for (const ev of q.query(new R(a.floor()), new R(b.ceil()), ctx)) {
      if (!(ev.v instanceof Chord)) { if (ev.s.ge(a) && ev.s.lt(b)) out.push(ev); continue; }
      const key = ev.p.key ?? ctx.key;
      let notes = [...ev.v.notes].sort((x, y) => semisOf(x, key)[0] - semisOf(y, key)[0]);
      if (m === "down") notes.reverse();
      else if (m === "updown") notes = [...notes, ...notes.slice(1, -1).reverse()];
      else if (m === "downup") { const d = [...notes].reverse(); notes = [...d, ...d.slice(1, -1).reverse()]; }
      else if (m === "out") { const o: any[] = []; let i = 0, j = notes.length - 1; while (i <= j) { o.push(notes[i++]); if (i <= j) o.push(notes[j--]); } notes = o; }
      else if (m === "random") { notes = notes.map((x, i) => [x, evRand(ctx, salt, ev.s, i)] as const).sort((x, y) => x[1] - y[1]).map(x => x[0]); }
      if (!notes.length) continue;
      const step = ev.e.sub(ev.s).div(new R(notes.length));
      notes.forEach((nt, i) => { const s = ev.s.add(step.mul(new R(i))); if (s.ge(a) && s.lt(b)) out.push({ s, e: s.add(step), v: nt, p: chordRel(ev.v, nt, key, ev.p) }); });
    }
    return out;
  });
});
def("strum", "strum(p, spread: 1/48)", "Roll each chord's notes, low to high, `spread` bars apart.", cat.pitch, ([p, sp], named) => {
  const d = RR(named.spread ?? sp ?? new R(1, 48)), q = P(p);
  return new Pat((a, b, ctx) => q.query(a.sub(ONE), b, ctx).flatMap(ev => {
    if (!(ev.v instanceof Chord)) return ev.s.ge(a) && ev.s.lt(b) ? [ev] : [];
    const key = ev.p.key ?? ctx.key;
    const notes = [...ev.v.notes].sort((x, y) => semisOf(x, key)[0] - semisOf(y, key)[0]);
    return notes.map((nt, i) => { const s = ev.s.add(d.mul(new R(i))); const p = chordRel(ev.v, nt, key, ev.p); return { s, e: ev.e, v: nt, p: i ? { ...p, strum: d.mul(new R(i)) } : p }; }).filter(e => e.s.ge(a) && e.s.lt(b));
  }));
});
def("hz", "hz(pitch)", "Frequency of a pitch in Hz (at the current tuning).", cat.pitch, ([p], _n, call) => (p instanceof Pitch ? p : new Pitch(N(p))).freq(call.interp.scene.tuningRef));
def("note_num", "note_num(pitch)", "The (possibly fractional) MIDI note number of a pitch.", cat.pitch, ([p]) => (p instanceof Pitch ? p.semi : N(p)));
def("pitch", "pitch(n)", "A pitch from a MIDI note number (fractions allowed).", cat.pitch, ([n]) => new Pitch(N(n)));
def("ratio", "ratio(r)", "The size of a frequency ratio in semitones: ratio(3/2) is about 7.02.", cat.pitch, ([r]) => 12 * Math.log2(N(r)));
def("scale", "scale(semitones, period: 12)", "A scale from semitone offsets (fractions allowed).", cat.pitch, ([l, period], named) => new Scale("custom", items(l).map(x => N(x)), N(named.period ?? period, 12)));
def("just", "just(ratios, period: 2)", "A just-intonation scale from frequency ratios, e.g. just([1 9/8 5/4 3/2 5/3]).", cat.pitch, ([l, period], named) =>
  new Scale("just", items(l).map(x => 12 * Math.log2(N(x))), 12 * Math.log2(N(named.period ?? period, 2))));
def("edo", "edo(n, steps)", "An n-tone equal division of the octave. With steps, a scale picked from it: edo(31, [0 5 10 13 18 23 28]).", cat.pitch, ([n, l]) => {
  const k = N(n); const st = l === undefined ? Array.from({ length: k }, (_, i) => i) : items(l).map(x => N(x));
  return new Scale(`${k}edo`, st.map(s => (s * 12) / k));
});
def("cents", "cents(list, period: 1200)", "A scale from offsets in cents.", cat.pitch, ([l, period], named) => new Scale("cents", items(l).map(x => N(x) / 100), N(named.period ?? period, 1200) / 100));
def("scala", "scala(text)", "A scale from the text of a Scala .scl file (the common microtonal tuning format).", cat.pitch, ([t]) => parseScala(String(t)));
def("scala_file", "scala_file(path)", "A scale loaded from a Scala .scl file next to your piece.", cat.pitch, ([p], _n, call) => {
  const rf = call.interp.opts.readFile;
  if (!rf) throw new Error("files cannot be read here; paste the file's text into scala(\"...\") instead");
  return parseScala(rf(String(p)));
});
def("mode", "mode(scale, n)", "Rotate a scale to start on its n-th degree (1-based): mode(major, 2) is dorian.", cat.pitch, ([s, n]) => {
  if (!(s instanceof Scale)) throw new TypeError("mode needs a scale");
  const k = Math.round(N(n)) - 1, L = s.steps.length;
  const base = s.semitoneOf(k);
  return new Scale(`${s.name}/${k + 1}`, Array.from({ length: L }, (_, i) => s.semitoneOf(k + i) - base), s.period);
});

export function parseScala(text: string): Scale {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => !l.startsWith("!"));
  const name = lines[0] || "scala";
  const count = parseInt(lines[1], 10);
  const vals: number[] = [];
  for (const l of lines.slice(2)) {
    if (!l) continue;
    const tok = l.split(/\s+/)[0];
    if (tok.includes(".")) vals.push(parseFloat(tok) / 100);
    else if (tok.includes("/")) { const [a, b] = tok.split("/").map(Number); vals.push(12 * Math.log2(a / b)); }
    else vals.push(12 * Math.log2(Number(tok)));
    if (vals.length >= count) break;
  }
  const period = vals.pop() ?? 12;
  return new Scale(name.slice(0, 40), [0, ...vals], period);
}

// ===== sound parameters =====
const param = (name: string, sig: string, doc: string) =>
  def(name, sig, doc, cat.param, ([p, v]) => setParam(P(p), name, v));
param("vel", "vel(p, v)", "Velocity 0 to 1. v may itself be a pattern: .vel([1 .5 .7 .5]).");
param("legato", "legato(p, x)", "Note length as a fraction of its step (1 = full, 0.5 = staccato).");
param("gain", "gain(p, x)", "Output level multiplier for the built-in synth.");
param("pan", "pan(p, x)", "Stereo position from -1 (left) to 1 (right).");
param("cutoff", "cutoff(p, hz)", "Filter cutoff for the built-in synth.");
param("res", "res(p, x)", "Filter resonance 0 to 1.");
param("attack", "attack(p, seconds)", "Envelope attack time.");
param("release", "release(p, seconds)", "Envelope release time.");
param("decay", "decay(p, seconds)", "Envelope decay time.");
param("sustain", "sustain(p, level)", "Envelope sustain level 0 to 1.");
param("reverb", "reverb(p, amount)", "Send to the built-in reverb, 0 to 1.");
// ===== effects (per voice, on the voice's bus; see core/fx.ts) =====
param("hpf", "hpf(p, hz)", "High-pass filter on the whole voice: removes rumble below hz. Unlike cutoff, which shapes each note, this filters the voice's mix.");
param("lpf", "lpf(p, hz)", "Low-pass filter on the whole voice: darkens everything above hz. Try .lpf(sine(8).range(400, 3400)) for a sweep.");
param("drive", "drive(p, amount)", "Saturation on the whole voice, 0 (clean) to 1 (crushed). Chords distort together, like an amp.");
def("delay", "delay(p, mix, time: 3/16, feedback: .4)", "An echo on the whole voice. mix 0 to 1; time in bars (3/16 is a dotted eighth in 4/4); feedback 0 to .95 sets how many repeats.", cat.param, ([p, mix, time, fb], named) => {
  let q = setParam(P(p), "delay", named.mix ?? mix ?? 0.3);
  q = setParam(q, "delayTime", named.time ?? time ?? 3 / 16);
  return setParam(q, "feedback", named.feedback ?? fb ?? 0.4);
});
const fxdef = (name: string, sig: string, doc: string, keys: [string, string, any][]) =>
  def(name, sig, doc, cat.param, ([p, ...pos], named) => {
    let q = P(p);
    keys.forEach(([arg, key, d], i) => { const v = named[arg] ?? pos[i] ?? d; if (v !== undefined) q = setParam(q, key, v); });
    return q;
  });
param("wave", "wave(p, name)", "Oscillator of the synth instrument (and its presets): saw, square, pulse, tri, sine, super, fm or noise.");
param("pw", "pw(p, width)", "Pulse width of the pulse wave, 0 to 1 (.5 is square). May be a pattern or a signal.");
param("detune", "detune(p, cents)", "Spread of the unison voices, in cents either side.");
param("unison", "unison(p, n)", "How many detuned oscillators sound together (1 to 16).");
param("sub", "sub(p, level)", "A sine one octave below, 0 to 1.");
param("glide", "glide(p, seconds)", "Slide into each note from the one before it in the voice. On a note slurred into (c4~ d4), the slide joins the two into one sound.");
// Marks every note of p but the last in each bar, so a phrase is slurred
// (or glissed) through and ends on its last note, as a slur in a score does.
const throughPhrase = (p: Pat, name: string, value: any) => {
  const q = setParam(p, name, value);
  return new Pat((a, b, ctx) => {
    const evs = q.query(a, b, ctx);
    const last = new Map<number, R>();
    for (let c = a.floor(); c < b.toNumber(); c++) {
      let m: R | undefined;
      for (const ev of q.query(new R(c), new R(c + 1), ctx)) if (!m || ev.s.gt(m)) m = ev.s;
      if (m) last.set(c, m);
    }
    return evs.map(ev => { const m = last.get(ev.s.floor()); return m && ev.s.eq(m) ? { ...ev, p: { ...ev.p, [name]: name === "slur" ? false : 0 } } : ev; });
  });
};
def("slur", "slur(p)", "Play p's notes as one connected sound, without a new attack on each, up to the last note in each bar. Scores draw a slur. For one pair, write c4~ d4 in the phrase.", cat.param, ([p]) => throughPhrase(P(p), "slur", true));
def("gliss", "gliss(p, amount: 1)", "Glissando: each note slides to the next across the last `amount` of its length (1 = all of it), up to the last note in each bar. amount may be a pattern: .gliss([1 0]).", cat.param, ([p, x], named) => throughPhrase(P(p), "gliss", named.amount ?? x ?? 1));
fxdef("fenv", "fenv(p, octaves, attack: .001, decay: .2)", "Filter envelope: the cutoff jumps up by this many octaves and falls back over decay seconds. The acid squelch.", [["octaves", "fenv", 2], ["attack", "fattack", undefined], ["decay", "fdecay", undefined]]);
fxdef("fm", "fm(p, index, ratio: 2, decay: .4)", "Frequency modulation (switches the synth to the fm wave): index is brightness, ratio the modulator's pitch, decay how fast the brightness fades.", [["index", "fm", 3], ["ratio", "fmRatio", undefined], ["decay", "fmDecay", undefined]]);
fxdef("vibrato", "vibrato(p, rate: 5, depth: .3)", "Pitch wobble, rate in Hz, depth in semitones.", [["rate", "vibrato", 5], ["depth", "vibratoDepth", undefined]]);
fxdef("wobble", "wobble(p, rate: 2, depth: 2)", "Filter wobble in time with the music: rate in cycles per bar, depth in octaves.", [["rate", "wobble", 2], ["depth", "wobbleDepth", undefined]]);
param("vowel", "vowel(p, v)", "Formant filter: makes the voice say a vowel, \"a\" \"e\" \"i\" \"o\" or \"u\". v may be a pattern: .vowel([\"a\" \"o\"]).");
param("crush", "crush(p, bits)", "Bit crusher: fewer bits (1 to 16) is rougher. .crush(4) is very lo-fi.");
param("coarse", "coarse(p, n)", "Sample-rate reduction: holds every nth sample, for aliasing and grit. 1 is off.");
fxdef("ring", "ring(p, hz, mix: 1)", "Ring modulation: multiplies the voice by a sine at hz, for metallic and bell-like tones.", [["hz", "ring", 440], ["mix", "ringMix", 1]]);
fxdef("chorus", "chorus(p, mix: .5, rate: .8, depth: .5)", "Chorus: thickens the voice with slightly detuned, moving copies. rate in Hz.", [["mix", "chorus", 0.5], ["rate", "chorusHz", undefined], ["depth", "chorusDepth", undefined]]);
fxdef("phaser", "phaser(p, mix: .5, rate: .5, depth: .7)", "Phaser: a sweeping notch, the classic swirl. rate in Hz.", [["mix", "phaser", 0.5], ["rate", "phaserHz", undefined], ["depth", "phaserDepth", undefined]]);
fxdef("compress", "compress(p, threshold: -18, ratio: 4)", "Compressor on the whole voice: levels above threshold (dB) are reduced by ratio, then made up. Evens out a part.", [["threshold", "comp", -18], ["ratio", "compRatio", undefined]]);
fxdef("room", "room(p, mix: .3, size: .5)", "A reverb on this voice alone, unlike reverb(), which sends to the shared room. size 0 to 1.", [["mix", "room", 0.3], ["size", "roomSize", undefined]]);
def("duck", "duck(p, voice, depth: .8, release: 1/8)", "Sidechain-style ducking: this voice dips each time the named voice plays a note, then recovers over release bars. .duck(\"kick\") pumps a pad against the kick.", cat.param, ([p, v, depth, rel], named) => {
  const nm = v instanceof Pitch && v.drum ? v.drum : String(named.voice ?? v ?? "");
  let q = setParam(P(p), "duck", nm);
  const d = named.depth ?? depth, r = named.release ?? rel;
  if (d !== undefined) q = setParam(q, "duckDepth", d);
  return setParam(q, "duckRelease", r ?? new R(1, 8));
});
def("dur", "dur(p, beats)", "Fixed note length in beats, independent of the step length.", cat.param, ([p, v]) => setParam(P(p), "durBeats", v));
def("set", "set(p, name, value)", "Attach any named parameter to events (it is passed through to MIDI CC maps and exports).", cat.param, ([p, n, v]) => setParam(P(p), String(n), v));
def("inst", "inst(p, name, ...options)", "Choose a built-in instrument: keys, sine, tri, saw, square, pluck, bass, pad, bell, organ, kit, or a loaded sample name.", cat.param, ([p, name], named) => {
  // instrument names that are also functions (sine, saw, square, tri, noise, fm) arrive as the function
  const nm = name instanceof Pitch && name.drum ? name.drum : name instanceof Builtin ? name.name : String(name);
  let q = setParam(P(p), "inst", nm);
  for (const [k, v] of Object.entries(named)) q = setParam(q, k, v);
  return q;
});
def("sample", "sample(p, name, n: 0, fit: false)", "Play a sound from the sample library: a full name (\"bd_haus\"), a bank (\"bd\", with n choosing among its sounds), or \"bank:n\". On a drum phrase with no name it plays the bundled kit. name and n may be patterns. With fit: true the sound is stretched to the note's length.", cat.param, ([p, name, fit], named) => {
  const nm = name ?? named.name ?? "", n = named.n;
  let q = mapEv(P(p), (ev, ctx) => {
    const v = sampleAt(nm, ev.s, ctx);
    const out = { ...ev.p, inst: `sample:${v instanceof Pitch && v.drum ? v.drum : v instanceof Builtin ? v.name : v === undefined ? "" : String(v)}` };
    if (n !== undefined) out.sampleN = N(sampleAt(n, ev.s, ctx), 0);
    return { ...ev, p: out };
  });
  if (truthy(named.fit ?? fit ?? false)) q = setParam(q, "fit", true);
  return q;
});
param("begin", "begin(p, x)", "Start playing a sample from this point, 0 (its start) to 1 (its end).");
param("end", "end(p, x)", "Stop playing a sample at this point, 0 to 1.");
param("speed", "speed(p, x)", "Sample playback rate: 2 is an octave up and twice as fast, -1 plays it backwards.");
param("accel", "accel(p, x)", "Change a sample's speed by x every second while it plays: speed(1).accel(-1) is a tape stop.");
param("cut", "cut(p, group)", "Cut group: a sample in this group stops the one before it, in any voice. Choke an open hat with a closed one.");
def("loopAt", "loopAt(p, bars)", "Make a sample last this many bars, whatever the tempo: the phrase is slowed to that length and the sample stretched to fit. Add chop to keep a long loop in time: [\"loop_amen\"].loopAt(2).chop(16).", cat.param, ([p, n]) => setParam(fast(ONE.div(RR(n)), P(p)), "loopAt", n));
const sliceOf = (p: any, n: any, i: any, fit: boolean) => mapEv(P(p), (ev, ctx) => {
  const k = Math.max(1, Math.round(N(sampleAt(n, ev.s, ctx), 1)));
  const j = ((Math.floor(N(sampleAt(i, ev.s, ctx), 0)) % k) + k) % k;
  const out: Record<string, any> = { ...ev.p, begin: j / k, end: (j + 1) / k };
  if (fit) out.fit = true;
  return { ...ev, p: out };
});
def("slice", "slice(p, n, i)", "Cut the sample into n equal pieces and play piece i (from 0). i may be a pattern: .slice(8, [0 3 2 7]).", cat.param, ([p, n, i]) => sliceOf(p, n, i, false));
def("splice", "splice(p, n, i)", "Like slice, but each piece is stretched to fill its note, so a sliced loop stays in tempo.", cat.param, ([p, n, i]) => sliceOf(p, n, i, true));
def("chop", "chop(p, n)", "Split each note into n notes that play successive parts of its sample. With loopAt, a loop follows the tempo: loop_amen.loopAt(2).chop(16).", cat.param, ([p, n]) => {
  const q = P(p);
  return new Pat((a, b, ctx) => {
    const out: Ev[] = [];
    // a looped sample can last several bars, so look further back than ply does
    for (const ev of q.query(new R(a.floor() - 8), b.add(ONE), ctx)) {
      if (ev.e.le(a)) continue;
      const k = Math.max(1, Math.round(N(sampleAt(n, ev.s, ctx), 1)));
      const step = ev.e.sub(ev.s).div(new R(k));
      const b0 = ev.p.begin !== undefined ? N(ev.p.begin) : 0, b1 = ev.p.end !== undefined ? N(ev.p.end) : 1;
      for (let i = 0; i < k; i++) {
        const s = ev.s.add(step.mul(new R(i)));
        if (s.ge(a) && s.lt(b)) out.push({ s, e: s.add(step), v: ev.v, p: { ...ev.p, begin: b0 + (b1 - b0) * i / k, end: b0 + (b1 - b0) * (i + 1) / k } });
      }
    }
    return out;
  });
});
def("soundfont", "soundfont(source)", "Load a SoundFont 2 (.sf2) bank, as a top-level line: a file next to the piece, a URL, or \"github:user/repo/path.sf2\". Then play its instruments with .gm(). General MIDI banks such as GeneralUser GS give all 128 standard instruments and the drum kits.", cat.io, ([src]) => ({ __soundfont: String(src) }));
def("gm", "gm(p, program, bank: 0)", "Play notes on an instrument of the loaded SoundFont: a General MIDI program number from 1 (piano) to 128, or a name to search for, .gm(\"violin\"). On drum names with no program it plays the drum kit.", cat.param, ([p, prog, bank], named) => {
  let q = setParam(P(p), "inst", "gm");
  const pr = named.program ?? prog, bk = named.bank ?? bank;
  if (typeof pr === "string") q = setParam(q, "gmName", pr);
  else if (pr !== undefined) q = mapEv(q, (ev, ctx) => ({ ...ev, p: { ...ev.p, gmProgram: Math.max(0, Math.min(127, Math.round(N(sampleAt(pr, ev.s, ctx))) - 1)) } }));
  if (bk !== undefined) q = setParam(q, "gmBank", bk);
  return q;
});
def("samples", "samples(source)", "Load a sample pack, as a top-level line: a folder (command line), a URL of a strudel.json sample map, or \"github:user/repo\" for that repository's strudel.json. Sounds load on first use.", cat.io, ([src]) => ({ __samples: String(src) }));
def("dirt", "dirt(p, sound: \"\", orbit: 0)", "Send to SuperDirt (TidalCycles' sound engine) instead of the built-in sound, over OSC from tine daw or tine dirt. sound is a SuperDirt sample bank or synth; without it, sample names, drum names and instruments are translated.", cat.param, ([p, snd, orbit], named) => {
  let q = setParam(P(p), "dirt", named.sound ?? snd ?? "");
  const o = named.orbit ?? orbit; if (o !== undefined) q = setParam(q, "orbit", o);
  return q;
});
def("midi", "midi(p, channel: 1, port: \"\")", "Send to an external MIDI device instead of the built-in synth.", cat.param, ([p, ch, port], named) => {
  let q = setParam(P(p), "midi", Math.round(N(named.channel ?? ch, 1)));
  const pt = named.port ?? port; if (pt !== undefined) q = setParam(q, "port", String(pt));
  return q;
});
def("ctl", "ctl(p, number, value)", "Send a MIDI control change (value 0 to 1) just before each note. value may be a pattern or signal: .ctl(74, sine(4)).", cat.param, ([p, n, v], _named, call) => {
  need([p, n, v], 3, "ctl(p, number, value)");
  const k = Math.max(0, Math.min(127, Math.round(N(n))));
  return mapEv(P(p), (ev, ctx) => ({ ...ev, p: { ...ev.p, ctl: { ...(ev.p.ctl ?? {}), [k]: clamp01(num(sampleAt(v, ev.s, ctx))) } } }));
});
def("program", "program(p, n)", "Choose an instrument on external gear with a MIDI program change (1 to 128, as printed in General MIDI lists). It is sent only when it changes.", cat.param, ([p, n]) => {
  return mapEv(P(p), (ev, ctx) => ({ ...ev, p: { ...ev.p, program: Math.max(1, Math.min(128, Math.round(num(sampleAt(n, ev.s, ctx))))) } }));
});
def("as_cc", "as_cc(p, number, rate: 16)", "Turn a voice of numbers (0 to 1) into MIDI control changes instead of notes: voice sweep = sine(4).as_cc(74).midi(1). A signal is sampled `rate` times per bar.", cat.param, ([p, n, r], named) => {
  const k = Math.max(0, Math.min(127, Math.round(N(n))));
  let q = P(p);
  if (q.sig) q = segment(Math.max(1, Math.round(N(named.rate ?? r, 16))), q);
  return mapEv(q, ev => {
    const v = ev.v instanceof R ? ev.v.toNumber() : ev.v;
    if (typeof v !== "number") throw new TineError("type", `as_cc needs numbers from 0 to 1, got ${typeName(ev.v)}`, undefined, "try a signal like sine(4), or a phrase of numbers like [0 .5 1]");
    return { ...ev, v: 0, p: { ...ev.p, ccOut: k, ccValue: clamp01(v) } };
  });
});
def("mpe", "mpe(p)", "Send each note on its own MIDI channel (2 to 16) so microtonal pitch bends do not collide.", cat.param, ([p]) => setParam(P(p), "mpe", true));
def("cc", "cc(number, channel: any)", "A live signal (0 to 1) from a MIDI controller knob or fader.", cat.io, ([n, ch]) => {
  const k = Math.round(N(n)), c = ch === undefined ? undefined : Math.round(N(ch));
  return signal((_t, ctx) => ctx.inputs.cc(k, c), `cc(${k})`);
});
def("held", "held(steps: 1)", "The notes currently held on your MIDI keyboard, as a chord, sampled `steps` times per bar. Try held(4).arp.", cat.io, ([n]) => {
  const s = signal((_t, ctx) => { const h = ctx.inputs.held(); return h.length ? new Chord(h.map(x => new Pitch(x))) : REST; }, "held");
  return segment(Math.round(N(n, 1)), s);
});

// ===== signals and generators =====
const sig = (name: string, sigStr: string, doc: string, f: (x: number) => number) =>
  def(name, sigStr, doc, cat.gen, ([period]) => { const T = N(period, 1); return signal(t => f((((t / T) % 1) + 1) % 1), `${name}(${T})`); });
sig("sine", "sine(period: 1)", "A smooth signal from 0 to 1 and back, once per `period` bars.", x => 0.5 - 0.5 * Math.cos(2 * Math.PI * x));
sig("tri", "tri(period: 1)", "A triangle signal, 0 up to 1 and back.", x => (x < 0.5 ? 2 * x : 2 - 2 * x));
sig("saw", "saw(period: 1)", "A ramp from 0 to 1 every `period` bars.", x => x);
sig("square", "square(period: 1)", "Alternates between 0 and 1.", x => (x < 0.5 ? 0 : 1));
def("noise", "noise(rate: 16)", "A seeded random signal holding a new value `rate` times per bar.", cat.gen, ([r], _n, call) => {
  const k = N(r, 16), salt = call.interp.salt();
  return signal((t, ctx) => rand01(ctx.seed, ctx.voice, salt, Math.floor((t + ctx.offset.toNumber()) * k)), "noise");
});
def("drift", "drift(rate: 1)", "A smooth seeded random signal, wandering between 0 and 1.", cat.gen, ([r], _n, call) => {
  const k = N(r, 1), salt = call.interp.salt();
  return signal((t, ctx) => {
    const x = (t + ctx.offset.toNumber()) * k, i = Math.floor(x), f = x - i;
    const a = rand01(ctx.seed, ctx.voice, salt, i), b = rand01(ctx.seed, ctx.voice, salt, i + 1);
    const w = 0.5 - 0.5 * Math.cos(Math.PI * f); return a + (b - a) * w;
  }, "drift");
});
def("range", "range(signal, lo, hi)", "Rescale a 0..1 signal or pattern to lo..hi.", cat.gen, ([s, lo, hi]) => {
  const a = N(lo), b = N(hi);
  return mapV(P(s), v => (isNum(v) ? a + num(v) * (b - a) : v));
});
def("seg", "seg(signal, n)", "Sample a signal n times per bar, turning it into discrete events.", cat.gen, ([s, n]) => segment(N(n), P(s)));
def("run", "run(n)", "The phrase [0 1 2 ... n-1].", cat.gen, ([n]) => list(Array.from({ length: Math.max(0, Math.round(N(n))) }, (_, i) => new R(i))));

// ===== lists =====
def("len", "len(list)", "Number of elements.", cat.list, ([l]) => (typeof l === "string" ? new R(l.length) : new R(items(l).length)));
def("at", "at(list, i)", "Element i (0-based; wraps around, so negative counts from the end).", cat.list, ([l, i]) => { const xs = items(l); const k = Math.round(N(i)); return xs[((k % xs.length) + xs.length) % xs.length]; });
def("map", "map(p, f)", "Apply f to every element of a list, or every event of a pattern.", cat.list, ([p, f], _n, call) => {
  if (p instanceof Chord) return new Chord(p.notes.map(x => fnCall(call, f, [x])));
  const q = P(p), salt = call.interp.salt();
  const np = mapEv(q, (ev, ctx) => (ev.v instanceof Rest ? ev : { ...ev, v: fnKeyed(call, f, [ev.v], ctx, [ev.s.n, ev.s.d], salt) }));
  if (q.items) np.items = q.items.map(x => (x instanceof Rest ? x : fnCall(call, f, [x])));
  return np;
});
def("filter", "filter(list, f)", "Keep elements (or events) for which f is true.", cat.list, ([p, f], _n, call) => {
  const q = P(p);
  if (q.items && !q.items.some(x => x instanceof Pat)) return list(q.items.filter(x => truthy(fnCall(call, f, [x]))));
  return filterEv(q, ev => truthy(fnCall(call, f, [ev.v])));
});
def("fold", "fold(list, start, f)", "Combine elements left to right: fold([1 2 3], 0, (a, x) => a + x).", cat.list, ([l, s, f], _n, call) => items(l).reduce((acc, x) => fnCall(call, f, [acc, x]), s));
def("concat", "concat(a, b, ...)", "Join lists into one longer list (one bar, more steps).", cat.list, (args) => list(args.flatMap(a => items(a))));
def("repeat", "repeat(x, n)", "A list of n copies of x.", cat.list, ([x, n]) => list(Array.from({ length: Math.max(0, Math.round(N(n))) }, () => x)));
def("take", "take(list, n)", "The first n elements.", cat.list, ([l, n]) => list(items(l).slice(0, Math.round(N(n)))));
def("drop", "drop(list, n)", "All but the first n elements.", cat.list, ([l, n]) => list(items(l).slice(Math.round(N(n)))));
def("rotate", "rotate(list, n)", "Rotate a list left by n places.", cat.list, ([l, n]) => { const xs = items(l), k = ((Math.round(N(n)) % xs.length) + xs.length) % xs.length; return list([...xs.slice(k), ...xs.slice(0, k)]); });
def("sum", "sum(list)", "Add up the elements.", cat.list, ([l]) => items(l).reduce((a, x) => (a instanceof R && x instanceof R ? a.add(x) : num(a) + num(x)), new R(0)));

// ===== math =====
const m1 = (name: string, f: (x: number) => number, doc: string) => def(name, `${name}(x)`, doc, cat.math, ([x]) => {
  if (x instanceof Pat) return mapV(x, v => (isNum(v) ? f(num(v)) : v));
  const r = f(N(x)); return Number.isInteger(r) && Math.abs(r) < 2 ** 52 ? new R(r) : r;
});
m1("floor", Math.floor, "Round down."); m1("ceil", Math.ceil, "Round up."); m1("round", Math.round, "Round to nearest.");
m1("abs", Math.abs, "Absolute value."); m1("sqrt", Math.sqrt, "Square root."); m1("sin", Math.sin, "Sine (radians).");
m1("cos", Math.cos, "Cosine (radians)."); m1("log2", Math.log2, "Base-2 logarithm."); m1("exp", Math.exp, "e to the power x.");
def("min", "min(a, b, ...)", "Smallest value.", cat.math, (args) => args.reduce((a, b) => (num(b) < num(a) ? b : a)));
def("max", "max(a, b, ...)", "Largest value.", cat.math, (args) => args.reduce((a, b) => (num(b) > num(a) ? b : a)));
def("clamp", "clamp(x, lo, hi)", "Limit x to the range lo..hi.", cat.math, ([x, lo, hi]) => Math.max(N(lo), Math.min(N(hi), N(x))));
def("lerp", "lerp(a, b, t)", "Linear blend from a to b.", cat.math, ([a, b, t]) => N(a) + (N(b) - N(a)) * N(t));

// ===== misc =====
def("print", "print(x, ...)", "Show values in the console.", cat.misc, (args, _n, call) => { call.interp.scene.prints.push(args.map(a => (typeof a === "string" ? a : show(a))).join(" ")); return args[0] ?? null; });
def("str", "str(x)", "Text form of a value.", cat.misc, ([x]) => (typeof x === "string" ? x : show(x)));
def("type", "type(x)", "The name of a value's type.", cat.misc, ([x]) => typeName(x));

// ===== harmony =====
const H_CAT = "harmony";
const keyOf = (ev: Ev, ctx: Ctx): Key => ev.p.key ?? ctx.key;
// apply f to every chord in p (a chord value, or the chords of a pattern)
function chordMap(p: any, f: (c: Chord, key: Key) => any): any {
  if (p instanceof Chord) return f(p, new Key(new Pitch(60), SCALES.major));
  return mapEv(P(p), (ev, ctx) => (ev.v instanceof Chord ? { ...ev, v: f(ev.v, keyOf(ev, ctx)) } : ev));
}
const pitchOf = (x: any, d: number) => (x === undefined ? d : x instanceof Pitch ? x.semi : N(x));

def("changes", "changes(text, octave: 3)", "Chords from a lead sheet: changes(\"Dm7 G7 | Cmaj7 %\"). Bars are split by |, chords in a bar share it, / holds a chord one more slot, % repeats the bar, N.C. is no chord. Loops over its bars.", H_CAT, ([t, oct], named) => {
  const bars = H.parseChanges(String(t), Math.round(N(named.octave ?? oct, 3)));
  const pats = bars.map(steps => seq(steps.map(st => ({ pat: st.chord ? toPat(st.chord) : toPat(REST), w: new R(st.w) }))));
  return alt(pats);
});
def("root", "root(p)", "The root of each chord (from its symbol, or named from its notes). Single notes pass through. Try changes(...).root.octave(-1) for a bass line.", H_CAT, ([p]) => chordMap(p, (c, k) => new Pitch(H.rootOf(c, k))));
def("bassnote", "bassnote(p)", "The bass note of each chord: the slash note of c@7/e, otherwise the root.", H_CAT, ([p]) => chordMap(p, (c, k) => new Pitch(H.bassOf(c, k))));
// Octaves that move a note or chord (by its lowest note) into [lo, hi).
function withinShift(semis: number[], lo: number, hi: number): number {
  if (!semis.length) return 0;
  const low = Math.min(...semis);
  let k = Math.ceil((lo - low) / 12);
  if (hi - lo > 12) while (low + 12 * (k + 1) < hi && low + 12 * k < lo) k++;
  return k;
}
def("within", "within(p, lo, hi: lo + 12)", "Move each note or chord by whole octaves until it sits in lo..hi (a chord moves by its lowest note and keeps its shape). changes(...).bassnote.within(e1, e2) folds a bass line into one octave.", cat.pitch, ([p, lo, hi]) => {
  const L = pitchOf(lo, 36), Hh = hi === undefined ? L + 12 : pitchOf(hi, L + 12);
  const fix = (v: any, k: Key) => { if (v === REST || (v instanceof Pitch && v.drum)) return v; const sh = withinShift(H.semisOfValue(v, k), L, Hh); return sh ? mapPitch(v, x => transposeVal(x, 12 * sh)) : v; };
  if (!(p instanceof Pat)) return fix(p, new Key(new Pitch(60), SCALES.major));
  return mapEv(P(p), (ev, ctx) => ({ ...ev, v: fix(ev.v, keyOf(ev, ctx)) }));
});
def("tones", "tones(chord)", "A chord's notes as a list, low to high.", H_CAT, ([c]) => {
  if (!(c instanceof Chord)) throw new TypeError(`tones needs a chord, got ${typeName(c)}`);
  return list(H.chordSemis(c, new Key(new Pitch(60), SCALES.major)).map(x => new Pitch(x)));
});
def("name", "name(x, bars: 1)", "Name a chord, or the chords of a pattern, as a chord symbol: name({e g c5}) is \"C/E\".", H_CAT, ([x, bars], named, call) => {
  const key = call.interp.scene.key as Key;
  const hint = (c: Chord, k: Key) => (c.root !== undefined ? H.semisOfValue(c.root, k)[0] : undefined);
  if (x instanceof Chord) return H.nameOf(H.chordSemis(x, key), hint(x, key));
  if (x instanceof Pat && x.items && !x.items.some(v => v instanceof Pat || v instanceof Chord)) return H.nameOf(x.items.flatMap(v => H.semisOfValue(v, key)));
  const n = Math.max(1, Math.round(N(named.bars ?? bars, 1)));
  const ctx: Ctx = { seed: call.interp.scene.seed, voice: 0, key, offset: ZERO, inputs: { cc: () => 0, held: () => [] } };
  const out: string[] = [];
  for (let b = 0; b < n; b++) {
    const evs = P(x).query(new R(b), new R(b + 1), ctx).filter(e => e.s.ge(new R(b))).sort((u, v) => u.s.toNumber() - v.s.toNumber());
    out.push(evs.map(e => (e.v instanceof Chord ? H.nameOf(H.chordSemis(e.v, keyOf(e, ctx)), hint(e.v, keyOf(e, ctx))) : H.semisOfValue(e.v, keyOf(e, ctx)).map(s => H.pcName(s)).join(""))).filter(Boolean).join(" ") || "N.C.");
  }
  return out.join(" | ");
});
def("shell", "shell(p)", "Shell voicings: root, third and seventh, the bebop pianist's left hand.", H_CAT, ([p]) => chordMap(p, H.shellVoicing));
def("guide", "guide(p)", "Guide tones: just the third and seventh of each chord. Add .voicelead to hear them move by step.", H_CAT, ([p]) => chordMap(p, H.guideVoicing));
def("rootless", "rootless(p, form: \"a\")", "Rootless voicings: four notes without the root (3-5-7-9, dominants use the 13th for the 5th). Form \"a\" starts on the third, \"b\" on the seventh.", H_CAT, ([p, form], named) => {
  const f = String(named.form ?? form ?? "a"); return chordMap(p, (c, k) => H.rootlessVoicing(c, k, f));
});
def("drop2", "drop2(p)", "Drop-2 voicings: close position, with the second voice from the top dropped an octave.", H_CAT, ([p]) => chordMap(p, (c, k) => H.dropVoicing(c, k, [2])));
def("drop3", "drop3(p)", "Drop-3 voicings: close position, with the third voice from the top dropped an octave.", H_CAT, ([p]) => chordMap(p, (c, k) => H.dropVoicing(c, k, [3])));
def("drop24", "drop24(p)", "Drop-2-and-4 voicings: the second and fourth voices from the top dropped an octave.", H_CAT, ([p]) => chordMap(p, (c, k) => H.dropVoicing(c, k, [2, 4])));
def("voicelead", "voicelead(p, around: e4)", "Voice leading: play each chord in the close-position inversion that moves least from the previous chord, staying near `around`. Deterministic: built on evolve, so the chain is replayed from bar 0.", H_CAT, ([p, around], named) => {
  const q = P(p), center = pitchOf(named.around ?? around, 64);
  // voice the chords that start in bar c, in order, starting from the voicing `prev`
  const voiceBar = (prev: number[] | null, c: number, ctx: Ctx) => {
    const lo = new R(c);
    const evs = q.query(lo, new R(c + 1), ctx).filter(e => e.s.ge(lo)).sort((u, v) => u.s.toNumber() - v.s.toNumber());
    const out: Ev[] = [];
    for (const e of evs) {
      if (!(e.v instanceof Chord)) { out.push(e); continue; }
      const key = keyOf(e, ctx), v = H.leadTo(prev, H.chordSemis(e.v, key), center);
      prev = v;
      out.push({ ...e, v: new Chord(v.map(x => new Pitch(x)), new Pitch(H.rootOf(e.v, key)), e.v.bass) });
    }
    return { out, last: prev };
  };
  // state at bar c: the voicing sounding as bar c begins
  return evolve(null, (prev, c, ctx) => voiceBar(prev, c - 1, ctx).last, (prev, c, ctx) => {
    const { out } = voiceBar(prev, c, ctx);
    return new Pat((a, b) => out.filter(e => e.s.ge(a) && e.s.lt(b)));
  });
});
def("interval", "interval(a, b, long: false)", "The interval between two pitches by size: interval(c4, e4) is \"M3\"; with long: true, \"major 3rd\". Tine counts semitones, so C-F# and C-Gb are both TT (tritone).", H_CAT, ([a, b, long], named) => {
  const k = new Key(new Pitch(60), SCALES.major);
  const x = H.semisOfValue(a, k)[0], y = H.semisOfValue(b, k)[0];
  if (x === undefined || y === undefined) throw new TypeError("interval needs two pitches, like interval(c4, g4)");
  return H.intervalName(y - x, truthy(named.long ?? long ?? false));
});
