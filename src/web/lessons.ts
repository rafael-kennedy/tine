// The tutorial's content. Prose is small HTML; code cells are live.
//
// The reader is assumed to program already and to know no music vocabulary.
// Rules for this file (see docs/COURSE-PEDAGOGY.md, "The language tutorial"):
//   - every music term is defined in the sentence that first uses it;
//   - every Tine feature is taught before an example relies on it;
//   - the example plays before the paragraph that names what it did;
//   - examples suggest a specific edit and say what it will do;
//   - every lesson ends with a checked exercise.
import type { Scene, TimedNote } from "../core";
import { buildChart, chordText } from "../core";

export interface Cell { code: string; bars?: number; sheet?: "chart" | "lead" | "score" }
export interface Exercise {
  task: string; starter: string; solution: string; bars?: number; hint?: string; sheet?: "chart" | "lead" | "score";
  check: (s: Scene, n: TimedNote[], src?: string) => string | null;
  // for the tests: other answers that must pass, and wrong answers that must fail
  alsoRight?: string[]; wrong?: string[];
}
export type Part = string | Cell | { exercise: Exercise };
export interface Lesson { id: string; title: string; parts: Part[] }

// ---------- helpers for exercise checks ----------

const EPS = 1e-6;
const voiceNotes = (n: TimedNote[], v: string) => n.filter(x => x.voice === v);
const firstBar = (n: TimedNote[], v: string) => voiceNotes(n, v).filter(x => x.bar < 1 - EPS);
const round = (x: number) => Math.round(x * 1000) / 1000;
const num = (x: any): number => (x && typeof x === "object" && "n" in x ? x.n / x.d : Number(x));
const LETTERS = ["c", "c#", "d", "eb", "e", "f", "f#", "g", "ab", "a", "bb", "b"];
/** A pitch number as a note name, as lesson 1 teaches it: 60 is c4. */
export const noteName = (semi: number) => {
  const r = Math.round(semi);
  const cents = Math.round((semi - r) * 100);
  return LETTERS[((r % 12) + 12) % 12] + (Math.floor(r / 12) - 1) + (cents ? ` ${cents > 0 ? "+" : ""}${cents}c` : "");
};
const names = (n: TimedNote[]) => n.map(x => noteName(x.semi)).join(" ") || "nothing";
const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 0.001);
/** Where in the bar something starts, in the words the lessons use. */
const place = (bar: number, grid: number) => {
  const p = (bar - Math.floor(bar + EPS)) * grid;
  return Math.abs(p - Math.round(p)) < 0.001 ? `step ${Math.round(p) + 1} of ${grid}` : `${round(bar)} of the way through the bar`;
};
const noVoice = (n: TimedNote[], v: string) => (voiceNotes(n, v).length ? null : `There is no voice named ${v} playing yet.`);
/** A message if any two notes start together, for tasks that ask for notes in a row. */
const notInARow = (t: TimedNote[]) => (t.some((x, i) => i > 0 && x.bar < t[i - 1].bar + EPS) ? "Some of those notes start together. Put them one after another inside square brackets." : null);
const KICK = 36, SNARE = 38, CLAP = 39, HAT = 42;

