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

A hundred and twenty tests cover the core (timing, phrases, pitch, microtonality, every transform), the randomness guarantees (replay, order independence, slice independence, voice isolation), sections and form, errors and suggestions, the language server over a real stdio session, every tutorial example and exercise, every example piece, the MIDI messages each note becomes, clock following, effects, and the MusicXML writer.

## 23. Known limits

- Built-in sounds are simple synths; serious sound design is meant to happen on external instruments over MIDI.
- Web MIDI is unavailable in Safari, so live MIDI in the DAW needs Chrome, Edge, Opera, or Firefox with a permission prompt. Rendering and MIDI file export work everywhere.
- Note names reserving `a` to `g` will occasionally surprise a programmer. The error message says exactly what happened.
- Patterns lose their "list-ness" after sound parameters are set (`.inst`, `.vel`), so list functions like `scramble` must come before those in a chain. The error message points to it.
- No Ableton Link (section 25). MIDI clock in and out covers sync with hardware and other DAWs.
- Following MIDI clock adjusts tempo and phase in live mode only; in form mode it follows start and stop, because the arrangement owns the tempo.
- Tempo changes are steps between sections. There is no gradual accelerando or ritardando yet.
- MusicXML export writes tuplets as time modifications without bracket marks, writes drum parts as unpitched notes at their General MIDI pitch, and does not attempt beaming. Scores import correctly; engraving is left to the notation program.
- There is no choir or formant voice, and lists cannot yet hold lists.
- Inside a sandboxed viewer such as a claude.ai Artifact, the download buttons of the DAW and of packed players do nothing, because the sandbox blocks downloads the page starts itself. Opened as a file or from `tine daw`, they work.

---

# Tine 1.1

These came from a comparison with other music languages (`docs/COMPARISON.md`), which ranked the gaps that mattered most to performers and composers. Each decision below says what was chosen, what was rejected, and why.

## 24. Talking to gear: control changes, program changes, clock in

- `.ctl(74, sine(4))` sends a control change just before each note, so a knob on a hardware synth moves with the music. The value is 0 to 1, the same range `cc()` reads, so a controller can be read and written with one scale.
- `.program(n)` sends a program change, numbered 1 to 128 as General MIDI lists print them (MIDI sends 0 to 127). It is sent only when it changes on that channel, because some synths glitch on a repeated program change.
- `.as_cc(74)` turns a whole voice of numbers into control changes instead of notes: `voice sweep = sine(4).as_cc(74).midi(1)`. A signal is sampled `rate` times per bar (16 by default). Such a voice never sounds in the built-in synth and is hidden from the piano roll.
- One function, `noteMessages`, decides what bytes a note becomes. The live engine and the MIDI file writer both call it, so what you hear from gear and what another DAW imports are the same. It also resets pitch bend after a microtonal note, which 1.0 forgot to do.
- **MIDI clock in.** "Follow MIDI clock" in the DAW makes Tine the follower: start, continue and stop come from the other device, and the tempo is measured from its clock ticks. Clock ticks arrive 24 per beat, and USB MIDI jitters by a millisecond or so, so the tempo is a least-squares line fitted through the last two beats of ticks rather than the gap between the last two. That gives a steady reading within a fraction of a BPM. Once a beat, Tine also nudges its bar line a third of the way toward where the clock says it is, so it stays in phase without audible jumps.
- Following and sending clock are mutually exclusive in the DAW, so two machines can never chase each other.

## 25. Ableton Link: deferred, on purpose

Link keeps several apps on a network in tempo and phase. It was ranked first alongside MIDI, and it is not in 1.1. The reasons:

- Browsers cannot do it. Link runs over UDP multicast on the local network, and no browser API can send or receive that. The DAW lives in a browser.
- The `tine` binary could do it, as a bridge between Link and the browser, but it would need a reimplementation of the Link protocol in TypeScript. Ableton publishes Link as a C++ library under GPL; a clean-room implementation that has never been tested against real Link peers would be a sync feature that fails on stage, which is worse than none.
- MIDI clock covers the same need for most setups: every DAW and drum machine sends and follows it, and Tine now does both.

