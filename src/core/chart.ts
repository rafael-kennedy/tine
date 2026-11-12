// Chord charts: what a piece's harmony looks like as a lead-sheet grid of
// bars, with section marks, repeats and a road map. This file only analyses;
// chartsvg.ts draws the result.
//
// Harmony is read beat by beat. Voices whose notes came from chord symbols
// (changes(), ^1@7, c@maj7) carry their root, and when any exist only they
// count, so a melody's passing notes never rename a chord. Otherwise a voice
// counts as harmony if it often sounds three or more notes at once.
import { Scene } from "./interp";
import { TimedNote, renderNotes, timeline } from "./scene";
import { identify } from "./harmony";
import { keyFifths, Key } from "./pitch";
import { spell } from "./musicxml";

const mod12 = (x: number) => ((Math.round(x) % 12) + 12) % 12;

export interface ChartChord {
  beat: number;              // 0-based beat in the bar
  root: number;              // pitch class
  sym: string;               // quality, as harmony.ts names it ("m7", "7b9", "")
  bass?: number;             // pitch class, when it is a slash chord
}
export type ChartBar = { chords: ChartChord[]; nc: boolean };
export interface ChartSection {
  name: string | null;       // null for a piece without sections
  bars: ChartBar[];
  times: number;             // consecutive repeats (repeat signs)
  key: Key;
  tempo: number;
  keyChanged: boolean;
  tempoChanged: boolean;
  empty?: boolean;           // no chords anywhere in it
}
export interface Chart {
  title: string;
  meter: [number, number];
  tempo: number;
  key: Key;
  flats: boolean | undefined;  // chord spelling: see rootName
  sections: ChartSection[];
  roadmap: string[] | null;  // section labels in play order, when the chart prints a section once for several plays
  loop: boolean;             // a piece without form: the chart is its loop
  voices: string[];          // the voices read as harmony
}

export interface ChartOptions {
  bars?: number;             // for pieces without form: how many bars (default: the loop's own length, up to 16)
  voices?: string[];         // read harmony from these voices only
}

const pitchedNote = (n: TimedNote) => n.params.ccOut === undefined && n.params.inst !== "kit" && !n.params.hit && n.params.drum === undefined;

// Voices that carry the harmony.
export function harmonyVoices(notes: TimedNote[], beats: number): string[] {
  const pitched = notes.filter(pitchedNote);
  const hinted = [...new Set(pitched.filter(n => n.params.chordRoot !== undefined).map(n => n.voice))];
  if (hinted.length) return hinted;
  const out: string[] = [];
  for (const v of new Set(pitched.map(n => n.voice))) {
    const mine = pitched.filter(n => n.voice === v);
    const bars = new Set(mine.map(n => Math.floor(n.bar + 1e-9)));
    let full = 0;
    for (const b of bars) {
      // three pitch classes sounding at once somewhere in the bar (strums count: they overlap)
      let hit = false;
      for (let k = 0; k < beats && !hit; k++) {
        const t = b + (k + 0.5) / beats;
        const pcs = new Set(mine.filter(n => n.bar <= t && n.bar + n.bars > t).map(n => mod12(n.semi)));
        if (pcs.size >= 3) hit = true;
      }
      if (hit) full++;
    }
    if (full >= Math.max(1, bars.size / 4)) out.push(v);
  }
  return out;
}

interface Slot { semis: number[]; hint?: number; bass?: number; any: boolean }

// One chord (or nothing) per beat, over bars [0, bars).
function beatSlots(notes: TimedNote[], voices: Set<string>, bars: number, beats: number): Slot[] {
  const mine = notes.filter(n => pitchedNote(n) && voices.has(n.voice));
  const slots: Slot[] = [];
  const w = 1 / beats;
  let i = 0;
  const active: TimedNote[] = [];
  const sorted = [...mine].sort((a, b) => a.bar - b.bar);
  for (let s = 0; s < bars * beats; s++) {
    const a = s * w, b = a + w;
    while (i < sorted.length && sorted[i].bar < b - 1e-9) active.push(sorted[i++]);
    for (let k = active.length - 1; k >= 0; k--) if (active[k].bar + active[k].bars <= a + 1e-9) active.splice(k, 1);
    const here = active.filter(n => n.bar < b - 1e-9 && n.bar + n.bars > a + 1e-9);
    // the hint with the most time in the beat wins
    const weight = new Map<number, number>();
    for (const n of here) if (n.params.chordRoot !== undefined) {
      const r = mod12(n.params.chordRoot), ov = Math.min(b, n.bar + n.bars) - Math.max(a, n.bar);
      weight.set(r, (weight.get(r) ?? 0) + ov);
    }
    let hint: number | undefined, best = 0;
    for (const [r, x] of weight) if (x > best) { best = x; hint = r; }
    const use = hint === undefined ? here : here.filter(n => n.params.chordRoot === undefined || mod12(n.params.chordRoot) === hint);
    const bassN = use.find(n => n.params.chordBass !== undefined);
    slots.push({ semis: use.map(n => n.semi), hint, bass: bassN ? mod12(bassN.params.chordBass) : undefined, any: here.length > 0 });
  }
  return slots;
}

