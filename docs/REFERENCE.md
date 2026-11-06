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

## Built-in functions

Any function can be called as `f(x, y)` or, on its first argument, as `x.f(y)`. With no other arguments the parentheses are optional: `p.rev`.

### Time

| Function | Description |
| --- | --- |
| `fast(p, n)` | Play p n times faster (n times per bar). |
| `slow(p, n)` | Stretch p over n bars. |
| `late(p, t)` | Delay p by t bars: in 4/4, 1/8 is an eighth note. |
| `early(p, t)` | Shift p earlier by t bars. |
| `rev(p)` | Reverse p within each bar. On a list, reverses the list. |
| `every(p, n, f, at: n-1)` | Apply f on one bar out of every n (the last one by default, where fills belong). |
| `palindrome(p)` | Play p forwards, then backwards, alternating bars. |
| `iter(p, n)` | Rotate the start of p by 1/n each bar. |
| `off(p, t, f)` | Layer p with a copy shifted by t bars and transformed by f. |
| `echo(p, times: 3, time: 1/8, decay: 0.6)` | Repeat each event, quieter each time. |
| `ply(p, n)` | Repeat each event n times within its own length. n may be a pattern. |
| `swing(p, amount: 1/3, div: 8)` | Delay every second subdivision (eighths by default) by a fraction of a step. |
| `stack(a, b, ...)` | Play patterns at the same time. |
| `cat(a, b, ...)` | One pattern per bar, in turn. |
| `seq(a, b, ...)` | Squeeze patterns one after another into a single bar. |
| `arrange(p1, bars1, p2, bars2, ...)` | Chain patterns, each lasting the given number of bars, and loop the whole. |
| `poly(p, steps)` | Polymeter: step through p's elements at `steps` per bar, whatever its length. |
| `euclid(p, hits, steps, rot: 0)` | Spread `hits` events as evenly as possible over `steps` (Euclidean rhythm). |
| `trunc(p, fraction)` | Play only the first fraction of each bar. |
| `per_bar(bar => pattern)` | Build each bar from a function of the bar number. Randomness inside is keyed to the bar. |
| `evolve(start, (state, bar) => next, (state, bar) => pattern)` | Carry state from bar to bar. Bar 0 plays view(start); each later bar's state is step(previous state, bar). Replayable: states are always computed forward from bar 0. |
| `loop(p, bars)` | Repeat the first `bars` bars of p forever. |

### Chance

| Function | Description |
| --- | --- |
| `humanize(p, time: 0.004, vel: 0.1)` | Seeded random drift in timing (bars) and velocity. Replayable like all randomness. |
| `degrade(p, amount: 0.5)` | Randomly drop events (seeded). |
| `sometimes(p, prob, f)` | Apply f to each event with the given probability (seeded). |
| `often(p, f)` | Apply f to about 75% of events. |
| `rarely(p, f)` | Apply f to about 25% of events. |
| `maybe(p, prob, f)` | Apply f to whole bars with the given probability (seeded). |
| `dice(list, steps: 1)` | A new seeded random pick from list on each of `steps` steps per bar. |
| `walk(list, steps: 8, stride: 1)` | A seeded random walk through list: each step moves at most `stride` places. |
| `scramble(p)` | Shuffle the elements of a phrase into a new seeded order each bar. |
| `rand()` | A seeded random number in [0, 1). Same seed, same number. |
| `rand_int(lo, hi)` | A seeded random whole number from lo to hi inclusive. |
| `pick(list)` | One seeded random element of list. |
| `weighted(list, weights)` | A seeded random element, chosen in proportion to weights. |
| `shuffle(list)` | The list in a seeded random order (decided once). |
| `chance(prob)` | true with the given probability (seeded). |

### Pitch