The plan, recorded so it is not lost: a `tine link` bridge inside the binary that speaks Link on the network and talks to the DAW page over the WebSocket the file watcher already uses, once it can be tested against Ableton Live.

## 26. Synthesis moved off the main thread

In 1.0 every note's audio was computed on the browser's main thread, the same thread that runs the editor. A dense passage could make typing stutter, or a note late.

- **Chosen: a Web Worker that renders ahead.** The scheduler already looks 120 ms ahead to place notes. It now also looks 0.6 s further and sends those notes to a background thread, which renders them with the very same `renderNote` function and hands the audio back without copying it (a "transferable" buffer). By the time a note is due, its sound is usually waiting in a cache.
- **Rejected: an AudioWorklet.** A worklet runs inside the audio thread itself, which is the textbook place for synthesis. But it would mean rewriting the mixer, voice allocation, envelopes and effects as a real-time engine that must never allocate memory or take too long, while the browser's own nodes (filters, delay, convolution reverb) do much of that work well today. The worker keeps one synth for the CLI, the WAV export and the browser, which is the property 1.0 was built around.
- **Fallback.** A note whose sound has not arrived is rendered on the main thread, exactly as in 1.0: late work, never silence. A page that forbids workers (some embeds do) simply behaves like 1.0. The engine counts notes that were ready ("ahead") and notes that were not ("late"); in a browser test, only the notes in the first tenth of a second after pressing play were late.
- Moving rendering between threads exposed a replay bug: the noise generator for drums kept running from note to note, so a snare could sound slightly different depending on what was rendered before it. Noise now restarts from the note's own pitch every time.

## 27. Per-voice effects

- `.hpf(hz)`, `.lpf(hz)`, `.drive(amount)` and `.delay(mix, time: 3/16, feedback: .4)` act on a voice's **bus**, after its notes are mixed. A delay repeats the whole voice and drive saturates a chord as one sound, like an amp. This is different from `cutoff`, which shapes each note inside the synth, and the docs say so.
- The order is fixed: high-pass, low-pass, drive, delay. Fixed order is less flexible than a patchable effects rack, but it is the order a guitarist's pedalboard and most channel strips use, it never produces a surprising result, and it needs no syntax for routing.
- Delay time is in bars, like all time in Tine, so `3/16` is a dotted eighth in 4/4 and stays in time when the tempo changes. It becomes seconds once, when notes are made.
- Settings ride on the notes. The latest note sets the bus, and a note with no effect parameters puts the bus back to neutral. So deleting `.delay(...)` from the code turns the echo off at the next bar line, the same way every other change behaves.
- There are two implementations of one design: Web Audio nodes in the DAW, and a sample-by-sample version in `core/fx.ts` for WAV export. The filters use the same Butterworth formula as the browser's, and drive is the same curve, so a render sounds like the performance.
- The browser keeps each voice's chain once created, so echoes ring out across code swaps instead of being cut.

## 28. State that replays: `evolve`

- Live coders asked for "a value that changes every bar based on last bar", like a random walk, a counter, or a chord that leads smoothly into the next. A plain variable cannot do that in Tine, because patterns are pure functions of time and can be asked for bar 37 before bar 36.
- `evolve(start, (state, bar) => next, (state, bar) => pattern)` defines the state at bar *n* as the step function applied *n* times to the start. It is a fold over bars. Asking for bar 37 computes bars 1 to 37 once and remembers them, so any bar can be asked in any order, and the result is always the same. That keeps seeking, looping, rendering a slice and replaying a take exact.
- The memory is keyed by seed, voice and section start, so a section restarts its state when it starts, and two voices never share a walk. Randomness inside the step is keyed by bar, so a seeded random walk replays exactly.
- Cost is linear in how far into the piece you are, once. A cap of 100,000 bars stops a mistake from eating memory; that is over two days of music at 120 BPM.
- The jazz course's `voicelead` (smooth chord voicing, where each chord depends on the last) now runs on it, which is the test that it is general enough. See section 34.

## 29. MusicXML export

