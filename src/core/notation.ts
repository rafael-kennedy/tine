// Staff notation, engraved here as SVG, so a piece can be read and printed
// with nothing else installed. Two layouts share one engraver:
//  - a lead sheet: the melody on one staff, chord symbols above, sections
//    printed once with repeats and a road map, four bars to a line;
//  - a score: every voice on its own staff, bar for bar.
//
// The pipeline: notes become measures of events (exact ticks, as in the
// MusicXML writer), events are spaced into columns by duration, measures are
// broken into systems and justified, then each staff is drawn with glyph
// outlines from the Bravura font (glyphs.gen.ts).
import { R } from "./rational";
import { Scene } from "./interp";
import { TimedNote, renderNotes, timeline } from "./scene";
import { keyFifths, Key } from "./pitch";
import { spell, noteValues, asWritten } from "./musicxml";
import { GLYPHS } from "./glyphs.gen";
import { chordBars, harmonyVoices, ChartBar, keyLabel, SymbolStyle, chordSpelling } from "./chart";
import { symbol as chordSymbol, symbolWidth, crotchet } from "./chartsvg";
import { Paper, PAPER, esc, fmt, svgPage, textWidth, htmlDocument } from "./page";

const LETTERS = "CDEFGAB";
const LEVEL: Record<string, number> = { whole: -2, half: -1, quarter: 0, eighth: 1, "16th": 2, "32nd": 3, "64th": 4, "128th": 5 };
const FLAG = ["", "8th", "16th", "32nd", "64th", "128th"];
const REST: Record<string, string> = { whole: "restWhole", half: "restHalf", quarter: "restQuarter", eighth: "rest8th", "16th": "rest16th", "32nd": "rest32nd", "64th": "rest64th", "128th": "rest128th" };
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
const MAX_DIVISIONS = 100_000;

type Clef = "treble" | "bass" | "perc";
const BOTTOM: Record<Clef, number> = { treble: 30, bass: 18, perc: 30 }; // diatonic step of the bottom line (E4, G2)

// General MIDI drums on a five-line staff: [position, cross notehead]
const DRUM_POS: Record<number, [number, boolean]> = {
  35: [1, false], 36: [1, false], 37: [5, true], 38: [5, false], 39: [5, true], 40: [5, false], 41: [2, false], 43: [3, false],
  42: [9, true], 44: [-1, true], 46: [9, true], 45: [6, false], 47: [6, false], 48: [7, false], 50: [7, false],
  49: [10, true], 57: [10, true], 51: [8, true], 59: [8, true], 52: [10, true], 53: [8, true], 55: [10, true], 56: [7, true],
};

interface Head { semi: number; pos: number; alter: number; acc?: string; cents?: number; cross?: boolean; tieStart: boolean; tieStop: boolean }
interface Ev { t: number; len: number; type: string; dots: number; tuplet?: [number, number]; rest: boolean; heads: Head[]; layer: number; whole?: boolean }
interface PMeasure { evs: Ev[]; layers: number }
interface Part { name: string; clef: Clef; drums: boolean; measures: PMeasure[] }

export interface MeasureInfo {
  bar: number;               // the bar of the piece this measure prints
  fifths: number;
  mark?: string;             // section name
  tempo?: number;            // a tempo mark here
  keyText?: string;          // a key change here
  repeatStart?: boolean;
  repeatEnd?: boolean;
  times?: number;            // plays, on a repeat end
  end?: "double" | "final";
  chords?: ChartBar;
}
export interface Score {
  title: string; subtitle?: string;
  meter: [number, number]; div: number; M: number;
  tempo: number; key: Key;
  parts: Part[]; measures: MeasureInfo[];
  roadmap: string[] | null;
  lead: boolean;
}

export interface ScoreOptions {
  bars?: number;             // pieces without form: how many bars
  voices?: string[];         // score: which voices, in order (default all)
  melody?: string;           // lead sheet: the melody voice (default: guessed)
  chordVoices?: string[];    // read chord symbols from these voices
  chords?: boolean;          // score: chord symbols above the top staff (default true)
}

// echo copies are an effect, not notes to read
const num = (x: any) => (x instanceof R ? x.toNumber() : Number(x));
const pitched = (n: TimedNote) => n.params.ccOut === undefined && !n.params.echo;
const isDrum = (n: TimedNote) => n.params.inst === "kit" || n.params.drum !== undefined || !!n.params.hit;

// ---------- choosing the melody ----------

export function guessMelody(notes: TimedNote[], harmony: string[]): string | undefined {
  const pv = [...new Set(notes.filter(n => pitched(n) && !isDrum(n)).map(n => n.voice))];
  let best: string | undefined, bestScore = -Infinity;
  for (const v of pv) {
    const mine = notes.filter(n => n.voice === v && !isDrum(n));
    const mean = mine.reduce((a, n) => a + n.semi, 0) / mine.length;
    const starts = new Map<number, number>();
    for (const n of mine) starts.set(Math.round(n.bar * 960), (starts.get(Math.round(n.bar * 960)) ?? 0) + 1);
    const mono = [...starts.values()].filter(k => k === 1).length / Math.max(1, starts.size);
    let score = mean / 12 + mono * 4 - (harmony.includes(v) ? 6 : 0);
    if (/melod|tune|lead|vocal|sing|solo|line|top|theme|head/i.test(v)) score += 8;
    if (mean < 48) score -= 4;
    if (score > bestScore) { bestScore = score; best = v; }
  }
  return best;
}

// ---------- measures of events ----------

function divisions(notes: TimedNote[], qpb: R) {
  let div = qpb.d;
  for (const n of notes) {
    const s = R.approx(n.bar, 10_000).mul(qpb), e = R.approx(n.bar, 10_000).add(R.approx(n.bars, 10_000)).mul(qpb);
    div = lcm(div, s.d); div = lcm(div, e.d);
    if (div > MAX_DIVISIONS) return lcm(480, qpb.d);
  }
  return div;
}

function keyAlter(letter: string, fifths: number) {
  const sharps = "FCGDAEB", flats = "BEADGCF";
  if (fifths > 0) return sharps.indexOf(letter) < fifths ? 1 : 0;
  if (fifths < 0) return flats.indexOf(letter) < -fifths ? -1 : 0;
  return 0;
}

