// Unit 1, Theory 101: the raw materials. Pitch, time, swing, scales, intervals, chords, diatonic harmony.
import type { Unit } from "./types";
import { of, groups, line, r3, expectChords, need, inBar, pcset, nms } from "./check";

export const UNIT1: Unit = {
  id: "u1", code: "Theory 101", title: "Fundamentals",
  blurb: "Pitch, rhythm and swing, the major and minor scales, intervals, triads and seventh chords, and the chords that live inside a key.",
  lessons: [
    // ------------------------------------------------------------------
    {
      id: "pitch", title: "Pitch, octaves and half steps",
      parts: [
        `<p>A pitch is a frequency. When one note vibrates exactly twice as fast as another, the two sound like the same note in a different register. That distance is the <b>octave</b>, and every musical system on earth treats it as special.</p>
         <p>Western music divides the octave into twelve equal steps called <b>half steps</b> (or semitones). A piano shows them plainly: twelve keys, seven white and five black, then the pattern repeats. Two half steps make a <b>whole step</b>.</p>
         <p>In Tine a note is a letter, an optional accidental (<code>#</code> sharp, <code>b</code> flat) and an octave number. <code>c4</code> is middle C. Here is every half step from middle C up to the B above it, the <b>chromatic scale</b>.</p>`,
        { code: `voice chromatic = [c4 c#4 d4 eb4 e4 f4 f#4 g4 ab4 a4 bb4 b4]` },
        `<p>Underneath, Tine numbers pitches the way MIDI does. Middle C is 60, and each half step adds one. So <code>c4 + 2</code> is D, a whole step up, and <code>c4 + 12</code> is the C an octave higher. The <code>hz</code> function shows the frequency. Notice the octave doubling.</p>`,
        { code: `print(hz(a3), hz(a4), hz(a5))\nvoice octaves = [a3 a4 a5 .]` },
        `<p><b>Enharmonic</b> notes share a key but not a name. C# and Db are the same piano key. In written music they mean different things: C# is a raised C, Db a lowered D, and theory cares which one a chord "really" contains. Tine works in sounding pitch, so <code>c#4 == db4</code> is true. When spelling changes the meaning of something, this course will say so.</p>
         <p>You can do arithmetic with pitches. Parentheses let an expression sit inside a phrase.</p>`,
        { code: `-- whole, whole, half: the first four notes of a major scale\nvoice steps = [c4 (c4 + 2) (c4 + 4) (c4 + 5)]` },
        { exercise: {
          task: `<p>Write <code>voice tune</code> that climbs from D4 to D5 using <b>only whole steps</b>. (You will need seven notes. This six-note-per-octave pattern is the <b>whole-tone scale</b>, a favorite of Debussy and Thelonious Monk.)</p>`,
          starter: `voice tune = [d4 e4]`,
          solution: `voice tune = [d4 e4 f#4 g#4 a#4 c5 d5]`,
          hint: `Count up by 2 from D: D, E, F#, G#, A#, C, D. Or write <code>d4 (d4 + 2) (d4 + 4)</code> and so on.`,
          check: (_s, n) => {
            const m = need(n, "tune"); if (m) return m;
            const l = line(n, "tune");
            if (l[0] !== 62) return `Start on D4 (yours starts on ${nms([l[0]])}).`;
            for (let i = 1; i < l.length; i++) if (l[i] - l[i - 1] !== 2) return `Note ${i + 1} is ${l[i] - l[i - 1]} half steps from the one before; every step should be 2.`;
            return l[l.length - 1] === 74 ? null : `End on D5; you stopped at ${nms([l[l.length - 1]])}.`;
          },
        } },
        { quiz: [
          { q: "How many half steps are in an octave?", options: ["7", "8", "12", "10"], answer: 2, explain: "Twelve. Seven of them are the white keys of a major scale." },
          { q: "Which pair is enharmonic?", options: ["C# and Db", "E and F#", "B and Bb", "G and Ab"], answer: 0, explain: "Same key, different names." },
          { q: "Listen. How far apart are the two notes?", listen: `voice x = [a4 _ a3 _]`, options: ["A half step", "A whole step", "An octave", "They are the same note"], answer: 2, explain: "A4 then A3: the same letter, half the frequency." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "rhythm", title: "Beat, meter and rhythm",
      parts: [
        `<p>The <b>beat</b> is the pulse you tap your foot to. <b>Tempo</b> is how fast it goes, in beats per minute. <b>Meter</b> groups beats into bars. A time signature names the meter: the top number counts beats in a bar, the bottom says which note value gets the beat. In 4/4 there are four quarter-note beats per bar.</p>
         <p>In Tine one bar is one phrase. A phrase divides the bar into equal steps, so the number of steps decides the note values: four steps are quarter notes, eight are eighths, sixteen are sixteenths.</p>`,
        { code: `tempo 100\nvoice quarters  = [c5 c5 c5 c5]\nvoice eighths   = [g4 g4 g4 g4 g4 g4 g4 g4]\nvoice sixteenth = [hat*16]` },
        `<p>A rest is <code>.</code> and a hold is <code>_</code>. Holds make longer notes. A half note is one step plus a hold in a four-step bar; a whole note fills the bar.</p>`,
        { code: `voice whole   = [c4 _ _ _]\nvoice halves  = [e4 _ g4 _]\nvoice quarter = [c5 . c5 .]` },
        `<p>A <b>dot</b> adds half a note's value: a dotted quarter lasts three eighths. In Tine a weight says how many steps a note takes, so <code>c:3</code> in an eight-step bar is a dotted quarter. <b>Triplets</b> squeeze three notes into the space of two: nest a phrase inside one step.</p>`,
        { code: `-- dotted quarter, eighth, quarter, quarter (in eighths: 3 + 1 + 2 + 2)\nvoice dotted = [c4:3 d4 e4:2 g4:2]\n-- a quarter-note triplet on beats 3 and 4\nvoice trip = [c5 c5 [e5 d5 c5]:2]` },
        `<p><b>Simple meters</b> split the beat in two (2/4, 3/4, 4/4). <b>Compound meters</b> split it in three: 6/8 has two beats, each a dotted quarter made of three eighths. Jazz waltzes are in 3/4; a lot of blues and gospel feels like 12/8. Tine's <code>meter</code> line sets this, and <code>tempo</code> counts the bottom number.</p>`,
        { code: `meter 6/8\ntempo 200\nvoice drums = {[kick . . snare . .] [hat*6]}\nvoice tune  = [g4 a4 b4 d5 _ b4]` },
        `<p><b>Syncopation</b> puts emphasis where the beat isn't. The most important syncopation in jazz is the <b>Charleston</b> rhythm: a hit on beat 1 and another on the "and" of 2. Count eighths "1 and 2 and 3 and 4 and": the hits are on "1" and the second "and". Pianists comp with it constantly.</p>`,
        { code: `tempo 120\nvoice clock = [rim . rim . rim . rim .].vel(.4)\nvoice comp  = [c4@maj7 . . c4@maj7 . . . .]` },
        `<p>Another everyday syncopation is the <b>anticipation</b>: a chord arrives on the "and" of 4, an eighth note early, and is tied over the bar line. Players call it a push.</p>`,
        { code: `voice clock = [rim rim rim rim].vel(.3)\nvoice push  = <[c4@6:7 (f4@7).dur(4.5)] [.]>`, bars: 2 },
        { exercise: {
          task: `<p>Write <code>voice comp</code> that plays a chord (any chord) in the Charleston rhythm: on beat 1 and on the "and" of beat 2, in 4/4.</p>`,
          starter: `voice comp = [c4@maj7 . . . . . . .]`,
          solution: `voice comp = [c4@maj7 . . c4@maj7 . . . .]`,
          hint: `In eight steps, beat 1 is step 1 and the "and" of 2 is step 4.`,
          check: (_s, n) => {
            const m = need(n, "comp"); if (m) return m;
            const t = groups(inBar(of(n, "comp"), 0)).map(g => g.t);
            return JSON.stringify(t) === "[0,0.375]" ? null : `Your hits land at ${t.map(x => x * 8 + 1).join(", ")} (counting eighths from 1). The Charleston is 1 and 4.`;
          },
        } },
        { quiz: [
          { q: "How many beats does a bar of 6/8 usually feel like?", options: ["Six", "Two", "Three", "Eight"], answer: 1, explain: "Two dotted-quarter beats, each divided in three. That is what makes it compound." },
          { q: "A dotted quarter note lasts as long as...", options: ["two eighths", "three eighths", "four eighths", "one and a half quarters plus an eighth"], answer: 1, explain: "A quarter (two eighths) plus half of that (one eighth)." },
          { q: "Listen. Is this in three or in four?", listen: `tempo 150\nvoice d = {[kick hat hat] [. ride ride]}\nvoice b = <[c3 _ _] [g2 _ _]>.inst(upright)`, options: ["Three", "Four"], answer: 0, explain: "Boom, chick, chick: a waltz, three beats to the bar." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "swing", title: "Swing",
      parts: [
        `<p>Play eighth notes evenly and you get classical, rock or Latin time. Jazz musicians do something else: they <b>swing</b>. Each beat's first eighth stretches and the second shortens, so a pair of eighths sounds long-short, close to the first and last notes of a triplet. Swing is not written down. Charts are notated in even eighths and everybody knows to swing them.</p>
         <p>Tine's <code>.swing</code> delays every second eighth by a fraction of a step. The default, <code>1/3</code>, gives a 2:1 triplet feel. Listen to the same line straight, then swung.</p>`,
        { code: `tempo 132\nvoice straight = [c5 d5 e5 g5 a5 g5 e5 d5].inst(vibes)`, bars: 1 },
        { code: `tempo 132\nvoice swung = [c5 d5 e5 g5 a5 g5 e5 d5].inst(vibes).swing`, bars: 1 },
        `<p>How much to swing depends on the tempo and the player. As tempos rise, the ratio gets lighter. Some ballads swing hard; bossa nova and many modern tunes play even eighths.</p>
         <table class="t"><tr><th>amount</th><th>long : short</th><th>feel</th></tr>
         <tr><td><code>0</code></td><td>1 : 1</td><td>straight</td></tr>
         <tr><td><code>0.2</code></td><td>3 : 2</td><td>light, fast tempos</td></tr>
         <tr><td><code>1/3</code></td><td>2 : 1</td><td>triplet swing, medium tempos</td></tr>
         <tr><td><code>0.5</code></td><td>3 : 1</td><td>dotted, a shuffle on the edge of stiff</td></tr></table>`,
        `<p>The drummer's ride cymbal sets the swing for everyone. Its classic pattern is "ding, ding-a ding, ding-a": quarter notes, with an extra swung eighth after beats 2 and 4. Under it, the hi-hat pedal closes on 2 and 4, the backbeat of jazz. The bass drum often "feathers" quarter notes so softly you feel them more than hear them.</p>`,
        { code: `tempo 140\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.55)\nvoice hat  = [. pedal . pedal].vel(.6)\nvoice kick = [kick kick kick kick].vel(.18)` },
        `<p>You can also write the triplet directly. These two parts play the same rhythm.</p>`,
        { code: `-- the rim clicks land exactly on the swung ride\nvoice a = [ride [ride ride] ride [ride ride]].swing\nvoice b = [rim [rim . rim] rim [rim . rim]].vel(.5)`, bars: 1 },
        `<p>Put a bass and a pianist on top and you have the sound of a jazz rhythm section. The bass walks quarter notes (unit 2 covers how), and the piano comps in the Charleston rhythm, swung.</p>`,
        { code: `tempo 140\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.5)\nvoice hat  = [. pedal . pedal].vel(.5)\nvoice bass = <[f2 a2 c3 e3] [eb3 c3 a2 f2]>.inst(upright)\nvoice comp = [f3@7 . . f3@7 . . . .].rootless.swing.vel(.5)`, bars: 2 },
        { exercise: {
          task: `<p>Build the drummer's time feel. Write <code>voice ride</code> playing the swung ride pattern ("ding, ding-a ding, ding-a"), and <code>voice hat</code> playing <code>pedal</code> on beats 2 and 4 only.</p>`,
          starter: `voice ride = [ride ride ride ride]\nvoice hat  = [pedal pedal pedal pedal]`,
          solution: `voice ride = [ride [ride ride] ride [ride ride]].swing\nvoice hat  = [. pedal . pedal]`,
          hint: `The ride needs six hits: 1, 2, the swung "a" after 2, 3, 4, and the "a" after 4. Write the eighths, then add <code>.swing</code>.`,
          check: (_s, n) => {
            const m = need(n, "ride") ?? need(n, "hat"); if (m) return m;
            const hat = groups(inBar(of(n, "hat"), 0)).map(g => g.t);
            if (JSON.stringify(hat) !== "[0.25,0.75]") return "The hat should close on beats 2 and 4 only.";
            const ride = groups(inBar(of(n, "ride"), 0)).map(g => g.t);
            const want = [0, 0.25, r3(5 / 12), 0.5, 0.75, r3(11 / 12)];
            if (ride.length !== 6) return `The ride plays ${ride.length} hits per bar; the pattern has 6.`;
            return ride.every((t, i) => Math.abs(t - want[i]) < 0.01) ? null : "Six hits, but the extra ones are not swung onto the last third of beats 2 and 4. Try .swing.";
          },
        } },
        { quiz: [
          { q: "Listen. Straight or swung?", listen: `tempo 120\nvoice x = [c5 e5 g5 a5 g5 e5 d5 c5].inst(vibes).swing\nvoice r = [ride ride ride ride].vel(.4)`, options: ["Straight", "Swung"], answer: 1, explain: "Long-short pairs." },
          { q: "Listen. Straight or swung?", listen: `tempo 120\nvoice x = [c5 e5 g5 a5 g5 e5 d5 c5].inst(vibes)\nvoice r = [ride ride ride ride].vel(.4)`, options: ["Straight", "Swung"], answer: 0, explain: "Even eighths." },
          { q: "On which beats does the hi-hat pedal close in swing time?", options: ["1 and 3", "2 and 4", "Every beat", "Only beat 1"], answer: 1, explain: "Two and four, the backbeat." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "major", title: "The major scale and keys",
      parts: [
        `<p>A <b>scale</b> is a set of notes in order, usually spanning an octave. The <b>major scale</b> uses seven of the twelve, chosen by a pattern of whole (W) and half (H) steps: <b>W W H W W W H</b>. On C that is all white keys.</p>`,
        { code: `voice c_major = [c4 d4 e4 f4 g4 a4 b4 c5]` },
        `<p>The same pattern can start on any note. Starting on G, the pattern needs F# instead of F. Tine lets you write the scale as <b>degrees</b>, numbered positions in whatever key is current: <code>^1</code> is the first note (the tonic), <code>^5</code> the fifth, <code>^8</code> the octave. Change the <code>key</code> line and the scale moves with it.</p>`,
        { code: `key g major\nvoice scale = [^1 ^2 ^3 ^4 ^5 ^6 ^7 ^8]` },
        `<p>Each degree has a name and a job. You will use these words all the way through this course.</p>
         <table class="t"><tr><th>degree</th><th>name</th><th>solfège</th></tr>
         <tr><td>^1</td><td>tonic</td><td>do</td></tr><tr><td>^2</td><td>supertonic</td><td>re</td></tr>
         <tr><td>^3</td><td>mediant</td><td>mi</td></tr><tr><td>^4</td><td>subdominant</td><td>fa</td></tr>
         <tr><td>^5</td><td>dominant</td><td>sol</td></tr><tr><td>^6</td><td>submediant</td><td>la</td></tr>
         <tr><td>^7</td><td>leading tone</td><td>ti</td></tr></table>
         <p>The <b>leading tone</b> is a half step below the tonic and pulls up into it. That half step is why major sounds so settled when it lands on ^1.</p>`,
        `<p>A <b>key signature</b> lists the sharps or flats a key needs. Keys are related by fifths. Go up a perfect fifth (seven half steps) and you add one sharp: C has none, G one, D two, A three, E four, B five, F# six. Go down a fifth and you add a flat: F one, Bb two, Eb three, Ab four, Db five, Gb six. Laid out in a ring, this is the <b>circle of fifths</b>.</p>
         <p>Sharps are added in the order F C G D A E B, flats in the reverse, B E A D G C F. Jazz lives on the flat side. Trumpets, clarinets and tenor saxophones are pitched in Bb, alto and baritone saxes in Eb, so tunes are written in F, Bb, Eb and Ab far more than in E or B.</p>
         <p>This plays the same degree pattern in a new key each bar, walking round the circle of fifths.</p>`,
        { code: `voice circle = per_bar(bar => [^1 ^2 ^3 ^4 ^5 ^6 ^7 ^8].key(at([c4 g3 d4 a3 e4 b3 f#3 db4 ab3 eb4 bb3 f4], bar), major))`, bars: 4 },
        { exercise: {
          task: `<p>Write <code>voice scale</code>: the <b>Eb major</b> scale from Eb4 up to Eb5, using note names (no degrees). Work out the sharps or flats yourself from the W W H W W W H pattern.</p>`,
          starter: `voice scale = [eb4]`,
          solution: `voice scale = [eb4 f4 g4 ab4 bb4 c5 d5 eb5]`,
          hint: `Eb major has three flats: Bb, Eb and Ab.`,
          check: (_s, n) => {
            const m = need(n, "scale"); if (m) return m;
            const l = line(n, "scale"), want = [63, 65, 67, 68, 70, 72, 74, 75];
            if (l.length !== 8) return `That is ${l.length} notes; a scale from Eb to Eb has 8.`;
            const bad = l.findIndex((x, i) => x !== want[i]);
            return bad < 0 ? null : `Note ${bad + 1} is ${nms([l[bad]])}; it should be ${nms([want[bad]])}.`;
          },
        } },
        { quiz: [
          { q: "How many sharps are in the key of E major?", options: ["2", "3", "4", "5"], answer: 2, explain: "C, G, D, A, E: four fifths up, four sharps (F# C# G# D#)." },
          { q: "Which major key has three flats?", options: ["Bb", "Eb", "Ab", "F"], answer: 1, explain: "F (1), Bb (2), Eb (3)." },
          { q: "What is the seventh degree of the major scale called?", options: ["Subtonic", "Submediant", "Leading tone", "Dominant"], answer: 2, explain: "It leads, by half step, to the tonic." },
          { q: "Between which degrees of a major scale are the half steps?", options: ["^2-^3 and ^6-^7", "^3-^4 and ^7-^8", "^1-^2 and ^4-^5", "^4-^5 and ^7-^8"], answer: 1, explain: "W W H W W W H: the half steps come after the third and seventh notes." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "minor", title: "Minor scales and the blues scale",
      parts: [
        `<p>Start a C major scale on its sixth note, A, and you get the <b>natural minor</b> scale: W H W W H W W. A minor and C major share every note and the key signature. They are <b>relative</b> keys. A minor and A major share a tonic but not notes; they are <b>parallel</b> keys.</p>`,
        { code: `voice relative = cat([^1 ^2 ^3 ^4 ^5 ^6 ^7 ^8].key(c4, major), [^1 ^2 ^3 ^4 ^5 ^6 ^7 ^8].key(a3, minor))`, bars: 2 },
        `<p>Natural minor has no leading tone. Its seventh degree sits a whole step below the tonic and doesn't pull. Composers fixed that by raising the seventh, making the <b>harmonic minor</b> scale. The raised seventh leaves a gap of three half steps between ^6 and ^7, an augmented second, which gives harmonic minor its exotic edge.</p>
         <p>Raise the sixth as well and the gap closes: <b>melodic minor</b>. Classical theory uses it only going up and returns to natural minor coming down. Jazz musicians use melodic minor the same way in both directions and treat it as a parent scale as important as major (unit 4). When this course says "melodic minor", it means the jazz version.</p>`,
        { code: `-- natural, harmonic, melodic: one per bar\nvoice three = cat(\n  [^1 ^2 ^3 ^4 ^5 ^6 ^7 ^8].key(a3, minor),\n  [^1 ^2 ^3 ^4 ^5 ^6 ^7 ^8].key(a3, harmonic_minor),\n  [^1 ^2 ^3 ^4 ^5 ^6 ^7 ^8].key(a3, melodic_minor))`, bars: 3 },
        `<p>Two more scales run through all of jazz and blues. The <b>minor pentatonic</b> keeps five notes of natural minor (1, b3, 4, 5, b7). Add the flatted fifth and you have the <b>blues scale</b>, whose b5 is the original "blue note".</p>`,
        { code: `tempo 110\nkey c blues\n-- six notes, so ^7 is already the octave\nvoice riff = cat([^1 ^2 ^3 ^4 ^5 ^6 ^7 .], [^7 ^6 ^5 ^4 ^3 ^2 ^1 .]).swing.inst(vibes)`, bars: 2 },
        `<p>Blues singers and horn players bend the third and seventh to pitches between the piano keys. Tine can play them: <code>+ 50c</code> adds fifty cents, a quarter tone. Here the third slides from a quarter-flat up to major.</p>`,
        { code: `voice bend = [c4 eb4 (e4 - 50c) e4 g4 . . .].inst(lead).swing` },
        { exercise: {
          task: `<p>Write <code>voice scale</code>: <b>A harmonic minor</b>, ascending from A4 to A5, with note names.</p>`,
          starter: `voice scale = [a4 b4 c5 d5 e5 f5 g5 a5]`,
          solution: `voice scale = [a4 b4 c5 d5 e5 f5 g#5 a5]`,
          hint: `Natural minor with one note raised a half step.`,
          check: (_s, n) => {
            const m = need(n, "scale"); if (m) return m;
            const l = line(n, "scale"), want = [69, 71, 72, 74, 76, 77, 80, 81];
            if (l.length !== 8) return `That is ${l.length} notes; you need 8.`;
            const bad = l.findIndex((x, i) => x !== want[i]);
            return bad < 0 ? null : `Note ${bad + 1} is ${nms([l[bad]])}; it should be ${nms([want[bad]])}.`;
          },
        } },
        { quiz: [
          { q: "What is the relative minor of Eb major?", options: ["Eb minor", "C minor", "G minor", "F minor"], answer: 1, explain: "The sixth degree of Eb major is C." },
          { q: "Which degree does harmonic minor raise?", options: ["The third", "The sixth", "The seventh", "The sixth and seventh"], answer: 2, explain: "Melodic minor raises the sixth as well." },
          { q: "Listen. Natural minor or harmonic minor?", listen: `voice x = [^1 ^2 ^3 ^4 ^5 ^6 ^7 ^8].key(d4, harmonic_minor).inst(pluck)`, options: ["Natural minor", "Harmonic minor"], answer: 1, explain: "Hear the wide step up to the leading tone near the top." },
          { q: "Which note turns a minor pentatonic scale into a blues scale?", options: ["b2", "b5", "#5", "major 3rd"], answer: 1, explain: "The flatted fifth." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "intervals", title: "Intervals",
      parts: [
        `<p>An <b>interval</b> is the distance between two notes. Played together it is <b>harmonic</b>, one after the other <b>melodic</b>. Intervals have a <b>number</b> and a <b>quality</b>. The number counts letter names inclusively: C up to E spans C, D, E, so it is a third. The quality refines the size in half steps.</p>
         <table class="t"><tr><th>half steps</th><th>interval</th><th>short</th></tr>
         <tr><td>0</td><td>unison</td><td>P1</td></tr><tr><td>1</td><td>minor 2nd</td><td>m2</td></tr><tr><td>2</td><td>major 2nd</td><td>M2</td></tr>
         <tr><td>3</td><td>minor 3rd</td><td>m3</td></tr><tr><td>4</td><td>major 3rd</td><td>M3</td></tr><tr><td>5</td><td>perfect 4th</td><td>P4</td></tr>
         <tr><td>6</td><td>tritone (augmented 4th or diminished 5th)</td><td>TT</td></tr><tr><td>7</td><td>perfect 5th</td><td>P5</td></tr>
         <tr><td>8</td><td>minor 6th</td><td>m6</td></tr><tr><td>9</td><td>major 6th</td><td>M6</td></tr><tr><td>10</td><td>minor 7th</td><td>m7</td></tr>
         <tr><td>11</td><td>major 7th</td><td>M7</td></tr><tr><td>12</td><td>octave</td><td>P8</td></tr></table>
         <p>Unisons, fourths, fifths and octaves are <b>perfect</b>. Seconds, thirds, sixths and sevenths are <b>major</b> or <b>minor</b>. Any interval can be stretched to <b>augmented</b> or squeezed to <b>diminished</b>. That is a spelling question: C up to F# is an augmented fourth, C up to Gb a diminished fifth, both six half steps. Tine's <code>interval</code> names by size, so it calls both a tritone.</p>`,
        { code: `-- every interval above middle C, as harmonic intervals\nprint(map(run(13), k => interval(c4, c4 + k)))\nvoice up = run(13).map(k => {c4 (c4 + k)})` },
        `<p><b>Consonance</b> and <b>dissonance</b> describe how stable an interval sounds. Octaves, fifths and unisons are perfect consonances; thirds and sixths are imperfect consonances; seconds, sevenths and the tritone are dissonant. The fourth is consonant in melody and treated as dissonant above the bass in classical harmony. Jazz moves the line. Sevenths and ninths are normal colors, and the tritone is the engine of every dominant chord.</p>`,
        { code: `voice consonant = [{c4 g4} {c4 e4} {c4 a4} .]\nvoice dissonant = [{c4 db4} {c4 b4} {c4 f#4} .].late(1)`, bars: 2 },
        `<p><b>Inverting</b> an interval flips its lower note up an octave. The numbers add to nine (a third becomes a sixth) and the half steps add to twelve. Major becomes minor, augmented becomes diminished, and perfect stays perfect. So if you know a minor third (3 half steps), you know a major sixth (9).</p>
         <p>Intervals larger than an octave are <b>compound</b>. A ninth is a second plus an octave, an eleventh a fourth plus an octave, a thirteenth a sixth plus an octave. These are the names of jazz chord extensions: the 9, 11 and 13 in <code>G13</code>.</p>`,
        { code: `print(interval(c4, d5), interval(c4, f5), interval(c4, a5))\nvoice compound = [{c4 d5} {c4 f5} {c4 a5} .]` },
        { exercise: {
          task: `<p>Write <code>voice dyads</code> that plays three harmonic intervals in turn: a <b>major 6th above F4</b>, a <b>minor 7th above G3</b>, and a <b>perfect 4th above Bb3</b>.</p>`,
          starter: `voice dyads = [{f4 f4} {g3 g3} {bb3 bb3}]`,
          solution: `voice dyads = [{f4 d5} {g3 f4} {bb3 eb4}]`,
          hint: `Count half steps: M6 is 9, m7 is 10, P4 is 5. You can also write <code>{f4 (f4 + 9)}</code>.`,
          check: (_s, n) => {
            const m = need(n, "dyads"); if (m) return m;
            const g = groups(of(n, "dyads"));
            const want = [[65, 74], [55, 65], [58, 63]], names = ["M6 above F4", "m7 above G3", "P4 above Bb3"];
            for (let i = 0; i < 3; i++) {
              if (!g[i]) return `I hear ${g.length} intervals; I expected 3.`;
              if (JSON.stringify(g[i].semis) !== JSON.stringify(want[i])) return `Interval ${i + 1} is ${nms(g[i].semis)}; a ${names[i]} is ${nms(want[i])}.`;
            }
            return null;
          },
        } },
        { quiz: [
          { q: "Listen. Name the interval.", listen: `voice x = [{c4 g4} _ _ .]`, options: ["Major 3rd", "Perfect 4th", "Perfect 5th", "Major 6th"], answer: 2, explain: "Open and hollow: the fifth." },
          { q: "Listen. Name the interval.", listen: `voice x = [{d4 f#4} _ _ .]`, options: ["Minor 3rd", "Major 3rd", "Perfect 4th", "Tritone"], answer: 1, explain: "Bright and sweet." },
          { q: "Listen. Name the interval.", listen: `voice x = [{f4 b4} _ _ .]`, options: ["Perfect 4th", "Tritone", "Perfect 5th", "Minor 6th"], answer: 1, explain: "Three whole steps: restless, the sound inside every dominant seventh." },
          { q: "A major 3rd inverts to a...", options: ["minor 6th", "major 6th", "minor 3rd", "perfect 5th"], answer: 0, explain: "3 + 6 = 9, and major flips to minor. 4 + 8 = 12 half steps." },
          { q: "Which interval is the same size as a major 9th?", options: ["A major 2nd plus an octave", "A minor 2nd plus an octave", "A perfect 4th plus an octave", "A major 6th plus an octave"], answer: 0, explain: "Fourteen half steps." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "triads", title: "Triads and inversions",
      parts: [
        `<p>Stack two thirds and you have a <b>triad</b>: a <b>root</b>, a <b>third</b> above it and a <b>fifth</b> above that. The two thirds can each be major or minor, which gives four qualities.</p>
         <table class="t"><tr><th>quality</th><th>thirds</th><th>on C</th><th>symbol</th></tr>
         <tr><td>major</td><td>M3 + m3</td><td>C E G</td><td>C</td></tr><tr><td>minor</td><td>m3 + M3</td><td>C Eb G</td><td>Cm, C-</td></tr>
         <tr><td>diminished</td><td>m3 + m3</td><td>C Eb Gb</td><td>Cdim, C°</td></tr><tr><td>augmented</td><td>M3 + M3</td><td>C E G#</td><td>Caug, C+</td></tr></table>
         <p>In Tine a chord is notes in braces, or a root, <code>@</code>, and a quality.</p>`,
        { code: `print(name(c4@maj), name(c4@m), name(c4@dim), name(c4@aug))\nvoice four = [c4@maj c4@m c4@dim c4@aug]` },
        `<p>A triad is in <b>root position</b> when its root is the lowest note. With the third in the bass it is in <b>first inversion</b>; with the fifth in the bass, <b>second inversion</b>. Chord symbols show an inversion with a slash, <code>C/E</code>. Classical theory uses figured bass, the intervals above the bass: no figure (5/3) for root position, <b>6</b> for first inversion, <b>6/4</b> for second. <code>.invert</code> moves the lowest notes up an octave, and <code>name</code> reads a chord back as a symbol.</p>`,
        { code: `print(name({e4 g4 c5}), name({g3 c4 e4}))\nvoice inv = [c4@maj c4@maj.invert c4@maj.invert(2) .]` },
        `<p>The notes can also be spread out. Close position packs them within an octave; open position spaces them wider. All of these are C major. The quality comes from the notes present, and the inversion from the bass.</p>`,
        { code: `voice spacing = [{c4 e4 g4} {c3 g3 e4} {c3 e4 g4 c5} {e3 c4 g4}]` },
        { exercise: {
          task: `<p>Write <code>voice triads</code> that plays a <b>D major</b>, <b>D minor</b>, <b>D diminished</b> and <b>D augmented</b> triad, one per beat.</p>`,
          starter: `voice triads = [d4@maj]`,
          solution: `voice triads = [d4@maj d4@m d4@dim d4@aug]`,
          check: (_s, n) => expectChords(n, "triads", [[2, ""], [2, "m"], [2, "dim"], [2, "aug"]]),
        } },
        { exercise: {
          task: `<p>Write <code>voice inversions</code>: an <b>F major</b> triad in first inversion, then in second inversion.</p>`,
          starter: `voice inversions = [f4@maj f4@maj]`,
          solution: `voice inversions = [f4@maj.invert f4@maj.invert(2)]`,
          hint: `First inversion has A in the bass, second inversion has C in the bass.`,
          check: (_s, n) => {
            const r = expectChords(n, "inversions", [[5, ""], [5, ""]]); if (r) return r;
            const g = groups(of(n, "inversions"));
            if (g[0].semis[0] % 12 !== 9) return `The first chord's lowest note should be A (it is ${nms([g[0].semis[0]])}).`;
            if (g[1].semis[0] % 12 !== 0) return `The second chord's lowest note should be C (it is ${nms([g[1].semis[0]])}).`;
            return null;
          },
        } },
        { quiz: [
          { q: "Which triad is made of two minor thirds?", options: ["Major", "Minor", "Diminished", "Augmented"], answer: 2, explain: "C Eb Gb: a diminished fifth from root to top." },
          { q: "The figured-bass symbol 6/4 means...", options: ["root position", "first inversion", "second inversion", "a sixth chord"], answer: 2, explain: "A sixth and a fourth above the bass, so the fifth of the chord is in the bass." },
          { q: "Listen. Major or minor?", listen: `voice x = [a3@m _ _ .].inst(keys)`, options: ["Major", "Minor"], answer: 1, explain: "A C E." },
          { q: "Listen. Augmented or diminished?", listen: `voice x = [{c4 e4 g#4} _ _ .].inst(keys)`, options: ["Augmented", "Diminished"], answer: 0, explain: "Two major thirds: it sounds like it is floating upward." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "sevenths", title: "Seventh chords",
      parts: [
        `<p>Add one more third on top of a triad and you get a <b>seventh chord</b>. In classical music a seventh is a dissonance that has to resolve. In jazz the seventh chord is the basic unit, and a plain triad sounds bare. Five types cover nearly everything.</p>
         <table class="t"><tr><th>name</th><th>triad + 7th</th><th>on C</th><th>symbols</th></tr>
         <tr><td>major seventh</td><td>major + M7</td><td>C E G B</td><td>Cmaj7, CΔ7</td></tr>
         <tr><td>dominant seventh</td><td>major + m7</td><td>C E G Bb</td><td>C7</td></tr>
         <tr><td>minor seventh</td><td>minor + m7</td><td>C Eb G Bb</td><td>Cm7, C-7</td></tr>
         <tr><td>half-diminished</td><td>diminished + m7</td><td>C Eb Gb Bb</td><td>Cm7b5, Cø7</td></tr>
         <tr><td>diminished seventh</td><td>diminished + d7</td><td>C Eb Gb Bbb(A)</td><td>Cdim7, C°7</td></tr></table>`,
        { code: `print(name([c4@maj7 c4@7 c4@m7 c4@m7b5 c4@dim7]))\nvoice five = [c4@maj7 c4@7 c4@m7 c4@m7b5 c4@dim7 . . .]` },
        `<p>Listen for what each one does. The major seventh is restful and glowing, a tonic chord. The dominant seventh has a tritone between its third and seventh, and it wants to move. The minor seventh is mellow and stable. The half-diminished is dark and leans forward. The diminished seventh is made only of minor thirds, so it is symmetrical and ambiguous (lesson 25).</p>
         <p>Two more are common in jazz: the <b>minor-major seventh</b> (<code>c4@mmaj7</code>, minor triad with a major seventh, the sound of a spy film) and the <b>sixth chord</b> (<code>c4@6</code>, a triad plus a major sixth), which swing-era players used as a tonic in place of maj7.</p>`,
        { code: `voice more = [c4@mmaj7 _ c4@6 _ c4@m6 _ . .]` },
        `<p>Seventh chords have three inversions. Figured bass names them 7 (root position), 6/5 (third in the bass), 4/3 (fifth in the bass) and 4/2 (seventh in the bass). The 4/2 chord is useful: its bass, the seventh, wants to step down.</p>`,
        { code: `voice g7 = [g3@7 g3@7.invert g3@7.invert(2) g3@7.invert(3)]` },
        { exercise: {
          task: `<p>Write <code>voice sevenths</code> that plays <b>G7</b>, <b>Gm7</b>, <b>Gmaj7</b> and <b>Gm7b5</b>, one per beat.</p>`,
          starter: `voice sevenths = [g3@7]`,
          solution: `voice sevenths = [g3@7 g3@m7 g3@maj7 g3@m7b5]`,
          check: (_s, n) => expectChords(n, "sevenths", [[7, "7"], [7, "m7"], [7, "maj7"], [7, "m7b5"]]),
        } },
        { quiz: [
          { q: "A diminished triad plus a minor seventh is a...", options: ["diminished seventh", "half-diminished seventh", "minor seventh", "dominant seventh"], answer: 1, explain: "m7b5. The fully diminished chord has a diminished (not minor) seventh." },
          { q: "Listen. Dominant seventh or major seventh?", listen: `voice x = [f3@7 _ _ .].inst(keys)`, options: ["Dominant seventh", "Major seventh"], answer: 0, explain: "The tritone between A and Eb makes it want to move." },
          { q: "Listen. Minor seventh or half-diminished?", listen: `voice x = [b3@m7b5 _ _ .].inst(keys)`, options: ["Minor seventh", "Half-diminished"], answer: 1, explain: "The lowered fifth darkens it." },
          { q: "Which interval lies between the third and the seventh of a dominant seventh chord?", options: ["Perfect 5th", "Tritone", "Minor 6th", "Major 6th"], answer: 1, explain: "In G7, B up to F. It drives the resolution to C." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "diatonic", title: "Diatonic chords and Roman numerals",
      parts: [
        `<p>Build a triad on each note of a scale, using only notes from that scale, and you get the key's <b>diatonic</b> chords. In major the qualities always fall the same way. Roman numerals name them: upper case for major, lower case for minor, ° for diminished.</p>
         <p style="text-align:center"><b>I &nbsp; ii &nbsp; iii &nbsp; IV &nbsp; V &nbsp; vi &nbsp; vii°</b></p>
         <p>Tine builds diatonic chords from degrees. On a degree, <code>@3</code> counts out a triad and <code>@7</code> a seventh chord using only notes of the current key, the way a musician says "five seven".</p>`,
        { code: `key c major\nprint(name([^1@3 ^2@3 ^3@3 ^4@3 ^5@3 ^6@3 ^7@3]))\nvoice triads = [^1@3 ^2@3 ^3@3 ^4@3 ^5@3 ^6@3 ^7@3 ^8@3]` },
        `<p>With sevenths the pattern is <b>Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7</b>. Only one chord in a major key is a dominant seventh, and it sits on ^5. Its third is the leading tone and its seventh is ^4, a tritone apart, and both want to resolve: ^7 up to ^1, ^4 down to ^3. That tritone over a root a fifth above the tonic is the strongest pull in tonal music. The viiø7 holds the same tritone, which is why it can stand in for V.</p>`,
        { code: `key bb major\nprint(name([^1@7 ^2@7 ^3@7 ^4@7 ^5@7 ^6@7 ^7@7]))\nvoice sevenths = [^1@7 ^2@7 ^3@7 ^4@7 ^5@7 ^6@7 ^7@7 ^8@7].voicelead` },
        `<p>Because these are degrees, the same code works in every key. Change <code>key bb major</code> to <code>key e major</code> above and play it again. A progression written in numerals is portable. Jazz musicians think this way: a "two-five-one" is the same idea in any key.</p>
         <p>Minor keys borrow the raised seventh from harmonic minor to get a real dominant: <b>i iiø7 III+ iv V7 VI vii°7</b> (the augmented III is rarely used). In jazz, the minor tonic is usually <code>m6</code> or <code>mmaj7</code> rather than m7, for the same reason: a raised sixth or seventh points at the tonic.</p>`,
        { code: `key c harmonic_minor\nprint(name([^1@7 ^2@7 ^4@7 ^5@7 ^6@7 ^7@7]))\nvoice minor = [^1@7 ^2@7 ^4@7 ^5@7 ^6@7 ^7@7 ^1@m6 .].voicelead` },
        { exercise: {
          task: `<p>In <b>F major</b>, write <code>voice prog</code> playing the diatonic seventh chords on <b>ii</b>, <b>V</b> and <b>I</b>, in that order (one per beat is fine).</p>`,
          starter: `key f major\nvoice prog = [^1@7]`,
          solution: `key f major\nvoice prog = [^2@7 ^5@7 ^1@7 .]`,
          hint: `In F major these are Gm7, C7 and Fmaj7.`,
          check: (_s, n) => expectChords(n, "prog", [[7, "m7"], [0, "7"], [5, "maj7"]]),
        } },
        { quiz: [
          { q: "In a major key, what quality is the seventh chord on iii?", options: ["Major seventh", "Minor seventh", "Dominant seventh", "Half-diminished"], answer: 1 },
          { q: "In a major key, the seventh chord on vii is...", options: ["diminished seventh", "half-diminished", "minor seventh", "dominant seventh"], answer: 1, explain: "B D F A in C: a diminished triad with a minor seventh." },
          { q: "In G major, Am7 is which chord?", options: ["vi7", "ii7", "iii7", "IV7"], answer: 1, explain: "A is the second degree of G." },
          { q: "What does a minor key change to get a dominant seventh on V?", options: ["Raises ^3", "Raises ^7", "Lowers ^2", "Raises ^4"], answer: 1, explain: "The leading tone becomes the third of V." },
        ] },
      ],
    },
  ],
};
void pcset;
