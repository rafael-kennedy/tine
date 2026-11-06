// Unit 3, Theory 201: chromatic harmony. Borrowed, secondary and substitute chords, modulation, and the progressions jazz is built from.
import type { Unit } from "./types";
import { of, inBar, groups, need, expectChords, barChords, isChord, nms, nm, pcset } from "./check";

const has = (semis: number[], pcs: number[]) => { const s = new Set(pcset(semis)); return pcs.every(p => s.has(p)); };

export const UNIT3: Unit = {
  id: "u3", code: "Theory 201", title: "Chromatic harmony",
  blurb: "Notes from outside the key: secondary dominants, the minor ii-V, borrowed chords, modulation, Neapolitan and augmented sixths, tritone substitutes, diminished sevenths and rhythm changes.",
  lessons: [
    // ------------------------------------------------------------------
    {
      id: "secondary", title: "Secondary dominants",
      parts: [
        `<p>Four chords in C major. One of them has a note that is not in the key. Listen for the chord that sounds brighter than it should, and where it pulls.</p>`,
        { code: `-- Cmaj7, A7, Dm7, G7.\n-- Change A7 to Am7 (the diatonic vi) and the pull into Dm7 goes slack.\ntempo 120\nlet tune = changes("Cmaj7 | A7 | Dm7 | G7")\nvoice comp = ([0 . . 0 . . . .] + tune).rootless.voicelead.swing.vel(.6)\nvoice bass = ([0 0 0 0] + tune.root.octave(-1)).inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.4)`, bars: 4 },
        `<p>A7 is not in C major: its third, C#, is the leading tone of D. It acts as a dominant of Dm7, borrowed for a moment from D minor. A dominant aimed at a chord other than I is a <b>secondary dominant</b>, and making a chord sound like a temporary home is <b>tonicization</b>. The name follows the target: A7 here is <b>V7/ii</b>, "five of two".</p>
         <table class="t"><tr><th>chord in C</th><th>name</th><th>resolves to</th><th>new note</th></tr>
         <tr><td>A7</td><td>V7/ii</td><td>Dm7</td><td>C#</td></tr><tr><td>B7</td><td>V7/iii</td><td>Em7</td><td>D#</td></tr>
         <tr><td>C7</td><td>V7/IV</td><td>Fmaj7</td><td>Bb</td></tr><tr><td>D7</td><td>V7/V</td><td>G7</td><td>F#</td></tr>
         <tr><td>E7</td><td>V7/vi</td><td>Am7</td><td>G#</td></tr></table>
         <p>Each brings one chromatic note, usually the leading tone of its target. vii° is never tonicized, because a diminished chord cannot sound like home.</p>`,
        { code: `-- On degrees, name the quality: ^6@dom7 is a dominant seventh on ^6, where ^6@7 would be the diatonic Cm7 in Eb.\n-- Change ^6@dom7 to ^3@dom7 (and ^6 to ^3 in the bass): G7 wants to resolve to Cm, but Fm7 comes next. Hear it miss.\nkey eb major\nvoice comp = <^1@maj7 ^6@dom7 ^2@m7 ^5@dom7>.voicelead\nvoice bass = <^1 ^6 ^2 ^5>.octave(-2).inst(upright)`, bars: 4 },
        `<p>A secondary dominant only works when its target follows. In Eb, C7 (^6) resolves down a fifth to Fm7 (^2). G7 (^3) wants Cm, which is not the next chord.</p>`,
        { code: `-- Every chord is the V of the next: E7, A7, D7, G7, then home.\n-- Change E7 to Em7: the chain starts one link later.\ntempo 150\nlet tune = changes("E7 | A7 | D7 | G7 | C6 | %")\nvoice comp = ([0 . . 0 . . . .] + tune).rootless.voicelead.swing.vel(.6)\nvoice bass = ([0 0 0 0] + tune.root.octave(-1)).inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.4)`, bars: 6 },
        `<p>That chain is <b>extended dominants</b>, each the V of the next, falling by fifths to the tonic. Ragtime and swing are full of them.</p>`,
        { code: `-- A7 with its own ii in front: Em7b5 A7 into Dm7.\n-- Delete Em7b5 from bar 2 and A7 takes the whole bar again.\ntempo 130\nlet tune = changes("Cmaj7 | Em7b5 A7 | Dm7 | G7")\nvoice comp = tune.rootless.voicelead\nvoice bass = tune.root.octave(-1).inst(upright)`, bars: 4 },
        `<p>In jazz a secondary dominant usually brings its own ii, a <b>related ii</b>. Em7b5 A7 is a little minor ii-V into Dm7. Whole bridges are built from these.</p>`,
        { code: `-- Partly done, in G major: I, V7/vi, vi, V7. Bar 2 is empty.\n-- Fill it with B7, the dominant of Em7.\nvoice comp = changes("Gmaj7 | N.C. | Em7 | D7").voicelead`, bars: 4 },
        { exercise: {
          task: `<p>In <b>F major</b>, write <code>voice comp</code>: four bars, <b>I, V7/ii, ii, V7</b>, one chord per bar.</p>`,
          starter: `voice comp = changes("Fmaj7 | Dm7 | Gm7 | C7")`,
          solution: `voice comp = changes("Fmaj7 | D7 | Gm7 | C7").voicelead`,
          bars: 4,
          hint: `ii in F is Gm7. Its dominant is a fifth above G.`,
          check: (_s, n) => {
            const m = need(n, "comp"); if (m) return m;
            const c = barChords(n, "comp", 4);
            const want: [number, string, string][] = [[5, "maj7", "Fmaj7"], [2, "7", "D7"], [7, "m7", "Gm7"], [0, "7", "C7"]];
            for (let b = 0; b < 4; b++) if (!c[b] || !isChord(c[b]!, want[b][0], want[b][1])) return `Bar ${b + 1} should be ${want[b][2]}${c[b] ? `; you have ${nms(c[b]!)}` : ""}.`;
            return null;
          },
        } },
        { quiz: [
          { q: "Listen. The first chord is home. Is the second chord minor (vi7) or dominant (V7/ii)?", listen: `voice c = <c4@maj7 a3@7 d4@m7 g3@7>.voicelead\nvoice b = <c2 a1 d2 g1>.inst(upright)`, bars: 4, options: ["Minor (vi7)", "Dominant (V7/ii)"], answer: 1, explain: "Hear the C# pulling up to D." },
          { q: "Listen. The first chord is home. Which chord is chromatic?", listen: `voice c = <g3@maj7 e3@m7 e3@7 a3@m7>.voicelead\nvoice b = <g1 e2 e2 a1>.inst(upright)`, bars: 4, options: ["The second", "The third", "The fourth"], answer: 1, explain: "E7 has G#, the leading tone of A. It is V7/ii in G." },
          { q: "In C major, what is V7/V?", options: ["G7", "D7", "A7", "F7"], answer: 1 },
          { q: "In C major, E7 tonicizes which chord?", options: ["Em", "Am", "A7", "B°"], answer: 1, explain: "E is the dominant of A. Its G# is the leading tone of A." },
          { q: "From the ii-V-I lesson: in Em7b5 A7 Dm7, which two notes of A7 form its tritone?", options: ["A and E", "C# and G", "E and G", "A and C#"], answer: 1, explain: "The 3rd and 7th, C# and G, resolve to D and F." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "minor251", title: "The minor ii-V-i",
      parts: [
        `<p>The same ii-V-i, twice. First in C major, then in C minor. Listen to the first chord of each and to where they land.</p>`,
        { code: `-- Major: Dm7 G7 Cmaj7. Minor: Dm7b5 G7b9 Cm6.\n-- Change Cm6 to Cmaj7 at the end: a minor ii-V landing on a major chord, a bittersweet arrival.\ntempo 110\nlet tune = changes("Dm7 | G7 | Cmaj7 | % | Dm7b5 | G7b9 | Cm6 | %")\nvoice comp = tune.rootless.voicelead\nvoice bass = tune.root.octave(-1).inst(upright)`, bars: 8 },
        `<p>In a minor key, the chords from harmonic minor give a darker ii-V: <b>iiø7, V7, i</b>. The ii is <b>half-diminished</b> (m7b5), and the dominant picks up the key's flat sixth as its <b>b9</b>. In C minor that is Dm7b5, G7b9, Cm. Tine's degree chords show where it comes from.</p>`,
        { code: `-- In C harmonic minor, the ninth chord on ^5 is G7b9 without asking.\n-- Change key c harmonic_minor to key c major and run it: Dm7, G9, Cmaj7.\nkey c harmonic_minor\nprint(name([^2@7 ^5@9 ^1@7]))\nvoice comp = <^2@7 ^5@9 ^1@m6 ^1@m6>.voicelead\nvoice bass = <^2 ^5 ^1 ^1>.octave(-2).inst(upright)`, bars: 4 },
        `<p>Jazz musicians choose the minor tonic for color. <b>m6</b> and <b>mmaj7</b> come from melodic minor and sound settled. <b>m7</b> and <b>m9</b> come from dorian and sound open, good for a vamp. The dominant varies too: <b>7b9</b>, <b>7b9b13</b>, or the fully <b>altered</b> 7alt (lesson 29).</p>`,
        { code: `-- An altered dominant and two minor tonics.\n-- Change Cmmaj7 to Cm7: the tonic sounds more open and less settled.\ntempo 110\nlet tune = changes("Dm7b5 | G7alt | Cmmaj7 | Cm6")\nvoice comp = ([0 . . 0 . . . .] + tune).rootless.voicelead.swing.vel(.6)\nvoice bass = ([0 0 0 0] + tune.root.octave(-1)).inst(upright)`, bars: 4 },
        { code: `-- Partly done, in G minor: bar 1 is the minor ii. Fill bar 2 with the dominant, D7b9.\nvoice comp = changes("Am7b5 | N.C. | Gm6 | %").voicelead`, bars: 4 },
        { exercise: {
          task: `<p>Write <code>voice comp</code>: a minor ii-V-i in <b>A minor</b>. Bar 1 <b>Bm7b5</b>, bar 2 <b>E7b9</b>, bars 3 and 4 <b>Am6</b>. Play the full chords (roots included).</p>`,
          starter: `voice comp = changes("Bm7 | E7 | Am7 | %")`,
          solution: `voice comp = changes("Bm7b5 | E7b9 | Am6 | %").voicelead`,
          bars: 4,
          check: (_s, n) => {
            const m = need(n, "comp"); if (m) return m;
            const c = barChords(n, "comp", 4);
            const want: [number, string, string][] = [[11, "m7b5", "Bm7b5"], [4, "7b9", "E7b9"], [9, "m6", "Am6"], [9, "m6", "Am6"]];
            for (let b = 0; b < 4; b++) if (!c[b] || !isChord(c[b]!, want[b][0], want[b][1])) return `Bar ${b + 1} should be ${want[b][2]}${c[b] ? `; you have ${nms(c[b]!)}` : ""}.`;
            return null;
          },
        } },
        { quiz: [
          { q: "Listen. Major ii-V-I or minor ii-V-i?", listen: `voice c = changes("Em7b5 | A7b9 | Dm6 | %").rootless.voicelead\nvoice b = changes("Em7b5 | A7b9 | Dm6 | %").root.octave(-1).inst(upright)`, bars: 4, options: ["Major", "Minor"], answer: 1 },
          { q: "Listen. A minor ii-V. Does it land on a minor or a major tonic?", listen: `voice c = changes("Gm7b5 | C7b9 | Fmaj7 | %").rootless.voicelead\nvoice b = changes("Gm7b5 | C7b9 | Fmaj7 | %").root.octave(-1).inst(upright)`, bars: 4, options: ["Minor", "Major"], answer: 1, explain: "Fmaj7: the dark approach opens onto a bright chord." },
          { q: "What quality is ii in a minor key?", options: ["Minor seventh", "Half-diminished", "Dominant", "Major seventh"], answer: 1 },
          { q: "In C minor, the b9 of G7b9 is...", options: ["A", "Ab", "Bb", "Db"], answer: 1, explain: "The flat sixth of C minor." },
          { q: "From the minor-key lesson: which form of minor raises ^7 but not ^6?", options: ["Natural", "Harmonic", "Melodic", "Dorian"], answer: 1, explain: "Harmonic minor raises ^7 to make V major, which is where V7b9 comes from." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "mixture", title: "Borrowed chords",
      parts: [
        `<p>A slow progression in C major. The third chord has one note from somewhere else. Listen for the moment the light dims.</p>`,
        { code: `-- Cmaj7, Fmaj7, Fm6, Cmaj7.\n-- Change Fm6 to Fmaj7: the dimming is gone.\ntempo 80\nlet tune = changes("Cmaj7 | Fmaj7 | Fm6 | Cmaj7")\nvoice comp = tune.voicelead.inst(keys)\nvoice bass = tune.root.octave(-1).inst(upright)`, bars: 4 },
        `<p>Fm6 is the iv chord of <b>C minor</b>. Its Ab is borrowed from the parallel minor, the key with the same tonic. Borrowing chords this way is <b>modal interchange</b>, or <b>mixture</b>. In C major the most common borrowed chords are <b>iv</b> (Fm), <b>iiø7</b> (Dm7b5), <b>bIIImaj7</b> (Ebmaj7), <b>bVImaj7</b> (Abmaj7) and <b>bVII7</b> (Bb7). The tonic stays major, so the borrowed chord darkens the moment and the tonic brightens it again. IV, iv, I is the minor plagal cadence you heard in the cadence lesson.</p>`,
        { code: `-- On an altered degree a number names the quality: ^b6@maj7 is Abmaj7, ^b7@7 is Bb7.\n-- Change ^b6@maj7 to ^6@7 (the diatonic Am7) and hear the progression brighten.\nkey c major\nvoice comp = <^1@maj7 ^b6@maj7 ^b7@7 ^1@maj7>.voicelead\nvoice bass = <^1 ^b6 ^b7 ^1>.octave(-2).inst(upright)`, bars: 4 },
        { code: `-- Fm7 Bb7 into Cmaj7.\n-- Change Fm7 | Bb7 to Dm7 | G7 and compare the front door with this side entrance.\ntempo 100\nlet tune = changes("Cmaj7 | Am7 | Fm7 | Bb7 | Cmaj7 | %")\nvoice comp = tune.rootless.voicelead\nvoice bass = tune.root.octave(-1).inst(upright)`, bars: 6 },
        `<p>That is the <b>backdoor ii-V</b>: iv7, bVII7, I. Bb7 has no leading tone. It reaches C from a whole step below in the bass, and its Ab falls to G. So it sounds like coming home by a side entrance. Ballads use it constantly.</p>`,
        { code: `-- Partly done, in F major: the backdoor ii-V is Bbm7 Eb7. Bar 3 is empty.\n-- Fill it with Eb7.\nvoice comp = changes("Fmaj7 | Bbm7 | N.C. | Fmaj7").voicelead`, bars: 4 },
        { exercise: {
          task: `<p>Write <code>voice comp</code>: a <b>backdoor cadence in G major</b>. Bar 1 <b>iv7</b>, bar 2 <b>bVII7</b>, bars 3 and 4 <b>Gmaj7</b>.</p>`,
          starter: `voice comp = changes("Am7 | D7 | Gmaj7 | %")`,
          solution: `voice comp = changes("Cm7 | F7 | Gmaj7 | %").voicelead`,
          bars: 4,
          check: (_s, n) => {
            const m = need(n, "comp"); if (m) return m;
            const c = barChords(n, "comp", 4);
            const want: [number, string, string][] = [[0, "m7", "Cm7"], [5, "7", "F7"], [7, "maj7", "Gmaj7"], [7, "maj7", "Gmaj7"]];
            for (let b = 0; b < 4; b++) if (!c[b] || !isChord(c[b]!, want[b][0], want[b][1])) return `Bar ${b + 1} should be ${want[b][2]}${c[b] ? `; you have ${nms(c[b]!)}` : ""}.`;
            return null;
          },
        } },
        { quiz: [
          { q: "Listen. The first chord is home. Is the third chord IV or iv?", listen: `voice c = <c4@maj f4@maj f4@m c4@maj>.voicelead\nvoice b = <c2 f2 f2 c2>.inst(upright)`, bars: 4, options: ["IV (major)", "iv (minor)"], answer: 1, explain: "The A drops to Ab." },
          { q: "Listen. The first chord is home. Is the cadence the front door (ii-V) or the backdoor (iv7 bVII7)?", listen: `voice c = changes("Ebmaj7 | Abm7 | Db7 | Ebmaj7").rootless.voicelead\nvoice b = changes("Ebmaj7 | Abm7 | Db7 | Ebmaj7").root.octave(-1).inst(upright)`, bars: 4, options: ["Front door", "Backdoor"], answer: 1, explain: "Db7 rises a whole step to Eb." },
          { q: "In C major, which chord is bVII7?", options: ["B7", "Bb7", "Bbmaj7", "Bdim7"], answer: 1 },
          { q: "Borrowed chords come from...", options: ["the relative minor", "the parallel minor", "the dominant key", "the whole-tone scale"], answer: 1, explain: "Same tonic, minor mode." },
          { q: "From the secondary-dominant lesson: in C major, C7 is V7/IV. Which of its notes is outside the key?", options: ["C", "E", "G", "Bb"], answer: 3, explain: "Bb, the seventh, pulls down to A in Fmaj7." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "modulation", title: "Modulation",
      parts: [
        `<p>Listen to where this progression starts, and where it ends up. By bar 5 the home chord has changed.</p>`,
        { code: `-- Starts in C, ends in G. Am7 in bar 3 belongs to both keys.\n-- Change D7 to G7 and Gmaj7 to Cmaj7: the music stays in C.\ntempo 110\nlet tune = changes("Cmaj7 | Fmaj7 | Am7 | D7 | Gmaj7 | %")\nvoice comp = tune.rootless.voicelead\nvoice bass = tune.root.octave(-1).inst(upright)`, bars: 6 },
        `<p>Tonicization borrows a key for a chord or two. <b>Modulation</b> moves the tonic for good, or at least for a section. That example used a <b>pivot chord</b>: Am7 is vi in C and ii in G, so the progression arrives on it in one key and leaves it in the other.</p>`,
        { code: `-- The same four bars in C, then in Eb, with nothing between them.\n-- Change key eb major to key a major and the second half jumps somewhere else.\ntempo 160\nsection home 4\n  key c major\n  voice comp = <^2@m7 ^5@dom7 ^1@maj7 ^1@maj7>.rootless.voicelead\nsection up 4\n  key eb major\n  voice comp = <^2@m7 ^5@dom7 ^1@maj7 ^1@maj7>.rootless.voicelead\nform home up` },
        `<p>That is a <b>direct</b>, or phrase, modulation: end a phrase in one key and start the next in another. Because Tine degrees resolve against the key, a section can restate the same material in a new key by changing one line. It is also how to practice a progression in all twelve keys.</p>`,
        { code: `-- The top note G never moves. Under it, C major becomes Eb major.\n-- Change eb3@maj to e3@m: G is still shared, and E minor is a much nearer key.\ntempo 90\nvoice hold = [g4].vel(.7).inst(vibes)\nvoice pad  = <c3@maj c3@maj eb3@maj eb3@maj>.inst(pad).vel(.4)`, bars: 4 },
        `<p>A <b>common-tone</b> modulation holds one note while the harmony shifts under it. It can reach distant keys smoothly, because the ear follows the held note.</p>`,
        { code: `-- C, then a ii-V into Eb, a ii-V into Gb, and a ii-V back to C.\n-- Change Abm7 | Db7 | Gbmaj7 to Cm7 | F7 | Bbmaj7 and the third key is a step down instead.\ntempo 140\nlet tune = changes("Cmaj7 | % | Fm7 | Bb7 | Ebmaj7 | % | Abm7 | Db7 | Gbmaj7 | % | Dm7 | G7")\nvoice comp = ([0 . . 0 . . . .] + tune).rootless.voicelead.swing.vel(.6)\nvoice bass = ([0 0 0 0] + tune.root.octave(-1)).inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.4)`, bars: 12 },
        `<p>Jazz tunes modulate constantly, almost always with a <b>ii-V of the new key</b>. The ii-V says where you are going so clearly that no pivot is needed. That example rose by minor thirds, C to Eb to Gb. Other common moves are up a fourth (to IV) and down a whole step.</p>`,
        { code: `-- Partly done: Fmaj7, then a ii-V into Db. Bar 4 is empty.\n-- Fill it with Dbmaj7.\nvoice comp = changes("Fmaj7 | Ebm7 | Ab7 | N.C.").voicelead`, bars: 4 },
        { exercise: {
          task: `<p>Write <code>voice comp</code>: four bars that start in <b>F major</b> and end in <b>Ab major</b>. Bar 1 <b>Fmaj7</b>, then a <b>ii-V of Ab</b> (bars 2 and 3), then <b>Abmaj7</b>.</p>`,
          starter: `voice comp = changes("Fmaj7 | Gm7 | C7 | Fmaj7")`,
          solution: `voice comp = changes("Fmaj7 | Bbm7 | Eb7 | Abmaj7").voicelead`,
          bars: 4,
          hint: `ii of Ab is a whole step above Ab. V is a fifth above Ab.`,
          check: (_s, n) => {
            const m = need(n, "comp"); if (m) return m;
            const c = barChords(n, "comp", 4);
            const want: [number, string, string][] = [[5, "maj7", "Fmaj7"], [10, "m7", "Bbm7 (ii of Ab)"], [3, "7", "Eb7 (V of Ab)"], [8, "maj7", "Abmaj7"]];
            for (let b = 0; b < 4; b++) if (!c[b] || !isChord(c[b]!, want[b][0], want[b][1])) return `Bar ${b + 1} should be ${want[b][2]}${c[b] ? `; you have ${nms(c[b]!)}` : ""}.`;
            return null;
          },
        } },
        { quiz: [
          { q: "Listen. The first chord is home. Does the music end in the key it started in?", listen: `tempo 120\nlet tune = changes("Cmaj7 | % | Fm7 | Bb7 | Ebmaj7 | %")\nvoice c = tune.rootless.voicelead\nvoice b = tune.root.octave(-1).inst(upright)`, bars: 6, options: ["Yes, C", "No, it moved"], answer: 1, explain: "Fm7 Bb7 is a ii-V of Eb, and it lands there." },
          { q: "In a pivot modulation from C to G, Am is vi in C. What is it in G?", options: ["iii", "ii", "IV", "vi"], answer: 1 },
          { q: "How do jazz tunes most often announce a new key?", options: ["A pivot chord", "A ii-V of the new key", "A long pause", "A key signature"], answer: 1 },
          { q: "Modulating from C major to Eb major moves the tonic...", options: ["up a minor third", "up a major third", "down a minor third", "up a fourth"], answer: 0 },
          { q: "From the borrowed-chord lesson: Ebmaj7 in C major is bIIImaj7, borrowed from C minor. What makes a passage a modulation to Eb instead?", options: ["Eb becomes the new home, usually after its own ii-V", "Any Eb chord at all", "A slower tempo", "A minor chord before it"], answer: 0 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "aug6", title: "The Neapolitan and augmented sixths",
      parts: [
        `<p>Two chromatic predominants come from the classical minor key, and both turn out to be jazz chords in disguise.</p>
         <p>The <b>Neapolitan</b> is a major triad on the lowered second degree, bII. In C minor that is Db F Ab. It usually appears in first inversion (with F in the bass), so it is called the <b>Neapolitan sixth</b>, N6, and it moves to V.</p>`,
        { code: `key c minor\nvoice comp = <{f3 ab3 db4} {g3 b3 d4 f4} {g3 c4 eb4} .>\nvoice bass = <f2 g2 c2 .>.inst(upright)`, bars: 4 },
        `<p><b>Augmented sixth chords</b> put the lowered sixth degree (Ab in C minor) in the bass and the raised fourth (F#) above it. Those two notes are an augmented sixth apart, and they spread outward by half step to the octave G, the root of V. Three national flavors add different middle notes:</p>
         <table class="t"><tr><th>chord</th><th>notes in C</th><th>sounds like</th></tr>
         <tr><td>Italian +6</td><td>Ab C F#</td><td>Ab7 without its fifth</td></tr>
         <tr><td>French +6</td><td>Ab C D F#</td><td>Ab7b5, or a whole-tone chord</td></tr>
         <tr><td>German +6</td><td>Ab C Eb F#</td><td>Ab7, exactly</td></tr></table>`,
        { code: `-- Italian, French, German, each resolving outward to G\nvoice it  = <{ab2 c4 f#4} {g2 b3 g4}>\nvoice fr  = <. . {ab2 c4 d4 f#4} {g2 b3 d4 g4}>\nvoice ger = <. . . . {ab2 c4 eb4 f#4} {g2 b3 d4 g4}>`, bars: 6 },
        `<p>Here is the catch that a pitch-based language exposes. Tine only knows the sounding notes, and to the ear a German sixth <i>is</i> a dominant seventh. Ask <code>name</code> and it says Ab7. The difference is spelling (F# versus Gb) and where the chord goes: Ab7 as a dominant would resolve to Db, while the German sixth resolves down a half step to G.</p>`,
        { code: `print(name({ab3 c4 eb4 f#4}))\nvoice x = {ab3 c4 eb4 f#4}` },
        `<p>An Ab7 that falls a half step to G is exactly what jazz calls a <b>tritone substitution</b> (next lesson): Ab7 stands in for D7, the V of V, and resolves to G. Classical and jazz theory describe the same sound with different words. This is a good place to remember that notation, and therefore spelling, encodes function. Tine can play these chords, but it can't tell you which name a composer would have written.</p>`,
        { exercise: {
          task: `<p>In <b>C minor</b>, write <code>voice comp</code>: a <b>German augmented sixth</b> with Ab as its lowest note, resolving to <b>G</b> (a G or G7 chord) in bar 2, and to <b>C minor</b> in bar 3.</p>`,
          starter: `voice comp = <{f3 ab3 c4 eb4} {g2 b3 d4 g4} {c3 c4 eb4 g4}>`,
          solution: `voice comp = <{ab2 c4 eb4 f#4} {g2 b3 d4 g4} {c3 c4 eb4 g4}>`,
          bars: 3,
          check: (_s, n) => {
            const m = need(n, "comp"); if (m) return m;
            const c = barChords(n, "comp", 3);
            if (!c[0] || !isChord(c[0], 8, "7") ) return `Bar 1 should hold Ab, C, Eb and F# (you have ${c[0] ? nms(c[0]) : "nothing"}).`;
            if (c[0][0] % 12 !== 8) return `The German sixth needs Ab in the bass; your lowest note is ${nm(c[0][0])}.`;
            if (!c[1] || !(isChord(c[1], 7, "") || isChord(c[1], 7, "7"))) return "Bar 2 should be G or G7.";
            if (!c[2] || !(isChord(c[2], 0, "m") || isChord(c[2], 0, "m7") || isChord(c[2], 0, "m6"))) return "Bar 3 should be C minor.";
            return null;
          },
        } },
        { quiz: [
          { q: "In C minor, the Neapolitan chord is built on...", options: ["D", "Db", "Ab", "Bb"], answer: 1 },
          { q: "Which augmented sixth chord sounds identical to a dominant seventh?", options: ["Italian", "French", "German"], answer: 2 },
          { q: "The augmented sixth (Ab up to F#) resolves...", options: ["inward to a unison", "outward to an octave", "up a fourth", "it does not resolve"], answer: 1, explain: "Ab falls to G, F# rises to G." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "tritone", title: "Tritone substitution",
      parts: [
        `<p>A dominant seventh gets its pull from the tritone between its third and seventh. G7 has B and F. The dominant seventh a tritone away, Db7, has F and Cb, and Cb is B. The two chords share the same tritone with the roles swapped. So either one can resolve to C. Using bII7 in place of V7 is a <b>tritone substitution</b>, and the substitute is often written <b>subV7</b>.</p>`,
        { code: `-- the same two guide tones, swapped\nprint(tones(g3@7.guide), tones(db3@7.guide))\nvoice x = [g3@7.guide db3@7.guide]` },
        `<p>The substitution turns a bass line falling by fifths into one falling by half steps: Dm7, Db7, Cmaj7. Listen for the bass.</p>`,
        { code: `tempo 120\nlet plain = changes("Dm7 | G7 | Cmaj7 | %")\nlet subbed = changes("Dm7 | Db7 | Cmaj7 | %")\nlet both = arrange(plain, 4, subbed, 4)\nvoice comp = both.rootless.voicelead\nvoice bass = both.root.octave(-1).inst(upright)`, bars: 8 },
        `<p>The upper notes of the substitute add tension to the original. Db7 over a G bass is G7 with b9, #11 and b13. That is why the substitute often appears as <b>7#11</b>: Db7#11 contains a G. Any dominant can be substituted, including secondary ones, and a ii-V can be substituted as a pair: <b>Abm7 Db7</b> in place of Dm7 G7.</p>`,
        { code: `tempo 130\n-- I VI7 ii V, then every dominant replaced by its substitute\nlet orig = changes("Cmaj7 | A7 | Dm7 | G7")\nlet subs = changes("Cmaj7 | Eb7 | Dm7 | Db7#11")\nlet both = arrange(orig, 4, subs, 4)\nvoice comp = both.rootless.voicelead\nvoice bass = both.root.octave(-1).inst(upright)`, bars: 8 },
        { exercise: {
          task: `<p>Reharmonize <b>Dm7 | G7 | Cmaj7 | Cmaj7</b> with a <b>tritone substitute in bar 2</b>. Write it as <code>voice comp</code>. Any dominant chord on the substitute root counts (7, 9, 7#11, 13...).</p>`,
          starter: `voice comp = changes("Dm7 | G7 | Cmaj7 | %")`,
          solution: `voice comp = changes("Dm7 | Db7#11 | Cmaj7 | %").voicelead`,
          bars: 4,
          check: (_s, n) => {
            const m = need(n, "comp"); if (m) return m;
            const c = barChords(n, "comp", 4);
            if (!c[0] || !isChord(c[0], 2, "m7")) return "Keep Dm7 in bar 1.";
            if (!c[1]) return "Bar 2 is empty.";
            if (!has(c[1], [1, 5, 11])) return `Bar 2 (${nms(c[1])}) should be a dominant chord on Db: Db, F and Cb (B) at least.`;
            if (has(c[1], [7, 2]) && !has(c[1], [1])) return "That still sounds like G7.";
            if (!c[2] || !isChord(c[2], 0, "maj7")) return "Resolve to Cmaj7 in bar 3.";
            return null;
          },
        } },
        { quiz: [
          { q: "What is the tritone substitute for G7?", options: ["C#m7", "Db7", "D7", "F#7"], answer: 1 },
          { q: "Which two notes do G7 and Db7 share?", options: ["G and Db", "B and F", "D and Ab", "C and E"], answer: 1 },
          { q: "Listen. Is bar 2 the dominant (V7) or the tritone substitute (bII7)?", listen: `voice c = changes("Dm7 | Db7 | Cmaj7 | %").rootless.voicelead\nvoice b = changes("Dm7 | Db7 | Cmaj7 | %").root.octave(-1).inst(upright)`, bars: 4, options: ["V7", "bII7"], answer: 1, explain: "The bass slides down by half steps: D, Db, C." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "diminished", title: "Diminished seventh chords",
      parts: [
        `<p>A diminished seventh chord is four notes a minor third apart: B D F Ab. Stack another minor third and you are back at B. Because the chord divides the octave into four equal parts, every inversion is another diminished seventh chord. There are only <b>three</b> different ones.</p>`,
        { code: `print(name(b3@dim7), name(b3@dim7.invert), name(b3@dim7.invert(2)), name(b3@dim7.invert(3)))\nvoice three = [c4@dim7 c#4@dim7 d4@dim7 eb4@dim7]` },
        `<p>vii°7 is V7b9 without its root. B D F Ab is G7b9 minus the G. Since the chord is symmetrical, it is also the top of Bb7b9, Db7b9 and E7b9, so one diminished chord can resolve as a dominant to four different keys. Put a different bass under it and listen.</p>`,
        { code: `voice dim = <b3@dim7 . b3@dim7 . b3@dim7 . b3@dim7 .>.voicelead\nvoice bass = <g2 c2 bb1 eb2 db2 gb1 e2 a1>.inst(upright)\nvoice res = <. c3@maj . eb3@maj . gb3@maj . a3@maj>.voicelead`, bars: 8 },
        `<p>Jazz uses diminished chords in three ways.</p>
         <ul><li><b>As a dominant</b>: vii°7 of a chord, or a rootless 7b9.</li>
         <li><b>Passing</b>: between two chords a whole step apart, a diminished chord on the note in between connects them chromatically. Cmaj7, C#dim7, Dm7 is the most common: the C#dim7 is really A7b9, the V of ii, without its root.</li>
         <li><b>Common-tone</b>: a diminished chord sharing a note with the chord around it, like Cdim7 over a C pedal, a neighbor-chord embellishment.</li></ul>`,
        { code: `tempo 120\n-- passing diminished chords: I, #I dim, ii, #II dim, iii\nlet tune = changes("Cmaj7 C#dim7 | Dm7 D#dim7 | Em7 A7 | Dm7 G7")\nvoice comp = tune.voicelead\nvoice bass = tune.root.octave(-1).inst(upright)`, bars: 4 },
        { code: `-- common-tone diminished: C6, C dim7, C6 over a C pedal\nvoice comp = <c4@6 c4@dim7 c4@6 .>.voicelead\nvoice bass = <c2 c2 c2 .>.inst(upright)`, bars: 4 },
        `<p>The scale for a diminished chord is the <b>whole-half</b> diminished scale (whole step, half step, repeating), eight notes and as symmetrical as the chord. For a 7b9 chord, start the pattern with a half step instead: the <b>half-whole</b> scale. Tine has both, as <code>whole_half</code> and <code>half_whole</code>.</p>`,
        { code: `key g half_whole\nvoice comp = g3@7b9.rootless\nvoice line = [^1 ^2 ^3 ^4 ^5 ^6 ^7 ^8].swing.inst(vibes)` },
        { exercise: {
          task: `<p>Write <code>voice comp</code>: two bars, two chords per bar: <b>Cmaj7</b>, a <b>passing diminished chord</b>, <b>Dm7</b>, <b>G7</b>.</p>`,
          starter: `voice comp = changes("Cmaj7 Am7 | Dm7 G7")`,
          solution: `voice comp = changes("Cmaj7 C#dim7 | Dm7 G7").voicelead`,
          bars: 2,
          hint: "The passing chord sits on the note between C and D.",
          check: (_s, n) => expectChords(n, "comp", [[0, "maj7"], [1, "dim7"], [2, "m7"], [7, "7"]]),
        } },
        { quiz: [
          { q: "How many different diminished seventh chords are there?", options: ["12", "4", "3", "1"], answer: 2 },
          { q: "Bdim7 is G7b9 without which note?", options: ["B", "G", "F", "Ab"], answer: 1 },
          { q: "In Cmaj7, C#dim7, Dm7, the C#dim7 acts like which chord without its root?", options: ["G7b9", "A7b9", "C#7", "Bb7"], answer: 1, explain: "A7b9 is the V of Dm7: A C# E G Bb, minus the A." },
          { q: "Listen. Which chord is the diminished seventh?", listen: `voice c = [c4@maj7 c#4@dim7 d4@m7 g3@7].voicelead`, bars: 1, options: ["The first", "The second", "The third", "The fourth"], answer: 1 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "rhythmchanges", title: "Turnarounds and rhythm changes",
      parts: [
        `<p>A <b>turnaround</b> fills the last two bars of a form, or any spot where the harmony sits on I, and leads back to the top. Every substitution from this unit applies to it, and jazz musicians swap among them freely.</p>
         <table class="t"><tr><th>turnaround (in C)</th><th>what changed</th></tr>
         <tr><td>Cmaj7 Am7 | Dm7 G7</td><td>I vi ii V, diatonic</td></tr>
         <tr><td>Cmaj7 A7 | Dm7 G7</td><td>vi becomes V7/ii</td></tr>
         <tr><td>Em7 A7 | Dm7 G7</td><td>I replaced by iii</td></tr>
         <tr><td>Cmaj7 C#dim7 | Dm7 G7</td><td>passing diminished (A7b9 without its root)</td></tr>
         <tr><td>Cmaj7 Eb7 | Abmaj7 Db7</td><td>tritone substitutes and borrowed bVI</td></tr></table>`,
        { code: `tempo 140\nlet t1 = changes("Cmaj7 Am7 | Dm7 G7")\nlet t2 = changes("Cmaj7 A7 | Dm7 G7")\nlet t3 = changes("Em7 A7 | Dm7 G7")\nlet t4 = changes("Cmaj7 C#dim7 | Dm7 G7")\nlet t5 = changes("Cmaj7 Eb7 | Abmaj7 Db7")\nlet all = arrange(t1, 2, t2, 2, t3, 2, t4, 2, t5, 2)\nvoice comp = all.rootless.voicelead\nvoice bass = all.root.octave(-1).inst(upright)`, bars: 10 },
        `<p><b>Rhythm changes</b> are the chords of Gershwin's "I Got Rhythm", reused for hundreds of bebop tunes. The form is AABA in Bb. The A sections are turnarounds strung together, with a quick move to IV in the middle. The bridge is a chain of extended dominants, each lasting two bars: <b>D7, G7, C7, F7</b>, the V of the V of the V of the V. Players learn it as the second form after the blues.</p>`,
        { code: `tempo 200\nsection main 8\n  let h = changes("Bb6 G7 | Cm7 F7 | Dm7 G7 | Cm7 F7 | Fm7 Bb7 | Ebmaj7 Ab7 | Dm7 G7 | Cm7 F7")\n  voice comp = h.rootless.voicelead.vel(.55)\n  voice bass = h.root.octave(-1).inst(upright)\nsection bridge 8\n  let h = changes("D7 | % | G7 | % | C7 | % | F7 | %")\n  voice comp = h.rootless.voicelead.vel(.55)\n  voice bass = h.root.octave(-1).inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.4)\nvoice hat = [. pedal . pedal].vel(.5)\nform main main bridge main` },
        `<p>The bridge is also a place to practice substitution. Replace every other dominant with its tritone substitute, or put a related ii in front of each one (Am7 D7, Dm7 G7, Gm7 C7, Cm7 F7), and the bridge turns into a string of ii-Vs.</p>`,
        { exercise: {
          task: `<p>Write <code>voice comp</code>: the <b>rhythm-changes bridge in Bb</b>, eight bars, a dominant seventh chord every two bars, each the V of the next, ending on F7.</p>`,
          starter: `voice comp = changes("D7 | % | G7 | %")`,
          solution: `voice comp = changes("D7 | % | G7 | % | C7 | % | F7 | %").rootless.voicelead`,
          bars: 8,
          check: (_s, n) => {
            const m = need(n, "comp"); if (m) return m;
            const c = barChords(n, "comp", 8), roots = [2, 2, 7, 7, 0, 0, 5, 5];
            for (let b = 0; b < 8; b++) {
              const ch = c[b];
              if (!ch) return `Bar ${b + 1} has no chord.`;
              const r = roots[b];
              if (!has(ch, [(r + 4) % 12, (r + 10) % 12])) return `Bar ${b + 1} should be ${nm(r)}7 (it needs ${nm(r + 4)} and ${nm(r + 10)}); you have ${nms(ch)}.`;
            }
            return null;
          },
        } },
        { quiz: [
          { q: "The rhythm-changes bridge chords D7 G7 C7 F7 are related how?", options: ["Each is the V of the next", "Each is a tritone from the next", "They are all diatonic to Bb", "They are borrowed from Bb minor"], answer: 0 },
          { q: "In a I #I°7 ii V turnaround, the #I°7 replaces...", options: ["I", "vi (as VI7b9 without its root)", "ii", "V"], answer: 1 },
          { q: "Listen. Which turnaround is this?", listen: `voice c = changes("Cmaj7 Eb7 | Abmaj7 Db7").rootless.voicelead\nvoice b = changes("Cmaj7 Eb7 | Abmaj7 Db7").root.octave(-1).inst(upright)`, bars: 2, options: ["I vi ii V", "I VI7 ii V", "I bIII7 bVI bII7", "iii VI7 ii V"], answer: 2, explain: "Every root after the first is a tritone sub or a borrowed chord: the bass falls C, Eb, Ab, Db." },
        ] },
      ],
    },
  ],
};
void of; void inBar; void groups;