| Function | Description |
| --- | --- |
| `transpose(p, semitones)` | Move by semitones (fractions allowed: 0.5 is a quarter tone). Works on notes, degrees, chords and patterns. |
| `octave(p, n)` | Move by n octaves (of the scale's period for degrees). |
| `step(p, n)` | Move by n steps of the current scale (diatonic transposition). |
| `degrees(p)` | Treat numbers as 0-based scale steps: [0 2 4].degrees is [^1 ^3 ^5]. |
| `key(root, scale) or p.key(root, scale)` | Make a key, or play p in a key. Degrees like ^3 resolve against it. |
| `chord(root, quality)` | A chord: chord(c4, "maj7") is the same as c4@maj7. |
| `invert(p, n: 1)` | Chord inversion: move the lowest n notes up an octave. |
| `arp(p, mode: "up")` | Spread each chord's notes across its length. Modes: up, down, updown, downup, out, random. |
| `strum(p, spread: 1/48)` | Roll each chord's notes, low to high, `spread` bars apart. |
| `hz(pitch)` | Frequency of a pitch in Hz (at the current tuning). |
| `note_num(pitch)` | The (possibly fractional) MIDI note number of a pitch. |
| `pitch(n)` | A pitch from a MIDI note number (fractions allowed). |
| `ratio(r)` | The size of a frequency ratio in semitones: ratio(3/2) is about 7.02. |
| `scale(semitones, period: 12)` | A scale from semitone offsets (fractions allowed). |
| `just(ratios, period: 2)` | A just-intonation scale from frequency ratios, e.g. just([1 9/8 5/4 3/2 5/3]). |
| `edo(n, steps)` | An n-tone equal division of the octave. With steps, a scale picked from it: edo(31, [0 5 10 13 18 23 28]). |
| `cents(list, period: 1200)` | A scale from offsets in cents. |
| `scala(text)` | A scale from the text of a Scala .scl file (the common microtonal tuning format). |
| `scala_file(path)` | A scale loaded from a Scala .scl file next to your piece. |
| `mode(scale, n)` | Rotate a scale to start on its n-th degree (1-based): mode(major, 2) is dorian. |

### Sound

| Function | Description |
| --- | --- |
| `vel(p, v)` | Velocity 0 to 1. v may itself be a pattern: .vel([1 .5 .7 .5]). |
| `legato(p, x)` | Note length as a fraction of its step (1 = full, 0.5 = staccato). |
| `gain(p, x)` | Output level multiplier for the built-in synth. |
| `pan(p, x)` | Stereo position from -1 (left) to 1 (right). |
| `cutoff(p, hz)` | Filter cutoff for the built-in synth. |
| `res(p, x)` | Filter resonance 0 to 1. |
| `attack(p, seconds)` | Envelope attack time. |
| `release(p, seconds)` | Envelope release time. |
| `decay(p, seconds)` | Envelope decay time. |
| `sustain(p, level)` | Envelope sustain level 0 to 1. |
| `reverb(p, amount)` | Send to the built-in reverb, 0 to 1. |
| `hpf(p, hz)` | High-pass filter on the whole voice: removes rumble below hz. Unlike cutoff, which shapes each note, this filters the voice's mix. |
| `lpf(p, hz)` | Low-pass filter on the whole voice: darkens everything above hz. Try .lpf(sine(8).range(400, 3400)) for a sweep. |
| `drive(p, amount)` | Saturation on the whole voice, 0 (clean) to 1 (crushed). Chords distort together, like an amp. |
| `delay(p, mix, time: 3/16, feedback: .4)` | An echo on the whole voice. mix 0 to 1; time in bars (3/16 is a dotted eighth in 4/4); feedback 0 to .95 sets how many repeats. |
| `dur(p, beats)` | Fixed note length in beats, independent of the step length. |
| `set(p, name, value)` | Attach any named parameter to events (it is passed through to MIDI CC maps and exports). |
| `inst(p, name, ...options)` | Choose a built-in instrument: keys, sine, tri, saw, square, pluck, bass, pad, bell, organ, kit, or a loaded sample name. |
| `sample(p, name, fit: false)` | Play a loaded audio sample (drop files into the DAW). With fit: true it is stretched to the event length, for loops. |
| `midi(p, channel: 1, port: "")` | Send to an external MIDI device instead of the built-in synth. |
| `ctl(p, number, value)` | Send a MIDI control change (value 0 to 1) just before each note. value may be a pattern or signal: .ctl(74, sine(4)). |
| `program(p, n)` | Choose an instrument on external gear with a MIDI program change (1 to 128, as printed in General MIDI lists). It is sent only when it changes. |
| `as_cc(p, number, rate: 16)` | Turn a voice of numbers (0 to 1) into MIDI control changes instead of notes: voice sweep = sine(4).as_cc(74).midi(1). A signal is sampled `rate` times per bar. |
| `mpe(p)` | Send each note on its own MIDI channel (2 to 16) so microtonal pitch bends do not collide. |

### Input

| Function | Description |
| --- | --- |
| `cc(number, channel: any)` | A live signal (0 to 1) from a MIDI controller knob or fader. |
| `held(steps: 1)` | The notes currently held on your MIDI keyboard, as a chord, sampled `steps` times per bar. Try held(4).arp. |

### Generators

| Function | Description |
| --- | --- |
| `sine(period: 1)` | A smooth signal from 0 to 1 and back, once per `period` bars. |
| `tri(period: 1)` | A triangle signal, 0 up to 1 and back. |
| `saw(period: 1)` | A ramp from 0 to 1 every `period` bars. |
| `square(period: 1)` | Alternates between 0 and 1. |
| `noise(rate: 16)` | A seeded random signal holding a new value `rate` times per bar. |
| `drift(rate: 1)` | A smooth seeded random signal, wandering between 0 and 1. |
| `range(signal, lo, hi)` | Rescale a 0..1 signal or pattern to lo..hi. |
| `seg(signal, n)` | Sample a signal n times per bar, turning it into discrete events. |
| `run(n)` | The phrase [0 1 2 ... n-1]. |

### Lists

| Function | Description |
| --- | --- |
| `len(list)` | Number of elements. |
| `at(list, i)` | Element i (0-based; wraps around, so negative counts from the end). |
| `map(p, f)` | Apply f to every element of a list, or every event of a pattern. |
| `filter(list, f)` | Keep elements (or events) for which f is true. |
| `fold(list, start, f)` | Combine elements left to right: fold([1 2 3], 0, (a, x) => a + x). |
| `concat(a, b, ...)` | Join lists into one longer list (one bar, more steps). |
| `repeat(x, n)` | A list of n copies of x. |
| `take(list, n)` | The first n elements. |
| `drop(list, n)` | All but the first n elements. |
| `rotate(list, n)` | Rotate a list left by n places. |
| `sum(list)` | Add up the elements. |

### Math

| Function | Description |
| --- | --- |
| `floor(x)` | Round down. |
| `ceil(x)` | Round up. |
| `round(x)` | Round to nearest. |
| `abs(x)` | Absolute value. |
| `sqrt(x)` | Square root. |
| `sin(x)` | Sine (radians). |
| `cos(x)` | Cosine (radians). |
| `log2(x)` | Base-2 logarithm. |
| `exp(x)` | e to the power x. |
| `min(a, b, ...)` | Smallest value. |
| `max(a, b, ...)` | Largest value. |
| `clamp(x, lo, hi)` | Limit x to the range lo..hi. |
| `lerp(a, b, t)` | Linear blend from a to b. |

### Misc

| Function | Description |
| --- | --- |
| `print(x, ...)` | Show values in the console. |
| `str(x)` | Text form of a value. |
| `type(x)` | The name of a value's type. |

## Scales

| Name | Steps (semitones) |
| --- | --- |
| `major` | 0 2 4 5 7 9 11 |
| `minor` | 0 2 3 5 7 8 10 |
| `ionian` | 0 2 4 5 7 9 11 |
| `dorian` | 0 2 3 5 7 9 10 |
| `phrygian` | 0 1 3 5 7 8 10 |
| `lydian` | 0 2 4 6 7 9 11 |
| `mixolydian` | 0 2 4 5 7 9 10 |
| `aeolian` | 0 2 3 5 7 8 10 |
| `locrian` | 0 1 3 5 6 8 10 |
| `harmonic_minor` | 0 2 3 5 7 8 11 |
| `melodic_minor` | 0 2 3 5 7 9 11 |
| `major_pent` | 0 2 4 7 9 |
| `minor_pent` | 0 3 5 7 10 |
| `blues` | 0 3 5 6 7 10 |
| `whole_tone` | 0 2 4 6 8 10 |
| `chromatic` | 0 1 2 3 4 5 6 7 8 9 10 11 |
| `hirajoshi` | 0 2 3 7 8 |
| `double_harmonic` | 0 1 4 5 7 8 11 |
| `just_major` | 0 2.04 3.86 4.98 7.02 8.84 10.88 |
| `slendro` | 0 2.4 4.8 7.2 9.6 |
| `bohlen_pierce` | 0 1.33 3.02 4.35 5.83 7.37 8.84 10.18 11.65 (period 19.02) |

## Chord qualities

On a pitch: `c4@maj7`. On a degree, numbers count diatonic chord tones (`^5@7` is the seventh chord on the fifth degree) and names give a fixed quality (`^2@m7`).

| Quality | Semitones |
| --- | --- |
| `5` | 0 7 |
| `6` | 0 4 7 9 |
| `7` | 0 4 7 10 |
| `9` | 0 4 7 10 14 |
| `11` | 0 4 7 10 14 17 |
| `13` | 0 4 7 10 14 21 |
| `maj` | 0 4 7 |
| `M` | 0 4 7 |
| `min` | 0 3 7 |
| `m` | 0 3 7 |
| `dim` | 0 3 6 |
| `aug` | 0 4 8 |
| `sus2` | 0 2 7 |
| `sus4` | 0 5 7 |
| `power` | 0 7 12 |
| `m6` | 0 3 7 9 |
| `dom7` | 0 4 7 10 |
| `maj7` | 0 4 7 11 |
| `M7` | 0 4 7 11 |
| `m7` | 0 3 7 10 |
| `min7` | 0 3 7 10 |
| `mmaj7` | 0 3 7 11 |
| `dim7` | 0 3 6 9 |
| `m7b5` | 0 3 6 10 |
| `hdim` | 0 3 6 10 |
| `aug7` | 0 4 8 10 |
| `maj9` | 0 4 7 11 14 |
| `m9` | 0 3 7 10 14 |
| `add9` | 0 4 7 14 |
| `m11` | 0 3 7 10 14 17 |
| `otonal` | 0 3.86 7.02 9.69 |
| `utonal` | 0 -3.86 -7.02 -9.69 |

## Drums

| Name | General MIDI note |
| --- | --- |
| `kick` | 36 |
| `kick2` | 35 |
| `rim` | 37 |
| `snare` | 38 |
| `clap` | 39 |
| `snare2` | 40 |
| `tom1` | 41 |
| `hat` | 42 |
| `tom2` | 43 |
| `pedal` | 44 |
| `tom3` | 45 |
| `ohat` | 46 |
| `tom4` | 47 |
| `tom5` | 48 |
| `crash` | 49 |
| `tom6` | 50 |
| `ride` | 51 |
| `china` | 52 |
| `ridebell` | 53 |
| `tamb` | 54 |
| `splash` | 55 |
| `cowbell` | 56 |
| `crash2` | 57 |
| `ride2` | 59 |
| `bongo` | 60 |
| `bongo2` | 61 |
| `conga` | 62 |
| `conga2` | 63 |
| `shaker` | 70 |
| `clave` | 75 |
| `block` | 76 |

## Instruments

| Name | Sound |
| --- | --- |
| `keys` | Electric piano: FM tines, warm and bell-like. The default. |
| `sine` | Pure sine wave. |
| `tri` | Triangle wave, soft and hollow. |
| `saw` | Sawtooth through a low-pass filter, bright. |
| `square` | Square wave, reedy. |
| `pluck` | Plucked string (Karplus-Strong). |
| `bass` | Saw-and-sub bass with a filter envelope. |
| `pad` | Three detuned saws, slow attack, wide. |
| `bell` | FM bell with a long ring. |
| `organ` | Drawbar-style additive organ. |
| `lead` | Detuned square and saw lead. |
| `kit` | Drum kit: plays General MIDI drum note numbers (kick, snare, hat, ...). |
