// Unit 4, Theory 202: jazz harmony in depth, and a first step past tonality.
import type { Unit } from "./types";
import { of, inBar, groups, need, expectChords, barChords, nms, nm, pc, pcset, line } from "./check";

const subset = (semis: number[], pcs: number[]) => { const s = new Set(pcs.map(x => ((x % 12) + 12) % 12)); return semis.every(x => s.has(pc(x))); };
const has = (semis: number[], pcs: number[]) => { const s = new Set(pcset(semis)); return pcs.every(p => s.has(((p % 12) + 12) % 12)); };
const rel = (root: number, offs: number[]) => offs.map(o => root + o);

export const UNIT4: Unit = {
  id: "u4", code: "Theory 202", title: "Jazz harmony and beyond",
  blurb: "Tensions and avoid notes, chord-scale theory from the major and melodic minor modes, piano voicings, the bebop vocabulary, modal jazz, Coltrane changes, reharmonization, and post-tonal basics.",
  lessons: [
    // ------------------------------------------------------------------
    {
      id: "tensions", title: "Extensions and tensions",
      parts: [
        `<p>Cmaj7, then the same chord with one note added on top, twice. Listen to how each added note sits.</p>`,
        { code: `-- Cmaj7, then Cmaj7 with F on top, then with F# on top.\n-- Change f4 in bar 2 to d4 (the 9th): no clash at all.\nvoice comp = <{c3 e3 b3} {c3 e3 b3 d4 f4} {c3 e3 b3 d4 f#4}>.inst(keys)`, bars: 3 },
        `<p>Keep stacking thirds above a seventh chord and you reach the <b>9th</b>, <b>11th</b> and <b>13th</b>, the 2nd, 4th and 6th an octave up. Jazz calls them <b>extensions</b> or <b>tensions</b>. The seventh chord sets the function; the tensions are its color. F is the 11th of Cmaj7, and it rubs against E, the third, a half step below it. F# is the #11, and it shimmers.</p>
         <p>The rule of thumb: a tension a <b>half step above a chord tone</b> (a minor 9th above it, counting octaves) clashes. Such a note is an <b>avoid note</b>, fine in passing but not held in the chord.</p>
         <table class="t"><tr><th>chord</th><th>available tensions</th><th>avoid</th></tr>
         <tr><td>maj7</td><td>9, #11, 13</td><td>11 (a half step above the 3rd)</td></tr>
         <tr><td>m7</td><td>9, 11, and 13 when it is ii (dorian)</td><td>b9 on iii, b13 on iii and vi</td></tr>
         <tr><td>7 (natural)</td><td>9, 13, #11</td><td>11 (unless the chord is sus)</td></tr>
         <tr><td>7 (altered)</td><td>b9, #9, #11, b13</td><td></td></tr>
         <tr><td>m7b5</td><td>11, b13, 9 (from melodic minor)</td><td>b9</td></tr>
         <tr><td>dim7</td><td>a whole step above each chord tone</td><td></td></tr></table>`,
        { code: `-- G13 to C, then G7alt to C.\n-- Change g3@7alt to g3@7b9: one altered tension instead of three, a milder pull.\ntempo 90\nvoice comp = <g3@13 c3@maj9 g3@7alt c3@maj9>.voicelead\nvoice bass = <g1 c2 g1 c2>.inst(upright)`, bars: 4 },
        `<p>Dominant chords take the widest range of tensions, because their job is tension. Natural 9 and 13 sound sweet and bluesy. Altered tensions (b9, #9, b13) sound urgent and dark, and they lead by half step into the notes of the tonic: Ab to G, Eb to E.</p>`,
        { code: `-- G13 as four notes: root and 7th low, 3rd and 13th high. Then Cmaj9 without its 5th.\n-- Change e4 to d4: that is plain G7 (root, 7, 3, 5), and the color is gone.\nvoice g13 = <{g2 f3 b3 e4} {c3 e3 b3 d4}>.inst(keys)`, bars: 2 },
        `<p>Pianists don't play every note of a 13th chord. That shape is common: the root and seventh in the left hand, the third and the tension in the right. The 5th, 9th and 11th are the least necessary notes, and the ear fills them in. (Tine's <code>name</code> cannot name it, because a chord symbol assumes more notes than this.)</p>`,
        { code: `-- Partly done: root, 7th and 3rd of C7. Add the 13th (A) on top, a4, to make C13.\nvoice comp = {c3 bb3 e4}.inst(keys)` },
        { exercise: {
          task: `<p>Write <code>voice comp</code>: a <b>G13</b> voicing that contains the root, 3rd, 7th and 13th (G, B, F, E) and does <b>not</b> contain the avoid note C.</p>`,
          starter: `voice comp = g3@11`,
          solution: `voice comp = {g2 f3 b3 e4}`,
          check: (_s, n) => {
            const m = need(n, "comp"); if (m) return m;
            const g = groups(of(n, "comp"))[0];
            const miss = [[7, "G"], [11, "B"], [5, "F"], [4, "E"]].filter(([p]) => !has(g.semis, [p as number])).map(([, s]) => s);
            if (miss.length) return `Your chord (${nms(g.semis)}) is missing ${miss.join(" and ")}.`;
            if (has(g.semis, [0])) return "It still has C, the 11th, a half step above the 3rd.";
            return null;
          },
        } },
        { quiz: [
          { q: "Listen. Cmaj7 first, then with a note on top. Is the top note the 11 or the #11?", listen: `voice x = <{c3 e3 b3} {c3 e3 b3 d4 f#4}>.inst(keys)`, bars: 2, options: ["11", "#11"], answer: 1, explain: "Bright, no clash with the third." },
          { q: "Listen. G7 with tensions, resolving to C. Natural or altered?", listen: `voice x = <g3@7alt c3@maj9>.voicelead\nvoice b = <g1 c2>.inst(upright)`, bars: 2, options: ["Natural (9, 13)", "Altered (b9, #9, b13)"], answer: 1, explain: "Dark and urgent: Ab, Bb and Eb all slide by half step into C major." },
          { q: "Which note is the avoid note on Cmaj7?", options: ["D", "F", "A", "F#"], answer: 1, explain: "F is a half step above E, the third." },
          { q: "Which tensions are altered on a dominant chord?", options: ["9 and 13", "b9, #9, #11, b13", "11 and 13", "6 and 9"], answer: 1 },
          { q: "From the minor ii-V lesson: G7b9 in C minor gets its b9 from which note of the key?", options: ["The flat sixth, Ab", "The flat third, Eb", "The leading tone, B", "The flat seventh, Bb"], answer: 0 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "modes", title: "Chord-scales: the modes of major",
      parts: [
        `<p>Seven scales, all starting on D. Each bar changes one note from the bar before. Listen to the scale get darker.</p>`,
        { code: `-- Brightest to darkest, one per bar.\n-- Change d4 to a4 and hear the same ladder from A.\nlet ladder = [lydian ionian mixolydian dorian aeolian phrygian locrian]\nvoice m = per_bar(bar => [^1 ^2 ^3 ^4 ^5 ^6 ^7 ^8].key(d4, at(ladder, bar))).inst(vibes)\nvoice drone = d2.inst(pad).vel(.3)`, bars: 7 },
        `<p>Those are the seven <b>modes</b> of the major scale, each one the major scale started on a different note. Played on one root they form a ladder from bright to dark: <b>lydian, ionian, mixolydian, dorian, aeolian, phrygian, locrian</b>, each lowering one note. Each mode matches one diatonic seventh chord. That is <b>chord-scale theory</b>: for each chord, a scale holding its chord tones and its available tensions.</p>
         <table class="t"><tr><th>mode</th><th>from</th><th>chord</th><th>signature note</th></tr>
         <tr><td>ionian</td><td>^1</td><td>Imaj7</td><td>4 (an avoid note)</td></tr>
         <tr><td>dorian</td><td>^2</td><td>ii7</td><td>natural 6</td></tr>
         <tr><td>phrygian</td><td>^3</td><td>iii7, sus(b9)</td><td>b2</td></tr>
         <tr><td>lydian</td><td>^4</td><td>IVmaj7, maj7#11</td><td>#4</td></tr>
         <tr><td>mixolydian</td><td>^5</td><td>V7</td><td>b7</td></tr>
         <tr><td>aeolian</td><td>^6</td><td>vi7</td><td>b6</td></tr>
         <tr><td>locrian</td><td>^7</td><td>viiø7</td><td>b2 and b5</td></tr></table>
         <p>Tine also builds a mode by number: <code>mode(major, 2)</code> is dorian.</p>`,
        { code: `-- A line through Dm7 G7 Cmaj7: D dorian, G mixolydian, C lydian.\n-- Change the third bar's lydian to major and listen: the line uses no F or F#, so nothing changes. The scale matters only where the notes differ.\ntempo 140\nlet tune = changes("Dm7 | G7 | Cmaj7 | %")\nvoice comp = tune.rootless.voicelead.vel(.5)\nvoice bass = tune.root.octave(-1).inst(upright)\nvoice line = <[^1 ^2 ^3 ^5 ^6 ^5 ^3 ^1].key(d4, dorian) [^3 ^4 ^5 ^7 ^9 ^7 ^5 ^4].key(g3, mixolydian) [^3 ^5 ^7 ^9 ^7 ^5 ^3 ^2].key(c4, lydian) [^1 _ _ _ . . . .].key(c4, major)>.swing.inst(vibes)`, bars: 4 },
        `<p>Over a ii-V-I the modes line up: D dorian, G mixolydian, C ionian (or lydian). With ionian, all three are the C major scale, which is why beginners are told "just play C major". The modes matter for which notes land on strong beats, and for the one note that changes, like the F# of lydian.</p>`,
        { code: `-- A D dorian vamp. The B natural is the dorian color.\n-- Change key d dorian to key d aeolian: B becomes Bb, and the vamp turns plain minor.\ntempo 120\nkey d dorian\nvoice pad  = d3@m9.inst(pad).vel(.4)\nvoice bass = [^1 _ _ ^5 . ^1 _ .].octave(-2).inst(upright)\nvoice line = [^5 ^6 ^5 ^3 ^4 ^6 ^8 ^6].swing.inst(vibes)` },
        `<p>A <b>modal vamp</b> sits on one chord for a long time, and the mode's signature note carries its flavor. On a dorian vamp, lean on the natural 6th. On lydian, the #4. Without them it sounds like plain minor or plain major.</p>`,
        { code: `-- Partly done: a G mixolydian line with two gaps.\n-- Fill them with f5 (the b7, mixolydian's color) and b4.\nvoice pad  = g3@7.inst(pad).vel(.4)\nvoice line = [g4 a4 b4 d5 . d5 . g4].swing.inst(vibes)` },
        { exercise: {
          task: `<p>Over a <b>Dm7</b> vamp, write <code>voice line</code>: eight notes, all from <b>D dorian</b>, and include the dorian signature note (B natural) at least once.</p>`,
          starter: `voice pad = d3@m7.inst(pad)\nvoice line = [d5 c5 a4 f4 e4 d4 c4 d4]`,
          solution: `voice pad = d3@m7.inst(pad)\nvoice line = [d5 c5 b4 a4 f4 e4 d4 b3]`,
          check: (_s, n) => {
            const m = need(n, "line"); if (m) return m;
            const l = groups(inBar(of(n, "line"), 0)).map(g => g.semis[0]);
            if (l.length !== 8) return `That is ${l.length} notes; write 8.`;
            const dor = [2, 4, 5, 7, 9, 11, 0];
            const bad = l.find(x => !subset([x], dor));
            if (bad !== undefined) return `${nm(bad)} is not in D dorian.`;
            return l.some(x => pc(x) === 11) ? null : "Every note is in the mode, but there is no B natural, the note that makes it dorian rather than aeolian.";
          },
        } },
        { quiz: [
          { q: "Listen. An F chord, then a scale on F. Lydian or ionian?", listen: `voice p = f3@maj7.inst(pad).vel(.4)\nvoice x = <. [^1 ^2 ^3 ^4 ^5 ^6 ^7 ^8].key(f4, lydian)>.inst(vibes)`, bars: 2, options: ["Ionian", "Lydian"], answer: 1, explain: "The fourth note, B, is a half step higher than F major's Bb." },
          { q: "Listen. A D minor vamp. Dorian or aeolian?", listen: `key d aeolian\nvoice pad = d3@m7.inst(pad).vel(.4)\nvoice line = [^5 ^6 ^5 ^3 ^4 ^6 ^8 ^6].swing.inst(vibes)`, bars: 2, options: ["Dorian", "Aeolian"], answer: 1, explain: "The sixth is Bb, the darker one." },
          { q: "Which mode matches a V7 chord?", options: ["Ionian", "Dorian", "Mixolydian", "Lydian"], answer: 2 },
          { q: "What is <code>mode(major, 6)</code>?", options: ["Dorian", "Lydian", "Aeolian", "Locrian"], answer: 2 },
          { q: "From the minor-key lesson: aeolian is another name for which scale?", options: ["Harmonic minor", "Natural minor", "Melodic minor", "The blues scale"], answer: 1 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "melodicminor", title: "Chord-scales: melodic minor and symmetric scales",
      parts: [
        `<p>A dominant chord full of altered tensions, with a line that matches it, resolving to C.</p>`,
        { code: `-- G7alt, a descending G altered scale, then C.\n-- Change altered to mixolydian: the line goes sweet and loses its pull.\ntempo 120\nvoice comp = <g3@7alt c3@maj9>.rootless.voicelead.vel(.5)\nvoice bass = <g1 c2>.inst(upright)\nvoice line = <[^8 ^7 ^6 ^5 ^4 ^3 ^2 ^1].key(g4, altered) [^3 _ _ _ . . . .].key(c4, major)>.swing.inst(vibes)`, bars: 2 },
        `<p>That is the <b>altered scale</b>: G Ab Bb B Db Eb F, or root, b9, #9, 3, #11, b13, b7. Every tension is altered, and each one is a half step from a note of C major, so the resolution is strong. It is the seventh mode of <b>jazz melodic minor</b> (a major scale with a flat third), here Ab melodic minor. Melodic minor has seven modes, and they cover the chords the major modes can't.</p>
         <table class="t"><tr><th>mode</th><th>Tine name</th><th>chord</th></tr>
         <tr><td>1 melodic minor</td><td><code>melodic_minor</code></td><td>mmaj7, m6 (the minor tonic)</td></tr>
         <tr><td>2 dorian b2</td><td><code>dorian_b2</code></td><td>7sus(b9)</td></tr>
         <tr><td>3 lydian augmented</td><td><code>lydian_augmented</code></td><td>maj7#5</td></tr>
         <tr><td>4 lydian dominant</td><td><code>lydian_dominant</code></td><td>7#11: subV7, IV7 in the blues, bVII7</td></tr>
         <tr><td>5 mixolydian b6</td><td><code>mixolydian_b6</code></td><td>7b13</td></tr>
         <tr><td>6 locrian natural 2</td><td><code>locrian_nat2</code></td><td>m7b5 (iiø7)</td></tr>
         <tr><td>7 altered</td><td><code>altered</code></td><td>7alt: b9, #9, #11, b13</td></tr></table>`,
        { code: `-- Dm9, Db7#11 (the tritone sub), Cmaj9, with a Db lydian dominant line in bar 2.\n-- Change lydian_dominant to mixolydian: the G in the line becomes Gb, and the link to the original G7 is lost.\ntempo 120\nvoice comp = <d3@m9 db3@7#11 c3@maj9 .>.rootless.voicelead.vel(.5)\nvoice bass = <d2 db2 c2 .>.inst(upright)\nvoice line = <[^1 ^3 ^5 ^7 ^9 ^7 ^5 ^3].key(d4, dorian) [^8 ^7 ^6 ^5 ^4 ^3 ^2 ^1].key(db4, lydian_dominant) [^3 _ _ _ . . . .].key(c4, major) [.]>.swing.inst(vibes)`, bars: 4 },
        `<p><b>Lydian dominant</b> is mixolydian with a raised 4th, the natural scale for a tritone substitute. Over Db7, its raised 4th is G, the root of the chord it replaces.</p>`,
        { code: `-- A whole-tone scale over C7#5.\n-- Change whole_tone to half_whole and c3@7#5 to c3@7b9: the other symmetric dominant sound.\nvoice whole = [^1 ^2 ^3 ^4 ^5 ^6 ^7 .].key(c4, whole_tone).inst(vibes)\nvoice comp  = c3@7#5.vel(.4)` },
        `<p>The <b>whole-tone</b> scale has six notes, all whole steps apart, so it sounds the same from any of its notes. It fits 7#5 and 9#5 chords, and only two different ones exist. With the two diminished scales from the diminished lesson, it makes three <b>symmetric scales</b>:</p>
         <ul><li><b>Whole tone</b> for 7#5 and 9#5. Two exist.</li>
         <li><b>Half-whole diminished</b> for 7b9 chords with a natural 13. Three exist.</li>
         <li><b>Whole-half diminished</b> for diminished seventh chords.</li></ul>`,
        { code: `-- Partly done: a G altered line with two gaps. Fill them with ab4 (b9) and bb4 (#9).\nvoice comp = g3@7alt.vel(.4)\nvoice line = [g4 . . b4 c#5 eb5 f5 g5].inst(vibes)` },
        { exercise: {
          task: `<p>Over <b>G7alt</b>, write <code>voice line</code>: eight notes using only the <b>G altered scale</b>, and include both the <b>b9</b> (Ab) and the <b>#9</b> (Bb).</p>`,
          starter: `voice comp = g3@7alt.vel(.4)\nvoice line = [g4 a4 b4 c5 d5 e5 f5 g5]`,
          solution: `voice comp = g3@7alt.vel(.4)\nvoice line = [^1 ^2 ^3 ^4 ^5 ^6 ^7 ^8].key(g4, altered)`,
          check: (_s, n) => {
            const m = need(n, "line"); if (m) return m;
            const l = groups(inBar(of(n, "line"), 0)).map(g => g.semis[0]);
            if (l.length !== 8) return `That is ${l.length} notes; write 8.`;
            const alt = [7, 8, 10, 11, 1, 3, 5];
            const bad = l.find(x => !subset([x], alt));
            if (bad !== undefined) return `${nm(bad)} is not in G altered (G Ab Bb B Db Eb F).`;
            if (!l.some(x => pc(x) === 8)) return "Include the b9, Ab.";
            if (!l.some(x => pc(x) === 10)) return "Include the #9, Bb.";
            return null;
          },
        } },
        { quiz: [
          { q: "Listen. C7#5 sounds, then a scale on C. Whole tone or altered?", listen: `voice p = c3@7#5.vel(.4)\nvoice x = <. [^1 ^2 ^3 ^4 ^5 ^6 ^7 .].key(c4, whole_tone)>.inst(vibes)`, bars: 2, options: ["Whole tone", "Altered"], answer: 0, explain: "Six equal steps: no half steps anywhere." },
          { q: "The G altered scale is a mode of which melodic minor scale?", options: ["G", "Ab", "C", "Db"], answer: 1, explain: "Its seventh mode." },
          { q: "Which scale fits a tritone substitute like Db7#11?", options: ["Altered", "Lydian dominant", "Dorian", "Whole-half"], answer: 1 },
          { q: "Which scale fits C7#5?", options: ["Whole tone", "Mixolydian", "Dorian b2", "Major"], answer: 0 },
          { q: "From the tensions lesson: which tensions does a 7alt chord carry?", options: ["9 and 13", "b9, #9, #11, b13", "11 only", "#11 only"], answer: 1 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "voicings", title: "Piano voicings",
      parts: [
        `<p>A <b>voicing</b> is a choice of which chord notes to play, in what order, in what register. The chord symbol says Dm9; the voicing says how it sounds. Jazz pianists carry a handful of systems, and Tine has a function for each.</p>
         <ul><li><b>Shell</b> (<code>shell</code>): root, 3rd, 7th. The bebop left hand, also the guitarist's "Freddie Green" comp.</li>
         <li><b>Rootless</b> (<code>rootless</code>): 3, 5, 7, 9 or 7, 9, 3, 5, the 13th in place of the 5th on dominants. The default sound of a modern trio.</li>
         <li><b>Drop 2</b> (<code>drop2</code>): a four-note close voicing with the second voice from the top dropped an octave. Wider, with a clear top melody. Guitarists and big-band arrangers live on it. <code>drop3</code> and <code>drop24</code> are its cousins.</li>
         <li><b>Guide tones</b> (<code>guide</code>): 3rd and 7th only.</li></ul>`,
        { code: `tempo 120\nlet tune = changes("Dm7 | G7 | Cmaj7 | %")\nlet sounds = arrange(tune.shell, 4, tune.rootless.voicelead, 4, tune.voicelead.drop2, 4, tune.guide.voicelead(around: g4), 4)\nvoice comp = sounds\nvoice bass = tune.root.octave(-1).inst(upright)`, bars: 16 },
        `<p><b>Quartal voicings</b> stack fourths instead of thirds. They are open and ambiguous, a modal sound, associated with McCoy Tyner and Herbie Hancock. The best-known is three perfect fourths topped by a major third: E A D G B. On its own it spells E minor seventh with an added 11th. In a D dorian tune it sits over a D bass and colors D minor without ever stating the third. You will meet quartal harmony again in lesson 32.</p>`,
        { code: `print(name({e3 a3 d4 g4 b4}))\nvoice q = {e3 a3 d4 g4 b4}.inst(keys)\nvoice bass = d2.inst(upright)` },
        `<p>An <b>upper-structure triad</b> puts a plain major or minor triad on top of a dominant's guide tones. Because the triad is simple, the ear hears it clearly, and its notes become the tensions. Over C7 (C, E, Bb):</p>
         <table class="t"><tr><th>triad on top</th><th>tensions</th><th>symbol</th></tr>
         <tr><td>D major (II)</td><td>9, #11, 13</td><td>C13#11</td></tr>
         <tr><td>A major (VI)</td><td>13, b9, 3</td><td>C13b9</td></tr>
         <tr><td>Ab major (bVI)</td><td>b13, root, #9</td><td>C7#9b13</td></tr>
         <tr><td>F# major (bV)</td><td>#11, b7, b9</td><td>C7b9#11</td></tr></table>`,
        { code: `-- C7 shell in the left hand, a triad above: D, A, Ab, F#\nvoice lh = <{c3 e3 bb3} {c3 e3 bb3} {c3 e3 bb3} {c3 e3 bb3}>.inst(keys)\nvoice rh = <d4@maj a4@maj ab4@maj f#4@maj>.inst(keys)\nprint(name({c3 e3 bb3 d4 f#4 a4}))`, bars: 4 },
        { exercise: {
          task: `<p>Write <code>voice comp</code>: the <b>upper structure II</b> over C7. That is a C7 shell (C, E, Bb) with a <b>D major triad</b> on top, six notes in all.</p>`,
          starter: `voice comp = c3@7`,
          solution: `voice comp = {c3 e3 bb3 d4 f#4 a4}`,
          check: (_s, n) => {
            const m = need(n, "comp"); if (m) return m;
            const g = groups(of(n, "comp"))[0];
            const want = [0, 4, 10, 2, 6, 9];
            if (JSON.stringify(pcset(g.semis)) !== JSON.stringify(pcset(want))) return `You have ${nms(g.semis)}. Upper structure II on C7 is C E Bb plus D F# A.`;
            return g.semis[0] % 12 === 0 ? null : "Keep C at the bottom.";
          },
        } },
        { quiz: [
          { q: "Drop 2 drops which voice an octave?", options: ["The top", "The second from the top", "The second from the bottom", "The bass"], answer: 1 },
          { q: "A D major triad over C7 adds which tensions?", options: ["b9, #9, b13", "9, #11, 13", "11, 13, b7", "b5, #5, 9"], answer: 1 },
          { q: "Listen. Rootless or root position?", listen: `voice x = changes("Dm7 | G7").rootless.voicelead\nvoice b = changes("Dm7 | G7").root.octave(-1).inst(upright)`, bars: 2, options: ["Rootless (bass has the roots)", "Root position in the piano"], answer: 0 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "bebop", title: "The bebop language",
      parts: [
        `<p>Bebop melody, from Charlie Parker and Dizzy Gillespie on, follows a few rules so consistently that they work like grammar.</p>
         <ul><li><b>Chord tones on the beat.</b> Strong beats outline the harmony; offbeats connect.</li>
         <li><b>Bebop scales</b> add one chromatic passing note to a seven-note scale, making eight. A run of eighth notes then keeps chord tones on every beat.</li>
         <li><b>Enclosures and chromatic approaches</b> aim at targets (lesson 13).</li>
         <li><b>Arpeggios from the 3rd up</b>: 3, 5, 7, 9 of a chord, the rootless voicing played as a line.</li>
         <li><b>Guide-tone targets</b>: the 7th of one chord falling to the 3rd of the next across the bar line.</li></ul>
         <p>The <b>bebop dominant scale</b> is mixolydian with a major 7th added: G A B C D E F F# G. Descend from G in eighths and the beats land on G, F, D and B, the chord tones of G7.</p>`,
        { code: `tempo 160\nvoice comp = g3@7.rootless.vel(.45)\nvoice bass = [g2 . d2 .].inst(upright)\nvoice line = [g5 f#5 f5 e5 d5 c5 b4 a4].swing.inst(vibes)` },
        `<p>Without the passing F#, the same descent drifts: by beat 3 the chord tones are on the offbeats and the line sounds aimless. That one added note is the difference.</p>`,
        { code: `tempo 160\nvoice comp = g3@7.rootless.vel(.45)\n-- mixolydian only: chord tones slip onto the offbeats\nvoice line = [g5 f5 e5 d5 c5 b4 a4 g4].swing.inst(vibes)` },
        `<p>Put the devices together over a ii-V-I. Arpeggiate Dm7 from its 3rd, climb G7 and come down through the bebop passing tone F#, and resolve the F (7th of G7) to E (3rd of Cmaj7) across the bar line.</p>`,
        { code: `tempo 170\nlet tune = changes("Dm7 | G7 | Cmaj7 | %")\nvoice comp = tune.rootless.voicelead.vel(.45)\nvoice bass = tune.root.octave(-1).inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.35)\nvoice line = <[f4 a4 c5 e5 d5 c5 b4 a4] [g4 b4 d5 g5 _ f#5 f5 _] [e5 _ _ c5 b4 c5 _ .] [.]>.swing.inst(vibes)`, bars: 4 },
        { exercise: {
          task: `<p>Over <b>G7</b>, write <code>voice line</code>: eight eighth notes descending the <b>G bebop dominant</b> scale from G5. Every note on a beat (notes 1, 3, 5, 7) must be a chord tone of G7, and the passing F# must be in it.</p>`,
          starter: `voice comp = g3@7.rootless.vel(.4)\nvoice line = [g5 f5 e5 d5 c5 b4 a4 g4].swing`,
          solution: `voice comp = g3@7.rootless.vel(.4)\nvoice line = [g5 f#5 f5 e5 d5 c5 b4 a4].swing`,
          check: (_s, n) => {
            const m = need(n, "line"); if (m) return m;
            const l = line(n, "line").slice(0, 8);
            if (l.length !== 8) return `That is ${l.length} notes; write 8.`;
            if (l[0] !== 79) return "Start on G5.";
            if (!l.every(x => subset([x], [7, 9, 11, 0, 2, 4, 5, 6]))) return "Stay in the G bebop dominant scale: G A B C D E F F#.";
            for (let i = 0; i < 8; i += 2) if (!subset([l[i]], [7, 11, 2, 5])) return `Note ${i + 1} (${nm(l[i])}) is on a beat but is not a chord tone of G7.`;
            return l.some(x => pc(x) === 6) ? null : "Include the passing F#.";
          },
        } },
        { quiz: [
          { q: "The bebop dominant scale adds which note to mixolydian?", options: ["The b9", "The major 7th", "The #11", "The b3"], answer: 1 },
          { q: "Why add the passing note?", options: ["To make the scale symmetrical", "So chord tones fall on the beats in a run of eighths", "To avoid the tritone", "For a darker sound"], answer: 1 },
          { q: "In a ii-V-I, the 7th of V7 usually resolves to...", options: ["the root of I", "the 3rd of I", "the 5th of I", "the 7th of I"], answer: 1 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "modal", title: "Modal jazz and quartal harmony",
      parts: [
        `<p>Around 1959, players including Miles Davis, Bill Evans and John Coltrane began writing tunes with very few chords that last a long time, sometimes eight or sixteen bars each. In <b>modal jazz</b> the harmony is a mode rather than a progression, and the interest moves to melody, rhythm and texture.</p>
         <p>A common modal form is a 32-bar AABA in which the A sections are one dorian mode and the bridge is the same mode a half step up. The tension comes from the shift itself.</p>`,
        { code: `tempo 140\nsection main 4\n  key d dorian\n  let q = {^1 ^4 ^7 ^10}\n  voice pad = <q q q.step(1) q.step(1)>.inst(keys).vel(.5)\n  voice bass = [^1 _ _ ^5 . ^1 _ .].octave(-2).inst(upright)\nsection bridge 4\n  key eb dorian\n  let q = {^1 ^4 ^7 ^10}\n  voice pad = <q q q.step(1) q.step(1)>.inst(keys).vel(.5)\n  voice bass = [^1 _ _ ^5 . ^1 _ .].octave(-2).inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.35)\nform main main bridge main` },
        `<p>Tertian chords (stacks of thirds) point at a root and a function. <b>Quartal</b> chords (stacks of fourths) don't, which suits music that doesn't want to move. A powerful modal technique is <b>planing</b>: keep one shape and slide it through the mode step by step. Because the steps are diatonic, the fourths are mostly perfect, with an occasional tritone that adds a bite. In Tine, write the shape on degrees and move it with <code>.step</code>.</p>`,
        { code: `tempo 120\nkey d dorian\nlet q = {^1 ^4 ^7 ^10}\nvoice planing = [q q.step(1) q.step(2) q.step(1) q . q.step(-1) .].inst(keys).swing\nvoice bass = [^1 _ _ _ ^1 _ _ _].octave(-2).inst(upright)` },
        `<p><b>Sus chords</b> are the other modal staple. A 9sus4 chord (G C D F A) is really an F triad over G, or Dm7 over G: it has a dominant's root and seventh but no third, so it floats instead of resolving. Herbie Hancock built whole tunes from chains of sus chords. A <b>pedal point</b>, one bass note held while chords change above it, does the same thing.</p>`,
        { code: `tempo 90\nvoice comp = <g3@9sus4 ab3@maj7 g3@9sus4 f3@m11>.voicelead.inst(keys)\nvoice bass = [g1 _ _ _].inst(upright)` },
        { exercise: {
          task: `<p>In <b>D dorian</b>, write <code>voice comp</code> that <b>planes a quartal voicing</b> through the mode: at least three different four-note chords, each a stack of fourths (every gap between neighboring notes a perfect fourth or a tritone), all from D dorian.</p>`,
          starter: `key d dorian\nvoice comp = [^1@7 ^2@7 ^3@7 .]`,
          solution: `key d dorian\nlet q = {^1 ^4 ^7 ^10}\nvoice comp = [q q.step(1) q.step(2) .]`,
          check: (_s, n) => {
            const m = need(n, "comp"); if (m) return m;
            const g = groups(of(n, "comp")).filter(x => x.semis.length >= 2);
            const dor = [2, 4, 5, 7, 9, 11, 0];
            const seen = new Set<string>();
            for (const ch of g) {
              if (ch.semis.length !== 4) return `One chord has ${ch.semis.length} notes; use four.`;
              for (let i = 1; i < 4; i++) { const d = ch.semis[i] - ch.semis[i - 1]; if (d !== 5 && d !== 6) return `${nms(ch.semis)} is not a stack of fourths (a gap of ${d} half steps).`; }
              if (!subset(ch.semis, dor)) return `${nms(ch.semis)} leaves D dorian.`;
              seen.add(ch.semis.join(","));
            }
            return seen.size >= 3 ? null : `I hear ${seen.size} different quartal chords; plane through at least three.`;
          },
        } },
        { quiz: [
          { q: "What replaces a progression in modal jazz?", options: ["A mode held for many bars", "A twelve-tone row", "A fixed bass riff", "Constant modulation"], answer: 0 },
          { q: "A 9sus4 chord leaves out which chord tone?", options: ["The root", "The 3rd", "The 7th", "The 9th"], answer: 1 },
          { q: "Planing means...", options: ["moving one voicing shape through a scale", "removing the root", "holding a bass note", "doubling the melody"], answer: 0 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "coltrane", title: "Coltrane changes and symmetric motion",
      parts: [
        `<p>Major and minor keys divide the octave unevenly, which is what gives tonal music its sense of direction. Divide it evenly and you get a different kind of harmony. Three major thirds make an octave: B, G, Eb, B. In 1959 John Coltrane built tunes whose tonics move around that triangle, each new key reached through its own V7. The result, <b>Coltrane changes</b>, is one of the hardest things in jazz to improvise over, because the key changes every two beats.</p>`,
        { code: `tempo 120\n-- three tonics a major third apart, each approached by its dominant\nlet tune = changes("Bmaj7 D7 | Gmaj7 Bb7 | Ebmaj7 F#7 | Bmaj7")\nvoice comp = tune.rootless.voicelead\nvoice bass = tune.root.octave(-1).inst(upright)`, bars: 4 },
        `<p>Coltrane also used the cycle as a <b>substitution</b>. Over a plain ii-V-I in C, the major-third cycle visits Ab and E on its way to C, adding dominants in front of each: Dm7, Eb7, Abmaj7, B7, Emaj7, G7, Cmaj7. It starts and ends in the same place, and in between it takes the long way round.</p>`,
        { code: `tempo 120\nlet plain = changes("Dm7 | G7 | Cmaj7 | %")\nlet trane = changes("Dm7 Eb7 | Abmaj7 B7 | Emaj7 G7 | Cmaj7")\nlet both = arrange(plain, 4, trane, 4)\nvoice comp = both.rootless.voicelead\nvoice bass = both.root.octave(-1).inst(upright)`, bars: 8 },
        `<p>Symmetric divisions turn up everywhere once you look. Minor thirds divide the octave into four (the diminished chord, lesson 25), whole steps into six (the whole-tone scale), the tritone into two (the tritone substitute). Each one is a way out of a key that still sounds organized, because the pattern itself is audible.</p>`,
        { exercise: {
          task: `<p>Write <code>voice comp</code>: the <b>Coltrane substitution over Dm7 G7 Cmaj7</b>, in four bars: Dm7 Eb7, Abmaj7 B7, Emaj7 G7, Cmaj7.</p>`,
          starter: `voice comp = changes("Dm7 | G7 | Cmaj7 | %")`,
          solution: `voice comp = changes("Dm7 Eb7 | Abmaj7 B7 | Emaj7 G7 | Cmaj7").voicelead`,
          bars: 4,
          check: (_s, n) => expectChords(n, "comp", [[2, "m7"], [3, "7"], [8, "maj7"], [11, "7"], [4, "maj7"], [7, "7"], [0, "maj7"]]),
        } },
        { quiz: [
          { q: "How many tonics are in a major-third cycle?", options: ["2", "3", "4", "6"], answer: 1 },
          { q: "What precedes each new tonic in Coltrane changes?", options: ["Its IV", "Its V7", "A diminished chord", "Its relative minor"], answer: 1 },
          { q: "Which interval divides the octave into four equal parts?", options: ["Major 3rd", "Minor 3rd", "Whole step", "Tritone"], answer: 1 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "reharm", title: "Reharmonization",
      parts: [
        `<p><b>Reharmonization</b> is choosing new chords under an existing melody. It is how arrangers make a familiar tune sound new, and it draws on everything in this course. The one hard rule: each melody note must fit the new chord, as a chord tone or an available tension. Within that rule, here is the toolbox.</p>
         <table class="t"><tr><th>technique</th><th>lesson</th></tr>
         <tr><td>Diatonic substitution: same function, other chord (vi for I, ii for IV)</td><td>10</td></tr>
         <tr><td>Secondary dominants and related iis</td><td>19</td></tr>
         <tr><td>Minor ii-Vs and altered dominants</td><td>20, 29</td></tr>
         <tr><td>Borrowed chords and the backdoor</td><td>21</td></tr>
         <tr><td>Tritone substitution</td><td>24</td></tr>
         <tr><td>Passing and common-tone diminished</td><td>25</td></tr>
         <tr><td>Coltrane and other symmetric cycles</td><td>33</td></tr>
         <tr><td>Pedal points and sus chords</td><td>32</td></tr></table>
         <p>Here is a plain four-bar melody with plain chords.</p>`,
        { code: `tempo 100\nvoice tune = <[e5 _ d5 _] [c5 _ a4 _] [d5 _ f5 _] [e5 _ _ _]>.inst(vibes)\nlet plain = changes("C | Am | Dm G7 | C")\nvoice comp = plain.voicelead.vel(.5)\nvoice bass = plain.root.octave(-1).inst(upright)`, bars: 4 },
        `<p>Now the same melody with a new chord under almost every note. Bar 1 descends from Cmaj7 to Bm7b5, which sets up a minor ii-V into Am. E7b13 carries the melody's C as its flat 13th. Dm9 and G13 hold the D and the F. Read each melody note against its chord: every one is a chord tone or a tension.</p>`,
        { code: `tempo 100\nvoice tune = <[e5 _ d5 _] [c5 _ a4 _] [d5 _ f5 _] [e5 _ _ _]>.inst(vibes)\nlet re = changes("Cmaj7 Bm7b5 | E7b13 Am7 | Dm9 G13 | Cmaj7")\nvoice comp = re.rootless.voicelead.vel(.5)\nvoice bass = re.root.octave(-1).inst(upright)`, bars: 4 },
        `<p>And again, darker. Under the D in bar 1, Bb7, the backdoor bVII7, holds D as its third. Under the C in bar 2, Abmaj7, a borrowed bVI, holds C as its third; the A that follows gets Fmaj7. In bar 3, Db7#11, the tritone substitute for G7, holds the F as its third. Testing every melody note against its chord like this is the real work of reharmonizing.</p>`,
        { code: `tempo 100\nvoice tune = <[e5 _ d5 _] [c5 _ a4 _] [d5 _ f5 _] [e5 _ _ _]>.inst(vibes)\nlet re = changes("Cmaj7 Bb7 | Abmaj7 Fmaj7 | Dm9 Db7#11 | Cmaj7")\nvoice comp = re.rootless.voicelead.vel(.5)\nvoice bass = re.root.octave(-1).inst(upright)`, bars: 4 },
        { exercise: {
          task: `<p>Reharmonize the melody. Write <code>voice comp</code> with <b>two chords in each of bars 1 to 3</b> (and one or two in bar 4), using <b>at least six different chords</b>. The melody note sounding at the start of each chord must belong to that chord (a chord tone or a tension that you include in the symbol).</p>`,
          starter: `voice tune = <[e5 _ d5 _] [c5 _ a4 _] [d5 _ f5 _] [e5 _ _ _]>.inst(vibes)\nvoice comp = changes("C | Am | Dm G7 | C")`,
          solution: `voice tune = <[e5 _ d5 _] [c5 _ a4 _] [d5 _ f5 _] [e5 _ _ _]>.inst(vibes)\nvoice comp = changes("Cmaj7 Bm7b5 | E7b13 Am7 | Dm9 G13 | Cmaj7").voicelead`,
          bars: 4,
          check: (_s, n) => {
            const m = need(n, "comp") ?? need(n, "tune"); if (m) return m;
            const tune = of(n, "tune"), chords = groups(of(n, "comp")).filter(g => g.semis.length >= 2);
            const distinct = new Set(chords.map(c => pcset(c.semis).join(",")));
            if (distinct.size < 6) return `I count ${distinct.size} different chords; use at least six.`;
            for (const c of chords) {
              const mel = tune.find(x => x.bar <= c.t + 1e-6 && x.bar + x.bars > c.t + 1e-6);
              if (!mel) continue;
              if (!has(c.semis, [mel.semi])) return `At bar ${Math.floor(c.t) + 1}, beat ${Math.round((c.t % 1) * 4) + 1}, the melody plays ${nm(mel.semi)} but the chord is ${nms(c.semis)}.`;
            }
            return null;
          },
        } },
        { quiz: [
          { q: "What is the one hard rule of reharmonization?", options: ["Keep the bass line", "Each melody note must fit the new chord", "Never use dominant chords", "Change every chord"], answer: 1 },
          { q: "Under a melody note C, which dominant chord holds it as its b13?", options: ["G7", "E7b13", "C7", "F7"], answer: 1 },
          { q: "Which technique replaces G7 with Db7?", options: ["Backdoor", "Tritone substitution", "Modal interchange", "Pedal point"], answer: 1 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "posttonal", title: "Beyond tonality: pitch-class sets and rows",
      parts: [
        `<p>Twentieth-century composers, and some jazz composers after them, wrote music without a tonic. The theory for it counts notes as numbers. A <b>pitch class</b> is a note name regardless of octave, written as an integer from C = 0 to B = 11. Arithmetic is <b>mod 12</b>: 11 + 3 is 2.</p>
         <ul><li><b>Transposition</b> Tn adds n to every pitch class. T3 of {0 4 7} (C major) is {3 7 10} (Eb major).</li>
         <li><b>Inversion</b> I flips each pitch class around 0: x becomes 12 minus x. The inversion of {0 4 7} is {0 8 5}, an F minor triad: major and minor triads are inversions of each other.</li></ul>
         <p>Tine's lists make these one line each. <code>pitch(n)</code> turns a number into a note, so <code>pitch(60 + x)</code> places pitch class x above middle C.</p>`,
        { code: `let triad = [0 4 7]\nlet tn(s, n) = s.map(x => (x + n) % 12)\nlet inv(s) = s.map(x => (12 - x) % 12)\nprint(tn(triad, 3), inv(triad))\nvoice x = cat(triad.map(x => pitch(60 + x)), tn(triad, 3).map(x => pitch(60 + x)), inv(triad).map(x => pitch(60 + x)))`, bars: 3 },
        `<p><b>Twelve-tone</b> music (Schoenberg, Berg, Webern) orders all twelve pitch classes into a <b>row</b> and builds a piece from it and its transformations: the <b>prime</b> (P), its <b>inversion</b> (I), its <b>retrograde</b> (R, backwards), and the <b>retrograde inversion</b> (RI). Each can be transposed. Bill Evans wrote a tune on a twelve-tone row, and many modern players borrow the idea for melodies that avoid any one key.</p>`,
        { code: `let row = [0 11 7 8 3 1 2 10 6 5 4 9]\nlet notes(r) = r.map(x => pitch(60 + x))\nlet inv(r) = r.map(x => (12 - x) % 12)\n-- prime, inversion, retrograde, retrograde inversion: one per bar\nvoice row12 = cat(notes(row), notes(inv(row)), notes(row).rev, notes(inv(row)).rev).inst(vibes)`, bars: 4 },
        `<p>Rows and sets are also a lens for jazz harmony. A dominant seventh is the set {0 4 7 10}. Its tritone substitute is T6 of the same set, and they share two pitch classes, the guide tones. A diminished seventh {0 3 6 9} maps onto itself under T3, which is the symmetry from lesson 25 stated as arithmetic.</p>`,
        { code: `let dom = [0 4 7 10]\nlet tn(s, n) = s.map(x => (x + n) % 12)\nprint(dom, tn(dom, 6))\nvoice x = cat(dom.map(x => pitch(55 + x)), tn(dom, 6).map(x => pitch(55 + x)))`, bars: 2 },
        { exercise: {
          task: `<p>The row is <code>[0 11 7 8 3 1 2 10 6 5 4 9]</code>. Write <code>voice ri</code> playing its <b>retrograde inversion</b> (invert it, then play it backwards) as twelve notes in one bar, starting from middle C (pitch class x at <code>pitch(60 + x)</code>).</p>`,
          starter: `let row = [0 11 7 8 3 1 2 10 6 5 4 9]\nvoice ri = row.map(x => pitch(60 + x))`,
          solution: `let row = [0 11 7 8 3 1 2 10 6 5 4 9]\nvoice ri = row.map(x => pitch(60 + (12 - x) % 12)).rev`,
          check: (_s, n) => {
            const m = need(n, "ri"); if (m) return m;
            const row = [0, 11, 7, 8, 3, 1, 2, 10, 6, 5, 4, 9];
            const want = row.map(x => (12 - x) % 12).reverse();
            const got = line(n, "ri").slice(0, 12).map(pc);
            if (got.length !== 12) return `That is ${got.length} notes; a row has 12.`;
            const bad = got.findIndex((x, i) => x !== want[i]);
            return bad < 0 ? null : `Note ${bad + 1} is pitch class ${got[bad]}; the retrograde inversion has ${want[bad]} there.`;
          },
        } },
        { quiz: [
          { q: "What is T3 of the set {0 4 7}?", options: ["{3 7 10}", "{0 3 7}", "{9 1 4}", "{3 4 7}"], answer: 0 },
          { q: "What is the inversion of pitch class 4?", options: ["4", "8", "16", "-4"], answer: 1, explain: "12 minus 4." },
          { q: "Which transformation plays a row backwards?", options: ["Inversion", "Retrograde", "Transposition", "Prime"], answer: 1 },
          { q: "A dominant seventh and its tritone substitute share how many pitch classes?", options: ["None", "One", "Two", "Four"], answer: 2, explain: "The 3rd and 7th, swapped." },
        ] },
      ],
    },
  ],
};
void barChords; void rel; void inBar;
