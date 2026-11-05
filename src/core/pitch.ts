// Pitch model. Every pitch is ultimately a (possibly fractional) MIDI note
// number: 60 is middle C, 60.5 is a quarter tone above it. Frequencies are
// derived from the tuning reference (A4 = 440 Hz by default). Fractional
// semitones give unrestricted microtonality while staying compatible with MIDI.

export class Pitch {
  constructor(public semi: number, public drum?: string) {}
  freq(ref = 440) { return ref * Math.pow(2, (this.semi - 69) / 12); }
  static fromFreq(hz: number, ref = 440) { return new Pitch(69 + 12 * Math.log2(hz / ref)); }
  toString() {
    if (this.drum) return this.drum;
    return pitchName(this.semi);
  }
}

// A scale degree is symbolic until it meets a key. ^1 is the tonic.
export class Degree {
  constructor(public deg: number, public acc = 0, public shift = 0) {}
  toString() {
    // printed as valid Tine code, so REPL output can be pasted back in
    const oct = Math.trunc(this.acc / 12), acc = this.acc - oct * 12;
    const a = acc > 0 ? "#".repeat(acc) : "b".repeat(-acc);
    let s = `^${a}${this.deg}`;
    if (this.shift) s = `(${s} ${this.shift > 0 ? "+" : "-"} ${Math.abs(this.shift)})`;
    if (oct) s += `.octave(${oct})`;
    return s;
  }
}

export class Scale {
  // steps are semitone offsets from the root within one period (usually 12)
  constructor(public name: string, public steps: number[], public period = 12) {}
  toString() { return `scale ${this.name}`; }
  semitoneOf(index: number): number {
    const n = this.steps.length;
    const oct = Math.floor(index / n);
    const i = ((index % n) + n) % n;
    return oct * this.period + this.steps[i];
  }
  // nearest scale index to a semitone offset from the root
  indexOf(semi: number): number {
    const n = this.steps.length;
    const oct = Math.floor(semi / this.period);
    let best = 0, bestD = Infinity;
    for (let o = oct - 1; o <= oct + 1; o++)
      for (let i = 0; i < n; i++) {
        const d = Math.abs(o * this.period + this.steps[i] - semi);
        if (d < bestD) { bestD = d; best = o * n + i; }
      }
    return best;
  }
}

export class Key {
  constructor(public root: Pitch, public scale: Scale) {}
  resolve(d: Degree): number {
    const idx = d.deg > 0 ? d.deg - 1 : d.deg - 1; // ^1 -> 0, ^0 -> -1, ^-1 -> -2
    return this.root.semi + this.scale.semitoneOf(idx + d.shift) + d.acc;
  }
  toString() { return `key ${pitchName(this.root.semi)} ${this.scale.name}`; }
}

const LETTERS: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

export function parseNote(text: string, defaultOctave = 4): Pitch {
  const letter = text[0].toLowerCase();
  let i = 1, acc = 0;
  while (text[i] === "#" || text[i] === "b") { acc += text[i] === "#" ? 1 : -1; i++; }
  const oct = i < text.length ? parseInt(text.slice(i), 10) : defaultOctave;
  return new Pitch(12 * (oct + 1) + LETTERS[letter] + acc);
}

export function parseDegree(text: string): Degree {
  let i = 1, acc = 0;
  while (text[i] === "#" || text[i] === "b") { acc += text[i] === "#" ? 1 : -1; i++; }
  return new Degree(parseInt(text.slice(i), 10), acc);
}

const NAMES = ["c", "c#", "d", "eb", "e", "f", "f#", "g", "ab", "a", "bb", "b"];
export function pitchName(semi: number): string {
  const r = Math.round(semi);
  const cents = Math.round((semi - r) * 100);
  const name = NAMES[((r % 12) + 12) % 12] + (Math.floor(r / 12) - 1);
  return cents ? `${name}${cents > 0 ? "+" : ""}${cents}c` : name;
}

