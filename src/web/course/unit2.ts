// Unit 2, Theory 102: how chords move. Function, cadence, voice leading, melody, and the jazz core: ii-V-I, blues, walking bass, form.
import type { Unit } from "./types";
import { of, groups, inBar, need, expectChords, barChords, onDegree, isChord, movement, nms, pc, pcset, chordPcs, nm } from "./check";

const blues = (k: number) => [0, 5, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7].map(x => (k + x) % 12);

export const UNIT2: Unit = {
  id: "u2", code: "Theory 102", title: "Diatonic harmony and the jazz core",
  blurb: "What chords do: function, cadences and voice leading. Then the jazz essentials: ii-V-I, the blues, walking bass, sequences and song form.",
  lessons: [
    // ------------------------------------------------------------------
    {
      id: "function", title: "Harmonic function",
      parts: [
        `<p>Listen to four chords in C major. The first feels like home. The second steps away. The third leans hard toward something. The last one arrives.</p>`,
        { code: `-- Change the last ^1@7 to ^5@7 (in both lines): the phrase now stops on the leaning chord and never gets home.\nkey c major\nvoice chords = <^1@7 ^4@7 ^5@7 ^1@7>.voicelead\nvoice bass   = <^1 ^4 ^5 ^1>.octave(-2).inst(upright)`, bars: 4 },
        `<p>Those three jobs have names, and every diatonic chord does one of them. This is its <b>function</b>.</p>
         <ul><li><b>Tonic</b> (T): home. <b>I</b>, and its stand-ins <b>vi</b> and <b>iii</b>, which share two of its three notes.</li>
         <li><b>Predominant</b> (PD), also called subdominant: leaving home and heading for the dominant. <b>IV</b> and <b>ii</b>, which share ^4 and ^6.</li>
         <li><b>Dominant</b> (D): tension that wants home. <b>V</b> and <b>vii°</b>, both holding the tritone between ^4 and ^7.</li></ul>
         <p>The example you just heard is the path most tonal phrases follow: <b>T, PD, D, T</b>.</p>`,
        { code: `-- I vi ii V with a Charleston comp, bass and ride.\n-- Change ^6@7 to ^3@7 (and ^6 to ^3 in the bass): iii is the other tonic stand-in, and the progression still works.\ntempo 150\nkey c major\nvoice comp = ([0 . . 0 . . . .] + <^1@7 ^6@7 ^2@7 ^5@7>).voicelead.swing.vel(.6)\nvoice bass = ([0 0 0 0] + <^1 ^6 ^2 ^5>.octave(-2)).inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.45)`, bars: 4 },
        `<p>That is T, PD, D again, with each chord swapped for a member of its family: vi for I, ii for IV. <b>I vi ii V</b> is the most common progression in jazz. It is called a <b>turnaround</b> because it turns the tune back to the top.</p>`,
        { code: `-- IV V I, then ii V I. Listen to the bass under the first chord of each half.\n-- Change the first ^4@7 to ^2@7 (and ^4 to ^2 in the bass) and both halves become ii V I.\nkey c major\nvoice chords = <^4@7 ^5@7 ^1@7 . ^2@7 ^5@7 ^1@7 .>.voicelead\nvoice bass   = <^4 ^5 ^1 . ^2 ^5 ^1 .>.octave(-2).inst(upright)`, bars: 8 },
        `<p>Jazz prefers <b>ii</b> to IV as its predominant. ii goes to V by root motion of a fifth (D down to G, or up a fourth, the same move), the strongest root motion in tonal music. IV goes to V by a step. ii7 also shares three of its four notes with IV, so it does the same job.</p>
         <p>Classical harmony avoids moving backwards from D to PD. The blues does it on purpose: V7, IV7, I7 near the end of every chorus. <code>^4@dom7</code> below asks for a dominant seventh on ^4. A plain number after a degree counts scale tones, so <code>^4@7</code> would give Fmaj7. A name such as <code>dom7</code> gives a fixed quality.</p>`,
        { code: `-- V7 IV7 I7, the end of a blues chorus.\n-- Change ^4@dom7 to ^4@7 (Fmaj7): it is still legal harmony, but the bluesy grit goes.\ntempo 120\nkey c major\nvoice comp = ([0 . . 0 . . . .] + <^5@dom7 ^4@dom7 ^1@dom7 ^1@dom7>).voicelead.swing.vel(.6)\nvoice bass = ([0 0 0 0] + <^5 ^4 ^1 ^1>.octave(-2)).inst(upright)`, bars: 4 },
        { code: `-- Partly done: bar 3 is empty. Put a dominant there (^5@7, and ^5 in the bass) and the phrase closes.\n-- Then try ^4@7 instead: it still gets home, but gently, with no tritone to resolve.\nkey c major\nvoice chords = <^6@7 ^2@7 . ^1@7>.voicelead\nvoice bass   = <^6 ^2 . ^1>.octave(-2).inst(upright)`, bars: 4 },
        { exercise: {
          task: `<p>In <b>G major</b>, write <code>voice prog</code>: four bars, one chord per bar, following <b>T, PD, D, T</b>. Bar 1 must be a tonic-function chord <b>other than I</b>, bar 2 a predominant, bar 3 a dominant, bar 4 the I chord. Triads or seventh chords are fine.</p>`,
          starter: `key g major\nvoice prog = <^1@7 ^1@7 ^1@7 ^1@7>`,
          solution: `key g major\nvoice prog = <^6@7 ^2@7 ^5@7 ^1@7>.voicelead`,
          hint: `<p>The tonic stand-ins are ^3 and ^6. The predominants are ^2 and ^4. The dominants are ^5 and ^7.</p>`,
          bars: 4,
          check: (_s, n) => {
            const m = need(n, "prog"); if (m) return m;
            const c = barChords(n, "prog", 4), G = 7;
            const spec: [number[], string][] = [[[3, 6], "a tonic substitute (iii or vi)"], [[2, 4], "a predominant (ii or IV)"], [[5, 7], "a dominant (V or vii°)"], [[1], "the I chord"]];
            for (let b = 0; b < 4; b++) {
              if (!c[b]) return `Bar ${b + 1} has no chord.`;
              if (onDegree(c[b]!, G, spec[b][0]) === null) return `Bar ${b + 1} (${nms(c[b]!, "sharps")}) should be ${spec[b][1]} in G major.`;
            }
            return null;
          },
        } },
        { quiz: [
          { q: "What is the function of vi?", options: ["Tonic", "Predominant", "Dominant"], answer: 0, explain: "It shares two notes with I and often replaces it." },
          { q: "Which two chords have dominant function?", options: ["I and V", "V and vii°", "ii and IV", "iii and vii°"], answer: 1, explain: "Both hold the tritone between ^4 and ^7." },
          { q: "Listen. The first chord is home. Does the phrase end on a tonic or a dominant?", listen: `key f major\nvoice x = <^1@3 ^6@3 ^2@3 ^5@3>.voicelead\nvoice b = <^1 ^6 ^2 ^5>.octave(-2).inst(upright)`, bars: 4, options: ["Tonic", "Dominant"], answer: 1, explain: "It stops on V (C major in F) and leaves you hanging." },
          { q: "Listen. The first chord is home. Which family does the second chord belong to?", listen: `key bb major\nvoice x = <^1@7 ^2@7 ^5@7 ^1@7>.voicelead\nvoice b = <^1 ^2 ^5 ^1>.octave(-2).inst(upright)`, bars: 4, options: ["Tonic", "Predominant", "Dominant"], answer: 1, explain: "It is ii (Cm7 in Bb), leaving home on the way to V." },
          { q: "From the seventh-chord lesson: in a major key, what quality is the seventh chord built on ^5?", options: ["maj7", "m7", "Dominant 7", "m7b5"], answer: 2, explain: "V7 is the only dominant seventh in the major scale. That is why it pulls home so hard." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "cadences", title: "Cadences",
      parts: [
        `<p>Phrases end the way sentences do: with a full stop, a comma, a gentle close or a surprise. Here are four endings in F major. Play each one and decide how finished it sounds before you read its name.</p>`,
        { code: `-- Ending A.\n-- Change the top line's last ^1 to ^3: the melody now ends on A, and the stop is a little less final.\nkey f major\nvoice chords = <^5@7 ^1@3>.voicelead\nvoice bass   = <^5 ^1>.octave(-2).inst(upright)\nvoice top    = <[^2 _ _ ^7.octave(-1)] [^1 _ _ .]>.inst(vibes)`, bars: 2 },
        { code: `-- Ending B, played twice. The second time the first chord is minor.\n-- Change ^4@m to ^4@3 and the two halves match.\nkey f major\nvoice chords = <^4@3 ^1@3 ^4@m ^1@3>.voicelead\nvoice bass   = <^4 ^1 ^4 ^1>.octave(-2).inst(upright)`, bars: 4 },
        { code: `-- Ending C. Change ^6@7 to ^1@7 (and ^6 to ^1 in the bass) and the surprise is gone.\nkey f major\nvoice chords = <^2@7 ^5@7 ^6@7 .>.voicelead\nvoice bass   = <^2 ^5 ^6 .>.octave(-2).inst(upright)`, bars: 4 },
        { code: `-- Ending D. Replace the final . with ^1@3 (and ^1 in the bass): the question gets its answer.\nkey f major\nvoice chords = <^1@3 ^2@7 ^5@7 .>.voicelead\nvoice bass   = <^1 ^2 ^5 .>.octave(-2).inst(upright)`, bars: 4 },
        `<p>Each of those is a <b>cadence</b>, the harmonic punctuation at the end of a phrase.</p>
         <ul><li>A is <b>authentic</b>: V (or V7) to I. With both chords in root position and the melody ending on the tonic, it is a <b>perfect authentic cadence</b>, the full stop. Your edit to ^3 made it <b>imperfect</b>.</li>
         <li>B is <b>plagal</b>: IV to I, the "amen" at the end of a hymn. Its second half, <b>iv to I</b>, is the minor plagal, all over gospel and ballads.</li>
         <li>C is <b>deceptive</b>: V to vi. The ear expects I and gets its relative minor.</li>
         <li>D is a <b>half cadence</b>: the phrase stops on V. A comma, or a question.</li></ul>`,
        `<p>Jazz has its own standard cadence, <b>ii-V-I</b>: a predominant, a dominant and a tonic, with roots falling by fifths. Whole tunes are chains of them, and lesson 14 is devoted to it. Jazz also stretches the final chord to <code>maj7</code>, <code>6</code> or <code>69</code>. In a jazz setting a plain triad sounds square.</p>`,
        { code: `-- ii-V-I in Bb, rootless voicings in a Charleston comp.\n-- Change Bb69 to Bb7: the ending stops sounding final, because the b7 wants to move on (to Eb).\ntempo 140\nlet tune = changes("Cm9 | F13 | Bb69 | %")\nvoice comp = ([0 . . 0 . . . .] + tune).rootless.voicelead.swing.vel(.6)\nvoice bass = ([0 0 0 0] + tune.root.octave(-1)).inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.45)`, bars: 4 },
        { code: `-- Partly done, in G major: bar 2 is empty.\n-- Put ^1@3 there for an authentic cadence. Then try ^6@3 for a deceptive one and compare.\nkey g major\nvoice prog = <^5@7 .>.voicelead\nvoice bass = <^5 .>.octave(-2).inst(upright)`, bars: 2 },
        { exercise: {
          task: `<p>Write <code>voice prog</code>: a <b>deceptive cadence in D major</b>. Bar 1 is the dominant (V or V7), bar 2 the chord the ear did not expect (vi or vi7).</p>`,
          starter: `key d major\nvoice prog = <^5@7 ^1@3>`,
          solution: `key d major\nvoice prog = <^5@7 ^6@7>.voicelead`,
          bars: 2,
          check: (_s, n) => {
            const m = need(n, "prog"); if (m) return m;
            const c = barChords(n, "prog", 2);
            if (!c[0] || onDegree(c[0], 2, [5]) === null) return `Bar 1 should be V in D major (A or A7); you have ${c[0] ? nms(c[0], "sharps") : "nothing"}.`;
            if (!c[1] || onDegree(c[1], 2, [6]) === null) return `Bar 2 should be vi in D major (Bm or Bm7); you have ${c[1] ? nms(c[1], "sharps") : "nothing"}.`;
            return null;
          },
        } },
        { quiz: [
          { q: "Listen. The first chord is home. Which cadence?", listen: `key c major\nvoice x = <^1@3 ^4@3 ^5@7 ^1@3>.voicelead\nvoice b = <^1 ^4 ^5 ^1>.octave(-2).inst(upright)`, bars: 4, options: ["Authentic", "Half", "Plagal", "Deceptive"], answer: 0, explain: "V7 to I." },
          { q: "Listen. The first chord is home. Which cadence?", listen: `key a major\nvoice x = <^1@3 ^4@3 ^5@7 ^6@3>.voicelead\nvoice b = <^1 ^4 ^5 ^6>.octave(-2).inst(upright)`, bars: 4, options: ["Authentic", "Half", "Plagal", "Deceptive"], answer: 3, explain: "V7 to vi (E7 to F#m)." },
          { q: "Listen. The first chord is home. Which cadence?", listen: `key eb major\nvoice x = <^1@3 ^6@3 ^4@3 ^1@3>.voicelead\nvoice b = <^1 ^6 ^4 ^1>.octave(-2).inst(upright)`, bars: 4, options: ["Authentic", "Half", "Plagal", "Deceptive"], answer: 2, explain: "IV to I, with no dominant at all." },
          { q: "Listen. The first chord is home. Which cadence?", listen: `key g major\nvoice x = <^1@3 ^6@3 ^2@3 ^5@3>.voicelead\nvoice b = <^1 ^6 ^2 ^5>.octave(-2).inst(upright)`, bars: 4, options: ["Authentic", "Half", "Plagal", "Deceptive"], answer: 1, explain: "It stops on V." },
          { q: "A half cadence ends on a chord of which function?", options: ["Tonic", "Predominant", "Dominant"], answer: 2, explain: "It stops on V, the dominant, so it sounds unfinished." },
          { q: "From the last lesson: which function does ii have?", options: ["Tonic", "Predominant", "Dominant"], answer: 1, explain: "ii, like IV, leads away from home toward V. That is why ii-V-I is a complete cadence." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "voiceleading", title: "Voice leading",
      parts: [
        `<p>Here is one progression played two ways. First, every chord in root position. Then the same chords, each placed as close as possible to the one before. Listen to the top note in each version.</p>`,
        { code: `-- Root position: every chord jumps.\n-- Add .voicelead at the end of the line and it becomes the next example.\nvoice blocks = <c4@maj7 f4@maj7 b3@m7b5 e4@7 a3@m7 d4@m7 g3@7 c4@maj7>`, bars: 8 },
        { code: `-- Voice-led: each note moves as little as it can.\n-- Change .voicelead to .voicelead(around: c5) and the whole thing moves up, still smooth.\nvoice smooth = <c4@maj7 f4@maj7 b3@m7b5 e4@7 a3@m7 d4@m7 g3@7 c4@maj7>.voicelead`, bars: 8 },
        `<p>A progression is also a set of melodies, one per voice, sounding together. <b>Voice leading</b> is the craft of making each of those lines move well. The smooth version followed the two most basic rules: keep <b>common tones</b> (notes two chords share) in the same voice, and move the other voices by <b>step</b>. Tine's <code>voicelead</code> does this for you by picking, for each chord, the inversion nearest the one before.</p>`,
        { code: `-- Two voices a fifth apart, moving together. Listen: they fuse into one hollow line.\n-- Change the upper notes to e3 f3 g3 a3, a third above the bass each time: two lines you can tell apart.\nvoice fifths = [{c3 g3} {d3 a3} {e3 b3} {f3 c4}]` },
        `<p>That hollow sound is <b>parallel fifths</b>: two voices a fifth apart moving to another fifth. Parallel octaves do the same. Classical rules avoid both because two lines merge into one. One cure is <b>contrary motion</b>, where one voice goes up while the other goes down.</p>`,
        { code: `-- G7 to C. B rises to C, and F falls to E.\n-- Change the last note e4 to f4: the F no longer resolves, and the C chord sounds wrong.\nvoice resolve = [{g2 b3 d4 f4} _ {c3 c4 c4 e4} _]` },
        `<p>Some notes have a direction built in. These are <b>tendency tones</b>. The <b>leading tone rises</b> a half step to the tonic. A <b>chordal seventh falls</b> by step. In the example, B is the leading tone and F the seventh of G7. (D falls to C too, so C appears twice; that is normal.)</p>`,
        { code: `-- Two lines: the third and the seventh of each chord, over the bass.\n-- Delete .guide to hear the full chords. The two lines are still inside them.\nlet tune = changes("Dm7 | G7 | Cmaj7 | Fmaj7 | Bm7b5 | E7 | Am7 | %")\nvoice guide = tune.guide.voicelead(around: g4).inst(vibes)\nvoice bass  = tune.root.octave(-1).inst(upright)`, bars: 8 },
        `<p>Those are <b>guide tones</b>, and the two melodies they make are a <b>guide-tone line</b>, the most important voice leading in jazz. The third and seventh of a chord fix its quality. In a chain of falling fifths they trade places by half step: the seventh of one chord falls to the third of the next. Dm7's C falls to G7's B. G7's F falls to Cmaj7's E. Soloists play these lines to make the changes audible without a piano.</p>`,
        { code: `-- Partly done: C, Am, F, G. Bar 1 and bar 2 are voiced by hand, close together.\n-- Voice bar 3 (F) and bar 4 (G) the same way: try {c4 f4 a4} and {b3 d4 g4}.\nvoice chords = <{c4 e4 g4} {c4 e4 a4} {f3 a3 c4} {g3 b3 d4}>`, bars: 4 },
        { exercise: {
          task: `<p>Write <code>voice chords</code> playing <b>C, Am, F, G</b> (one per bar) so that the voice leading is smooth: from each chord to the next, the voices together move <b>no more than 6 half steps</b> in total. Voice them by hand or let Tine help.</p>`,
          starter: `voice chords = <c4@maj a3@m f3@maj g3@maj>`,
          solution: `voice chords = <c4@maj a3@m f3@maj g3@maj>.voicelead`,
          bars: 4,
          check: (_s, n) => {
            const m = need(n, "chords"); if (m) return m;
            const c = barChords(n, "chords", 4);
            const want: [number, string][] = [[0, ""], [9, "m"], [5, ""], [7, ""]];
            for (let b = 0; b < 4; b++) if (!c[b] || !isChord(c[b]!, want[b][0], want[b][1])) return `Bar ${b + 1} should be ${["C", "Am", "F", "G"][b]}${c[b] ? `; you have ${nms(c[b]!)}` : ""}.`;
            for (let b = 1; b < 4; b++) { const mv = movement(c[b - 1]!, c[b]!); if (mv > 6) return `From bar ${b} to bar ${b + 1} the voices move ${mv === Infinity ? "unevenly (different numbers of notes)" : mv + " half steps"}. Try another inversion of bar ${b + 1}.`; }
            return null;
          },
        } },
        { quiz: [
          { q: "Listen. The same four chords in C, played twice. Which time is voice-led?", listen: `voice x = <c4@maj f4@maj g4@maj c4@maj {c4 e4 g4} {c4 f4 a4} {b3 d4 g4} {c4 e4 g4}>`, bars: 8, options: ["The first time", "The second time"], answer: 1, explain: "The second time C stays put into F, and the other notes move by step. The first time every chord jumps." },
          { q: "Where does the leading tone usually go?", options: ["Down a step", "Up a half step to the tonic", "Up a fifth", "It stays put"], answer: 1 },
          { q: "In Dm7 to G7, which note of Dm7 falls a half step to become the third of G7?", options: ["D", "F", "A", "C"], answer: 3, explain: "C, the seventh of Dm7, falls to B." },
          { q: "Why do classical rules avoid parallel fifths?", options: ["They are out of tune", "Two voices merge and lose their independence", "They are too dissonant", "Fifths cannot be inverted"], answer: 1 },
          { q: "From the cadence lesson: V to vi is which cadence?", options: ["Authentic", "Half", "Plagal", "Deceptive"], answer: 3 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "nonchord", title: "Melody and nonchord tones",
      parts: [
        `<p>A melody built only from chord tones sounds like an arpeggio. What makes lines sing are the notes that are <b>not</b> in the chord, placed so the ear hears them as motion between chord tones. Theory names them by how they arrive and leave.</p>
         <table class="t"><tr><th>name</th><th>approach</th><th>leave</th></tr>
         <tr><td>passing tone</td><td>step</td><td>step, same direction</td></tr>
         <tr><td>neighbor tone</td><td>step</td><td>step back</td></tr>
         <tr><td>suspension</td><td>held over from the last chord</td><td>step down</td></tr>
         <tr><td>appoggiatura</td><td>leap, on a strong beat</td><td>step</td></tr>
         <tr><td>escape tone</td><td>step</td><td>leap the other way</td></tr>
         <tr><td>anticipation</td><td>arrives early</td><td>stays as a chord tone</td></tr></table>`,
        { code: `-- over Cmaj7: passing tone (D), neighbor (F), suspension of C over G resolving to B\nvoice pad = <c3@maj7 c3@maj7 g3@maj g3@maj>.inst(pad).vel(.4)\nvoice top = <[c5 d5 e5 .] [e5 f5 e5 c5] [c5 _ _ _] [b4 _ _ .]>.inst(vibes)`, bars: 4 },
        `<p>Jazz players lean on two more devices. A <b>chromatic approach</b> slides into a chord tone from a half step below or above. An <b>enclosure</b> surrounds the target, one note above and one below, and then lands on it. Both aim at a target on a strong beat. The general rule of a bebop line is <b>chord tones on the beat, color between</b>. Enclosures bend it: the note above the target may sit on a beat, as long as the target lands on the next one.</p>`,
        { code: `tempo 160\nvoice pad = [c3@maj7].inst(pad).vel(.35)\n-- C, then D# approaching E, then G enclosed by A and F#\nvoice line = [c5 d#5 e5 g5 a5 f#5 g5 .].swing.inst(vibes)` },
        `<p>Classical phrases often begin with a <b>pickup</b> (an upbeat before bar 1) and end with a suspension or appoggiatura that delays the final chord tone. Jazz phrases often begin on an offbeat and end on an offbeat anticipation, the push from lesson 2. Both are ways of keeping the ear leaning forward.</p>`,
        { exercise: {
          task: `<p>Over a bar of <b>Cmaj7</b>, write <code>voice line</code>: eight eighth notes. Every note <b>on a beat</b> (notes 1, 3, 5 and 7) must be a <b>chord tone</b> (C, E, G or B). At least <b>two</b> of the notes between beats must <b>not</b> be chord tones.</p>`,
          starter: `voice pad = c3@maj7.inst(pad)\nvoice line = [c5 e5 g5 b5 g5 e5 c5 e5]`,
          solution: `voice pad = c3@maj7.inst(pad)\nvoice line = [c5 d5 e5 f#5 g5 a5 b5 a5].swing`,
          check: (_s, n) => {
            const m = need(n, "line"); if (m) return m;
            const g = groups(inBar(of(n, "line"), 0));
            if (g.length !== 8) return `That is ${g.length} notes; write 8 eighths.`;
            const ct = new Set([0, 4, 7, 11]);
            for (let i = 0; i < 8; i += 2) if (!ct.has(pc(g[i].semis[0]))) return `Note ${i + 1} (${nm(g[i].semis[0])}) is on a beat but is not in Cmaj7.`;
            const off = [1, 3, 5, 7].filter(i => !ct.has(pc(g[i].semis[0]))).length;
            return off >= 2 ? null : `Only ${off} of the offbeat notes is outside the chord; make at least two of them passing, neighbor or approach tones.`;
          },
        } },
        { quiz: [
          { q: "A note that steps away from a chord tone and steps back is a...", options: ["passing tone", "neighbor tone", "escape tone", "suspension"], answer: 1 },
          { q: "In a 4-3 suspension, the dissonant note...", options: ["leaps up", "resolves down by step", "resolves up by step", "is repeated"], answer: 1, explain: "The fourth above the bass falls to the third." },
          { q: "An enclosure of the note E could be...", options: ["F, D#, E", "E, F, G", "C, E, G", "E, E, E"], answer: 0, explain: "Above, below, then the target." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "twofive", title: "The ii-V-I",
      parts: [
        `<p>If you learn one progression in jazz, learn <b>ii7, V7, Imaj7</b>. Roots fall by fifths (D, G, C), each chord's seventh falls to the next chord's third, and the dominant's tritone resolves into the tonic. Standards are built from strings of ii-Vs moving through keys, so jazz musicians practice them in all twelve.</p>
         <p>Here it is in Bb, the trumpet and tenor key, with the bass on roots and the piano voice-led.</p>`,
        { code: `tempo 120\nvoice comp = changes("Cm7 | F7 | Bbmaj7 | %").voicelead\nvoice bass = changes("Cm7 | F7 | Bbmaj7 | %").root.octave(-1).inst(upright)`, bars: 4 },
        `<p>Pianists rarely play roots; the bassist has them. A <b>rootless voicing</b> keeps four notes: the 3rd, 7th and two colors. On ii and I the colors are the 5th and 9th; on V the 13th replaces the 5th. Starting on the 3rd is called the <b>A form</b>, starting on the 7th the <b>B form</b>. In a ii-V-I the forms alternate on their own if each chord moves as little as possible, which is why <code>.rootless.voicelead</code> works so well.</p>`,
        { code: `print(name(c3@m7.rootless), "|", name(f3@7.rootless), "|", name(bb3@maj7.rootless))\n-- bar 1: A forms, bar 2: B forms\nvoice v = cat([c3@m7 f3@7 bb3@maj7 .].rootless, [c3@m7 f3@7 bb3@maj7 .].rootless(form: "b"))`, bars: 2 },
        `<p><code>name</code> knows these chords came from Cm7, F7 and Bbmaj7, so it names them against those roots. Hand it the same four notes with no history, and it hears something else.</p>`,
        { code: `-- the A-form Cm9, without its root\nprint(name({eb3 g3 bb3 d4}))\nvoice x = {eb3 g3 bb3 d4}` },
        `<p>Cm9 without its root is Ebmaj7. Rootless voicings are ambiguous by design: the bass note decides what they mean.</p>
         <p>Now comp. Put the voicings in the Charleston rhythm. In Tine, when two patterns are added, <b>the rhythm comes from the left one</b> and the right one supplies the notes, so a rhythm of zeros plus the changes gives chords in that rhythm.</p>`,
        { code: `tempo 150\nlet charleston = [0 . . 0 . . . .]\nlet tune = changes("Cm7 | F7 | Bbmaj7 | G7")\nvoice comp = (charleston + tune).rootless.voicelead.swing.vel(.6)\nvoice bass = ([0 0 0 0] + tune.root.octave(-1)).inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.45)\nvoice hat  = [. pedal . pedal].vel(.5)`, bars: 4 },
        `<p>That bass only repeats roots. A real bassist walks, which is lesson 16. Notice also the G7 in bar 4: it is the V of the ii (Cm7), turning the progression around to the top. You will meet it again as a secondary dominant.</p>`,
        { exercise: {
          task: `<p>Write <code>voice comp</code>: a ii-V-I in <b>Eb major</b> (Fm7 for a bar, Bb7 for a bar, Ebmaj7 for two bars) using <b>rootless voicings</b>: every chord must contain its 3rd and 7th, have at least four notes, and leave out its root.</p>`,
          starter: `voice comp = changes("Fm7 | Bb7 | Ebmaj7 | %")`,
          solution: `voice comp = changes("Fm7 | Bb7 | Ebmaj7 | %").rootless.voicelead`,
          bars: 4,
          check: (_s, n) => {
            const m = need(n, "comp"); if (m) return m;
            const c = barChords(n, "comp", 4);
            const want: [number, number, number, string][] = [[5, 8, 3, "Fm7"], [10, 2, 8, "Bb7"], [3, 7, 2, "Ebmaj7"], [3, 7, 2, "Ebmaj7"]];
            for (let b = 0; b < 4; b++) {
              const ch = c[b]; const [root, third, seventh, nmn] = want[b];
              if (!ch) return `Bar ${b + 1} has no chord.`;
              const s = new Set(pcset(ch));
              if (!s.has(third) || !s.has(seventh)) return `Bar ${b + 1} (${nms(ch)}) needs the 3rd and 7th of ${nmn}.`;
              if (s.has(root)) return `Bar ${b + 1} (${nms(ch)}) still has the root of ${nmn}.`;
              if (ch.length < 4) return `Bar ${b + 1} has ${ch.length} notes; a rootless voicing has four.`;
            }
            return null;
          },
        } },
        { quiz: [
          { q: "What are the guide tones of G7?", options: ["G and D", "B and F", "D and F", "G and B"], answer: 1, explain: "The 3rd and 7th." },
          { q: "In a rootless voicing for a dominant chord, what usually replaces the 5th?", options: ["The root", "The 13th", "The 11th", "The b9"], answer: 1 },
          { q: "Listen. How many different chords do you hear before it repeats?", listen: `tempo 110\nvoice c = changes("Dm7 | G7 | Cmaj7 | %").rootless.voicelead\nvoice b = changes("Dm7 | G7 | Cmaj7 | %").root.octave(-1).inst(upright)`, bars: 4, options: ["Two", "Three", "Four"], answer: 1, explain: "ii, V, then I held for two bars." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "blues", title: "The twelve-bar blues",
      parts: [
        `<p>The <b>blues</b> is a twelve-bar form, three four-bar phrases, built on three chords. In the blues every chord is a dominant seventh, including the tonic. That breaks the classical rules (a dominant seventh on I "should" resolve to IV), and the sound is the point.</p>
         <table class="t"><tr><td>I7</td><td>I7 (or IV7)</td><td>I7</td><td>I7</td></tr><tr><td>IV7</td><td>IV7</td><td>I7</td><td>I7</td></tr><tr><td>V7</td><td>IV7</td><td>I7</td><td>V7</td></tr></table>
         <p>Playing IV7 in bar 2 is called a <b>quick four</b>. The V7 in the last bar is the turnaround back to the top.</p>`,
        { code: `tempo 120\nlet chorus = changes("F7 | Bb7 | F7 | % | Bb7 | % | F7 | % | C7 | Bb7 | F7 | C7")\nvoice comp = ([0 . . 0 . . . .] + chorus).rootless.voicelead.swing.vel(.6)\nvoice bass = ([0 0 0 0] + chorus.root.octave(-1)).inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.45)\nvoice hat  = [. pedal . pedal].vel(.5)`, bars: 12 },
        `<p>Jazz musicians reharmonize the blues with what you already know. Bar 4 becomes a ii-V into IV. Bar 6 adds a passing diminished chord. Bar 8 tonicizes ii with its own dominant (D7 to Gm7). Bars 9 and 10 become a ii-V. Bars 11 and 12 are a I VI7 ii V turnaround. This is the <b>jazz blues</b>, and lessons 19 to 25 explain every substitution in it.</p>`,
        { code: `tempo 140\nlet chorus = changes("F7 | Bb7 | F7 | Cm7 F7 | Bb7 | Bdim7 | F7 | D7 | Gm7 | C7 | F7 D7 | Gm7 C7")\nvoice comp = chorus.rootless.voicelead.vel(.6)\nvoice bass = chorus.root.octave(-1).inst(upright)`, bars: 12 },
        `<p>Blues melody uses the blues scale over all three chords, In F, the blue third (Ab) rubs against the major third of F7 (A), yet it is the seventh of Bb7. One scale, three chords, a different tension on each. Blues phrases are often <b>call and response</b>: a two-bar idea, an answer, the idea again, and a different ending.</p>`,
        { code: `tempo 120\nkey f blues\nlet riff = [^5 ^6 ^5 ^3 _ ^1 . .]\nvoice horn = cat(riff, [.], riff, [.], riff, [.], riff, [.], [^7 _ ^6 ^5 ^4 ^3 ^2 ^1], [.], [^1 _ _ _], [.]).swing.inst(lead).vel(.55)\nvoice bass = changes("F7 | Bb7 | F7 | % | Bb7 | % | F7 | % | C7 | Bb7 | F7 | C7").root.octave(-1).inst(upright)`, bars: 12 },
        { exercise: {
          task: `<p>Write <code>voice comp</code>: a basic twelve-bar blues in <b>Bb</b>, with a quick four in bar 2 and V7 in the last bar. Every chord is a dominant seventh. (<code>changes</code> with <code>%</code> to repeat a bar will save typing.)</p>`,
          starter: `voice comp = changes("Bb7 | % | % | %")`,
          solution: `voice comp = changes("Bb7 | Eb7 | Bb7 | % | Eb7 | % | Bb7 | % | F7 | Eb7 | Bb7 | F7")`,
          bars: 12,
          check: (_s, n) => {
            const m = need(n, "comp"); if (m) return m;
            const c = barChords(n, "comp", 12), roots = blues(10);
            for (let b = 0; b < 12; b++) if (!c[b] || !isChord(c[b]!, roots[b], "7")) return `Bar ${b + 1} should be ${nm(roots[b])}7${c[b] ? `; you have ${nms(c[b]!)}` : ""}.`;
            return null;
          },
        } },
        { quiz: [
          { q: "In a basic blues, which chord is in bar 5?", options: ["I7", "IV7", "V7", "ii7"], answer: 1 },
          { q: "Which classical rule does the blues tonic chord break?", options: ["It has no third", "It is a dominant seventh that does not resolve", "It is minor", "It is in second inversion"], answer: 1 },
          { q: "Listen. Is this a basic blues or a jazz blues?", listen: `tempo 160\nvoice c = changes("F7 | Bb7 | F7 | Cm7 F7 | Bb7 | Bdim7 | F7 | D7 | Gm7 | C7 | F7 D7 | Gm7 C7").rootless.voicelead\nvoice b = changes("F7 | Bb7 | F7 | Cm7 F7 | Bb7 | Bdim7 | F7 | D7 | Gm7 | C7 | F7 D7 | Gm7 C7").root.octave(-1).inst(upright)`, bars: 12, options: ["Basic blues", "Jazz blues"], answer: 1, explain: "Listen for the ii-V in bars 9 and 10 and the turnaround." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "walking", title: "Walking bass",
      parts: [
        `<p>A <b>walking bass</b> plays steady quarter notes that spell out the harmony and push the time forward. It is the spine of swing. The method most bassists learn:</p>
         <ul><li>Beat 1: the <b>root</b> of the chord.</li>
         <li>Beats 2 and 3: other <b>chord tones</b> or <b>scale steps</b>.</li>
         <li>Beat 4: an <b>approach note</b> into the next bar's root, a half step above or below, or a scale step.</li></ul>
         <p>Before walking, bassists often play a <b>two-feel</b>: half notes on roots and fifths, which leaves room during the melody.</p>`,
        { code: `tempo 130\nvoice two = <[d2 _ a2 _] [g2 _ d2 _] [c2 _ g2 _] [c2 _ e2 _]>.inst(upright)\nvoice comp = changes("Dm7 | G7 | Cmaj7 | %").rootless.voicelead.vel(.5)`, bars: 4 },
        { code: `-- walking: root, chord tones, approach\ntempo 130\nvoice walk = <[d2 f2 a2 ab2] [g2 b2 d3 db3] [c3 b2 a2 g2] [c2 e2 g2 eb2]>.inst(upright)\nvoice comp = changes("Dm7 | G7 | Cmaj7 | %").rootless.voicelead.vel(.5)`, bars: 4 },
        `<p>You can also write the method as code. A function gets the bar number, looks up this bar's chord and the next, and builds four notes: the root, the third, the fifth, and a half step below the next root. <code>tones</code> lists a chord's notes from the bottom, so <code>at(tones(now), 1)</code> is its third.</p>`,
        { code: `tempo 140\nlet chords = [d3@m7 g3@7 c3@maj7 a3@7]\nlet walk(bar) =\n  let now = at(chords, bar)\n  let nxt = at(chords, bar + 1)\n  [root(now) at(tones(now), 1) at(tones(now), 2) (root(nxt) - 1)].octave(-1)\nvoice bass = per_bar(walk).inst(upright)\nvoice comp = per_bar(bar => at(chords, bar)).rootless.voicelead.vel(.5)`, bars: 4 },
        `<p>Listen for the leaps. The function always picks the same octave, so some approach notes jump. Good bassists choose octaves to keep the line in a comfortable range and mostly stepwise. Try changing the approach to <code>(root(nxt) + 1)</code> (from above) and hear the difference.</p>`,
        { exercise: {
          task: `<p>Over <b>Dm7 | G7 | Cmaj7 | Cmaj7</b>, write <code>voice bass</code>: four quarter notes per bar. Beat 1 must be the <b>root</b> of the bar's chord, and beat 4 must be a <b>half step</b> from the next bar's root. (After the last bar, the progression starts again on Dm7.)</p>`,
          starter: `voice bass = [d2 f2 a2 c3].inst(upright)`,
          solution: `voice bass = <[d2 f2 a2 ab2] [g2 b2 d3 c#3] [c3 e3 g3 b2] [c3 e3 g3 c#3]>.inst(upright)`,
          bars: 4,
          check: (_s, n) => {
            const m = need(n, "bass"); if (m) return m;
            const roots = [2, 7, 0, 0];
            for (let b = 0; b < 4; b++) {
              const g = groups(inBar(of(n, "bass"), b));
              if (g.length !== 4) return `Bar ${b + 1} has ${g.length} notes; walk four quarter notes.`;
              if (pc(g[0].semis[0]) !== roots[b]) return `Beat 1 of bar ${b + 1} is ${nm(g[0].semis[0])}; it should be the root, ${nm(roots[b])}.`;
              const nx = roots[(b + 1) % 4], d = (pc(g[3].semis[0]) - nx + 12) % 12;
              if (d !== 1 && d !== 11) return `Beat 4 of bar ${b + 1} is ${nm(g[3].semis[0])}; make it a half step from the next root, ${nm(nx)}.`;
            }
            return null;
          },
        } },
        { quiz: [
          { q: "In a walking line, beat 1 is most often...", options: ["the root", "the seventh", "an approach note", "a rest"], answer: 0 },
          { q: "Which note is a chromatic approach from below into G?", options: ["F", "F#", "A", "Ab"], answer: 1 },
          { q: "Listen. Two-feel or walking?", listen: `tempo 140\nvoice b = <[c2 _ g2 _] [f2 _ c3 _]>.inst(upright)\nvoice r = [ride [ride ride] ride [ride ride]].swing.vel(.4)`, bars: 2, options: ["Two-feel", "Walking"], answer: 0, explain: "Half notes: two per bar." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "cycles", title: "Circle progressions and sequences",
      parts: [
        `<p>Root motion by falling fifths is the strongest progression in tonal music. Run it through every chord of a key and you get the <b>diatonic cycle</b>: I, IV, vii, iii, vi, ii, V, I. To stay in the key, one fifth has to be a tritone (IV down to vii), and nobody notices.</p>`,
        { code: `key c major\nvoice cycle = <[^1@7 ^4@7] [^7@7 ^3@7] [^6@7 ^2@7] [^5@7 ^1@7]>.voicelead\nvoice bass  = <[^1 ^4] [^7 ^3] [^6 ^2] [^5 ^1]>.octave(-2).inst(upright)`, bars: 4 },
        `<p>The same cycle in a minor key, i iv VII III VI iiø V i, is the backbone of many standards. It contains two ii-V-Is: one into the relative major (iv, VII, III) and one into the minor tonic (iiø, V, i).</p>`,
        { code: `tempo 120\nlet cyc = changes("Am7 | Dm7 | G7 | Cmaj7 | Fmaj7 | Bm7b5 | E7 | Am7")\nvoice comp = cyc.rootless.voicelead\nvoice bass = cyc.root.octave(-1).inst(upright)`, bars: 8 },
        `<p>A <b>sequence</b> is a pattern repeated at another pitch level. Composers use sequences to build momentum and to modulate. In Tine, <code>.step</code> moves a pattern by scale steps (staying in the key), and its argument can itself change bar by bar.</p>`,
        { code: `key d minor\n-- a four-note motif, stepped down one scale degree each bar\nvoice seq = [^5 ^3 ^4 ^2].step(<0 -1 -2 -3>).inst(vibes)\nvoice bass = <^1 ^7 ^6 ^5>.octave(-2).inst(upright)`, bars: 4 },
        { exercise: {
          task: `<p>Write <code>voice cycle</code>: the full <b>diatonic cycle of fifths in C major</b> as seventh chords, two per bar over four bars: Cmaj7 Fmaj7, Bm7b5 Em7, Am7 Dm7, G7 Cmaj7.</p>`,
          starter: `key c major\nvoice cycle = <[^1@7 ^4@7] [^7@7 ^3@7]>`,
          solution: `key c major\nvoice cycle = <[^1@7 ^4@7] [^7@7 ^3@7] [^6@7 ^2@7] [^5@7 ^1@7]>.voicelead`,
          bars: 4,
          check: (_s, n) => expectChords(n, "cycle", [[0, "maj7"], [5, "maj7"], [11, "m7b5"], [4, "m7"], [9, "m7"], [2, "m7"], [7, "7"], [0, "maj7"]]),
        } },
        { quiz: [
          { q: "In the diatonic cycle of fifths in a major key, which fifth is diminished?", options: ["I to IV", "IV to vii", "ii to V", "V to I"], answer: 1, explain: "F to B is a tritone." },
          { q: "The minor-key cycle contains a ii-V-I into which key?", options: ["The dominant", "The relative major", "The parallel major", "The subdominant"], answer: 1 },
          { q: "<code>.step(-1)</code> moves a pattern...", options: ["down a half step", "down one scale degree", "down an octave", "one bar earlier"], answer: 1 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "form", title: "Phrase and song form",
      parts: [
        `<p>Music is organized in phrases the way prose is organized in sentences. A <b>phrase</b> is a musical thought ending in a cadence, typically four bars. Two phrases where the first ends weakly (a half cadence) and the second strongly (an authentic cadence) make a <b>period</b>: <b>antecedent</b> and <b>consequent</b>, question and answer.</p>`,
        { code: `tempo 110\nkey g major\nsection ante 4\n  voice m = <[^3 ^4 ^5 ^3] [^2 ^3 ^4 _] [^5 ^3 ^4 ^2] [^2 _ _ .]>.inst(vibes)\n  voice c = <^1@7 ^2@7 ^6@7 ^5@7>.voicelead.vel(.5)\nsection cons 4\n  voice m = <[^3 ^4 ^5 ^3] [^2 ^3 ^4 _] [^5 ^4 ^3 ^2] [^1 _ _ .]>.inst(vibes)\n  voice c = <^1@7 ^2@7 ^5@7 ^1@7>.voicelead.vel(.5)\nform ante cons` },
        `<p>Most jazz standards come from the American popular song, and most of those use one of two 32-bar forms built from 8-bar sections.</p>
         <ul><li><b>AABA</b>: a strain, the same again (often with a stronger ending), a contrasting <b>bridge</b> (also called the B section, or the release), and the strain once more. The bridge often moves to IV or to a distant key.</li>
         <li><b>ABAC</b>: two halves that start alike and end differently.</li></ul>
         <p>The twelve-bar blues is the third common jazz form. A performance usually plays the form many times: the melody (the <b>head</b>), solos over the same changes, then the head again. Each pass is a <b>chorus</b>.</p>
         <p>In Tine, <code>section</code> defines a block of bars and <code>form</code> arranges them into a finished piece. Here is a compact AABA, with 4-bar sections to keep it short.</p>`,
        { code: `tempo 160\nsection main 4\n  voice comp = changes("Cmaj7 | Am7 | Dm7 | G7").rootless.voicelead.vel(.5)\n  voice bass = changes("Cmaj7 | Am7 | Dm7 | G7").root.octave(-1).inst(upright)\nsection bridge 4\n  voice comp = changes("Gm7 | C7 | Fmaj7 | G7").rootless.voicelead.vel(.5)\n  voice bass = changes("Gm7 | C7 | Fmaj7 | G7").root.octave(-1).inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.4)\nform main main bridge main` },
        `<p>The bridge above tonicizes IV with its own ii-V (Gm7 C7 to Fmaj7) and returns with V7. That is one of the most common bridges in the repertoire.</p>`,
        { exercise: {
          task: `<p>The sections are written; arrange them. Make the <code>form</code> an <b>AABA</b> using the sections <code>main</code> (the A strain) and <code>bridge</code>. (Section names can't be a lone letter from a to g, since those are notes.)</p>`,
          starter: `section main 2\n  voice comp = changes("Fmaj7 | C7").voicelead\nsection bridge 2\n  voice comp = changes("Bbmaj7 | C7").voicelead\nform main main main main`,
          solution: `section main 2\n  voice comp = changes("Fmaj7 | C7").voicelead\nsection bridge 2\n  voice comp = changes("Bbmaj7 | C7").voicelead\nform main main bridge main`,
          check: (s) => {
            const f = (s.form ?? []).flatMap(i => Array(i.times).fill(i.name));
            return JSON.stringify(f) === JSON.stringify(["main", "main", "bridge", "main"]) ? null : `Your form plays ${f.join(" ") || "nothing"}. AABA is main, main, bridge, main.`;
          },
        } },
        { quiz: [
          { q: "In a period, the antecedent phrase usually ends with...", options: ["a perfect authentic cadence", "a half cadence", "a plagal cadence", "no cadence"], answer: 1 },
          { q: "How many bars are in a standard AABA song form?", options: ["12", "16", "24", "32"], answer: 3 },
          { q: "In jazz, one time through the whole form is called a...", options: ["chorus", "verse", "bridge", "head"], answer: 0, explain: "The head is the chorus where the melody is played." },
        ] },
      ],
    },
  ],
};
void chordPcs;
