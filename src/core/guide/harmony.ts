import { Guide, ex } from "./types";

export const HARMONY: Record<string, Guide> = {
  changes: {
    intro: "`changes(text)` reads chords from a lead sheet. Bars are split by `|`, chords in one bar share it, `/` holds a chord one more slot, `%` repeats the bar and `N.C.` is no chord. It loops over its bars. The chords keep their names, so the sheet views can print them.",
    examples: [
      ex("A ii-V-I, two bars, as written on a lead sheet.", `
voice keys = changes("Dm7 G7 | Cmaj7 | %").strum.inst(keys)`, { bars: 3 }),
      ex("Two chords in a bar split it evenly. `/` lets one take more of the bar: here Am7 gets three beats and D7 one.", `
voice keys = changes("Cmaj7 | Am7 / / D7 | G7 | Cmaj7").inst(keys)`, { bars: 4 }),
      ex("The changes are the start of a whole band: a bass from their roots, a comping part from their voicings.", `
let tune = changes("Am7 D7 | Gmaj7 Cmaj7 | F#m7b5 B7 | Em7 | %")
voice bass = tune.root.within(e1, e2).inst(upright)
voice comp = tune.rootless.voicelead.inst(keys).vel(.5)`, { bars: 5 }),
    ],
    see: ["chord", "root", "voicelead", "rootless"],
  },
  root: {
    intro: "`root` gives the root of each chord: from its symbol if it has one, otherwise named from its notes. Single notes pass through. It is the quickest bass line.",
    examples: [
      ex("The roots of a progression, two octaves down.", `
voice bass = changes("Dm7 G7 | Cmaj7 A7").root.octave(-1).inst(bass)`, { bars: 2 }),
      ex("A chord without a symbol is named from its notes. `{e4 g4 c5}` is C in first inversion, so its root is C.", `
voice keys = [{e4 g4 c5} {f4 a4 d5}].inst(keys)
voice bass = [{e4 g4 c5} {f4 a4 d5}].root.octave(-2).inst(bass)`),
      ex("Roots in a rhythm: put them on the hits of a bass rhythm with `on`.", `
let tune = changes("Cm7 | Fm7 | G7 | Cm7")
voice bass = tune.root.notes(bars: 4).on([x . . x . . x .]).octave(-1).inst(bass)`, { bars: 4 }),
    ],
    see: ["bassnote", "within", "name"],
  },
  bassnote: {
    intro: "`bassnote` gives the bass note of each chord: the slash note of `c@7/e`, otherwise the root. Slash chords on a lead sheet make the bass move by step; this follows them.",
    examples: [
      ex("A descending bass line written as slash chords.", `
voice bass = changes("C | C/B | Am | Am/G").bassnote.octave(-1).inst(bass)`, { bars: 4 }),
      ex("Compare: `root` stays on C, `bassnote` follows the slash.", `
let tune = changes("C C/E | F G/B")
voice roots = tune.root.octave(-1).inst(bass)
voice basses = tune.bassnote.octave(-2).inst(bass).vel(.6)`),
    ],
    see: ["root", "within"],
  },
  tones: {
    intro: "`tones(chord)` gives a chord's notes as a list, low to high. Once a chord is a list, every list function works on it.",
    examples: [
      ex("Print the notes of a chord symbol.", `
print(tones(g3@7b9))
voice keys = [g3@7b9].inst(keys)`),
      ex("Play the notes of a chord as a melody, in a new order each bar.", `
seed 3
voice tune = tones(c4@maj9).scramble.inst(pluck)`, { bars: 2 }),
      ex("Take the top two notes of a chord for a light voicing.", `
voice keys = tones(d4@m9).drop(3).inst(keys)`),
    ],
    see: ["arp", "chord"],
  },
  name: {
    intro: "`name(x)` names a chord as a chord symbol. On a pattern it names the chords bar by bar; `bars:` says how many. It is a quick way to check what you wrote.",
    examples: [
      ex("Name a chord from its notes.", `
print(name({e4 g4 c5}), name({c4 e4 g4 bb4 d5}))
voice keys = [{e4 g4 c5}]`),
      ex("Name what a pattern plays over several bars.", `
let prog = <^1@7 ^6@7 ^2@7 ^5@7>
print(name(prog, bars: 4))
voice keys = prog.inst(keys)`, { bars: 4 }),
    ],
    see: ["interval", "tones"],
  },
  shell: {
    intro: "`shell` voices each chord as root, third and seventh: the bebop pianist's left hand. Three notes say what a chord is with nothing extra.",
    examples: [
      ex("Shell voicings for a ii-V-I.", `
voice comp = changes("Dm7 G7 | Cmaj7 | %").shell.inst(keys)`, { bars: 3 }),
      ex("Shells on a short, offbeat comping rhythm.", `
let tune = changes("Cm7 F7 | Bbmaj7 Ebmaj7")
voice comp = tune.shell.notes(bars: 2).on([. x . . . x x .]).inst(keys).legato(.4)`, { bars: 2 }),
    ],
    see: ["guide", "rootless"],
  },
  guide: {
    intro: "`guide` keeps just the third and seventh of each chord, the guide tones. They are the notes that move by step from one chord to the next; add `voicelead` to hear it.",
    examples: [
      ex("Guide tones through a ii-V-I, voice-led so they move as little as possible.", `
voice guide = changes("Dm7 G7 | Cmaj7 | %").guide.voicelead.inst(keys)`, { bars: 3 }),
      ex("Guide tones over a root bass: a complete, very lean harmony.", `
let tune = changes("Am7 D7 | Gmaj7 | %")
voice bass  = tune.root.within(e1, e2).inst(upright)
voice guide = tune.guide.voicelead.inst(keys).vel(.5)`, { bars: 3 }),
    ],
    see: ["shell", "voicelead"],
  },
  rootless: {
    intro: "`rootless` voices each chord in four notes without the root, leaving the root to the bass. Form \"a\" starts on the third, form \"b\" on the seventh. These are the standard jazz piano voicings.",
    examples: [
      ex("A form voicings for a ii-V-I.", `
voice comp = changes("Dm7 G7 | Cmaj7 | %").rootless.inst(keys)`, { bars: 3 }),
      ex("Alternating forms keeps the hand in one place: \"a\" on the ii, \"b\" on the V.", `
voice comp = cat(changes("Dm7").rootless("a"), changes("G7").rootless("b")).inst(keys)`, { bars: 2 }),
      ex("Rootless voicings with a bass line on the roots.", `
let tune = changes("Fm7 Bb7 | Ebmaj7 Abmaj7")
voice bass = tune.root.within(e1, e2).inst(upright)
voice comp = tune.rootless.voicelead.inst(keys).vel(.5)`, { bars: 2 }),
    ],
    see: ["shell", "voicelead", "drop2"],
  },
  drop2: {
    intro: "`drop2` takes a close chord and drops its second voice from the top an octave. The chord spreads out and sounds open, the guitarist's and arranger's favourite.",
    examples: [
      ex("Close position, then drop 2, on the same chord.", `
voice keys = cat(c4@maj7, c4@maj7.drop2).inst(keys)`, { bars: 2 }),
      ex("Drop-2 voicings through changes, voice-led.", `
voice comp = changes("Cmaj7 Am7 | Dm7 G7").voicelead.drop2.inst(keys)`, { bars: 2 }),
    ],
    see: ["drop3", "drop24", "invert"],
  },
  drop3: {
    intro: "`drop3` drops the third voice from the top an octave. The spread is wider than drop 2, with a gap in the middle.",
    examples: [
      ex("Close, drop 2 and drop 3 on one chord.", `
voice keys = cat(c4@maj7, c4@maj7.drop2, c4@maj7.drop3).inst(keys)`, { bars: 3 }),
      ex("Drop 3 through a turnaround: a wide, guitar-like sound.", `
voice gtr = changes("Cmaj7 A7 | Dm7 G7").voicelead.drop3.strum(1/64).inst(pluck)`, { bars: 2 }),
    ],
    see: ["drop2", "drop24"],
  },
  drop24: {
    intro: "`drop24` drops the second and fourth voices from the top an octave. It is the widest of the drop voicings.",
    examples: [
      ex("Drop 2 and 4 on a seventh chord.", `
voice keys = cat(c4@maj7, c4@maj7.drop24).inst(keys)`, { bars: 2 }),
      ex("Drop 2 and 4 for a slow pad.", `
voice pad = changes("Fmaj7 | Em7 | Dm7 | Cmaj7").drop24.inst(pad)`, { bars: 4 }),
    ],
    see: ["drop2", "drop3"],
  },
  voicelead: {
    intro: "`voicelead` plays each chord in the inversion that moves least from the chord before, near the note given by `around`. Chords then move smoothly, with common tones held. It is computed from bar 0, so jumping to any bar gives the same voicing.",
    examples: [
      ex("Root-position chords jump. Voice-led, they move by step.", `
let prog = <c4@maj7 a3@m7 d4@m7 g3@7>
voice jumpy  = prog.inst(keys).pan(-.6)
voice smooth = prog.voicelead.inst(keys).pan(.6)`, { bars: 4 }),
      ex("`around` sets the register the voicings stay near.", `
voice low  = changes("Dm7 G7 | Cmaj7 | %").voicelead(around: c4).inst(keys)
voice high = changes("Dm7 G7 | Cmaj7 | %").voicelead(around: c5).inst(bell).vel(.4)`, { bars: 3 }),
      ex("Voice-led chords arpeggiated: each chord's line flows into the next.", `
voice arp = changes("Am | F | C | G").voicelead.arp("updown").fast(2).inst(pluck)`, { bars: 4 }),
    ],
    see: ["guide", "invert", "evolve"],
  },
  interval: {
    intro: "`interval(a, b)` names the interval between two pitches by size: `interval(c4, e4)` is \"M3\". With `long: true` it spells it out. Tine counts semitones, so C to F# and C to Gb are both a tritone.",
    examples: [
      ex("Short and long names.", `
print(interval(c4, g4), interval(c4, g4, long: true), interval(e4, c5))
voice keys = [{c4 g4} {e4 c5}]`),
      ex("Compute an interval inside the piece and print it while building a part.", `
let low = c4
let top = low + 10
print(interval(low, top, long: true))
voice pair = {(low) (top)}.inst(keys)`),
    ],
    see: ["name", "ratio"],
  },
};
