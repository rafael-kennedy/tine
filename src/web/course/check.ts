// Helpers for checking challenge answers by what they play, not how they are written.
import type { TimedNote } from "../../core";
import { parseQuality, nameOf } from "../../core/harmony";

export const r3 = (x: number) => Math.round(x * 1000) / 1000;
export const pc = (s: number) => ((Math.round(s) % 12) + 12) % 12;
export const pcset = (ss: number[]) => [...new Set(ss.map(pc))].sort((a, b) => a - b);
export const sameSet = (a: number[], b: number[]) => JSON.stringify(pcset(a)) === JSON.stringify(pcset(b));
const NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
export const nm = (s: number) => NAMES[pc(s)];
export const nms = (ss: number[]) => ss.map(nm).join(" ");

export const of = (n: TimedNote[], v: string) => n.filter(x => x.voice === v);
export const inBar = (n: TimedNote[], b: number) => n.filter(x => x.bar >= b - 1e-9 && x.bar < b + 1 - 1e-9);

// Notes grouped by onset: each group is a chord (or a single note).
export function groups(n: TimedNote[]): { t: number; semis: number[] }[] {
  const m = new Map<number, number[]>();
  for (const x of n) { const k = r3(x.bar); m.set(k, [...(m.get(k) ?? []), x.semi]); }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([t, s]) => ({ t, semis: s.sort((a, b) => a - b) }));
}

// The pitch classes of a chord symbol on a root: chordPcs(2, "m7") is D F A C.
export function chordPcs(root: number, sym: string): number[] {
  const q = parseQuality(sym);
  if (!q) throw new Error(`bad symbol ${sym}`);
  return pcset(q.map(o => root + o));
}
export const isChord = (semis: number[], root: number, sym: string) => sameSet(semis, chordPcs(root, sym));
export const named = (semis: number[]) => nameOf(semis);

// A voice must exist and play something.
export function need(n: TimedNote[], v: string): string | null {
  return of(n, v).length ? null : `There is no voice named ${v} playing yet.`;
}

// Compare a sequence of chords (by pitch-class set) with what a voice plays, in order.
export function expectChords(n: TimedNote[], v: string, want: [number, string][]): string | null {
  const miss = need(n, v); if (miss) return miss;
  const g = groups(of(n, v)).filter(x => x.semis.length >= 2);
  for (let i = 0; i < want.length; i++) {
    const [root, sym] = want[i];
    if (!g[i]) return `I hear ${g.length} chord${g.length === 1 ? "" : "s"}; I expected ${want.length}.`;
    if (!isChord(g[i].semis, root, sym)) return `Chord ${i + 1} is ${named(g[i].semis)} (${nms(g[i].semis)}); it should be ${NAMES[pc(root)]}${sym}.`;
  }
  return null;
}

// A melody's pitches in order (single notes only).
export const line = (n: TimedNote[], v: string) => of(n, v).sort((a, b) => a.bar - b.bar).map(x => x.semi);

// Diatonic chord on a degree (1-based) of a scale: its pitch classes.
export const MAJOR = [0, 2, 4, 5, 7, 9, 11];
export function diatonic(tonic: number, deg: number, size = 3, steps = MAJOR): number[] {
  const out: number[] = [];
  for (let k = 0; k < size; k++) { const i = deg - 1 + 2 * k; out.push(tonic + steps[i % 7] + 12 * Math.floor(i / 7)); }
  return pcset(out);
}
// Does this chord match a diatonic triad or seventh on one of the degrees?
export function onDegree(semis: number[], tonic: number, degs: number[], steps = MAJOR): number | null {
  for (const d of degs) for (const size of [3, 4]) if (JSON.stringify(pcset(semis)) === JSON.stringify(diatonic(tonic, d, size, steps))) return d;
  return null;
}
// The first chord (2+ notes) that starts in each bar.
export function barChords(n: TimedNote[], v: string, bars: number): (number[] | null)[] {
  return Array.from({ length: bars }, (_, b) => groups(inBar(of(n, v), b)).find(g => g.semis.length >= 2)?.semis ?? null);
}
// Total movement between two chords with the same number of notes.
export const movement = (a: number[], b: number[]) => a.length === b.length ? a.reduce((t, x, i) => t + Math.abs(x - b[i]), 0) : Infinity;
