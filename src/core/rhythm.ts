// Rhythm as its own layer. A pattern can be taken apart into a rhythm (when,
// how long, how hard) and a note sequence (what, in order), each changed on
// its own, and poured back together with `on`. Rhythms have their own
// operators, which work on the grid a phrase was written on.
//
// Everything here stays a function of time and stays replayable. The one
// place that needs history is `on` (which note does hit n get?) and
// `mutate` (where has each hit wandered to by bar n?). Both count forward
// from bar 0 of the section and memoize, the way `evolve` does.

import { R, ZERO } from "./rational";
import { Pat, Ev, Ctx, Chord, Rest, Hit, HITS, makeCtx, rgcd, keepShape, silence, evRand } from "./pattern";
import { rand01 } from "./rng";

const MAX_BARS = 100_000;

// ---------- the grid a rhythm sits on ----------

export interface Shape { grid: R; period: number }

// The step and loop length of p. A phrase knows them from how it was written;
// for anything else, the step is the finest onset in its first bar.
export function shapeOf(p: Pat, ctx: Ctx): Shape {
  const period = p.period ?? 1;
  if (p.grid && p.grid.n > 0) return { grid: p.grid, period };
  let g = ZERO;
  for (const ev of p.query(ZERO, new R(period), ctx)) g = rgcd(g, ev.s.sub(ev.s.sam()));
  if (g.n === 0) g = new R(1, 16);
  return { grid: g, period };
}

const keyOf = (ctx: Ctx) => `${ctx.seed}|${ctx.voice}|${ctx.offset}`;

// Query p one loop (block of `period` bars) at a time. fn gets the block's
// index and its events, and returns the events to play; the result is cut
// back to [a, b).
function perBlock(p: Pat, shape: (ctx: Ctx) => Shape, fn: (k: number, evs: Ev[], sh: Shape, ctx: Ctx) => Ev[]): Pat {
  return new Pat((a, b, ctx) => {
    const sh = shape(ctx);
    const P = sh.period;
    const out: Ev[] = [];
    for (let k = Math.floor(a.toNumber() / P); k * P < b.toNumber(); k++) {
      const lo = new R(k * P), hi = new R((k + 1) * P);
      for (const ev of fn(k, p.query(lo, hi, ctx), sh, ctx)) if (ev.s.ge(a) && ev.s.lt(b)) out.push(ev);
    }
    return out;
  });
}

const mod = (x: R, m: R): R => { const q = Math.floor(x.div(m).toNumber()); return x.sub(m.mul(new R(q))); };

// Move every event by t bars, wrapping inside its loop.
export function wrapShift(p: Pat, t: (sh: Shape) => R): Pat {
  const np = perBlock(p, ctx => shapeOf(p, ctx), (k, evs, sh) => {
    const base = new R(k * sh.period), P = new R(sh.period), dt = t(sh);
    return evs.map(ev => { const s = base.add(mod(ev.s.sub(base).add(dt), P)); return { ...ev, s, e: s.add(ev.e.sub(ev.s)) }; });
  });
  return keepShape(p, np);
}

export const rotate = (p: Pat, n: number) => wrapShift(p, sh => sh.grid.mul(R.of(-n)));
export const displace = (p: Pat, t: R) => wrapShift(p, () => t);

// slot index of time s inside block k
const slotOf = (s: R, base: R, grid: R) => Math.floor(s.sub(base).div(grid).toNumber() + 1e-9);

// hits become rests and rests become hits
export function flip(p: Pat): Pat {
  const np = perBlock(p, ctx => shapeOf(p, ctx), (k, evs, sh) => {
    const base = new R(k * sh.period), S = Math.round(new R(sh.period).div(sh.grid).toNumber());
    const used = new Set(evs.filter(ev => !(ev.v instanceof Rest)).map(ev => slotOf(ev.s, base, sh.grid)));
    const out: Ev[] = [];
    for (let i = 0; i < S; i++) if (!used.has(i)) { const s = base.add(sh.grid.mul(new R(i))); out.push({ s, e: s.add(sh.grid), v: HITS.x, p: {} }); }
    return out;
  });
  return keepShape(p, np);
}

