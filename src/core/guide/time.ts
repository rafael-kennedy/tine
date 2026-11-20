import { Guide, ex } from "./types";

export const TIME: Record<string, Guide> = {
  fast: {
    intro: "`fast` squeezes a pattern so it plays several times in one bar. It is the same as `p * n`. The number can be a fraction.",
    examples: [
      ex("The plainest use: a four-note figure played twice per bar becomes eighth notes.", `
voice arp = [c4 e4 g4 b4].fast(2).inst(pluck)`),
      ex("A fraction slows down as well as speeds up. Here a three-note phrase plays one and a half times per bar, so its start drifts against the bar line.", `
voice drums = [kick . snare . kick kick snare .]
voice line  = [e4 g4 a4].fast(3/2).inst(bell)`, { bars: 2 }),
      ex("`p * n` is the same thing written as arithmetic, which reads well in a stack of parts.", `
voice hats = [hat . hat hat].fast(4).vel(.5)
voice kick = [kick . . .] * 2`),
      ex("It fits naturally inside `every`, for a fill on the last bar of four.", `
voice snare = [. snare . snare].every(4, p => p.fast(2))`, { bars: 4 }),
    ],
    see: ["slow", "ply", "every"],
  },
  slow: {
    intro: "`slow` stretches a pattern over several bars. It is the opposite of `fast`, and the same as `p / n`. Use it for long lines, chord changes and pads.",
    examples: [
      ex("A phrase normally fills one bar. Slowed by two, each note lasts twice as long and the phrase takes two bars.", `
voice tune = [c4 d4 e4 g4 e4 d4 c4 .].slow(2).inst(keys)`, { bars: 2 }),
      ex("Chord changes are often written as one chord per step, then slowed so each gets a bar of its own.", `
voice pad  = [c3@maj7 a2@m7 d3@m7 g2@7].slow(4).inst(pad)
voice beat = [kick hat snare hat]`, { bars: 4 }),
      ex("A fractional slow sets up a long cycle against the bar. Five notes over three bars line up again only every three bars.", `
voice drone = [c2 g2 c3 bb2 f2].slow(3).inst(bass)
voice tick  = [hat*4]`, { bars: 3 }),
    ],
    see: ["fast", "loop", "arrange"],
  },
  late: {
    intro: "`late` delays a pattern by a fraction of a bar. Short delays give offbeats and pushed rhythms; a delay of a whole step turns a pattern into its own echo.",
    examples: [
      ex("Delay a chord by an eighth note (1/8 of a 4/4 bar) and it lands on the offbeats, the reggae skank.", `
voice bass = [c2 . . . g1 . . .].inst(bass)
voice skank = [c4@m . c4@m .].late(1/8).inst(keys).legato(.3)`),
      ex("A tiny delay is a feel, not a rhythm. Here the snare sits a little behind the beat.", `
voice kick  = [kick . kick .]
voice snare = [. snare . snare].late(1/64)`),
      ex("Layer a pattern with a late copy of itself for a canon. `off` does this in one step.", `
let tune = [c4 e4 g4 e4 d4 f4 a4 f4]
voice lead   = tune.inst(pluck)
voice follow = tune.late(1/4).octave(1).inst(bell).vel(.5)`),
    ],
    see: ["early", "off", "displace"],
  },
  early: {
    intro: "`early` shifts a pattern earlier by a fraction of a bar, the mirror image of `late`. What falls off the start of the bar wraps round from the bar before.",
    examples: [
      ex("Shift a bass line a sixteenth early and it anticipates each downbeat, a push common in funk and Latin music.", `
voice kick = [kick . . . kick . . .]
voice bass = [c2 . . . eb2 . f2 .].early(1/16).inst(bass)`),
      ex("Early by a whole step makes a pattern start partway through, like rotating it.", `
voice line = [c4 d4 e4 f4].early(1/4).inst(pluck)`),
      ex("Combined with `late` on a second voice, a small `early` spreads two parts apart without changing their tempo.", `
voice left  = [c4 e4 g4 c5].early(1/96).pan(-.8).inst(keys)
voice right = [c4 e4 g4 c5].late(1/96).pan(.8).inst(keys)`),
    ],
    see: ["late", "rotate"],
  },
  rev: {
    intro: "`rev` plays a pattern backwards within each bar. On a list it reverses the list. It is the simplest way to get a second idea out of a first.",
    examples: [
      ex("A rising arpeggio reversed becomes a falling one.", `
voice up   = [c4 e4 g4 c5].inst(pluck)
voice down = [c4 e4 g4 c5].rev.octave(1).inst(bell).vel(.5)`),
      ex("Reversal keeps the rhythm's shape mirrored too: a long note at the start of the bar ends up at the end.", `
voice tune = [c4:3 d4 e4 g4:2].rev.inst(keys)`),
      ex("Most often it appears inside `every`, so the line turns round once in a while.", `
voice tune = [^1 ^2 ^3 ^5 ^6 ^5 ^3 ^2].every(4, rev).inst(pluck)`, { bars: 4 }),
    ],
    see: ["palindrome", "every", "rotate"],
  },
  every: {
    intro: "`every(n, f)` applies the function f on one bar out of every n. By default it is the last bar of each group, where fills belong. `at:` picks a different bar, counting from 0.",
    examples: [
      ex("A drum fill: on every fourth bar, the snare part doubles up.", `
voice kick  = [kick . . kick . . kick .]
voice snare = [. . snare . . . snare .].every(4, p => p.fast(2))`, { bars: 4 }),
      ex("Any function will do, including a named one. Here the melody turns backwards every second bar.", `
voice tune = [^1 ^3 ^5 ^6].every(2, rev).inst(pluck)`, { bars: 2 }),
      ex("`at: 0` moves the change to the first bar of each group, so the phrase opens with the variation instead of closing with it.", `
voice tune = [^5 ^4 ^3 ^2].every(4, p => p.step(2), at: 0).inst(keys)`, { bars: 4 }),
      ex("`every` calls can nest. The inner one fires every two bars; the outer one adds a second change every eight.", `
voice bass = [c2 . c2 g1].every(2, p => p.octave(1)).every(8, p => p.rev).inst(bass)`, { bars: 8 }),
    ],
    see: ["maybe", "per_bar", "cat"],
  },
  palindrome: {
    intro: "`palindrome` plays a pattern forwards on one bar and backwards on the next. A phrase that goes somewhere comes back home.",
    examples: [
      ex("A scale run up, then down.", `
voice run = [c4 d4 e4 f4 g4 a4 b4 c5].palindrome.inst(pluck)`, { bars: 2 }),
      ex("With rhythm in the phrase, the rhythm reverses too, so long-short becomes short-long on the way back.", `
voice tune = [c4:3 e4 g4:2 a4:2].palindrome.inst(keys)`, { bars: 2 }),
      ex("Slow it and the turn takes longer: a four-bar arch.", `
voice arch = [^1 ^2 ^3 ^4 ^5 ^6 ^7 ^8].palindrome.slow(2).inst(bell)`, { bars: 4 }),
    ],
    see: ["rev", "every"],
  },
  iter: {
    intro: "`iter(n)` starts the pattern 1/n of a bar later in itself each bar, wrapping round. After n bars it is back where it began. It is a classic way to make a short loop feel longer.",
    examples: [
      ex("Four notes, rotated one step each bar: c e g b, then e g b c, and so on.", `
voice arp = [c4 e4 g4 b4].iter(4).inst(pluck)`, { bars: 4 }),
      ex("On drums, iter moves the accent around the bar without changing the pattern.", `
voice perc = [rim . rim rim . rim . .].iter(8)
voice kick = [kick . . . kick . . .]`, { bars: 8 }),
      ex("A count that does not match the phrase's length shifts it by a fraction of a step, which smears the rhythm.", `
voice line = [^1 ^3 ^5 ^3].iter(3).inst(bell)`, { bars: 3 }),
    ],
    see: ["rotate", "early"],
  },
  off: {
    intro: "`off(t, f)` layers a pattern with a copy of itself moved t bars later and changed by f. It is a quick way to an echo, a harmony or a call and response.",
    examples: [
      ex("An eighth-note offset with the copy an octave up: one line becomes a busy two-part figure.", `
voice arp = [c4 . e4 . g4 . e4 .].off(1/8, p => p.octave(1)).inst(pluck)`),
      ex("The copy can be any transformation. Here it is a quieter third above, so the line harmonizes itself.", `
voice tune = [^1 ^2 ^3 ^5].off(1/16, p => p.step(2).vel(.4)).inst(keys)`),
      ex("Leave out f and the copy is unchanged, a simple doubling in time.", `
voice clap = [. clap . clap].off(1/32)`),
    ],
    see: ["late", "echo", "stack"],
  },
  echo: {
    intro: "`echo` repeats each note a few times, quieter each time. Unlike the `delay` effect, the repeats are real notes: they show in the piano roll, go out over MIDI and can be changed like any other.",
    examples: [
      ex("Defaults: three repeats an eighth apart, each at 60% of the one before.", `
voice blip = [c5 . . . . . . .].echo.inst(bell)`),
      ex("A dotted-eighth echo (3/16 of a bar) against straight eighths gives the rolling sound of so much guitar music.", `
voice tune = [e4 . g4 . a4 . . .].echo(times: 4, time: 3/16, decay: .5).inst(pluck)`),
      ex("Short times and many repeats turn a hit into a ratchet that fades away.", `
voice snare = [. . . . . . . snare].echo(times: 6, time: 1/32, decay: .7)`),
    ],
    see: ["delay", "off", "ply"],
  },
  ply: {
    intro: "`ply(n)` repeats each event n times inside its own length. The rhythm keeps its outline but every note stutters.",
    examples: [
      ex("Each quarter note becomes two eighths.", `
voice line = [c4 e4 g4 e4].ply(2).inst(pluck)`),
      ex("Give `ply` a pattern to stutter only some notes. Here the last beat of the bar rolls.", `
voice hats = [hat hat hat hat].ply([1 1 1 3])`),
      ex("Alternate the amount bar by bar with angle brackets.", `
voice snare = [. snare . snare].ply(<1 2 1 4>)`, { bars: 4 }),
    ],
    see: ["fast", "echo", "chop"],
  },
  swing: {
    intro: "`swing` delays every second subdivision by part of a step. 1/3 gives triplet swing (long-short in a 2:1 ratio), smaller amounts a lighter shuffle, 0 is straight. `div` picks the subdivision: 8 for eighths, 16 for sixteenths.",
    examples: [
      ex("Straight eighths made into a jazz swing feel.", `
voice ride = [ride ride ride ride ride ride ride ride].swing
voice walk = [c2 e2 g2 a2].inst(upright)`),
      ex("A lighter 0.2 for a laid-back groove that still feels mostly straight.", `
voice hats = [hat*8].vel([.8 .4]).swing(.2)
voice kick = [kick . . kick . . kick .]`),
      ex("`div: 16` swings sixteenths instead, the shuffle of hip hop and house.", `
voice hats = [hat*16].vel([.8 .4 .6 .4]).swing(.25, div: 16)
voice beat = [kick . snare .]`),
    ],
    see: ["humanize", "late"],
  },
  stack: {
    intro: "`stack` plays patterns at the same time. Curly braces do the same inside a phrase; `stack` is handy when the parts are long or already have names.",
    examples: [
      ex("A whole drum kit as one voice.", `
voice drums = stack([kick . . kick . . . .], [. . snare . . . snare .], [hat*8].vel(.5))`),
      ex("Stack named parts to build a groove you can transform as a whole. Here the whole thing turns backwards every fourth bar.", `
let low  = [kick . kick .]
let high = [hat*8].vel(.4)
voice beat = stack(low, high).every(4, rev)`, { bars: 4 }),
      ex("Stacking a line with a transposed copy of itself makes parallel harmony.", `
let tune = [c4 d4 e4 g4]
voice both = stack(tune, tune.transpose(7)).inst(organ)`),
    ],
    see: ["cat", "seq", "union"],
  },
  cat: {
    intro: "`cat` plays one pattern per bar, in turn, then starts over. It is the function form of angle brackets: `cat(a, b)` is `<a b>`.",
    examples: [
      ex("Two one-bar riffs that alternate.", `
voice bass = cat([c2 . c2 eb2], [f2 . g2 bb1]).inst(bass)`, { bars: 2 }),
      ex("Patterns of any shape can be joined, which is useful for a groove and its fill.", `
let groove = [kick hat snare hat]
let fill   = [snare snare [snare snare] [tom1 tom2]]
voice drums = cat(groove, groove, groove, fill)`, { bars: 4 }),
      ex("A chord progression, one chord per bar.", `
voice keys = cat(c4@maj7, a3@m7, d4@m7, g3@7).strum.inst(keys)`, { bars: 4 }),
    ],
    see: ["seq", "arrange", "stack"],
  },
  seq: {
    intro: "`seq` squeezes several patterns one after another into a single bar. Each part gets an equal share of the bar, whatever its length.",
    examples: [
      ex("Two two-note patterns make one four-note bar.", `
voice line = seq([c4 e4], [g4 c5]).inst(pluck)`),
      ex("Parts of different lengths still get equal time, so the second half here is a triplet.", `
voice line = seq([c4 d4], [e4 f4 g4]).inst(keys)`),
      ex("Build a bar from named fragments.", `
let up   = [c4 e4 g4]
let down = [g4 e4 c4]
voice arp = seq(up, down, up.octave(1), down.octave(1)).inst(bell)`),
    ],
    see: ["cat", "concat"],
  },
  arrange: {
    intro: "`arrange` chains patterns, each for a given number of bars, and loops the whole. It is a small form inside one voice, without sections.",
    examples: [
      ex("Three bars of a groove, then one bar of a fill.", `
voice drums = arrange([kick hat snare hat], 3, [snare*4 [tom1 tom2]], 1)`, { bars: 4 }),
      ex("A chord progression with uneven lengths: two bars of the tonic, one each of the others.", `
voice pad = arrange(c3@maj7, 2, f3@maj7, 1, g3@7, 1).inst(pad)`, { bars: 4 }),
      ex("A pattern that spans several bars keeps playing through its share, so a slowed line fits naturally.", `
voice tune = arrange([c4 e4 g4 e4], 2, [d4 f4 a4 c5 a4 f4 d4 .].slow(2), 2).inst(keys)`, { bars: 4 }),
    ],
    see: ["cat", "loop"],
  },
  poly: {
    intro: "`poly(steps)` steps through a phrase at a fixed number of steps per bar, whatever its length. A three-note phrase at four steps per bar comes round on a different beat each bar: a polymeter.",
    examples: [
      ex("Three notes at four steps per bar. The pattern lines up with the bar again every three bars.", `
voice three = [c4 eb4 g4].poly(4).inst(pluck)
voice kick  = [kick . . .]`, { bars: 3 }),
      ex("Two polymeters against each other: five steps and seven steps over an eight-step grid.", `
voice a = [c4 d4 e4 g4 a4].poly(8).inst(bell)
voice b = [rim . rim . . rim .].poly(8)`, { bars: 4 }),
      ex("Polymeter on a bass line keeps a short riff from settling.", `
voice bass = [c2 c3 bb1 g1 bb1].poly(8).inst(bass)
voice beat = [kick hat snare hat]`, { bars: 5 }),
    ],
    see: ["on", "euclid", "fast"],
  },
  euclid: {
    intro: "`euclid(hits, steps)` spreads hits as evenly as possible over steps. Many traditional rhythms come out this way: 3 over 8 is the tresillo, 5 over 8 the cinquillo. `rot:` turns the result.",
    examples: [
      ex("Three kicks over eight steps, the tresillo.", `
voice kick = kick.euclid(3, 8)
voice hats = [hat*8].vel(.4)`),
      ex("Any pattern can be spread, not just a drum. Here a chord plays five times over sixteen steps.", `
voice stabs = c4@m7.euclid(5, 16).inst(keys).legato(.4)`),
      ex("`rot:` turns the rhythm by steps, which gives a family of related rhythms from one shape.", `
voice a = rim.euclid(5, 8)
voice b = clave.euclid(5, 8, rot: 2).vel(.6)`),
      ex("Odd step counts make rhythms that fit odd meters.", `
meter 7/8
voice clave = rim.euclid(3, 7)
voice kick  = [kick . . . . . .]`),
    ],
    see: ["poly", "rhythm", "on"],
  },
  trunc: {
    intro: "`trunc(fraction)` plays only the first part of each bar and leaves the rest silent. It cuts a phrase short without changing its timing.",
    examples: [
      ex("Keep three quarters of a bar: the last two eighths drop out.", `
voice line = [c4 d4 e4 f4 g4 a4 b4 c5].trunc(3/4).inst(pluck)`),
      ex("Inside `every`, trunc leaves a gap for another part, here once every four bars.", `
voice drums = [kick hat snare hat kick kick snare hat].every(4, p => p.trunc(1/2))`, { bars: 4 }),
      ex("`per_bar` can give each bar its own amount, so the phrase gets shorter bar by bar.", `
voice tune = per_bar(n => [^1 ^2 ^3 ^4 ^5 ^6 ^7 ^8].trunc(1 - (n % 4) / 4)).inst(keys)`, { bars: 4 }),
    ],
    see: ["degrade", "loop"],
  },
  per_bar: {
    intro: "`per_bar` builds each bar from a function of the bar number (from 0). Anything computed inside, including randomness, is decided per bar and stays the same each time that bar plays.",
    examples: [
      ex("Transpose a riff up a step each bar, over four bars.", `
voice riff = per_bar(n => [c3 eb3 g3 eb3].transpose((n % 4) * 2)).inst(bass)`, { bars: 4 }),
      ex("`if` inside the function picks a different pattern on certain bars.", `
voice drums = per_bar(n => if n % 4 == 3 then [snare*8] else [kick hat snare hat])`, { bars: 4 }),
      ex("Random choices inside are keyed to the bar: each bar picks its own chord, and the same seed picks the same ones.", `
seed 7
voice keys = per_bar(n => pick([^1@7 ^4@7 ^6@7 ^2@7])).strum.inst(keys)`, { bars: 4 }),
    ],
    see: ["evolve", "every", "cat"],
  },
  evolve: {
    intro: "`evolve(start, step, view)` carries a value from bar to bar. Bar 0 plays `view(start)`, and each later bar steps the value forward. Because it is always computed from bar 0, any bar can be jumped to and sounds the same.",
    examples: [
      ex("A counter. The state is a number that goes up by one each bar, and the view plays it as a scale degree.", `
voice climb = evolve(0, (n, bar) => (n + 1) % 8, (n, bar) => [n n n n].degrees).inst(pluck)`, { bars: 8 }),
      ex("A random walk in pitch: each bar moves the note by a small random step, and the view builds a figure on it.", `
seed 3
voice walk = evolve(c4, (p, bar) => p + pick([-2 -1 1 2]), (p, bar) => [p (p + 7) (p + 12) (p + 7)]).inst(keys)`, { bars: 4 }),
      ex("Without a view, the state itself plays. Here the state is a whole phrase, and each bar rotates it by one.", `
voice turn = evolve([c4 d4 e4 g4], (p, bar) => p.rotate(1)).inst(bell)`, { bars: 4 }),
    ],
    see: ["per_bar", "mutate", "voicelead"],
  },
  loop: {
    intro: "`loop(bars)` repeats the first few bars of a pattern forever. It freezes something that would otherwise change, like a random line or a long form.",
    examples: [
      ex("A random melody changes every bar. Looping its first two bars turns it into a riff you can keep.", `
seed 12
voice riff = dice([^1 ^3 ^4 ^5 ^7 .], 8).loop(2).inst(pluck)`, { bars: 4 }),
      ex("Loop the opening of a longer pattern to hear just that part.", `
voice keys = [c4@maj a3@m f3@maj g3@maj].slow(4).loop(1).inst(keys)`, { bars: 2 }),
      ex("Loop works on `per_bar` too, so a generated part can be pinned down to its first bars.", `
voice bass = per_bar(n => [c2 . c2 g1].transpose(n * 5)).loop(3).inst(bass)`, { bars: 6 }),
    ],
    see: ["slow", "per_bar", "trunc"],
  },
};
