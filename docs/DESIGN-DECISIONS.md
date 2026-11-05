# Tine: design decisions

This is the record of every judgment call made while designing and building Tine. Each entry says what was decided, why, and what was given up. It is a living document; sections marked *(in progress)* cover parts still being built.

---

## 1. Name: Tine

A tine is the prong of a tuning fork, and the vibrating metal reed inside a kalimba or an electric piano. Three reasons:

- **A tuning fork is a reference pitch.** It is the instrument whose whole job is to sound the same every time. That is the language's core promise: every run is seeded and replayable.
- **Short and typeable.** Four letters, one syllable. The command is `tine`, files end in `.tine`. Live coders type the name constantly.
- **Not borrowed.** It does not name an existing music language, and it carries no genre baggage.

Given up: "tine" is not searchable on its own. The ecosystem size was declared irrelevant, so this was accepted.

## 2. Implementation stack: TypeScript on Bun, audio and MIDI in the browser

- **One language for everything.** The interpreter, CLI, language server, DAW, tutorial and VS Code extension share one codebase. A fix to the parser fixes the REPL, the editor diagnostics and the DAW at once.
- **The browser is the only universal real-time audio and MIDI platform.** Web Audio and Web MIDI exist on macOS, Windows and Linux with no native drivers. A native audio stack would mean per-platform C bindings for CoreAudio, WASAPI, ALSA, CoreMIDI and so on.
- **Bun compiles standalone executables** for Linux, macOS and Windows from one machine, which answers the packaging requirement without a separate toolchain.

Given up: the DAW needs a browser window. Firefox gates Web MIDI behind a permission prompt; Safari does not support it. Chrome, Edge and Opera work out of the box.

## 3. Interpreted, not compiled

A program evaluates to a **Scene**: a set of named voices (patterns), plus tempo, meter, key, seed and an optional form. Patterns are closures. There is no code generation.

Why: live coding needs to swap a running piece's code in milliseconds and keep time. A pattern is a pure function of time, so swapping one function for another at a bar line is seamless. Compilation to another language would add a build step for no audible gain, since the bottleneck is audio rendering, not evaluation.

## 4. The core idea: a pattern is a function of time

Every musical thing answers one question: *which events begin between time a and time b?* Phrases, chords, loops, randomness and live controller input are all built by composing such functions.

This model is reminiscent of TidalCycles, which pioneered it. What Tine changes is everything around it: patterns are native syntax rather than strings, pitch is a typed value, time is exact, randomness is positional, and composition (sections and form) is part of the language.

Consequences:
- The scheduler can look ahead, rewind, or query any slice of time in any order.
- Rendering a WAV and playing live use the same query, so they cannot disagree.

## 5. Time is measured in bars, as exact fractions

One cycle is one bar. A phrase `[c e g]` fills one bar by default.

Time is stored as exact rationals, not floating point. Three nested triplets inside a quintuplet land exactly where they should, on bar 1 and on bar 10,000. This is what makes "infinite rhythmic complexity" honest: nothing drifts, ever.

Why bars and not beats or seconds: musicians count bars. "Every 4 bars, do a fill" should be written as `.every(4, fill)`.

`tempo` counts the meter's denominator per minute. `tempo 120` in 6/8 means 120 eighth notes per minute. This is how a metronome set to eighths behaves, and it keeps the rule to one sentence.

## 6. Phrase literals are syntax, not strings

`[c e g]` divides a bar into equal steps. Inside brackets:

| Mark | Meaning |
| --- | --- |
| `.` | rest |
| `_` | hold the previous step one step longer |
| `x:3` | x takes 3 steps' worth of time (weight) |
| `[ ... ]` nested | subdivide one step (tuplets fall out naturally) |
| `x*3` | play x three times inside its step (ratchet) |
| `x!3` | x repeated as three separate steps |
| `{a b c}` | at the same time (a chord, or stacked patterns) |
| `<a b c>` | one per bar, in turn |
| `a\|b\|c` | seeded random choice each bar |
| `x?` / `x?0.3` | seeded chance to play (50% / 30%) |
| `c4@maj7` | chord built on x |

Why native syntax: errors point at the exact character, the editor highlights and completes inside phrases, and phrases can contain variables and expressions: `[kick (fill(2)) snare .]`.

**A list is a phrase.** There is no separate list type. `[0 2 4 7]` is both a playable phrase and a list you can `map`, `len` or `at`. One concept instead of two.

## 7. Pitch is a value, and microtonality is free

Every pitch is ultimately a fractional MIDI note number: 60 is middle C, 60.5 is a quarter tone above. Fractional semitones give unlimited microtonality while staying compatible with MIDI.

| Write | Means |
| --- | --- |
| `c4`, `f#3`, `eb5`, `c` | note names (octave defaults to 4) |
| `^1 ^b3 ^#4` | scale degrees in the current key |
| `60`, `61.5` | MIDI note numbers |
| `c4 + 7` | up 7 semitones |
| `c4 + 50c` | up 50 cents |
| `c4 + 5\31` | up 5 steps of 31-tone equal temperament |
| `c4 * 3/2` | up a just perfect fifth (frequency ratio) |
| `432hz` | a pitch given by frequency |

Scales can be built from semitones, cents, ratios (`just`), equal divisions (`edo`), or loaded from Scala `.scl` files, the standard format used by microtonal musicians. Scales can have a period other than the octave (Bohlen-Pierce ships built in).

**Note names are reserved words.** A bare `a` through `g`, with accidentals and an octave digit, is always a note. You cannot name a variable `e` or `b3`. This is the one place the language trades programmer freedom for musical clarity: in a music language, `[c e g]` must mean C, E, G with no lookup. Voice names and record fields are exempt, because they are never looked up as variables.