const ACC_GLYPH: Record<string, string> = {
  "-2": "accidentalDoubleFlat", "-1.5": "accidentalNarrowReversedFlatAndFlat", "-1": "accidentalFlat", "-0.5": "accidentalQuarterToneFlatStein",
  "0": "accidentalNatural", "0.5": "accidentalQuarterToneSharpStein", "1": "accidentalSharp", "1.5": "accidentalThreeQuarterTonesSharpStein", "2": "accidentalDoubleSharp",
};

function buildPart(name: string, notes: TimedNote[], plan: MeasureInfo[], div: number, M: number, meter: [number, number], tick: (x: number) => number): Part {
  const drums = notes.length > 0 && notes.every(isDrum);
  const tonal = notes.filter(n => !isDrum(n));
  const mean = tonal.reduce((a, n) => a + n.semi, 0) / Math.max(1, tonal.length);
  const clef: Clef = drums ? "perc" : mean < 55 ? "bass" : "treble";
  const B = meter[1] === 8 && meter[0] % 3 === 0 ? (div * 4 / 8) * 3 : div * 4 / meter[1]; // beat in ticks
  const evenBeats = Math.round(M / B) % 2 === 0, half = M / 2;
  const bin = (x: number) => { const r = new R(Math.round(x), div); return (r.d & (r.d - 1)) === 0; };

  // chords: same start and end; layers: non-overlapping runs of chords
  type C = { s: number; e: number; notes: TimedNote[] };
  const chords = new Map<string, C>();
  for (const n of notes) {
    const s = tick(n.bar), e = Math.max(s + 1, tick(n.bar + n.bars)), k = `${s}|${e}`;
    if (!chords.has(k)) chords.set(k, { s, e, notes: [] });
    chords.get(k)!.notes.push(n);
  }
  const layers: C[][] = [];
  for (const c of [...chords.values()].sort((a, b) => a.s - b.s || b.e - a.e)) {
    const l = layers.find(l => l[l.length - 1].e <= c.s);
    if (l) l.push(c); else layers.push([c]);
  }
  if (!layers.length) layers.push([]);

  // where to cut a span so the beat stays visible
  const cuts = (a: number, b: number, rest: boolean): [number, number][] => {
    const out: [number, number][] = [];
    let cur = a;
    while (cur < b) {
      let next = b;
      if (bin(cur) && bin(b - cur)) {
        if (rest) {
          if (evenBeats && cur % half === 0 && cur + half <= b) next = cur + half;
          else next = Math.min(b, (Math.floor(cur / B) + 1) * B);
        } else if (cur % B !== 0) { const nb = (Math.floor(cur / B) + 1) * B; if (nb < b) next = nb; }
        else if (evenBeats && cur % half !== 0 && cur < half && b > half) next = half;
      }
      out.push([cur, next]); cur = next;
    }
    return out;
  };
  const values = (a: number, b: number) => {
    const vs = noteValues(new R(b - a, div));
    let used = 0;
    return vs.map((v, i) => {
      let q = new R(4, 2 ** (LEVEL[v.type] + 2));
      if (v.dots) q = q.mul(new R(3, 2));
      if (v.tuplet) q = q.mul(new R(v.tuplet[1], v.tuplet[0]));
      const len = i === vs.length - 1 ? b - a - used : Math.round(q.toNumber() * div);
      const r = { t: a + used, len, v }; used += len; return r;
    });
  };

  const measures: PMeasure[] = plan.map((info, mi) => {
    const m0 = info.bar * M, m1 = m0 + M;
    const flats = info.fifths < 0;
    const contPrev = mi > 0 && plan[mi - 1].bar === info.bar - 1 && !info.repeatStart;
    const contNext = mi + 1 < plan.length && plan[mi + 1].bar === info.bar + 1 && !info.repeatEnd;
    const evs: Ev[] = [];
    let used = 0;
    layers.forEach((layer, li) => {
      const inBar = layer.filter(c => c.s < m1 && c.e > m0);
      if (li > 0 && !inBar.length) return;
      const L = used++;
      if (!inBar.length) { evs.push({ t: 0, len: M, type: "whole", dots: 0, rest: true, heads: [], layer: L, whole: true }); return; }
      let cur = 0;
      const rests = (a: number, b: number) => { for (const [s, e] of cuts(a, b, true)) for (const p of values(s, e)) evs.push({ t: p.t, len: p.len, type: p.v.type, dots: p.v.dots, tuplet: p.v.tuplet, rest: true, heads: [], layer: L }); };
      for (const c of inBar) {
        const s = Math.max(c.s, m0) - m0, e = Math.min(c.e, m1) - m0;
        if (s > cur) rests(cur, s);
        const tiedIn = c.s < m0 && contPrev, tiedOut = c.e > m1 && contNext;
        const pieces = cuts(s, e, false).flatMap(([a, b]) => values(a, b));
        pieces.forEach((p, pi) => {
          const heads: Head[] = [];
          for (const n of c.notes) {
            let h: Head;
            if (drums) {
              const [pos, cross] = DRUM_POS[Math.round(n.semi)] ?? [5, false];
              h = { semi: n.semi, pos, alter: 0, cross, tieStart: false, tieStop: false };
            } else {
              const sp = spell(n.semi, flats);
              const abs = sp.octave * 7 + LETTERS.indexOf(sp.step);
              h = { semi: n.semi, pos: abs - BOTTOM[clef], alter: sp.alter, tieStart: tiedOut || pi < pieces.length - 1, tieStop: tiedIn || pi > 0 };
            }
            if (!heads.some(x => x.pos === h.pos && x.alter === h.alter)) heads.push(h);
          }
          heads.sort((a, b) => a.pos - b.pos);
          evs.push({ t: p.t, len: p.len, type: p.v.type, dots: p.v.dots, tuplet: p.v.tuplet, rest: false, heads, layer: L });
        });
        cur = e;
      }
      if (cur < M) rests(cur, M);
    });
    // accidentals: against the key and what this bar has already shown
    if (!drums) {
      // a microtone is its nearest quarter-tone accidental plus a cents offset;
      // each is shown when it changes, so a meantone line is not all naturals
      const state = new Map<number, number>(), shown = new Map<number, number>();
      for (const ev of [...evs].sort((a, b) => a.t - b.t)) for (const h of ev.heads) {
        const abs = h.pos + BOTTOM[clef], letter = LETTERS[((abs % 7) + 7) % 7];
        const have = state.get(abs) ?? keyAlter(letter, info.fifths);
        const near = Math.round(h.alter * 2) / 2, cents = Math.round((h.alter - near) * 100);
        const carried = h.tieStop && contPrev && ev.t === 0;
        if (near !== have && !carried) h.acc = ACC_GLYPH[String(near)] ?? "accidentalNatural";
        if (cents && cents !== shown.get(abs) && !carried) h.cents = cents;
        state.set(abs, near); shown.set(abs, cents);
      }
    }
    return { evs, layers: used };
  });
  return { name, clef, drums, measures };
}

