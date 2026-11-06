// Unit 0, Theory 100: for someone who has never read music or written code.
// Sound, the keyboard, the beat, note lengths, playing together, reading and fixing code.
// Every idea is heard before it is named (see docs/COURSE-PEDAGOGY.md).
import type { Unit } from "./types";
import { of, groups, line, inBar, need, r3, nms, sameSet } from "./check";

const octaveName = (s: number) => `${nms([s])}${Math.floor(s / 12) - 1}`;

export const UNIT0: Unit = {
  id: "u0", code: "Theory 100", title: "Starting from zero",
  blurb: "For anyone who has never read music or written code. What a note is, how the keyboard is laid out, how to count a beat, long and short notes, playing more than one thing at once, and how to read and fix the code on these pages.",
  lessons: [
    // ------------------------------------------------------------------
    {
      id: "start", title: "Press play",
      parts: [
        `<p>This course teaches music theory: the names musicians give to what they hear, and the patterns behind them. You do not need to read music, play an instrument or know how to program. Every idea comes with a few lines of code that make sound. You change the code and hear what changes.</p>
         <p>Press <b>▶ play</b> under the box below. Browsers stay silent until you click something on the page, so the first press can take a moment.</p>`,
        { code: `voice hello = [c4 e4 g4 c5]` },
        `<p>Four notes, each higher than the last, over and over until you press <b>■</b>. The picture under the code is a <b>piano roll</b>: time runs left to right, higher notes sit higher up, and the moving line shows where the music is.</p>
         <p>Here is what the line says:</p>
         <ul><li><code>voice</code> means "here is a part to play". A piece can have many voices, the way a band has many players.</li>
         <li><code>hello</code> is a name for this voice. Most single words work; lesson 0.6 covers the few that do not.</li>
         <li><code>=</code> means "plays this".</li>
         <li><code>[c4 e4 g4 c5]</code> is the music: four notes inside square brackets. The brackets hold one <b>bar</b>, a short stretch of time (two seconds here), and the notes share it equally.</li></ul>`,
        `<p>Before you play the next one, guess: will it go up or down? Then press play and find out. You can change any example: click in the code, edit it, and play again (or press <kbd>Ctrl</kbd>+<kbd>Enter</kbd>, <kbd>Cmd</kbd>+<kbd>Enter</kbd> on a Mac). You cannot break anything: <b>reset</b> puts the example back.</p>`,
        { code: `-- guess first: up or down?\n-- Then change e4 to a4: now the tune goes down, up, down.\nvoice hello = [c5 g4 e4 c4]` },
        `<p>The notes share the bar equally, so more notes means shorter notes. These eight fit in the same two seconds as the four above. Delete four of them and listen: the others get longer.</p>`,
        { code: `-- eight steps in one bar (seven notes, then a silence): each is half as long as before\nvoice hello = [c4 e4 g4 c5 g4 e4 c4 .]` },
        `<p>That <code>.</code> at the end is a moment of silence. You will meet it properly in lesson 0.3. A line that starts with <code>--</code> is a <b>comment</b>: Tine skips it, and it is there for the person reading.</p>
         <p>Each lesson ends with a <b>challenge</b> and a few <b>quiz</b> questions. A challenge gives you a task and a box to write in. Press <b>check</b> and the page listens to what your code plays and tells you what is right and what is not. <b>Hint</b> gives a nudge and <b>show answer</b> shows one solution. Any code that plays the right music passes, even if it looks different from the answer.</p>
         <p>If anything is unclear, use <b>Ask about this lesson</b> at the bottom of the page. Ask in plain words. The answer knows which lesson you are on and what code you have written.</p>
         <p>The course leans toward jazz. From lesson 0.3 you will snap on 2 and 4 with a ride cymbal, and from 0.5 you will hear an upright bass.</p>`,
        { code: `-- the ride cymbal: the sound of jazz drums. Lesson 0.3 explains its pattern.\nvoice ride = [ride [ride . ride] ride [ride . ride]].vel(.6)\nvoice hello = [c4 e4 g4 c5]` },
        { code: `-- Change g4 to . (a dot) and hear a gap where it was.\nvoice hello = [c4 e4 g4 c5]` },
        { exercise: {
          task: `<p>Write a voice called <code>first</code> that plays exactly four notes. Any four notes are fine. Use letters from <code>a</code> to <code>g</code>, each followed by the number 4, like <code>d4</code>.</p>`,
          starter: `voice first = [c4 c4]`,
          solution: `voice first = [c4 e4 d4 g4]`,
          hint: `Put four notes inside the brackets with a space between each one, like <code>[c4 d4 e4 f4]</code>.`,
          check: (_s, n) => {
            const m = need(n, "first"); if (m) return m;
            const k = inBar(of(n, "first"), 0).length;
            return k === 4 ? null : `Your voice plays ${k} note${k === 1 ? "" : "s"} in each bar. The task asks for 4.`;
          },
        } },
        { quiz: [
          { q: "Listen. Does this tune go up or down?", listen: `voice x = [c5 a4 f4 d4]`, options: ["Up", "Down"], answer: 1, explain: "Each note is lower than the one before." },
          { q: "Listen. How many notes are in each bar?", listen: `voice x = [c4 e4 g4]`, options: ["Two", "Three", "Four"], answer: 1 },
          { q: "In the piano roll, where are the higher notes?", options: ["Further left", "Further right", "Higher up", "Lower down"], answer: 2, explain: "Up is higher in pitch. Left to right is time." },
          { q: "Listen. Which bar has the shorter notes?", listen: `voice x = <[c4 e4 g4 c5] [c4 e4 g4 c5 g4 e4 c4 e4]>`, bars: 2, options: ["The first", "The second"], answer: 1, explain: "Eight notes share the second bar, so each is half as long." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "keyboard", title: "The keyboard and note names",
      parts: [
        `<p>Play this and listen to the two notes.</p>`,
        { code: `-- two notes, both called A. Change a4 to a5: still an A, one octave higher again.\nvoice two = [a3 a4]` },
        `<p>The second note is higher, yet the two sound strangely alike, almost like the same note sung by a man and then a child. They share a name, <b>A</b>. The distance between them is an <b>octave</b>.</p>
         <p>How high a note sounds is its <b>pitch</b>, and pitch comes from how fast something vibrates. The higher A you heard vibrates 440 times a second. The lower A vibrates exactly half as fast, 220 times a second. That 2 to 1 ratio is why the two blend so well.</p>`,
        `<p>The piano keyboard repeats a pattern of seven white keys and five black keys from bottom to top. The white keys are named with seven letters, <b>A B C D E F G</b>, and after G the letters start again at A. Here are the white keys from the note called <b>middle C</b> up to the next C.</p>`,
        { code: `-- the white keys from middle C up. Add d5 e5 at the end: the names start over.\nvoice white = [c4 d4 e4 f4 g4 a4 b4 c5]` },
        `<p>Tine names every key with its letter and an <b>octave number</b>. Middle C is <code>c4</code>. To find C on a real keyboard, look at the black keys: they come in groups of two and three, and C is the white key just left of each group of two.</p>
         <p>Note that <b>the octave number goes up at C, not at A</b>. The A and B just above middle C are <code>a4</code> and <code>b4</code>, and the next C is <code>c5</code>. The B just below middle C is <code>b3</code>.</p>`,
        { code: `-- across middle C: b3 is just below it, d4 just above\nvoice across = [a3 b3 c4 d4]` },
        `<p>Now the black keys. Here are the five between middle C and the C above.</p>`,
        { code: `-- the five black keys between c4 and c5.\n-- Change eb4 to d#4: the same key under its other name, so it sounds the same.\nvoice black = [c#4 eb4 f#4 ab4 bb4 .]` },
        `<p>Each black key is named after a white key beside it. A <b>sharp</b>, written <code>#</code>, means the key just above. A <b>flat</b>, written <code>b</code> after the letter, means the key just below. The black key between C and D is <code>c#4</code> ("C sharp") and also <code>db4</code> ("D flat"): two names for one key. <code>bb4</code> is B flat: the letter B, then the flat sign b. Jazz musicians mostly use the flat names (Bb, Eb, Ab). Trumpets and saxophones are built in Bb and Eb, so many jazz tunes sit in those keys.</p>`,
        { code: `-- two pairs of notes. Which pair sounds tighter?\n-- Then put b3 c4 in place of e4 f4: just as tight, because no black key sits between B and C.\nvoice steps = [c4 d4 . . e4 f4 . .]` },
        `<p>The second pair is tighter. The distance from one key to the very next, black or white, is a <b>half step</b>. Two half steps make a <b>whole step</b>. C to D is a whole step, because C# sits between them. E to F is a half step, because there is no black key between E and F. B to C is a half step for the same reason.</p>`,
        { exercise: {
          task: `<p>Write <code>voice down</code> that plays the white keys going <b>down</b> from C5 to C4: eight notes in one bar, highest first.</p>`,
          starter: `voice down = [c5]`,
          solution: `voice down = [c5 b4 a4 g4 f4 e4 d4 c4]`,
          hint: `Going down from C5 the letters run backwards: C, B, A, G, F, E, D, C. The number changes only when you pass C, so every note after C5 is in octave 4.`,
          check: (_s, n) => {
            const m = need(n, "down"); if (m) return m;
            const want = [72, 71, 69, 67, 65, 64, 62, 60], l = line(n, "down").slice(0, 8);
            if (JSON.stringify(l) === JSON.stringify([...want].reverse())) return "Your notes go up. Start on C5 and go down to C4.";
            for (let i = 0; i < want.length; i++) {
              if (l[i] === undefined) return `I hear ${l.length} note${l.length === 1 ? "" : "s"}; there should be 8.`;
              if (line(n, "down").length > 8) return `I hear ${line(n, "down").length} notes; there should be 8.`;
              if (l[i] === want[i]) continue;
              if ((l[i] - want[i]) % 12 === 0 && want[i] % 12 === 0) return i === 0 ? `Note 1 is ${octaveName(l[i])}. Start on C5, the C one octave above middle C (C4).` : `Note ${i + 1} is ${octaveName(l[i])}. Going down from ${octaveName(want[i - 1])}, the next C is ${octaveName(want[i])}.`;
              if ((l[i] - want[i]) % 12 === 0) return `Note ${i + 1} has the right letter (${nms([l[i]])}) but the wrong octave number. The number only changes at C.`;
              return `Note ${i + 1} should be ${octaveName(want[i])}; yours is ${octaveName(l[i])}.`;
            }
            return null;
          },
        } },
        { quiz: [
          { q: "Listen. Do these two notes have the same letter name?", listen: `voice x = [c4 c5]`, options: ["Yes", "No"], answer: 0, explain: "C4 and C5: the same name, one octave apart." },
          { q: "Listen. After the chord, is the step from the first note to the second a half step or a whole step?", listen: `voice x = <{c4 e4 g4} [e4 f4]>`, bars: 2, options: ["A half step", "A whole step"], answer: 0, explain: "E to F, with no black key between." },
          { q: "Which note is the white key just below middle C (<code>c4</code>)?", options: ["<code>b4</code>", "<code>b3</code>", "<code>a4</code>", "<code>c3</code>"], answer: 1, explain: "The octave number changes at C, so the B below c4 is b3." },
          { q: "What letter comes after G?", options: ["H", "A", "C", "G#"], answer: 1, explain: "The letters run A to G and start again." },
          { q: "What is another name for C#?", options: ["Db", "D", "Cb", "B#"], answer: 0, explain: "C# is the black key just above C, which is also just below D: D flat." },
          { q: "From lesson 0.1: what does a line starting with <code>--</code> do?", options: ["Plays louder", "Tine skips it; it is a note for the reader", "Starts a new bar"], answer: 1 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "beat", title: "The beat and the bar",
      parts: [
        `<p>Press play and clap along with the hi-hat.</p>`,
        { code: `tempo 90\nvoice count = [hat hat hat hat]` },
        `<p>That steady pulse, the thing you tap your foot to, is the <b>beat</b>. How fast the beats come is the <b>tempo</b>, in beats per minute. <code>tempo 90</code> means 90 beats a minute, a relaxed walk. Change it to 60 (one a second) and then to 150, and clap along each time.</p>`,
        `<p>Beats fall into groups. Most jazz and popular music groups them in fours, and musicians count "<b>1</b> 2 3 4, <b>1</b> 2 3 4". Each group is a <b>bar</b>, also called a measure. Here the kick drum marks beat 1 of every bar. Count out loud with it.</p>`,
        { code: `tempo 90\n-- the kick marks beat 1. Count "1 2 3 4" out loud.\n-- Then move the kick: [hat hat kick hat] puts it on beat 3.\nvoice count = [kick hat hat hat]` },
        `<p>A <code>.</code> inside the brackets is a <b>rest</b>: a step where nothing plays. The silence still counts.</p>
         <p>Drums have names in Tine: <code>kick</code> (the bass drum), <code>snare</code>, <code>hat</code> (hi-hat), <code>ride</code> (a cymbal), <code>clap</code> and more. This is the most common drum beat in popular music: kick on 1 and 3, snare on 2 and 4.</p>`,
        { code: `tempo 100\n-- swap kick and snare (snare on 1 and 3) and hear how odd it feels\nvoice kick  = [kick . kick .]\nvoice snare = [. snare . snare]\nvoice hat   = [hat hat hat hat]` },
        `<p>The snare on beats 2 and 4 is the <b>backbeat</b>. In jazz the backbeat is lighter but always there: the drummer closes the hi-hat with a foot pedal on 2 and 4, and the audience snaps there, never on 1 and 3. Snap with this one.</p>`,
        { code: `tempo 130\n-- snap with the claps on 2 and 4. The pedal hi-hat closes there too.\n-- The ride plays the jazz pattern, "ding, ding-a"; lesson 3 of Theory 101 (Swing) explains it.\n-- .vel sets how loud a voice is (lesson 0.6 says more). Change .vel(.7) on the claps to .vel(1): the snaps jump out over the ride.\nvoice ride = [ride [ride . ride] ride [ride . ride]].vel(.6)\nvoice hat  = [. pedal . pedal].vel(.5)\nvoice snap = [. clap . clap].vel(.7)` },
        `<p>Not all music counts in four. Count along with this one.</p>`,
        { code: `meter 3/4\ntempo 120\n-- count along: how many beats before the kick comes back?\n-- Then delete the meter line and listen: the three steps now share four beats.\nvoice oom = [kick . .]\nvoice pah = [. hat hat]` },
        `<p>Three: "<b>1</b> 2 3", a <b>waltz</b>. The <code>meter</code> line tells Tine how many beats each bar has. In <code>meter 3/4</code> the top number is the beats in each bar, so three steps in the brackets each get one beat. Leave the bottom number at 4 for now. Jazz waltzes count in three too.</p>`,
        { exercise: {
          task: `<p>Write three voices. <code>voice kick</code> plays <code>kick</code> on beat 1 only. <code>voice snare</code> plays <code>snare</code> on beats 2 and 4. <code>voice hat</code> plays <code>hat</code> on every beat.</p>`,
          starter: `voice kick = [kick kick kick kick]`,
          solution: `voice kick  = [kick . . .]\nvoice snare = [. snare . snare]\nvoice hat   = [hat hat hat hat]`,
          hint: `Each voice gets its own line. Each bar has four slots, one per beat. Put the drum in the slots you want and <code>.</code> in the others.`,
          check: (_s, n) => {
            const m = need(n, "kick") ?? need(n, "snare") ?? need(n, "hat"); if (m) return m;
            const drum: Record<string, number> = { kick: 36, snare: 38, hat: 42 };
            for (const v of ["kick", "snare", "hat"]) if (of(n, v).some(x => Math.round(x.semi) !== drum[v])) return `The ${v} voice should play ${v}, not another drum or a note.`;
            const at = (v: string) => groups(inBar(of(n, v), 0)).map(g => g.t * 4 + 1);
            const say = (xs: number[]) => xs.some(x => !Number.isInteger(x)) ? `${xs.length} times a bar, between the beats too` : `beat${xs.length === 1 ? "" : "s"} ${xs.join(", ")}`;
            const k = at("kick"), s = at("snare"), h = at("hat");
            if (JSON.stringify(k) !== "[1]") return `The kick plays on ${say(k)}. It should play on beat 1 only.`;
            if (JSON.stringify(s) !== "[2,4]") return `The snare plays on ${say(s)}. It should play on 2 and 4 only.`;
            if (JSON.stringify(h) !== "[1,2,3,4]") return h.some(x => !Number.isInteger(x)) ? `The hat plays ${say(h)}. Give it four steps, one per beat: [hat hat hat hat].` : `The hat plays on ${say(h)}. It should play on every beat.`;
            return null;
          },
        } },
        { quiz: [
          { q: "Listen and count. How many beats are in each bar?", listen: `meter 3/4\ntempo 110\nvoice a = [kick hat hat]`, bars: 2, options: ["Two", "Three", "Four"], answer: 1, explain: "One strong beat and two lighter ones: a waltz." },
          { q: "Listen. Is this closer to one beat a second, or two beats a second?", listen: `tempo 60\nvoice a = [hat hat hat hat]`, options: ["About one a second (tempo 60)", "About two a second (tempo 120)"], answer: 0 },
          { q: "Where does a jazz audience snap its fingers?", options: ["On 1 and 3", "On 2 and 4", "On every beat", "Only on 1"], answer: 1, explain: "The backbeat, 2 and 4." },
          { q: "In <code>[kick . kick .]</code>, what does <code>.</code> mean?", options: ["Play quietly", "A rest: nothing plays", "Repeat", "End the bar"], answer: 1 },
          { q: "From lesson 0.2: which pair is a half step?", options: ["C and D", "E and F", "F and G", "A and B"], answer: 1, explain: "No black key sits between E and F." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "lengths", title: "Long and short notes",
      parts: [
        `<p>Play this and clap the hi-hat beat. Each bar has the same four beats, but the notes get shorter and shorter.</p>`,
        { code: `-- four bars: 1 note, then 2, then 4, then 8 in the same space\n-- Change the last bar to [c4 c4 c4 c4 c4 c4 c4 c4 c4 c4 c4 c4 c4 c4 c4 c4]: sixteen, twice as fast again.\nvoice ladder = <[c4] [c4 c4] [c4 c4 c4 c4] [c4 c4 c4 c4 c4 c4 c4 c4]>\nvoice beat   = [hat hat hat hat].vel(.4)`, bars: 4 },
        `<p>The angle brackets <code>&lt; &gt;</code> play one item per bar, in turn, which is how one voice plays four different bars. Inside each square bracket the steps share the bar equally, so the number of steps decides how long each note is. Musicians name the lengths by dividing a <b>whole note</b>, which lasts four beats. In a four-beat bar that is the whole bar:</p>
         <table class="t"><tr><th>write</th><th>each note lasts</th><th>musicians call it</th></tr>
         <tr><td><code>[c4]</code></td><td>the whole bar, four beats</td><td>a whole note</td></tr>
         <tr><td><code>[c4 c4]</code></td><td>two beats</td><td>half notes</td></tr>
         <tr><td><code>[c4 c4 c4 c4]</code></td><td>one beat</td><td>quarter notes</td></tr>
         <tr><td><code>[c4 c4 c4 c4 c4 c4 c4 c4]</code></td><td>half a beat</td><td>eighth notes</td></tr>
         <tr><td>sixteen in a bar</td><td>a quarter of a beat</td><td>sixteenth notes</td></tr></table>
         <p>In most jazz tunes, players swing their eighth notes: long, short, long, short. Lesson 3 of Theory 101 (Swing) teaches it. Hear the difference:</p>`,
        { code: `-- bar 1 even, bar 2 swung. Change .swing to .swing(amount: 0) and bar 2 goes even too.\nvoice even  = <[c4 d4 e4 g4 a4 g4 e4 d4] .>\nvoice swung = <. [c4 d4 e4 g4 a4 g4 e4 d4]>.swing\nvoice beat  = [hat hat hat hat].vel(.4)`, bars: 2 },
        `<p>Real tunes mix long and short. To make one note longer than its neighbors, follow it with <code>_</code>, which means "keep holding". Sing along: "long, short, short", then "short, short, long".</p>`,
        { code: `-- C lasts two steps, E and G one each. Then the reverse.\n-- Try [c4 e4 _ g4]: now E is the long one.\nvoice tune = <[c4 _ e4 g4] [e4 d4 c4 _]>`, bars: 2 },
        `<p>A hold and a rest both fill a step, but they sound different. <code>_</code> keeps the note ringing. <code>.</code> stops it and leaves silence. Listen to the difference.</p>`,
        { code: `-- bar 1: one C held for four beats. Bar 2: one short C, then three beats of silence.\n-- Change bar 2 to [c4 _ . .]: the C now rings for two beats, then stops.\nvoice tune = <[c4 _ _ _] [c4 . . .]>`, bars: 2 },
        `<p>A step can also hold a smaller bracket, which splits that one beat. Here beat 2 is split into two eighth notes.</p>`,
        { code: `-- Try [c4 [d4 e4] [f4 e4] d4]: beat 3 splits too, and you hear two quick pairs.\nvoice tune = [c4 [d4 e4] f4 g4]\nvoice beat = [hat hat hat hat].vel(.4)` },
        { exercise: {
          task: `<p>Write <code>voice tune</code> that plays, in one bar: <b>E4 for one beat</b>, then <b>D4 and C4 for half a beat each</b>, then <b>G4 for two beats</b>.</p>`,
          starter: `voice tune = [e4 d4 c4 g4]`,
          solution: `voice tune = [e4 [d4 c4] g4 _]`,
          hint: `Make four steps, one per beat. D and C share one step: put them in a smaller bracket. G needs two steps: write it once, then hold it with <code>_</code>.`,
          check: (_s, n) => {
            const m = need(n, "tune"); if (m) return m;
            const ns = inBar(of(n, "tune"), 0).sort((a, b) => a.bar - b.bar);
            const want = [[64, 0, 0.25], [62, 0.25, 0.125], [60, 0.375, 0.125], [67, 0.5, 0.5]];
            if (ns.length !== 4) return `I hear ${ns.length} note${ns.length === 1 ? "" : "s"}; there should be 4.`;
            const beats = (b: number) => `${r3(b * 4)} beat${r3(b * 4) === 1 ? "" : "s"}`;
            const steps = Math.round(1 / ns[0].bars);
            if (ns.some(x => Math.abs(x.bars * 8 - Math.round(x.bars * 8)) > 0.01) && Math.abs(1 / ns[0].bars - steps) < 0.01 && steps !== 4) return `Your bar has ${steps} steps, so none of them is one beat. Use four steps, one per beat: G takes two of them.`;
            for (let i = 0; i < 4; i++) {
              const [s, t, d] = want[i], x = ns[i];
              if (x.semi !== s) return `Note ${i + 1} should be ${octaveName(s)}; yours is ${octaveName(x.semi)}.`;
              if (Math.abs(r3(x.bars) - d) > 0.01) {
                const next = ns[i + 1]?.bar ?? 1;
                if (x.bars < d && next - (x.bar + x.bars) > 0.01) return `${octaveName(s)} stops after ${beats(x.bars)} because <code>.</code> is a rest. Use <code>_</code> to keep it ringing.`;
                return `${octaveName(s)} lasts ${beats(x.bars)}; it should last ${beats(d)}.`;
              }
              if (Math.abs(r3(x.bar) - t) > 0.01) return `${octaveName(s)} starts on beat ${r3(x.bar * 4 + 1)}; it should start on beat ${t * 4 + 1}.`;
            }
            return null;
          },
        } },
        { quiz: [
          { q: "Listen. Which note is the long one?", listen: `voice x = [c4 e4 g4 _]`, options: ["The first", "The second", "The last"], answer: 2 },
          { q: "Listen. Is the note held, or is it short with silence after?", listen: `voice x = [g4 . . .]`, options: ["Held for the whole bar", "Short, then silence"], answer: 1, explain: "That is a note followed by three rests." },
          { q: "In <code>[c4 c4]</code>, how many beats does each note last, with four beats to a bar?", options: ["One", "Two", "Four", "Half a beat"], answer: 1 },
          { q: "What does <code>_</code> do?", options: ["A rest", "Keeps the note before ringing one step longer", "Makes the note quieter", "Moves it down an octave"], answer: 1 },
          { q: "From lesson 0.3: what does <code>tempo 60</code> mean?", options: ["60 notes in a bar", "60 beats a minute", "60 bars long", "60 percent volume"], answer: 1 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "together", title: "Playing together: melody, bass and chords",
      parts: [
        `<p>Play this. Two things happen at once: a tune on top and one low note underneath.</p>`,
        { code: `-- change c3 to a2 and the same tune feels different, sadder\nvoice melody = [e4 d4 c4 d4 e4 e4 e4 .]\nvoice bass   = [c3].inst(upright)` },
        `<p>Music usually comes in layers. The <b>melody</b> is the part you would sing. The <b>bass</b> is the low part that gives it ground. Each layer is its own voice, and all the voices play together. <code>.inst(upright)</code> picks the instrument: an upright (double) bass, the bass of jazz.</p>
         <p>Listen to three notes at once, then the same three one at a time.</p>`,
        { code: `-- bar 1: together. Bar 2: one after another.\n-- Change e4 to eb4 in both places: the sound turns darker (that is C minor; lesson 7 of Theory 101, Triads, explains why).\nvoice chord = <{c4 e4 g4} [c4 e4 g4 .]>`, bars: 2 },
        `<p>Notes struck at the same moment make a <b>chord</b>. In Tine, curly braces <code>{ }</code> play their notes together. C, E and G together make the <b>C major chord</b>. Now four chords. Which sound calm, and which crunchy?</p>`,
        { code: `-- four chords: which sound calm, which crunchy?\n-- Change {c4 c#4 d4} to {c4 e4 a4} and the second one calms down.\nvoice v = <{c4 e4 g4} {c4 c#4 d4} {c4 e4 g4} {b3 f4 g4}>`, bars: 4 },
        `<p>The first and third are calm. The second clashes, and the fourth clashes in a way that wants to move back to the calm chord. Musicians call the calm kind <b>consonant</b> and the clashing kind <b>dissonant</b>. Neither is wrong. Music moves between calm and tension, and jazz likes a little crunch.</p>`,
        `<p>Put the layers together and you have a small band: melody, chords, a walking bass (one bass note on every beat), and the ride cymbal from lesson 0.3.</p>`,
        { code: `tempo 120\n-- try a different bass line in bar 2, like [a2 c3 e3 c3], and listen to the chord change color.\n-- Then add b4 to the chord, {c4 e4 g4 b4}: C major 7, a chord jazz players often use in place of plain C.\nvoice ride   = [ride [ride . ride] ride [ride . ride]].vel(.5)\nvoice hat    = [. pedal . pedal].vel(.5)\nvoice melody = <[e4 g4 a4 g4] [e4 c4 _ .]>\nvoice chords = {c4 e4 g4}.vel(.45)\nvoice bass   = <[c3 e3 g3 e3] [c3 e3 g3 e3]>.inst(upright)`, bars: 2 },
        { exercise: {
          task: `<p>Write a voice called <code>chord</code> that plays <b>F4, A4 and C5 together</b>, once per bar. Then add <code>voice bass</code> playing <b>F2</b> on an upright bass.</p>`,
          starter: `voice chord = [f4 a4 c5]`,
          solution: `voice chord = {f4 a4 c5}\nvoice bass  = [f2].inst(upright)`,
          hint: `Square brackets play notes one after another. Curly braces play them together.`,
          check: (_s, n) => {
            const m = need(n, "chord"); if (m) return m;
            const g = groups(inBar(of(n, "chord"), 0));
            if (g.length > 1 && g.every(x => sameSet(x.semis, [65, 69, 72]))) return `Your chord plays ${g.length} times in a bar. Play it once: write just {f4 a4 c5}.`;
            if (g.length !== 1) return `The chord voice starts notes at ${g.length} different moments in a bar. All three should start together: use curly braces.`;
            if (!sameSet(g[0].semis, [65, 69, 72]) || g[0].semis.length !== 3) return `The chord is ${nms(g[0].semis)}; it should be F A C.`;
            if (JSON.stringify([...g[0].semis].sort((a, b) => a - b)) !== "[65,69,72]") return `The notes are F, A and C, but in the wrong octave: you have ${g[0].semis.map(octaveName).join(" ")}. Use F4, A4 and C5.`;
            const mb = need(n, "bass"); if (mb) return mb;
            const b = line(n, "bass");
            if (b[0] === 41) return of(n, "bass").every(x => x.params?.inst === "upright") ? null : "The bass plays F2, but not on an upright bass. Add .inst(upright) after it.";
            return (b[0] - 41) % 12 === 0 ? `The bass plays F, but in the wrong octave (${octaveName(b[0])}). It should be F2, the low F.` : `The bass plays ${octaveName(b[0])}; it should be F2.`;
          },
        } },
        { quiz: [
          { q: "Listen. One note at a time, or several at once?", listen: `voice x = {d4 f#4 a4}`, options: ["One at a time", "Several at once"], answer: 1 },
          { q: "Listen. The first chord is calm. Is the second calm or crunchy?", listen: `voice x = <{c4 e4 g4} {e4 f4 f#4}>`, bars: 2, options: ["Calm (consonant)", "Crunchy (dissonant)"], answer: 1, explain: "Three notes each a half step apart clash hard." },
          { q: "Which plays three notes at the same time?", options: ["<code>[c4 e4 g4]</code>", "<code>{c4 e4 g4}</code>", "<code>&lt;c4 e4 g4&gt;</code>"], answer: 1 },
          { q: "From lesson 0.4: in <code>[c4 _ e4 g4]</code>, how many beats does C last?", options: ["One", "Two", "Three"], answer: 1 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "fixing", title: "Reading and fixing code",
      parts: [
        `<p>Sooner or later you will type something Tine does not understand. That is normal. Press play on this one. It has a mistake on purpose.</p>`,
        { code: `voice tune = [c4 e4 g4 c5\nvoice bass = [c3].inst(upright)`, broken: true },
        `<p>Instead of playing, the box shows a message: what went wrong, where (the <code>^</code> points at it), and a <b>hint</b> for fixing it. A place such as <code>1:14</code> means line 1, character 14. The words "syntax error" just mean Tine could not read the line. Here the bracket opened on line 1 is never closed. Add <code>]</code> at the end of line 1 and play again. Brackets always come in pairs: <code>[ ]</code>, <code>{ }</code>, <code>&lt; &gt;</code> and <code>( )</code>.</p>`,
        `<p>Here is a different mistake. Read the hint, fix the word, and play.</p>`,
        { code: `voice bass = [c3].instt(upright)`, broken: true },
        `<p>Tine noticed that <code>instt</code> is not a word it knows, and suggested the closest one, <code>inst</code>. A <b>name error</b> means Tine read a word it does not know. One more. Notes need spaces between them. Without a space, Tine reads one strange word.</p>`,
        { code: `-- put a space between c4 and e4\nvoice tune = [c4e4 g4 e4]`, broken: true },
        `<p>One last mistake. This voice has a name Tine will not accept.</p>`,
        { code: `-- rename the voice to tune and play again\nvoice tempo = [c4]`, broken: true },
        `<p>A few words are taken. Words Tine uses for itself, such as <code>voice</code>, <code>tempo</code>, <code>meter</code>, <code>key</code> and <code>let</code>, cannot name a voice, and Tine says "expected a voice name". Any other word of plain letters and digits, starting with a letter, works, even <code>bass</code> or <code>kick</code>. Put each <code>voice</code> on its own line.</p>`,
        { code: `-- bar 1 at normal strength, bar 2 the same ride at .vel(.4).\n-- Change .vel(.4) to .vel(1): bar 2 now rings louder than bar 1.\nvoice loud = <[ride [ride . ride] ride [ride . ride]] .>\nvoice soft = <. [ride [ride . ride] ride [ride . ride]]>.vel(.4)`, bars: 2 },
        `<p>A dot followed by a word, right after a part, changes that part. This is different from a <code>.</code> on its own inside brackets, which is a rest. <code>.vel(.4)</code> plays at 40 percent strength (<b>velocity</b> means how hard a key is struck); notes play at <code>.8</code> unless you say otherwise. Jazz drummers play the ride softer like this behind a quiet solo. You have used one already: <code>.inst(upright)</code>. Later lessons add more, such as <code>.swing</code>.</p>`,
        { code: `-- no octave numbers: a note without a number is in octave 4.\n-- Change [c e g e] to [c4 e4 g4 e4]: it sounds the same.\nvoice tune = [c e g e]` },
        { exercise: {
          task: `<p>This code has three mistakes. Fix them so <code>voice tune</code> plays <b>C4, E4, G4, E4</b> and <code>voice low</code> plays <b>C3</b>.</p>`,
          starter: `voice tune = [c4 e4g4 e4\nvoice low = [c2].inst(upright)`,
          solution: `voice tune = [c4 e4 g4 e4]\nvoice low = [c3].inst(upright)`,
          hint: `Look for a missing bracket, a missing space, and a note in the wrong octave.`,
          check: (_s, n) => {
            const m = need(n, "tune"); if (m) return m;
            const t = line(n, "tune"), want = [60, 64, 67, 64];
            if (t.length !== 4) return `tune plays ${t.length} notes; it should play 4: C4 E4 G4 E4.`;
            for (let i = 0; i < 4; i++) if (t[i] !== want[i]) return `Note ${i + 1} of tune is ${octaveName(t[i])}; it should be ${octaveName(want[i])}.`;
            const ml = need(n, "low"); if (ml) return ml;
            const l0 = line(n, "low")[0];
            if (l0 === 48) return null;
            return (l0 - 48) % 12 === 0 ? `low plays C, but ${octaveName(l0)} is the wrong octave. It should be C3.` : `low plays ${octaveName(l0)}; it should be C3.`;
          },
        } },
        { quiz: [
          { q: "Listen (from lesson 0.2). After the chord, is the step half or whole?", listen: `voice x = <{c4 e4 g4} [c4 _ d4 _]>`, bars: 2, options: ["A half step", "A whole step"], answer: 1, explain: "C to D has a black key between them." },
          { q: "Listen (from lesson 0.3). How many beats in each bar?", listen: `tempo 100\nvoice a = [kick hat hat hat]`, options: ["Three", "Four"], answer: 1 },
          { q: "Which line will Tine refuse to play?", options: ["<code>voice tune = [c4 e4 g4]</code>", "<code>voice tune = [c4 e4g4]</code>", "<code>voice bass = [c3]</code>"], answer: 1, explain: "With no space, Tine reads e4g4 as one unknown word." },
          { q: "What octave is <code>e</code> in when no number is given?", options: ["3", "4", "5"], answer: 1 },
          { q: "What does <code>.vel(.5)</code> do?", options: ["Plays at half strength", "Plays half as fast", "Plays half the notes", "Moves it down half an octave"], answer: 0 },
        ] },
      ],
    },
  ],
};