function sameChord(a: ChartChord | null, b: ChartChord | null) {
  return !!a && !!b && a.root === b.root && a.sym === b.sym && a.bass === b.bass;
}

// Name each beat, then keep only the changes.
export function chordBars(notes: TimedNote[], voices: string[], bars: number, beats: number): ChartBar[] {
  const slots = beatSlots(notes, new Set(voices), bars, beats);
  const hinted = notes.some(n => n.params.chordRoot !== undefined && voices.includes(n.voice));
  // an arpeggio spreads one chord over several beats: pool beats that share a symbol's root
  const named: (ChartChord | null)[] = new Array(slots.length).fill(null);
  const nameOf = (s: number, e: number): ChartChord | null => {
    const pool = slots.slice(s, e).flatMap(x => x.semis);
    const hint = slots[s].hint;
    if (!pool.length || (hint === undefined && new Set(pool.map(mod12)).size < 3)) return null;
    const id = identify(pool, hint);
    if (!id) return null;
    const low = mod12(Math.min(...pool));
    const bass = hint !== undefined ? slots[s].bass : (low !== id.root && !id.omitted.includes("root") ? low : undefined);
    return { beat: 0, root: id.root, sym: id.sym, bass: bass !== undefined && bass !== id.root ? bass : undefined };
  };
  if (hinted) {
    // a symbol's notes may be spread over several beats (arp): pool beats that share its root
    let s = 0;
    while (s < slots.length) {
      let e = s + 1;
      if (slots[s].hint !== undefined) while (e < slots.length && slots[e].hint === slots[s].hint && slots[e].bass === slots[s].bass && e % beats !== 0) e++;
      const c = nameOf(s, e);
      for (let k = s; k < e; k++) named[k] = c;
      s = e;
    }
  } else {
    // no symbols: the simplest reading wins, one chord for the bar, else one per half, else per beat
    const split = (s: number, e: number) => {
      const c = nameOf(s, e);
      const n = e - s;
      if (c || n === 1) { for (let k = s; k < e; k++) named[k] = c; return; }
      const half = n % 2 === 0 ? n / 2 : n % 3 === 0 ? n / 3 : 1;
      for (let k = s; k < e; k += half) split(k, k + half);
    };
    for (let b = 0; b < bars; b++) split(b * beats, (b + 1) * beats);
  }
  const out: ChartBar[] = [];
  let prev: ChartChord | null = null;
  for (let b = 0; b < bars; b++) {
    const chords: ChartChord[] = [];
    const held = prev;
    let any = false;
    for (let k = 0; k < beats; k++) {
      const c = named[b * beats + k];
      any ||= slots[b * beats + k].any;
      // a chord that cannot be named holds the last one, as a chart would
      if (c && !sameChord(c, prev)) { chords.push({ ...c, beat: k }); prev = c; }
      else if (c && k === 0) chords.push({ ...c, beat: 0 });
    }
    // with chord symbols, silence is N.C.; without, an unnamed bar just continues
    const nc = hinted && !any;
    if (nc) prev = null;
    else if (held && (!chords.length || chords[0].beat !== 0)) chords.unshift({ ...held, beat: 0 });
    out.push({ chords, nc });
  }
  return out;
}

const barKey = (b: ChartBar) => b.nc ? "NC" : b.chords.map(c => `${c.beat}:${c.root}${c.sym}/${c.bass ?? ""}`).join(" ");

