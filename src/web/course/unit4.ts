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
        { code: `-- Cmaj7, then Cmaj7 with F on top, then with F# on top.\n-- Change f4 in bar 2 to d4 (the 9th): no clash at all.\nvoice comp = <{c3 e3 b3} {c3 e3 b3 f4} {c3 e3 b3 f#4}>.inst(keys)`, bars: 3 },
        `<p>Keep stacking thirds above a seventh chord and you reach the <b>9th</b>, <b>11th</b> and <b>13th</b>, the 2nd, 4th and 6th an octave up. Jazz calls them <b>extensions</b> or <b>tensions</b>. The seventh chord sets the function; the tensions are its color. F is the 11th of Cmaj7, and it rubs against E, the third, a half step below it. F# is the #11, and it shimmers.</p>
         <p>The rule of thumb: a tension a <b>half step above a chord tone</b> (a minor 9th above it, counting octaves) clashes. Such a note is an <b>avoid note</b>, fine in passing but not held in the chord. Dominant chords are the exception: their b9 and b13 are prized.</p>
         <table class="t"><tr><th>chord</th><th>available tensions</th><th>avoid</th></tr>
         <tr><td>maj7</td><td>9, #11, 13</td><td>11 (a half step above the 3rd)</td></tr>
         <tr><td>m7</td><td>9, 11; 13 only on ii (dorian)</td><td>b9 on iii, b13 on iii and vi</td></tr>
         <tr><td>7 (natural)</td><td>9, 13, #11</td><td>11 (unless the chord is sus)</td></tr>
         <tr><td>7 (altered)</td><td>b9, #9, b13 (often with #11)</td><td></td></tr>
         <tr><td>m7b5</td><td>11, b13, 9 (from melodic minor)</td><td>b9</td></tr>
         <tr><td>dim7</td><td>a whole step above each chord tone</td><td></td></tr></table>`,
        { code: `-- G13 to C, then G7alt to C.\n-- Change g3@7alt to g3@7b9: Eb becomes E, so only one altered tension (Ab) is left, and the pull is milder.\ntempo 90\nvoice comp = <g3@13 c3@maj9 g3@7alt c3@maj9>.rootless.voicelead\nvoice bass = <g1 c2 g1 c2>.inst(upright)`, bars: 4 },
        `<p>Dominant chords take the widest range of tensions, because their job is tension. Natural 9 and 13 sound sweet and bluesy. Altered tensions (b9, #9, b13) sound urgent and dark, and they lead by half step into the notes of the tonic: Ab to G, Eb to E.</p>`,
        { code: `-- G13 as four notes: root and 7th low, 3rd and 13th high. Then Cmaj9 without its 5th.\n-- Change e4 to d4: that is plain G7 (root, 7, 3, 5), and the color is gone.\nvoice g13 = <{g2 f3 b3 e4} {c3 e3 b3 d4}>.inst(keys)`, bars: 2 },
        `<p>Pianists don't play every note of a 13th chord. That shape is common: the root and seventh in the left hand, the third and the tension in the right. The 5th, 9th and 11th are the least necessary notes, and the ear fills them in. (Tine's <code>name</code> does not recognize this four-note shape, but a lead sheet still writes it G13.)</p>`,
        { code: `-- Partly done: root, 7th and 3rd of C7. Add the 13th (A) on top, a4, to make C13.\nvoice comp = {c3 bb3 e4}.inst(keys)` },
        { exercise: {
          task: `<p>Write <code>voice comp</code>: a <b>D13</b> voicing that contains the root, 3rd, 7th and 13th (D, F#, C, B) and does <b>not</b> contain the avoid note G.</p>`,
          starter: `voice comp = d3@11`,
          solution: `voice comp = {d2 c3 f#3 b3}`,
          check: (_s, n) => {
            const m = need(n, "comp"); if (m) return m;
            const g = groups(of(n, "comp"))[0];
            const miss = [[2, "D"], [6, "F#"], [0, "C"], [11, "B"]].filter(([p]) => !has(g.semis, [p as number])).map(([, s]) => s);
            if (miss.length) return `Your chord (${nms(g.semis)}) is missing ${miss.join(" and ")}.`;
            if (has(g.semis, [7])) return "It still has G, the 11th, a half step above the 3rd.";
            return null;
          },
        } },
        { quiz: [
          { q: "Listen. Cmaj7 first, then with a note on top. Is the top note the 11 or the #11?", listen: `voice x = <{c3 e3 b3} {c3 e3 b3 f#4}>.inst(keys)`, bars: 2, options: ["11", "#11"], answer: 1, explain: "Bright, no clash with the third." },
          { q: "Listen. G7 with tensions, resolving to C. Natural or altered?", listen: `voice x = <g3@7alt c3@maj9>.rootless.voicelead\nvoice b = <g1 c2>.inst(upright)`, bars: 2, options: ["Natural (9, 13)", "Altered (b9, #9, b13)"], answer: 1, explain: "Dark and urgent: Ab falls a half step to G, and Eb rises a half step to E." },
          { q: "Which note is the avoid note on Cmaj7?", options: ["D", "F", "A", "F#"], answer: 1, explain: "F is a half step above E, the third." },
          { q: "Which tensions are altered on a dominant chord?", options: ["9 and 13", "b9, #9, b13", "11 and 13", "6 and 9"], answer: 1 },
          { q: "From the minor ii-V lesson: G7b9 in C minor gets its b9 from which note of the key?", options: ["The flat sixth, Ab", "The flat third, Eb", "The leading tone, B", "The flat seventh, Bb"], answer: 0 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "modes", title: "Chord-scales: the modes of major",
      parts: [
        `<p>Seven scales, all starting on D. Each bar changes one note from the bar before. Listen to the scale get darker.</p>`,
        { code: `-- Brightest to darkest, one per bar.\n-- Change d4 to a4 and d2 to a2 and hear the same ladder from A.\nlet ladder = [lydian ionian mixolydian dorian aeolian phrygian locrian]\nvoice m = per_bar(bar => [^1 ^2 ^3 ^4 ^5 ^6 ^7 ^8].key(d4, at(ladder, bar))).inst(vibes)\nvoice drone = d2.inst(pad).vel(.3)`, bars: 7 },
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
        { code: `-- A line through Dm7 G7 Cmaj7: D dorian, G mixolydian, C lydian.\n-- Change the third bar's lydian to major: F# becomes F, the avoid note, and it rubs against the E in the chord.\ntempo 140\nlet tune = changes("Dm7 | G7 | Cmaj7 | %")\nvoice comp = tune.rootless.voicelead.vel(.5)\nvoice bass = tune.root.octave(-1).inst(upright)\nvoice line = <[^1 ^2 ^3 ^5 ^6 ^5 ^3 ^1].key(d4, dorian) [^3 ^4 ^5 ^7 ^9 ^7 ^5 ^4].key(g3, mixolydian) [^3 ^4 ^5 ^7 ^9 ^7 ^5 ^4].key(c4, lydian) [^1 _ _ _ . . . .].key(c4, major)>.swing.inst(vibes)`, bars: 4 },
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
        { code: `-- G7alt, a descending G altered scale, then C.\n-- Change altered to mixolydian and g3@7alt to g3@13: line and chord go sweet, and the pull weakens.\ntempo 120\nvoice comp = <g3@7alt c3@maj9>.rootless.voicelead.vel(.5)\nvoice bass = <g1 c2>.inst(upright)\nvoice line = <[^8 ^7 ^6 ^5 ^4 ^3 ^2 ^1].key(g4, altered) [^3 _ _ _ . . . .].key(c4, major)>.swing.inst(vibes)`, bars: 2 },
        `<p>That is the <b>altered scale</b>: G Ab Bb B Db Eb F, or root, b9, #9, 3, b5 (#11), b13, b7. Every tension is altered, and each one is a half step from a note of C major, so the resolution is strong. It is the seventh mode of <b>jazz melodic minor</b> (a major scale with a flat third), here Ab melodic minor. Melodic minor has seven modes, and they cover the chords the major modes can't.</p>
         <table class="t"><tr><th>mode</th><th>Tine name</th><th>chord</th></tr>
         <tr><td>1 melodic minor</td><td><code>melodic_minor</code></td><td>mmaj7, m6 (the minor tonic)</td></tr>
         <tr><td>2 dorian b2</td><td><code>dorian_b2</code></td><td>7sus(b9)</td></tr>
         <tr><td>3 lydian augmented</td><td><code>lydian_augmented</code></td><td>maj7#5</td></tr>
         <tr><td>4 lydian dominant</td><td><code>lydian_dominant</code></td><td>7#11: subV7, IV7 in the blues, bVII7</td></tr>
         <tr><td>5 mixolydian b6</td><td><code>mixolydian_b6</code></td><td>7b13</td></tr>
         <tr><td>6 locrian natural 2</td><td><code>locrian_nat2</code></td><td>m7b5 (iiø7)</td></tr>
         <tr><td>7 altered</td><td><code>altered</code></td><td>7alt: b9, #9, b13, and the b5</td></tr></table>`,
        { code: `-- Dm9, Db7#11 (the tritone sub), Cmaj9, with a Db lydian dominant line in bar 2.\n-- Change lydian_dominant to mixolydian: the G in the line becomes Gb, and the link to the original G7 is lost.\ntempo 120\nvoice comp = <d3@m9 db3@7#11 c3@maj9 .>.rootless.voicelead.vel(.5)\nvoice bass = <d2 db2 c2 .>.inst(upright)\nvoice line = <[^1 ^3 ^5 ^7 ^9 ^7 ^5 ^3].key(d4, dorian) [^8 ^7 ^6 ^5 ^4 ^3 ^2 ^1].key(db4, lydian_dominant) [^3 _ _ _ . . . .].key(c4, major) [.]>.swing.inst(vibes)`, bars: 4 },
        `<p><b>Lydian dominant</b> is mixolydian with a raised 4th, the natural scale for a tritone substitute. Over Db7, its raised 4th is G, the root of the chord it replaces.</p>`,
        { code: `-- A whole-tone scale over C7#5.\n-- Change whole_tone to half_whole and c3@7#5 to c3@7b9: the other symmetric dominant sound.\nvoice whole = [^1 ^2 ^3 ^4 ^5 ^6 ^7 .].key(c4, whole_tone).inst(vibes)\nvoice comp  = c3@7#5.vel(.4)` },
        `<p>The <b>whole-tone</b> scale has six notes, all whole steps apart, so it sounds the same from any of its notes. With the two diminished scales from the diminished lesson, it makes three <b>symmetric scales</b>:</p>
         <ul><li><b>Whole tone</b>, for 7#5 and 9#5. There are only two.</li>
         <li><b>Half-whole diminished</b>, for 7b9 chords with a natural 13.</li>
         <li><b>Whole-half diminished</b>, for diminished seventh chords.</li></ul>
         <p>Each diminished scale has only three transpositions.</p>`,
        { code: `-- Partly done: a G altered line with two gaps. Fill them with ab4 (b9) and bb4 (#9).\nvoice comp = g3@7alt.vel(.4)\nvoice line = [g4 . . b4 c#5 eb5 f5 g5].inst(vibes)` },
        { exercise: {
          task: `<p>Over <b>C7alt</b>, write <code>voice line</code>: eight notes using only the <b>C altered scale</b>, and include both the <b>b9</b> (Db) and the <b>#9</b> (Eb).</p>`,
          starter: `voice comp = c3@7alt.vel(.4)\nvoice line = [c4 d4 e4 f4 g4 a4 bb4 c5]`,
          solution: `voice comp = c3@7alt.vel(.4)\nvoice line = [^1 ^2 ^3 ^4 ^5 ^6 ^7 ^8].key(c4, altered)`,
          hint: "C altered is Db melodic minor started on C: C Db Eb E Gb Ab Bb.",
          check: (_s, n) => {
            const m = need(n, "line"); if (m) return m;
            const l = groups(inBar(of(n, "line"), 0)).map(g => g.semis[0]);
            if (l.length !== 8) return `That is ${l.length} notes; write 8.`;
            const alt = [0, 1, 3, 4, 6, 8, 10];
            const bad = l.find(x => !subset([x], alt));
            if (bad !== undefined) return `${nm(bad)} is not in C altered (C Db Eb E Gb Ab Bb).`;
            if (!l.some(x => pc(x) === 1)) return "Include the b9, Db.";
            if (!l.some(x => pc(x) === 3)) return "Include the #9, Eb.";
            return null;
          },
        } },
        { quiz: [
          { q: "Listen. C7#5 sounds, then a scale on C. Whole tone or altered?", listen: `voice p = c3@7#5.vel(.4)\nvoice x = <. [^1 ^2 ^3 ^4 ^5 ^6 ^7 .].key(c4, whole_tone)>.inst(vibes)`, bars: 2, options: ["Whole tone", "Altered"], answer: 0, explain: "Six equal steps: no half steps anywhere." },
          { q: "The G altered scale is a mode of which melodic minor scale?", options: ["G", "Ab", "C", "Db"], answer: 1, explain: "Its seventh mode." },
          { q: "Which scale fits a tritone substitute like Db7#11?", options: ["Altered", "Lydian dominant", "Dorian", "Whole-half"], answer: 1 },
          { q: "Which scale fits C7#5?", options: ["Whole tone", "Mixolydian", "Dorian b2", "Major"], answer: 0 },
          { q: "From the modes lesson: which mode matches a ii7 chord?", options: ["Ionian", "Dorian", "Phrygian", "Mixolydian"], answer: 1 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "voicings", title: "Piano voicings",
      parts: [
        `<p>One ii-V-I, played four times. The chords never change. Only the way the piano spreads them does.</p>`,
        { code: `-- Four voicings of Dm7 G7 Cmaj7, four bars each.\n-- Change tune.voicelead.drop2 to tune.voicelead.drop3 and hear the third pass open wider.\ntempo 120\nlet tune = changes("Dm7 | G7 | Cmaj7 | %")\nlet sounds = arrange(tune.shell, 4, tune.rootless.voicelead, 4, tune.voicelead.drop2, 4, tune.guide.voicelead(around: g4), 4)\nvoice comp = sounds\nvoice bass = tune.root.octave(-1).inst(upright)`, bars: 16 },
        `<p>A <b>voicing</b> is a choice of which chord notes to play, in what order, in what register. The symbol says Dm7; the voicing says how it sounds. You heard four systems, and Tine has a function for each.</p>
         <ul><li><b>Shell</b> (<code>shell</code>): root, 3rd, 7th. The bebop left hand, and the guitarist's "Freddie Green" comp.</li>
         <li><b>Rootless</b> (<code>rootless</code>): 3, 5, 7, 9 or 7, 9, 3, 5, with the 13th in place of the 5th on dominants. The default sound of a modern trio.</li>
         <li><b>Drop 2</b> (<code>drop2</code>): a four-note close voicing with the second voice from the top dropped an octave. Wider, with a clear top melody. Guitarists and big-band arrangers use it constantly. <code>drop3</code> and <code>drop24</code> are its cousins.</li>
         <li><b>Guide tones</b> (<code>guide</code>): 3rd and 7th only.</li></ul>`,
        { code: `-- Partly done: Cmaj7 in close position, then drop 2. Drop the second voice from the top: change g4 in bar 2 to g3.\nvoice comp = <{c4 e4 g4 b4} {c4 e4 g4 b4}>.inst(keys)`, bars: 2 },
        { code: `-- Five notes stacked in fourths, with a major third on top, over a D bass.\n-- Change the bass to e2: the same shape now sounds like Em7 with an added 11th.\nprint(name({e3 a3 d4 g4 b4}))\nvoice q = {e3 a3 d4 g4 b4}.inst(keys)\nvoice bass = d2.inst(upright)` },
        `<p>That is a <b>quartal voicing</b>: fourths instead of thirds, open and ambiguous. McCoy Tyner and Herbie Hancock made it a modal staple. This one, E A D G B, is the "So What" chord, from Bill Evans's piano on Miles Davis's "So What" (1959). On its own it spells Em7add11. Over a D bass it colors D minor without ever stating the third. Quartal harmony returns in the modal-jazz lesson.</p>`,
        { code: `-- A C7 shell in the left hand, with a triad above: D, A, Ab, F#.\n-- Change ab4@maj to eb4@maj: that triad (Eb G Bb) gives the #9, 5 and b7, a bluesier sound.\nvoice lh = <{c3 e3 bb3} {c3 e3 bb3} {c3 e3 bb3} {c3 e3 bb3}>.inst(keys)\nvoice rh = <d4@maj a4@maj ab4@maj f#4@maj>.inst(keys)\nprint(name({c3 e3 bb3 d4 f#4 a4}))`, bars: 4 },
        `<p>Those are <b>upper-structure triads</b>: a plain major triad on top of a dominant's shell. The triad is simple, so the ear hears it clearly, and its notes become the tensions. Over C7 (C, E, Bb):</p>
         <table class="t"><tr><th>triad on top</th><th>tensions</th><th>symbol</th></tr>
         <tr><td>D major (II)</td><td>9, #11, 13</td><td>C13#11</td></tr>
         <tr><td>A major (VI)</td><td>13, b9, 3</td><td>C13b9</td></tr>
         <tr><td>Ab major (bVI)</td><td>b13, root, #9</td><td>C7#9b13</td></tr>
         <tr><td>F# major (bV)</td><td>#11, b7, b9</td><td>C7b9#11</td></tr></table>`,
        { code: `-- Partly done: the C7 shell. Add an A major triad on top (a4 c#5 e5) to make upper structure VI.\nvoice comp = {c3 e3 bb3}.inst(keys)` },
        { exercise: {
          task: `<p>Write <code>voice comp</code>: the <b>upper structure II</b> over <b>F7</b>. That is an F7 shell (F, A, Eb) with the major triad a whole step above F on top, six notes in all.</p>`,
          starter: `voice comp = f2@7`,
          solution: `voice comp = {f2 a2 eb3 g3 b3 d4}`,
          hint: "A whole step above F is G. Spell the G major triad and put it above the shell.",
          check: (_s, n) => {
            const m = need(n, "comp"); if (m) return m;
            const g = groups(of(n, "comp"))[0];
            const want = [5, 9, 3, 7, 11, 2];
            if (!has(g.semis, [5, 9, 3])) return `You have ${nms(g.semis)}. Start from the F7 shell: F, A, Eb.`;
            if (JSON.stringify(pcset(g.semis)) !== JSON.stringify(pcset(want))) return `You have ${nms(g.semis)}. Upper structure II on F7 is F A Eb plus a G major triad, G B D.`;
            if (pc(g.semis[0]) !== 5) return "Keep F at the bottom.";
            if (g.semis.length !== 6) return `That is ${g.semis.length} notes; use six.`;
            const top = g.semis.slice(-3).map(pc).sort((a, b) => a - b);
            return top.join() === "2,7,11" ? null : `You have ${nms(g.semis)}. Put the G major triad (G B D) above the shell: the top three notes should be G, B and D.`;
          },
        } },
        { quiz: [
          { q: "Listen. Does the piano play the roots, or leave them to the bass?", listen: `voice x = changes("Dm7 | G7").rootless.voicelead\nvoice b = changes("Dm7 | G7").root.octave(-1).inst(upright)`, bars: 2, options: ["Rootless", "Roots in the piano"], answer: 0, explain: "The piano's lowest notes are C (the 7th of Dm7) and B (the 3rd of G7). The bass plays D and G." },
          { q: "Listen. C7 sounds first, then a triad joins it on top. Which tensions does the triad add?", listen: `voice lh = {c3 e3 bb3}.inst(keys)\nvoice rh = <. a4@maj>.inst(keys)`, bars: 2, options: ["9, #11, 13 (D major)", "13, b9, 3 (A major)", "b13, root, #9 (Ab major)"], answer: 1, explain: "A C# E: the C# (Db, the b9) is the sharpest rub." },
          { q: "Drop 2 drops which voice an octave?", options: ["The top", "The second from the top", "The second from the bottom", "The bass"], answer: 1 },
          { q: "A D major triad over C7 adds which tensions?", options: ["b9, #9, b13", "9, #11, 13", "11, 13, b7", "b5, #5, 9"], answer: 1 },
          { q: "From the ii-V-I lesson: a rootless voicing in A form starts on which chord tone?", options: ["The root", "The 3rd", "The 5th", "The 7th"], answer: 1 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "bebop", title: "The bebop language",
      parts: [
        `<p>A bebop line over a ii-V-I. Listen to how it hits the chord on almost every beat, and how it slides from one chord into the next.</p>`,
        { code: `-- Dm7, G7, Cmaj7.\n-- Change f5 d#5 at the end of bar 2 to e5 _: the line reaches E early, and the arrival on bar 3 loses its snap.\ntempo 170\nlet tune = changes("Dm7 | G7 | Cmaj7 | %")\nvoice comp = ([0 . . 0 . . . .] + tune).rootless.voicelead.swing.vel(.45)\nvoice bass = <[d2 e2 f2 f#2] [g2 f2 d2 db2] [c2 e2 g2 a2] [c2 g2 e2 c2]>.inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.35)\nvoice line = <[f4 a4 c5 e5 d5 c5 a4 f4] [g5 f#5 f5 e5 d5 b4 f5 d#5] [e5 _ _ c5 b4 c5 _ .] [.]>.swing.inst(vibes)`, bars: 4 },
        `<p>Bebop melody, from Charlie Parker and Dizzy Gillespie on, follows a few rules so consistently that they work like grammar. That line uses each of them.</p>
         <ul><li><b>Chord tones on the beat.</b> Strong beats outline the harmony; offbeats connect. Bar 1 lands F, C, D, A on the beats, all in Dm7.</li>
         <li><b>Arpeggios from the 3rd up</b>: F A C E is 3, 5, 7, 9 of Dm7, the rootless voicing played as a line.</li>
         <li><b>Guide-tone targets</b>: F, the 7th of G7, on beat 4 resolves to E, the 3rd of Cmaj7, across the bar line.</li>
         <li><b>Bebop scales</b> add one chromatic passing note to a seven-note scale. Bar 2 descends from G, and F# slips between G and F.</li>
         <li><b>Enclosures</b> aim at a target from both sides: F above and D# below close in on E, as in the nonchord-tone lesson.</li></ul>`,
        { code: `-- The G bebop dominant scale, descending in eighths from G.\n-- Delete f#5 and add g4 at the end: the plain mixolydian scale, for the next example.\ntempo 160\nvoice comp = g3@7.rootless.vel(.45)\nvoice bass = [g2 . d2 .].inst(upright)\nvoice line = [g5 f#5 f5 e5 d5 c5 b4 a4].swing.inst(vibes)` },
        `<p>The <b>bebop dominant scale</b> is mixolydian with a major 7th added: G A B C D E F F# G. Descend from G in eighths and the beats land on G, F, D and B, the chord tones of G7.</p>`,
        { code: `-- Mixolydian only, no F#.\n-- Listen to beats 2, 3 and 4: E, C and A, none of them chord tones of G7 (G B D F). The chord tones have slipped onto the offbeats.\ntempo 160\nvoice comp = g3@7.rootless.vel(.45)\nvoice line = [g5 f5 e5 d5 c5 b4 a4 g4].swing.inst(vibes)` },
        `<p>Without the passing F#, the descent drifts from beat 2 on, and the line sounds aimless. One added note fixes it.</p>`,
        { code: `-- Partly done: a C bebop major scale (C D E F G G# A B) descending from the C two octaves above middle C (c6), with a gap.\n-- Fill the gap with g#5 so the beats land on C, A, G and E.\nvoice comp = c3@6.vel(.4)\nvoice line = [c6 b5 a5 . g5 f5 e5 d5].swing.inst(vibes)` },
        { exercise: {
          task: `<p>Over <b>C7</b>, write <code>voice line</code>: eight eighth notes descending the <b>C bebop dominant</b> scale from C5. Every note on a beat (notes 1, 3, 5, 7) must be a chord tone of C7, and the passing note must be in it.</p>`,
          starter: `voice comp = c3@7.rootless.vel(.4)\nvoice line = [c5 bb4 a4 g4 f4 e4 d4 c4].swing`,
          solution: `voice comp = c3@7.rootless.vel(.4)\nvoice line = [c5 b4 bb4 a4 g4 f4 e4 d4].swing`,
          check: (_s, n) => {
            const m = need(n, "line"); if (m) return m;
            const l = line(n, "line").slice(0, 8);
            if (l.length !== 8) return `That is ${l.length} notes; write 8.`;
            if (l[0] !== 72) return `Start on C5; you start on ${nm(l[0])}.`;
            for (let i = 1; i < 8; i++) if (l[i] >= l[i - 1]) return `Keep the line moving down: note ${i + 1} does not descend.`;
            if (!l.every(x => subset([x], [0, 2, 4, 5, 7, 9, 10, 11]))) return "Stay in the C bebop dominant scale: C D E F G A Bb B.";
            for (let i = 0; i < 8; i += 2) if (!subset([l[i]], [0, 4, 7, 10])) return `Note ${i + 1} (${nm(l[i])}) is on a beat but is not a chord tone of C7 (C E G Bb).`;
            return l.some(x => pc(x) === 11) ? null : "Include the passing note, B natural, between C and Bb.";
          },
        } },
        { quiz: [
          { q: "Listen. G7 sounds. Bebop scale (with F#) or plain mixolydian?", listen: `tempo 140\nvoice comp = g3@7.rootless.vel(.45)\nvoice line = [g5 f#5 f5 e5 d5 c5 b4 a4].swing.inst(vibes)`, bars: 1, options: ["Bebop scale", "Mixolydian"], answer: 0, explain: "The half step F# to F near the top, and B falls on beat 4." },
          { q: "Listen. Dm7 to G7. Does the line cross the bar line by half step (7th to 3rd)?", listen: `voice comp = changes("Dm7 | G7").rootless.voicelead.vel(.45)\nvoice line = <[f4 a4 c5 e5 d5 _ c5 _] [b4 _ _ _ . . . .]>.swing.inst(vibes)`, bars: 2, options: ["Yes, C to B", "No, it leaps"], answer: 0, explain: "C, the 7th of Dm7, falls to B, the 3rd of G7." },
          { q: "The bebop dominant scale adds which note to mixolydian?", options: ["The b9", "The major 7th", "The #11", "The b3"], answer: 1 },
          { q: "Why add the passing note?", options: ["To make the scale symmetrical", "So chord tones fall on the beats in a run of eighths", "To avoid the tritone", "For a darker sound"], answer: 1 },
          { q: "From the nonchord-tone lesson: F, D#, E is what device aimed at E?", options: ["A suspension", "An enclosure", "An escape tone", "A pedal"], answer: 1 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "modal", title: "Modal jazz and quartal harmony",
      parts: [
        `<p>Sixteen bars on almost one chord. Listen for the one big event: where the whole band moves to a new key.</p>`,
        { code: `-- A sections in D dorian, the bridge in Eb dorian.\n-- Change key eb dorian to key g dorian: the bridge moves up a fourth instead of a half step.\ntempo 140\nsection main 4\n  key d dorian\n  let q = {^1 ^4 ^7 ^10}\n  voice pad = <q q q.step(1) q.step(1)>.inst(keys).vel(.5)\n  voice bass = [^1 _ _ ^5 . ^1 _ .].octave(-2).inst(upright)\nsection bridge 4\n  key eb dorian\n  let q = {^1 ^4 ^7 ^10}\n  voice pad = <q q q.step(1) q.step(1)>.inst(keys).vel(.5)\n  voice bass = [^1 _ _ ^5 . ^1 _ .].octave(-2).inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.35)\nform main main bridge main` },
        `<p>In the late 1950s, Miles Davis and Bill Evans began writing tunes with very few chords, each lasting eight or sixteen bars, and John Coltrane soon followed. In <b>modal jazz</b> the harmony is a mode rather than a progression, and the interest moves to melody, rhythm and texture. That example is the form of Miles Davis's "So What" (1959), later reused in John Coltrane's "Impressions": a 32-bar AABA (shortened here) whose A sections are one dorian mode and whose bridge is the same mode a half step up.</p>`,
        { code: `-- One quartal shape slid through D dorian.\n-- Change q.step(2) to q.step(4): A D G C, all perfect fourths, and the bite of F against B is gone.\ntempo 120\nkey d dorian\nlet q = {^1 ^4 ^7 ^10}\nvoice planing = [q q.step(1) q.step(2) q.step(1) q . q.step(-1) .].inst(keys).swing\nvoice bass = [^1 _ _ _ ^1 _ _ _].octave(-2).inst(upright)` },
        `<p>Chords built from thirds (<b>tertian</b>) point at a root and a function. Chords built from fourths (<b>quartal</b>) don't, which suits music that doesn't want to move. Sliding one shape through the mode step by step, as you just heard, is <b>planing</b>. The steps are diatonic, so the fourths are mostly perfect, with an occasional tritone that adds a bite. In Tine, write the shape on degrees and move it with <code>.step</code>.</p>`,
        { code: `-- G9sus4, Abmaj7, G9sus4, Fm11, all over a G pedal.\n-- Change the bass to <g1 g1 g1 f1>.inst(upright): the last chord settles as Fm11, and the pedal's float is gone.\ntempo 90\nvoice comp = <g3@9sus4 ab3@maj7 g3@9sus4 f3@m11>.voicelead.inst(keys)\nvoice bass = [g1 _ _ _].inst(upright)`, bars: 4 },
        `<p><b>Sus chords</b> are the other modal staple. G9sus4 (G C D F A) is Dm7 over G: it has a dominant's root and seventh but no third, so it floats instead of resolving. Herbie Hancock built whole tunes from chains of sus chords, such as "Maiden Voyage" (1965). A <b>pedal point</b>, one bass note held while chords change above it, does the same.</p>`,
        { code: `-- Partly done: one quartal chord in D dorian. Add two more after it: q.step(1) and q.step(2).\nkey d dorian\nlet q = {^1 ^4 ^7 ^10}\nvoice comp = [q . . .].inst(keys)` },
        { exercise: {
          task: `<p>In <b>E dorian</b>, write <code>voice comp</code> that <b>planes a quartal voicing</b> through the mode: at least three different four-note chords, each a stack of fourths (every gap between neighboring notes a perfect fourth or a tritone), all from E dorian.</p>`,
          starter: `key e dorian\nvoice comp = [^1@7 ^2@7 ^3@7 .]`,
          solution: `key e dorian\nlet q = {^1 ^4 ^7 ^10}\nvoice comp = [q q.step(1) q.step(2) .]`,
          hint: "Pick four notes of E dorian, each a fourth above the last, then move the whole shape up one scale step at a time.",
          check: (_s, n) => {
            const m = need(n, "comp"); if (m) return m;
            const g = groups(of(n, "comp")).filter(x => x.semis.length >= 2);
            const dor = [4, 6, 7, 9, 11, 1, 2];
            const seen = new Set<string>();
            for (const ch of g) {
              if (ch.semis.length !== 4) return `One chord has ${ch.semis.length} notes; use four.`;
              for (let i = 1; i < 4; i++) { const d = ch.semis[i] - ch.semis[i - 1]; if (d !== 5 && d !== 6) return `${nms(ch.semis, "sharps")} is not a stack of fourths (a gap of ${d} half steps).`; }
              if (!subset(ch.semis, dor)) return `${nms(ch.semis, "sharps")} leaves E dorian.`;
              seen.add(ch.semis.join(","));
            }
            return seen.size >= 3 ? null : `I hear ${seen.size} different quartal chords; plane through at least three.`;
          },
        } },
        { quiz: [
          { q: "Listen. A D bass, then a chord. Is it built in thirds or in fourths?", listen: `voice b = d2.inst(upright)\nvoice x = <. {d3 g3 c4 f4}>.inst(keys)`, bars: 2, options: ["Thirds", "Fourths"], answer: 1, explain: "D G C F: every gap is a perfect fourth." },
          { q: "Listen. The A section is D dorian. Where does the bridge go?", listen: `tempo 160\nsection main 2\n  key d dorian\n  voice pad = {^1 ^4 ^7 ^10}.inst(keys).vel(.5)\n  voice b = ^1.octave(-2).inst(upright)\nsection bridge 2\n  key eb dorian\n  voice pad = {^1 ^4 ^7 ^10}.inst(keys).vel(.5)\n  voice b = ^1.octave(-2).inst(upright)\nform main bridge main`, bars: 6, options: ["Up a half step", "Up a fourth", "Down a whole step"], answer: 0 },
          { q: "What replaces a progression in modal jazz?", options: ["A mode held for many bars", "A twelve-tone row", "A fixed bass riff", "Constant modulation"], answer: 0 },
          { q: "A 9sus4 chord leaves out which chord tone?", options: ["The root", "The 3rd", "The 7th", "The 9th"], answer: 1 },
          { q: "From the modes lesson: what is the signature note of dorian?", options: ["The b2", "The natural 6", "The #4", "The b7"], answer: 1 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "coltrane", title: "Coltrane changes and symmetric motion",
      parts: [
        `<p>Three major chords, each approached by its own dominant. Listen to the bass on beat 1 of each bar: B, G, Eb, then B again.</p>`,
        { code: `-- Three tonics a major third apart, each reached through its V7.\n-- Change tempo 120 to tempo 280, about the tempo of Coltrane's \"Giant Steps\".\ntempo 120\nlet tune = changes("Bmaj7 D7 | Gmaj7 Bb7 | Ebmaj7 F#7 | Bmaj7")\nvoice comp = ([0 . . 0 0 . . 0] + tune).rootless.voicelead.swing.vel(.6)\nvoice bass = ([0 0 0 0] + tune.root.octave(-1)).inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.4)`, bars: 4 },
        `<p>Major and minor keys divide the octave unevenly, which gives tonal music its sense of direction. Three major thirds divide it evenly: B, G, Eb, and back to B. In 1959 John Coltrane recorded "Giant Steps", whose tonics move around that triangle, each new key reached through its own V7. These <b>Coltrane changes</b> are among the hardest things in jazz to improvise over, because the key changes every two beats.</p>`,
        { code: `-- A plain ii-V-I, then the same ii-V-I with the major-third cycle inside it.\n-- Change Emaj7 G7 to Emaj7 E7 and hear the last link miss its target.\ntempo 120\nlet plain = changes("Dm7 | G7 | Cmaj7 | %")\nlet trane = changes("Dm7 Eb7 | Abmaj7 B7 | Emaj7 G7 | Cmaj7")\nlet both = arrange(plain, 4, trane, 4)\nvoice comp = both.rootless.voicelead\nvoice bass = both.root.octave(-1).inst(upright)`, bars: 8 },
        `<p>Coltrane also used the cycle as a <b>substitution</b>. His "Countdown" lays it over the ii-V-Is of "Tune Up", a tune credited to Miles Davis. Over a ii-V-I in C, the cycle visits Ab and E on its way to C, with a dominant in front of each: Dm7, Eb7, Abmaj7, B7, Emaj7, G7, Cmaj7. It starts and ends in the same place and takes the long way round.</p>`,
        { code: `-- The octave divided four ways (minor thirds), then six (whole steps), then two (tritones).\n-- Change [c4 eb4 f#4 a4] to [c4 e4 g#4] and divide the octave into three: the augmented triad.\nvoice q = cat([c4 eb4 f#4 a4], [c4 d4 e4 f#4 g#4 a#4], [c4 f#4 c5 .]).inst(vibes)`, bars: 3 },
        `<p>Symmetric divisions run through jazz harmony. Each one is a sound from an earlier lesson: the diminished chord, the whole-tone scale, the tritone substitute. Each is a way out of a key that still sounds organized, because the pattern itself is audible.</p>`,
        { code: `-- Partly done: the first two links of the cycle. Replace N.C. with Ebmaj7, the third tonic.\nlet tune = changes("Bmaj7 D7 | Gmaj7 Bb7 | N.C.")\nvoice comp = tune.rootless.voicelead`, bars: 3 },
        { exercise: {
          task: `<p>Write <code>voice comp</code>: apply the <b>Coltrane substitution</b> to a ii-V-I in <b>F</b>, in four bars. Keep Gm7 first and Fmaj7 last, visit the other two tonics of F's major-third cycle, moving down by major thirds as in the examples, and put each tonic's V7 in front of it. If you use <code>.rootless</code>, add a bass that plays the roots.</p>`,
          starter: `voice comp = changes("Gm7 | C7 | Fmaj7 | %")`,
          solution: `voice comp = changes("Gm7 Ab7 | Dbmaj7 E7 | Amaj7 C7 | Fmaj7").voicelead`,
          hint: "The cycle from F goes down a major third at a time: F, Db, A, F. The V7 of Db is Ab7.",
          bars: 4,
          check: (_s, n) => expectChords(n, "comp", [[7, "m7"], [8, "7"], [1, "maj7"], [4, "7"], [9, "maj7"], [0, "7"], [5, "maj7"]]),
        } },
        { quiz: [
          { q: "Listen. The first chord is home. Do the major chords move by fifths or by major thirds?", listen: `tempo 110\nlet t = changes("Cmaj7 | Abmaj7 | Emaj7 | Cmaj7")\nvoice c = t.rootless.voicelead\nvoice b = t.root.octave(-1).inst(upright)`, bars: 4, options: ["Fifths", "Major thirds"], answer: 1, explain: "C, Ab, E, C: down a major third each time, back home in three moves." },
          { q: "How many tonics are in a major-third cycle?", options: ["2", "3", "4", "6"], answer: 1 },
          { q: "What precedes each new tonic in Coltrane changes?", options: ["Its IV", "Its V7", "A diminished chord", "Its relative minor"], answer: 1 },
          { q: "Which interval divides the octave into four equal parts?", options: ["Major 3rd", "Minor 3rd", "Whole step", "Tritone"], answer: 1 },
          { q: "From the diminished-chord lesson: how many different diminished seventh chords are there?", options: ["12", "4", "3", "2"], answer: 2, explain: "Twelve notes, four per chord, no overlaps: three." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "reharm", title: "Reharmonization",
      parts: [
        `<p>A plain four-bar melody with plain chords. Learn the melody first, because it stays the same through the next two examples.</p>`,
        { code: `-- The melody: E D | C A | D F | E.\n-- Change Dm G7 to A G7 in bar 3: A major has C#, and the melody's D grinds a half step above it. Then change it back.\ntempo 100\nvoice tune = <[e5 _ d5 _] [c5 _ a4 _] [d5 _ f5 _] [e5 _ _ _]>.inst(vibes)\nlet plain = changes("C | Am | Dm G7 | C")\nvoice comp = plain.voicelead.vel(.5)\nvoice bass = plain.root.octave(-1).inst(upright)`, bars: 4 },
        `<p><b>Reharmonization</b> is choosing new chords under an existing melody. Arrangers use it to make a familiar tune sound new, and it draws on everything in this course. The one hard rule: each melody note must fit the new chord, as a chord tone or an available tension. That is why the A chord under the D in your edit clashed.</p>`,
        { code: `-- The same melody, a new chord under almost every note.\n-- Change E7b13 to E7: the chord's C becomes C#, and it clashes with the melody's C.\ntempo 100\nvoice tune = <[e5 _ d5 _] [c5 _ a4 _] [d5 _ f5 _] [e5 _ _ _]>.inst(vibes)\nlet re = changes("Cmaj7 Bm7b5 | E7b13 Am7 | Dm9 G13 | Cmaj7")\nvoice comp = re.rootless.voicelead.vel(.5)\nvoice bass = re.root.octave(-1).inst(upright)`, bars: 4 },
        `<p>Bar 1 moves from Cmaj7 to Bm7b5, which sets up a minor ii-V into Am. E7b13 carries the melody's C as its flat 13th. Dm9 and G13 hold the D and the F. Read each melody note against its chord: every one is a chord tone or a tension.</p>`,
        { code: `-- Darker: a borrowed bVII7, a borrowed bVI, a tritone substitute.\n-- Change Db7#11 to G7: the plain dominant returns, and the half-step slide in the bass (D, Db, C) is gone.\ntempo 100\nvoice tune = <[e5 _ d5 _] [c5 _ a4 _] [d5 _ f5 _] [e5 _ _ _]>.inst(vibes)\nlet re = changes("Cmaj7 Bb7 | Abmaj7 Fmaj7 | Dm9 Db7#11 | Cmaj7")\nvoice comp = re.rootless.voicelead.vel(.5)\nvoice bass = re.root.octave(-1).inst(upright)`, bars: 4 },
        `<p>Under the D in bar 1, Bb7, a bVII7 borrowed from C minor, holds D as its third. Under the C in bar 2, Abmaj7, a borrowed bVI, holds C as its third, and the A that follows gets Fmaj7. In bar 3, Db7#11, the tritone substitute for G7, holds the F as its third. Testing every melody note against its chord like this is the real work. The toolbox, with the lesson for each:</p>
         <table class="t"><tr><th>technique</th><th>lesson</th></tr>
         <tr><td>Diatonic substitution: same function, other chord (vi for I, ii for IV)</td><td>10</td></tr>
         <tr><td>Secondary dominants and related iis</td><td>19</td></tr>
         <tr><td>Minor ii-Vs and altered dominants</td><td>20, 29</td></tr>
         <tr><td>Borrowed chords and the backdoor</td><td>21</td></tr>
         <tr><td>Tritone substitution</td><td>24</td></tr>
         <tr><td>Passing and common-tone diminished</td><td>25</td></tr>
         <tr><td>Pedal points and sus chords</td><td>32</td></tr>
         <tr><td>Coltrane and other symmetric cycles</td><td>33</td></tr></table>`,
        { code: `-- Partly done: bars 1, 2 and 4 are reharmonized. Bar 3 is still plain.\n-- Replace Dm7 G7 with Dm9 Db7#11, or with Bm7b5 Bb7 (Dm9 and Bm7b5 both contain D; Db7#11 and Bb7 both contain F).\ntempo 100\nvoice tune = <[e5 _ d5 _] [c5 _ a4 _] [d5 _ f5 _] [e5 _ _ _]>.inst(vibes)\nlet re = changes("Cmaj7 Bm7b5 | E7b13 Am7 | Dm7 G7 | Cmaj7")\nvoice comp = re.rootless.voicelead.vel(.5)\nvoice bass = re.root.octave(-1).inst(upright)`, bars: 4 },
        { exercise: {
          task: `<p>Reharmonize the melody. Write <code>voice comp</code> with <b>two chords in each of bars 1 to 3</b> (and one or two in bar 4), using <b>at least six different chords</b>, and make it your own, not one of the lesson's two reharmonizations. The melody note sounding at the start of each chord must belong to that chord (a chord tone or a tension that you include in the symbol). Play full chords (no <code>.rootless</code>), so the check can hear every note of each chord.</p>`,
          starter: `voice tune = <[e5 _ d5 _] [c5 _ a4 _] [d5 _ f5 _] [e5 _ _ _]>.inst(vibes)\nvoice comp = changes("C | Am | Dm G7 | C")`,
          solution: `voice tune = <[e5 _ d5 _] [c5 _ a4 _] [d5 _ f5 _] [e5 _ _ _]>.inst(vibes)\nvoice comp = changes("Cmaj7 G7 | Abmaj7 Fmaj7 | Bm7b5 Bb7 | Cmaj7").voicelead`,
          bars: 4,
          check: (_s, n) => {
            const m = need(n, "comp") ?? need(n, "tune"); if (m) return m;
            const tune = of(n, "tune"), chords = groups(of(n, "comp")).filter(g => g.semis.length >= 2);
            for (let b = 0; b < 3; b++) { const k = groups(inBar(of(n, "comp"), b)).filter(g => g.semis.length >= 2).length; if (k !== 2) return `Bar ${b + 1} has ${k} chord${k === 1 ? "" : "s"}; give it two.`; }
            // A copy of either lesson example: its first six chords each hold that example's 3rd and 7th.
            const guides = [[[4, 11], [2, 9], [8, 2], [0, 7], [5, 0], [11, 5]], [[4, 11], [2, 8], [0, 7], [9, 4], [5, 0], [5, 11]]];
            if (chords.length >= 6 && guides.some(gs => gs.every((gt, i) => has(chords[i].semis, gt)))) return "Bars 1 to 3 follow one of the lesson's reharmonizations; choose at least two chords of your own.";
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
          { q: "Listen. The melody is the one from this lesson. Under its C in bar 2, is the chord major (Abmaj7) or dominant (E7b13)?", listen: `tempo 100\nvoice tune = <[e5 _ d5 _] [c5 _ a4 _]>.inst(vibes)\nlet re = changes("Cmaj7 Bm7b5 | E7b13 Am7")\nvoice comp = re.rootless.voicelead.vel(.5)\nvoice bass = re.root.octave(-1).inst(upright)`, bars: 2, options: ["Abmaj7", "E7b13"], answer: 1, explain: "The bass falls B to E, and the chord pulls toward Am." },
          { q: "The melody holds D. Which chord clashes with it?", options: ["Bb7", "Bm7b5", "G7", "A major"], answer: 3, explain: "D is a half step above C#, the third of A: the avoid 11th." },
          { q: "Under a melody note C, which dominant chord holds it as its b13?", options: ["G7", "E7", "A7", "D7"], answer: 1, explain: "A minor sixth above E is C." },
          { q: "Which technique replaces G7 with Db7?", options: ["Backdoor", "Tritone substitution", "Modal interchange", "Pedal point"], answer: 1 },
          { q: "From the borrowed-chord lesson: in C major, Abmaj7 is borrowed from which key?", options: ["A minor", "C minor", "Eb major", "F minor"], answer: 1 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "posttonal", title: "Beyond tonality: pitch-class sets and rows",
      parts: [
        `<p>Twelve notes, each used once, in a fixed order. Listen for a home note. There isn't one.</p>`,
        { code: `-- A twelve-tone row: every pitch class once, as a swung line over the ride.\n-- Add .rev after the map: the same row backwards.\nlet row = [0 11 7 8 3 1 2 10 6 5 4 9]\nvoice row12 = row.map(x => pitch(60 + x)).slow(3/2).swing.inst(vibes)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.35)`, bars: 2 },
        `<p>Twentieth-century composers, and some jazz composers after them, wrote music without a tonic. The theory for it counts notes as numbers. A <b>pitch class</b> is a note name regardless of octave, written as an integer from C = 0 to B = 11. Arithmetic is <b>mod 12</b>: 11 + 3 is 2. <code>pitch(n)</code> turns a number into a note, so <code>pitch(60 + x)</code> places pitch class x above middle C.</p>`,
        { code: `-- C major, moved up 3, then flipped around C.\n-- Change both tn(triad, 3) to tn(triad, 7) and the second bar becomes G major.\nlet triad = [0 4 7]\nlet tn(s, n) = s.map(x => (x + n) % 12)\nlet inv(s) = s.map(x => (12 - x) % 12)\nprint(tn(triad, 3), inv(triad))\nvoice x = cat(triad.map(x => pitch(60 + x)), tn(triad, 3).map(x => pitch(60 + x)), inv(triad).map(x => pitch(60 + x)))`, bars: 3 },
        `<p>Two operations do most of the work.</p>
         <ul><li><b>Transposition</b> Tn adds n to every pitch class. T3 of {0 4 7} (C major) is {3 7 10} (Eb major).</li>
         <li><b>Inversion</b> I flips each pitch class around 0: x becomes 12 minus x, mod 12, so 0 stays 0. The inversion of {0 4 7} is {0 8 5}, an F minor triad. Major and minor triads are inversions of each other.</li></ul>`,
        { code: `-- The row four ways, one per bar: prime, inversion, retrograde, retrograde inversion.\n-- Change the row's first two numbers to 11 0 and hear every version change with it.\nlet row = [0 11 7 8 3 1 2 10 6 5 4 9]\nlet notes(r) = r.map(x => pitch(60 + x))\nlet inv(r) = r.map(x => (12 - x) % 12)\nvoice row12 = cat(notes(row), notes(inv(row)), notes(row).rev, notes(inv(row)).rev).inst(vibes)`, bars: 4 },
        `<p><b>Twelve-tone</b> music (Schoenberg, Berg, Webern) orders all twelve pitch classes into a <b>row</b> and builds a piece from it and its transformations: the <b>prime</b> (P), its <b>inversion</b> (I), its <b>retrograde</b> (R, backwards), and the <b>retrograde inversion</b> (RI). Each can be transposed. Bill Evans wrote "T.T.T." ("Twelve Tone Tune", 1971) on a row, and many modern players borrow the idea for melodies that avoid any one key.</p>`,
        { code: `-- A dominant seventh counted from its own root (root = 0), placed on G; then T6 of it: Db7.\n-- Change both tn(dom, 6) to tn(dom, 5): C7, which shares only one pitch class with G7.\nlet dom = [0 4 7 10]\nlet tn(s, n) = s.map(x => (x + n) % 12)\nprint(dom, tn(dom, 6))\nvoice x = cat(dom.map(x => pitch(55 + x)), tn(dom, 6).map(x => pitch(55 + x)))`, bars: 2 },
        `<p>Sets are also a lens for jazz harmony. Counted from its root, a dominant seventh is the set {0 4 7 10}. Its tritone substitute is T6 of the same set, and they share two pitch classes, the guide tones. A diminished seventh {0 3 6 9} maps onto itself under T3, the symmetry from the diminished-chord lesson stated as arithmetic.</p>`,
        { code: `-- Partly done: the inversion of the row. Add .rev to make it the retrograde inversion.\nlet row = [0 11 7 8 3 1 2 10 6 5 4 9]\nvoice x = row.map(x => pitch(60 + (12 - x) % 12)).inst(vibes)` },
        { exercise: {
          task: `<p>The row is <code>[0 11 7 8 3 1 2 10 6 5 4 9]</code>. Write <code>voice ri</code> playing its <b>retrograde inversion</b> (invert it, then play it backwards) <b>transposed up 2</b> (T2), as twelve notes in one bar, from middle C (pitch class x at <code>pitch(60 + x)</code>).</p>`,
          starter: `let row = [0 11 7 8 3 1 2 10 6 5 4 9]\nvoice ri = row.map(x => pitch(60 + x))`,
          solution: `let row = [0 11 7 8 3 1 2 10 6 5 4 9]\nvoice ri = row.map(x => pitch(60 + (12 - x + 2) % 12)).rev`,
          hint: `Invert first (12 minus x), add 2, keep it mod 12, then reverse.`,
          check: (_s, n) => {
            const m = need(n, "ri"); if (m) return m;
            const row = [0, 11, 7, 8, 3, 1, 2, 10, 6, 5, 4, 9];
            const want = row.map(x => (12 - x + 2) % 12).reverse();
            const got = line(n, "ri").slice(0, 12).map(pc);
            if (got.length !== 12) return `That is ${got.length} notes; a row has 12.`;
            const plain = row.map(x => (12 - x) % 12).reverse();
            if (got.every((x, i) => x === plain[i])) return "That is the retrograde inversion, but not transposed. Add 2 to every pitch class.";
            const bad = got.findIndex((x, i) => x !== want[i]);
            return bad < 0 ? null : `Note ${bad + 1} is pitch class ${got[bad]}; T2 of the retrograde inversion has ${want[bad]} there.`;
          },
        } },
        { quiz: [
          { q: "Listen. Bar 1 is the row. Is bar 2 the row backwards (retrograde) or the inversion?", listen: `let row = [0 11 7 8 3 1 2 10 6 5 4 9]\nvoice x = cat(row.map(x => pitch(60 + x)), row.map(x => pitch(60 + x)).rev).inst(vibes)`, bars: 2, options: ["Retrograde", "Inversion"], answer: 0, explain: "It ends where bar 1 began, on C." },
          { q: "What is T3 of the set {0 4 7}?", options: ["{3 7 10}", "{0 3 7}", "{9 1 4}", "{3 4 7}"], answer: 0 },
          { q: "What is the inversion of pitch class 4?", options: ["4", "8", "16", "-4"], answer: 1, explain: "12 minus 4." },
          { q: "Which transformation plays a row backwards?", options: ["Inversion", "Retrograde", "Transposition", "Prime"], answer: 1 },
          { q: "From the Coltrane lesson: which interval divides the octave into three equal parts?", options: ["Minor 3rd", "Major 3rd", "Whole step", "Tritone"], answer: 1 },
        ] },
      ],
    },
  ],
};
void barChords; void rel; void inBar;
