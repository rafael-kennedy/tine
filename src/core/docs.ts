// Human-readable descriptions of words, shared by editor hovers and the language server.
import { builtinList } from "./builtins";
import { NOTE_RE } from "./lexer";
import { parseNote, pitchName, DRUMS, SCALES, CHORDS } from "./pitch";
import { INSTRUMENTS } from "./interp";
import { INSTRUMENT_DOCS } from "./synth";

const builtins = new Map(builtinList().map(b => [b.name, b]));

export function describeWord(word: string): string | null {
  const b = builtins.get(word);
  if (b) return `${b.sig}\n${b.doc}`;
  if (NOTE_RE.test(word)) { const p = parseNote(word); return `note ${pitchName(p.semi)}: MIDI ${p.semi}, ${p.freq().toFixed(2)} Hz`; }
  if (word in DRUMS) return `drum ${word}: General MIDI note ${DRUMS[word]}`;
  if (word in SCALES) return `scale ${word}: ${SCALES[word].steps.map(x => Math.round(x * 100) / 100).join(" ")} (period ${Math.round(SCALES[word].period * 100) / 100})`;
  if (word in CHORDS) return `chord quality ${word}: ${CHORDS[word].map(x => Math.round(x * 100) / 100).join(" ")} semitones`;
  if (INSTRUMENTS.includes(word)) return `instrument ${word}: ${INSTRUMENT_DOCS[word] ?? ""}`;
  const k: Record<string, string> = {
    voice: "voice name = pattern\nA named part that loops (or plays in sections).",
    let: "let name = value  /  let f(x) = body\nDefine a value or a function.",
    section: "section name bars\nAn indented block of voices lasting that many bars.",
    form: "form a b*2 c\nPlay sections in order: a finished piece.",
    tempo: "tempo bpm\nBeats (the meter's denominator) per minute.",
    key: "key root scale\nThe key that degrees like ^3 resolve against.",
    seed: "seed n\nFreeze all randomness so the piece replays exactly.",
    meter: "meter 7/8\nBeats per bar and beat unit.",
    tuning: "tuning 432\nFrequency of A4 in Hz.",
    use: "use \"other.tine\"\nRun another file here (its lets and voices become available).",
  };
  return k[word] ?? null;
}

