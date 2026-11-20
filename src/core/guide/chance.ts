import { Guide, ex } from "./types";

// Every random choice in Tine comes from the seed, so these all replay exactly.
// The examples set a seed so they sound the same each time they are opened.
export const CHANCE: Record<string, Guide> = {
  humanize: {
    intro: "`humanize` nudges each note's timing and velocity by a small random amount, so a part sounds played rather than programmed. Like all randomness here it is seeded: the same seed gives the same feel.",
    examples: [
      ex("The defaults: a few milliseconds of timing drift and a little velocity spread.", `
seed 5
voice keys = [c4@maj7 . . c4@maj7 . . a3@m7 .].humanize.inst(keys)`),
      ex("More velocity spread and less timing drift suits hi-hats, where the dynamics matter most.", `
seed 5
voice hats = [hat*16].humanize(time: .002, vel: .25)
voice beat = [kick . snare .]`),
      ex("A loose, late-night feel: more timing drift, together with swing.", `
seed 5
voice ride = [ride*8].swing.humanize(time: .01, vel: .15)
voice bass = [c2 e2 g2 bb2].inst(upright).humanize(time: .01)`),
    ],
    see: ["swing", "degrade"],
  },
  degrade: {
    intro: "`degrade` drops events at random. The amount is the chance each one is dropped, 0.5 by default. The amount can be a signal, so a part can thin out and fill in over time.",
    examples: [
      ex("Half the sixteenth hats removed: a sparse, shifting pattern.", `
seed 2
voice hats = [hat*16].degrade
voice beat = [kick . snare .]`, { bars: 2 }),
      ex("A small amount just takes the odd note out of a line, which keeps a loop from feeling mechanical.", `
seed 2
voice arp = [c4 e4 g4 b4 c5 b4 g4 e4].fast(2).degrade(.15).inst(pluck)`, { bars: 2 }),
      ex("A signal for the amount: here a slow `drift` makes the part breathe in and out over several bars.", `
seed 2
voice texture = [hat*16].degrade(drift(.25)).vel(.5)`, { bars: 8 }),
    ],
    see: ["thin", "sometimes", "maybe"],
  },
  sometimes: {
    intro: "`sometimes(prob, f)` applies f to each event with the given chance. Leave out the chance and it is one in two. `often` and `rarely` are shortcuts for 75% and 25%.",
    examples: [
      ex("Some notes jump up an octave.", `
seed 8
voice arp = [c4 e4 g4 c5 g4 e4 c4 e4].sometimes(p => p.octave(1)).inst(pluck)`, { bars: 2 }),
      ex("A low chance for an occasional ornament: a few hats become a quick double hit.", `
seed 8
voice hats = [hat*8].sometimes(.2, p => p.ply(2))
voice beat = [kick . snare .]`, { bars: 2 }),
      ex("The change can be anything, including sound settings. Some notes ring out with reverb.", `
seed 8
voice bell = [^1 ^3 ^5 ^8].inst(bell).sometimes(.3, p => p.reverb(.8).vel(.4))`, { bars: 2 }),
    ],
    see: ["often", "rarely", "maybe", "degrade"],
  },
  often: {
    intro: "`often(f)` applies f to about three events in four. It is `sometimes(.75, f)`.",
    examples: [
      ex("Most notes are short; a few are left long, which gives an accent by contrast.", `
seed 3
voice bass = [c2 c2 eb2 c2 g1 c2 bb1 c2].often(p => p.legato(.3)).inst(bass)`),
      ex("Most hats are soft, so the few loud ones stand out.", `
seed 3
voice hats = [hat*16].often(p => p.vel(.3))`),
    ],
    see: ["sometimes", "rarely"],
  },
  rarely: {
    intro: "`rarely(f)` applies f to about one event in four. It is `sometimes(.25, f)`, for surprises that should stay surprising.",
    examples: [
      ex("Now and then a note slides down a step of the scale.", `
seed 6
voice tune = [^1 ^3 ^5 ^3 ^4 ^2 ^5 ^1].rarely(p => p.step(-1)).inst(pluck)`, { bars: 2 }),
      ex("An occasional open hat among the closed ones.", `
seed 6
voice hats = [hat*8].rarely(p => p.map(h => ohat))
voice kick = [kick . . kick . . kick .]`, { bars: 2 }),
    ],
    see: ["sometimes", "often"],
  },
  maybe: {
    intro: "`maybe(prob, f)` decides once per bar whether to apply f to the whole bar. Where `sometimes` changes notes here and there, `maybe` changes whole bars, which suits fills and variations.",
    examples: [
      ex("About one bar in three the drums double up.", `
seed 11
voice drums = [kick hat snare hat].maybe(.33, p => p.fast(2))`, { bars: 6 }),
      ex("Some bars of the melody are played backwards.", `
seed 11
voice tune = [^1 ^2 ^3 ^5 ^6 ^5 ^3 ^2].maybe(.5, rev).inst(keys)`, { bars: 4 }),
    ],
    see: ["every", "sometimes"],
  },
  dice: {
    intro: "`dice(list, steps)` picks a new random element from a list on each step. It is the quickest way to an endless melody that stays inside a set of notes. Put rests in the list to leave space.",
    examples: [
      ex("Eight random picks per bar from a pentatonic set.", `
seed 21
voice tune = dice([^1 ^2 ^3 ^5 ^6], 8).inst(pluck)`, { bars: 2 }),
      ex("Rests in the list make silence part of the choice. More rests, more space.", `
seed 21
voice spark = dice([^5 ^8 ^9 ^10 . . .], 16).inst(bell).vel(.35)`, { bars: 2 }),
      ex("Lists can hold anything a phrase can, including whole sub-patterns, so the dice picks beats, not just notes.", `
seed 21
voice drums = dice([[kick hat] [snare hat] [kick kick] [hat hat]], 4)`, { bars: 2 }),
    ],
    see: ["walk", "pick", "scramble"],
  },
  walk: {
    intro: "`walk(list, steps, stride)` takes a random walk through a list: each step moves at most `stride` places from the last. Lines move by small steps, so they sound sung rather than scattered.",
    examples: [
      ex("A walk through a scale, eight steps per bar, one step at a time.", `
seed 4
voice tune = walk([^1 ^2 ^3 ^4 ^5 ^6 ^7 ^8], 8).inst(keys)`, { bars: 2 }),
      ex("A larger stride lets the line leap now and then.", `
seed 4
voice tune = walk([c4 d4 e4 g4 a4 c5 d5 e5], 8, stride: 3).inst(pluck)`, { bars: 2 }),
      ex("Walk through numbers and turn them into scale steps with `degrees`.", `
seed 4
key d dorian
voice line = walk(0..10, 8).degrees.inst(bell).vel(.5)`, { bars: 2 }),
    ],
    see: ["dice", "evolve"],
  },
  scramble: {
    intro: "`scramble` shuffles the elements of a phrase into a new order each bar. The notes are always the same ones, so the harmony holds while the line changes.",
    examples: [
      ex("A four-note chord shape in a new order every bar.", `
seed 9
voice arp = [c4 e4 g4 b4].scramble.fast(2).inst(pluck)`, { bars: 4 }),
      ex("Scramble a drum bar: the same hits, rearranged.", `
seed 9
voice drums = [kick hat snare hat kick kick snare hat].scramble`, { bars: 4 }),
      ex("Inside `every`, the line is scrambled only once in a while.", `
seed 9
voice tune = [^1 ^2 ^3 ^5 ^6 ^5 ^3 ^2].every(4, p => p.scramble).inst(keys)`, { bars: 4 }),
    ],
    see: ["shuffle", "dice"],
  },
  rand: {
    intro: "`rand()` is a random number from 0 up to 1. It is decided when the code runs, once per call, so use it to set up a piece. Inside `per_bar` or `map` it is decided per bar or per note.",
    examples: [
      ex("A random tempo between 90 and 110, fixed by the seed.", `
seed 30
tempo 90 + floor(rand() * 20)
voice beat = [kick hat snare hat]`),
      ex("Inside `per_bar`, it is decided again for each bar. Here each bar gets its own loudness.", `
seed 30
voice hats = per_bar(n => [hat*8].vel(.3 + rand() * .6))`, { bars: 4 }),
      ex("Print it to see the number the seed gives.", `
seed 30
print(rand(), rand())
voice tone = [c4]`),
    ],
    see: ["rand_int", "noise", "chance"],
  },
  rand_int: {
    intro: "`rand_int(lo, hi)` is a random whole number from lo to hi, both included.",
    examples: [
      ex("Choose a transposition for the whole piece.", `
seed 12
let shift = rand_int(-3, 3)
voice tune = [c4 e4 g4 e4].transpose(shift).inst(pluck)`),
      ex("Inside `per_bar`, each bar picks its own number. Here it is how many times each note repeats.", `
seed 12
voice hats = per_bar(n => [hat hat hat hat].ply(rand_int(1, 3)))`, { bars: 4 }),
      ex("Random octave jumps on a bass line, decided bar by bar.", `
seed 12
voice bass = per_bar(n => [c2 . c2 g1].octave(rand_int(0, 1))).inst(bass)`, { bars: 4 }),
    ],
    see: ["rand", "pick"],
  },
  pick: {
    intro: "`pick(list)` is one random element of a list. Like `rand`, it is decided when the code runs, or per bar inside `per_bar`.",
    examples: [
      ex("Pick an instrument for the piece.", `
seed 14
voice tune = [c4 e4 g4 c5].inst(pick([pluck bell keys]))`),
      ex("Inside `per_bar`, a new chord each bar from a small set.", `
seed 14
voice keys = per_bar(n => pick([^1@7 ^4@9 ^6@7 ^2@7])).strum.inst(keys)`, { bars: 4 }),
      ex("Pick a whole pattern: each bar gets one of three drum grooves.", `
seed 14
voice drums = per_bar(n => pick([[kick hat snare hat] [kick kick snare .] [kick . snare snare]]))`, { bars: 4 }),
    ],
    see: ["weighted", "dice", "rand"],
  },
  weighted: {
    intro: "`weighted(list, weights)` picks one element, with each chosen in proportion to its weight. Use it when some choices should be common and others rare.",
    examples: [
      ex("The tonic chord most of the time, the others less often.", `
seed 16
voice keys = per_bar(n => weighted([^1@7 ^4@7 ^5@7], [5 2 1])).strum.inst(keys)`, { bars: 8 }),
      ex("Mostly quarter notes, sometimes eighths, rarely a triplet.", `
seed 16
voice hats = per_bar(n => weighted([[hat*4] [hat*8] [hat*12]], [6 3 1]))`, { bars: 4 }),
    ],
    see: ["pick", "dice"],
  },
  shuffle: {
    intro: "`shuffle(list)` puts a list in a random order, decided once. Where `scramble` reshuffles every bar, `shuffle` gives one fixed order, so it makes a riff.",
    examples: [
      ex("A scale in a random order makes a riff. Change the seed for another.", `
seed 18
voice riff = shuffle([^1 ^2 ^3 ^4 ^5 ^6 ^7 ^8]).inst(pluck)`, { bars: 2 }),
      ex("Shuffle a drum bar once and keep it.", `
seed 18
voice drums = shuffle([kick kick snare hat hat hat . .])`, { bars: 2 }),
    ],
    see: ["scramble", "pick"],
  },
  chance: {
    intro: "`chance(prob)` is true with the given probability. Use it with `if` to decide between two things.",
    examples: [
      ex("Decide once whether the piece has a bass line.", `
seed 20
voice beat = [kick hat snare hat]
voice bass = if chance(.5) then [c2 . c2 g1].inst(bass) else [c3 . . .].inst(bass)`),
      ex("Inside `per_bar`, each bar decides for itself: here, whether to play a fill.", `
seed 20
voice drums = per_bar(n => if chance(.3) then [snare*8] else [kick hat snare hat])`, { bars: 8 }),
    ],
    see: ["maybe", "rand"],
  },
};
