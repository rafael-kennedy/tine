# Tine: design decisions

This is the record of every judgment call made while designing and building Tine. Each entry says what was decided, why, and what was given up. Sections 1 to 14 cover the language; 15 onward cover the tools around it.

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

**`*` on a pattern repeats it; `*` on a single pitch multiplies frequency.** `[c e] * 2` plays the phrase twice per bar, exactly as `[c e]*2` does inside a phrase, and `[c e] / 2` stretches it over two bars. `c4 * 3/2` is a just fifth. This was revised during the build: the first version made `[c e] * 2` multiply frequency (an octave up) for arithmetic consistency, and I wrote that bug into my own tutorial examples twice. If the language's author trips on a rule, users will too. The cost is that transposing a whole melody by a ratio needs `.transpose(ratio(3/2))` or a `map`. `+` and `-` still apply note-wise to patterns, since nobody expects `+` to mean "faster".

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

## 15. One binary

The `tine` executable contains the REPL, renderer, MIDI exporter, the DAW and tutorial (as embedded web pages served on localhost), the packager and the language server. A performer installs one file and nothing else. The cost is size (about 100 MB, mostly the embedded Bun runtime). Disk is cheap; a missing dependency at a gig is not.

## 16. REPL

- Multi-line input is detected rather than declared: open brackets, a trailing `=`, a `section` line or an indented line keep reading; an empty line ends a block.
- Any pattern you evaluate is **drawn as a piano roll in the terminal**, so the REPL is useful without speakers. Experimenting with rhythm is mostly looking at where notes land.
- `:play` renders and plays through the system audio player (afplay, paplay, aplay, pw-play, ffplay or PowerShell), which avoids native audio bindings.
- `:save` writes the session as a `.tine` file with its seed, so a REPL experiment becomes a piece.
- Values print as valid Tine code (`^1.octave(-1)`, not an internal structure), so output can be pasted back in.

## 17. DAW

The DAW is deliberately a *live-coding* workstation, not a piano-roll editor with a code panel bolted on. The code is the score; everything else serves performing it.

- **Bar-quantized hot swap.** Re-evaluating schedules the new code to take over at the next bar line (or beat, or immediately, selectable). A groove never stumbles mid-bar.
- **Errors never stop the music.** A voice that fails to evaluate keeps its last good version; a voice that fails while playing is skipped and reported, and the others continue.
- **Takes.** Every evaluation is recorded with its code and seed. Anything heard can be restored exactly; starring a take writes its seed into the code. This is the seeded-randomness promise turned into a feature.
- **Sections are scenes.** In live mode, clicking a section launches it on the next bar, layered over the top-level voices, like clip launching. "Play form" plays the arrangement start to finish.
- **Your editor, or ours.** Run with a file and the DAW watches it: save in VS Code, Vim or anything else and the change is heard on the next bar. The DAW's own editor (CodeMirror) has highlighting, completion, hover docs and inline error marks.
- **MIDI**: output per voice with port selection, MPE channel rotation, clock out, input play-through to a built-in instrument, a live display of the last controller moved with one-click insertion of `cc(n)`, and **capture**: arm it, play for 1 to 8 bars, and Tine quantizes what you played and writes it into the code as a new voice. Capture simplifies its output: it halves the grid wherever that keeps the rhythm exact, uses holds for long notes, braces for chords, and `< >` across bars.
- **Samples and loops**: drop audio files on the window (or put them in a `samples/` folder beside the piece) and use them as `.sample("name")`; `fit: true` stretches a loop to its step length.
- **Scheduling** uses the standard look-ahead pattern: a 25 ms timer schedules every note starting in the next 120 ms against the audio clock, and MIDI uses the timestamped Web MIDI send. Patterns being pure functions of time is what makes this simple.

Given up: no audio recording, no mixer with effects chains, no plug-in hosting. Those exist in every other DAW, and MIDI out plus clock lets Tine drive one.

## 18. Tutorial

- **Every example is live and editable**, with its own piano roll, because reading about rhythm without hearing and seeing it is useless.
- Fourteen short lessons in the order a musician needs things: sound, rhythm, layers, keys, chords, transformation, change over time, chance, code, sound design, microtonality, rhythmic depth, form, performance. Programming concepts (functions, lambdas) come in lesson 9, after enough music to want them.
- **Exercises are checked by listening**: the checker evaluates your code and inspects the resulting notes, so any correct answer passes, not just the one I wrote. Answers are revealable; progress is remembered.
- The test suite runs every tutorial example and checks that every exercise's answer passes and its starter does not, so the tutorial cannot rot as the language changes.

## 19. Packaging

- `tine` itself is compiled with Bun for Linux (x64, arm64), macOS (x64, arm64) and Windows (x64), cross-compiled from one machine.
- `tine pack piece.tine` produces a **single HTML file** with the player, synth and piece inlined, frozen to its seed. It plays offline in any modern browser and offers WAV, MIDI and source downloads. This is the most portable "executable" there is.
- `tine pack piece.tine --exe` produces a **native executable for one piece** by appending the piece to a copy of the tine binary; run with no arguments it plays, and `render`, `midi`, `roll` and `daw` work as subcommands. `--runtime` packs for another platform. On macOS the result is re-signed ad hoc.

## 20. Editor support

- A **language server** written from scratch (no dependencies) over stdio: diagnostics, completion (context-aware after `.` and `@`), hover (notes show their MIDI number and frequency; degrees show what they resolve to in the file's key; voices show how many notes they play), signature help that understands method-call style, go to definition, document outline, formatting and semantic tokens.
- Diagnostics include **play-time errors**: the server evaluates the file and queries two bars of music, so a mistake that would only appear when a voice plays is underlined while you type.
- The **VS Code extension** bundles the server, so editing needs nothing installed; playback commands call the `tine` binary in a terminal, and "Open in DAW" connects editor and DAW through the file watcher.
- A generated **TextMate grammar** serves VS Code, Sublime, JetBrains and TextMate; Vim, Neovim, Helix and Emacs get native files. The grammar is generated from the standard library so it never falls out of date.

## 21. Brand

See `brand/BRAND.md`. Brass and teal on near-black ink; Fraunces for the wordmark, Inter and JetBrains Mono for interface and code. Dark is the default theme because live coding happens on stages; a light theme follows the system setting.

## 22. Testing

Ninety-plus tests cover the core (timing, phrases, pitch, microtonality, every transform), the randomness guarantees (replay, order independence, slice independence, voice isolation), sections and form, errors and suggestions, the language server over a real stdio session, every tutorial example and exercise, and every example piece.

## 23. Known limits

- Built-in sounds are simple synths; serious sound design is meant to happen on external instruments over MIDI.
- Web MIDI is unavailable in Safari, so live MIDI in the DAW needs Chrome, Edge, Opera, or Firefox with a permission prompt. Rendering and MIDI file export work everywhere.
- Note names reserving `a` to `g` will occasionally surprise a programmer. The error message says exactly what happened.
- Patterns lose their "list-ness" after sound parameters are set (`.inst`, `.vel`), so list functions like `scramble` must come before those in a chain. The error message points to it.
- There is no MIDI clock *input* yet: Tine can lead other gear but not follow it.
