# Tine language reference

## Files and statements

A Tine file (`.tine`) is a list of statements, one per line. Blocks are indented. Comments start with `--`.

| Statement | Meaning |
| --- | --- |
| `voice name = pattern` | A named part. Top-level voices loop forever. |
| `active voice name = pattern` | A voice that plays your edits as soon as they are good, without evaluating, and without waiting for the bar line. |
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

## SuperDirt

`.dirt()` sends a voice to SuperDirt, the sound engine of TidalCycles, over OSC, instead of Tine's own sound. Start SuperDirt in SuperCollider as usual (`SuperDirt.start`), then either open the DAW with `tine daw` (a browser cannot send OSC itself, so `tine daw` does it), or run `tine dirt piece.tine`, which plays every voice through SuperDirt with no browser and picks up the file each time you save it, at the next bar. That makes any text editor a live-coding editor.

| Code | Effect |
| --- | --- |
| `.dirt()` | the sound is chosen for you: a sample name becomes `s` and `n` (`"bd:3"` is `s: bd, n: 3`), a drum name a Dirt-Samples bank (`snare` is `sn`), an instrument the nearest SuperDirt synth (`keys` is `superpiano`) |
| `.dirt("superzow")` | name the SuperDirt sound yourself |
| `.dirt(orbit: 1)` | choose the orbit (SuperDirt's effect bus) |

A Tine bar is a Tidal cycle, so `cps` is bars per second. Tine's parameters are translated where SuperDirt has the same idea: `begin`, `end`, `speed`, `accel` (accelerate), `cut`, `crush`, `coarse`, `drive` (shape), `lpf` and `cutoff` (cutoff), `hpf` (hcutoff), `res`, `vowel`, `room` and its size, `delay`, `ring`, `pan`, `gain`, and `loopAt`. `--dirt host:port` sends somewhere other than 127.0.0.1:57120.

## Performing

| In the code | Effect |
| --- | --- |
| `active voice lead = ...` | edits to this voice are heard within about a quarter of a second of the last keystroke, from the same point in the bar |
| `-- @fill` ... `-- @end` | names a block of lines (a blank line also ends it) |
| `voice hats = [hat*8]  -- @hats` | names one line |

Named blocks appear under *toggles* in the DAW's Tracks panel. Bind each to a key or a MIDI button or pad, and it switches the block's lines off (prefixing them with `--~ `) and on again. A switch takes effect like an evaluation: on the next bar, or at once for active voices. Plain keys work when the editor is not focused; keys with Ctrl, Cmd or Alt work anywhere. `Ctrl/Cmd + /` comments the selected lines in any Tine editor.

## Effects

Each voice has a bus. Its effects act on the voice's mix, so a delay repeats the whole voice and drive distorts a chord as one sound. They always run in this order: high-pass, low-pass, vowel, drive, crush, coarse, ring, chorus, phaser, compressor, delay, room, duck.

| Code | Effect |
| --- | --- |
| `.hpf(hz)` | high-pass filter: removes everything below hz |
| `.lpf(hz)` | low-pass filter: removes everything above hz (`cutoff` instead filters each note inside the synth) |
| `.vowel(v)` | formant filter: `"a"`, `"e"`, `"i"`, `"o"` or `"u"` |
| `.drive(x)` | saturation from 0 (clean) to 1 (crushed) |
| `.crush(bits)` | bit crusher, 1 to 16 bits; fewer is rougher |
| `.coarse(n)` | sample-rate reduction: holds every nth sample |
| `.ring(hz, mix: 1)` | ring modulation by a sine at hz |
| `.chorus(mix: .5, rate: .8, depth: .5)` | detuned, moving copies; rate in Hz |
| `.phaser(mix: .5, rate: .5, depth: .7)` | a sweeping notch; rate in Hz |
| `.compress(threshold: -18, ratio: 4)` | compressor with automatic make-up gain; threshold in dB |
| `.delay(mix, time: 3/16, feedback: .4)` | echo. time is in bars, so it follows the tempo; feedback sets how many repeats |
| `.room(mix: .3, size: .5)` | a reverb on this voice alone |
| `.duck(voice, depth: .8, release: 1/8)` | dips each time the named voice plays a note, and recovers over release bars |
| `.reverb(x)` | how much of the voice goes to the shared room (all voices send to one reverb) |

Settings can be patterns or signals (`.lpf(sine(8).range(400, 3400))`, `.vowel(["a" "o"])`), and the latest note sets the bus. Remove an effect from the code and it turns off at the next bar line.

```tine
voice kick = [kick . . . kick . . .].sample()
voice pad  = <c3 eb3>.inst(pad).chorus(.6).room(.5, size: .8).duck("kick")
voice acid = ([c2 c2 c3 c2 eb2 c2 g2 bb1]*2).inst(saw).vowel(["a" "o"]).phaser(.5)
```

The DAW runs these effects with the same code as WAV export, on the audio thread. A page that cannot start that code (very old browsers) plays only hpf, lpf, drive and delay, and says so.

## Synths

Besides the fixed instruments (`keys`, `pluck`, `bass` and the rest, listed under Instruments below), `synth` is a general synthesizer, and ten named sounds are presets of it: `fm`, `supersaw`, `tb303`, `reese`, `wobble`, `chip`, `brass`, `strings`, `marimba`, `noise`. A preset is only default settings, so any of the calls below changes it: `.inst(tb303).res(.6)`.

| Code | What it does |
| --- | --- |
| `.wave(name)` | the oscillator: `saw`, `square`, `pulse`, `tri`, `sine`, `super` (detuned saws), `fm`, `noise` |
| `.pw(x)` | pulse width, 0 to 1 |
| `.unison(n)`, `.detune(cents)` | how many oscillators, spread over this many cents either side |
| `.sub(x)` | a sine an octave below |
| `.cutoff(hz)`, `.res(x)` | the synth's own low-pass filter |
| `.fenv(octaves, attack: .001, decay: .2)` | filter envelope: the cutoff jumps up and falls back on every note |
| `.wobble(rate: 2, depth: 2)` | the cutoff swings `rate` times per bar, `depth` octaves |
| `.fm(index, ratio: 2, decay: .4)` | two-operator FM; on a plain voice it switches to the FM synth |
| `.vibrato(rate: 5, depth: .3)` | pitch wobble in Hz and semitones |
| `.glide(seconds)` | slide into each note from the one before it |
| `.attack`, `.decay`, `.sustain`, `.release` | the volume envelope |

```tine
voice acid = [a1 a1 a2 a1 c2 a1 g2 a1].inst(tb303).fenv([4 2 3 1]).glide([0 0 .06 0])
voice lead = <[e4 . g4 a4] [b4 . a4 g4]>.inst(supersaw).vibrato(5, depth: .1)
voice wub  = [a0 _ _ _ c1 _ _ _].inst(wobble).wobble([2 4], depth: 4)
```

Glide needs the note before. A pattern is a function of time, so Tine asks the voice for the bar before; in a loop, the first note glides from the loop's last.

## Samples

Tine ships with about 200 CC0 (public domain) sounds: drums, hats, loops, bass hits, ambient beds, tabla, glitches. The Tracks panel in the DAW lists them by bank; click a name to hear it. A sound has a full name (`bd_haus`) and a bank (`bd`, everything named `bd_...`).

```tine
voice beat = ["bd_haus" . "sn_dolf" "bd_haus"]          -- names in a phrase play as recorded
voice hats = ["hat" "hat:3" "hat:5" "hat:7"]              -- a bank, and bank:n for its nth sound
voice kit  = [kick . snare . kick kick snare .].sample()  -- drum names through the bundled kit
voice bass = [c4 . eb4 g4].sample("bass_voxy_c").cut(1)   -- pitched: c4 plays it as recorded
voice amen = ["loop_amen"].loopAt(2).chop(16)             -- a loop that follows the tempo
```

| Code | What it does |
| --- | --- |
| `.sample(name, n: 0)` | play notes on a sound or bank; name and n may be patterns |
| `.begin(x)`, `.end(x)` | play part of the sound, 0 to 1 |
| `.speed(x)` | rate: 2 is an octave up, -1 plays it backwards |
| `.accel(x)` | change the speed by x every second (`speed(1).accel(-1)` is a tape stop) |
| `.loopAt(bars)` | the sound lasts this many bars, whatever the tempo |
| `.chop(n)` | split each note into n notes that play successive parts of the sound |
| `.slice(n, i)` | play piece i of n equal pieces; i may be a pattern |
| `.splice(n, i)` | like slice, stretched to fill each note |
| `.cut(group)` | a sound in the group stops the one before it, in any voice |
| `.fit` | `sample(name, fit: true)` stretches the sound to the note |

**Your own sounds.** Drop audio files on the DAW. Or put them in a `samples` folder next to the piece: files are named by file name, and each subfolder is a bank (`samples/perc/rim.wav` is `"perc/rim"`, and `"perc:0"`). `tine render --samples dir` points elsewhere.

**Packs.** A top-level line `samples("github:tidalcycles/dirt-samples")` loads that repository's `strudel.json`, the sample map most published packs use; `samples("https://.../strudel.json")` loads any map, and `samples("./folder")` a folder. A pack's banks replace bundled banks of the same name, so `"bd"` then means the pack's bd; bundled sounds stay reachable by full name. Sounds download on first use: live, the first hit of a new sound can be silent while it arrives; renders wait for every sound. The command line keeps downloads in `~/.cache/tine`, and reads WAV directly and other formats through ffmpeg if it is installed.

`tine pack` copies the sounds a piece uses into the player, so a packed piece plays offline.

## SoundFonts

A SoundFont (`.sf2`) is one file of recorded instruments. A General MIDI bank gives the 128 standard instruments (piano, strings, brass, guitars...) and drum kits. Tine does not ship one, because good banks are 30 MB and up; load one with a top-level line and play it with `.gm()`:

```
soundfont("GeneralUser-GS.sf2")          -- a file next to the piece
voice piano = <c4@maj a3@m f3@maj g3@maj>.gm(1)
voice tune  = [e5 . d5 c5 . . g4 .].gm("violin")
voice drums = [kick hat snare hat].gm()
```

| Code | What it does |
| --- | --- |
| `soundfont(source)` | load a bank: a path, a URL, or `"github:user/repo/path.sf2"` |
| `.gm(program, bank: 0)` | General MIDI program 1 (piano) to 128, as General MIDI numbers them |
| `.gm("name")` | the first preset whose name contains this |
| `.gm()` on drum names | the bank's drum kit (bank 128) |

Two free General MIDI banks: GeneralUser GS (https://www.schristiancollins.com/generaluser, about 31 MB, free for any music; also at `github:mrbumpy409/GeneralUser-GS/GeneralUser-GS.sf2`) and FluidR3_GM (MIT license, about 140 MB). In the DAW you can also drop an `.sf2` file on the page. Only the first `soundfont(...)` line is used. Packed players do not carry SoundFonts; export a WAV instead.

## State across bars

`evolve(start, (state, bar) => next, (state, bar) => pattern)` keeps a value that changes from bar to bar, like a counter, a random walk or a voice-led chord. The state at bar n is the step applied n times to `start`, so any bar can be played in any order and always sounds the same. Without the third argument, the state itself is played. Each section starts again from `start`.

```tine
voice walk = evolve(c4, (p, bar) => p + pick([-2 -1 1 2]), (p, bar) => [p (p + 7) (p + 12) (p + 7)])
```

## Sheet music and charts

Three printable views of a piece, drawn by Tine itself, with nothing else installed. Each writes an HTML page (open it, print it or save it as PDF) or, with `-o name.svg`, one SVG per page. The DAW shows the same three live in its Sheet tab.

- `tine chart`: a chord chart. Four bars to a line, a boxed mark per section, repeat signs for a section played twice in a row, `%` for a bar that repeats the one before, `N.C.` for silence, and a road map when sections come back later in the form. A piece without `form` is charted for its loop.
- `tine lead`: a lead sheet. The melody on one staff with the chords above it, sections printed once as in the chart.
- `tine score`: every voice on its own staff, bar for bar, chord symbols above the top staff. Drums go on a percussion staff with cross noteheads for cymbals.

Where chords come from: voices whose notes came from chord symbols (`changes(...)`, `^1@7`, `c@maj7`) are read first, and keep their names through `arp`, `strum` and transposition. Without symbols, a voice that plays three or more notes at once is read, and named the simplest way that fits the bar, then the half bar, then the beat.

How notes are written: notes split and tie where they cross a beat they did not start on, rests show every beat, eighths and shorter are beamed by the beat. A strummed chord is written as the chord, and `echo` copies are left out. Spelling follows the key. A microtone is written with its nearest quarter-tone accidental and its offset in cents above the note.

| Option | |
| --- | --- |
| `--jazz` | jazz chord symbols: C–7, CΔ7, Cø7, C°7 |
| `--a4` | A4 paper (default US letter) |
| `--voices a,b` | read the chords from these voices |
| `--melody v` | lead sheet: the melody voice (default: guessed from its name, range and how often it plays one note at a time) |
| `--parts a,b` | score: which voices, in this order |
| `--no-chords` | score: no chord symbols |
| `--per-line N` | bars to a line |
| `--bars N` | how many bars, for a piece without `form` |

## Command line

```
tine                      REPL
tine play | render | midi | roll | check  <file>
tine xml <file>           MusicXML score for MuseScore, Dorico, Sibelius, Finale
tine chart <file>         chord chart, as a printable page (or -o chart.svg)
tine lead <file>          lead sheet: melody, chord symbols, sections
tine score <file>         sheet music: every voice on its own staff
tine daw [file]           live-coding DAW in the browser
tine learn                interactive tutorial
tine pack <file>          single-file HTML player
tine pack <file> --exe    standalone executable for one piece
tine dirt <file>          play through SuperDirt; saving the file changes the music
tine new <name>           new piece from a template
tine lsp                  language server
```