// ---------- what to print ----------

function sectionPlan(scene: Scene, notes: TimedNote[], beats: number, opts: ScoreOptions, lead: boolean, melody?: string) {
  const plan: MeasureInfo[] = [];
  let roadmap: string[] | null = null;
  const tl = timeline(scene);
  if (!tl.segments.length) {
    const n = opts.bars ?? 8;
    const voices = opts.chordVoices ?? harmonyVoices(notes, beats);
    const cb = chordBars(notes, voices, n, beats);
    const fifths = keyFifths(scene.key).fifths;
    for (let b = 0; b < n; b++) plan.push({ bar: b, fifths, chords: cb[b], tempo: b === 0 ? scene.tempo : undefined });
    if (lead && opts.bars === undefined) { plan[0].repeatStart = true; plan[n - 1].repeatEnd = true; plan[n - 1].times = 2; }
    else plan[n - 1].end = "final";
    return { plan, roadmap, key: scene.key, tempo: scene.tempo };
  }
  const plays = tl.segments.map(seg => {
    const mine = notes.filter(n => n.bar >= seg.startBar - 1e-9 && n.bar < seg.startBar + seg.bars - 1e-9).map(n => ({ ...n, bar: n.bar - seg.startBar }));
    const voices = opts.chordVoices ?? harmonyVoices(mine, beats);
    const cb = chordBars(mine, voices, seg.bars, beats);
    const mel = melody ? mine.filter(n => n.voice === melody).map(n => `${n.bar.toFixed(4)}:${n.bars.toFixed(4)}:${n.semi}`).join(",") : "";
    return { seg, cb, sig: JSON.stringify(cb) + "|" + mel };
  });
  const order: string[] = [];
  const printed = new Map<string, { label: string; sig: string }[]>();
  let lastKey = "", lastTempo = -1;
  for (let i = 0; i < plays.length; i++) {
    const { seg, cb, sig } = plays[i];
    const name = seg.section.name;
    let times = 1;
    if (lead) while (i + times < plays.length && plays[i + times].seg.section.name === name && plays[i + times].sig === sig) times++;
    const seen = printed.get(name) ?? [];
    const hit = lead ? seen.find(x => x.sig === sig) : undefined;
    if (!hit) {
      const label = lead && seen.length ? `${name} ${seen.length + 1}` : name;
      seen.push({ label, sig }); printed.set(name, seen);
      const fifths = keyFifths(seg.key).fifths, keyS = seg.key.toString();
      for (let b = 0; b < seg.bars; b++) {
        const m: MeasureInfo = { bar: seg.startBar + b, fifths, chords: cb[b] };
        if (b === 0) {
          m.mark = label;
          if (seg.tempo !== lastTempo) m.tempo = seg.tempo;
          if (lastKey && keyS !== lastKey) m.keyText = keyLabel(seg.key);
          if (times > 1) m.repeatStart = true;
        }
        if (b === seg.bars - 1) { if (times > 1) { m.repeatEnd = true; m.times = times; } else m.end = "double"; }
        plan.push(m);
      }
      lastKey = keyS; lastTempo = seg.tempo;
      for (let k = 0; k < times; k++) order.push(label);
    } else for (let k = 0; k < times; k++) order.push(hit.label);
    i += times - 1;
  }
  if (plan.length && !plan[plan.length - 1].repeatEnd) plan[plan.length - 1].end = "final";
  const collapsed = order.filter((x, i) => i === 0 || order[i - 1] !== x);
  if (new Set(collapsed).size !== collapsed.length) roadmap = order;
  return { plan, roadmap: lead ? roadmap : null, key: tl.segments[0].key, tempo: tl.segments[0].tempo };
}

// A lead sheet's melody is one line: the top note at each moment, each held
// until the next begins.
function skyline(notes: TimedNote[]): TimedNote[] {
  const byStart = new Map<number, TimedNote>();
  for (const n of notes) { const k = Math.round(n.bar * 1e6); const o = byStart.get(k); if (!o || n.semi > o.semi) byStart.set(k, n); }
  const out = [...byStart.values()].sort((a, b) => a.bar - b.bar).map(n => ({ ...n }));
  for (let i = 0; i + 1 < out.length; i++) if (out[i].bar + out[i].bars > out[i + 1].bar) out[i].bars = out[i + 1].bar - out[i].bar;
  return out;
}

export function buildScore(scene: Scene, title: string, kind: "lead" | "score", opts: ScoreOptions = {}): Score {
  const lead = kind === "lead";
  const beats = scene.meter[0];
  const r = renderNotes(scene, timeline(scene).segments.length ? undefined : opts.bars ?? 8);
  // a strummed chord is written as the chord: each note back where the strum began
  const notes = r.notes.filter(pitched).map(asWritten).map(n => n.params.strum === undefined ? n : { ...n, bar: n.bar - num(n.params.strum), bars: n.bars + num(n.params.strum) });
  const harmony = opts.chordVoices ?? harmonyVoices(r.notes.filter(n => n.params.ccOut === undefined), beats);
  const melody = lead ? opts.melody ?? guessMelody(notes, harmony) : undefined;
  // chord symbols read what sounds, echoes included, as the chord chart does
  const { plan, roadmap, key, tempo } = sectionPlan(scene, r.notes.filter(n => n.params.ccOut === undefined), beats, opts, lead, melody);
  if (!lead && opts.chords === false) for (const m of plan) delete m.chords;
  const qpb = new R(scene.meter[0] * 4, scene.meter[1]);
  const div = divisions(notes, qpb);
  const tick = (bar: number) => Math.round(R.approx(bar, 10_000).mul(qpb).toNumber() * div);
  const M = tick(1);
  let voices: string[];
  if (lead) voices = melody ? [melody] : [];
  else voices = opts.voices ?? [...new Set(notes.map(n => n.voice))];
  const parts = voices.map(v => buildPart(v, lead ? skyline(notes.filter(n => n.voice === v)) : notes.filter(n => n.voice === v), plan, div, M, scene.meter, tick));
  return { title, subtitle: lead ? (melody ? undefined : "no melody found") : undefined, meter: scene.meter, div, M, tempo, key, parts, measures: plan, roadmap, lead };
}

