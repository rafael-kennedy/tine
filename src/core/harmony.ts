// Harmony: chord symbols, lead-sheet changes, chord naming, voicings and
// voice leading. Everything here works on resolved semitones (MIDI numbers),
// so it applies equally to chords on note names and chords on scale degrees.

import { Pitch, Degree, Key, CHORDS } from "./pitch";
import { Chord, Rest } from "./pattern";

const mod12 = (x: number) => ((Math.round(x) % 12) + 12) % 12;

// ---------- chord symbols ----------

// Parse a chord quality as a jazz musician writes it after the root:
// "", m, 7, maj7, m7b5, dim7, 7b9, 7#9b13, maj7#11, 9sus4, 13, 69, 7alt, m(maj7)...
// Returns semitone offsets from the root, or null if it is not a chord symbol.
export function parseQuality(q: string): number[] | null {
  if (Object.prototype.hasOwnProperty.call(CHORDS, q)) return CHORDS[q];
  let s = q.replace(/[()]/g, "");
  let third: number | null = 4, fifth: number | null = 7, sev: number | null = null;
  const ext = new Set<number>();
  const eat = (re: RegExp): RegExpMatchArray | null => { const m = s.match(re); if (m) s = s.slice(m[0].length); return m; };
  if (eat(/^(mmaj|mMaj|mM|minmaj|-maj|-M|mΔ|-Δ)/)) { third = 3; sev = 11; }
  else if (eat(/^(m7b5|hdim|ø)/)) { third = 3; fifth = 6; sev = 10; eat(/^7/); }
  else if (eat(/^(dim|o|°)/)) { third = 3; fifth = 6; if (eat(/^7/)) sev = 9; }
  else if (eat(/^(aug|\+)/)) { fifth = 8; if (eat(/^(maj|M|Δ)(?=7|9|13)/)) sev = 11; }
  else if (eat(/^(maj|Maj|ma(?=\d)|M|Δ)/)) { if (/^(7|9|11|13)/.test(s)) sev = 11; }
  else if (eat(/^(min|mi|m|-)/)) { third = 3; }
  const n = eat(/^(69|6\/9|13|11|9|7|6|5)/);
  if (n) {
    switch (n[1]) {
      case "5": third = null; break;
      case "6": ext.add(9); break;
      case "69": case "6/9": ext.add(9); ext.add(14); break;
      case "7": sev ??= 10; break;
      case "9": sev ??= 10; ext.add(14); break;
      case "11": sev ??= 10; ext.add(14); ext.add(17); break;
      case "13": sev ??= 10; ext.add(14); ext.add(21); if (third === 3) ext.add(17); break;
    }
  }
  for (;;) {
    let m: RegExpMatchArray | null;
    if ((m = eat(/^sus(2|4)?/))) { third = m[1] === "2" ? 2 : 5; continue; }
    if (eat(/^alt/)) { sev ??= 10; fifth = null; ext.add(13); ext.add(15); ext.add(20); continue; }
    if ((m = eat(/^(add|no|omit)(\d+)/))) {
      const k = Number(m[2]);
      if (m[1] === "add") { const a: Record<number, number> = { 2: 2, 4: 5, 6: 9, 9: 14, 11: 17, 13: 21 }; if (a[k] === undefined) return null; ext.add(a[k]); }
      else if (k === 3) third = null; else if (k === 5) fifth = null; else return null;
      continue;
    }
    if ((m = eat(/^(b|#)(5|9|11|13)/))) {
      const up = m[1] === "#", k = Number(m[2]);
      if (k === 5) fifth = up ? 8 : 6;
      else {
        sev ??= 10;
        const nat = k === 9 ? 14 : k === 11 ? 17 : 21;
        ext.delete(nat); ext.add(nat + (up ? 1 : -1));
      }
      continue;
    }
    break;
  }
  if (s.length) return null;
  const out = [0, third, fifth, sev, ...ext].filter((x): x is number => x !== null);
  return [...new Set(out)].sort((a, b) => a - b);
}

// Symbols tried, in order of preference, when naming a set of notes.
const NAMING = [
  "", "m", "7", "maj7", "m7", "m7b5", "dim7", "dim", "aug", "sus4", "sus2", "5", "6", "m6", "mmaj7", "7sus4",
  "9", "maj9", "m9", "69", "m69", "add9", "madd9", "7b9", "7#9", "7#11", "7b13", "7#5", "7b5", "maj7#11", "maj7#5", "9sus4",
  "13", "maj13", "m11", "11", "m13", "7b9b13", "7#9b13", "7b9#9", "13b9", "13#11", "9#11", "7alt", "mmaj9", "m9b5", "13sus4", "7sus2", "m7add11", "maj7add13",
];
const NAMED = NAMING.map(sym => ({ sym, pcs: new Set(parseQuality(sym)!.map(mod12)) }));

const NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
export const pcName = (pc: number) => NAMES[mod12(pc)];

export interface ChordId { root: number; sym: string; omitted: string[] }

// Identify a chord from its sounding notes. Prefers the bass as the root,
// then fewer omitted tones, then simpler symbols.
export function identify(semis: number[], rootHint?: number): ChordId | null {
  if (rootHint !== undefined) { const id = identifyOn(semis, mod12(rootHint)); if (id) return id; }
  return identifyOn(semis);
}
function identifyOn(semis: number[], only?: number): ChordId | null {
  if (!semis.length) return null;
  const sorted = [...semis].sort((a, b) => a - b);
  const pcs = [...new Set(sorted.map(mod12))];
  const bass = mod12(sorted[0]);
  let best: (ChordId & { score: number }) | null = null;
  for (let r = 0; r < 12; r++) {
    if (only !== undefined && r !== only) continue;
    const rel = new Set(pcs.map(p => mod12(p - r)));
    NAMED.forEach(({ sym, pcs: q }, rank) => {
      for (const x of rel) if (!q.has(x)) return;
      const missing = [...q].filter(x => !rel.has(x));
      const omitted: string[] = [];
      for (const x of missing) {
        if (x === 0) omitted.push("root");
        else if (x === 7) omitted.push("5");
        else return; // only the root and fifth may be left out
      }
      if (rel.size < 2) return;
      const score = (r === bass ? 0 : 40) + (pcs.includes(r) ? 0 : 25) + omitted.length * 12 + rank * 0.5;
      if (!best || score < best.score) best = { root: r, sym, omitted, score };
    });
  }
  if (!best) return null;
  const b = best as ChordId & { score: number };
  return { root: b.root, sym: b.sym, omitted: b.omitted };
}

// rootHint: the chord's known root (from its symbol or voicing), named against first
export function nameOf(semis: number[], rootHint?: number): string {
  const id = identify(semis, rootHint);
  if (!id) return `{${semis.map(s => pcName(s).toLowerCase()).join(" ")}}`;
  const bass = mod12(Math.min(...semis));
  let s = pcName(id.root) + id.sym;
  if (id.omitted.includes("root")) s += " (no root)";
  else if (bass !== id.root) s += "/" + pcName(bass);
  return s;
}

// ---------- resolving chords ----------

export function semisOfValue(v: any, key: Key): number[] {
  if (v instanceof Pitch) return v.drum ? [] : [v.semi];
  if (v instanceof Degree) return [key.resolve(v)];
  if (typeof v === "number") return [v];
  if (v && typeof v === "object" && "n" in v && "d" in v) return [v.n / v.d];
  if (v instanceof Chord) return v.notes.flatMap(n => semisOfValue(n, key));
  return [];
}

export function chordSemis(c: Chord, key: Key): number[] { return semisOfValue(c, key).sort((a, b) => a - b); }

// The root of a chord, as a semitone: its symbol's root if it has one,
// otherwise the root a musician would name, otherwise the lowest note.
export function rootOf(c: Chord, key: Key): number {
  if (c.root !== undefined) return semisOfValue(c.root, key)[0];
  const s = chordSemis(c, key);
  const id = identify(s);
  if (!id) return s[0];
  // the named root, in the octave at or below the lowest note
  const lo = s[0]; let r = lo - mod12(lo - id.root);
  return r;
}
export function bassOf(c: Chord, key: Key): number {
  if (c.bass !== undefined) return semisOfValue(c.bass, key)[0];
  if (c.root !== undefined) return rootOf(c, key);
  return chordSemis(c, key)[0];
}

// The chord's tones as offsets above its root (0..23), so 9ths stay 9ths.
function relTones(c: Chord, key: Key): { root: number; rel: Set<number> } {
  const root = rootOf(c, key);
  const rel = new Set(chordSemis(c, key).map(s => mod12(s - root)));
  return { root, rel };
}

interface Functions { third: number | null; fifth: number | null; seventh: number | null; ninth: number | null; thirteenth: number | null; dominant: boolean }
function functionsOf(rel: Set<number>): Functions {
  const third = rel.has(4) ? 4 : rel.has(3) ? 3 : rel.has(5) ? 5 : rel.has(2) ? 2 : null;
  const seventh = rel.has(10) ? 10 : rel.has(11) ? 11 : rel.has(9) && rel.has(6) && rel.has(3) ? 9 : null;
  const fifth = rel.has(7) ? 7 : rel.has(6) && third !== 4 ? 6 : rel.has(8) ? 8 : rel.has(6) ? 6 : null;
  const ninth = rel.has(1) ? 1 : rel.has(3) && third === 4 ? 3 : rel.has(2) && third !== 2 ? 2 : null;
  const thirteenth = rel.has(9) && seventh !== 9 ? 9 : null;
  return { third, fifth, seventh, ninth, thirteenth, dominant: third === 4 && seventh === 10 };
}

const chordFrom = (semis: number[], c: Chord, root: number) =>
  new Chord(semis.map(s => new Pitch(s)), new Pitch(root), c.bass instanceof Pitch ? c.bass : undefined);

// Place a list of offsets (in order, each above the last) starting near `floor`.
function stackUp(root: number, offs: number[], lo: number): number[] {
  const out: number[] = [];
  let prev = -Infinity;
  for (const o of offs) {
    let s = root + o;
    if (!out.length) { while (s < lo) s += 12; while (s - 12 >= lo) s -= 12; }
    else { while (s <= prev) s += 12; while (s - 12 > prev) s -= 12; }
    out.push(s); prev = s;
  }
  return out;
}

// Root, third and seventh: the skeleton bebop pianists comped with.
export function shellVoicing(c: Chord, key: Key): Chord {
  const { root, rel } = relTones(c, key);
  const f = functionsOf(rel);
  const offs = [0, f.third ?? 7, f.seventh ?? (rel.has(9) ? 9 : f.fifth ?? 7)];
  return chordFrom(stackUp(root, offs, root), c, root);
}

// Third and seventh only: the guide tones that define a chord's quality.
export function guideVoicing(c: Chord, key: Key): Chord {
  const { root, rel } = relTones(c, key);
  const f = functionsOf(rel);
  const offs = [f.third ?? 7, f.seventh ?? (rel.has(9) ? 9 : f.fifth ?? 7)];
  return chordFrom(stackUp(root, offs, 52), c, root);
}

// Rootless voicings (Bill Evans, Wynton Kelly, Red Garland): four notes,
// no root, the bassist plays that. Form A starts on the third, form B on the seventh.
export function rootlessVoicing(c: Chord, key: Key, form = "a"): Chord {
  const { root, rel } = relTones(c, key);
  const f = functionsOf(rel);
  const third = f.third ?? 4;
  const seventh = f.seventh ?? 9; // triads become sixth chords
  const ninth = f.ninth ?? 2;
  // dominants take the 13th in place of the fifth, unless the chord alters it
  let fifth: number;
  if (f.dominant) fifth = rel.has(8) ? 8 : rel.has(6) && !rel.has(7) ? 6 : 9;
  else fifth = f.fifth ?? 7;
  if (seventh === 9 && fifth === 9) fifth = 7;
  const offs = String(form).toLowerCase() === "b" ? [seventh, ninth, third, fifth] : [third, fifth, seventh, ninth];
  return chordFrom(stackUp(root, offs, 50), c, root);
}

// Close position under the chord's top note, then drop the nth voice from the top an octave.
export function dropVoicing(c: Chord, key: Key, which: number[]): Chord {
  const given = chordSemis(c, key);
  const top = given[given.length - 1];
  const below = [...new Set(given.slice(0, -1).map(x => mod12(x)))].filter(p => p !== mod12(top)).map(p => top - (mod12(top - p) || 12));
  const s = [...below.sort((a, b) => a - b), top];
  const n = s.length;
  const out = s.map((x, i) => (which.includes(n - i) ? x - 12 : x)).sort((a, b) => a - b);
  return new Chord(out.map(x => new Pitch(x)), c.root !== undefined ? new Pitch(rootOf(c, key)) : undefined, c.bass);
}

// ---------- voice leading ----------

function closeInversions(pcsInOrder: number[]): number[][] {
  // all rotations of a close-position stack
  const base = [...new Set(pcsInOrder.map(mod12))].sort((a, b) => a - b);
  const out: number[][] = [];
  for (let r = 0; r < base.length; r++) {
    const rot = [...base.slice(r), ...base.slice(0, r)];
    const v: number[] = [];
    for (const p of rot) { let s = p; while (v.length && s <= v[v.length - 1]) s += 12; v.push(s); }
    out.push(v);
  }
  return out;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function motion(a: number[], b: number[]): number {
  if (a.length === b.length) return a.reduce((t, x, i) => t + Math.abs(x - b[i]), 0);
  // different sizes: each new note to its nearest old note
  return b.reduce((t, x) => t + Math.min(...a.map(y => Math.abs(x - y))), 0);
}

// The close-position inversion of `semis` that moves least from `prev`,
// held near `center` so a long progression does not climb or sink.
export function leadTo(prev: number[] | null, semis: number[], center: number): number[] {
  const shapes = closeInversions(semis);
  let best: number[] = semis, bestCost = Infinity;
  for (const sh of shapes) {
    const m = mean(sh);
    const k0 = Math.round((center - m) / 12);
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      const v = sh.map(x => x + 12 * k);
      const drift = Math.abs(mean(v) - center);
      const cost = (prev ? motion(prev, v) : 0) + drift * (prev ? 0.35 : 1);
      if (cost < bestCost - 1e-9) { bestCost = cost; best = v; }
    }
  }
  return best;
}

// ---------- lead sheets ----------

export interface ChangesStep { chord: Chord | null; w: number }

// Parse a chord symbol with its root: "Bb7", "F#m7b5", "Ebmaj7#11", "C7/E", "N.C."
export function parseSymbol(text: string, octave = 3): Chord | null {
  if (/^(N\.?C\.?|nc)$/i.test(text)) return null;
  const m = text.match(/^([A-Ga-g])(#|b)?(.*?)(?:\/([A-Ga-g])(#|b)?)?$/);
  if (!m) throw new Error(`'${text}' is not a chord symbol; try Dm7, G7b9, Cmaj7 or F/A`);
  const L: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  const pc = L[m[1].toLowerCase()] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  const offs = parseQuality(m[3]);
  if (!offs) throw new Error(`unknown chord quality '${m[3]}' in '${text}'`);
  const root = 12 * (octave + 1) + mod12(pc);
  const notes = offs.map(o => new Pitch(root + o));
  let bass: Pitch | undefined;
  if (m[4]) {
    const bpc = L[m[4].toLowerCase()] + (m[5] === "#" ? 1 : m[5] === "b" ? -1 : 0);
    let b = root - mod12(root - bpc); if (b >= root) b -= 12;
    if (b === root - 12) b = root - 12;
    bass = new Pitch(b);
    notes.unshift(bass);
  }
  return new Chord(notes, new Pitch(root), bass);
}

// Bars separated by |, chords in a bar share it equally.
// "/" holds the previous chord one more slot, "%" repeats the previous bar, N.C. is silence.
export function parseChanges(text: string, octave = 3): ChangesStep[][] {
  const segs = text.split("|").map(s => s.trim());
  while (segs.length && segs[0] === "") segs.shift();
  while (segs.length && segs[segs.length - 1] === "") segs.pop();
  const bars: ChangesStep[][] = [];
  for (const seg of segs) {
    if (seg === "%" ) { if (!bars.length) throw new Error("'%' repeats the previous bar, but this is the first bar"); bars.push(bars[bars.length - 1]); continue; }
    const steps: ChangesStep[] = [];
    for (const tok of seg.split(/\s+/).filter(Boolean)) {
      if (tok === "/" || tok === "_") {
        if (steps.length) steps[steps.length - 1] = { ...steps[steps.length - 1], w: steps[steps.length - 1].w + 1 };
        else { const last = bars[bars.length - 1]; steps.push({ chord: last ? last[last.length - 1].chord : null, w: 1 }); }
        continue;
      }
      if (tok === "%") throw new Error("'%' repeats a whole bar, so it goes between bar lines: \"C7 | %\"");
      steps.push({ chord: parseSymbol(tok, octave), w: 1 });
    }
    if (!steps.length) steps.push({ chord: null, w: 1 });
    bars.push(steps);
  }
  if (!bars.length) throw new Error("changes needs at least one chord, like changes(\"Dm7 G7 | Cmaj7\")");
  return bars;
}

// ---------- intervals ----------

const IV = ["P1", "m2", "M2", "m3", "M3", "P4", "TT", "P5", "m6", "M6", "m7", "M7"];
const IV_LONG = ["unison", "minor 2nd", "major 2nd", "minor 3rd", "major 3rd", "perfect 4th", "tritone", "perfect 5th", "minor 6th", "major 6th", "minor 7th", "major 7th"];
const COMPOUND: Record<number, string> = { 12: "P8", 13: "m9", 14: "M9", 15: "m10", 16: "M10", 17: "P11", 18: "A11", 19: "P12", 20: "m13", 21: "M13" };
export function intervalName(semis: number, long = false): string {
  const s = Math.round(Math.abs(semis));
  if (long) {
    if (s === 12) return "octave";
    const base = IV_LONG[s % 12];
    return s > 12 ? `${base} + ${Math.floor(s / 12)} octave${s >= 24 ? "s" : ""}` : base;
  }
  if (COMPOUND[s]) return COMPOUND[s];
  return s >= 12 ? `${IV[s % 12]}+${Math.floor(s / 12)}oct` : IV[s];
}

export function isRest(v: any) { return v instanceof Rest; }
