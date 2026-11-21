import { Guide, ex } from "./types";

// Lists, math, and the odds and ends.
export const LISTS: Record<string, Guide> = {
  len: {
    intro: "`len(list)` is the number of elements in a list, or of characters in a text.",
    examples: [
      ex("Count the notes in a phrase.", `
let tune = [c4 e4 g4 b4 d5]
print(len(tune))
voice lead = tune.inst(pluck)`),
      ex("Use the length to fit a phrase to a grid: here it plays at one note per eighth, whatever its length, with `poly`.", `
let tune = [c4 e4 g4 b4 d5]
voice lead = tune.poly(8).inst(pluck)
print(len(tune), "notes against 8 steps")`, { bars: 5 }),
    ],
    see: ["at", "poly"],
  },
  at: {
    intro: "`at(list, i)` is the element at position i, counting from 0. It wraps round, so -1 is the last element and any whole number is safe.",
    examples: [
      ex("Pick one note from a list.", `
let scale = [c4 d4 e4 g4 a4]
voice tone = [(at(scale, 2)) (at(scale, -1))].inst(bell)`),
      ex("With `per_bar`, step through a list one element per bar. Wrapping means the list just repeats.", `
let roots = [c2 f2 g2 c2 a1]
voice bass = per_bar(n => [(at(roots, n)) . (at(roots, n)) .]).inst(bass)`, { bars: 5 }),
      ex("Index with arithmetic to walk a list in a pattern: every third element.", `
let scale = [^1 ^2 ^3 ^4 ^5 ^6 ^7]
voice line = run(8).map(i => at(scale, i * 3)).inst(pluck)`),
    ],
    see: ["len", "pick"],
  },
  map: {
    intro: "`map(f)` applies a function to every element of a list, or to every note of a pattern. The rhythm stays; only the values change.",
    examples: [
      ex("Add a fifth above every note, making each note a dyad.", `
voice fifths = [c4 d4 e4 g4].map(n => {(n) (n + 7)}).inst(organ)`),
      ex("Map numbers to notes. Here a list of intervals becomes pitches above C.", `
voice line = [0 4 7 11 14].map(i => pitch(60 + i)).inst(pluck)`),
      ex("Map a chord symbol onto each degree of a line, for parallel chords.", `
voice planing = [^1 ^2 ^3 ^5].map(deg => chord(deg, "7")).inst(keys)`),
    ],
    see: ["filter", "fold", "run"],
  },
  filter: {
    intro: "`filter(f)` keeps the elements, or notes, for which the function is true. The rest are dropped (in a pattern they become rests).",
    examples: [
      ex("Keep only the notes above middle C.", `
voice high = [c3 g3 c4 e4 g4 c5].filter(n => n > c4).inst(bell)`),
      ex("Keep the even numbers of a run, then play them as scale steps.", `
voice evens = run(12).filter(i => i % 2 == 0).degrees.inst(pluck)`),
      ex("Filter a random line to its chord tones.", `
seed 2
voice tones = dice([c4 d4 e4 f4 g4 a4 b4], 8).filter(n => n == c4 or n == e4 or n == g4).inst(keys)`, { bars: 2 }),
    ],
    see: ["map", "degrade"],
  },
  fold: {
    intro: "`fold(list, start, f)` combines the elements one by one, left to right. Each step gets what has been built so far and the next element. Sums, running totals and built-up chords are all folds.",
    examples: [
      ex("Add up a list of numbers.", `
print(fold([1 2 3 4], 0, (total, x) => total + x))
voice tone = [c4]`),
      ex("Stack intervals into a chord: start from a note, and each interval adds a note above the last.", `
let steps = [4 3 4 3]
let top = fold(steps, c4, (n, i) => n + i)
print(top)
voice keys = {c4 e4 g4 b4 (top)}.inst(keys)`),
    ],
    see: ["sum", "map"],
  },
  concat: {
    intro: "`concat(a, b, ...)` joins lists into one longer list. As a phrase, it fits all the steps into one bar.",
    examples: [
      ex("Two four-note figures joined into one eight-note bar.", `
voice arp = concat([c4 e4 g4 c5], [b4 g4 e4 b3]).inst(pluck)`),
      ex("Build a line from a list and a transformed copy of it.", `
let up = [^1 ^2 ^3 ^5]
voice line = concat(up, up.rev, up.step(2)).inst(keys)`),
    ],
    see: ["seq", "repeat"],
  },
  repeat: {
    intro: "`repeat(x, n)` is a list of n copies of x.",
    examples: [
      ex("Sixteen hats in one bar.", `
voice hats = repeat(hat, 16).vel(.5)`),
      ex("Joined with other lists, for a riff with a repeated note.", `
voice riff = concat(repeat(c3, 5), [eb3 g3 bb3]).inst(bass)`),
    ],
    see: ["concat", "ply"],
  },
  take: {
    intro: "`take(list, n)` keeps the first n elements.",
    examples: [
      ex("The first five notes of a scale.", `
voice five = take([c4 d4 e4 f4 g4 a4 b4 c5], 5).inst(pluck)`),
      ex("A phrase that grows by one note each bar.", `
let tune = [^1 ^3 ^5 ^4 ^3 ^2 ^1 ^7]
voice grow = per_bar(n => take(tune, n % 8 + 1)).inst(keys)`, { bars: 8 }),
    ],
    see: ["drop", "trunc"],
  },
  drop: {
    intro: "`drop(list, n)` keeps everything after the first n elements.",
    examples: [
      ex("A scale without its first three notes.", `
voice top = drop([c4 d4 e4 f4 g4 a4 b4 c5], 3).inst(pluck)`),
      ex("A phrase that shrinks from the front each bar.", `
let tune = [^1 ^3 ^5 ^4 ^3 ^2 ^1 ^7]
voice shrink = per_bar(n => drop(tune, n % 7)).inst(keys)`, { bars: 7 }),
    ],
    see: ["take", "rotate"],
  },
  rotate: {
    intro: "`rotate(n)` starts a list or a rhythm n steps later in itself, wrapping round: `[a b c d].rotate(1)` is `[b c d a]`. On rhythms with held or weighted steps, or a `.beats` line, it turns by steps of the rhythm's grid.",
    examples: [
      ex("A melody, then the same melody started from its second note.", `
let tune = [c4 e4 g4 b4]
voice a = cat(tune, tune.rotate(1)).inst(pluck)`, { bars: 2 }),
      ex("Rotate a rhythm to move its accents: the clave turned by three steps every fourth bar.", `
let clave = [X . . x . . X . . . x . X . . .]
voice turn = [^1 ^3 ^5 ^4 ^3 ^2 ^1].on(clave.every(4, r => r.rotate(3))).inst(keys)`, { bars: 4 }),
      ex("A negative number rotates the other way.", `
voice line = [^1 ^2 ^3 ^4 ^5].rotate(-1).inst(bell)`),
    ],
    see: ["iter", "displace", "on"],
  },
  sum: {
    intro: "`sum(list)` adds up the elements.",
    examples: [
      ex("Add up beat lengths to check a `.beats` line is the length you meant.", `
print(sum([3/2 1/2 2 3 1/2 1/2 4]), "beats")
voice tune = [c4:3/2 d4:1/2 e4:2 a4:3 g4:1/2 f4:1/2 e4:4].beats.inst(keys)`, { bars: 3 }),
      ex("A total used as a transposition: the sum of a few intervals.", `
voice tune = [c4 e4 g4].transpose(sum([2 2 1])).inst(pluck)`),
    ],
    see: ["fold", "len"],
  },
  floor: {
    intro: "`floor(x)` rounds down to a whole number. It works on numbers and on patterns of numbers.",
    examples: [
      ex("Turn a smooth signal into whole scale steps.", `
voice steps = sine(1).seg(8).range(0, 7).floor.degrees.inst(pluck)`),
      ex("Print a few values.", `
print(floor(2.7), floor(-2.7))
voice tone = [c4]`),
    ],
    see: ["ceil", "round"],
  },
  ceil: {
    intro: "`ceil(x)` rounds up to a whole number.",
    examples: [
      ex("Print a few values.", `
print(ceil(2.1), ceil(-2.1))
voice tone = [c4]`),
      ex("How many bars a line of beats needs: the total, divided by four and rounded up.", `
let lengths = [3 1 2 3 3]
print(ceil(sum(lengths) / 4), "bars")
voice tune = [c4:3 d4 e4:2 g4:3 e4:3].beats.inst(keys)`, { bars: 3 }),
    ],
    see: ["floor", "round"],
  },
  round: {
    intro: "`round(x)` rounds to the nearest whole number. Use it to snap computed values to notes or steps.",
    examples: [
      ex("Snap a sine to whole MIDI notes.", `
voice wave = sine(1).seg(16).range(60, 72).round.inst(pluck)`),
      ex("Snap a random walk in microtones to the nearest semitone, alongside the unsnapped version.", `
seed 3
voice micro = drift(2).seg(8).range(60, 67).inst(sine).pan(-.7)
voice snap  = drift(2).seg(8).range(60, 67).round.inst(sine).pan(.7)`),
    ],
    see: ["floor", "ceil"],
  },
  abs: {
    intro: "`abs(x)` is the size of a number without its sign.",
    examples: [
      ex("Print a few values.", `
print(abs(-3), abs(3))
voice tone = [c4]`),
      ex("Fold a line around a centre: notes that would go below it are reflected above.", `
voice v = [-4 -2 0 2 4 2 0 -2].map(x => abs(x)).degrees.inst(pluck)`),
    ],
    see: ["min", "max"],
  },
  sqrt: {
    intro: "`sqrt(x)` is the square root.",
    examples: [
      ex("A curve that rises fast and then levels off, used for velocities.", `
voice beat = [hat*8].vel(run(8).map(i => sqrt(i / 7)).range(.2, .9))`),
      ex("Print a value.", `
print(sqrt(2))
voice tone = [c4]`),
    ],
    see: ["exp", "log2"],
  },
  sin: {
    intro: "`sin(x)` is the sine of an angle in radians. For a moving signal in time, use `sine` instead; `sin` is for computing values.",
    examples: [
      ex("A line shaped by a sine, computed from a run of numbers.", `
voice wave = run(16).map(i => round(sin(i / 16 * 6.283) * 5)).degrees.inst(pluck)`),
      ex("Print a few values.", `
print(sin(0), sin(1.5708))
voice tone = [c4]`),
    ],
    see: ["cos", "sine"],
  },
  cos: {
    intro: "`cos(x)` is the cosine of an angle in radians.",
    examples: [
      ex("Two lines from sine and cosine: they move a quarter turn apart.", `
voice a = run(8).map(i => round(sin(i / 8 * 6.283) * 4)).degrees.inst(pluck)
voice b = run(8).map(i => round(cos(i / 8 * 6.283) * 4)).degrees.octave(-1).inst(bass)`),
      ex("Print a value.", `
print(cos(0))
voice tone = [c4]`),
    ],
    see: ["sin"],
  },
  log2: {
    intro: "`log2(x)` is the base-2 logarithm. In music it turns a frequency ratio into octaves.",
    examples: [
      ex("A frequency ratio in octaves, then in semitones (the same as `ratio`).", `
print(log2(3/2), log2(3/2) * 12)
voice tone = [c4]`),
      ex("Notes from ratios: the harmonic series up from C2, each converted to semitones.", `
voice partials = run(8).map(k => c2 + log2(k + 1) * 12).inst(sine).vel(.4)`),
    ],
    see: ["ratio", "exp"],
  },
  exp: {
    intro: "`exp(x)` is e to the power x. It makes curves that start slow and speed up.",
    examples: [
      ex("An exponential rise in velocity across a bar.", `
voice snare = [snare*16].vel(run(16).map(i => exp(i / 16 * 2) / exp(2)))`),
      ex("Print a value.", `
print(exp(1))
voice tone = [c4]`),
    ],
    see: ["log2", "sqrt"],
  },
  min: {
    intro: "`min(a, b, ...)` is the smallest value. It works on pitches too.",
    examples: [
      ex("Cap a computed note so a line never goes above a limit.", `
voice capped = run(12).map(i => min(c4 + i * 2, g4)).inst(pluck)`),
      ex("The lowest note of a few.", `
print(min(e4, c4, g4))
voice tone = [c4]`),
    ],
    see: ["max", "clamp"],
  },
  max: {
    intro: "`max(a, b, ...)` is the largest value.",
    examples: [
      ex("Keep a falling line from going below a floor.", `
voice floor = run(12).map(i => max(c5 - i * 2, f4)).inst(pluck)`),
      ex("The highest note of a few.", `
print(max(e4, c4, g4))
voice tone = [c4]`),
    ],
    see: ["min", "clamp"],
  },
  clamp: {
    intro: "`clamp(x, lo, hi)` keeps x between lo and hi.",
    examples: [
      ex("A rising run of numbers, clamped: it waits at the bottom, climbs, then holds at the top.", `
voice line = run(12).map(i => clamp(i - 3, 0, 5)).degrees.inst(pluck)`),
      ex("Print a few values.", `
print(clamp(12, 0, 10), clamp(-1, 0, 10))
voice tone = [c4]`),
    ],
    see: ["min", "max", "within"],
  },
  lerp: {
    intro: "`lerp(a, b, t)` blends from a to b: t = 0 gives a, t = 1 gives b, t = 0.5 halfway.",
    examples: [
      ex("A gradual change over eight bars: each bar's cutoff is a blend between two values.", `
voice bass = per_bar(n => [c2 c2 c3 c2].inst(saw).cutoff(lerp(300, 3000, (n % 8) / 7)))`, { bars: 8 }),
      ex("Print a value.", `
print(lerp(10, 20, .25))
voice tone = [c4]`),
    ],
    see: ["range"],
  },
  print: {
    intro: "`print(x, ...)` shows values in the console, and returns its first argument, so it can sit in the middle of a chain.",
    examples: [
      ex("Print a few things to check them.", `
print("a4 is", hz(a4), "Hz, and here is a chord:", c4@maj7)
voice tone = [c4]`),
      ex("Because it passes its first argument on, it can go anywhere in an expression.", `
voice line = print([c4 e4 g4].rev).inst(pluck)`),
    ],
    see: ["str", "type"],
  },
  str: {
    intro: "`str(x)` is the text form of a value. Use it to build messages or names.",
    examples: [
      ex("Build a message from values.", `
let root = d4
print("the root is " + str(root))
voice tone = [(root)]`),
      ex("Show a chord the way Tine writes it.", `
print(str(c4@m7))
voice keys = [c4@m7].inst(keys)`),
    ],
    see: ["print", "type"],
  },
  type: {
    intro: "`type(x)` is the name of a value's type. It helps when a function complains about what it was given.",
    examples: [
      ex("The types of a few values.", `
print(type(3), type(c4), type(^3), type([c e g]), type(c4@maj), type(sine(1)))
voice tone = [c4]`),
      ex("Use it to treat different kinds of values differently.", `
let up(x) = if type(x) == "number" then x + 1 else x
print(up(3), up(c4))
voice tone = [c4]`),
    ],
    see: ["print", "str"],
  },
};