export function buildChart(scene: Scene, title: string, opts: ChartOptions = {}): Chart {
  const beats = scene.meter[0];
  const flats = chordSpelling(keyFifths(scene.key).fifths);
  if (scene.form && scene.form.length) {
    const tl = timeline(scene);
    const { notes } = renderNotes(scene);
    // each section picks its own harmony voices: a section without chord symbols is still read
    const used = new Set<string>();
    const plays = tl.segments.map(seg => {
      const mine = notes.filter(n => n.bar >= seg.startBar - 1e-9 && n.bar < seg.startBar + seg.bars - 1e-9)
        .map(n => ({ ...n, bar: n.bar - seg.startBar }));
      const voices = opts.voices ?? harmonyVoices(mine, beats);
      voices.forEach(v => used.add(v));
      return { seg, bars: chordBars(mine, voices, seg.bars, beats) };
    });
    const voices = [...used];
    // identical plays print once
    const printed = new Map<string, { label: string; sig: string }[]>();
    const sections: ChartSection[] = [];
    const order: string[] = [];
    const key0 = tl.segments[0]?.key ?? scene.key, tempo0 = tl.segments[0]?.tempo ?? scene.tempo;
    let lastKey = key0.toString(), lastTempo = tempo0;
    for (let i = 0; i < plays.length; i++) {
      const { seg, bars } = plays[i];
      const sig = bars.map(barKey).join("|");
      const name = seg.section.name;
      const seen = printed.get(name) ?? [];
      let hit = seen.find(x => x.sig === sig);
      // consecutive identical plays become repeat signs
      let times = 1;
      while (i + times < plays.length && plays[i + times].seg.section.name === name && plays[i + times].bars.map(barKey).join("|") === sig) times++;
      if (!hit) {
        const label = seen.length ? `${name} ${seen.length + 1}` : name;
        hit = { label, sig };
        seen.push(hit); printed.set(name, seen);
        const keyS = seg.key.toString();
        sections.push({ name: label, bars, times, key: seg.key, tempo: seg.tempo, keyChanged: keyS !== lastKey, tempoChanged: seg.tempo !== lastTempo, empty: bars.every(b => !b.nc && !b.chords.length) });
      }
      lastKey = seg.key.toString(); lastTempo = seg.tempo;
      for (let k = 0; k < times; k++) order.push(hit.label);
      i += times - 1;
    }
    const once = order.length === sections.reduce((a, s) => a + s.times, 0);
    return { title, meter: scene.meter, tempo: tempo0, key: key0, flats: chordSpelling(keyFifths(key0).fifths), sections, roadmap: once ? null : order, loop: false, voices };
  }
  // a loop: find its period unless told how many bars
  const probe = opts.bars ?? 32;
  const { notes } = renderNotes(scene, probe);
  const voices = opts.voices ?? harmonyVoices(notes, beats);
  const all = chordBars(notes, voices, probe, beats);
  let n = probe;
  if (opts.bars === undefined) {
    const keys = all.map(barKey);
    n = [1, 2, 3, 4, 6, 8, 12, 16].find(p => keys.every((k, i) => k === keys[i % p])) ?? 8;
    // a one-bar loop is clearer written out to four bars
    if (n < 4 && 4 % n === 0) n = 4;
  }
  const bars = all.slice(0, n);
  return {
    title, meter: scene.meter, tempo: scene.tempo, key: scene.key, flats,
    sections: [{ name: null, bars, times: opts.bars === undefined ? 2 : 1, key: scene.key, tempo: scene.tempo, keyChanged: false, tempoChanged: false }],
    roadmap: null, loop: opts.bars === undefined, voices,
  };
}

// ---------- symbol text ----------

export type SymbolStyle = "plain" | "jazz";
const ACC: Record<number, string> = { [-2]: "𝄫", [-1]: "♭", 0: "", 1: "♯", 2: "𝄪" };

// flats: true in flat keys, false in sharp keys, undefined (C major, modes
// without a signature) for the mix chord charts use: D♭ E♭ F♯ A♭ B♭
export const chordSpelling = (fifths: number) => (fifths < 0 ? true : fifths > 0 ? false : undefined);
const MIX = [false, true, false, true, false, false, false, false, true, false, true, false];
export function rootName(pc: number, flats: boolean | undefined): string {
  const s = spell(60 + pc, flats ?? MIX[((pc % 12) + 12) % 12]);
  return s.step + (ACC[Math.round(s.alter)] ?? "");
}

// The quality as a chart prints it: ♭ and ♯ for b and #, and in jazz style the
// Real Book shorthands (–7, Δ7, ø7, °7, +).
export function qualityText(sym: string, style: SymbolStyle = "plain"): string {
  let q = sym;
  if (style === "jazz") {
    q = q.replace(/^m7b5/, "ø7").replace(/^m9b5/, "ø9").replace(/^dim7/, "°7").replace(/^dim/, "°").replace(/^aug/, "+")
      .replace(/^mmaj/, "–Δ").replace(/^maj/, "Δ").replace(/^m(?!aj)/, "–");
  }
  return q.replace(/b(\d)/g, "♭$1").replace(/#(\d)/g, "♯$1");
}

export function chordText(c: ChartChord, flats: boolean | undefined, style: SymbolStyle = "plain") {
  return { root: rootName(c.root, flats), quality: qualityText(c.sym, style), bass: c.bass !== undefined ? rootName(c.bass, flats) : undefined };
}

export function keyLabel(key: Key): string {
  const { fifths, mode } = keyFifths(key);
  if (!mode) return `${rootName(mod12(key.root.semi), false)} ${key.scale.name}`;
  return `${rootName(mod12(key.root.semi), fifths < 0)} ${mode}`;
}