// remove n hits (never the downbeat), seeded
export function thin(p: Pat, n: number, salt: number): Pat {
  const np = perBlock(p, ctx => shapeOf(p, ctx), (k, evs, sh, ctx) => {
    const base = new R(k * sh.period);
    const ranked = evs.filter(ev => !ev.s.eq(base)).map(ev => ({ ev, r: evRand(ctx, salt, ev.s) })).sort((x, y) => x.r - y.r);
    const drop = new Set(ranked.slice(0, Math.max(0, n)).map(x => x.ev));
    return evs.filter(ev => !drop.has(ev));
  });
  return keepShape(p, np);
}

// add n hits on empty steps, seeded
export function fill(p: Pat, n: number, salt: number): Pat {
  const np = perBlock(p, ctx => shapeOf(p, ctx), (k, evs, sh, ctx) => {
    const base = new R(k * sh.period), S = Math.round(new R(sh.period).div(sh.grid).toNumber());
    const used = new Set(evs.map(ev => slotOf(ev.s, base, sh.grid)));
    const empty: { s: R; r: number }[] = [];
    for (let i = 0; i < S; i++) if (!used.has(i)) { const s = base.add(sh.grid.mul(new R(i))); empty.push({ s, r: evRand(ctx, salt, s) }); }
    empty.sort((x, y) => x.r - y.r);
    return [...evs, ...empty.slice(0, Math.max(0, n)).map(({ s }) => ({ s, e: s.add(sh.grid), v: HITS.x, p: {} }))].sort((x, y) => x.s.cmp(y.s));
  });
  return keepShape(p, np);
}

// ---------- combining rhythms ----------

const onsets = (evs: Ev[]) => new Set(evs.map(ev => ev.s.toString()));

export function union(a: Pat, b: Pat): Pat {
  const np = new Pat((x, y, ctx) => {
    const ea = a.query(x, y, ctx), seen = onsets(ea);
    return [...ea, ...b.query(x, y, ctx).filter(ev => !seen.has(ev.s.toString()))].sort((p, q) => p.s.cmp(q.s));
  });
  np.grid = a.grid && b.grid ? rgcd(a.grid, b.grid) : undefined;
  np.period = Math.max(a.period ?? 1, b.period ?? 1);
  return np;
}

export function intersect(a: Pat, b: Pat, keep: boolean): Pat {
  const np = new Pat((x, y, ctx) => { const ob = onsets(b.query(x, y, ctx)); return a.query(x, y, ctx).filter(ev => ob.has(ev.s.toString()) === keep); });
  return keepShape(a, np);
}

// ---------- mutation ----------

// Each loop, a share of the hits each move one step left or right (if that
// step is free). The moves accumulate: the rhythm wanders, and the same seed
// always wanders the same way.
export function mutate(p: Pat, rate: number, salt: number): Pat {
  const memo = new Map<string, (Ev | null)[][]>();
  const states = (ctx: Ctx, sh: Shape, upto: number): (Ev | null)[][] => {
    const key = keyOf(ctx);
    let arr = memo.get(key);
    if (!arr) {
      const S = Math.round(new R(sh.period).div(sh.grid).toNumber());
      const first: (Ev | null)[] = Array(S).fill(null);
      for (const ev of p.query(ZERO, new R(sh.period), ctx)) {
        const i = slotOf(ev.s, ZERO, sh.grid);
        if (i >= 0 && i < S && !first[i]) first[i] = { ...ev, s: ZERO, e: ev.e.sub(ev.s) }; // relative: s = 0, e = length
      }
      arr = [first];
      memo.set(key, arr);
      if (memo.size > 32) memo.delete(memo.keys().next().value!);
    }
    if (upto > MAX_BARS) throw new Error(`mutate can look ahead at most ${MAX_BARS} bars`);
    while (arr.length <= upto) {
      const k = arr.length, prev = arr[k - 1], S = prev.length, next = prev.slice();
      const g = k + ctx.offset.toNumber();
      for (let i = 0; i < S; i++) {
        if (!prev[i] || next[i] !== prev[i]) continue; // empty, or already moved into
        if (rand01(ctx.seed, ctx.voice, salt, g, i) >= rate) continue;
        const j = (i + (rand01(ctx.seed, ctx.voice, salt, g, i, 1) < 0.5 ? -1 : 1) + S) % S;
        if (next[j]) continue;
        next[j] = prev[i]; next[i] = null;
      }
      arr.push(next);
    }
    return arr;
  };
  const np = perBlock(p, ctx => shapeOf(p, ctx), (k, _evs, sh, ctx) => {
    if (k < 0) return [];
    const st = states(ctx, sh, k)[k], base = new R(k * sh.period), out: Ev[] = [];
    st.forEach((ev, i) => { if (ev) { const s = base.add(sh.grid.mul(new R(i))); out.push({ ...ev, s, e: s.add(ev.e) }); } });
    return out;
  });
  return keepShape(p, np);
}

