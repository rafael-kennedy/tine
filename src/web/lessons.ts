// The tutorial's content. Prose is small HTML; code cells are live.
import type { Scene, TimedNote } from "../core";

export interface Cell { code: string; bars?: number }
export interface Exercise { task: string; starter: string; solution: string; bars?: number; check: (s: Scene, n: TimedNote[]) => string | null }
export type Part = string | Cell | { exercise: Exercise };
export interface Lesson { id: string; title: string; parts: Part[] }

const voiceNotes = (n: TimedNote[], v?: string) => (v ? n.filter(x => x.voice === v) : n);
const round = (x: number) => Math.round(x * 1000) / 1000;

export const LESSONS: Lesson[] = [
  {
    id: "first", title: "1. A first sound",
    parts: [
      `<p>Tine is a programming language for music. You write <em>voices</em>, and each voice is a pattern that repeats every bar. Press <b>▶</b> (or <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Enter</kbd> inside the code) to hear this one.</p>`,
      { code: `voice hello = [c e g]` },
      `<p>The square brackets make a <b>phrase</b>. A phrase divides one bar into equal steps, so three notes each get a third of the bar. Add a fourth note and they all get shorter; the bar stays the same length.</p>`,
      { code: `voice hello = [c e g c5]` },
      `<p>Note names are <code>c d e f g a b</code>, with <code>#</code> for sharp and <code>b</code> for flat, and an octave number: <code>c4</code> is middle C, <code>f#3</code> is below it, <code>eb5</code> above. Without a number you get octave 4. Because these are notes, a bare <code>a</code> or <code>e</code> can never be a variable name.</p>`,
      `<p>The drawing under each example is a piano roll: time runs left to right, pitch bottom to top, one vertical line per bar.</p>`,
      { exercise: {
        task: "Make a voice called <code>tune</code> that plays the four notes C, D, E, G in one bar.",
        starter: "voice tune = [c]", solution: "voice tune = [c d e g]",
        check: (_s, n) => { const t = voiceNotes(n, "tune").filter(x => x.bar < 1); if (!t.length) return "There is no voice named tune yet."; if (t.length !== 4) return `That bar has ${t.length} notes; it should have 4.`; return JSON.stringify(t.map(x => x.semi)) === "[60,62,64,67]" ? null : "Right number of notes, but check the pitches: c d e g."; },
      } },
    ],
  },
  {
    id: "rhythm", title: "2. Rests, holds and lengths",
    parts: [
      `<p>Inside a phrase, <code>.</code> is a rest and <code>_</code> holds the previous note for one more step.</p>`,
      { code: `voice riff = [c . e _ g . . c5]` },
      `<p>To make one step longer than the others without counting holds, give it a weight with a colon. <code>c:3</code> takes three steps' worth of the bar.</p>`,
      { code: `voice riff = [c:3 e g:2 . ]` },
      `<p>Any step can itself be a phrase. Nested brackets subdivide just that step, which is how you write triplets, quintuplets, or anything stranger. Time in Tine is exact, so nested tuplets never drift.</p>`,
      { code: `voice riff = [c [e e e] g [a b c5 d5 e5]]` },
      `<p>Two shortcuts: <code>x*3</code> plays x three times inside its step (a ratchet), and <code>x!3</code> repeats x as three separate steps.</p>`,
      { code: `voice riff = [c*2 e!3 g*4]` },
      { exercise: {
        task: "Write <code>voice beat</code>: a C on the first and third quarter of the bar, rests on the second and fourth.",
        starter: "voice beat = [c]", solution: "voice beat = [c . c .]",
        check: (_s, n) => { const t = voiceNotes(n, "beat").filter(x => x.bar < 1); return JSON.stringify(t.map(x => round(x.bar))) === "[0,0.5]" ? null : `Notes start at ${t.map(x => round(x.bar)).join(", ") || "nowhere"}; they should start at 0 and 0.5 of the bar.`; },
      } },
    ],
  },
  {
    id: "together", title: "3. Drums, layers and voices",
    parts: [
      `<p>Drum names are built in: <code>kick snare hat ohat clap rim crash ride tom1</code> and more (they are General MIDI drum notes, so they work with any drum machine).</p>`,
      { code: `voice drums = [kick hat snare hat]` },
      `<p>Curly braces play things <b>at the same time</b>. Put two phrases in braces and they layer, each keeping its own subdivision.</p>`,
      { code: `voice drums = {[kick . . kick . . snare .] [hat*8]}` },
      `<p>Several <code>voice</code> lines play together. Each voice has a name so you can change it while the others keep playing.</p>`,
      { code: `voice drums = {[kick . snare .] [hat*8]}\nvoice bass  = [c2 . c2 eb2 . f2 g2 .]` },
      { exercise: {
        task: "Make <code>voice drums</code> play a kick on every quarter note and a hat on every eighth note.",
        starter: "voice drums = {[kick] [hat]}", solution: "voice drums = {[kick*4] [hat*8]}",
        check: (_s, n) => { const d = voiceNotes(n, "drums").filter(x => x.bar < 1); const k = d.filter(x => x.semi === 36).length, h = d.filter(x => x.semi === 42).length; return k === 4 && h === 8 ? null : `I hear ${k} kicks and ${h} hats in a bar; aim for 4 and 8.`; },
      } },
    ],
  },
  {
    id: "keys", title: "4. Keys and scale degrees",
    parts: [
      `<p>Writing melodies as note names ties them to one key. Scale degrees don't: <code>^1</code> is the first note of the current scale, <code>^3</code> the third, <code>^8</code> the octave above <code>^1</code>, <code>^0</code> the note below it.</p>`,
      { code: `key d dorian\nvoice tune = [^1 ^3 ^5 ^4 ^3 ^2 ^1 .]` },
      `<p>Change the key line and the same tune moves. Try <code>key a minor</code>, <code>key f lydian</code>, <code>key c major_pent</code>. Accidentals work on degrees too: <code>^b3</code>, <code>^#4</code>.</p>`,
      `<p><code>.octave(n)</code> moves anything by octaves; <code>.step(n)</code> moves by steps of the scale; <code>.transpose(n)</code> moves by semitones.</p>`,
      { code: `key e minor\nvoice tune = [^1 ^3 ^5 ^3]\nvoice low  = [^1 ^3 ^5 ^3].octave(-1).step(2)` },
      `<p>A voice can have its own key with <code>.key(root, scale)</code>.</p>`,
      { exercise: {
        task: "In the key of G major, write <code>voice up</code>: the first five degrees going up, ^1 to ^5, in one bar.",
        starter: "key g major\nvoice up = [^1]", solution: "key g major\nvoice up = [^1 ^2 ^3 ^4 ^5]",
        check: (_s, n) => { const t = voiceNotes(n, "up").filter(x => x.bar < 1).map(x => x.semi); return JSON.stringify(t) === "[67,69,71,72,74]" ? null : `I hear ${t.length} notes (${t.join(" ")}); G major from G4 up is 67 69 71 72 74.`; },
      } },
    ],
  },
  {
    id: "chords", title: "5. Chords",
    parts: [
      `<p>A chord is notes in braces, or a root with <code>@</code> and a quality.</p>`,
      { code: `voice pad = <{c e g} c4@maj7 a3@m7 f3@maj7>.inst(pad)` },
      `<p>The angle brackets <code>&lt; &gt;</code> play one item per bar, in turn, so that is a four-bar progression.</p>`,
      `<p>On a scale degree, <code>@</code> counts chord tones the way musicians do: <code>^5@7</code> is the diatonic seventh chord on the fifth degree, <code>^2@3</code> a triad, <code>^1@9</code> a ninth chord. Named qualities work too: <code>^4@sus4</code>.</p>`,
      { code: `key c major\nvoice comp = <^2@7 ^5@7 ^1@7 ^6@7>.strum.inst(keys)` },
      `<p><code>.strum</code> rolls a chord from low to high. <code>.arp</code> spreads it across its length (modes: <code>"up"</code>, <code>"down"</code>, <code>"updown"</code>, <code>"out"</code>, <code>"random"</code>), and <code>.invert</code> voices it differently.</p>`,
      { code: `key a minor\nvoice arp = <^1@9 ^6@7>.arp("updown").fast(2).inst(pluck)` },
      { exercise: {
        task: "Make <code>voice harmony</code> play a D minor seventh chord (on d3) for the whole bar.",
        starter: "voice harmony = d3", solution: "voice harmony = d3@m7",
        check: (_s, n) => { const t = voiceNotes(n, "harmony").filter(x => x.bar < 1).map(x => x.semi).sort((a, b) => a - b); return JSON.stringify(t) === "[50,53,57,60]" ? null : `That chord is ${t.join(" ") || "silent"}; D minor 7 on d3 is 50 53 57 60.`; },
      } },
    ],
  },
  {
    id: "transform", title: "6. Transforming patterns",
    parts: [
      `<p>Every function can be called with a dot after its first argument: <code>p.fast(2)</code> is the same as <code>fast(p, 2)</code>. Chains read left to right like a signal path, and a line that starts with <code>.</code> continues the line above.</p>`,
      { code: `voice tune = [c e g b]\n  .fast(2)\n  .rev\n  .every(4, x => x.transpose(5))`, bars: 4 },
      `<p><code>every(n, f)</code> applies f on the <b>last</b> bar of each group of n, because that is where fills belong. Use <code>at: 0</code> to put it on the first bar instead.</p>`,
      `<p>Other shapers: <code>slow</code>, <code>late</code>, <code>early</code>, <code>palindrome</code>, <code>iter</code>, <code>ply</code>, <code>echo</code>, <code>swing</code>, <code>off</code>, <code>trunc</code>.</p>`,
      { code: `voice drums = {[kick . snare .] [hat*8].swing(0.4)}\nvoice keys  = [c e g . ].echo(times: 3, time: 3/16, decay: .5).inst(bell)`, bars: 2 },
      `<p>Arithmetic works on whole patterns: <code>[c e g] + 12</code> is an octave up. <code>[c e g] * 2</code> plays the phrase twice per bar, just like <code>*</code> inside a phrase. On a single pitch, <code>*</code> multiplies frequency: <code>c4 * 3/2</code> is a pure fifth.</p>`,
      { exercise: {
        task: "Take <code>[c d e f]</code>, play it twice as fast, and reverse it. Name the voice <code>run</code>.",
        starter: "voice run = [c d e f]", solution: "voice run = [c d e f].fast(2).rev",
        check: (_s, n) => { const t = voiceNotes(n, "run").filter(x => x.bar < 1).map(x => x.semi); return JSON.stringify(t) === "[65,64,62,60,65,64,62,60]" ? null : `I hear ${t.join(" ")}.`; },
      } },
    ],
  },
  {
    id: "time", title: "7. Change over time",
    parts: [
      `<p>Music needs to move. <code>&lt;a b c&gt;</code> picks one per bar and can sit anywhere in a phrase.</p>`,
      { code: `voice bass = [c2 <eb2 f2 g2> . <c2 bb1>]`, bars: 4 },
      `<p><code>arrange</code> chains whole patterns for a number of bars each. <code>cat</code> takes one per bar.</p>`,
      { code: `let up = [c e g e]\nlet turn = [d f a f]\nvoice tune = arrange(up, 2, turn, 1, up.rev, 1)`, bars: 4 },
      `<p>For anything else, <code>per_bar</code> hands you the bar number and lets you compute the bar with ordinary logic.</p>`,
      { code: `voice climb = per_bar(n => [c e g].transpose(n % 4 * 2).fast(1 + n % 3))`, bars: 4 },
      `<p>Sometimes a bar should depend on the bar before, like a melody that wanders a step at a time. <code>evolve(start, step, play)</code> keeps a value from bar to bar: <code>step</code> turns this bar's value into the next one, and <code>play</code> turns it into music. It still replays exactly: Tine works the chain out from the start, so bar 9 sounds the same whether you got there by playing or by jumping.</p>`,
      { code: `voice walk = evolve(c4, (p, bar) => p + pick([-2 -1 1 2]), (p, bar) => [p (p + 7) (p + 12) (p + 7)]).inst(pluck)`, bars: 4 },
    ],
  },
  {
    id: "chance", title: "8. Chance, seeds and replay",
    parts: [
      `<p>Randomness in Tine is always <b>seeded</b>. Each run gets a seed, which is shown on screen; the same seed always produces exactly the same music. Press ▶ twice: identical. Press 🎲 to try a new seed.</p>`,
      { code: `voice tune = [c|e|g a|b|. c5 e|d]*2`, bars: 4 },
      `<p><code>a|b|c</code> picks one each bar. <code>x?</code> plays x half the time; <code>x?0.2</code> one time in five.</p>`,
      { code: `voice drums = {[kick . . kick?0.3 . . snare kick?] [hat*16].degrade(.3)}`, bars: 4 },
      `<p>Higher-level tools: <code>dice(list, n)</code> rolls n times per bar, <code>walk(list)</code> wanders step by step, <code>scramble</code> reshuffles a phrase every bar, <code>sometimes(f)</code>, <code>often</code>, <code>rarely</code>, <code>maybe</code> apply a change by chance, and <code>humanize</code> nudges timing and velocity.</p>`,
      { code: `key d dorian\nvoice wander = walk(0..9, 8).degrees.inst(pluck)\nvoice bells  = dice([^5 ^8 ^9 . .], 4).inst(bell).sometimes(x => x.octave(1))`, bars: 4 },
      `<p>To freeze a take you like, write <code>seed 1234</code> at the top of the file (the DAW's <b>★ keep take</b> button does it for you). Because every random choice is keyed to its voice and bar, editing one voice never changes the dice of another.</p>`,
    ],
  },
  {
    id: "code", title: "9. Functions and logic",
    parts: [
      `<p><code>let</code> names a value or a function. Function bodies can be a single expression or an indented block whose last line is the result.</p>`,
      { code: `let fill(p) = p.fast(2).vel(.6)\nlet groove(shift) =\n  let base = [kick . snare kick . kick snare .]\n  base.late(shift)\nvoice drums = groove(0).every(4, fill)`, bars: 4 },
      `<p><code>if ... then ... else ...</code> is an expression. Lambdas are <code>x =&gt; ...</code> or <code>(a, b) =&gt; ...</code>. Lists are phrases, so <code>map</code>, <code>filter</code>, <code>fold</code>, <code>len</code> and <code>at</code> work on them, and <code>0..7</code> is a range.</p>`,
      { code: `let harmonics = map(1..8, k => c2 * k)\nvoice series = harmonics.inst(sine)`, bars: 1 },
      `<p>Records hold named values: <code>(root: d, scale: dorian)</code>, read with <code>.root</code>. Functions you define chain with a dot like built-ins.</p>`,
      { code: `let mirror(p) = cat(p, p.rev)\nvoice tune = [c d e g].mirror.inst(pluck)`, bars: 2 },
    ],
  },
  {
    id: "sound", title: "10. Sound and expression",
    parts: [
      `<p>Built-in instruments: <code>keys</code> (an electric piano, the default), <code>pluck</code>, <code>bass</code>, <code>pad</code>, <code>bell</code>, <code>organ</code>, <code>lead</code>, <code>sine</code>, <code>tri</code>, <code>saw</code>, <code>square</code>, and <code>kit</code> for drums.</p>`,
      `<p>Parameters can be patterns too. Velocity accents, filter sweeps and panning become part of the music.</p>`,
      { code: `voice acid = [c2 c2 c3 c2 eb2 c2 g2 bb1]*2\n  .inst(saw)\n  .cutoff(sine(2).range(300, 3000))\n  .res(.6)\n  .vel([1 .6 .8 .6])`, bars: 2 },
      `<p>Signals are continuous shapes: <code>sine</code>, <code>tri</code>, <code>saw</code>, <code>square</code>, <code>noise</code> and <code>drift</code> (smooth, seeded wandering). Use <code>.range(lo, hi)</code> to scale them and <code>.seg(n)</code> to turn one into notes.</p>`,
      { code: `key c minor_pent\nvoice drifty = drift(.5).range(0, 10).seg(8).map(x => floor(x)).degrees.inst(bell).pan(sine(1).range(-1, 1))`, bars: 2 },
      `<p>Other parameters: <code>legato</code>, <code>dur</code> (in beats), <code>gain</code>, <code>pan</code>, <code>attack</code>, <code>decay</code>, <code>sustain</code>, <code>release</code>, <code>reverb</code>.</p>`,
      `<p>Effects work on a whole voice after its notes are mixed: <code>.hpf(hz)</code> and <code>.lpf(hz)</code> filter it, <code>.drive(x)</code> saturates it from 0 to 1, and <code>.delay(mix, time: 3/16, feedback: .4)</code> echoes it. Delay time is in bars, so the echo stays in time at any tempo.</p>`,
      { code: `voice fuzz = [c2 . c2 eb2 . g1 bb1 .].inst(saw).drive(.7).lpf(1800)
voice echo = [g4 . . bb4 . . . .].inst(pluck).delay(.5, feedback: .55)`, bars: 2 },
    ],
  },
  {
    id: "micro", title: "11. Beyond twelve notes",
    parts: [
      `<p>Every pitch in Tine is a fractional MIDI note, so the space between the piano keys is open. Add cents with <code>c</code>, steps of an equal division with a backslash, or multiply by a frequency ratio.</p>`,
      { code: `voice micro = [c4 (c4 + 50c) (c4 + 5\\31) (c4 * 7/4) 432hz]` },
      `<p>Whole scales: <code>edo(n, steps)</code> picks from an n-tone equal temperament, <code>just(ratios)</code> builds a just-intonation scale, <code>cents(list)</code> works in cents, and <code>scala(text)</code> reads the standard Scala .scl format.</p>`,
      { code: `key c edo(31, [0 5 10 13 18 23 28])\nvoice meantone = [^1 ^3 ^5 ^8 ^5 ^3]\nvoice drone = {c3 g3}.inst(pad)`, bars: 2 },
      { code: `key d just([1 9/8 5/4 4/3 3/2 5/3 15/8])\nvoice pure = <^1@3 ^4@3 ^5@3 ^1@3>.arp("up").fast(2).inst(organ)`, bars: 4 },
      `<p>Scales need not repeat at the octave: <code>bohlen_pierce</code> repeats at the twelfth. When microtones go out over MIDI, Tine sends pitch bend; add <code>.mpe</code> for one channel per note so chords stay in tune.</p>`,
    ],
  },
  {
    id: "rhythm2", title: "12. Rhythmic depth",
    parts: [
      `<p><code>euclid(hits, steps)</code> spreads hits as evenly as possible, which produces many traditional rhythms.</p>`,
      { code: `voice drums = {kick.euclid(3, 8) rim.euclid(5, 8, rot: 2) [hat*8]}` },
      `<p><code>poly(steps)</code> makes polymeter: a phrase of any length stepped at a fixed rate, so it drifts against the bar line and realigns later.</p>`,
      { code: `voice four = [kick . . .]\nvoice three = [c5 e5 g5].poly(8).inst(pluck)`, bars: 3 },
      `<p>Odd meters are a line: <code>meter 7/8</code>. Tempo counts the beat unit of the meter. Nesting goes as deep as you like: here is a quintuplet inside a triplet.</p>`,
      { code: `meter 7/8\ntempo 240\nvoice odd = [kick . hat kick . snare hat]\nvoice deep = [c5 [e5 [g5 a5 b5 c6 d6] e5] .].inst(bell)` },
    ],
  },
  {
    id: "form", title: "13. Composing whole pieces",
    parts: [
      `<p>Top-level voices loop forever, which is what you want on stage. For a finished piece, group voices into <b>sections</b> with a length in bars, and list them in a <b>form</b>.</p>`,
      { code: `tempo 104\nkey a minor\n\nvoice drums = {[kick . snare .] [hat*8]}\n\nsection verse 4\n  voice bass = [^1 . ^1 ^5].octave(-2).inst(bass)\n\nsection chorus 4\n  tempo 112\n  voice bass = [^4 ^4 ^5 ^5].octave(-2).inst(bass)\n  voice lift = <^4@7 ^5@7>.inst(pad)\n\nform verse chorus verse`, bars: 12 },
      `<p>Voices outside sections play throughout. Each section can change tempo and key. Inside a section, patterns start fresh, so every verse begins the same way, but random choices still differ between repeats.</p>`,
      `<p>From the command line: <code>tine render piece.tine</code> makes a WAV, <code>tine midi piece.tine</code> a MIDI file for any other DAW, and <code>tine pack piece.tine</code> a single HTML file that plays the piece anywhere.</p>`,
    ],
  },
  {
    id: "live", title: "14. Performing live",
    parts: [
      `<p>Run <code>tine daw mypiece.tine</code>. The DAW opens in your browser, plays the file, and reloads whenever the file changes, so you can perform from the DAW's editor or from your own editor.</p>`,
      `<p>Re-evaluate with <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Enter</kbd>. New code takes over on the next bar line, so the groove never stumbles. If you make a mistake, the broken voice keeps its last good version and everything else carries on.</p>`,
      `<p>Sections become scenes you can launch, and every evaluation is saved with its seed under <b>Takes</b>, so nothing you heard is ever lost.</p>`,
      `<p>Connect MIDI gear in the MIDI tab:</p><ul><li><code>.midi(2)</code> sends a voice to channel 2 of a synth or another DAW.</li><li><code>cc(74)</code> is a knob on your controller, as a 0 to 1 signal: <code>.cutoff(cc(74).range(200, 4000))</code>.</li><li><code>held(8).arp</code> arpeggiates whatever chord you hold on the keyboard.</li><li><b>● capture</b> records what you play for a few bars and writes it into your code as a new voice.</li><li><code>.ctl(74, sine(4))</code> turns a synth's knob along with the music, <code>.program(5)</code> changes its sound, and <code>sine(4).as_cc(74).midi(1)</code> is a voice made only of knob moves.</li><li>Send MIDI clock and drum machines follow you; follow MIDI clock and you follow them, tempo, start and stop.</li></ul>`,
      { code: `-- in the DAW, with a keyboard connected:\nkey c minor\nvoice hands = held(8).arp("updown").inst(pluck)\nvoice drums = {[kick . snare .] [hat*8]}`, bars: 2 },
      `<p>That is the whole language. The <b>Reference</b> at the end lists every function.</p>`,
    ],
  },
];
