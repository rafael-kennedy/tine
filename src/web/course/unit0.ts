// Unit 0, Theory 100: for someone who has never read music or written code.
// Sound, the keyboard, the beat, note lengths, playing together, reading and fixing code.
import type { Unit } from "./types";
import { of, groups, line, inBar, need, r3, nms, sameSet } from "./check";

export const UNIT0: Unit = {
  id: "u0", code: "Theory 100", title: "Starting from zero",
  blurb: "For anyone who has never read music or written code. What a note is, how the keyboard is laid out, how to count a beat, long and short notes, playing more than one thing at once, and how to read and fix the code on these pages.",
  lessons: [
    // ------------------------------------------------------------------
    {
      id: "start", title: "Press play",
      parts: [
        `<p>This course teaches music theory: the names and rules musicians use to talk about what they hear. You do not need to read music, play an instrument or know how to program. Every idea comes with a short piece of code that makes sound, and you can change it and hear what happens.</p>
         <p>Start here. Press <b>▶ play</b> under the box below. Browsers stay silent until you click something on the page, so the first press may take a moment.</p>`,
        { code: `voice hello = [c4 e4 g4 c5]` },
        `<p>You heard four notes, each a little higher than the one before, and then the four notes again. They keep repeating until you press <b>■</b> to stop.</p>
         <p>Here is what the line says, one piece at a time:</p>
         <ul><li><code>voice</code> means "here is a part to play". A piece can have many voices, like a band has many players.</li>
         <li><code>hello</code> is a name we chose for this voice. Any word works, with a few exceptions you will meet in lesson 0.6.</li>
         <li><code>=</code> means "plays this".</li>
         <li><code>[c4 e4 g4 c5]</code> is the music: four notes inside square brackets. The brackets hold one <b>bar</b>, a short stretch of time, and the notes share it equally.</li></ul>
         <p>The picture under the code is a <b>piano roll</b>. Time runs left to right. Higher notes sit higher up. The moving line shows where the music is.</p>`,
        `<p>Now change something. Click in the code, replace <code>g4</code> with <code>a4</code>, and press play again (or press <kbd>Ctrl</kbd>+<kbd>Enter</kbd>, or <kbd>Cmd</kbd>+<kbd>Enter</kbd> on a Mac). You cannot break anything: <b>reset</b> puts the example back.</p>`,
        { code: `-- try changing the notes, or adding more inside the brackets\nvoice hello = [c4 d4 e4 f4 g4]` },
        `<p>A line that starts with <code>--</code> is a <b>comment</b>. Tine ignores it. It is a note for the person reading.</p>
         <p>Each lesson ends with a <b>challenge</b> and a few <b>quiz</b> questions. A challenge gives you a task and a box to write in. Press <b>check</b> and the page listens to what your code plays and tells you what is right and what is not. If you are stuck, <b>hint</b> gives a nudge and <b>show answer</b> gives one solution. Any code that plays the right music passes, even if it looks different from the answer.</p>
         <p>If something in a lesson does not make sense, use <b>Ask about this lesson</b> at the bottom of the page. You can ask in plain words, and the answer knows which lesson you are on and what code you have written.</p>`,
        { exercise: {
          task: `<p>Write a voice called <code>first</code> that plays exactly four notes. Any four notes are fine. Use letters from <code>a</code> to <code>g</code>, each followed by the number 4, like <code>d4</code>.</p>`,
          starter: `voice first = [c4 c4]`,
          solution: `voice first = [c4 e4 d4 g4]`,
          hint: `Put four notes inside the brackets, with a space between each one: <code>[c4 d4 e4 f4]</code>.`,
          check: (_s, n) => {
            const m = need(n, "first"); if (m) return m;
            const k = groups(inBar(of(n, "first"), 0)).length;
            return k === 4 ? null : `Your voice plays ${k} note${k === 1 ? "" : "s"} in each bar. The task asks for 4.`;
          },
        } },
        { quiz: [
          { q: "What does <code>voice</code> at the start of a line mean?", options: ["Sing the notes", "Here is a part to play", "Make it louder", "Stop the music"], answer: 1, explain: "A voice is one part, like one player in a band." },
          { q: "In the piano roll, where are the higher notes?", options: ["Further left", "Further right", "Higher up", "Lower down"], answer: 2, explain: "Up is higher in pitch. Left to right is time." },
          { q: "What does a line starting with <code>--</code> do?", options: ["Nothing; it is a comment for people", "Plays more quietly", "Removes a note", "Repeats the line"], answer: 0 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "keyboard", title: "The keyboard and note names",
      parts: [
        `<p>A sound has a <b>pitch</b>: how high or low it is. Pitch comes from how fast something vibrates. A guitar string shaking 440 times a second sounds the note musicians call A. Faster is higher.</p>
         <p>Music does not use every possible pitch. It uses a fixed set, and the piano keyboard shows the set clearly. The keys repeat in a pattern: seven white keys and five black keys, over and over from the bottom of the piano to the top.</p>
         <p>The white keys are named with the first seven letters of the alphabet: <b>A B C D E F G</b>. After G the letters start again at A. Notes with the same letter sound alike, one higher and one lower. That repeat is called an <b>octave</b>.</p>`,
        `<p>The black keys sit in groups of two and three. That grouping is how pianists find their way. <b>C</b> is the white key just to the left of each group of two black keys. The C near the middle of the piano is <b>middle C</b>.</p>
         <p>Tine names every key with its letter and an <b>octave number</b>. Middle C is <code>c4</code>. The white keys going up from it are <code>c4 d4 e4 f4 g4 a4 b4</code>, and then the next C is <code>c5</code>.</p>
         <p>This trips up nearly everyone: <b>the octave number goes up at C, not at A</b>. The A and B just above middle C are <code>a4</code> and <code>b4</code>. The B just below middle C is <code>b3</code>.</p>`,
        { code: `-- the white keys from middle C up to the next C\nvoice white = [c4 d4 e4 f4 g4 a4 b4 c5]` },
        `<p>Each black key is named after a white key next to it. A <b>sharp</b>, written <code>#</code>, means one key higher. A <b>flat</b>, written <code>b</code> after the letter, means one key lower. The black key between C and D is <code>c#4</code> ("C sharp") and also <code>db4</code> ("D flat"). Both names mean the same key.</p>
         <p>Between E and F, and between B and C, there is no black key. Those white keys sit right next to each other.</p>`,
        { code: `-- the five black keys between c4 and c5\nvoice black = [c#4 eb4 f#4 ab4 bb4 .]` },
        `<p>The distance from any key to the very next key, black or white, is a <b>half step</b>. Two half steps make a <b>whole step</b>. C to D is a whole step (C#/Db sits between them). E to F is a half step (nothing sits between them). Almost all of music theory is built from counting these steps, so it is worth getting used to them now.</p>`,
        { code: `-- C to D: a whole step. E to F: a half step. Listen to the difference.\nvoice steps = [c4 d4 . . e4 f4 . .]` },
        { exercise: {
          task: `<p>Write <code>voice down</code> that plays the white keys going <b>down</b> from C5 to C4: eight notes, highest first.</p>`,
          starter: `voice down = [c5]`,
          solution: `voice down = [c5 b4 a4 g4 f4 e4 d4 c4]`,
          hint: `Going down from C5, the letters run backwards: C, B, A, G, F, E, D, C. The number changes only when you pass C, so everything after C5 is in octave 4.`,
          check: (_s, n) => {
            const m = need(n, "down"); if (m) return m;
            const want = [72, 71, 69, 67, 65, 64, 62, 60], l = line(n, "down").slice(0, 8);
            for (let i = 0; i < want.length; i++) {
              if (l[i] === undefined) return `I hear ${l.length} notes; there should be 8.`;
              if (l[i] === want[i]) continue;
              if ((l[i] - want[i]) % 12 === 0) return `Note ${i + 1} has the right letter (${nms([l[i]])}) but the wrong octave number. The number only changes at C.`;
              return `Note ${i + 1} should be ${nms([want[i]])}${Math.floor(want[i] / 12) - 1}; yours is ${nms([l[i]])}.`;
            }
            return null;
          },
        } },
        { quiz: [
          { q: "What letter comes after G?", options: ["H", "A", "C", "G#"], answer: 1, explain: "The letters run A to G and start again." },
          { q: "Which note is the white key just below middle C (<code>c4</code>)?", options: ["<code>b4</code>", "<code>b3</code>", "<code>a4</code>", "<code>c3</code>"], answer: 1, explain: "The octave number changes at C, so the B below c4 is b3." },
          { q: "C# and Db are...", options: ["two different keys", "the same key with two names", "a whole step apart", "both white keys"], answer: 1 },
          { q: "Listen. Is the second note higher or lower than the first?", listen: `voice x = [c4 _ g4 _]`, options: ["Higher", "Lower", "The same"], answer: 0 },
          { q: "Listen. Is this a half step or a whole step?", listen: `voice x = [e4 _ f4 _]`, options: ["A half step", "A whole step"], answer: 0, explain: "E to F, with no black key between." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "beat", title: "The beat and the bar",
      parts: [
        `<p>Most music has a steady pulse underneath it, the thing you tap your foot to. That pulse is the <b>beat</b>. How fast the beats come is the <b>tempo</b>, measured in beats per minute. 60 is one beat a second, a slow walk. 120 is a brisk march.</p>
         <p>Beats fall into groups. In most popular music and jazz, the group is four: musicians count "<b>1</b> 2 3 4, <b>1</b> 2 3 4". Each group is a <b>bar</b> (also called a measure). Beat 1, the first of each bar, usually feels strongest.</p>`,
        { code: `tempo 90\n-- a hi-hat on every beat, four per bar. Count along: 1 2 3 4\nvoice count = [hat hat hat hat]` },
        `<p><code>tempo 90</code> sets the speed. Change it to 60 or 150 and listen. Drums have names in Tine: <code>kick</code> (the bass drum), <code>snare</code>, <code>hat</code> (hi-hat), <code>ride</code> (a cymbal) and more.</p>
         <p>A <code>.</code> inside the brackets is a <b>rest</b>: a beat where nothing plays. Rests are part of the rhythm. The silence is counted too.</p>`,
        { code: `tempo 100\n-- the kick on 1 and 3, the snare on 2 and 4: the basic rock beat\nvoice kick  = [kick . kick .]\nvoice snare = [. snare . snare]\nvoice hat   = [hat hat hat hat]` },
        `<p>Each voice keeps its own line, and all the voices play at the same time. The snare on beats 2 and 4 is called the <b>backbeat</b>. Jazz drummers put the hi-hat there too, which you will hear in lesson 3.</p>
         <p>Not all music counts in four. A waltz counts "<b>1</b> 2 3". Put three steps in the brackets and the bar has three beats. The <code>meter</code> line tells Tine how many beats a bar has, so the tempo still means beats per minute.</p>`,
        { code: `meter 3/4\ntempo 120\nvoice oom = [kick . .]\nvoice pah = [. hat hat]` },
        { exercise: {
          task: `<p>Write two voices. <code>voice kick</code> plays <code>kick</code> on beats 1 and 3. <code>voice snare</code> plays <code>snare</code> on beats 2 and 4.</p>`,
          starter: `voice kick = [kick kick kick kick]`,
          solution: `voice kick  = [kick . kick .]\nvoice snare = [. snare . snare]`,
          hint: `Each bar has four slots. Fill the slots you want with the drum, and the rest with <code>.</code>.`,
          check: (_s, n) => {
            const m = need(n, "kick") ?? need(n, "snare"); if (m) return m;
            const at = (v: string) => JSON.stringify(groups(inBar(of(n, v), 0)).map(g => g.t));
            if (at("kick") !== "[0,0.5]") return "The kick should play on beats 1 and 3 only.";
            if (at("snare") !== "[0.25,0.75]") return "The snare should play on beats 2 and 4 only.";
            return null;
          },
        } },
        { quiz: [
          { q: "What is the tempo?", options: ["How loud the music is", "How fast the beats come", "How many voices play", "How high the notes are"], answer: 1 },
          { q: "In <code>[kick . kick .]</code>, what does <code>.</code> mean?", options: ["Play quietly", "A rest: nothing plays", "Repeat", "End the bar"], answer: 1 },
          { q: "Listen. How many beats are in each bar?", listen: `meter 3/4\ntempo 110\nvoice a = [kick hat hat]`, bars: 2, options: ["Two", "Three", "Four"], answer: 1, explain: "A strong beat and two lighter ones: a waltz." },
          { q: "Listen. Which is faster?", listen: `tempo 70\nvoice a = [hat hat hat hat]`, options: ["This is about 70 beats per minute", "This is about 140 beats per minute"], answer: 0 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "lengths", title: "Long and short notes",
      parts: [
        `<p>Rhythm is the pattern of long and short sounds. In Tine, the brackets hold one bar, and every step inside gets an equal share. So the number of steps decides how long each one is.</p>
         <table class="t"><tr><th>write</th><th>steps in the bar</th><th>each note lasts</th><th>musicians call it</th></tr>
         <tr><td><code>[c4]</code></td><td>1</td><td>the whole bar, four beats</td><td>a whole note</td></tr>
         <tr><td><code>[c4 c4]</code></td><td>2</td><td>two beats</td><td>half notes</td></tr>
         <tr><td><code>[c4 c4 c4 c4]</code></td><td>4</td><td>one beat</td><td>quarter notes</td></tr>
         <tr><td>8 notes</td><td>8</td><td>half a beat</td><td>eighth notes</td></tr></table>
         <p>The names come from dividing a whole note: halves, quarters, eighths.</p>`,
        { code: `-- one bar each of whole, half, quarter and eighth notes\nvoice ladder = <[c4] [c4 c4] [c4 c4 c4 c4] [c4 c4 c4 c4 c4 c4 c4 c4]>\nvoice beat   = [hat hat hat hat].vel(.4)`, bars: 4 },
        `<p>The angle brackets <code>&lt; &gt;</code> play one item per bar, in turn. That is how this example plays four different bars.</p>
         <p>To make one note longer than its neighbours, use <code>_</code>, which means "keep holding the note before". <code>[c4 _ e4 g4]</code> has four steps. C takes the first two, so it lasts two beats, and E and G get one beat each.</p>`,
        { code: `-- long, short, short. Then short, short, long.\nvoice tune = <[c4 _ e4 g4] [e4 d4 c4 _]>`, bars: 2 },
        `<p>A step can also hold a smaller group. <code>[c4 [d4 e4] f4 g4]</code> has four beats, and the second beat is split into two eighth notes. This is how you write a rhythm that mixes lengths.</p>`,
        { code: `voice tune = [c4 [d4 e4] f4 g4]\nvoice beat = [hat hat hat hat].vel(.4)` },
        { exercise: {
          task: `<p>Write <code>voice tune</code> that plays, in one bar: <b>C4 for two beats</b>, then <b>E4 for one beat</b>, then <b>G4 for one beat</b>.</p>`,
          starter: `voice tune = [c4 e4 g4]`,
          solution: `voice tune = [c4 _ e4 g4]`,
          hint: `Make four steps, one per beat. C needs two of them: write it once and hold it with <code>_</code>.`,
          check: (_s, n) => {
            const m = need(n, "tune"); if (m) return m;
            const ns = inBar(of(n, "tune"), 0).sort((a, b) => a.bar - b.bar);
            const want = [[60, 0, 0.5], [64, 0.5, 0.25], [67, 0.75, 0.25]];
            if (ns.length !== 3) return `I hear ${ns.length} notes; there should be 3.`;
            for (let i = 0; i < 3; i++) {
              const [s, t, d] = want[i], x = ns[i];
              if (x.semi !== s) return `Note ${i + 1} should be ${nms([s])}.`;
              if (Math.abs(r3(x.bar) - t) > 0.01 || Math.abs(r3(x.bars) - d) > 0.01) return `Note ${i + 1} (${nms([s])}) lasts ${r3(x.bars * 4)} beat${x.bars * 4 === 1 ? "" : "s"}; it should last ${d * 4}.`;
            }
            return null;
          },
        } },
        { quiz: [
          { q: "In <code>[c4 c4]</code>, how many beats does each note last (four beats to a bar)?", options: ["One", "Two", "Four", "Half a beat"], answer: 1 },
          { q: "What does <code>_</code> do?", options: ["A rest", "Holds the note before one step longer", "Makes the note quieter", "Moves it down an octave"], answer: 1 },
          { q: "Listen. Long notes or short notes?", listen: `voice x = [c4 e4 g4 e4 c4 e4 g4 e4]`, options: ["Long, a whole bar each", "Short, eight to a bar"], answer: 1 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "together", title: "Playing together: melody, bass and chords",
      parts: [
        `<p>Most music has layers. The <b>melody</b> is the part you would sing. The <b>bass</b> is the low part underneath that gives it ground. Between them, <b>chords</b> fill in the harmony: several notes sounding at the same moment.</p>
         <p>You already know how to layer: write more than one voice. Here a melody plays over a low bass note. The <code>.inst(...)</code> at the end picks the instrument sound.</p>`,
        { code: `voice melody = [e4 d4 c4 d4 e4 e4 e4 .]\nvoice bass   = [c3].inst(upright)` },
        `<p>To play notes at the same time inside one voice, put them in curly braces. <code>{c4 e4 g4}</code> is three notes struck together, a <b>chord</b>. This one is the C major chord, probably the most common chord there is.</p>`,
        { code: `-- a chord once per bar, then the same notes one at a time\nvoice chord = <{c4 e4 g4} [c4 e4 g4 .]>`, bars: 2 },
        `<p>Some combinations sound settled and sweet. Others clash and want to move. Musicians call the first kind <b>consonant</b> and the second <b>dissonant</b>. Neither is wrong. Music moves between them the way a story moves between calm and tension. Jazz in particular loves a little crunch.</p>`,
        { code: `-- calm, then crunchy, then calm again\nvoice v = <{c4 e4 g4} {c4 c#4 d4} {c4 e4 g4} {b3 f4 g4}>`, bars: 4 },
        `<p>Put the three layers together and you have a tiny band.</p>`,
        { code: `tempo 100\nvoice melody = <[e4 d4 c4 d4] [e4 e4 e4 _]>\nvoice chords = <{c4 e4 g4} {c4 e4 g4}>.vel(.5)\nvoice bass   = <[c3] [c3]>.inst(upright)`, bars: 2 },
        { exercise: {
          task: `<p>Write a voice called <code>chord</code> that plays the notes <b>F4, A4 and C5 together</b>, once per bar. Then add <code>voice bass</code> playing <b>F2</b>.</p>`,
          starter: `voice chord = [f4 a4 c5]`,
          solution: `voice chord = {f4 a4 c5}\nvoice bass  = [f2]`,
          hint: `Square brackets play notes one after another. Curly braces play them together.`,
          check: (_s, n) => {
            const m = need(n, "chord") ?? need(n, "bass"); if (m) return m;
            const g = groups(inBar(of(n, "chord"), 0));
            if (g.length !== 1) return `The chord voice plays at ${g.length} different moments in a bar. All three notes should start together.`;
            if (!sameSet(g[0].semis, [65, 69, 72]) || g[0].semis.length !== 3) return `The chord is ${nms(g[0].semis)}; it should be F A C.`;
            const b = line(n, "bass");
            return b[0] === 41 ? null : `The bass plays ${nms([b[0]])}; it should be F2, the F two octaves below the chord.`;
          },
        } },
        { quiz: [
          { q: "What is a chord?", options: ["A very long note", "Several notes sounding together", "A fast melody", "A drum pattern"], answer: 1 },
          { q: "Which plays three notes at the same time?", options: ["<code>[c4 e4 g4]</code>", "<code>{c4 e4 g4}</code>", "<code>&lt;c4 e4 g4&gt;</code>"], answer: 1 },
          { q: "Listen. One note at a time, or several at once?", listen: `voice x = {d4 f#4 a4}`, options: ["One at a time", "Several at once"], answer: 1 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "fixing", title: "Reading and fixing code",
      parts: [
        `<p>Sooner or later you will type something Tine does not understand. That is normal and harmless. When it happens, the box shows a message in place of the piano roll, saying what went wrong and on which line. Read it, fix the line, and play again.</p>
         <p>Press play on this one. It has a mistake on purpose.</p>`,
        { code: `voice tune = [c4 e4 g4 c5\nvoice bass = [c3]`, broken: true },
        `<p>The first line opens a bracket and never closes it. Add <code>]</code> at the end of line 1 and it plays. Brackets always come in pairs: <code>[ ]</code>, <code>{ }</code>, <code>&lt; &gt;</code> and <code>( )</code>.</p>
         <p>Some other things to know when reading the code on these pages:</p>
         <ul><li><b>One statement per line.</b> Each <code>voice</code> line is complete on its own.</li>
         <li><b>Spaces separate notes.</b> <code>[c4e4]</code> is one strange word, not two notes.</li>
         <li><b>Note names are taken.</b> Any word that looks like a note (<code>a</code>, <code>b</code>, <code>bb</code>, <code>e3</code>) means that note, so it cannot be a name you make up. That is why the examples call voices <code>tune</code> or <code>bass</code>, never <code>a</code>.</li>
         <li><b>Dots after a part change it.</b> <code>.inst(upright)</code> picks an instrument, <code>.vel(.5)</code> plays at half strength (velocity is how hard a key is struck). Later lessons add more, such as <code>.swing</code>.</li>
         <li><b>Short notes without a number</b>, like <code>[c e g]</code>, are in octave 4. Later lessons use this shortcut often.</li></ul>`,
        { code: `-- these two voices play exactly the same notes\nvoice long  = [c4 e4 g4 e4]\nvoice short = [c e g e].vel(.6)` },
        `<p>From the next lesson on, you will also see <code>tempo</code> at the top of examples and a few new shapes inside the brackets. Each one is explained when it first appears, and <b>Ask about this lesson</b> at the bottom of every page is there when an explanation is not enough.</p>`,
        { exercise: {
          task: `<p>This code has three mistakes. Fix them so <code>voice tune</code> plays <b>C4, E4, G4, E4</b> and <code>voice low</code> plays <b>C3</b>.</p>`,
          starter: `voice tune = [c4 e4g4 e4\nvoice b = [c3]`,
          solution: `voice tune = [c4 e4 g4 e4]\nvoice low = [c3]`,
          hint: `Look for a missing space, a missing bracket, and a voice name that is also a note name.`,
          check: (_s, n) => {
            const m = need(n, "tune") ?? need(n, "low"); if (m) return m;
            const t = line(n, "tune");
            if (JSON.stringify(t) !== "[60,64,67,64]") return `tune plays ${nms(t)}; it should be C E G E, in octave 4.`;
            return line(n, "low")[0] === 48 ? null : "low should play C3.";
          },
        } },
        { quiz: [
          { q: "Why can't a voice be named <code>b</code>?", options: ["Names must be long", "<code>b</code> is a note name", "Only <code>a</code> is allowed", "It can"], answer: 1 },
          { q: "What octave is <code>e</code> in when no number is given?", options: ["3", "4", "5"], answer: 1 },
          { q: "What does <code>.vel(.5)</code> do?", options: ["Plays at half strength", "Plays half as fast", "Plays half the notes", "Moves down half an octave"], answer: 0 },
        ] },
      ],
    },
  ],
};
