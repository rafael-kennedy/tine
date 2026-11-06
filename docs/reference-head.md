# Tine language reference

## Files and statements

A Tine file (`.tine`) is a list of statements, one per line. Blocks are indented. Comments start with `--`.

| Statement | Meaning |
| --- | --- |
| `voice name = pattern` | A named part. Top-level voices loop forever. |
| `let name = value` | Name a value. |
| `let fn(x, y) = expression` | Define a function. The body may be an indented block whose last line is the result. |
| `tempo 120` | Beats per minute, where a beat is the meter's denominator. |
| `meter 7/8` | Beats per bar and the beat unit. Default 4/4. One bar is one cycle. |
| `key d dorian` | The key that scale degrees resolve against. Default `c major`. |
| `seed 1234` | Fix all randomness. Without it, each run picks a seed and reports it. |
| `tuning 432` | Frequency of A4 in Hz. Default 440. |
| `section name 8` | An indented block of voices (and tempo/key) lasting 8 bars. |
| `form intro verse*2 chorus` | Play sections in this order. Makes the file a finished piece. |
| `use "other.tine"` | Run another file here (its lets and voices become available). |

A line that starts with `.` continues the line above, for long method chains.

## Values

| Kind | Examples |
| --- | --- |
| number | `3`, `0.25`, `3/4` (exact), `25c` (cents, as semitones), `5\31` (steps of 31-EDO, as semitones) |
| pitch | `c4`, `f#3`, `eb`, `440hz`, `60` (MIDI number in a phrase), `c4 + 50c`, `c4 * 3/2` |
| degree | `^1`, `^b3`, `^#4`, `^0`, `^-2` |
| chord | `{c e g}`, `c4@maj7`, `^5@7`, `chord(c4, "m9")` |
| drum | `kick`, `snare`, `hat`, ... (General MIDI notes) |
| phrase / list | `[c e g]`, `0..7`, `run(8)` |
| pattern | anything built from phrases and functions |
| signal | `sine(4)`, `drift(1)`, `cc(74)` |
| text | `"hello"` |
| boolean | `true`, `false` |
| record | `(root: d, scale: dorian)`; read with `.root` |
| function | `x => x + 1`, `(a, b) => a * b` |
| key, scale | `key(d, dorian)`, `edo(31, [0 5 10])`, `just([1 5/4 3/2])` |

**Note names are reserved.** Any word made of a letter `a` to `g`, optional `#`/`b` accidentals and an optional octave digit is a note. It cannot be used as a variable or parameter name (voice names and record fields are fine).

## Phrases

| Write | Meaning |
| --- | --- |
| `[a b c]` | three steps dividing one bar equally |
| `.` | rest |
| `_` | hold the previous step one step longer |
| `x:3` | x takes 3 steps' worth of time |
| `[a [b c]]` | nested brackets subdivide one step |
| `x*3` | x three times within its step |
| `x!3` | x repeated as three steps |
| `{a b c}` | simultaneously: a chord, or layered patterns |
| `<a b c>` | one per bar, in turn (each advances only when it plays) |
| `a\|b\|c` | seeded random choice, once per bar (or per step when sped up) |
| `x?` `x?0.3` | seeded chance to play (50%, 30%) |
| `x@maj7` | chord on x |
| `(expr)` | any expression inside a phrase |
| `name` | variables (including drums and other phrases) can appear directly |

Numbers in a phrase are MIDI note numbers (fractions allowed).

## Operators

| Operator | On numbers | On pitches | On patterns |
| --- | --- | --- | --- |
| `+ -` | arithmetic | move by semitones | applied to every event |
| `*` | multiply | multiply frequency (`c4 * 3/2`) | `p * n` plays p n times per bar |
| `/` | divide (exact) | divide frequency | `p / n` stretches p over n bars |
| `%` `**` | remainder, power | | applied to every event |
| `== != < > <= >=` | compare | compare by pitch | |
| `and or not` | logic | | |
| `..` | `0..7` is the list 0 to 7 | | |
| `@` | | chord quality | |

When two patterns are combined (`[c e] + [0 7 12]`), the rhythm comes from the left one and the right one is sampled at each note.

Degrees add in scale steps: `^1 + 2` is `^3`.

## Time

Time is measured in bars and is exact. A phrase fills one bar; `slow(2)` spreads it over two. `every(n, f)` applies f on the last bar of each group of n (use `at: 0` for the first). Inside a section, time restarts at the section's first bar.

## Randomness

Every random decision is a hash of the seed, the voice name, the random site, the bar and the position in the bar. The same seed always gives the same music; changing one voice never changes the random choices of another; querying bars out of order gives the same result.

## MIDI

| Code | Effect |
| --- | --- |
| `.midi(ch)` | send to an external device on channel ch (in the DAW) |
| `.midi(ch, port: "name")` | choose the output port by name |
| `.mpe` | one channel per note (2 to 16), so microtonal pitch bends do not collide |
| `cc(n)` | controller n as a 0 to 1 signal |
| `held(steps)` | notes held on the keyboard, as a chord |
| `.ctl(74, v)` | send control change 74 (v from 0 to 1, a number, pattern or signal) before each note |
| `.program(n)` | program change, 1 to 128 as General MIDI lists number them; sent only when it changes |
| `sine(4).as_cc(74)` | a voice of control changes instead of notes, sampled 16 times a bar (`rate:` to change) |

Fractional pitches are sent as pitch bend with a range of 2 semitones, reset after each microtonal note. Exported MIDI files contain one track per voice, tempo and meter, program and control changes, and the seed in a text event.

In the DAW's MIDI panel, *send MIDI clock* makes other gear follow Tine, and *follow MIDI clock* makes Tine follow other gear: its tempo (measured from the clock and smoothed), start, continue and stop. Following works on tempo and phase in live mode; in form mode it follows start and stop only.

## Effects

Each voice has a bus with four effects, always in this order: high-pass, low-pass, drive, delay. They act on the voice's mix, so a delay repeats the whole voice and drive distorts a chord as one sound.

| Code | Effect |
| --- | --- |
| `.hpf(hz)` | high-pass filter: removes everything below hz |
| `.lpf(hz)` | low-pass filter: removes everything above hz (`cutoff` instead filters each note inside the synth) |
| `.drive(x)` | saturation from 0 (clean) to 1 (crushed) |
| `.delay(mix, time: 3/16, feedback: .4)` | echo. time is in bars, so it follows the tempo; feedback sets how many repeats |

Settings can be patterns or signals (`.lpf(sine(8).range(400, 3400))`), and the latest note sets the bus. Remove an effect from the code and it turns off at the next bar line.

## State across bars

`evolve(start, (state, bar) => next, (state, bar) => pattern)` keeps a value that changes from bar to bar, like a counter, a random walk or a voice-led chord. The state at bar n is the step applied n times to `start`, so any bar can be played in any order and always sounds the same. Without the third argument, the state itself is played. Each section starts again from `start`.

```tine
voice walk = evolve(c4, (p, bar) => p + pick([-2 -1 1 2]), (p, bar) => [p (p + 7) (p + 12) (p + 7)])
```

## Command line

```
tine                      REPL
tine play | render | midi | roll | check  <file>
tine xml <file>           MusicXML score for MuseScore, Dorico, Sibelius, Finale
tine daw [file]           live-coding DAW in the browser
tine learn                interactive tutorial
tine pack <file>          single-file HTML player
tine pack <file> --exe    standalone executable for one piece
tine new <name>           new piece from a template
tine lsp                  language server
```