export const LESSONS: Lesson[] = [
  // ------------------------------------------------------------------
  {
    id: "first", title: "1. A first sound",
    parts: [
      `<p>Press <b>▶ play</b> (or <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Enter</kbd> inside the code).</p>`,
      { code: `voice hello = [c e g]` },
      `<p>You heard three notes, then the same three again, and again. A Tine program is a list of <b>voices</b>. A voice is a named part that loops. The length of that loop is one <b>bar</b>, and the bar is Tine's unit of time: every voice loops on it and lines up with every other voice on it.</p>`,
      `<p>The square brackets make a <b>phrase</b>. A phrase divides one bar into equal steps, so three notes each get a third of the bar. Add a fourth note and all four get shorter. The bar stays the same length.</p>`,
      { code: `voice hello = [c e g c5]` },
      { code: `tempo 80\nvoice hello = [c e g c5]` },
      `<p>That was slower. A <code>tempo</code> line sets how long a bar lasts. A <b>beat</b> is the steady pulse you would tap your foot to, and a bar holds four of them unless you say otherwise. Tempo is the number of beats per minute. The default is 120, which makes a bar two seconds, and 80 makes it three. Change the 80 to 160 and the loop takes half as long.</p>`,
      { code: `voice climb = [c4 d4 e4 f4 g4 a4 b4 c5]` },
      `<p>The letters <code>a</code> to <code>g</code> are the white keys of a piano. After <code>g</code> the letters start again at <code>a</code>, higher up. The number says which repetition you are in, and it is called the <b>octave</b>. Octave numbers change at <code>c</code>, not at <code>a</code>, which is why the note after <code>b4</code> is <code>c5</code>. <code>c4</code> is the C in the middle of a piano. With no number you get octave 4.</p>`,
      { code: `print(c4 + 7)\nprint(eb4 - c4)\nvoice numbers = [c4 (c4 + 7) (c4 + 12) 60]` },
      `<p>How high or low a note sounds is its <b>pitch</b>, and underneath, a pitch is a number. <code>c4</code> is 60, and each piano key up, white or black, adds 1. That distance of 1 is a <b>semitone</b>. The black keys are written with <code>#</code> (sharp, add 1) or <code>b</code> (flat, subtract 1): <code>c#4</code> is 61, and <code>eb4</code> is 63. There is no black key between <code>e</code> and <code>f</code> or between <code>b</code> and <code>c</code>, so those pairs are 1 apart and the other neighbouring letters are 2 apart. Add 12 and you land on the same letter in the next octave: <code>c5</code> is 72. Two notes 12 apart sound like one note at two heights.</p>`,
      `<p><code>print</code> shows a value under the example. Parentheses put any expression inside a phrase, and a bare number in a phrase is a pitch number. Change the 7 inside the brackets to 6 and the second note drops to a black key, <code>f#4</code>.</p>`,
      `<p>Two things that catch programmers. Phrases have no commas: <code>[c, e, g]</code> is an error. And note names are reserved words, so <code>a</code> to <code>g</code> (and <code>bb</code>, <code>eb</code> and the like) can never name a variable, a parameter or a function. That rules out <code>f</code> and <code>g</code>.</p>`,
      `<p>The drawing under each example is a piano roll. Time runs left to right and pitch runs bottom to top. The bright vertical lines are bar lines and the faint ones are the beats.</p>`,
      { exercise: {
        task: "Make a voice called <code>tune</code> that plays the four notes C, D, E, G in one bar, in octave 4.",
        starter: "voice tune = [c]", solution: "voice tune = [c d e g]",
        hint: "Four names inside one pair of brackets, separated by spaces.",
        alsoRight: ["voice tune = [c4 d4 e4 g4]", "voice tune = [60 62 64 67]"],
        wrong: ["voice tune = {c d e g}", "voice tune = [c d [e g]]", "voice tune = [c d e]", "voice tune = [c3 d3 e3 g3]", "voice song = [c d e g]", "voice tune = [c d e f]"],
        check: (_s, n) => {
          const t = firstBar(n, "tune");
          if (!t.length) return "There is no voice named tune yet.";
          if (t.length !== 4) return `That bar has ${t.length} note${t.length === 1 ? "" : "s"} (${names(t)}); it should have 4.`;
          const row = notInARow(t); if (row) return row;
          if (t.some(x => Math.abs(x.bars - 0.25) > EPS)) return "Four notes, but not four equal steps. Give each note one step of its own.";
          const got = t.map(x => x.semi);
          if (same(got, [60, 62, 64, 67])) return null;
          if (same(got.map(x => ((x % 12) + 12) % 12), [0, 2, 4, 7])) return `Right letters, wrong octave: I hear ${names(t)}. Octave 4 is what you get with no number.`;
          return `Right number of notes, but I hear ${names(t)}. It should be c4 d4 e4 g4.`;
        },
      } },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: "rhythm", title: "2. Rests, holds and lengths",
    parts: [
      { code: `voice riff = [c . e _ g . . c5]` },
      `<p>That phrase has eight steps but only four notes. A <code>.</code> is a <b>rest</b>: one step of silence. A <code>_</code> <b>holds</b> the note before it for one more step, so the <code>e</code> lasts twice as long as the <code>c</code>. Change the <code>_</code> to a <code>.</code> and the <code>e</code> is cut short.</p>`,
      `<p>Musicians name step lengths by the fraction of a four-beat bar they fill. Four steps in a bar are <b>quarter notes</b>, one per beat. Eight steps are <b>eighth notes</b>. Sixteen are <b>sixteenth notes</b>. The riff above is written in eighth notes.</p>`,
      { code: `voice riff = [c:3 e g:2 . ]` },
      `<p>A colon gives a step a weight, which makes it longer without counting holds. The weights here add up to 7 (3 + 1 + 2 + 1), so the bar is cut into sevenths and <code>c:3</code> gets three of them. Change <code>g:2</code> to <code>g:4</code>: the total becomes 9 and every step shrinks to make room.</p>`,
      { code: `voice riff = [c [e e e] g [a b c5 d5 e5]]` },
      `<p>Any step can itself be a phrase, and the nested brackets divide just that step. Three equal notes in a space that would normally hold two are called a <b>triplet</b>, and five are a <b>quintuplet</b>. Time in Tine is exact rational arithmetic, so nesting never drifts, however deep it goes.</p>`,
      { code: `voice riff = [c*2 e!3 g*4]` },
      `<p>Two shortcuts. <code>x*3</code> plays x three times inside its own step, and <code>x!3</code> repeats x as three separate steps. So that is five steps: one for <code>c*2</code>, three for <code>e!3</code>, one for <code>g*4</code>. Change <code>e!3</code> to <code>e*3</code> and the phrase has only three steps, each longer.</p>`,
      { exercise: {
        task: "Write <code>voice beat</code> in quarter notes: a C on beats 1 and 3, silence on beats 2 and 4.",
        starter: "voice beat = [c]", solution: "voice beat = [c . c .]",
        hint: "Four steps, one per beat. A rest is a dot.",
        alsoRight: ["voice beat = [c4 . c4 .]", "voice beat = [c . . . c . . .]", "voice beat = [c .]*2"],
        wrong: ["voice beat = [e . e .]", "voice beat = [kick . kick .]", "voice beat = [c:2 c:2]", "voice beat = [c _ c _]", "voice beat = [c c . .]", "voice beat = [. c . c]", "voice beat = [c . c]"],
        check: (_s, n) => {
          const t = firstBar(n, "beat");
          if (!t.length) return "There is no voice named beat yet.";
          const starts = t.map(x => round(x.bar));
          if (t.length === 1 && starts[0] === 0) return "I hear one note, on beat 1. Add a second on beat 3, with silence between.";
          if (!same(starts, [0, 0.5])) return `Notes start at ${t.map(x => place(x.bar, 4)).join(" and ")}. Beats 1 and 3 are steps 1 and 3 of 4.`;
          if (t.some(x => Math.abs(x.semi - 60) > 0.001)) return `Right rhythm, but I hear ${names(t)}. Both notes should be c4.`;
          if (t.some(x => x.bars > 0.25 + EPS)) return "The notes start in the right places, but they ring through beats 2 and 4. Each note should last one beat, with a rest (.) after it.";
          return null;
        },
      } },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: "together", title: "3. Drums, layers and voices",
    parts: [
      { code: `voice drums = [kick hat snare hat]` },
      `<p>Drum names are built in. <code>kick</code> is the low thump of the bass drum, <code>snare</code> the sharp crack, and <code>hat</code> the short tick of a closed hi-hat cymbal. Swap the two <code>hat</code>s for <code>ohat</code>, the same cymbal left open, and each tick becomes a longer hiss. <code>clap</code> and <code>rim</code> (a stick on the drum's edge, a click) come up later, and the Reference lists the rest.</p>`,
      `<p>So far each step has played one thing. Curly braces play things <b>at the same time</b>.</p>`,
      { code: `voice drums = {[kick . . kick . . snare .] [hat*8]}` },
      `<p>Two phrases in braces are layered, and each divides the bar its own way. The first has eight steps with a kick on steps 1 and 4 and a snare on step 7. The second is eight hats, which are eighth notes. Change <code>hat*8</code> to <code>hat*16</code> for sixteenth notes: the hats double and the kick and snare do not move.</p>`,
      `<p>Several <code>voice</code> lines play together too. Use separate voices for separate instruments, so you can change one while the others keep going.</p>`,
      { code: `voice drums = {[kick . snare .] [hat*8]}\nvoice bass  = [c2 . c2 eb2 . f2 g2 .]` },
      `<p>The second voice is a <b>bass line</b>: the lowest part, which usually lives around octave 2. Delete the whole <code>drums</code> line and the bass carries on alone.</p>`,
      { exercise: {
        task: "Make <code>voice drums</code> play a kick on every beat (four quarter notes) and a hat on every eighth note.",
        starter: "voice drums = {[kick] [hat]}", solution: "voice drums = {[kick*4] [hat*8]}",
        hint: "<code>x*4</code> plays x four times, evenly, in its step. Each phrase here is one step long.",
        alsoRight: ["voice drums = {[kick kick kick kick] [hat*8]}", "voice drums = {[kick!4] [hat!8]}"],
        wrong: ["voice drums = {[kick kick kick kick . . . .] [hat*8]}", "voice drums = {[kick*4] [hat*4]}", "voice drums = {[kick*8] [hat*8]}"],
        check: (_s, n) => {
          const d = firstBar(n, "drums");
          if (!d.length) return "There is no voice named drums yet.";
          const k = d.filter(x => x.semi === KICK).map(x => round(x.bar)), h = d.filter(x => x.semi === HAT).map(x => round(x.bar));
          if (k.length !== 4 || h.length !== 8) return `I hear ${k.length} kick${k.length === 1 ? "" : "s"} and ${h.length} hat${h.length === 1 ? "" : "s"} in the bar; aim for 4 and 8.`;
          if (!same(k, [0, 0.25, 0.5, 0.75])) return "Four kicks, but they are not evenly spaced. One on each beat means one at the start of each quarter of the bar.";
          if (!same(h, [0, 1, 2, 3, 4, 5, 6, 7].map(i => i / 8))) return "Eight hats, but they are not evenly spaced across the bar.";
          return null;
        },
      } },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: "transform", title: "4. Transforming patterns",
    parts: [
      { code: `voice tune = [c e g b]\n  .fast(2)\n  .rev` },
      `<p>The phrase goes up. What you heard goes down, twice per bar. <code>fast(2)</code> plays a pattern twice as fast and <code>rev</code> reverses it. Delete the <code>.rev</code> line and it climbs again.</p>`,
      `<p>A <b>pattern</b> is anything that can fill a voice: a phrase, or the result of a function applied to one. Every function can be called with a dot after its first argument: <code>p.fast(2)</code> is the same as <code>fast(p, 2)</code>. A call with no other arguments needs no parentheses, so <code>p.rev</code> is <code>rev(p)</code>. Chains read left to right, and a line that starts with <code>.</code> continues the line above.</p>`,
      { code: `voice tune = [c e g b].transpose(5)\nvoice low  = [c e g b].octave(-2)` },
      `<p><code>transpose(n)</code> adds n semitones to every note. <code>octave(n)</code> moves by whole octaves, so it is <code>transpose(12 * n)</code>. Change the 5 to 7 and the upper voice moves two more semitones up.</p>`,
      { code: `voice drums = [kick hat snare hat].every(4, x => x.ply(2))`, bars: 4 },
      `<p>Three plain bars, then a busy one. Functions can take functions: <code>every(n, f)</code> applies f to one bar in each group of n. <code>x =&gt; ...</code> is a lambda, and <code>ply(2)</code> plays each step twice. A short variation at the end of a group of bars is called a <b>fill</b>. It tells the listener the pattern is about to come round again, which is why <code>every</code> changes the <em>last</em> bar of each group. Arguments can be given by name, and <code>at: 0</code> moves the change to the first bar: <code>.every(4, x =&gt; x.ply(2), at: 0)</code>.</p>`,
      { code: `voice drums = {[kick . snare .] [hat*8].swing(0.4)}\nvoice chime = [c5 . g4 .].late(1/8)` },
      `<p>Two functions that move notes in time. <code>swing(x)</code> delays every second eighth note by x of an eighth, so the hats go long, short, long, short where they used to tick evenly. Set it to 0 to hear them straight. <code>late(x)</code> shifts a whole pattern later by a fraction of a bar, so the chime sounds an eighth note after the kick and after the snare. Delete <code>.late(1/8)</code> and it lands on top of them.</p>`,
      { code: `voice tune = [c e g] + 12` },
      `<p>Arithmetic works on whole patterns. <code>+ 12</code> adds 12 to every note, an octave up. Change <code>+ 12</code> to <code>* 2</code> and the phrase plays twice per bar at its original height. The star needs care, because it means three things:</p><ul><li>Inside a phrase, <code>x*3</code> plays x three times in its step.</li><li>On a pattern, <code>p * 2</code> plays it twice per bar, the same as <code>p.fast(2)</code>.</li><li>On a single pitch it multiplies <em>frequency</em>: <code>c4 * 2</code> is <code>c5</code>, because doubling a frequency raises a note one octave.</li></ul>`,
      `<p>A method call binds tighter than any operator. In <code>[c e g]*2.rev</code> the <code>.rev</code> applies to the 2 and turns it into a one-step pattern. A pattern times a pattern multiplies frequencies, so every note goes up an octave. You get the wrong notes and no error. Write <code>([c e g]*2).rev</code>, or stay with <code>.fast(2).rev</code>.</p>`,
      { code: `voice right = ([c e g]*2).rev\nvoice wrong = [c2 e2 g2]*2.rev` },
      `<p>The <code>wrong</code> voice was meant to be the same shape two octaves down. It plays three notes where there should be six, not reversed, and an octave too high. Put the parentheses in and the two voices match.</p>`,
      `<p>The <a href="#reference">Reference</a> lists the other functions that reshape a pattern.</p>`,
      { exercise: {
        task: "Take <code>[c d e f]</code>, play it twice as fast, and reverse it. Name the voice <code>run</code>.",
        starter: "voice run = [c d e f]", solution: "voice run = [c d e f].fast(2).rev",
        hint: "Two calls chained with dots. The order of these two does not matter.",
        alsoRight: ["voice run = [c d e f].rev.fast(2)", "voice run = ([c d e f]*2).rev", "voice run = rev(fast([c d e f], 2))"],
        wrong: ["voice run = [c d e f].fast(2)", "voice run = [c d e f].rev", "voice run = [c d e f]*2.rev"],
        check: (_s, n) => {
          const t = firstBar(n, "run");
          if (!t.length) return "There is no voice named run yet.";
          const got = t.map(x => x.semi);
          if (same(got, [65, 64, 62, 60, 65, 64, 62, 60])) return null;
          if (same(got, [60, 62, 64, 65, 60, 62, 64, 65])) return "Twice as fast, but still going up. Reverse it too.";
          if (same(got, [65, 64, 62, 60])) return "Reversed, but only once per bar. Make it twice as fast too.";
          if (same(got, [72, 74, 76, 77])) return "I hear c5 d5 e5 f5: an octave up, not faster and not reversed. The .rev attached to the 2. Use .fast(2).rev, or put ([c d e f]*2) in parentheses.";
          return `I hear ${names(t)}. It should be f4 e4 d4 c4, twice.`;
        },
      } },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: "code", title: "5. Functions and logic",
    parts: [
      { code: `let fill(p) = p.fast(2).vel(.6)\nlet groove(shift) =\n  let base = [kick . snare kick . kick snare .]\n  base.late(shift)\nvoice drums = groove(0).every(4, fill)`, bars: 4 },
      `<p><code>let</code> names a value or defines a function. A function body is one expression, or an indented block whose last line is the result. <code>fill</code> and <code>groove</code> are both functions, and <code>base</code> is a value local to <code>groove</code>.</p>`,
      `<p><code>vel</code> sets <b>velocity</b>: how hard each note is struck, from 0 to 1. The default is 0.8, so the fill at 0.6 is quieter than the bars around it. Change <code>groove(0)</code> to <code>groove(1/8)</code> and the whole pattern starts an eighth note late.</p>`,
      `<p><code>if ... then ... else ...</code> is an expression. Lambdas are <code>x =&gt; ...</code> or <code>(x, y) =&gt; ...</code>. Remember the reserved note names: <code>(a, b) =&gt; ...</code> is an error, because <code>a</code> and <code>b</code> are notes. A phrase is also a list, so <code>map</code>, <code>filter</code>, <code>fold</code>, <code>len</code> and <code>at</code> work on it, and <code>1..8</code> is the list 1 to 8, both ends included. <code>fold</code> takes the list, the starting value, then the function. <code>at</code> counts from 0.</p>`,
      { code: `print(filter(1..8, k => k % 2 == 0))\nprint(if len([c e g]) > 2 then "long" else "short")\nprint(map([c e g], x => x + 12))\nprint(fold(1..4, 0, (x, y) => x + y))\nprint(at([c e g], 0))\n\nlet harmonics = map(1..8, k => c2 * k)\nvoice series = harmonics` },
      `<p>The voice plays <code>c2</code> with its frequency multiplied by 1, 2, 3 and so on up to 8. That ladder is the <b>harmonic series</b>, the pitches a single string sounds when it vibrates in halves, thirds, quarters and so on. The gaps shrink as it climbs. Change <code>1..8</code> to <code>1..16</code> to hear it continue.</p>`,
      `<p>Records hold named values, and a function you define chains with a dot like a built-in.</p>`,
      { code: `let home = (root: d4, shape: [0 3 7])\nprint(home.root)\n\nlet mirror(p) = cat(p, p.rev)\nvoice tune = (home.root + home.shape).mirror`, bars: 2 },
      `<p><code>cat(p, q)</code> plays its arguments one bar each, in turn, so <code>mirror</code> gives one bar forwards and one bar backwards. Adding a pitch to a list of numbers gives a list of pitches. Change <code>[0 3 7]</code> to <code>[0 4 7]</code> and the middle note of each bar rises a semitone.</p>`,
      { exercise: {
        task: "Define a function <code>octaves(p)</code> that plays p and, at the same time, a copy of p one octave lower. The <code>thick</code> line already calls it. Each of its three notes should sound as a pair.",
        starter: "let octaves(p) = p\nvoice thick = [c e g].octaves", solution: "let octaves(p) = {p p.octave(-1)}\nvoice thick = [c e g].octaves",
        hint: "Braces layer patterns, and a variable can sit inside them: <code>{p q}</code>. Lesson 4 has the function that moves by octaves. Arithmetic inside braces needs parentheses: <code>{p (p - 12)}</code>.",
        alsoRight: ["let octaves(p) = {p (p - 12)}\nvoice thick = [c e g].octaves", "let octaves(p) = {p.transpose(-12) p}\nvoice thick = octaves([c e g])", "let octaves = p => {p p.octave(-1)}\nvoice thick = [c e g].octaves"],
        wrong: ["let octaves(p) = [p p.octave(-1)]\nvoice thick = [c e g].octaves", "let octaves(p) = {p p.octave(1)}\nvoice thick = [c e g].octaves", "let octaves(p) = p.octave(-1)\nvoice thick = [c e g].octaves", "voice thick = {[c e g] [c3 e3 g3]}"],
        check: (_s, n, src) => {
          const t = firstBar(n, "thick");
          if (!t.length) return "There is no voice named thick yet.";
          const got = t.map(x => x.semi).sort((x, y) => x - y);
          if (same(got, [48, 52, 55, 60, 64, 67])) {
            const hi = t.filter(x => x.semi >= 60);
            if (!hi.every(u => t.some(v => Math.abs(v.semi - (u.semi - 12)) < 0.001 && Math.abs(v.bar - u.bar) < EPS))) return "Right six notes, but the lower copy plays after the original. Square brackets play in turn. Braces layer.";
            if (src !== undefined && !/let\s+octaves\s*(\(|=)/.test(src)) return "That sounds right, but the task is to do it with a function named octaves.";
            return null;
          }
          if (same(got, [60, 64, 67])) return "I hear only the original three notes. The function has to return p and the lower copy together.";
          if (same(got, [48, 52, 55])) return "I hear only the lower copy. Layer it with the original.";
          if (same(got, [60, 64, 67, 72, 76, 79])) return "The copy is an octave higher. It should be an octave lower.";
          return `I hear ${names(t)}. It should be c4 e4 g4 with c3 e3 g3 underneath.`;
        },
      } },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: "keys", title: "6. Keys and scale degrees",
    parts: [
      `<p>Play this. Then change <code>major</code> to <code>minor</code> and play it again.</p>`,
      { code: `key c major\nvoice tune = [^1 ^3 ^5 ^4 ^3 ^2 ^1 .]` },
      `<p>Same shape, darker mood. Now try <code>key a major</code>: the first mood again, on different notes. The tune was never written as notes. It was written as positions in a <b>scale</b>.</p>`,
      `<p>Most music uses only some of the twelve notes in an octave at a time, usually seven. That subset is a scale, and a scale is a list of offsets in semitones from a starting note. <code>major</code> is <code>0 2 4 5 7 9 11</code>. <code>minor</code> is <code>0 2 3 5 7 8 10</code>. The starting note is the <b>root</b>, and a root plus a scale is a <b>key</b>. So <code>key c major</code> selects c, d, e, f, g, a and b: the white keys.</p>`,
      `<p><code>^n</code> is a <b>scale degree</b>: a 1-based index into the current key. <code>^1</code> is the root and <code>^3</code> is the third note of the scale. The index wraps, so <code>^8</code> is <code>^1</code> an octave up, and <code>^0</code> is the note just below <code>^1</code>.</p>`,
      { code: `key c major\nvoice scale = [^1 ^2 ^3 ^4 ^5 ^6 ^7 ^8]` },
      `<p>Try <code>key d dorian</code> and <code>key c minor_pent</code> here. <code>dorian</code>, <code>lydian</code> and <code>mixolydian</code> are other seven-note scales, each with its own mood. <code>major_pent</code> and <code>minor_pent</code> have five notes, and almost any two of them sound good together. In a five-note scale the octave is <code>^6</code>, so the last two notes of this example go above it. The Reference lists every scale.</p>`,
      `<p>Degrees are not just shorter to type. They keep a transformed tune inside the key.</p>`,
      { code: `key c major\nvoice tune  = [^1 ^3 ^5 ^3]\nvoice above = [^1 ^3 ^5 ^3].step(2)` },
      `<p><code>step(n)</code> moves every note by n places in the scale, so <code>above</code> shadows the tune two scale notes higher, and both stay on white keys. Change <code>.step(2)</code> to <code>.transpose(2)</code>. That moves by two semitones regardless of the scale. Both <code>e</code>s become <code>f#</code>, which is not in C major, and the two voices clash.</p>`,
      `<p>To step outside the scale on purpose, flatten or sharpen a degree by a semitone: <code>^b3</code>, <code>^#4</code>. Those marks are called <b>accidentals</b>. And a voice can have its own key with <code>.key(root, scale)</code>:</p>`,
      { code: `key c major\nvoice here  = [^1 ^2 ^3 ^#4]\nvoice there = [^1 ^2 ^3 ^#4].key(g3, minor)` },
      `<p><code>here</code> plays c, d, e, f#. <code>there</code> plays the same four degrees in G minor, starting on <code>g3</code>. Change <code>^#4</code> to <code>^4</code> in both and each last note drops a semitone, back into its scale.</p>`,
      { exercise: {
        task: "In the key of G major, write <code>voice up</code>: the first five degrees going up, <code>^1</code> to <code>^5</code>, in one bar.",
        starter: "key g major\nvoice up = [^1]", solution: "key g major\nvoice up = [^1 ^2 ^3 ^4 ^5]",
        hint: "Five steps in the phrase. The key line already does the rest.",
        alsoRight: ["voice up = [^1 ^2 ^3 ^4 ^5].key(g, major)", "key g major\nvoice up = [g a b c5 d5]"],
        wrong: ["key g major\nvoice up = {^1 ^2 ^3 ^4 ^5}", "key g3 major\nvoice up = [^1 ^2 ^3 ^4 ^5]", "key c major\nvoice up = [^1 ^2 ^3 ^4 ^5]", "key g major\nvoice up = [^1 ^2 ^3 ^4]", "key g minor\nvoice up = [^1 ^2 ^3 ^4 ^5]", "key g major\nvoice up = [^5 ^4 ^3 ^2 ^1]"],
        check: (_s, n) => {
          const t = firstBar(n, "up");
          if (!t.length) return "There is no voice named up yet.";
          const got = t.map(x => x.semi);
          const row = notInARow(t); if (row) return row;
          if (same(got, [67, 69, 71, 72, 74])) return null;
          if (same(got, [55, 57, 59, 60, 62])) return "Right notes, one octave too low. key g major with no octave number starts on g4.";
          if (t.length !== 5) return `I hear ${t.length} note${t.length === 1 ? "" : "s"} (${names(t)}); there should be 5.`;
          if (same(got, [60, 62, 64, 65, 67])) return "Those are the first five notes of C major. Check the key line.";
          if (same(got, [67, 69, 70, 72, 74])) return "That is G minor: the third note is bb4 where G major has b4.";
          return `I hear ${names(t)}. G major from the root up is g4 a4 b4 c5 d5.`;
        },
      } },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: "chords", title: "7. Chords",
    parts: [
      { code: `voice chords = <{c e g} {a3 c e} {f3 a3 c} {g3 b3 d}>`, bars: 4 },
      `<p>Several notes sounded together are a <b>chord</b>, and braces around notes make one. The angle brackets <code>&lt; &gt;</code> play one item per bar, in turn, so this is four bars long. A sequence of chords is called a <b>progression</b>.</p>`,
      `<p>Spelling out every note is slow. Chords come in standard shapes, so Tine lets you give one starting note, the chord's <b>root</b>, and the name of a shape after <code>@</code>. The shape is called the chord's <b>quality</b>, and it is a list of semitone offsets from the root:</p>
<table class="ref"><tr><td>@maj</td><td>major</td><td>0 4 7, bright and settled</td></tr><tr><td>@m</td><td>minor</td><td>0 3 7, darker</td></tr><tr><td>@7</td><td>seventh</td><td>0 4 7 10, restless, wants to move on</td></tr><tr><td>@maj7</td><td>major seventh</td><td>0 4 7 11, soft and lush</td></tr><tr><td>@m7</td><td>minor seventh</td><td>0 3 7 10, mellow</td></tr><tr><td>@sus4</td><td>suspended fourth</td><td>0 5 7, open and unresolved</td></tr></table>
<p>A chord is named by its root and its quality: <code>a3@m7</code> is an A minor seventh. A three-note chord is a <b>triad</b>, and the four-note ones here are <b>seventh chords</b>.</p>`,
      { code: `print(a3@m7)\nvoice chords = <c4@maj a3@m f3@maj g3@maj>`, bars: 4 },
      `<p>The same progression as before, written by root and quality. Change <code>a3@m</code> to <code>a3@m7</code>: one more note, a richer sound.</p>`,
      { code: `key c major\nvoice chords = <^2@7 ^5@7 ^1@7 ^6@7>.strum`, bars: 4 },
      `<p>None of those chords names a quality. On a scale degree, <code>@</code> followed by a number builds the chord out of the scale: start at that degree and take every other note. <code>^5@3</code> is three of them (degrees 5, 7 and 9, a triad). <code>^5@7</code> is four (5, 7, 9 and 11, a seventh chord) and <code>@9</code> is five. The number is how many scale steps the top note sits above the root, counting the root as 1. Because the notes come from the key, each chord gets the quality that fits: in C major <code>^1@3</code> comes out major and <code>^2@3</code> minor. Chords built this way are called <b>diatonic</b>. Change the key to <code>a minor</code> and all four chords follow. The number form works only on degrees. On a note name, <code>@7</code> is the fixed quality from the table, so <code>g3@7</code> is always 0 4 7 10.</p>`,
      `<p><code>.strum</code> rolls a chord from low to high, the way a hand crosses guitar strings. Two more ways to play one:</p>`,
      { code: `key a minor\nvoice arp   = <^1@9 ^6@7>.arp("updown").fast(2)\nvoice turns = <c3@maj c3@maj.invert c3@maj.invert(2)>`, bars: 3 },
      `<p><code>.arp</code> plays a chord's notes one after another across its length (an <b>arpeggio</b>). Change <code>"updown"</code> to <code>"down"</code> and each chord falls where it used to rise and fall. <code>.invert</code> moves the chord's lowest note up an octave: the same letters in a new order, called an <b>inversion</b>. The <code>turns</code> voice plays C major three ways, one per bar, and each sounds a little higher without changing chord.</p>`,
      { exercise: {
        task: "Make <code>voice harmony</code> play a D minor seventh chord with its root on <code>d3</code>, for the whole bar.",
        starter: "voice harmony = d3", solution: "voice harmony = d3@m7",
        hint: "A root, then <code>@</code>, then the quality from the table. A voice does not need brackets: one value fills the bar.",
        alsoRight: ["voice harmony = {d3 f3 a3 c4}", "voice harmony = [d3@m7]", "key c major\nvoice harmony = (^2@7).octave(-1)"],
        wrong: ["voice harmony = d3@m", "voice harmony = d3@7", "voice harmony = d4@m7", "voice harmony = d3@maj7", "voice harmony = [d3@m7 .]", "voice harmony = d3@m7.strum", "voice harmony = d3@m7.arp", "voice harmony = [d3 f3 a3 c4]"],
        check: (_s, n) => {
          const all = firstBar(n, "harmony");
          if (!all.length) return "There is no voice named harmony yet.";
          const t = all.filter(x => x.bar < EPS);
          const got = t.map(x => x.semi).sort((x, y) => x - y);
          const heard = t.slice().sort((x, y) => x.semi - y.semi);
          if (same(got, [50, 53, 57, 60])) return t.every(x => x.bars > 1 - EPS) && all.length === 4 ? null : "Right chord. Now let it last the whole bar: one chord, nothing else.";
          const set = [...new Set(all.map(x => Math.round(x.semi)))].sort((x, y) => x - y);
          if (t.length < 4 && same(set, [50, 53, 57, 60])) return "Right four notes, but they do not start together. Drop .strum or .arp, and use braces, not brackets.";
          if (same(got, [50])) return "I hear only the root, d3. Add @ and a quality to build a chord on it.";
          if (same(got, [50, 53, 57])) return "That is a D minor triad (d3 f3 a3). A seventh chord has a fourth note.";
          if (same(got, [50, 54, 57, 60])) return "That is D7: its second note is f#3. A minor seventh chord has f3 there.";
          if (same(got, [50, 54, 57, 61])) return "That is D major seventh. The quality for a minor seventh is m7.";
          if (same(got, [62, 65, 69, 72])) return "Right chord, one octave too high. The root should be d3.";
          return `I hear ${names(heard)}. D minor seventh on d3 is d3 f3 a3 c4.`;
        },
      } },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: "chance", title: "8. Chance, seeds and replay",
    parts: [
      `<p>Press ▶ twice, then press <b>🎲 new seed</b> (next to the lesson list) and play again.</p>`,
      { code: `voice tune = [c|e|g a|b|. c5 e|d]`, bars: 4 },
      `<p><code>x|y|z</code> picks one of its options each time the phrase comes around, so the bars are not all the same. But the two plays were identical. Randomness in Tine is always <b>seeded</b>: each run has a seed, shown under the example, and the same seed always produces exactly the same music. A new seed gives a new tune.</p>`,
      { code: `voice drums = {[kick . . kick?0.3 . . snare kick?] [hat*16].degrade(.3)}`, bars: 4 },
      `<p><code>x?</code> plays x half the time, and <code>x?0.3</code> three times in ten. <code>degrade(amount)</code> drops that fraction of a whole pattern's notes. Raise <code>.degrade(.3)</code> to <code>.degrade(.8)</code> and only a few hats survive, in different places each bar.</p>`,
      { code: `key d dorian\nvoice wander = walk(0..9, 8).degrees\nvoice bells  = [^5 . ^8 ^9].sometimes(x => x.octave(1))`, bars: 4 },
      `<p><code>walk(list, n)</code> wanders through a list, n steps per bar, each step at most one place from the last, and starts somewhere new each bar. It returns numbers, and <code>.degrees</code> turns numbers into scale degrees counting from 0, so 0 is <code>^1</code>. The line wanders but never leaves the key. <code>sometimes(f)</code> applies a function to each note half the time, which is why some bells jump an octave. Change <code>walk(0..9, 8)</code> to <code>walk(0..9, 16)</code> and the line moves twice as fast. The Reference has more chance functions.</p>`,
      `<p>To keep a result you like, write its seed at the top of the file: <code>seed 1234</code>. Every random choice is also keyed to its voice and its bar, so editing one voice never changes the dice of another.</p>`,
      { exercise: {
        task: "Write <code>voice hats</code>: eight hat steps per bar, where each step plays about half the time. It should come out different from bar to bar.",
        starter: "voice hats = [hat*8]", solution: "voice hats = [hat*8].degrade(.5)", bars: 16,
        hint: "Two ways were shown above: a mark on each step, or one call on the whole pattern.",
        alsoRight: ["voice hats = [hat? hat? hat? hat? hat? hat? hat? hat?]", "voice hats = [hat*8].degrade", "voice hats = [hat*8].degrade(.4)"],
        wrong: ["voice hats = [hat?!8]", "voice hats = [hat? hat? hat? hat?]", "voice hats = [hat*8].degrade(50)", "voice hats = [hat . hat . hat . hat .]", "voice hats = [hat*8].degrade(.95)", "voice hats = [hat*16].degrade(.5)", "voice hats = [hat*8].degrade(.05)"],
        check: (_s, n) => {
          const t = voiceNotes(n, "hats");
          if (!t.length) return "No hats play at all. Check that the voice is named hats and that any amount you gave is between 0 and 1.";
          if (t.some(x => x.semi !== HAT)) return "Some of those are not hats.";
          if (t.some(x => Math.abs(x.bar * 8 - Math.round(x.bar * 8)) > 0.001)) return "Some hats fall between the eight steps. Keep eight equal steps per bar.";
          const perBar = Array.from({ length: 16 }, (_, b) => t.filter(x => Math.floor(x.bar + EPS) === b).map(x => round(x.bar - b)).join(","));
          if (new Set(perBar).size === 1) return t.length === 128 ? "Every hat plays every time. Give each one a chance to drop out." : "Every bar is the same. Chance should make the bars differ.";
          if (!t.some(x => Math.round(x.bar * 8) % 2 === 1)) return "Hats only land on four places in the bar. The task asks for eight steps.";
          if (perBar.every(b => b === "" || b.split(",").length === 8)) return "Each bar is all eight hats or none. Every step needs its own coin: write hat? eight times, or use degrade.";
          const share = t.length / 128;
          if (share < 0.25) return `Only ${Math.round(share * 100)}% of the hats play over 16 bars. Aim for about half.`;
          if (share > 0.75) return `${Math.round(share * 100)}% of the hats play over 16 bars. Aim for about half.`;
          return null;
        },
      } },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: "time", title: "9. Change over time",
    parts: [
      { code: `voice bass = [c2 <eb2 f2 g2> . <c2 bb1>]`, bars: 4 },
      `<p>A loop that never changes gets dull. Lesson 7 used <code>&lt;x y z&gt;</code> to play one chord per bar. It can sit anywhere in a phrase, and each one keeps its own count: the second step here cycles through three notes while the last step alternates between two, so the bar only repeats exactly every six bars. Change <code>&lt;c2 bb1&gt;</code> to <code>&lt;c2 bb1 g1&gt;</code>. Both steps now cycle in threes, so the bar repeats every three bars.</p>`,
      { code: `let up = [c e g e]\nlet turn = [d f g f]\nvoice tune = arrange(up, 2, turn, 1, up.rev, 1)`, bars: 4 },
      `<p><code>arrange</code> plays whole patterns for a number of bars each: two bars of <code>up</code>, one of <code>turn</code>, one of <code>up</code> reversed, then round again. Change the first <code>2</code> to <code>3</code> and the cycle becomes five bars long.</p>`,
      { code: `voice climb = per_bar(n => [c e g].transpose(n % 4 * 2).fast(1 + n % 3))`, bars: 4 },
      `<p>For anything else, <code>per_bar</code> hands you the bar number, counting from 0, and you compute that bar with ordinary logic. Each bar here is two semitones higher than the last, for four bars, while the speed cycles through 1, 2 and 3 times per bar. Change <code>n % 4</code> to <code>n % 2</code> and the climb starts over every second bar.</p>`,
      { code: `let next(p, bar) = p + pick([-2 -1 1 2])\nlet show(p, bar) = [p (p + 7) (p + 12) (p + 7)]\nvoice drift = evolve(c4, next, show)`, bars: 4 },
      `<p>Each bar here is built from the bar <em>before</em> it. <code>evolve(start, step, play)</code> keeps a value from bar to bar. Its second argument turns this bar's value into the next bar's, and its third turns a value into music. Both are also handed the bar number, which this example ignores, so both need two parameters. <code>pick(list)</code> returns one item at random.</p>`,
      `<p>The value here is a pitch. Each bar it moves up or down by one or two semitones, and <code>show</code> builds the same four-note shape on wherever it has got to. It still replays exactly: Tine works the chain out from the start, so bar 9 is the same every time you play it. Change <code>[-2 -1 1 2]</code> to <code>[1 2]</code> and the line can only climb.</p>`,
      { exercise: {
        task: "Write <code>voice bass</code> in quarter notes. Beats 1, 2 and 3 are <code>c2</code> in every bar. Beat 4 is <code>eb2</code> in the first bar, <code>f2</code> in the second and <code>g2</code> in the third.",
        starter: "voice bass = [c2 c2 c2 eb2]", solution: "voice bass = [c2 c2 c2 <eb2 f2 g2>]", bars: 3,
        hint: "Angle brackets can replace a single step.",
        alsoRight: ["voice bass = [c2!3 <eb2 f2 g2>]", "voice bass = cat([c2 c2 c2 eb2], [c2 c2 c2 f2], [c2 c2 c2 g2])", "voice bass = per_bar(n => [c2 c2 c2 at([eb2 f2 g2], n % 3)])"],
        wrong: ["voice bass = [c2*3 <eb2 f2 g2>]", "voice bass = [c2 c2 c2 eb2|f2|g2]", "voice bass = [c2 c2 c2 <eb2 f2>]", "voice bass = [c2 c2 c2 <g2 f2 eb2>]", "voice bass = <[c2 c2 c2 eb2] [c2 c2 f2 f2] [c2 c2 c2 g2]>"],
        check: (_s, n, src) => {
          const t = voiceNotes(n, "bass");
          if (!t.length) return "There is no voice named bass yet.";
          const want = [39, 41, 43];
          if (src !== undefined && /\|/.test(src)) return "A random choice will not give the same three bars every time. Use angle brackets.";
          for (let b = 0; b < 3; b++) {
            const bar = t.filter(x => Math.floor(x.bar + EPS) === b);
            const starts = bar.map(x => round(x.bar - b));
            if (!same(starts, [0, 0.25, 0.5, 0.75])) return bar.length === 4 ? `Bar ${b + 1} has four notes, but not one per beat: they start at ${bar.map(x => place(x.bar, 4)).join(", ")}. x*3 squeezes three notes into one step; x!3 makes three steps.` : `Bar ${b + 1} should have four quarter notes; I hear ${bar.length} note${bar.length === 1 ? "" : "s"} (${names(bar)}).`;
            if (!same(bar.slice(0, 3).map(x => x.semi), [36, 36, 36])) return `Beats 1 to 3 of bar ${b + 1} should all be c2; I hear ${names(bar.slice(0, 3))}.`;
            if (Math.abs(bar[3].semi - want[b]) > 0.001) return `Beat 4 of bar ${b + 1} is ${noteName(bar[3].semi)}; it should be ${noteName(want[b])}.`;
          }
          return null;
        },
      } },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: "sound", title: "10. Instruments and expression",
    parts: [
      { code: `voice tune = [c e g c5].inst(pluck)` },
      `<p>Until now every voice has used the default instrument, an electric piano called <code>keys</code>. <code>.inst(name)</code> picks another. Try each of these in place of <code>pluck</code>: <code>bell</code>, <code>organ</code>, <code>lead</code>, <code>pad</code> (slow and soft, made for chords), <code>bass</code>, and four plain tones named after the shape of their wave, <code>sine</code>, <code>tri</code>, <code>saw</code> and <code>square</code>, which run from pure to buzzy. Drum names use the <code>kit</code> instrument without being asked.</p>`,
      `<p>The rest of this lesson shapes individual notes. Lesson 5 set velocity with one number. Give it a phrase and you get <b>accents</b>, notes that stand out from their neighbours.</p>`,
      { code: `voice hats = [hat*8].vel([1 .4]*4)\nvoice bass = [c2 c2 c2 c2].inst(bass).vel([1 .5 .7 .5])` },
      `<p>A phrase used as a setting is stretched over the bar like any phrase, and each note reads whichever value is current when it starts. So <code>[1 .4]*4</code> is eight values, one for each hat: loud, soft, loud, soft. Change it to plain <code>[1 .4]</code> and you get four loud hats, then four soft ones.</p>`,
      { code: `voice pad  = <c4@m7 f3@maj7>.inst(pad).attack(.5).release(1)\nvoice stab = [c5 . . eb5 . . g5 .].inst(pluck).legato(.3).pan([-1 1])`, bars: 2 },
      `<p>The pad swells in over half a second. The plucks are clipped short and jump from the left speaker to the right. Those are more per-note settings:</p><ul><li><code>legato(x)</code>: how much of its step a note sounds for. 1 fills the step, 0.3 is short and clipped.</li><li><code>pan(x)</code>: left to right, from -1 to 1.</li><li>A note's volume over its life is its <b>envelope</b>. <code>attack(sec)</code> is how long it takes to fade in, <code>decay(sec)</code> how long it then takes to settle, <code>sustain(x)</code> the level it settles at, from 0 to 1, and <code>release(sec)</code> how long it takes to fade out after the note ends.</li></ul><p>Set <code>.attack(.01)</code> and the chords start abruptly.</p>`,
      { code: `voice tune = [e4~ f4~ g4 c5].inst(lead)` },
      `<p>The first three notes run together as one sound. Only the e4 is attacked. The f4 and g4 follow it without starting again. A <code>~</code> written straight after a note does that: it joins the note to the next one. In a score this is a <b>slur</b>, a curved line over the notes, and it means play them smoothly, in one breath or one bow. Delete both <code>~</code> and every note starts again. <code>.slur</code> joins every note of a phrase, up to its last note in the bar, so <code>[e4 f4 g4 c5].slur</code> joins all four.</p>`,
      { code: `voice swoop = [c4 g4].gliss.inst(lead)` },
      `<p>The c4 does not stop and restart at g4. Its pitch climbs to g4 across its whole half bar. That is a <b>glissando</b>, a slide from one note to the next, drawn in a score as a straight line between them. <code>.gliss</code> slides each note into the next, up to the last note in the bar, so here only the c4 moves. Write <code>.gliss(.25)</code> instead and the c4 holds still, then slides in the last quarter of its length.</p>`,
      { code: `voice acid = ([c2 c2 c3 c2 eb2 c2 g2 bb1]*2)\n  .inst(saw)\n  .cutoff(sine(2).range(300, 3000))\n  .res(.6)\n  .vel([1 .6 .8 .6])`, bars: 2 },
      `<p>That sound opens up over one bar and closes over the next. Two more settings shape the tone itself. Every sound is a mix of vibrations at many speeds at once. Those speeds are its <b>frequencies</b>, counted in hertz (Hz), cycles per second: <code>c4</code> vibrates about 262 times a second. A saw is bright and buzzy because it has a lot of high frequencies mixed in. A <b>filter</b> removes the frequencies above its <code>cutoff</code>, given in Hz, so a low cutoff sounds dark and muffled and a high one sounds bright. <code>res</code> (resonance, 0 to 1) boosts the frequencies right at the cutoff, which gives the filter a nasal, whistling edge.</p>`,
      `<p>The cutoff here is not a number but a <b>signal</b>, a continuous function of time. <code>sine(2)</code> is a sine wave that takes two bars to go round once, and <code>.range(300, 3000)</code> scales it to run between 300 and 3000 Hz. The number is the length of one cycle in bars. Change <code>sine(2)</code> to <code>sine(1/2)</code> and the sound opens and closes twice in every bar. The other signals are <code>tri</code>, <code>saw</code>, <code>square</code>, <code>noise</code> and <code>drift</code> (smooth, seeded wandering).</p>`,
      `<p>Four of those names are also instruments. Which one you get depends on where it is used: <code>.inst(saw)</code> is the instrument, <code>saw(2)</code> the signal.</p>`,
      { exercise: {
        task: "Give this line the <code>bass</code> instrument and accent the first note of the bar: velocity 1 on the first note and 0.5 on the other three.",
        starter: "voice line = [c2 c2 eb2 g2]", solution: "voice line = [c2 c2 eb2 g2].inst(bass).vel([1 .5 .5 .5])",
        hint: "Two calls chained on the phrase. The velocity phrase needs one value per note.",
        alsoRight: ["voice line = [c2 c2 eb2 g2].vel([1 .5!3]).inst(bass)", "voice line = [c2 c2 eb2 g2]\n  .inst(bass)\n  .vel([1:1 .5:3])"],
        wrong: ["voice line = [c2 c2 eb2 g2].inst(bass)", "voice line = [c2 c2 eb2 g2].vel([1 .5 .5 .5])", "voice line = [c2 c2 eb2 g2].inst(bass).vel([1 .5])", "voice line = [c2 c2 eb2 g2].inst(pluck).vel([1 .5 .5 .5])"],
        check: (_s, n) => {
          const t = firstBar(n, "line");
          if (!t.length) return "There is no voice named line yet.";
          if (!same(t.map(x => x.semi), [36, 36, 39, 43])) return `Keep the notes as they were (c2 c2 eb2 g2); I hear ${names(t)}.`;
          const inst = String(t[0].params.inst ?? "keys");
          if (t.some(x => String(x.params.inst ?? "keys") !== "bass")) return `The line is playing on ${inst}. Add .inst(bass).`;
          const v = t.map(x => round(x.vel));
          if (same(v, [1, 0.5, 0.5, 0.5])) return null;
          return `The four velocities are ${v.join(" ")}; they should be 1 0.5 0.5 0.5. A velocity phrase is stretched over the bar, so it needs one value per note.`;
        },
      } },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: "fx", title: "11. Effects and the synth",
    parts: [
      { code: `voice fuzz = [c2 . c2 eb2 . g1 bb1 .].inst(saw).drive(.7).lpf(1800)\nvoice ping = [g4 . . bb4 . . . .].inst(pluck).delay(.5, feedback: .55)`, bars: 2 },
      `<p>The settings in lesson 10 shape each note. An <b>effect</b> processes the whole voice after its notes are mixed together. Three are at work here:</p><ul><li><code>.drive(x)</code> overloads the sound so it turns rough and fuzzy (<b>distortion</b>), from 0 (clean) to 1 (crushed). Set it to 0 to hear the saw without it.</li><li><code>.lpf(hz)</code> is a low-pass filter on the whole voice: it removes what is above that frequency. <code>.hpf(hz)</code> is the opposite and removes what is below.</li><li><code>.delay(mix, time: 3/16, feedback: .4)</code> repeats the voice's sound. <code>mix</code> is how loud the repeats are against the original, from 0 (none) to 1. <code>time</code> is the gap between repeats in bars, so it stays in rhythm at any tempo, and <code>feedback</code> is how much of each repeat goes round again. Raise it to .8 and the repeats pile up.</li></ul>`,
      `<p>Lesson 4's <code>late</code> moved notes, which you could see in the piano roll. <code>delay</code> repeats the sound itself, so it adds no notes to the drawing.</p>`,
      { code: `voice thump = [kick . . . kick . . .]\nvoice pad   = <c3@m7 eb3@maj7>.inst(pad).chorus(.6).room(.5, size: .8).duck("thump")\nvoice acid  = ([c2 c2 c3 c2 eb2 c2 g2 bb1]*2).inst(saw).vowel(["a" "o"])`, bars: 2 },
      `<p>Effects that add space and movement:</p><ul><li><code>.room(mix, size: .5)</code> is <b>reverb</b>: the wash of reflections that makes a sound seem to be in a hall. This one belongs to the voice. <code>.reverb(x)</code> sends the voice to one hall shared by every voice.</li><li><code>.chorus()</code> layers copies at very slightly different pitches, which thickens a sound.</li><li><code>.vowel("a")</code> filters the voice so it seems to say a vowel: a for the first half of each bar here, o for the second. Change <code>["a" "o"]</code> to <code>"i"</code> and it holds one vowel.</li><li><code>.duck("thump")</code> turns this voice down each time the voice named <code>thump</code> plays, then lets it recover. That is the pumping sound of dance music. Delete it and the pad stays level.</li></ul>`,
      `<p>Also in the Reference: <code>.phaser()</code> for a slow sweep, <code>.crush(bits)</code> and <code>.coarse(n)</code> for a rough, low-resolution sound, <code>.ring(hz)</code> for metallic tones, and <code>.compress()</code> to even out loud and quiet.</p>`,
      { code: `voice acid = [a1 a1 a2 a1 c2 a1 g2 a1].inst(tb303).fenv([4 2 3 1]).glide([0 0 .06 0])\nvoice wub  = [a0 _ _ _ c1 _ _ _].inst(wobble).wobble([2 4], depth: 4)`, bars: 2 },
      `<p>The instruments in lesson 10 are fixed sounds. A <b>synthesizer</b> builds a sound from a plain wave and a filter, and Tine's general one is the instrument <code>synth</code>. Ten more names are ready-made settings of it: <code>tb303</code>, <code>supersaw</code>, <code>reese</code>, <code>wobble</code>, <code>fm</code>, <code>chip</code>, <code>brass</code>, <code>strings</code>, <code>marimba</code> and <code>noise</code>. Swap <code>tb303</code> for <code>supersaw</code> or <code>chip</code> and the same notes sound like a different instrument.</p>`,
      `<p>Three calls shape it here. <code>.fenv(octaves)</code> is a filter envelope: on every note the cutoff jumps up by that many octaves and falls back, the squelch of the TB-303 bass machine this preset imitates. <code>.glide(sec)</code> slides into a note from the one before. Its phrase has four values spread over eight notes, so the slide applies to the fifth and sixth. <code>.wobble(rate)</code> opens and closes the filter at that many times per bar: 2 under the first note, so it swings once in its half bar, and 4 under the second, so it swings twice. <code>.wave</code>, <code>.vibrato</code>, <code>.pw</code>, <code>.unison</code> and <code>.sub</code> are in the Reference.</p>`,
      `<p>Put a <code>~</code> after the fourth note, <code>a1~</code>, and the c2 after it no longer starts again. It slides out of the a1 as one sound, with no second squelch. Lesson 10 called that joining a slur. With a glide it is what a 303 player calls a slide.</p>`,
      { exercise: {
        task: "Add two effects to this voice: a delay with a mix of 0.5, and a low-pass filter at 2000 Hz.",
        starter: "voice ping = [g4 . . bb4 . . . .].inst(pluck)", solution: "voice ping = [g4 . . bb4 . . . .].inst(pluck).delay(.5).lpf(2000)",
        hint: "Two more calls on the chain. The order does not matter: Tine always runs effects in the same order.",
        alsoRight: ["voice ping = [g4 . . bb4 . . . .].inst(pluck).lpf(2000).delay(.5, time: 1/8, feedback: .6)", "voice ping = [g4 . . bb4 . . . .].inst(pluck)\n  .delay(1/2)\n  .lpf(2000)", "voice ping = [g4 . . bb4 . . . .].inst(pluck).delay(mix: .5).lpf(2000)"],
        wrong: ["voice ping = [g4 . . bb4 . . . .].inst(pluck).delay(.5)", "voice ping = [g4 . . bb4 . . . .].inst(pluck).lpf(2000)", "voice ping = [g4 . . bb4 . . . .].inst(pluck).delay(.5).cutoff(2000)", "voice ping = [g4 . . bb4 . . . .].inst(pluck).delay(.2).lpf(2000)", "voice ping = [g4 . . bb4 . . . .].inst(pluck).delay(.5).hpf(2000)"],
        check: (_s, n, src) => {
          const t = firstBar(n, "ping");
          if (!t.length) return "There is no voice named ping yet.";
          const p = t[0].params;
          if (p.delay === undefined) return src !== undefined && /\.echo\(/.test(src) ? "echo copies notes. The effect that repeats the sound is called delay." : "There is no delay on the voice yet.";
          if (Math.abs(num(p.delay) - 0.5) > 0.001) return `The delay mix is ${round(num(p.delay))}; it should be 0.5. The mix is the first argument.`;
          if (p.lpf === undefined) return p.cutoff !== undefined ? "cutoff filters each note inside the instrument. The effect that filters the whole voice is lpf." : p.hpf !== undefined ? "hpf removes what is below the frequency. A low-pass filter is lpf." : "The delay is there. Now add the low-pass filter.";
          if (Math.abs(num(p.lpf) - 2000) > 0.5) return `The low-pass filter is at ${round(num(p.lpf))} Hz; it should be at 2000.`;
          return null;
        },
      } },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: "samples", title: "12. Samples",
    parts: [
      { code: `voice beat = ["bd_haus" . "sn_dolf" "bd_haus" . "bd_haus" "sn_dolf" .]\nvoice hats = ["hat" "hat:3" "hat:5" "hat:3"]*2`, bars: 2 },
      `<p>A <b>sample</b> is a recording, played back as a note. Tine comes with about 200, all public domain. Write a sample's name in quotes inside a phrase and it plays as recorded. The part of a name before the underscore is its <b>bank</b>, a family of similar sounds: <code>"bd_haus"</code> is in the <code>bd</code> (bass drum) bank. <code>"hat:3"</code> is sound number 3 in the <code>hat</code> bank, counting from 0, and a bank name alone plays its first sound. (That bank has nothing to do with the drum name <code>hat</code> from lesson 3.) Change <code>"sn_dolf"</code> to <code>"sn:2"</code> to try another snare.</p>`,
      `<p><code>.sample()</code> sends ordinary drum names or notes through samples.</p>`,
      { code: `voice kit  = [kick hat snare hat kick kick snare hat].sample()\nvoice bass = [c4 . eb4 g4].sample("bass_voxy_c").cut(1)` },
      `<p>With no argument, drum names play a recorded kit in place of the built-in one. With a name, the notes play that recording faster or slower to change its pitch: <code>c4</code> plays it exactly as recorded, and <code>c5</code> twice as fast and an octave up. This recording is a low note, so the line sounds like a bass although it is written in octave 4. A sample plays to its end however short its step is, so <code>.cut(1)</code> makes each note stop the one before.</p>`,
      `<p>Longer samples are loops, such as a bar or two of a drummer. Left alone, a loop plays at the speed it was recorded. These two calls make it follow your tempo:</p>`,
      { code: `tempo 140\nvoice amen = ["loop_amen"].loopAt(1).chop(8)` },
      `<p><code>.loopAt(1)</code> stretches or squeezes the loop to last exactly one bar. <code>.chop(8)</code> cuts it into eight pieces, each of which starts on time. Change the tempo to 100 and the drummer slows down with you, and sounds lower, because changing a recording's speed changes its pitch. The pieces are now notes like any others, so pattern functions work on them: add <code>.rev</code> to the end and the eight pieces play in reverse order.</p>`,
      { code: `tempo 140\nvoice amen = ["loop_amen"].loopAt(1).chop(8).every(2, x => x.rev)\nvoice back = ["loop_amen"].loopAt(1).chop(8).speed(-1).gain(.4)`, bars: 4 },
      `<p>The first voice reverses the order of its pieces every second bar. The second plays each piece backwards underneath, and <code>.gain(.4)</code> turns its volume down. <code>.speed(x)</code> sets playback rate: 2 is twice as fast and an octave up, and a negative speed plays backwards. More controls, all in the Reference: <code>.begin</code> and <code>.end</code> play part of a sound, <code>.slice(n, i)</code> plays piece i of n, and <code>.cut(group)</code> makes each sound stop the one before it.</p>`,
      `<p>Two ways to bring your own sounds. Drop audio files on Tine's full editor, the DAW (lesson 17), and they become samples named by file name. For recorded pianos, strings and the like, load a <b>SoundFont</b>, a single file holding a whole set of instruments, with a <code>soundfont("GeneralUser-GS.sf2")</code> line. Then <code>.gm(1)</code> to <code>.gm(128)</code> picks an instrument by its standard number, or <code>.gm("violin")</code> by name.</p>`,
      { exercise: {
        task: "Write <code>voice beat</code> as four evenly spaced sounds in the bar: the sample <code>\"bd_haus\"</code> first and third, and <code>\"sn_dolf\"</code> second and fourth.",
        starter: `voice beat = ["bd_haus"]`, solution: `voice beat = ["bd_haus" "sn_dolf" "bd_haus" "sn_dolf"]`,
        hint: "Sample names go in a phrase like notes do, each in its own quotes.",
        alsoRight: [`voice beat = ["bd_haus" . "sn_dolf" . "bd_haus" . "sn_dolf" .]`, `voice beat = ["bd_haus" "sn_dolf"]*2`, `voice beat = ["bd_haus" "sn_dolf"].fast(2)`],
        wrong: [`voice beat = ["bd_haus" "bd_haus" "sn_dolf" "sn_dolf"]`, `voice beat = ["bd_haus" "sn_dolf"]`, `voice beat = [kick snare kick snare]`, `voice beat = [kick snare kick snare].sample()`, `voice beat = ["bd_haus" "sn_dolf" "bd_haus" "sn_dolf" . . . .]`, `voice beat = ["sn_dolf" "bd_haus" "sn_dolf" "bd_haus"]`],
        check: (_s, n) => {
          const t = firstBar(n, "beat");
          if (!t.length) return "There is no voice named beat yet.";
          const got = t.map(x => String(x.params.inst ?? "").replace(/^sample:/, ""));
          if (t.some(x => !String(x.params.inst ?? "").startsWith("sample:"))) return "Some of those are not samples. A sample is a name in quotes.";
          if (t.some(x => x.params.drum)) return "Those are drum names sent through .sample(). The task asks for the sample names themselves, in quotes.";
          if (!same(t.map(x => round(x.bar)), [0, 0.25, 0.5, 0.75])) return t.length === 4 ? `The four sounds start at ${t.map(x => place(x.bar, 4)).join(", ")}. They should be evenly spaced: one on each quarter of the bar.` : `I hear ${t.length} sound${t.length === 1 ? "" : "s"} (${got.join(" ")}). There should be four.`;
          const want = ["bd_haus", "sn_dolf", "bd_haus", "sn_dolf"];
          const bad = got.findIndex((g, i) => g !== want[i]);
          return bad < 0 ? null : `Step ${bad + 1} plays ${got[bad]}; it should play ${want[bad]}.`;
        },
      } },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: "rhythm2", title: "13. Rhythmic depth",
    parts: [
      { code: `voice drums = {kick.euclid(3, 8) rim.euclid(5, 8, rot: 2) [hat*8]}` },
      `<p><code>euclid(hits, steps)</code> spreads a number of hits as evenly as it can over a number of steps. Three over eight cannot be perfectly even, so you get gaps of 3, 3 and 2 steps. That lopsided pattern is the <b>tresillo</b>, the rhythm under a great deal of Latin and pop music, and many other traditional rhythms fall out of the same function. <code>rot:</code> rotates the pattern to start on a different step. Change <code>kick.euclid(3, 8)</code> to <code>kick.euclid(5, 16)</code>: five kicks over sixteen steps, with gaps of 4, 3, 3, 3 and 3.</p>`,
      `<p>So far every phrase has fitted its bar. This one does not.</p>`,
      { code: `voice four  = [kick . . .]\nvoice three = [c5 e5 g5].poly(8).inst(pluck)`, bars: 3 },
      `<p><code>poly(8)</code> steps through the phrase at eight steps per bar, however long the phrase is. Three notes do not divide into eight, so the phrase starts on a different note each bar and only lines up with the kick again after three bars. Two cycles of different lengths running against each other are called <b>polymeter</b>. Change <code>poly(8)</code> to <code>poly(6)</code>. Six is a multiple of three, so the phrase fits twice into every bar and starts on <code>c5</code> each time.</p>`,
      `<p>A bar does not have to hold four beats.</p>`,
      { code: `meter 3/4\ntempo 150\nvoice drums = [kick hat hat]\nvoice bass  = [c2 _ g2].inst(bass)` },
      `<p>The <code>meter</code> line sets the bar. The first number is how many beats are in it. The second is which note length counts as the beat: 4 for a quarter note, 8 for an eighth. So <code>meter 3/4</code> is three quarter-note beats per bar, the one-two-three of a waltz. Tempo counts whatever the beat is, per minute.</p>`,
      { code: `meter 7/8\ntempo 240\nvoice odd  = [kick . hat kick . snare hat]\nvoice deep = [c5 [e5 [g5 a5 b5 c6 d6] e5] .].inst(bell)` },
      `<p>Seven eighth-note beats per bar, at 240 of them a minute. The kicks and the snare split the seven into 3 + 2 + 2, which is how a bar with an odd number of beats is usually felt: as groups of two and three. The second voice shows that nesting goes as deep as you like: a quintuplet inside a triplet.</p>`,
      { exercise: {
        task: "Write <code>voice claps</code>: five claps spread as evenly as possible over eight steps.",
        starter: "voice claps = [clap]", solution: "voice claps = clap.euclid(5, 8)",
        hint: "A drum name can be the first argument of <code>euclid</code>, as <code>kick</code> is in the first example.",
        alsoRight: ["voice claps = euclid(clap, 5, 8)", "voice claps = clap.euclid(5, 8, rot: 1)", "voice claps = [clap . clap . clap clap . clap]"],
        wrong: ["voice claps = [clap clap . clap . clap . clap]", "voice claps = clap.euclid(8, 5)", "voice claps = clap.euclid(3, 8)", "voice claps = [clap clap clap clap clap . . .]", "voice claps = clap.euclid(5, 16)", "voice claps = kick.euclid(5, 8)", "voice claps = [clap*5]"],
        check: (_s, n) => {
          const t = firstBar(n, "claps");
          if (!t.length) return "There is no voice named claps yet.";
          if (t.some(x => x.semi !== CLAP)) return "Some of those are not claps.";
          if (t.length === 5 && t.every(x => Math.abs(x.bar * 5 - Math.round(x.bar * 5)) < 0.001)) return "That is five equal steps. Five hits have to be spread over eight steps: euclid(5, 8).";
          if (t.some(x => Math.abs(x.bar * 8 - Math.round(x.bar * 8)) > 0.001)) return "Some claps fall between the eight steps.";
          if (t.length !== 5) return `I hear ${t.length} clap${t.length === 1 ? "" : "s"} in the bar; there should be 5.`;
          const on = t.map(x => Math.round(x.bar * 8));
          const gaps = on.map((p, i) => ((on[(i + 1) % 5] - p + 8) % 8) || 8);
          const even = gaps.every(g => g <= 2) && gaps.every((g, i) => !(g === 1 && gaps[(i + 1) % 5] === 1));
          return even ? null : "Five claps, but not as even as they can be. The gaps should be 2, 1, 2, 1, 2 steps, starting anywhere.";
        },
      } },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: "micro", title: "14. Beyond twelve notes",
    parts: [
      { code: `voice micro = [c4 (c4 + 50c) c#4 (c4 + 5\\31) (c4 * 7/4) 432hz]` },
      `<p>The second note is not on any piano: it sits halfway between <code>c4</code> and <code>c#4</code>. A pitch is a number (lesson 1), and nothing says the number must be whole. There are four ways to write the notes between the keys:</p><ul><li><b>Cents.</b> A cent is a hundredth of a semitone, written with a <code>c</code> after a number. <code>c4 + 50c</code> is pitch 60.5.</li><li><b>Equal divisions.</b> A piano divides the octave into 12 equal steps. <code>5\\31</code> is 5 steps of an octave divided into 31.</li><li><b>Frequency ratios.</b> <code>c4 * 7/4</code> multiplies the frequency by 7/4.</li><li><b>Frequencies.</b> <code>432hz</code>.</li></ul><p>Change <code>50c</code> to <code>25c</code> and the second note moves closer to <code>c4</code>.</p>`,
      `<p>Two notes sound smoothest together when their frequencies make a simple ratio such as 3/2 or 5/4. The piano's twelve equal steps only come close to those ratios, a compromise that lets it play in every key. A <b>tuning</b> is a choice of exact pitches for the notes, and other tunings make other trades.</p>`,
      { code: `key d just([1 9/8 5/4 4/3 3/2 5/3 15/8])\nvoice pure = <^1@3 ^4@3 ^5@3 ^1@3>.inst(organ)`, bars: 4 },
      `<p><code>just(ratios)</code> builds a scale from exact ratios, which is called <b>just intonation</b>. Change the key line to <code>key d major</code> and listen to the held chords again: a little rougher, with a faint wobble inside them. That is the piano's compromise.</p>`,
      { code: `key c edo(31, [0 5 10 13 18 23 28])\nvoice tune   = [^1 ^3 ^5 ^8 ^5 ^3]\nvoice chords = <^1@3 ^4@3 ^5@3 ^1@3>.octave(-1).inst(pad)`, bars: 4 },
      `<p><code>edo(n, steps)</code> picks a scale out of an octave divided into n equal steps. This one takes seven of 31 and comes out close to a major scale whose chords are nearer to the pure ratios. Change <code>31</code> to <code>12</code> and the steps to <code>[0 2 4 5 7 9 11]</code>: the piano's major scale again. Also available: <code>cents(list)</code>, <code>scala(text)</code> for the standard Scala .scl format, and scales such as <code>bohlen_pierce</code> that do not repeat at the octave at all.</p>`,
      { exercise: {
        task: "Write <code>voice between</code> with two steps: <code>c4</code>, then the note exactly halfway between <code>c4</code> and <code>c#4</code>.",
        starter: "voice between = [c4 c#4]", solution: "voice between = [c4 (c4 + 50c)]",
        hint: "A semitone is 100 cents. An expression inside a phrase needs parentheses. Two pitches cannot be added to each other: add a distance to one pitch.",
        alsoRight: ["voice between = [c4 60.5]", "voice between = [c4 (c#4 - 50c)]", "voice between = [c4 (c4 + 1\\24)]"],
        wrong: ["voice between = [c4 c#4]", "voice between = [c4 (c4 + 50)]", "voice between = [c4 (c4 + 25c)]", "voice between = [(c4 + 50c) c4]", "voice between = [c4 50c]"],
        check: (_s, n) => {
          const t = firstBar(n, "between");
          if (!t.length) return "There is no voice named between yet.";
          if (t.length !== 2) return `I hear ${t.length} note${t.length === 1 ? "" : "s"}; there should be 2.`;
          if (Math.abs(t[0].semi - 60) > 0.001) return `The first note is ${noteName(t[0].semi)}; it should be c4.`;
          if (Math.abs(t[1].semi - 0.5) < 0.001) return "50c on its own is a distance, not a note. Add it to c4: (c4 + 50c).";
          const d = t[1].semi - 60;
          if (Math.abs(d - 0.5) < 0.001) return null;
          if (Math.abs(d - 1) < 0.001) return "The second note is c#4 itself. Halfway there is 50 cents above c4.";
          if (Math.abs(d - 50) < 0.001) return "That added 50 semitones. Cents are written with a c after the number: 50c.";
          return `The second note is ${round(d * 100)} cents above c4; it should be 50.`;
        },
      } },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: "form", title: "15. Composing whole pieces",
    parts: [
      { code: `tempo 104\nkey a minor\n\nvoice drums = {[kick . snare .] [hat*8]}\n\nsection verse 4\n  voice bass = [^1 . ^1 ^5].octave(-2).inst(bass)\n\nsection chorus 4\n  tempo 112\n  voice bass = [^4 ^4 ^5 ^5].octave(-2).inst(bass)\n  voice lift = <^4@7 ^5@7>.inst(pad)\n\nform verse chorus verse`, bars: 12 },
      `<p>This piece has a beginning and an end (this page starts it over when it finishes). Top-level voices loop forever, which suits playing live. For a finished piece, group voices into <b>sections</b>, each an indented block with a length in bars, and list the order to play them on a <b>form</b> line. It is twelve bars: four of verse, four of chorus, four of verse. The names are yours. Verse and chorus are the usual words for a song's main part and the part it keeps returning to.</p>`,
      `<p>Voices outside any section play throughout, as the drums do here. A section can set its own tempo and key, as the chorus does with its tempo. At the start of each section every pattern starts from its beginning, so every verse opens the same way, though random choices still differ between repeats. Change the form line to <code>form verse*2 chorus verse</code>: <code>*2</code> plays a section twice, and the piece grows to sixteen bars.</p>`,
      `<p>Section names follow the rule from lesson 1: <code>a</code>, <code>b</code> or <code>b2</code> are notes, so they cannot name a section.</p>`,
      `<p>From the command line, <code>tine render piece.tine</code> writes an audio file (WAV), <code>tine midi piece.tine</code> a file of notes that other music software can open (MIDI, lesson 17), and <code>tine pack piece.tine</code> a single HTML file that plays the piece anywhere.</p>`,
      `<p>A long piece can be split across files. The line <code>use "drums.tine" as drums</code> runs that file in its own space. Its names read as <code>drums.groove</code>, and its voices and sections join the piece as <code>drums.kick</code> and <code>drums.verse</code>, so a form line can list <code>drums.verse</code>. The used file's own tempo, key and form are skipped, so it still plays on its own. This page has no files, so try it with <code>tine play</code>.</p>`,
      { exercise: {
        task: "Finish this piece. Add a second section that contains at least one voice, and make the form play at least three sections in total, using both.",
        starter: "tempo 100\nkey d minor\n\nvoice drums = {[kick . snare .] [hat*8]}\n\nsection verse 2\n  voice bass = [^1 . ^1 ^5].octave(-2).inst(bass)\n\nform verse",
        solution: "tempo 100\nkey d minor\n\nvoice drums = {[kick . snare .] [hat*8]}\n\nsection verse 2\n  voice bass = [^1 . ^1 ^5].octave(-2).inst(bass)\n\nsection chorus 2\n  voice bass = [^4 ^4 ^5 ^5].octave(-2).inst(bass)\n  voice pad = <^4@7 ^5@7>.inst(pad)\n\nform verse chorus verse",
        hint: "Copy the shape of the example above: <code>section name bars</code>, an indented voice, and both names on the form line.",
        alsoRight: ["section x 1\n  voice p = [c e]\nsection y 1\n  voice q = [g e]\nform x*2 y"],
        wrong: ["section verse 2\n  voice bass = [c2]\nform verse verse verse", "section verse 2\n  voice bass = [c2]\nsection chorus 2\n  voice bass = [f2]\nform verse chorus", "section verse 2\n  voice bass = [c2]\nsection chorus 2\n  voice bass = [f2]\nform verse*3", "voice drums = [kick]\nsection verse 2\n  voice bass = [c2]\nsection chorus 2\n  tempo 90\nform verse chorus verse"],
        check: (s) => {
          if (!s.form || !s.form.length) return "There is no form line, so nothing says what order to play the sections in.";
          if (s.sections.size < 2) return `There is ${s.sections.size} section; the piece needs at least 2.`;
          const used = new Set(s.form.map(f => f.name));
          const missing = [...used].find(name => !s.sections.has(name));
          if (missing) return `The form names "${missing}", but there is no section called that.`;
          if (used.size < 2) return "The form only ever plays one section. Use at least two different ones.";
          const total = s.form.reduce((t, f) => t + f.times, 0);
          if (total < 3) return `The form plays ${total} section${total === 1 ? "" : "s"} in total; make it at least 3.`;
          const empty = [...used].find(name => !(s.sections.get(name) as any)?.voices?.size);
          return empty ? `The section "${empty}" has no voice of its own.` : null;
        },
      } },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: "paper", title: "16. Sheet music and chord charts",
    parts: [
      { code: `tempo 100\nkey c major\n\nvoice keys = changes("Cmaj7 | A7 | Dm7 G7 | Cmaj7").inst(keys)\nvoice tune = [e5 . g5 _ a5 g5 e5 .].inst(pluck)`, bars: 4, sheet: "chart" },
      `<p>Under the code is a <b>chord chart</b>: the piece drawn as a grid of bars, four to a line, with the name of the chord that sounds in each bar (chord names are lesson 7). Bar 3 holds two chords, so it is split, Dm7 for its first half and G7 for its second. Change <code>A7</code> to <code>Am7</code> and play: the chart changes with the code. Musicians read charts like this to play along with a song they have not heard, which is what most jazz and pop players are handed at a gig.</p>`,
      `<p>Tine finds the chords itself. It trusts voices whose notes came from chord names, like <code>changes</code>, <code>c@maj7</code> or <code>^2@7</code>, so the melody's notes never rename a chord. Without those, any voice that plays three or more notes at once is read, and named the simplest way that fits. Spreading a chord out with <code>arp</code> or <code>strum</code> (lesson 7) keeps its name.</p>`,
      { code: `tempo 100\nkey c major\n\nvoice keys = changes("Cmaj7 | A7 | Dm7 G7 | Cmaj7").inst(keys)\nvoice tune = [e5 . g5 _ a5 g5 e5 .].inst(pluck)`, bars: 4, sheet: "lead" },
      `<p>The same piece as a <b>lead sheet</b>: the melody written in standard notation with the chord names above it. Tine picks the voice that sounds most like a melody, one note at a time and high up. Here that is <code>tune</code>. The five horizontal lines are the <b>staff</b>. Each line and each gap between lines is one step of the scale, higher on the page is higher in pitch, and the curl at the start (the <b>treble clef</b>) fixes the bottom line as e4. A note's shape gives its length in the words of lesson 2. A filled head with a stem is a quarter note, a filled head joined to its neighbours by a thick bar (a <b>beam</b>) is an eighth note, a hollow head is a half note, and the zigzags and small hooks are rests of the same lengths. Change <code>g5 _</code> to <code>g5 g5</code> and the quarter note becomes two eighths.</p>`,
      { code: `tempo 96\nkey a minor\n\nvoice drums = {[kick . snare .] [hat*8]}\nvoice bass  = [a2 . a2 e2 . . g2 .].inst(bass)\nvoice keys  = <a3@m7 d3@m7>.inst(keys)`, bars: 2, sheet: "score" },
      `<p>A <b>score</b> gives every voice its own staff, bar for bar, which is what a band reads from. Low voices get the <b>bass clef</b> (the curl with two dots), which shifts the lines down so the bass does not need a ladder of extra lines. Drums get a percussion staff: each line is a drum rather than a pitch, and cymbals such as the hi-hat are drawn as crosses. The <code>key a minor</code> line shows up as the key signature, the sharps or flats just after the clef. A minor has none.</p>`,
      `<p>From the command line, <code>tine chart piece.tine</code>, <code>tine lead piece.tine</code> and <code>tine score piece.tine</code> each write a page you can open in a browser, print or save as a PDF. A section that plays several times is printed once, with repeat signs or a "Form" line giving the order. <code>--jazz</code> writes chord names the way jazz charts do, C–7 for Cm7 and CΔ7 for Cmaj7. In the DAW, the <b>Sheet</b> tab shows all three for whatever you last evaluated.</p>`,
      { exercise: {
        task: "Write the code whose chord chart reads, one bar each: <b>Fmaj7 | Bb7 | Gm7 C7 | Fmaj7</b>. The third bar holds two chords, half a bar each. Any voice and any way of naming the chords counts.",
        starter: `voice keys = changes("Fmaj7 | Bb7 | Gm7 | C7").inst(keys)`,
        solution: `voice keys = changes("Fmaj7 | Bb7 | Gm7 C7 | Fmaj7").inst(keys)`,
        bars: 4, sheet: "chart",
        hint: "In <code>changes</code>, a <code>|</code> ends a bar, and chords written in the same bar share it equally.",
        alsoRight: ["voice k = <f3@maj7 bb3@7 [g3@m7 c4@7] f3@maj7>", "key f major\nvoice k = changes(\"Fmaj7 | Bb7 | Gm7 C7 | Fmaj7\").strum"],
        wrong: [`voice keys = changes("Fmaj7 | Bb7 | Gm7 | C7")`, `voice keys = changes("Fmaj7 | Bbmaj7 | Gm7 C7 | Fmaj7")`, `voice keys = changes("Fmaj7 | Bb7 | C7 Gm7 | Fmaj7")`, `voice keys = changes("Fmaj7 Bb7 | Gm7 C7")`],
        check: (s) => {
          const want = ["Fmaj7", "Bb7", "Gm7 C7", "Fmaj7"];
          let got: string[];
          try {
            got = buildChart(s, "", { bars: 4 }).sections.flatMap(x => x.bars).map(b => b.nc ? "N.C." : b.chords.map(c => { const t = chordText(c, true); return (t.root + t.quality + (t.bass ? "/" + t.bass : "")).replace(/♭/g, "b").replace(/♯/g, "#"); }).join(" "));
          } catch (e) { return (e as Error).message; }
          for (let i = 0; i < 4; i++) {
            const g = got[i] || "nothing";
            if (g !== want[i]) return `Bar ${i + 1} of the chart reads ${g}; it should read ${want[i]}.`;
          }
          return null;
        },
      } },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: "live", title: "17. Performing live",
    parts: [
      { code: `voice drums = {[kick . snare .] [hat*8]}\nvoice lead  = [e5 . g5 a5].inst(pluck)  -- change a note while this plays` },
      `<p>Press play. While it runs, change <code>g5</code> to <code>b5</code> and press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Enter</kbd>. The new line takes over at the next bar line and the drums never stumble. (A line or the end of a line starting <code>--</code> is a comment.) Changing a program while it plays is <b>live coding</b>, and the rest of this lesson is about the program built for it.</p>`,
      `<p>Run <code>tine daw mypiece.tine</code>. The <b>DAW</b> (digital audio workstation, the usual name for a music-making program) opens in your browser with a larger editor and panels that list your voices, launch sections, connect MIDI gear and keep a history. It plays the file and reloads whenever the file changes, so you can work in its editor or in your own.</p>`,
      `<p>What it adds to what you just did:</p><ul><li>If an edit has an error, the broken voice keeps its last good version and everything else carries on.</li><li>Write <code>active voice</code> in place of <code>voice</code> and that voice plays every edit as soon as it is valid, mid-bar, with no evaluating.</li><li>Name a block of lines with <code>-- @fill</code> above it and <code>-- @end</code> below. Bind it to a key under <b>Tracks → toggles</b> and you can switch those lines on and off as you play.</li><li>Sections (lesson 15) become scenes you can launch one at a time.</li><li>Every evaluation is saved with its seed under <b>Takes</b>, and <b>★ keep take</b> writes that seed into your code, so nothing you heard is lost.</li></ul>`,
      `<p>The rest needs hardware. <b>MIDI</b> is the standard that lets instruments, controllers and computers send each other notes and knob movements. It has 16 channels, so one cable can address 16 devices, and each knob movement is a numbered <b>control change</b>, or CC. Connect gear in the DAW's MIDI tab, then:</p><ul><li><code>.midi(2)</code> sends a voice out on channel 2 to a synthesizer or another program.</li><li><code>cc(74)</code> reads the knob that sends CC number 74 as a signal from 0 to 1: <code>.cutoff(cc(74).range(200, 4000))</code>.</li><li><code>held(8)</code> is whatever chord you are holding on a connected keyboard, checked eight times a bar, so <code>held(8).arp</code> arpeggiates it.</li><li><b>● capture</b> records what you play for a few bars and writes it into your code as a new voice.</li><li><code>.ctl(74, sine(4))</code> sweeps CC 74 on the receiving synthesizer up and down over four bars, and <code>.program(5)</code> changes its sound.</li><li>Send MIDI clock, a shared tempo pulse, and drum machines follow your tempo. Follow MIDI clock and you follow theirs.</li></ul>`,
      `<p>This one needs a keyboard, so it is here to read, not to play:</p><pre class="static">key c minor\nvoice hands = held(8).arp("updown").inst(pluck)\nvoice drums = {[kick . snare .] [hat*8]}</pre>`,
      { exercise: {
        task: "Get this ready for the stage. Make <code>lead</code> an active voice, and send <code>bass</code> out on MIDI channel 2. On this page the bass then goes silent, because it is being sent to a MIDI device, and <code>active</code> only changes behaviour in the DAW.",
        starter: "voice lead = [e5 . g5 a5]\nvoice bass = [a1 . a1 c2]", solution: "active voice lead = [e5 . g5 a5]\nvoice bass = [a1 . a1 c2].midi(2)",
        hint: "One word in front of the first line, one call on the end of the second.",
        alsoRight: ["active voice lead = [e5 . g5 a5]\nactive voice bass = [a1 . a1 c2].inst(bass).midi(2)"],
        wrong: ["voice lead = [e5 . g5 a5]\nvoice bass = [a1 . a1 c2].midi(2)", "active voice lead = [e5 . g5 a5]\nvoice bass = [a1 . a1 c2]", "active voice lead = [e5 . g5 a5].midi(2)\nvoice bass = [a1 . a1 c2]", "active voice lead = [e5 . g5 a5]\nvoice bass = [a1 . a1 c2].midi(1)"],
        check: (s, n, src) => {
          const miss = noVoice(n, "lead") ?? noVoice(n, "bass");
          if (miss) return miss;
          const active = (s.voices.get("lead") as any)?.active ?? (src !== undefined ? /(^|\n)\s*active\s+voice\s+lead\b/.test(src) : false);
          if (!active) return "lead is still an ordinary voice. Put the word active in front of it.";
          const ch = voiceNotes(n, "bass")[0].params.midi;
          if (ch === undefined) return "bass is not being sent to MIDI yet.";
          return num(ch) === 2 ? null : `bass is going out on channel ${num(ch)}; it should be channel 2.`;
        },
      } },
      `<p>That is the whole language. The <a href="#reference">Reference</a> lists every function, and <code>tine theory</code> opens a separate course that teaches music theory itself, from the keyboard up, using Tine.</p>`,
    ],
  },
];