- `tine xml piece.tine` writes a MusicXML 4.0 score with one part per voice, for MuseScore, Dorico, Sibelius and Finale. Every example piece's score was checked against the official MusicXML 4.0 schema.
- **Exact rhythm.** MusicXML counts time in "divisions" per quarter note. Tine computes the least common multiple of every denominator in the piece, so a quintuplet against a triplet, or a 7-tuplet in 7/8, lands on whole numbers with no rounding. If that number would pass 100,000 (generative pieces with nudged timing can do this), the score falls back to a fine 480-per-quarter grid.
- Notes across bar lines are split and tied. Lengths that are not plain or dotted values become tied chains (five sixteenths is a quarter tied to a sixteenth), and non-binary lengths become one tuplet note with its ratio.
- Overlapping notes of different lengths in one voice go into separate notation voices in the same staff; notes that start and end together become chords.
- **Spelling follows the key**: B minor writes A sharp, F major writes B flat. Microtones keep their cents as a decimal `<alter>`, which MusicXML allows; how each notation program displays them varies.
- Velocity becomes each note's dynamics attribute, section names become rehearsal marks, tempo changes become metronome marks, and the seed is stored in the file.

## 30. Rounded time is reported

- Tine's time is exact fractions stored in ordinary numbers. Past 2^53 (about nine quadrillion) a numerator or denominator cannot be stored exactly, and 1.0 silently rounded to the nearest fraction with a denominator up to a million.
- **Chosen: keep the fast path and warn.** Every rounding is counted, per voice. `tine check` prints a warning naming the voice, and the language server underlines it as a warning while you type. The error is at most a millionth of a bar, two microseconds at 120 BPM, but a rounded time can miss an exact bar line, and the composer should know their rhythm is no longer exact.
- **Rejected: BigInt fractions.** They would never round, but every time calculation in every voice would get several times slower, to protect pieces that almost nobody writes. It takes deliberately extreme rhythm, like offsets of 1/999983 stacked three deep, to reach the limit.

## 31. Error fixes from writing a real piece

An arrangement written in Tine against 1.0 found three rough edges, now fixed:

- An error that only happens when music is made (inside `per_bar`, say) crashed `render`, `midi` and `roll` with a raw stack trace. Every command now prints it like any other error, with the line and a hint.
- Naming a parameter `f` (a note) now suggests a rename, `fn`, instead of only saying it is not allowed.
- The terminal piano roll spells notes by the file's key, so B minor shows `a#` and not `bb`.


## 32. Chord symbols

- `c4@maj7`, `chord("Bb7#11")` and `changes("Dm7 G7 | Cmaj7")` all read one grammar, in `core/harmony.ts`. It is a family (`m`, `-`, `maj`, `M`, `Δ`, `dim`, `o`, `ø`, `m7b5`, `aug`, `+`, `mmaj`), then a number (5, 6, 69, 7, 9, 11, 13), then any modifiers (`sus`, `alt`, `add9`, `no5`, `b9`, `#11`, `b13`, and so on). Named shapes in the old chord table are checked first, so nothing that worked before changed.
- **Chosen: the lead-sheet spellings musicians already write**, including `-7` and `Δ7`. Real Book charts use all of them, and a course that rejected `C-7` would be teaching Tine instead of jazz.
- `ma` only counts as major when a digit follows (`Ama7`), so `madd9` is minor add 9.
- A slash bass (`c4@m7/g`, `"C/E"`) goes below the root unless it names an octave. The other choice, the nearest bass note, puts the bass above the root half the time.
- After `@`, the lexer reads a whole symbol token (`@7#9`, `@maj7/e`). That is why `#` and `+` are allowed there and nowhere else.
- On a scale degree, a bare number still means a diatonic stack (`^2@7` is ii7). On an altered degree (`^b7@7`) the number names the quality, because there is no diatonic chord on a note outside the key.

## 33. `changes()` and voicings