const ET = (name: string, steps: number[]) => new Scale(name, steps);
export const SCALES: Record<string, Scale> = {
  major: ET("major", [0, 2, 4, 5, 7, 9, 11]),
  minor: ET("minor", [0, 2, 3, 5, 7, 8, 10]),
  ionian: ET("ionian", [0, 2, 4, 5, 7, 9, 11]),
  dorian: ET("dorian", [0, 2, 3, 5, 7, 9, 10]),
  phrygian: ET("phrygian", [0, 1, 3, 5, 7, 8, 10]),
  lydian: ET("lydian", [0, 2, 4, 6, 7, 9, 11]),
  mixolydian: ET("mixolydian", [0, 2, 4, 5, 7, 9, 10]),
  aeolian: ET("aeolian", [0, 2, 3, 5, 7, 8, 10]),
  locrian: ET("locrian", [0, 1, 3, 5, 6, 8, 10]),
  harmonic_minor: ET("harmonic_minor", [0, 2, 3, 5, 7, 8, 11]),
  melodic_minor: ET("melodic_minor", [0, 2, 3, 5, 7, 9, 11]),
  major_pent: ET("major_pent", [0, 2, 4, 7, 9]),
  minor_pent: ET("minor_pent", [0, 3, 5, 7, 10]),
  blues: ET("blues", [0, 3, 5, 6, 7, 10]),
  whole_tone: ET("whole_tone", [0, 2, 4, 6, 8, 10]),
  chromatic: ET("chromatic", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
  hirajoshi: ET("hirajoshi", [0, 2, 3, 7, 8]),
  double_harmonic: ET("double_harmonic", [0, 1, 4, 5, 7, 8, 11]),
  // A few non-12 references so microtonality is one word away.
  just_major: new Scale("just_major", [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8].map(r => 12 * Math.log2(r))),
  slendro: new Scale("slendro", [0, 2.4, 4.8, 7.2, 9.6]),
  bohlen_pierce: new Scale("bohlen_pierce", [1, 27 / 25, 25 / 21, 9 / 7, 7 / 5, 75 / 49, 5 / 3, 9 / 5, 49 / 25].map(r => 12 * Math.log2(r)), 12 * Math.log2(3)),
};

export const DEFAULT_KEY = new Key(new Pitch(60), SCALES.major);

// Chord qualities on absolute pitches, as semitone offsets.
export const CHORDS: Record<string, number[]> = {
  maj: [0, 4, 7], M: [0, 4, 7], min: [0, 3, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8],
  sus2: [0, 2, 7], sus4: [0, 5, 7], "5": [0, 7], power: [0, 7, 12],
  "6": [0, 4, 7, 9], m6: [0, 3, 7, 9], "7": [0, 4, 7, 10], dom7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], M7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10], min7: [0, 3, 7, 10], mmaj7: [0, 3, 7, 11], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], hdim: [0, 3, 6, 10],
  aug7: [0, 4, 8, 10], "9": [0, 4, 7, 10, 14], maj9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14], add9: [0, 4, 7, 14],
  "11": [0, 4, 7, 10, 14, 17], m11: [0, 3, 7, 10, 14, 17], "13": [0, 4, 7, 10, 14, 21],
  // harmonic-series chords for just intonation work
  otonal: [1, 5 / 4, 3 / 2, 7 / 4].map(r => 12 * Math.log2(r)),
  utonal: [1, 4 / 5, 2 / 3, 4 / 7].map(r => 12 * Math.log2(r)),
};

// General MIDI percussion names. These are ordinary values, so a drum
// phrase is just a phrase: [kick . snare .]
export const DRUMS: Record<string, number> = {
  kick: 36, kick2: 35, rim: 37, snare: 38, clap: 39, snare2: 40, tom1: 41, hat: 42, tom2: 43,
  pedal: 44, tom3: 45, ohat: 46, tom4: 47, tom5: 48, crash: 49, tom6: 50, ride: 51, china: 52,
  ridebell: 53, tamb: 54, splash: 55, cowbell: 56, crash2: 57, ride2: 59, bongo: 60, bongo2: 61,
  conga: 62, conga2: 63, shaker: 70, clave: 75, block: 76,
};