// ---------- lengths in beats (design A) ----------

// Measure a phrase's steps in `unitBars` bars each, instead of dividing one
// bar. The line lasts as long as its steps add up to, then rests to the end
// of the bar. Loop k of the line plays the phrase's cycle k, so <a b> and
// randomness inside it still move on each time round.
export function beats(p: Pat, unitBars: R): Pat {
  if (!p.weights) throw new Error("beats works on a phrase as written, like [c:3/2 d:1/2 e:2].beats; call it before other functions");
  const total = p.weights.reduce((s, w) => s.add(w), ZERO);
  if (total.n <= 0) return silence;
  const L = total.mul(unitBars);
  const P = Math.max(1, L.ceil());
  const np = new Pat((a, b, ctx) => {
    const out: Ev[] = [];
    for (let k = Math.floor(a.toNumber() / P); k * P < b.toNumber(); k++) {
      const base = new R(k * P), K = new R(k);
      const lo = R.max(a, base), hi = R.min(b, base.add(L));
      if (!lo.lt(hi)) continue;
      const toLocal = (t: R) => K.add(t.sub(base).div(L));
      for (const ev of p.query(toLocal(lo), toLocal(hi), ctx)) {
        out.push({ ...ev, s: base.add(ev.s.sub(K).mul(L)), e: base.add(ev.e.sub(K).mul(L)) });
      }
    }
    return out;
  }, p.items);
  np.weights = p.weights;
  if (p.grid) np.grid = p.grid.mul(L);
  np.period = P;
  return np;
}

// ---------- taking a pattern apart ----------

// The rhythm of p: every onset, length and setting, with the pitch replaced
// by a hit. A hit keeps an accent it already had.
export function rhythmOf(p: Pat): Pat {
  const np = new Pat((a, b, ctx) => p.query(a, b, ctx).filter(ev => !(ev.v instanceof Rest)).map(ev => ({ ...ev, v: ev.v instanceof Hit ? ev.v : HITS.x })));
  return keepShape(p, np);
}

// The notes of p, in playing order, over its first `bars` bars. Notes that
// start together become one chord.
export function notesOf(p: Pat, bars: number, seed: number): any[] {
  const evs = p.query(ZERO, new R(Math.max(1, bars)), makeCtx(seed)).filter(ev => !(ev.v instanceof Rest)).sort((x, y) => x.s.cmp(y.s));
  const out: any[] = [];
  for (let i = 0; i < evs.length;) {
    let j = i; const group: any[] = [];
    while (j < evs.length && evs[j].s.eq(evs[i].s)) group.push(evs[j++].v);
    out.push(group.length === 1 ? group[0] : new Chord(group.flatMap(v => (v instanceof Chord ? v.notes : [v]))));
    i = j;
  }
  return out;
}

// ---------- putting it back together ----------

interface Entry { v: any; hold: boolean }

