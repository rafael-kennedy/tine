import { Guide, ex } from "./types";

export const PITCH: Record<string, Guide> = {
  transpose: {
    intro: "`transpose(n)` moves notes by n semitones. It works on notes, degrees, chords and whole patterns, and n can be a fraction for microtones. Writing `p + n` does the same.",
    examples: [
      ex("A riff and the same riff a fifth higher, alternating bars.", `
let riff = [c3 eb3 g3 eb3]
voice bass = cat(riff, riff.transpose(7)).inst(bass)`, { bars: 2 }),
      ex("A pattern of amounts moves the line around under a fixed rhythm: a whole progression from one figure.", `
voice arp = [c4 e4 g4 e4].fast(2).transpose(<0 5 7 0>).inst(pluck)`, { bars: 4 }),
      ex("Half a semitone is a quarter tone. Here a copy a quarter tone up makes a beating, out-of-tune chorus.", `
voice a = [c4 e4 g4 c5].inst(organ).pan(-.6)
voice b = [c4 e4 g4 c5].transpose(.5).inst(organ).pan(.6).vel(.4)`),
    ],
    see: ["octave", "step", "within"],
  },
  octave: {
    intro: "`octave(n)` moves notes by whole octaves. On scale degrees it moves by the scale's period, which matters in tunings where the octave is not 12 semitones.",
    examples: [
      ex("Write a bass line in the middle register and drop it two octaves.", `
key d dorian
voice bass = [^1 . ^1 ^5 . ^4 _ .].octave(-2).inst(bass)`),
      ex("Double a melody an octave up, quieter, for a brighter tone.", `
let tune = [e4 g4 a4 _ g4 e4 d4 .]
voice lead = tune.inst(pluck)
voice high = tune.octave(1).inst(bell).vel(.3)`),
      ex("A pattern of octaves makes the line jump between registers.", `
voice bounce = [c3 c3 c3 c3].octave([0 1 0 2]).inst(pluck)`),
    ],
    see: ["transpose", "within"],
  },
  step: {
    intro: "`step(n)` moves notes by n steps of the current scale. It is diatonic transposition: up a step in C major, E goes to F but C goes to D. That keeps a line in key, which `transpose` does not.",
    examples: [
      ex("A line and its copy two steps up, a third apart all the way, always in key.", `
key c major
let tune = [^1 ^2 ^3 ^4 ^5 ^4 ^3 ^2]
voice lead = tune.inst(keys)
voice third = tune.step(2).inst(keys).vel(.5)`),
      ex("A sequence: the same figure moved down a step each bar.", `
key a minor
voice seq = [^5 ^4 ^5 ^3].step(<0 -1 -2 -3>).inst(pluck)`, { bars: 4 }),
      ex("It works on note names too, reading them in the key.", `
key g major
voice line = [g4 a4 b4 d5].step(1).inst(bell)`),
    ],
    see: ["transpose", "degrees", "key"],
  },
  degrees: {
    intro: "`degrees` reads numbers as scale steps counted from 0, so `[0 2 4]` becomes `[^1 ^3 ^5]`. It joins number-crunching (counters, walks, maps) to the key.",
    examples: [
      ex("A counting pattern played in the current key.", `
key d dorian
voice scale = [0 1 2 3 4 5 6 7].degrees.inst(pluck)`),
      ex("Arithmetic on numbers first, then degrees: the scale in thirds.", `
key e minor
voice thirds = run(8).map(i => i * 2).degrees.inst(keys)`),
      ex("A random walk through numbers, then degrees, stays in key and moves by step.", `
seed 4
key f lydian
voice line = walk(0..9, 8).degrees.inst(bell)`, { bars: 2 }),
    ],
    see: ["run", "step", "key"],
  },
  key: {
    intro: "`key(root, scale)` makes a key. As a method, `p.key(root, scale)` plays p in that key, so the same degrees can sound in different keys in different parts. The `key` statement sets the key for the whole piece.",
    examples: [
      ex("The same degrees in two keys at once: polytonality.", `
let tune = [^1 ^3 ^5 ^3 ^4 ^2 ^7 ^1]
voice upper = tune.key(c4, major).inst(keys)
voice lower = tune.key(f#3, major).inst(keys).vel(.5)`),
      ex("Change mode under a fixed line. The degrees stay the same; the notes change.", `
let tune = [^1 ^2 ^3 ^5 ^6 ^5 ^3 ^2]
voice line = cat(tune.key(d4, dorian), tune.key(d4, phrygian), tune.key(d4, lydian), tune.key(d4, mixolydian)).inst(pluck)`, { bars: 4 }),
      ex("A key with a scale built from a tuning. Here a 7-note scale from 31 equal steps.", `
voice line = [^1 ^2 ^3 ^4 ^5 ^6 ^7 ^8].key(c4, edo(31, [0 5 10 13 18 23 28])).inst(bell)`),
    ],
    see: ["degrees", "step", "mode", "scale"],
  },
  chord: {
    intro: "`chord(root, quality)` builds a chord, the same as `root@quality`. With a single text argument it reads a chord symbol, which is handy when the symbol comes from text.",
    examples: [
      ex("A chord from a root and a quality.", `
voice pad = chord(c3, "maj9").inst(pad)`),
      ex("Read a symbol straight from text, slash bass and all.", `
voice keys = cat(chord("Bb7#11"), chord("Ebmaj7/G")).strum.inst(keys)`, { bars: 2 }),
      ex("Inside `map`, build a chord on every note of a line.", `
voice stabs = [c4 . f4 . g4 . c4 .].map(n => chord(n, "m7")).legato(.3).inst(keys)`),
    ],
    see: ["changes", "invert", "tones"],
  },
  invert: {
    intro: "`invert(n)` moves the lowest n notes of each chord up an octave. Inversions keep the harmony but change its color and make smoother movement between chords.",
    examples: [
      ex("A C major chord in root position, then first and second inversion.", `
voice keys = cat(c4@maj, c4@maj.invert(1), c4@maj.invert(2)).inst(keys)`, { bars: 3 }),
      ex("Invert chords in a progression so they move less.", `
voice keys = [c4@maj f4@maj.invert(2) g4@maj.invert(1) c4@maj].inst(keys)`),
      ex("A negative number goes the other way: the top note drops an octave.", `
voice pad = c4@maj7.invert(-1).inst(pad)`),
    ],
    see: ["voicelead", "drop2", "within"],
  },
  arp: {
    intro: "`arp(mode)` spreads each chord's notes across its length, one after another. Modes are `up`, `down`, `updown`, `downup`, `out` (outside in) and `random`.",
    examples: [
      ex("A chord progression, arpeggiated up.", `
voice arp = <c4@maj7 a3@m7 d4@m7 g3@7>.arp.inst(pluck)`, { bars: 4 }),
      ex("`updown` goes up and back down without repeating the top note, and `fast` fits two in a bar.", `
voice arp = <c4@m9 ab3@maj7>.arp("updown").fast(2).inst(keys)`, { bars: 2 }),
      ex("Each chord's arpeggio fills its own step, so chords of different lengths give different speeds.", `
voice arp = [c4@maj7:3 g3@7].arp("down").inst(bell)`),
      ex("`random` picks a new seeded order for every chord.", `
seed 3
voice arp = [c4@m7 c4@m7 f4@m7 g4@7].arp("random").inst(pluck)`),
    ],
    see: ["strum", "tones", "held"],
  },
  strum: {
    intro: "`strum(spread)` rolls each chord's notes from low to high, a small time apart, like a guitar strum. The spread is in bars; the default 1/48 is quick.",
    examples: [
      ex("A progression, gently strummed.", `
voice keys = <^1@7 ^4@7 ^5@7 ^1@7>.strum.inst(keys)`, { bars: 4 }),
      ex("A slower spread sounds like a harp.", `
voice harp = [c4@maj9 . . . f4@maj9 . . .].strum(1/16).inst(pluck)`),
      ex("A pattern of chords played on the beat, strummed, for rhythm guitar.", `
voice gtr = [e3@m _ e3@m e3@m . e3@m . .].strum(1/64).inst(pluck)`),
    ],
    see: ["arp"],
  },
  hz: {
    intro: "`hz(pitch)` is a pitch's frequency in Hz, at the current tuning. Use it to set an effect's frequency from a note, or just to look.",
    examples: [
      ex("Print the frequency of A4, and of middle C.", `
print(hz(a4), hz(c4))
voice tone = [a4]`),
      ex("Tune a ring modulator to a note, so its metallic tone fits the harmony.", `
voice bell = [c4 e4 g4 c5].inst(sine).ring(hz(g5), mix: .6)`),
    ],
    see: ["note_num", "pitch"],
  },
  note_num: {
    intro: "`note_num(pitch)` is a pitch's MIDI note number. It can be fractional, for microtones. Use it for arithmetic on pitches.",
    examples: [
      ex("Print a few note numbers.", `
print(note_num(c4), note_num(a4), note_num(c4 + 50c))
voice tone = [c4]`),
      ex("Use the note number for arithmetic. Here every note is mirrored around E4 (note 64), turning the line upside down.", `
voice line = [c4 d4 e4 g4 a4 g4].inst(keys)
voice flip = [c4 d4 e4 g4 a4 g4].map(n => pitch(128 - note_num(n))).octave(-1).inst(bass)`),
    ],
    see: ["pitch", "hz"],
  },
  pitch: {
    intro: "`pitch(n)` turns a MIDI note number into a pitch. Fractions are allowed. It is the way back from arithmetic to notes.",
    examples: [
      ex("Compute notes from numbers: a harmonic-ish series of MIDI numbers.", `
voice tones = [0 12 19 24 28 31].map(k => pitch(36 + k)).inst(sine).vel(.4)`),
      ex("Fractional numbers give microtones: 24 equal steps per octave.", `
voice quarter = run(8).map(i => pitch(60 + i / 2)).inst(bell)`),
    ],
    see: ["note_num", "hz"],
  },
  ratio: {
    intro: "`ratio(r)` is the size of a frequency ratio in semitones: `ratio(3/2)` is about 7.02, a pure fifth. Use it to tune intervals by ratio instead of by semitone.",
    examples: [
      ex("Compare an equal-tempered fifth with a pure one.", `
print(ratio(3/2), ratio(5/4))
voice tone = [c4]`),
      ex("A pure major third above a note, played against the equal-tempered one: listen to the beating.", `
voice pure  = [c4 . (c4 + ratio(5/4)) .].inst(sine)
voice equal = [. c4 . e4].inst(sine)`),
    ],
    see: ["just", "transpose"],
  },
  scale: {
    intro: "`scale(steps)` makes a scale from semitone offsets. Fractions are allowed, and `period:` sets the interval it repeats at (12 by default). Use it with `key` to play degrees in it.",
    examples: [
      ex("A pentatonic scale written out, then used for a line.", `
key c scale([0 2 4 7 9])
voice line = [^1 ^2 ^3 ^4 ^5 ^6 ^5 ^3].inst(pluck)`),
      ex("Fractional steps: a scale with a neutral third, between minor and major.", `
key d scale([0 2 3.5 5 7 8.5 10])
voice line = [^1 ^2 ^3 ^4 ^5 ^4 ^3 ^2].inst(bell)`),
      ex("A scale that repeats at a twelfth (19 semitones) instead of the octave, like the Bohlen-Pierce idea.", `
key c3 scale([0 3 5 8 11 14 16], period: 19)
voice line = run(8).degrees.inst(keys)`),
    ],
    see: ["just", "edo", "cents", "mode"],
  },
  just: {
    intro: "`just(ratios)` makes a just-intonation scale from frequency ratios. Its intervals are pure, without the slight beating of equal temperament.",
    examples: [
      ex("A just major scale: chords on it ring very still.", `
key c3 just([1 9/8 5/4 4/3 3/2 5/3 15/8])
voice chords = <^1@3 ^4@3 ^5@3 ^1@3>.inst(organ)`, { bars: 4 }),
      ex("A scale from the harmonic series, with the seventh and eleventh harmonics.", `
key d just([1 9/8 5/4 11/8 3/2 13/8 7/4])
voice line = walk(0..10, 8).degrees.inst(bell)
voice drone = {d2 a2}.inst(pad)`, { bars: 2 }),
    ],
    see: ["ratio", "scale", "cents"],
  },
  edo: {
    intro: "`edo(n)` divides the octave into n equal steps. With a list of steps it picks a scale from them. 31 steps per octave, for instance, gives thirds close to pure.",
    examples: [
      ex("A diatonic scale picked from 31 equal steps, close to quarter-comma meantone.", `
key c edo(31, [0 5 10 13 18 23 28])
voice chords = <^1@7 ^4@7 ^5@7 ^1@3>.strum(1/24).inst(organ)`, { bars: 4 }),
      ex("All 24 steps of quarter-tone tuning, played as a slow climb.", `
key c4 edo(24)
voice climb = run(24).degrees.inst(bell)`),
      ex("A five-note scale from 5 equal steps per octave: no step is a familiar interval.", `
key c4 edo(5)
voice line = [^1 ^2 ^3 ^4 ^5 ^4 ^3 ^2].inst(pluck)`),
    ],
    see: ["scale", "cents", "just"],
  },
  cents: {
    intro: "`cents(list)` makes a scale from offsets in cents, where 100 cents is a semitone. Many published tunings are written in cents.",
    examples: [
      ex("A gamelan-like pelog scale.", `
key e cents([0 120 270 540 670 785 950])
voice gongs = [^1 . . . ^5 . ^4 .].octave(-1).inst(bell)
voice saron = [^1 ^2 ^3 ^5 ^3 ^2 ^1 ^7].inst(pluck)`),
      ex("A scale of equal 150-cent steps that repeats at the octave.", `
key c4 cents([0 150 300 450 600 750 900 1050])
voice line = run(8).degrees.inst(keys)`),
    ],
    see: ["scale", "scala"],
  },
  scala: {
    intro: "`scala(text)` reads a scale from the text of a Scala `.scl` file, the common format for microtonal tunings. Lines starting with `!` are comments; then a name, a count, and one interval per line in cents or as a ratio. In a string, `\\n` starts a new line.",
    examples: [
      ex("A pelog tuning written as text, with a line break written as `\\n`.", `
let pelog = scala("! pelog\\nPelog, approximate\\n7\\n120.0\\n270.0\\n540.0\\n670.0\\n785.0\\n950.0\\n2/1")
key e pelog
voice line = [^1 ^2 ^3 ^5 ^6 ^5 ^3 ^2].inst(bell)`),
      ex("Ratios work too. This is a just pentatonic scale.", `
key c4 scala("just pentatonic\\n5\\n9/8\\n5/4\\n3/2\\n5/3\\n2/1")
voice line = run(6).degrees.inst(pluck)`),
    ],
    see: ["scala_file", "cents"],
  },
  scala_file: {
    intro: "`scala_file(path)` loads a scale from a Scala `.scl` file next to your piece. It needs the file, so it works from the command line and in a DAW opened on a file, but not in a page with no files.",
    examples: [
      ex("Load a tuning from a file and play in it. (This one needs `pelog.scl` beside the piece.)", `
key e scala_file("pelog.scl")
voice line = [^1 ^2 ^3 ^5 ^6 ^5 ^3 ^2].inst(bell)`, { live: false }),
      ex("Keep the scale in a name and use it in several keys.", `
let pelog = scala_file("pelog.scl")
voice high = [^1 ^3 ^5 ^3].key(e4, pelog).inst(bell)
voice low  = [^1 . ^5 .].key(e2, pelog).inst(bass)`, { live: false }),
    ],
    see: ["scala"],
  },
  mode: {
    intro: "`mode(scale, n)` rotates a scale to start on its n-th degree, counting from 1. `mode(major, 2)` is dorian; it works on any scale, including custom and microtonal ones.",
    examples: [
      ex("The modes of the major scale, one per bar, over the same degrees.", `
let up = [^1 ^2 ^3 ^4 ^5 ^6 ^7 ^8]
voice line = cat(up.key(d4, mode(major, 1)), up.key(d4, mode(major, 2)), up.key(d4, mode(major, 3)), up.key(d4, mode(major, 4))).inst(pluck)`, { bars: 4 }),
      ex("A mode of a custom scale: start a pentatonic on its third note.", `
key c mode(scale([0 2 4 7 9]), 3)
voice line = run(6).degrees.inst(bell)`),
    ],
    see: ["scale", "key"],
  },
  within: {
    intro: "`within(lo, hi)` moves each note or chord by whole octaves until it sits between lo and hi. A chord moves by its lowest note and keeps its shape. It keeps generated parts in a playable range.",
    examples: [
      ex("Fold a bass line taken from chord changes into one octave, so it does not jump around.", `
voice bass = changes("Dm7 G7 | Cmaj7 A7").bassnote.within(e1, e2).inst(bass)`, { bars: 2 }),
      ex("Keep a random melody in a singable range.", `
seed 5
voice tune = dice([c3 e4 g5 a2 d6 f4], 8).within(c4, c5).inst(keys)`),
      ex("Chords keep their shape while they are moved into place.", `
voice keys = [c5@maj7 f2@maj7 g6@7 a3@m7].within(c4).inst(keys)`),
    ],
    see: ["octave", "root", "bassnote"],
  },
};
