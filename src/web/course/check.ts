// Helpers for checking challenge answers by what they play, not how they are written.
import type { TimedNote } from "../../core";
import { parseQuality, nameOf } from "../../core/harmony";

export const r3 = (x: number) => Math.round(x * 1000) / 1000;
export const pc = (s: number) => ((Math.round(s) % 12) + 12) % 12;
export const pcset = (ss: number[]) => [...new Set(ss.map(pc))].sort((a, b) => a - b);
export const sameSet = (a: number[], b: number[]) => JSON.stringify(pcset(a)) === JSON.stringify(pcset(b));
const NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
// Feedback should spell notes the way the key does: pass "sharps" in sharp keys (A harmonic minor's G#, D major's C#).
export type Spelling = "flats" | "sharps";
export const nm = (s: number, sp: Spelling = "flats") => (sp === "sharps" ? SHARP_NAMES : NAMES)[pc(s)];
// With no spelling given, a set of notes that names as a chord is spelled from its root by letter (D7 is D F# A C, Bdim7 is B D F Ab); anything else falls back to flats.
export const nms = (ss: number[], sp?: Spelling) => (sp ? null : spellChord(ss)) ?? ss.map(x => nm(x, sp ?? "flats")).join(" ");
const LETTERS = "CDEFGAB", LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
export function spellChord(ss: number[]): string | null {
  if (ss.length < 3) return null;
  let sym: string;
  try { sym = nameOf(ss); } catch { return null; }
  const m = /^([A-G])([b#]?)/.exec(sym ?? "");
  if (!m) return null;
  const li0 = LETTERS.indexOf(m[1]), rpc = (LETTER_PC[li0] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12;
  // Try the root as named and its enharmonic twin (Ab and G#), and keep the spelling with fewer odd names (Cb, E#, double accidentals).
  const tries = [li0, ...(m[2] === "b" ? [(li0 + 6) % 7] : m[2] === "#" ? [(li0 + 1) % 7] : [])].map(li => spellFrom(ss, sym, li, rpc)).filter((x): x is string => !!x);
  const odd = (x: string) => (x.match(/Cb|Fb|E#|B#|bb|##/g) ?? []).length;
  return tries.sort((a, b) => odd(a) - odd(b))[0] ?? null;
}
function spellFrom(ss: number[], sym: string, li: number, rpc: number): string | null {
  const dim7 = /dim7|o7/.test(sym), aug = /aug|\+|#5/.test(sym), sharp11 = /#11/.test(sym), sharp9 = /#9|alt/.test(sym);
  const STEP = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
  const out = ss.map(x => {
    const iv = (pc(x) - rpc + 12) % 12;
    let st = STEP[iv];
    if (iv === 9 && dim7) st = 6;
    if (iv === 8 && aug) st = 4;
    if (iv === 6 && sharp11 && !/b5|m7b5|dim/.test(sym)) st = 3;
    if (iv === 3 && sharp9 && !/^[A-G][b#]?m(?!aj)/.test(sym)) st = 1;
    const L = (li + st) % 7, d = ((pc(x) - LETTER_PC[L] + 18) % 12) - 6;
    if (Math.abs(d) > 2) return null;
    return LETTERS[L] + (d > 0 ? "#".repeat(d) : "b".repeat(-d));
  });
  return out.includes(null) ? null : out.join(" ");
}

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
// Chord qualities, checked by guide tones so rootless voicings and added tensions pass.
// A chord quality as guide tones it must have, plus the tensions it may add. Rootless voicings pass.
export const QUAL: Record<string, { need: number[]; ok: number[] }> = {
  maj7: { need: [4, 11], ok: [0, 2, 4, 6, 7, 9, 11] },
  m7: { need: [3, 10], ok: [0, 2, 3, 5, 7, 9, 10] },
  "7": { need: [4, 10], ok: [0, 1, 2, 3, 4, 6, 7, 8, 9, 10] },
  "7b9": { need: [4, 10, 1], ok: [0, 1, 3, 4, 6, 7, 8, 9, 10] },
  m7b5: { need: [3, 6, 10], ok: [0, 2, 3, 5, 6, 8, 10] },
  m6: { need: [3, 9], ok: [0, 2, 3, 5, 7, 9] },
  dim7: { need: [3, 6, 9], ok: [0, 2, 3, 5, 6, 8, 9, 11] },
};
const ROLE: Record<number, string> = { 0: "root", 1: "b9", 2: "9th", 3: "minor 3rd", 4: "3rd", 5: "4th", 6: "b5", 7: "5th", 8: "b13", 9: "6th", 10: "7th", 11: "major 7th" };
const STEPS: Record<number, number> = { 0: 0, 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 4, 8: 5, 9: 5, 10: 6, 11: 6 };
// Spell the note a given number of half steps above a written root, by letter: spell("D", 4) is F#.
function spell(root: string, iv: number, q: string): string {
  const L = "CDEFGAB", nat = [0, 2, 4, 5, 7, 9, 11];
  const li = L.indexOf(root[0]), rp = (nat[li] + (root[1] === "#" ? 1 : root[1] === "b" ? -1 : 0) + 12) % 12;
  const steps = q === "dim7" && iv === 9 ? 6 : STEPS[iv];
  const t = (li + steps) % 7, d = ((rp + iv - nat[t]) % 12 + 18) % 12 - 6;
  return L[t] + (["bb", "b", "", "#", "##"][d + 2] ?? "");
}
// Check one chord against a quality; null if it fits, else what is wrong.
export function fits(semis: number[], label: string, rootPc: number, q: string): string | null {
  const Q = QUAL[q], rel = pcset(semis).map(p => (p - rootPc + 12) % 12), root = label.match(/^[A-G][b#]?/)![0];
  const miss = Q.need.find(x => !rel.includes(x));
  if (miss !== undefined) return `it needs ${spell(root, miss, q)}, the ${q === "dim7" && miss === 9 ? "diminished 7th" : ROLE[miss]}`;
  // b9 and b5 with neither root nor fifth is the dominant a tritone away (Db7 for G7), not this chord.
  if ((q === "7" || q === "7b9") && rel.includes(1) && rel.includes(6) && !rel.includes(0) && !rel.includes(7)) return `that is ${pc(rootPc + 6) === 6 ? "Gb" : nm(rootPc + 6)}7, the tritone substitute. Build the dominant on ${root}`;
  const extra = rel.find(x => !Q.ok.includes(x));
  if (extra !== undefined) return `${spell(root, extra, q)} does not belong in ${label.split(" ")[0]}`;
  return null;
}
// Is the chord's root sounding: in the chord itself, or in another pitched voice (a bass) at that moment?
// Without it a rootless voicing is ambiguous (rootless Fmaj7 is Am7), so checks require one or the other.
export function rootHeard(n: TimedNote[], v: string, t: number, rootPc: number, semis: number[]): boolean {
  if (semis.some(s => pc(s) === pc(rootPc))) return true;
  return n.some(x => x.voice !== v && x.params?.inst !== "kit" && pc(x.semi) === pc(rootPc) && x.bar <= t + 2e-3 && x.bar + x.bars > t + 2e-3);
}

export function expectChords(n: TimedNote[], v: string, want: [number, string][]): string | null {
  const miss = need(n, v); if (miss) return miss;
  const g = groups(of(n, v)).filter(x => x.semis.length >= 2);
  for (let i = 0; i < want.length; i++) {
    const [root, sym] = want[i];
    if (!g[i]) return `I hear ${g.length} chord${g.length === 1 ? "" : "s"}; I expected ${want.length}.`;
    if (QUAL[sym]) { const why = fits(g[i].semis, NAMES[pc(root)] + sym, pc(root), sym); if (why) return `Chord ${i + 1} should be ${NAMES[pc(root)]}${sym}, but ${why}. You have ${nms(g[i].semis)}.`; }
    if (!rootHeard(n, v, g[i].t, root, g[i].semis)) return `Chord ${i + 1} should be ${NAMES[pc(root)]}${sym}, but nothing plays its root, ${NAMES[pc(root)]}. You have ${nms(g[i].semis)}. Put ${NAMES[pc(root)]} in the chord, or add a bass that plays it.`;
    if (QUAL[sym]) continue;
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
