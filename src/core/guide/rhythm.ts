import { Guide, ex } from "./types";

// The rhythm layer: rhythm, notes and on, the hit symbols x X o, the rhythm
// operators, and .beats lengths.
export const RHYTHM: Record<string, Guide> = {
  beats: {
    intro: "`.beats` measures a phrase's steps in beats instead of dividing one bar. Each step is a beat unless `:` says otherwise, so `c:3/2` is a dotted quarter in 4/4. The line lasts as long as its steps add up to, crosses bar lines, and rests to the end of its last bar before it loops.",
    examples: [
      ex("A melody written the way it is counted: dotted quarter, eighth, three triplets in two beats, and so on. It lasts three bars.", `
voice tune = [c4:3/2 d4:1/2 [e4 f4 g4]:2 a4:3 g4:1/2 f4:1/2 e4:4].beats.inst(keys)`, { bars: 3 }),
      ex("A line that is not a whole number of bars rests until the next bar line. These five beats take two bars of 4/4, with three beats of rest.", `
voice call = [g4 e4 g4 a4 g4].beats.inst(pluck)
voice beat = [kick hat snare hat]`, { bars: 2 }),
      ex("Give a unit to count in other note values. In sixteenths, `:3` is a dotted eighth.", `
voice bass = [c2:3 c2:3 c2:2 eb2:3 f2:3 g2:2].beats(1/16).inst(bass)`),
      ex("Beats follow the meter's beat unit. In 6/8 a beat is an eighth note, so these six beats fill one bar.", `
meter 6/8
voice jig = [d4:2 e4 f#4:2 a4].beats.inst(pluck)`),
    ],
    see: ["on", "slow", "rhythm"],
  },
  rhythm: {
    intro: "`.rhythm` keeps a pattern's timing and drops its pitches: every note becomes a hit. With `notes` and `on`, it takes a pattern apart so you can change when things happen without touching what happens.",
    examples: [
      ex("Borrow the rhythm of a melody for a drum. The rim plays exactly when the tune does. A hit plus a pitch takes that pitch.", `
let tune = [c4 . e4 g4:2 . a4 g4]
voice lead = tune.inst(pluck)
voice rim  = tune.rhythm + rim`),
      ex("Take one tune's rhythm and pour another tune's notes into it.", `
let first  = [c4:2 e4 g4 . c5 b4 g4]
let second = [^5 ^4 ^3 ^2 ^1]
voice tune = second.on(first.rhythm).inst(keys)`, { bars: 5 }),
      ex("A rhythm can be changed with the rhythm operators before the notes go back in. Here the melody's rhythm is flipped to fill its gaps.", `
let tune = [c4 . e4 . g4 g4 . .]
voice lead  = tune.inst(pluck)
voice reply = [e5 d5 c5].on(tune.rhythm.flip).inst(bell).vel(.5)`, { bars: 3 }),
    ],
    see: ["notes", "on", "flip"],
  },
  notes: {
    intro: "`.notes` keeps a pattern's pitches, in the order they play, and drops their timing. The result is a list, ready to be poured into a different rhythm with `on`. Notes that start together come out as one chord.",
    examples: [
      ex("The notes of a tune, played on a new rhythm: a dotted pattern instead of even eighths.", `
let tune = [c4 d4 e4 g4 e4 d4 c4 .]
voice lead = tune.notes.on([x:3 x x:2 x:2]).inst(pluck)`, { bars: 2 }),
      ex("`print` shows what `notes` gives back. Chords stay together.", `
let comp = [c4@maj . f4@maj g4@7]
print(comp.notes)
voice keys = comp.notes.on([x . x x . x x .]).inst(keys)`),
      ex("A pattern that changes each bar needs `bars:` to collect more than one bar of notes.", `
let line = <[c4 e4 g4] [d4 f4 a4]>
voice lead = line.notes(bars: 2).on([x x . x x . x .]).inst(bell)`, { bars: 3 }),
    ],
    see: ["rhythm", "on"],
  },
  on: {
    intro: "`notes.on(rhythm)` plays the notes one per hit. The two loop on their own, counted from the start of the section, so seven notes on a five-hit rhythm come round together every seven bars. That is how a short riff stays fresh for a long time. In the notes, `.` leaves a hit silent and `_` holds a note through the next hit.",
    examples: [
      ex("Write a rhythm like drum tab: `x` is a hit, `X` an accent, `o` a ghost note. Three notes on that rhythm.", `
voice lead = [^1 ^3 ^5].on([X . . x . . X . . . x . X . . .]).inst(pluck)`, { bars: 2 }),
      ex("Seven notes on a five-hit clave. The melody starts in a different place in the rhythm each bar.", `
let riff  = [^1 ^3 ^5 ^4 ^3 ^2 ^1]
let clave = [X . . x . . X . . . x . X . . .]
voice lead = riff.on(clave).inst(keys)
voice bass = clave + c2`, { bars: 4 }),
      ex("In the notes, `.` silences a hit and `_` ties through it, so a phrase can breathe without changing the rhythm.", `
voice lead = [c4 e4 _ g4 . a4].on([x x x x x x x x]).inst(pluck)`, { bars: 2 }),
      ex("`reset:` starts the notes again every n bars, so a long phrase lines up with a short rhythm on a schedule you choose.", `
voice lead = [^1 ^2 ^3 ^4 ^5 ^6 ^7].on([x . x x . x . x], reset: 2).inst(bell)`, { bars: 4 }),
    ],
    see: ["rhythm", "notes", "poly", "rotate"],
  },
  displace: {
    intro: "`displace(t)` moves every hit t bars later, wrapping round inside the rhythm's loop. It keeps the rhythm and changes where it sits against the beat.",
    examples: [
      ex("A sixteenth late: the same rhythm, now off the beat.", `
let r = [x . . x . . x . x . . x . . x .]
voice a = r + rim
voice b = r.displace(1/16) + clap`),
      ex("Displace by a beat to start a riff in a new place. Here notes fill the moved rhythm.", `
voice bass = [c2 g1 bb1].on([x . x . . x . .].displace(1/4)).inst(bass)
voice kick = [kick . . .]*2`, { bars: 3 }),
      ex("Displacement inside `every` gives a rhythm that stumbles once in a while.", `
voice perc = [x . x x . x . .].every(4, r => r.displace(1/8)) + rim`, { bars: 4 }),
    ],
    see: ["rotate", "late", "mutate"],
  },
  flip: {
    intro: "`flip` turns hits into rests and rests into hits, on the rhythm's own grid. It gives the answer to a rhythm: the part that fills its gaps.",
    examples: [
      ex("A kick pattern and its flip on the hats make a complete, interlocking beat.", `
let k = [x . . x . . x .]
voice kick = k + kick
voice hats = k.flip + hat`),
      ex("Call and response: one line plays the rhythm, the other plays in its gaps.", `
let r = [x x . x . . x .]
voice call  = [c4 e4 g4 e4].on(r).inst(pluck)
voice reply = [g4 a4 b4 a4].on(r.flip).inst(bell).vel(.5)`, { bars: 2 }),
      ex("Flipping a rhythm with only a few hits gives a busy one, so it suits a quiet ghost part.", `
let back = [. . . . x . . . . . . . x . . .]
voice snare = back + snare
voice ghost = back.flip.thin(6) + snare.vel(.25)`, { bars: 2 }),
    ],
    see: ["minus", "union", "rhythm"],
  },
  thin: {
    intro: "`thin(n)` removes n hits from each loop of a rhythm. It never removes the downbeat, and which hits go is seeded, so a thinned rhythm replays the same way.",
    examples: [
      ex("Sixteenth hats with four hits taken out of each bar.", `
voice hats = [x*16].thin(4) + hat`, { bars: 2 }),
      ex("Thin a busy melody's rhythm to give it room. The notes still play in order.", `
voice lead = [^1 ^2 ^3 ^5 ^6 ^5 ^3 ^2].on([x*8].thin(3)).inst(pluck)`, { bars: 2 }),
      ex("A rhythm that thins more as the bars go by, using a different amount each bar.", `
voice perc = per_bar(n => [x*8].thin(n % 4 * 2)) + rim`, { bars: 4 }),
    ],
    see: ["fill", "degrade", "minus"],
  },
  fill: {
    intro: "`fill(n)` adds n hits on empty steps of each loop of a rhythm. Which steps get filled is seeded. It is the opposite of `thin`.",
    examples: [
      ex("A sparse kick with one extra hit added somewhere in each bar.", `
voice kick = [x . . . x . . .].fill(1) + kick`, { bars: 2 }),
      ex("Fill a rhythm only on the last bar of four, for a busier turnaround.", `
voice snare = [. . x . . . x .].every(4, r => r.fill(3)) + snare`, { bars: 4 }),
      ex("Fill and thin together keep the count of hits the same but change where they are.", `
voice lead = [^1 ^3 ^5 ^6].on([x . x . x . x .].thin(1).fill(1)).inst(pluck)`, { bars: 2 }),
    ],
    see: ["thin", "union", "mutate"],
  },
  union: {
    intro: "`union(a, b)` is every hit of either rhythm. Where both have a hit, there is one hit.",
    examples: [
      ex("Two simple rhythms combined into a more interesting one.", `
let tres = [x . . x . . x .]
let even = [x . x . x . x .]
voice both = union(tres, even) + rim`),
      ex("Union of two Euclidean rhythms is a common way to build a clave or a bell pattern.", `
voice bell = union(x.euclid(3, 8), x.euclid(2, 8, rot: 1)) + cowbell`),
      ex("Use the union as a rhythm for notes: the melody plays wherever either part did.", `
let low  = [x . . . x . . .]
let high = [. . x . . . x x]
voice tune = [^1 ^3 ^5 ^3 ^2].on(union(low, high)).inst(pluck)`, { bars: 2 }),
    ],
    see: ["intersect", "minus", "stack"],
  },
  intersect: {
    intro: "`intersect(a, b)` keeps the hits of a that b also has. It finds where two rhythms agree.",
    examples: [
      ex("Accent the places where a three-beat and a four-beat pattern meet.", `
let threes = [x . . x . . x . . x . . x . . .]
let fours  = [x . . . x . . . x . . . x . . .]
voice a = threes + rim
voice b = intersect(threes, fours) + crash`),
      ex("A bass that plays only where both the kick and a syncopated rhythm do.", `
let four = [x . . x . . x . x . . x . . x .]
let push = [x . x x . x x . x . x x . x x .]
voice low  = [c2 eb2 g1].on(intersect(four, push)).inst(bass)
voice drum = four + kick`, { bars: 2 }),
      ex("Intersect with a rotated copy of itself to keep only the hits that repeat a step apart.", `
let r = [x x . x x x . x]
voice a = intersect(r, r.rotate(1)) + hat`),
    ],
    see: ["union", "minus"],
  },
  minus: {
    intro: "`minus(a, b)` keeps the hits of a that b does not have. It carves one rhythm out of another.",
    examples: [
      ex("Steady eighths with the snare's hits taken out, so the hats leave space for the snare.", `
let back = [. . x . . . x .]
voice snare = back + snare
voice hats  = minus([x*8], back) + hat`),
      ex("A melody that answers the bass, playing only where the bass does not.", `
let under = [x . . x . . x .]
voice low  = [c2 g1 bb1].on(under).inst(bass)
voice high = [e4 g4 a4 c5].on(minus([x*8], under)).inst(bell).vel(.5)`, { bars: 3 }),
      ex("Subtract a thinned copy to get the hits the thinning removed.", `
let r = [x*8]
voice kept = r.thin(3) + hat
voice gone = minus(r, r.thin(3)) + rim`),
    ],
    see: ["flip", "intersect", "union"],
  },
  mutate: {
    intro: "`mutate(rate)` lets a rhythm wander. Each loop, about `rate` of its hits move one step left or right, and they stay moved. Like all randomness in Tine it is seeded and counted from the section's start, so the wandering replays exactly.",
    examples: [
      ex("A clave that slowly drifts away from where it started.", `
seed 4
voice clave = [x . . x . . x . . . x . x . . .].mutate(.15) + clave`, { bars: 8 }),
      ex("The original next to a mutating copy, so you can hear the two pull apart.", `
seed 9
let r = [x . x . . x . x]
voice home = r + rim
voice away = r.mutate(.25) + cowbell`, { bars: 8 }),
      ex("Mutate the rhythm a melody rides on. The notes keep their order; only their timing wanders.", `
seed 2
voice lead = [^1 ^3 ^5 ^4 ^3 ^2].on([X . . x . . X . . . x . X . . .].mutate(.1)).inst(pluck)`, { bars: 8 }),
    ],
    see: ["displace", "thin", "evolve"],
  },
};