**Degrees are symbolic until they meet a key.** `^3` stays "the third degree" while patterns are transformed, and resolves to a pitch only when played. So `.key(a3, minor)` re-keys a whole melody, and `.step(1)` moves diatonically while `.transpose(1)` moves chromatically.

**Chords on degrees count chord tones, chords on pitches name qualities.** `^5@7` is the diatonic seventh chord on the fifth degree (G7 in C major), the way a musician says "five seven". `c4@maj7` names a quality. `^2@m7` works too.

**`*` means two different things in two places, on purpose.** Inside a phrase, `c*3` is a ratchet. In an expression, `[c e] * 2` multiplies frequency (up an octave), consistent with `c4 * 3/2`. Arithmetic consistency across pitches won over symmetry with the phrase notation. The tutorial calls this out.

## 8. Randomness is seeded and positional

Tine never keeps a mutable random generator running. Every random decision is a pure hash of **(seed, voice name, random site, bar, position in the bar)**.

- **Every run is replayable.** The seed is printed on every run and shown in the DAW. Put `seed 1234` in the file and the piece is frozen.
- **Look-ahead and rewind are safe.** Querying bar 9 before bar 3 gives the same dice as querying in order. This is tested.
- **Editing one voice never reshuffles another.** The voice name is part of the hash. Change the bass and the drums keep their exact random fills. This is tested.
- **No seed line means a fresh random seed**, printed so you can keep a take you liked.

Given up: a classic "seed then call rand() in a loop" generator is also provided for ordinary expressions (`rand()`, `pick`, `shuffle`), but it is itself keyed by statement, so it stays replayable.

## 9. Syntax

- **Indentation for blocks, no braces.** Functions bodies and sections are indented. Braces are taken by chords, and indentation reads like a score.
- **Calls use parentheses and commas:** `euclid(kick, 3, 8)`. Juxtaposition (`f x y`) would collide with phrase syntax, where spaces separate steps.
- **Method-style chaining (uniform function call syntax).** `p.fast(2)` is `fast(p, 2)`, for any function, including your own. Patterns read left to right like a signal chain: `[^1 ^3 ^5].fast(2).every(4, rev).inst(pluck)`.
- **A line starting with `.` continues the previous line**, so long chains stack vertically, which is how live coders edit.
- **`--` comments.** It looks like a rest or a dash in a score, and `#` was needed for sharps.
- **Everything is an expression.** `if` requires `else`. Blocks return their last line.
- **Named arguments** for options: `.echo(times: 4, decay: 0.5)`.

## 10. Typing: dynamic, with explicit messages

Values are checked at runtime with messages written for musicians: "cannot add a pitch and text", with a hint showing what would work. The language server adds static checks (unknown names, arity) as you type.

Why not static types: the value space is small (numbers, pitches, degrees, chords, patterns, functions, records), live coding rewards immediacy over ceremony, and the most common mistakes are musical, not type errors. A type annotation syntax would add weight to the most-typed lines in the language.

## 11. Errors

- Every error carries a source span and a kind (syntax, name, type, runtime). The terminal underlines the exact characters; the editors squiggle them.
- Misspellings get "did you mean" suggestions.
- **In live performance, an error never stops the music.** A broken voice is reported and the last good version keeps playing. Other voices are untouched.

## 12. Composition and performance are the same program

- Top-level `voice` lines loop forever: that is live mode.
- `section verse 8` plus an indented body defines 8 bars of material. `form intro verse*2 chorus` arranges them into a finished piece with an end.
- Inside a section, patterns restart at the section's bar 0, so every verse starts the same. Randomness is still keyed to the global bar, so repeated verses still vary.
- In the DAW, sections double as launchable scenes for live sets.

`every(n, f)` applies f on the **last** bar of each group of n, because that is where fills land. This differs from systems that apply it on the first.

## 13. Interoperability

- **MIDI out** from any voice (`.midi(channel)`), with fractional pitches sent as pitch bend, and an MPE-style channel rotation (`.mpe`) for polyphonic microtonality.
- **MIDI in**: controller knobs as live signals (`cc(74)`), held keys as chords (`held()`), and capture of played notes into Tine code.
- **MIDI clock out** so drum machines and other DAWs follow Tine's tempo.
- **Standard MIDI File export** (`tine midi`), one track per voice, so anything written in Tine opens in Ableton, Logic, Reaper, MuseScore.
- **WAV render** (`tine render`).
- **Scala tuning import.**
- **Audio samples and loops** from files.

## 14. Sound

Built-in instruments are pure sample-generating functions (an FM electric piano called `keys`, a plucked string, bass, pad, bell, organ, raw oscillators, and a synthesized drum kit). The same code renders offline WAVs on the command line and renders each note into an AudioBuffer in the browser, so the DAW, the tutorial and an exported file sound alike.

The default instrument is `keys`, a tine piano, which seemed right.

Given up: these are simple synths, not a production sound engine. The real answer for serious sound design is MIDI out to the performer's own instruments, which is first-class.

## 15. Tooling *(in progress)*

- **REPL** (`tine`): multi-line input, tab completion, piano-roll drawings of any pattern in the terminal, `:play`, `:seed`, `:save`. Done.
- **DAW** (`tine daw song.tine`): browser-based, served by the same binary; watches the file so you can edit in your own editor and hear changes. Being built.
- **Tutorial** (`tine learn`): runnable, editable examples with exercises. Next.
- **Packaging**: standalone `tine` binaries for five platforms; `tine pack` makes a single-file HTML player or a self-contained executable for one piece. Next.
- **Editor support**: language server plus VS Code extension, and syntax files for other editors. Next.
- **Brand**: logo and palette. Next.