// The note list `on` steps through: a phrase's steps, where `_` holds the
// note through the next hit and `.` leaves a hit silent.
export function noteEntries(notes: any, seed: number): Entry[] {
  let vals: any[], ws: number[];
  if (Array.isArray(notes)) { vals = notes; ws = notes.map(() => 1); }
  else if (notes instanceof Pat && notes.items && notes.weights && notes.items.length === notes.weights.length && !notes.items.some(v => v instanceof Pat)) {
    vals = notes.items; ws = notes.weights.map(w => Math.max(1, Math.round(w.toNumber())));
  } else if (notes instanceof Pat) { vals = notesOf(notes, 1, seed); ws = vals.map(() => 1); }
  else { vals = [notes]; ws = [1]; }
  const out: Entry[] = [];
  vals.forEach((v, i) => { out.push({ v, hold: false }); for (let k = 1; k < ws[i]; k++) out.push({ v, hold: true }); });
  return out;
}

// One note per hit. The notes and the rhythm loop independently, counted
// from the start of the section (or every `reset` bars).
export function on(entries: Entry[], rhythm: Pat, reset: number): Pat {
  if (!entries.length) return silence;
  const memo = new Map<string, number[]>();
  // onsets of bar c, in order (simultaneous hits share one)
  const barOnsets = (c: number, ctx: Ctx): Ev[][] => {
    const evs = rhythm.query(new R(c), new R(c + 1), ctx).filter(ev => !(ev.v instanceof Rest)).sort((x, y) => x.s.cmp(y.s));
    const groups: Ev[][] = [];
    for (const ev of evs) { const g = groups[groups.length - 1]; if (g && g[0].s.eq(ev.s)) g.push(ev); else groups.push([ev]); }
    return groups;
  };
  // pre[c] = hits from bar 0 up to the start of bar c
  const prefix = (c: number, ctx: Ctx): number[] => {
    if (c > MAX_BARS) throw new Error(`on can count at most ${MAX_BARS} bars of hits`);
    const key = keyOf(ctx);
    let pre = memo.get(key);
    if (!pre) { pre = [0]; memo.set(key, pre); if (memo.size > 32) memo.delete(memo.keys().next().value!); }
    while (pre.length <= c + 1) { const k = pre.length - 1; pre.push(pre[k] + barOnsets(k, ctx).length); }
    return pre;
  };
  const vel = (ev: Ev) => (ev.v instanceof Hit && ev.v.accent !== 1 ? { vel: Math.min(1, (ev.p.vel !== undefined ? Number(ev.p.vel) : 0.8) * ev.v.accent) } : {});
  // the end of the hit numbered n (counted from bar 0), searching at most a few bars on
  const endOfHit = (n: number, fromBar: number, limitBar: number, ctx: Ctx): R | null => {
    for (let c = fromBar; c < Math.min(limitBar, fromBar + 64); c++) {
      const pre = prefix(c + 1, ctx);
      if (pre[c + 1] > n) { const g = barOnsets(c, ctx)[n - pre[c]]; return g ? g.reduce((m, ev) => R.max(m, ev.e), g[0].e) : null; }
    }
    return null;
  };
  return new Pat((a, b, ctx) => {
    const out: Ev[] = [];
    for (let c = a.floor(); c < b.toNumber(); c++) {
      if (c < 0) continue;
      const pre = prefix(c, ctx);
      const start = reset > 0 ? Math.floor(c / reset) * reset : 0;
      const limit = reset > 0 ? start + reset : Infinity;
      barOnsets(c, ctx).forEach((group, j) => {
        if (group[0].s.lt(a) || !group[0].s.lt(b)) return;
        const n = pre[c] - pre[start] + j;
        const e = entries[n % entries.length];
        if (e.hold || e.v instanceof Rest) return;
        let holds = 0;
        while (holds + 1 < entries.length && entries[(n + holds + 1) % entries.length].hold) holds++;
        const end = holds ? endOfHit(pre[c] + j + holds, c, limit, ctx) : null;
        for (const ev of group) out.push({ s: ev.s, e: end ?? ev.e, v: e.v, p: { ...ev.p, ...vel(ev) } });
      });
    }
    return out;
  });
}

// rhythm + value: the value, with the hit's timing and accent
export function hitWith(ev: Ev, v: any): Ev {
  if (!(ev.v instanceof Hit) || ev.v.accent === 1) return { ...ev, v };
  return { ...ev, v, p: { ...ev.p, vel: Math.min(1, (ev.p.vel !== undefined ? Number(ev.p.vel) : 0.8) * ev.v.accent) } };
}

