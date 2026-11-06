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
        `<p>Before you play the next one, guess: will it go up or down? Then press play and find out. Then click in the code, change <code>e4</code> to <code>a4</code>, and play it again (or press <kbd>Ctrl</kbd>+<kbd>Enter</kbd>, <kbd>Cmd</kbd>+<kbd>Enter</kbd> on a Mac). You cannot break anything: <b>reset</b> puts the example back.</p>`,
        { code: `-- guess first: up or down?\nvoice hello = [c5 g4 e4 c4]` },
        `<p>The notes share the bar equally, so more notes means shorter notes. These eight fit in the same two seconds as the four above. Delete four of them and listen to the rest slow down.</p>`,
        { code: `-- eight steps in one bar: each is half as long as before\nvoice hello = [c4 e4 g4 c5 g4 e4 c4 .]` },
        `<p>That <code>.</code> at the end is a moment of silence. You will meet it properly in lesson 0.3. A line that starts with <code>--</code> is a <b>comment</b>: Tine skips it, and it is there for the person reading.</p>
         <p>Each lesson ends with a <b>challenge</b> and a few <b>quiz</b> questions. A challenge gives you a task and a box to write in. Press <b>check</b> and the page listens to what your code plays and tells you what is right and what is not. <b>Hint</b> gives a nudge and <b>show answer</b> shows one solution. Any code that plays the right music passes, even if it looks different from the answer.</p>
         <p>If anything is unclear, use <b>Ask about this lesson</b> at the bottom of the page. Ask in plain words. The answer knows which lesson you are on and what code you have written.</p>`,
        { exercise: {
          task: `<p>Write a voice called <code>first</code> that plays exactly four notes. Any four notes are fine. Use letters from <code>a</code> to <code>g</code>, each followed by the number 4, like <code>d4</code>.</p>`,
          starter: `voice first = [c4 c4]`,
          solution: `voice first = [c4 e4 d4 g4]`,
          hint: `Put four notes inside the brackets with a space between each one, like <code>[c4 d4 e4 f4]</code>.`,
          check: (_s, n) => {
            const m = need(n, "first"); if (m) return m;
            const k = groups(inBar(of(n, "first"), 0)).length;
            return k === 4 ? null : `Your voice plays ${k} note${k === 1 ? "" : "s"} in each bar. The task asks for 4.`;
          },
        } },
        { quiz: [
          { q: "Listen. Does this tune go up or down?", listen: `voice x = [c5 a4 f4 d4]`, options: ["Up", "Down"], answer: 1, explain: "Each note is lower than the one before." },
          { q: "Listen. How many notes are in each bar?", listen: `voice x = [c4 e4 g4]`, options: ["Two", "Three", "Four"], answer: 1 },
          { q: "In the piano roll, where are the higher notes?", options: ["Further left", "Further right", "Higher up", "Lower down"], answer: 2, explain: "Up is higher in pitch. Left to right is time." },
          { q: "You put eight notes in the brackets instead of four. What happens to each note?", options: ["It gets twice as long", "It gets half as long", "Nothing changes", "It gets louder"], answer: 1, explain: "The notes share one bar, so twice as many notes means each is half as long." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "keyboard", title: "The keyboard and note names",
      parts: [
        `<p>Play this and listen to the two notes.</p>`,
        { code: `-- two notes, both called A. Change a4 to a5 and play again.\nvoice two = [a3 _ a4 _]` },
        `<p>The second note is higher, yet the two sound strangely alike, almost like the same note sung by a man and then a child. They share a name, <b>A</b>. The distance between them is an <b>octave</b>.</p>
         <p>How high a note sounds is its <b>pitch</b>, and pitch comes from how fast something vibrates. The A just above middle C vibrates 440 times a second. The A an octave up vibrates exactly twice as fast, 880, which is why the two blend so well.</p>`,
        `<p>The piano keyboard repeats a pattern of seven white keys and five black keys from bottom to top. The white keys are named with seven letters, <b>A B C D E F G</b>, and after G the letters start again at A. Here are the white keys from the note called <b>middle C</b> up to the next C.</p>`,
        { code: `-- the white keys from middle C up. Add d5 e5 at the end: the names start over.\nvoice white = [c4 d4 e4 f4 g4 a4 b4 c5]` },
        `<p>Tine names every key with its letter and an <b>octave number</b>. Middle C is <code>c4</code>. To find C on a real keyboard, look at the black keys: they come in groups of two and three, and C is the white key just left of each group of two.</p>
         <p>This trips up nearly everyone: <b>the octave number goes up at C, not at A</b>. The A and B just above middle C are <code>a4</code> and <code>b4</code>, and the next C is <code>c5</code>. The B just below middle C is <code>b3</code>.</p>`,
        { code: `-- across middle C: b3 is just below it, d4 just above\nvoice across = [a3 b3 c4 d4]` },
        `<p>Each black key is named after a white key beside it. A <b>sharp</b>, written <code>#</code>, means the key just above. A <b>flat</b>, written <code>b</code> after the letter, means the key just below. The black key between C and D is <code>c#4</code> ("C sharp") and also <code>db4</code> ("D flat"): two names for one key.</p>`,
        { code: `-- the five black keys between c4 and c5\nvoice black = [c#4 eb4 f#4 ab4 bb4 .]` },
        `<p>The distance from one key to the very next, black or white, is a <b>half step</b>. Two half steps make a <b>whole step</b>. C to D is a whole step, because C# sits between them. E to F is a half step, because there is no black key between E and F. Listen to the two pairs. The half step sounds tighter.</p>`,
        { code: `-- C to D (a whole step), then E to F (a half step).\n-- Then try b3 c4 in place of e4 f4: another half step, with no black key between.\nvoice steps = [c4 d4 . . e4 f4 . .]` },
        { exercise: {
          task: `<p>Write <code>voice down</code> that plays the white keys going <b>down</b> from C5 to C4: eight notes, highest first.</p>`,
          starter: `voice down = [c5]`,
          solution: `voice down = [c5 b4 a4 g4 f4 e4 d4 c4]`,
          hint: `Going down from C5 the letters run backwards: C, B, A, G, F, E, D, C. The number changes only when you pass C, so every note after C5 is in octave 4.`,
          check: (_s, n) => {
            const m = need(n, "down"); if (m) return m;
            const want = [72, 71, 69, 67, 65, 64, 62, 60], l = line(n, "down").slice(0, 8);
            for (let i = 0; i < want.length; i++) {
              if (l[i] === undefined) return `I hear ${l.length} note${l.length === 1 ? "" : "s"}; there should be 8.`;
              if (l[i] === want[i]) continue;
              if ((l[i] - want[i]) % 12 === 0) return `Note ${i + 1} has the right letter (${nms([l[i]])}) but the wrong octave number. The number only changes at C.`;
              return `Note ${i + 1} should be ${octaveName(want[i])}; yours is ${octaveName(l[i])}.`;
            }
            return null;
          },
        } },
        { quiz: [
          { q: "Listen. Do these two notes have the same letter name?", listen: `voice x = [c4 _ c5 _]`, options: ["Yes, they are an octave apart", "No, they are different notes"], answer: 0, explain: "C4 and C5: the same name, one octave apart." },
          { q: "Listen. Is the step from the first note to the second a half step or a whole step?", listen: `voice x = [e4 _ f4 _]`, options: ["A half step", "A whole step"], answer: 0, explain: "E to F, with no black key between." },
          { q: "Which note is the white key just below middle C (<code>c4</code>)?", options: ["<code>b4</code>", "<code>b3</code>", "<code>a4</code>", "<code>c3</code>"], answer: 1, explain: "The octave number changes at C, so the B below c4 is b3." },
          { q: "What letter comes after G?", options: ["H", "A", "C", "G#"], answer: 1, explain: "The letters run A to G and start again." },
          { q: "C# and Db are...", options: ["two different keys", "the same key with two names", "a whole step apart", "both white keys"], answer: 1 },
          { q: "From lesson 0.1: in <code>[c4 e4 g4 c5]</code>, how many notes share the bar?", options: ["One", "Two", "Four"], answer: 2 },
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
        `<p>A <code>.</code> inside the brackets is a <b>rest</b>: a beat where nothing plays. The silence still counts. Drums have names in Tine: <code>kick</code> (the bass drum), <code>snare</code>, <code>hat</code> (hi-hat), <code>ride</code> (a cymbal), <code>clap</code> and more. This is the most common drum beat in popular music: kick on 1 and 3, snare on 2 and 4.</p>`,
        { code: `tempo 100\n-- swap kick and snare (snare on 1 and 3) and hear how odd it feels\nvoice kick  = [kick . kick .]\nvoice snare = [. snare . snare]\nvoice hat   = [hat hat hat hat]` },
        `<p>The snare on beats 2 and 4 is the <b>backbeat</b>. Jazz leans on it even more. A jazz audience snaps on 2 and 4, never on 1 and 3, and the drummer closes the hi-hat there too (lesson 3 goes further). Snap with this one.</p>`,
        { code: `tempo 130\n-- snap with the claps on 2 and 4\nvoice ride = [ride ride ride ride].vel(.6)\nvoice snap = [. clap . clap].vel(.7)` },
        `<p>Not all music counts in four. A waltz counts "<b>1</b> 2 3". The <code>meter</code> line tells Tine how many beats each bar has. <code>meter 3/4</code> means three beats, so three steps in the brackets each get one beat.</p>`,
        { code: `meter 3/4\ntempo 120\n-- count "1 2 3". Then delete the meter line and listen: the three steps now share four beats.\nvoice oom = [kick . .]\nvoice pah = [. hat hat]` },
        { exercise: {
          task: `<p>Write two voices. <code>voice kick</code> plays <code>kick</code> on beats 1 and 3. <code>voice snare</code> plays <code>snare</code> on beats 2 and 4.</p>`,
          starter: `voice kick = [kick kick kick kick]`,
          solution: `voice kick  = [kick . kick .]\nvoice snare = [. snare . snare]`,
          hint: `Each bar has four slots, one per beat. Put the drum in the slots you want and <code>.</code> in the others.`,
          check: (_s, n) => {
            const m = need(n, "kick") ?? need(n, "snare"); if (m) return m;
            const at = (v: string) => groups(inBar(of(n, v), 0)).map(g => g.t * 4 + 1);
            const k = at("kick"), s = at("snare");
            if (JSON.stringify(k) !== "[1,3]") return `The kick plays on beat${k.length === 1 ? "" : "s"} ${k.join(", ")}. It should play on 1 and 3 only.`;
            if (JSON.stringify(s) !== "[2,4]") return `The snare plays on beat${s.length === 1 ? "" : "s"} ${s.join(", ")}. It should play on 2 and 4 only.`;
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
        { code: `-- four bars: 1 note, then 2, then 4, then 8 in the same space\nvoice ladder = <[c4] [c4 c4] [c4 c4 c4 c4] [c4 c4 c4 c4 c4 c4 c4 c4]>\nvoice beat   = [hat hat hat hat].vel(.4)`, bars: 4 },
        `<p>The angle brackets <code>&lt; &gt;</code> play one item per bar, in turn, which is how one voice plays four different bars. Inside each square bracket the steps share the bar equally, so the number of steps decides how long each note is. Musicians name the lengths by dividing a whole bar:</p>
         <table class="t"><tr><th>write</th><th>each note lasts</th><th>musicians call it</th></tr>
         <tr><td><code>[c4]</code></td><td>the whole bar, four beats</td><td>a whole note</td></tr>
         <tr><td><code>[c4 c4]</code></td><td>two beats</td><td>half notes</td></tr>
         <tr><td><code>[c4 c4 c4 c4]</code></td><td>one beat</td><td>quarter notes</td></tr>
         <tr><td>eight notes</td><td>half a beat</td><td>eighth notes</td></tr></table>`,
        `<p>Real tunes mix long and short. To make one note longer than its neighbours, follow it with <code>_</code>, which means "keep holding". Sing along: "long, short, short", then "short, short, long".</p>`,
        { code: `-- C lasts two steps, E and G one each. Then the reverse.\n-- Try [c4 e4 _ g4]: now E is the long one.\nvoice tune = <[c4 _ e4 g4] [e4 d4 c4 _]>`, bars: 2 },
        `<p>A hold and a rest both fill a step, but they sound different. <code>_</code> keeps the note ringing. <code>.</code> stops it and leaves silence. Listen to the difference.</p>`,
        { code: `-- bar 1: one C held for four beats. Bar 2: one short C, then three beats of silence.\nvoice tune = <[c4 _ _ _] [c4 . . .]>`, bars: 2 },
        `<p>A step can also hold a smaller bracket, which splits that one beat. Here beat 2 is split into two eighth notes.</p>`,
        { code: `-- split another beat too: [c4 [d4 e4] [f4 e4] d4]\nvoice tune = [c4 [d4 e4] f4 g4]\nvoice beat = [hat hat hat hat].vel(.4)` },
        { exercise: {
          task: `<p>Write <code>voice tune</code> that plays, in one bar: <b>C4 for two beats</b>, then <b>E4 for one beat</b>, then <b>G4 for one beat</b>.</p>`,
          starter: `voice tune = [c4 e4 g4]`,
          solution: `voice tune = [c4 _ e4 g4]`,
          hint: `Make four steps, one per beat. C needs two of them: write it once, then hold it with <code>_</code>.`,
          check: (_s, n) => {
            const m = need(n, "tune"); if (m) return m;
            const ns = inBar(of(n, "tune"), 0).sort((a, b) => a.bar - b.bar);
            const want = [[60, 0, 0.5], [64, 0.5, 0.25], [67, 0.75, 0.25]];
            if (ns.length !== 3) return `I hear ${ns.length} notes; there should be 3.`;
            for (let i = 0; i < 3; i++) {
              const [s, t, d] = want[i], x = ns[i];
              if (x.semi !== s) return `Note ${i + 1} should be ${octaveName(s)}; yours is ${octaveName(x.semi)}.`;
              if (Math.abs(r3(x.bars) - d) > 0.01) return `${octaveName(s)} lasts ${r3(x.bars * 4)} beats; it should last ${d * 4}.`;
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
         <p>In the middle sit the <b>chords</b>: several notes struck at the same moment. In Tine, curly braces play their notes together. Listen to three notes together, then the same three one at a time.</p>`,
        { code: `-- bar 1: together. Bar 2: one after another.\n-- Change e4 to eb4 in both places: the chord turns darker (that is C minor; lesson 7 explains why).\nvoice chord = <{c4 e4 g4} [c4 e4 g4 .]>`, bars: 2 },
        `<p>C, E and G together make the <b>C major chord</b>, probably the most common chord in music. Some combinations sound settled, like that one. Others clash and seem to want to move somewhere. Musicians call the first kind <b>consonant</b> and the second <b>dissonant</b>. Neither is wrong. Music moves between them the way a story moves between calm and tension, and jazz likes a little crunch.</p>`,
        { code: `-- calm, crunchy, calm, then a crunch that wants to move back to the calm chord\nvoice v = <{c4 e4 g4} {c4 c#4 d4} {c4 e4 g4} {b3 f4 g4}>`, bars: 4 },
        `<p>Put the layers together and you have a small band: melody, chords and bass.</p>`,
        { code: `tempo 100\n-- try a different bass note in bar 2, like a2 or f2, and listen to the chord change colour\nvoice melody = <[e4 d4 c4 d4] [e4 e4 e4 _]>\nvoice chords = {c4 e4 g4}.vel(.45)\nvoice bass   = <[c3] [c3]>.inst(upright)`, bars: 2 },
        { exercise: {
          task: `<p>Write a voice called <code>chord</code> that plays <b>F4, A4 and C5 together</b>, once per bar. Then add <code>voice bass</code> playing <b>F2</b>.</p>`,
          starter: `voice chord = [f4 a4 c5]`,
          solution: `voice chord = {f4 a4 c5}\nvoice bass  = [f2]`,
          hint: `Square brackets play notes one after another. Curly braces play them together.`,
          check: (_s, n) => {
            const m = need(n, "chord"); if (m) return m;
            const g = groups(inBar(of(n, "chord"), 0));
            if (g.length !== 1) return `The chord voice starts notes at ${g.length} different moments in a bar. All three should start together: use curly braces.`;
            if (!sameSet(g[0].semis, [65, 69, 72]) || g[0].semis.length !== 3) return `The chord is ${nms(g[0].semis)}; it should be F A C.`;
            const mb = need(n, "bass"); if (mb) return mb;
            const b = line(n, "bass");
            if (b[0] === 41) return null;
            return (b[0] - 41) % 12 === 0 ? `The bass plays F, but in the wrong octave (${octaveName(b[0])}). It should be F2, the low F.` : `The bass plays ${octaveName(b[0])}; it should be F2.`;
          },
        } },
        { quiz: [
          { q: "Listen. One note at a time, or several at once?", listen: `voice x = {d4 f#4 a4}`, options: ["One at a time", "Several at once"], answer: 1 },
          { q: "Listen. Calm or crunchy?", listen: `voice x = {e4 f4 f#4}`, options: ["Calm (consonant)", "Crunchy (dissonant)"], answer: 1, explain: "Three notes each a half step apart clash hard." },
          { q: "Which plays three notes at the same time?", options: ["<code>[c4 e4 g4]</code>", "<code>{c4 e4 g4}</code>", "<code>&lt;c4 e4 g4&gt;</code>"], answer: 1 },
          { q: "From lesson 0.4: in <code>[c4 _ e4 g4]</code>, how many beats does C last?", options: ["One", "Two", "Three"], answer: 1 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "fixing", title: "Reading and fixing code",
      parts: [
        `<p>Sooner or later you will type something Tine does not understand. That is normal and harmless. Press play on this one. It has a mistake on purpose.</p>`,
        { code: `voice tune = [c4 e4 g4 c5\nvoice bass = [c3]`, broken: true },
        `<p>Instead of playing, the box shows a message: what went wrong, where (the <code>^</code> points at it), and a <b>hint</b> for fixing it. Here the bracket opened on line 1 is never closed. Add <code>]</code> at the end of line 1 and play again. Brackets always come in pairs: <code>[ ]</code>, <code>{ }</code>, <code>&lt; &gt;</code> and <code>( )</code>.</p>`,
        `<p>Here is a different mistake. Read the hint, fix the word, and play.</p>`,
        { code: `voice bass = [c3].instt(upright)`, broken: true },
        `<p>Tine noticed that <code>instt</code> is not a word it knows, and suggested the closest one, <code>inst</code>. One more. Notes need spaces between them. Without a space, Tine reads one strange word.</p>`,
        { code: `-- put a space between c4 and e4\nvoice tune = [c4e4 g4 e4]`, broken: true },
        `<p>Some other things that help when reading the code on these pages:</p>
         <ul><li><b>One statement per line.</b> Each <code>voice</code> line stands on its own.</li>
         <li><b>A few words are taken.</b> Words Tine uses for itself, such as <code>voice</code>, <code>tempo</code>, <code>meter</code>, <code>key</code> and <code>let</code>, cannot name a voice. Tine says "expected a voice name" if you try. Anything else is fine, even <code>bass</code> or <code>kick</code>.</li>
         <li><b>Dots after a part change it.</b> <code>.inst(upright)</code> picks an instrument. <code>.vel(.5)</code> plays at half strength (<b>velocity</b> means how hard a key is struck). Later lessons add more, such as <code>.swing</code>.</li>
         <li><b>A note without a number is in octave 4.</b> <code>[c e g]</code> means <code>[c4 e4 g4]</code>. Later lessons use this shortcut a lot.</li></ul>`,
        { code: `-- these two voices play the same notes; one is just quieter.\n-- Change .vel(.6) to .vel(.2) and the second all but disappears.\nvoice long  = [c4 e4 g4 e4]\nvoice short = [c e g e].vel(.6)` },
        `<p>From the next lesson on, examples start with a <code>tempo</code> line and use a few new shapes inside the brackets. Each is explained where it first appears. When an explanation is not enough, <b>Ask about this lesson</b> is at the bottom of every page.</p>`,
        { exercise: {
          task: `<p>This code has three mistakes. Fix them so <code>voice tune</code> plays <b>C4, E4, G4, E4</b> and <code>voice low</code> plays <b>C3</b>.</p>`,
          starter: `voice tune = [c4 e4g4 e4\nvoice low = [c2]`,
          solution: `voice tune = [c4 e4 g4 e4]\nvoice low = [c3]`,
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
          { q: "Listen (from lesson 0.2). Half step or whole step?", listen: `voice x = [c4 _ d4 _]`, options: ["A half step", "A whole step"], answer: 1, explain: "C to D has a black key between them." },
          { q: "Listen (from lesson 0.3). How many beats in each bar?", listen: `tempo 100\nvoice a = [kick hat hat hat]`, options: ["Three", "Four"], answer: 1 },
          { q: "Tine shows a message where the piano roll should be. What do you do?", options: ["Reload the page", "Read the message and the hint, and fix that spot", "Start the lesson again", "Nothing; it will fix itself"], answer: 1 },
          { q: "What octave is <code>e</code> in when no number is given?", options: ["3", "4", "5"], answer: 1 },
          { q: "What does <code>.vel(.5)</code> do?", options: ["Plays at half strength", "Plays half as fast", "Plays half the notes", "Moves it down half an octave"], answer: 0 },
        ] },
      ],
    },
  ],
};