// ---------- drawing ----------

export interface ScoreDrawOptions { paper?: Paper; style?: SymbolStyle; perLine?: number; staffSpace?: number }

class Ink {
  used = new Set<string>();
  constructor(public sp: number) {}
  g(name: string, x: number, y: number, scale = 1) {
    this.used.add(name);
    return `<use href="#tg-${name}" transform="translate(${fmt(x)} ${fmt(y)}) scale(${(this.sp * scale / 250).toFixed(5)})"/>`;
  }
  w(name: string, scale = 1) { return (GLYPHS[name].w / 250) * this.sp * scale; }
  defs() { return `<defs>${[...this.used].map(n => `<path id="tg-${n}" d="${GLYPHS[n].d}"/>`).join("")}</defs>`; }
}

const INK = "#111", SOFT = "#555";

interface Col { t: number; left: number; need: number }
interface MLayout { cols: Col[]; lead: number; tail: number; pre: number; min: number }

export function scorePages(score: Score, opts: ScoreDrawOptions = {}): string[] {
  const paper = opts.paper ?? "letter", style = opts.style ?? "plain";
  const P = PAPER[paper], MARGIN = 54, W = P.w - 2 * MARGIN;
  const nparts = Math.max(1, score.parts.length);
  const sp = opts.staffSpace ?? (score.lead ? 6.2 : nparts <= 2 ? 6.5 : nparts <= 4 ? 5.6 : 4.8);
  const ink = new Ink(sp);
  const LW = 0.13 * sp, STEM = 0.12 * sp;
  const y = (pos: number) => 4 * sp - pos * sp / 2;
  const meas = score.measures, M = score.M, div = score.div, beats = score.meter[0];
  const chordScale = (2.25 * sp) / 21;

  // ----- horizontal spacing -----
  const layouts: MLayout[] = meas.map((info, i) => {
    const ticks = new Set<number>();
    for (const p of score.parts) for (const ev of p.measures[i].evs) if (!ev.whole) ticks.add(ev.t);
    if (info.chords) for (const c of info.chords.chords) ticks.add(Math.round(c.beat * M / beats));
    if (!ticks.size) ticks.add(0);
    const ts = [...ticks].sort((a, b) => a - b);
    const cols: Col[] = ts.map((t, k) => {
      const gap = (k + 1 < ts.length ? ts[k + 1] : M) - t;
      let left = 0, right = 1.25 * sp;
      for (const p of score.parts) for (const ev of p.measures[i].evs) if (ev.t === t && !ev.whole) {
        const accs = ev.heads.filter(h => h.acc).length;
        left = Math.max(left, accs ? Math.min(accs, 3) * 1.05 * sp + 0.2 * sp : 0);
        const seconds = ev.heads.some((h, j) => j > 0 && h.pos - ev.heads[j - 1].pos === 1);
        right = Math.max(right, (seconds ? 2.4 : 1.25) * sp + ev.dots * 0.55 * sp);
      }
      const space = sp * Math.max(1.4, 3.0 * Math.pow(gap / div, 0.6));
      return { t, left, need: Math.max(space, right + 0.3 * sp) };
    });
    let pre = 0;
    if (info.repeatStart) pre += 1.3 * sp;
    if (info.keyText) pre += (Math.abs(info.fifths) + 1) * 1.05 * sp;
    const lead = 1.2 * sp, tail = (info.repeatEnd ? 1.4 : 0.6) * sp;
    let min = pre + lead + tail + cols.reduce((a, c) => a + c.left + c.need, 0);
    if (info.chords && info.chords.chords.length) {
      const sym = info.chords.chords.reduce((a, c) => a + symbolWidth(c, chordSpelling(info.fifths), style, chordScale) + sp, 0);
      min = Math.max(min, pre + lead + sym + tail);
    }
    const anyRest = score.parts.some(p => p.measures[i].evs.every(e => e.whole));
    if (anyRest) min = Math.max(min, 6 * sp);
    return { cols, lead, tail, pre, min };
  });

  // ----- line breaks -----
  const names = !score.lead && score.parts.length > 1;
  const nameW = names ? Math.max(...score.parts.map(p => textWidth(p.name, 10))) + 10 : 0;
  const header = (first: boolean, fifths: number) => {
    let w = 0.6 * sp + 3.4 * sp + Math.abs(fifths) * 1.05 * sp + 0.6 * sp;
    if (first) w += timeSigWidth() + 1 * sp + nameW;
    return w;
  };
  function timeSigWidth() { return Math.max(digitsWidth(score.meter[0]), digitsWidth(score.meter[1])); }
  function digitsWidth(n: number) { return String(n).split("").reduce((a, d) => a + ink.w(`timeSig${d}`), 0); }
  const perLine = opts.perLine ?? (score.lead ? 4 : 0);
  const systems: number[][] = [];
  let cur: number[] = [], curW = 0;
  meas.forEach((m, i) => {
    const first = systems.length === 0;
    const avail = W - header(first, (cur.length ? meas[cur[0]] : m).fifths);
    const forced = cur.length > 0 && ((score.lead && m.mark !== undefined) || (perLine > 0 && cur.length >= perLine));
    if (cur.length && (forced || curW + layouts[i].min > avail)) { systems.push(cur); cur = []; curW = 0; }
    cur.push(i); curW += layouts[i].min;
  });
  if (cur.length) systems.push(cur);

  // ----- draw -----
  const pages: string[] = [];
  let body = "", yCur = 0, pageNo = 0;
  const startPage = () => {
    pageNo++;
    if (pageNo === 1) {
      body += `<text x="${P.w / 2}" y="${MARGIN + 20}" font-size="24" text-anchor="middle" fill="${INK}">${esc(score.title)}</text>`;
      let yy = MARGIN + 40;
      if (score.subtitle) { body += `<text x="${P.w / 2}" y="${yy}" font-size="11" font-style="italic" text-anchor="middle" fill="${SOFT}">${esc(score.subtitle)}</text>`; yy += 14; }
      if (score.roadmap) { body += `<text x="${P.w / 2}" y="${yy}" font-size="11" font-style="italic" text-anchor="middle" fill="${SOFT}">Form: ${esc(score.roadmap.join(" · "))}</text>`; yy += 14; }
      body += `<text x="${MARGIN}" y="${yy + 4}" font-size="10.5" fill="${SOFT}">${esc(keyLabel(score.key))}</text>`;
      yCur = yy + 24;
    } else {
      body += `<text x="${MARGIN}" y="${MARGIN - 10}" font-size="10" font-style="italic" fill="${SOFT}">${esc(score.title)}</text>`;
      yCur = MARGIN + 6;
    }
  };
  const endPage = () => { pages.push(body); body = ""; };
  startPage();

  // ties waiting for their second note, per staff
  const pending: Map<string, { x: number; y: number; down: boolean }>[] = score.parts.map(() => new Map());

  systems.forEach((sys, si) => {
    const first = si === 0;
    const fifths0 = meas[sys[0]].fifths;
    const x0 = MARGIN + (first ? nameW : 0);
    const hdr = header(first, fifths0) - (first ? nameW : 0);
    const contentX = x0 + hdr;
    const right = MARGIN + W;
    // justify
    let fixed = 0, flex = 0;
    for (const i of sys) { const L = layouts[i]; fixed += L.pre + L.lead + L.tail + L.cols.reduce((a, c) => a + c.left, 0); flex += L.cols.reduce((a, c) => a + c.need, 0); }
    let target = right - contentX;
    const natural = fixed + flex;
    if (si === systems.length - 1) {
      if (perLine > 0 && sys.length < perLine) target = Math.max(natural, target * sys.length / perLine);
      else if (!score.lead && natural < target * 0.6) target = Math.min(target, natural * 1.25);
    }
    const f = flex > 0 ? Math.max(0.6, (target - fixed) / flex) : 1;
    const mx: { start: number; end: number; colX: Map<number, number>; cols: number[] }[] = [];
    let x = contentX;
    for (const i of sys) {
      const L = layouts[i];
      const start = x;
      let cx = x + L.pre + L.lead;
      const colX = new Map<number, number>(), cols: number[] = [];
      for (const c of L.cols) { cx += c.left; colX.set(c.t, cx); cols.push(c.t); cx += c.need * f; }
      x = cx + L.tail;
      mx.push({ start, end: x, colX, cols });
    }
    const sysEnd = x;
    const xAt = (k: number, t: number) => {
      const m = mx[k];
      if (m.colX.has(t)) return m.colX.get(t)!;
      let lo = m.cols[0], hi = M;
      for (const c of m.cols) { if (c <= t) lo = c; if (c > t) { hi = c; break; } }
      const xl = m.colX.get(lo)!, xh = hi === M ? m.end - 1 * sp : m.colX.get(hi)!;
      return xl + (xh - xl) * (t - lo) / Math.max(1, hi - lo);
    };

    // each staff, drawn with its top line at 0
    const staves = score.parts.map((part, pi) => {
      let out = "", top = 0, bot = 4 * sp;
      const ext = (a: number, b = a) => { top = Math.min(top, a, b); bot = Math.max(bot, a, b); };
      // staff lines
      for (let l = 0; l < 5; l++) out += `<line x1="${fmt(x0)}" y1="${fmt(l * sp)}" x2="${fmt(sysEnd)}" y2="${fmt(l * sp)}" stroke="${INK}" stroke-width="${fmt(LW)}"/>`;
      // clef, key, time
      let hx = x0 + 0.6 * sp;
      if (part.clef === "treble") out += ink.g("gClef", hx, y(2));
      else if (part.clef === "bass") out += ink.g("fClef", hx, y(6));
      else out += ink.g("unpitchedPercussionClef1", hx + 0.5 * sp, y(4));
      ext(y(2) - 4.4 * sp, y(2) + 2.7 * sp);
      hx += 3.4 * sp;
      if (!part.drums) { out += keySig(fifths0, part.clef, hx); }
      hx += Math.abs(fifths0) * 1.05 * sp + 0.6 * sp;
      if (first) {
        out += timeSig(hx);
        if (names) out += `<text x="${fmt(MARGIN + nameW - 8)}" y="${fmt(y(4) + 3.5)}" font-size="10" text-anchor="end" fill="${INK}">${esc(part.name)}</text>`;
      }
      // measures
      sys.forEach((i, k) => {
        const info = meas[i], pm = part.measures[i], m = mx[k];
        let pre = m.start;
        if (info.repeatStart) pre += 1.3 * sp;
        if (info.keyText && !part.drums) out += keySig(info.fifths, part.clef, pre + 0.4 * sp, fifthsBefore(i));
        // stems and beams per layer
        const multi = pm.layers > 1;
        for (let L = 0; L < pm.layers; L++) {
          const evs = pm.evs.filter(e => e.layer === L).sort((a, b) => a.t - b.t);
          if (evs.length === 1 && evs[0].whole) {
            const gx = (m.start + m.end) / 2 - ink.w("restWhole") / 2;
            const pos = multi ? (L === 0 ? 8 : 4) : 6;
            out += ink.g("restWhole", gx, y(pos)); continue;
          }
          const G = beamGroupLen();
          const groups: Ev[][] = [];
          let g: Ev[] = [];
          const tupKey = (e: Ev) => (e.tuplet ? e.tuplet.join(":") : "");
          for (const e of evs) {
            const beamable = !e.rest && LEVEL[e.type] >= 1;
            if (beamable && g.length && Math.floor(g[0].t / G) === Math.floor(e.t / G) && tupKey(g[0]) === tupKey(e)) g.push(e);
            else { if (g.length) groups.push(g); g = beamable ? [e] : []; if (!beamable && !e.rest) groups.push([e]); }
          }
          if (g.length) groups.push(g);
          for (const grp of groups) {
            const down = part.drums ? (multi && L > 0) : multi ? L > 0 : (() => {
              const ps = grp.flatMap(e => e.heads.map(h => h.pos));
              return Math.max(...ps) - 4 >= 4 - Math.min(...ps);
            })();
            out += drawGroup(grp, down, (t: number) => xAt(k, t), pi, ext);
          }
          for (const e of evs) if (e.rest) out += drawRest(e, xAt(k, e.t), multi ? (L === 0 ? 2 : -2) : 0, ext);
          out += tuplets(evs, (t: number) => xAt(k, t), multi && L > 0, ext);
        }
      });
      // ties that run past the end of the line
      for (const [key, p] of pending[pi]) {
        out += tie(p.x, sysEnd - 0.4 * sp, p.y, p.down);
        pending[pi].set(key, { ...p, x: contentX - 1.2 * sp });
      }
      return { out, top, bot, part };
    });

    function fifthsBefore(i: number) { return i > 0 ? meas[i - 1].fifths : 0; }
    function beamGroupLen() { return score.meter[1] === 8 && score.meter[0] % 3 === 0 ? (div / 2) * 3 : score.meter[1] === 2 ? div * 2 : div; }

    function keySig(fifths: number, clef: Clef, x: number, _prev = 0) {
      const sharps = [8, 5, 9, 6, 3, 7, 4], flats = [4, 7, 3, 6, 2, 5, 1];
      const shift = clef === "bass" ? -2 : 0;
      let s = "";
      const n = Math.abs(fifths);
      for (let k = 0; k < n; k++) s += ink.g(fifths > 0 ? "accidentalSharp" : "accidentalFlat", x + k * 1.05 * sp, y((fifths > 0 ? sharps : flats)[k] + shift));
      return s;
    }
    function timeSig(x: number) {
      const w = timeSigWidth();
      const row = (n: number, pos: number) => {
        const ds = String(n).split(""), dw = digitsWidth(n);
        let xx = x + (w - dw) / 2, s = "";
        for (const d of ds) { s += ink.g(`timeSig${d}`, xx, y(pos)); xx += ink.w(`timeSig${d}`); }
        return s;
      };
      return row(score.meter[0], 6) + row(score.meter[1], 2);
    }

    function drawRest(e: Ev, x: number, shift: number, ext: (a: number, b?: number) => void) {
      const name = REST[e.type] ?? "restQuarter";
      const pos = (e.type === "whole" ? 6 : 4) + shift;
      let s = ink.g(name, x, y(pos));
      const b = GLYPHS[name].b;
      ext(y(pos) + (b[1] / 250) * sp, y(pos) + (b[3] / 250) * sp);
      for (let d = 0; d < e.dots; d++) s += ink.g("augmentationDot", x + ink.w(name) + (0.35 + d * 0.5) * sp, y(5 + shift));
      return s;
    }

    function drawGroup(grp: Ev[], down: boolean, X: (t: number) => number, pi: number, ext: (a: number, b?: number) => void) {
      let s = "";
      const part = score.parts[pi];
      const geo = grp.map(e => {
        const head = e.type === "whole" ? "noteheadWhole" : e.type === "half" ? "noteheadHalf" : "noteheadBlack";
        const hw = ink.w(head);
        const x = X(e.t);
        const stemX = down ? x + STEM / 2 : x + hw - STEM / 2;
        const lo = Math.min(...e.heads.map(h => h.pos)), hi = Math.max(...e.heads.map(h => h.pos));
        return { e, head, hw, x, stemX, lo, hi };
      });
      // stems: free tips, or on a beam
      const tips = geo.map(g => {
        let tip = down ? y(g.lo) + 3.5 * sp : y(g.hi) - 3.5 * sp;
        if (!down && tip > y(4)) tip = y(4);
        if (down && tip < y(4)) tip = y(4);
        return tip;
      });
      const beamed = grp.length > 1;
      if (beamed) {
        const a = geo[0], b = geo[geo.length - 1];
        let slope = (tips[tips.length - 1] - tips[0]) / Math.max(1, b.stemX - a.stemX);
        const rise = Math.max(-sp, Math.min(sp, slope * (b.stemX - a.stemX)));
        slope = rise / Math.max(1, b.stemX - a.stemX);
        const levels = Math.max(...grp.map(e => LEVEL[e.type]));
        const minStem = 2.6 * sp + (levels - 1) * 0.75 * sp;
        let base = tips[0];
        const at = (xx: number) => base + slope * (xx - a.stemX);
        let shift = 0;
        geo.forEach(g => {
          const need = down ? Math.max(y(g.lo) + minStem, y(4)) : Math.min(y(g.hi) - minStem, y(4));
          const d = down ? need - at(g.stemX) : at(g.stemX) - need;
          if (d > shift) shift = d;
        });
        base += down ? shift : -shift;
        geo.forEach((g, k) => { tips[k] = at(g.stemX); });
        // beams
        const th = 0.5 * sp, gap = 0.75 * sp;
        const beam = (x1: number, x2: number, level: number) => {
          const off = (level - 1) * gap * (down ? -1 : 1);
          const y1 = at(x1) + off, y2 = at(x2) + off, t = down ? -th : th;
          ext(y1, y1 + t); ext(y2, y2 + t);
          return `<polygon points="${fmt(x1)},${fmt(y1)} ${fmt(x2)},${fmt(y2)} ${fmt(x2)},${fmt(y2 + t)} ${fmt(x1)},${fmt(y1 + t)}" fill="${INK}"/>`;
        };
        s += beam(a.stemX - STEM / 2, b.stemX + STEM / 2, 1);
        for (let L = 2; L <= levels; L++) {
          let k = 0;
          while (k < geo.length) {
            if (LEVEL[geo[k].e.type] < L) { k++; continue; }
            let j = k;
            while (j + 1 < geo.length && LEVEL[geo[j + 1].e.type] >= L) j++;
            if (j > k) s += beam(geo[k].stemX - STEM / 2, geo[j].stemX + STEM / 2, L);
            else {
              const toLeft = k === geo.length - 1 && k > 0;
              const x1 = geo[k].stemX + (toLeft ? -1.1 * sp : 0), x2 = geo[k].stemX + (toLeft ? 0 : 1.1 * sp);
              s += beam(x1 - (toLeft ? 0 : STEM / 2), x2 + (toLeft ? STEM / 2 : 0), L);
            }
            k = j + 1;
          }
        }
      }
      geo.forEach((g, k) => {
        const e = g.e;
        // noteheads, with seconds on the other side of the stem
        const flipped = new Set<Head>();
        const order = down ? [...e.heads].reverse() : e.heads;
        let prev: Head | undefined;
        for (const h of order) { if (prev && Math.abs(h.pos - prev.pos) === 1 && !flipped.has(prev)) flipped.add(h); prev = h; }
        const hx = (h: Head) => flipped.has(h) ? (down ? g.x - g.hw + STEM : g.x + g.hw - STEM) : g.x;
        // ledger lines
        const lx0 = Math.min(...e.heads.map(hx)) - 0.35 * sp, lx1 = Math.max(...e.heads.map(hx)) + g.hw + 0.35 * sp;
        for (let p = 10; p <= g.hi; p += 2) s += `<line x1="${fmt(lx0)}" y1="${fmt(y(p))}" x2="${fmt(lx1)}" y2="${fmt(y(p))}" stroke="${INK}" stroke-width="${fmt(LW * 1.6)}"/>`;
        for (let p = -2; p >= g.lo; p -= 2) s += `<line x1="${fmt(lx0)}" y1="${fmt(y(p))}" x2="${fmt(lx1)}" y2="${fmt(y(p))}" stroke="${INK}" stroke-width="${fmt(LW * 1.6)}"/>`;
        for (const h of e.heads) { s += ink.g(h.cross ? (e.type === "half" || e.type === "whole" ? "noteheadXHalf" : "noteheadXBlack") : g.head, hx(h), y(h.pos)); ext(y(h.pos) - sp / 2, y(h.pos) + sp / 2); }
        // accidentals, staggered when they would collide
        const accCols: number[][] = [];
        const leftEdge = Math.min(...e.heads.map(hx));
        for (const h of e.heads) if (h.cents && !h.acc) s += `<text x="${fmt(hx(h) - 0.2 * sp)}" y="${fmt(y(h.pos) - 1.3 * sp)}" font-size="${fmt(1.25 * sp)}" fill="${SOFT}">${h.cents > 0 ? "+" : "−"}${Math.abs(h.cents)}</text>`;
        for (const h of [...e.heads].reverse()) {
          if (!h.acc) continue;
          let c = 0;
          while (accCols[c]?.some(p => Math.abs(p - h.pos) < 6)) c++;
          (accCols[c] ??= []).push(h.pos);
          const ax = leftEdge - 0.2 * sp - (c + 1) * 1.05 * sp + (1.05 * sp - ink.w(h.acc));
          s += ink.g(h.acc, ax, y(h.pos));
          if (h.cents) s += `<text x="${fmt(ax)}" y="${fmt(y(h.pos) - 1.4 * sp)}" font-size="${fmt(1.25 * sp)}" fill="${SOFT}">${h.cents > 0 ? "+" : "−"}${Math.abs(h.cents)}</text>`;
        }
        // dots, in spaces
        if (e.dots) {
          const dx = Math.max(...e.heads.map(hx)) + g.hw + 0.35 * sp;
          for (const p of new Set(e.heads.map(h => (((h.pos % 2) + 2) % 2 === 0 ? h.pos + 1 : h.pos)))) for (let d = 0; d < e.dots; d++) s += ink.g("augmentationDot", dx + d * 0.5 * sp, y(p));
        }
        // stem and flag
        if (e.type !== "whole") {
          const from = down ? y(g.hi) : y(g.lo);
          s += `<line x1="${fmt(g.stemX)}" y1="${fmt(from)}" x2="${fmt(g.stemX)}" y2="${fmt(tips[k])}" stroke="${INK}" stroke-width="${fmt(STEM)}"/>`;
          ext(tips[k]);
          if (!beamed && LEVEL[e.type] >= 1) s += ink.g(`flag${FLAG[Math.min(5, LEVEL[e.type])]}${down ? "Down" : "Up"}`, g.stemX - STEM / 2, tips[k]);
        }
        // ties
        for (const h of e.heads) {
          const key = `${e.layer}:${h.semi}`;
          if (h.tieStop) { const p = pending[pi].get(key); if (p) { s += tie(p.x, hx(h) - 0.15 * sp, p.y, p.down); pending[pi].delete(key); } }
          if (h.tieStart) pending[pi].set(key, { x: hx(h) + g.hw + 0.15 * sp, y: y(h.pos), down: !down });
        }
      });
      void part;
      return s;
    }

    function tie(x1: number, x2: number, yy: number, below: boolean) {
      if (x2 - x1 < 0.5 * sp) x2 = x1 + 0.5 * sp;
      const d = below ? 1 : -1, y0 = yy + d * 0.55 * sp, h = Math.min(1.1 * sp, 0.25 * sp + (x2 - x1) * 0.08) * d;
      const mx = (x1 + x2) / 2;
      return `<path d="M${fmt(x1)} ${fmt(y0)} Q${fmt(mx)} ${fmt(y0 + h * 1.35)} ${fmt(x2)} ${fmt(y0)} Q${fmt(mx)} ${fmt(y0 + h * 1.0)} ${fmt(x1)} ${fmt(y0)}Z" fill="${INK}"/>`;
    }

    function tuplets(evs: Ev[], X: (t: number) => number, below: boolean, ext: (a: number, b?: number) => void) {
      let s = "", k = 0;
      while (k < evs.length) {
        const e = evs[k];
        if (!e.tuplet) { k++; continue; }
        const [actual, normal] = e.tuplet;
        const span = e.len * actual; // the group: `actual` notes of this value
        let j = k, acc = 0;
        while (j < evs.length && evs[j].tuplet && evs[j].tuplet!.join() === e.tuplet.join() && acc < span) { acc += evs[j].len; j++; }
        const x1 = X(e.t) - 0.2 * sp, x2 = X(evs[j - 1].t) + 1.4 * sp, mid = (x1 + x2) / 2;
        const yy = below ? 6.6 * sp : -2.2 * sp;
        const digits = String(actual).split(""), dw = digits.reduce((a, d) => a + ink.w(`tuplet${d}`, 0.8), 0);
        let dx = mid - dw / 2;
        for (const d of digits) { s += ink.g(`tuplet${d}`, dx, yy + 0.5 * sp, 0.8); dx += ink.w(`tuplet${d}`, 0.8); }
        const h = below ? -0.5 * sp : 0.5 * sp;
        s += `<path d="M${fmt(x1)} ${fmt(yy + h)} V${fmt(yy)} H${fmt(mid - dw / 2 - 0.3 * sp)} M${fmt(mid + dw / 2 + 0.3 * sp)} ${fmt(yy)} H${fmt(x2)} V${fmt(yy + h)}" fill="none" stroke="${INK}" stroke-width="${fmt(LW)}"/>`;
        ext(yy - sp, yy + sp);
        k = Math.max(j, k + 1);
      }
      return s;
    }

    // things above the top staff: chord symbols, section marks, tempo, measure numbers
    let above = "";
    const top0 = staves.length ? staves[0].top : 0;
    const anyChords = sys.some(i => meas[i].chords && (meas[i].chords!.chords.length || meas[i].chords!.nc));
    const chordY = Math.min(-1.8 * sp, top0 - 0.7 * sp);
    let aboveTop = top0;
    if (anyChords) {
      sys.forEach((i, k) => {
        const cb = meas[i].chords!;
        if (!cb) return;
        const flats = chordSpelling(meas[i].fifths);
        if (cb.nc) { above += `<text x="${fmt(mx[k].start + 1.2 * sp)}" y="${fmt(chordY)}" font-size="${fmt(1.9 * sp)}" font-style="italic" fill="${INK}">N.C.</text>`; return; }
        const prevBar = k > 0 ? meas[sys[k - 1]].chords : i > 0 ? meas[i - 1].chords : undefined;
        cb.chords.forEach((c, ci) => {
          // a bar that only continues the last chord does not repeat it
          if (ci === 0 && c.beat === 0 && cb.chords.length === 1 && prevBar && !prevBar.nc && prevBar.chords.length) {
            const pc = prevBar.chords[prevBar.chords.length - 1];
            if (pc.root === c.root && pc.sym === c.sym && pc.bass === c.bass && k > 0) return;
          }
          const t = Math.round(c.beat * M / beats);
          above += chordSymbol(c, xAt(k, t), chordY, flats, style, chordScale);
        });
      });
      aboveTop = chordY - 2.2 * sp;
    }
    const markY = aboveTop - 1.0 * sp;
    let marked = false;
    sys.forEach((i, k) => {
      const info = meas[i];
      let mx0 = k === 0 ? x0 : mx[k].start;
      if (info.mark) {
        const w = textWidth(info.mark, 11, true) + 10;
        above += `<rect x="${fmt(mx0)}" y="${fmt(markY - 13)}" width="${fmt(w)}" height="17" fill="none" stroke="${INK}" stroke-width="1.1"/><text x="${fmt(mx0 + 5)}" y="${fmt(markY)}" font-size="11" font-weight="700" fill="${INK}">${esc(info.mark)}</text>`;
        mx0 += w + 8; marked = true;
      }
      if (info.keyText) { above += `<text x="${fmt(mx0)}" y="${fmt(markY)}" font-size="10" font-style="italic" fill="${SOFT}">${esc(info.keyText)}</text>`; mx0 += textWidth(info.keyText, 10) + 10; marked = true; }
      if (info.tempo !== undefined) { above += crotchet(mx0 + 3.4, markY + 1, 1, score.meter[1]) + `<text x="${fmt(mx0 + 10)}" y="${fmt(markY)}" font-size="10.5" fill="${SOFT}">= ${fmt(info.tempo)}</text>`; marked = true; }
      if (info.repeatEnd && (info.times ?? 2) > 2) { above += `<text x="${fmt(mx[k].end)}" y="${fmt(markY)}" font-size="11" font-weight="600" text-anchor="end" fill="${INK}">×${info.times}</text>`; marked = true; }
    });
    if (!first && !marked) above += `<text x="${fmt(x0)}" y="${fmt(Math.min(-1.6 * sp, aboveTop + 0.6 * sp))}" font-size="${fmt(1.2 * sp)}" font-style="italic" fill="${SOFT}">${meas[sys[0]].bar + 1}</text>`;
    const sysTop = marked ? markY - 14 : aboveTop;

    // stack the staves
    const gapStaff = 2.2 * sp;
    const ys: number[] = [];
    let yy = 0;
    staves.forEach((st, k) => {
      if (k === 0) yy = 0;
      else yy = Math.max(ys[k - 1] + 4 * sp + 5 * sp, ys[k - 1] + staves[k - 1].bot - st.top + gapStaff);
      ys.push(yy);
    });
    const lastBot = staves.length ? ys[ys.length - 1] + staves[staves.length - 1].bot : 4 * sp;
    const height = lastBot - sysTop;
    if (yCur + height > P.h - MARGIN && body && yCur > MARGIN + 40) { endPage(); startPage(); }
    const oy = yCur - sysTop;
    let sv = `<g transform="translate(0 ${fmt(oy)})">${above}`;
    staves.forEach((st, k) => { sv += `<g transform="translate(0 ${fmt(ys[k])})">${st.out}</g>`; });
    // bar lines through all staves of the system
    const yTop = 0, yBot = (ys[ys.length - 1] ?? 0) + 4 * sp;
    const thin = (xx: number) => `<line x1="${fmt(xx)}" y1="${fmt(yTop)}" x2="${fmt(xx)}" y2="${fmt(yBot)}" stroke="${INK}" stroke-width="${fmt(0.16 * sp)}"/>`;
    const thick = (xx: number) => `<line x1="${fmt(xx)}" y1="${fmt(yTop)}" x2="${fmt(xx)}" y2="${fmt(yBot)}" stroke="${INK}" stroke-width="${fmt(0.5 * sp)}"/>`;
    const dots = (xx: number) => ys.map(sy => ink.g("repeatDot", xx, sy + y(5)) + ink.g("repeatDot", xx, sy + y(3))).join("");
    if (staves.length > 1) sv += thin(x0) + `<line x1="${fmt(x0 - 0.6 * sp)}" y1="${fmt(yTop)}" x2="${fmt(x0 - 0.6 * sp)}" y2="${fmt(yBot)}" stroke="${INK}" stroke-width="${fmt(0.45 * sp)}"/>`;
    else sv += thin(x0);
    sys.forEach((i, k) => {
      const info = meas[i], m = mx[k];
      if (info.repeatStart) sv += thick(m.start + 0.25 * sp) + thin(m.start + 0.85 * sp) + dots(m.start + 1.15 * sp);
      const e = m.end;
      if (info.repeatEnd) sv += dots(e - 1.45 * sp) + thin(e - 0.95 * sp) + thick(e - 0.25 * sp);
      else if (info.end === "final") sv += thin(e - 0.95 * sp) + thick(e - 0.25 * sp);
      else if (info.end === "double") sv += thin(e - 0.5 * sp) + thin(e);
      else sv += thin(e);
    });
    sv += `</g>`;
    body += sv;
    yCur += height + (score.lead ? 3.2 * sp : 4.5 * sp);
  });
  if (!systems.length) body += `<text x="${P.w / 2}" y="${yCur + 20}" font-size="12" font-style="italic" text-anchor="middle" fill="${SOFT}">Nothing to show.</text>`;
  endPage();
  return pages.map((b, i) => svgPage(paper, ink.defs() + b + (pages.length > 1 ? `<text x="${P.w / 2}" y="${P.h - 28}" font-size="9" text-anchor="middle" fill="${SOFT}">${i + 1} / ${pages.length}</text>` : "")));
}

export function scoreHtml(score: Score, opts: ScoreDrawOptions = {}): string {
  return htmlDocument(`${score.title}: ${score.lead ? "lead sheet" : "score"}`, scorePages(score, opts), opts.paper ?? "letter");
}

