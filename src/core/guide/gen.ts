import { Guide, ex } from "./types";

// Signals and generators.
export const GEN: Record<string, Guide> = {
  sine: {
    intro: "`sine(period)` is a smooth signal that rises from 0 to 1 and falls back once every `period` bars. Signals are continuous: each note reads the value at the moment it plays. Rescale with `range`, then use it wherever a number goes.",
    examples: [
      ex("A filter that opens and closes over eight bars.", `
voice bass = [c2 c2 c3 c2 eb2 c2 g2 bb1].fast(2).inst(saw).cutoff(sine(8).range(300, 3000))`, { bars: 8 }),
      ex("Velocity from a one-bar sine: the line swells in the middle of each bar.", `
voice hats = [hat*16].vel(sine(1).range(.2, .9))`),
      ex("Pan a part slowly from side to side.", `
voice keys = [c4@maj7 . e4@m7 .].inst(keys).pan(sine(4).range(-.8, .8))`, { bars: 4 }),
    ],
    see: ["tri", "saw", "range", "seg"],
  },
  tri: {
    intro: "`tri(period)` rises in a straight line from 0 to 1 and falls back, once every `period` bars. It sounds more even than `sine`, which lingers at the top and bottom.",
    examples: [
      ex("A steady sweep of the cutoff, up for two bars and down for two.", `
voice acid = [a1 a1 a2 a1 c2 a1 g2 a1].inst(tb303).cutoff(tri(4).range(400, 2400))`, { bars: 4 }),
      ex("Turned into notes with `seg` and `range`, it plays a scale up and down.", `
voice run = tri(1).seg(16).range(0, 7).map(x => round(x)).degrees.inst(pluck)`),
    ],
    see: ["sine", "saw", "seg"],
  },
  saw: {
    intro: "`saw(period)` ramps from 0 up to 1 every `period` bars, then jumps back. Use it for builds that start again, like a riser before each section.",
    examples: [
      ex("A crescendo over each bar, then back to quiet.", `
voice snare = [snare*16].vel(saw(1).range(.1, 1))`),
      ex("A filter that opens over four bars and snaps shut, a classic build.", `
voice pad = <c3@m7 ab2@maj7>.inst(supersaw).lpf(saw(4).range(200, 6000))`, { bars: 4 }),
      ex("Velocity from a three-bar ramp on a seven-step pattern: the accent moves as the two cycles drift apart.", `
voice swirl = [hat*7].vel(saw(3).range(.2, .8))`, { bars: 3 }),
    ],
    see: ["sine", "tri", "range"],
  },
  square: {
    intro: "`square(period)` alternates between 0 and 1, holding each for half the period. It switches a setting between two values.",
    examples: [
      ex("Two velocities, alternating each half bar.", `
voice hats = [hat*8].vel(square(1).range(.3, .9))`),
      ex("Pan a part hard left for one bar, hard right for the next.", `
voice keys = [c4 e4 g4 e4].inst(keys).pan(square(2).range(-1, 1))`, { bars: 2 }),
    ],
    see: ["sine", "range"],
  },
  noise: {
    intro: "`noise(rate)` is a random signal that holds a new value `rate` times per bar. It is seeded, so it replays exactly.",
    examples: [
      ex("Random velocity for every hat.", `
seed 1
voice hats = [hat*16].vel(noise(16).range(.1, .6))`),
      ex("A random cutoff that changes every beat, for a restless bass.", `
seed 1
voice bass = [c2*8].inst(saw).cutoff(noise(4).range(300, 2500)).res(.5)`, { bars: 2 }),
    ],
    see: ["drift", "rand"],
  },
  drift: {
    intro: "`drift(rate)` is a smooth random signal that wanders between 0 and 1. It moves about `rate` times per bar. Use it where a sine would be too regular.",
    examples: [
      ex("A slowly wandering pan position.", `
seed 6
voice spark = [^5 . ^8 . ^9 . . .].inst(bell).vel(.4).pan(drift(.25).range(-.8, .8))`, { bars: 8 }),
      ex("Drift on how much a texture is thinned, so it breathes unpredictably.", `
seed 6
voice texture = [hat*16].degrade(drift(.5)).vel(.4)`, { bars: 8 }),
      ex("A tiny pitch drift, like an old tape machine.", `
seed 6
voice keys = [c4@maj7 . . . a3@m7 . . .].inst(keys).transpose(drift(.5).range(-.2, .2))`, { bars: 4 }),
    ],
    see: ["noise", "sine", "walk"],
  },
  range: {
    intro: "`range(lo, hi)` rescales a signal or a pattern of numbers from 0..1 to lo..hi. Almost every signal is used through it.",
    examples: [
      ex("A sine from 400 to 3400 Hz on a low-pass filter.", `
voice pad = <c3@m9 f3@m9>.inst(pad).lpf(sine(8).range(400, 3400))`, { bars: 8 }),
      ex("It works on a phrase of numbers too. Here 0..1 becomes velocities between .3 and .9.", `
voice hats = [hat*8].vel([0 .5 1 .5].range(.3, .9))`),
      ex("A range can run downwards: lo bigger than hi turns the signal over.", `
voice snare = [snare*16].vel(saw(1).range(1, .1))`),
    ],
    see: ["sine", "seg", "lerp"],
  },
  seg: {
    intro: "`seg(n)` samples a signal n times per bar, turning it into n separate events. That is how a smooth signal becomes notes.",
    examples: [
      ex("A sine sampled 16 times, scaled to MIDI note numbers and rounded to whole notes. Numbers in a voice play as MIDI notes.", `
voice wave = sine(1).seg(16).range(60, 72).map(x => round(x)).inst(pluck)`),
      ex("Sample a slow drift once per beat to get a walking line in scale steps.", `
seed 3
voice line = drift(1).seg(4).range(0, 7).map(x => floor(x)).degrees.inst(keys)`, { bars: 4 }),
    ],
    see: ["sine", "range", "as_cc"],
  },
  run: {
    intro: "`run(n)` is the phrase `[0 1 2 ... n-1]`. Combined with `degrees` it is a scale; with `map` it is anything you can compute from a counter.",
    examples: [
      ex("Eight steps of the scale, from the tonic up.", `
key d dorian
voice scale = run(8).degrees.inst(pluck)`),
      ex("Every other step, by mapping the numbers, for a line in thirds.", `
voice thirds = run(8).map(i => i * 2).degrees.inst(keys)`),
      ex("A run as MIDI numbers: a chromatic climb from middle C.", `
voice chrom = run(12).map(i => 60 + i).inst(bell)`),
    ],
    see: ["degrees", "map"],
  },
};