- `changes("Dm7 G7 | Cmaj7 | %")` reads a lead sheet. Bars split on `|`; chords in a bar share it equally; `/` or `_` holds the previous chord one slot; `%` alone in a bar repeats the last bar; `N.C.` is a rest. A `%` inside a bar is an error with a message, because it has two plausible meanings.
- Chords now carry their root and bass as metadata through transposition. `root`, `bassnote` and `name()` use it, so a rootless F7 is still named F13, not the Ebmaj7#11 its notes spell. Without the hint, naming is a scored search: a root not in the bass, a missing root and each omitted tone cost points, and only the root and 5th may be omitted.
- Voicings are functions over chord patterns: `shell` (root, 3, 7), `guide` (3 and 7), `rootless(form: "a"|"b")` (Bill Evans A and B forms, the 13th replacing the 5th on dominants), `drop2`, `drop3`, `drop24`. They keep register limits so a voicing never sinks into mud below about D3.
- `bass` was taken by the instrument, so the lowest-note function is `bassnote`.

## 34. `voicelead`

- `.voicelead(around: e4)` picks, for each chord, the inversion and octave that moves least from the chord before, with a small pull toward a center note so a long progression does not drift off the keyboard.
- It is built on `evolve` (section 28). The state is the last voicing of the previous bar; each bar is voiced chord by chord from it. That makes it order independent: asking for bar 9 first gives the same notes as playing through. A test checks this.
- **Chosen: close-position inversions only.** Spread and drop voicings are a separate step (`.drop2.voicelead` is fine). Searching every spacing finds smoother lines but takes much longer and gives voicings a pianist would not pick.

## 35. The theory course

`tine theory` opens a 35-lesson course, Theory 101 through 202, in the browser. The page is built from `src/web/course/` and shares its cell, challenge and quiz code with the tutorial (`src/web/cells.ts`).

- **Jazz first, not jazz last.** Most college sequences teach four-part chorale writing for a year and reach jazz as an elective. Here swing is lesson 3, seventh chords lesson 8, ii-V-I lesson 14, the blues lesson 15. Classical topics that jazz uses (cadences, nonchord tones, Neapolitan and augmented sixths, mixture, modulation) stay, explained in jazz terms where it helps. Species counterpoint and figured bass are left out; they are about writing for voices in a style Tine does not target.
- Four units: 101 Fundamentals, 102 Diatonic harmony and the jazz core, 201 Chromatic harmony, 202 Jazz harmony and beyond (tensions, modes, melodic minor, voicings, bebop, modal jazz, Coltrane changes, reharmonization, post-tonal sets and rows).
- **Challenges are checked by what the code plays, not how it is written.** A check gets the notes and compares pitch-class sets, bar by bar. Any correct answer passes, including one the author did not think of. Tests make sure every solution passes and every starter fails.
- **No staff notation.** Tine works in sounding pitch and has no enharmonic spelling, so Fb and E are the same note. The course says so on its home page and spells chords by their usual jazz names in prose. A staff view would need a spelling engine; MusicXML export (section 29) already spells by key if you want a score.
- **No global swing.** A `swing` statement would clash with the `swing` function and make swing a property of the piece rather than of each player. Lessons use `.swing` per voice, the way a drummer and a pianist can swing differently.
- New sounds for the course: `upright` (bass) and `vibes`. New scales: altered, lydian dominant, lydian augmented, mixolydian b6, locrian natural 2, dorian b2, phrygian dominant, both diminished scales, augmented, major blues, and three bebop scales.
- Lesson prose never uses an em-dash. A test enforces it.

## 36. A fix found by the course: `.key()` on a pattern

- `voice v = [^1 ^3 ^5].key(d, minor)` ignored the key, because degrees were resolved before the method ran. The key now travels with each note as a parameter, and an inner `.key` wins over an outer one. A regression test covers it.

## 37. `within`: folding pitches into a range

- A slash-chord chart puts each bass note below its chord's root, so `changes("Bm | F#/A#", octave: 2).bassnote` gives b2 then a#1. A falling bass line needs one octave. `within(p, lo, hi: lo + 12)` moves each note by whole octaves until it sits in the range; `.bassnote.within(e1, e2)` fixes the line.
- A chord moves as a unit, by its lowest note, so its voicing survives. Folding each chord tone on its own would turn a voicing into a cluster.
- It is a general pitch function, not a `bassnote` option, because melodies, guitar parts and generated lines need it too. The name `fold` was taken by the list function.
