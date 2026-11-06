// Unit 2, Theory 102: how chords move. Function, cadence, voice leading, melody, and the jazz core: ii-V-I, blues, walking bass, form.
import type { Unit } from "./types";
import { of, groups, inBar, need, expectChords, barChords, onDegree, isChord, movement, nms, pc, pcset, chordPcs, nm, named, rootHeard } from "./check";

// Which degree a chord is built on, in a major key. An exact triad or seventh counts as itself
// (Gmaj7 is I, not iii). An extended chord (Em9, D13, G69) must stay in the key and stack up from one degree.
const MAJ = [0, 2, 4, 5, 7, 9, 11];
const PCN: Record<string, number> = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11 };
function degreeOf(semis: number[], tonic: number, degs: number[]): number | null {
  const exact = onDegree(semis, tonic, [1, 2, 3, 4, 5, 6, 7]);
  if (exact !== null) {
    if (degs.includes(exact)) return exact;
    // I6 has the notes of vi7: count it as I when the tonic is in the bass.
    return degs.includes(1) && exact === 6 && pc(Math.min(...semis)) === tonic ? 1 : null;
  }
  const set = new Set(pcset(semis));
  if (![...set].every(x => MAJ.includes((x - tonic + 12) % 12))) return null;
  const tone = (d: number, k: number) => (tonic + MAJ[(d - 1 + k) % 7]) % 12;
  const has = (d: number, ks: number[]) => ks.every(k => set.has(tone(d, k)));
  const cands = [1, 2, 3, 4, 5, 6, 7].filter(d => has(d, [0, 2, 4]));
  const stacked = cands.filter(d => has(d, [0, 2, 4, 6, 8]));
  let nmd: string | undefined; try { nmd = /^([A-G][b#]?)/.exec(named(semis) ?? "")?.[1]; } catch { nmd = undefined; }
  const byName = cands.find(d => nmd !== undefined && tone(d, 0) === PCN[nmd]);
  // Otherwise the chord's name decides, then the lowest note when its 3rd and 7th sit above it (a rootless voicing over its bass).
  const low = [1, 2, 3, 4, 5, 6, 7].find(d => tone(d, 0) === pc(Math.min(...semis)) && has(d, [0, 2, 6]));
  const d = stacked.length === 1 ? stacked[0] : byName ?? low ?? (cands.length === 1 ? cands[0] : null);
  return d !== null && degs.includes(d) ? d : null;
}
// The first chord in a bar plus any other pitched voice (a bass) sounding with it: what the ear hears.
function heard(n: Parameters<typeof of>[0], v: string, b: number): number[] | null {
  const g = groups(inBar(of(n, v), b)).find(x => x.semis.length >= 2); if (!g) return null;
  const under = n.filter(x => x.voice !== v && x.params?.inst !== "kit" && x.bar <= g.t + 2e-3 && x.bar + x.bars > g.t + 2e-3).map(x => x.semi);
  return [...under, ...g.semis].sort((p, q) => p - q);
}
// Has the chord's 3rd and 7th: rootless and extended voicings pass.
const guides = (semis: number[], root: number, third: number, seventh: number) => { const set = new Set(pcset(semis)); return set.has((root + third) % 12) && set.has((root + seventh) % 12); };

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
        { code: `-- Change the last ^1@7 to ^5@7, and the last ^1 in the bass to ^5: the phrase now stops on the leaning chord and never gets home.\nkey c major\nvoice chords = <^1@7 ^4@7 ^5@7 ^1@7>.voicelead\nvoice bass   = <^1 ^4 ^5 ^1>.octave(-2).inst(upright)`, bars: 4 },
        `<p>Those three jobs have names. Each diatonic chord does one of them, and that job is its <b>function</b>.</p>
         <ul><li><b>Tonic</b> (T): home. <b>I</b>, and its stand-ins <b>vi</b> and <b>iii</b>, which share two of its three notes.</li>
         <li><b>Predominant</b> (PD), also called subdominant: leaving home and heading for the dominant. <b>IV</b> and <b>ii</b>, which share ^4 and ^6.</li>
         <li><b>Dominant</b> (D): tension that wants home. <b>V</b> and <b>vii°</b>, which both hold the leading tone ^7. V7 and vii° also hold the tritone between ^4 and ^7.</li></ul>
         <p>The example you just heard is the path most tonal phrases follow: <b>T, PD, D, T</b>.</p>`,
        { code: `-- I vi ii V with a Charleston comp, bass and ride.\n-- Change ^6@7 to ^3@7 (and ^6 to ^3 in the bass): iii is the other tonic stand-in, and the progression still works.\ntempo 150\nkey c major\nvoice comp = ([0 . . 0 . . . .] + <^1@7 ^6@7 ^2@7 ^5@7>).voicelead.swing.vel(.6)\nvoice bass = ([0 0 0 0] + <^1 ^6 ^2 ^5>.octave(-2)).inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.45)`, bars: 4 },
        `<p>That is T, PD, D again. A second tonic chord, vi, follows I, and ii takes the place of IV. <b>I vi ii V</b> is one of the most common progressions in jazz. It is called a <b>turnaround</b> because it turns the tune back to the top.</p>
         <p><code>[0 . . 0 . . . .] + &lt;...&gt;</code> takes its rhythm from the left side and its chords from the right: zeros in the Charleston rhythm, one chord a bar.</p>`,
        { code: `-- IV V I, then ii V I. Listen to the bass under the first chord of each half.\n-- Change the first ^4@7 to ^2@7 (and ^4 to ^2 in the bass) and both halves become ii V I.\nkey c major\nvoice chords = <^4@7 ^5@7 ^1@7 . ^2@7 ^5@7 ^1@7 .>.voicelead\nvoice bass   = <^4 ^5 ^1 . ^2 ^5 ^1 .>.octave(-2).inst(upright)`, bars: 8 },
        `<p>Jazz prefers <b>ii</b> to IV as its predominant. ii goes to V by root motion of a fifth (D down to G, or up a fourth, the same move), the strongest root motion in tonal music. IV goes to V by a step. ii7 also shares three of its four notes with IV, so it does the same job.</p>
         <p>Classical harmony avoids moving backwards from D to PD. The blues does it on purpose: V7, IV7, I7 near the end of a basic blues chorus. <code>^4@dom7</code> below asks for a dominant seventh on ^4. A plain number after a degree counts scale tones, so <code>^4@7</code> would give Fmaj7. A name such as <code>dom7</code> gives a fixed quality.</p>`,
        { code: `-- V7 IV7 I7, the end of a blues chorus.\n-- Change ^4@dom7 to ^4@7 (Fmaj7): Eb becomes E, and the bluesy grit goes.\ntempo 120\nkey c major\nvoice comp = ([0 . . 0 . . . .] + <^5@dom7 ^4@dom7 ^1@dom7 ^1@dom7>).voicelead.swing.vel(.6)\nvoice bass = ([0 0 0 0] + <^5 ^4 ^1 ^1>.octave(-2)).inst(upright)`, bars: 4 },
        { code: `-- Partly done: bar 3 is empty. Put a dominant there (^5@7, and ^5 in the bass) and the phrase closes.\n-- Then try ^4@7 instead (and ^4 in the bass): it still gets home, but gently, with no tritone to resolve.\nkey c major\nvoice chords = <^6@7 ^2@7 . ^1@7>.voicelead\nvoice bass   = <^6 ^2 . ^1>.octave(-2).inst(upright)`, bars: 4 },
        { exercise: {
          task: `<p>In <b>G major</b>, write <code>voice prog</code>: four bars, one chord per bar, following <b>T, PD, D, T</b>. Bar 1 must be a tonic-function chord <b>other than I</b>, bar 2 a predominant, bar 3 a dominant, bar 4 the I chord. Triads or seventh chords are fine.</p>`,
          starter: `key g major\nvoice prog = <^1@7 ^1@7 ^1@7 ^1@7>`,
          solution: `key g major\nvoice prog = <^6@7 ^2@7 ^5@7 ^1@7>.voicelead`,
          hint: `<p>The tonic stand-ins are ^3 and ^6. The predominants are ^2 and ^4. The dominants are ^5 and ^7.</p>`,
          bars: 4,
          check: (_s, n) => {
            const m = need(n, "prog"); if (m) return m;
            const c = [0, 1, 2, 3].map(b => heard(n, "prog", b)), G = 7;
            const spec: [number[], string][] = [[[3, 6], "a tonic substitute (iii or vi)"], [[2, 4], "a predominant (ii or IV)"], [[5, 7], "a dominant (V or vii°)"], [[1], "the I chord"]];
            for (let b = 0; b < 4; b++) {
              if (!c[b]) return `Bar ${b + 1} has no chord.`;
              if (b === 0 && degreeOf(c[b]!, G, [1]) !== null) return `Bar 1 (${nms(c[b]!)}) is the I chord itself; the task asks for a tonic stand-in (iii or vi).`;
              if (degreeOf(c[b]!, G, spec[b][0]) === null) return `Bar ${b + 1} (${nms(c[b]!)}) should be ${spec[b][1]} in G major.`;
            }
            return null;
          },
        } },
        { quiz: [
          { q: "What is the function of vi?", options: ["Tonic", "Predominant", "Dominant"], answer: 0, explain: "It shares two notes with I and often replaces it." },
          { q: "Which two chords have dominant function?", options: ["I and V", "V and vii°", "ii and IV", "iii and vii°"], answer: 1, explain: "Both hold the leading tone, ^7, which pulls up to ^1. V7 and vii° also hold the tritone ^4-^7." },
          { q: "Listen. The first chord is home. Does the phrase end on a tonic or a dominant?", listen: `key f major\nvoice x = <^1@3 ^6@3 ^2@3 ^5@3>.voicelead\nvoice b = <^1 ^6 ^2 ^5>.octave(-2).inst(upright)`, bars: 4, options: ["Tonic", "Dominant"], answer: 1, explain: "It stops on V (C major in F), so it sounds unfinished." },
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
        { code: `-- Ending A.\n-- Change the top line's last ^1 to ^3: the melody now ends on A, and the stop is a little less final.\nkey f major\nvoice chords = <^5@7 ^1@3>.voicelead\nvoice bass   = <^5 ^1>.octave(-2).inst(upright)\nvoice top    = <[^2 _ _ ^7.octave(-1)] [^1 _ _ .]>.octave(1).inst(vibes)`, bars: 2 },
        { code: `-- Ending B, played twice. The second time the first chord is minor.\n-- Change ^4@m to ^4@3 and the two halves match.\nkey f major\nvoice chords = <^4@3 ^1@3 ^4@m ^1@3>.voicelead\nvoice bass   = <^4 ^1 ^4 ^1>.octave(-2).inst(upright)`, bars: 4 },
        { code: `-- Ending C. Change ^6@7 to ^1@7 (and ^6 to ^1 in the bass) and the surprise is gone.\nkey f major\nvoice chords = <^2@7 ^5@7 ^6@7 .>.voicelead\nvoice bass   = <^2 ^5 ^6 .>.octave(-2).inst(upright)`, bars: 4 },
        { code: `-- Ending D. Replace the final . with ^1@3 (and ^1 in the bass): the question gets its answer.\nkey f major\nvoice chords = <^1@3 ^2@7 ^5@3 .>.voicelead\nvoice bass   = <^1 ^2 ^5 .>.octave(-2).inst(upright)`, bars: 4 },
        `<p>Each of those is a <b>cadence</b>, the harmonic punctuation at the end of a phrase.</p>
         <ul><li>A is <b>authentic</b>: V (or V7) to I. With both chords in root position and the melody ending on the tonic, it is a <b>perfect authentic cadence</b>, the full stop. Ending the melody on ^3, as in the suggested edit, makes it <b>imperfect</b>.</li>
         <li>B is <b>plagal</b>: IV to I, the "amen" at the end of a hymn. Its second half, <b>iv to I</b>, is the minor plagal, all over gospel and ballads.</li>
         <li>C is <b>deceptive</b>: V to vi. The ear expects I and gets its relative minor.</li>
         <li>D is a <b>half cadence</b>: the phrase stops on V. A comma, or a question.</li></ul>`,
        { code: `-- ii-V-I in Bb. The piano leaves the roots to the bass (rootless voicings, lesson 14).\n-- Change Bb69 to Bb7: the ending stops sounding final, because its seventh, Ab, makes the chord lean on toward Eb.\ntempo 140\nlet tune = changes("Cm9 | F13 | Bb69 | %")\nvoice comp = ([0 . . 0 . . . .] + tune).rootless.voicelead.swing.vel(.6)\nvoice bass = ([0 0 0 0] + tune.root.octave(-1)).inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.45)`, bars: 4 },
        `<p>That is <b>ii-V-I</b>, jazz's standard cadence: a predominant, a dominant and a tonic, with roots falling by fifths. Whole tunes are chains of them, and lesson 14 is devoted to it. Jazz also stretches the final chord to <code>maj7</code>, <code>6</code> or <code>69</code>. In a jazz setting a plain triad sounds square.</p>`,
        { code: `-- Partly done, in G major: bar 2 is empty.\n-- Put ^1@3 there, and ^1 in the bass, for an authentic cadence. Then try ^6@3 (and ^6 in the bass) for a deceptive one and compare.\nkey g major\nvoice prog = <^5@7 .>.voicelead\nvoice bass = <^5 .>.octave(-2).inst(upright)`, bars: 2 },
        { exercise: {
          task: `<p>Write <code>voice prog</code>: a <b>deceptive cadence in D major</b>. Bar 1 is the dominant (V or V7), bar 2 the chord the ear did not expect (vi or vi7). If you use <code>.rootless</code>, add a bass that plays the roots.</p>`,
          starter: `key d major\nvoice prog = <^5@7 ^1@3>`,
          solution: `key d major\nvoice prog = <^5@7 ^6@7>.voicelead`,
          bars: 2,
          check: (_s, n) => {
            const m = need(n, "prog"); if (m) return m;
            const c = [0, 1].map(b => heard(n, "prog", b));
            if (c[0] && JSON.stringify(pcset(c[0])) === JSON.stringify([2, 5, 7, 11])) return "That is G7, V of C major. Without a key line, degrees count from C. Put key d major at the top.";
            const ps = c.map(x => x ? new Set(pcset(x)) : new Set<number>());
            if (c[0] && degreeOf(c[0], 2, [5]) === null && ps[0].has(1) && ps[0].has(7) && !ps[0].has(9)) return `Bar 1 has A7's 3rd and 7th (C# and G), but nothing plays its root, A. Put A in the chord, or add a bass that plays it.`;
            if (c[1] && degreeOf(c[1], 2, [6]) === null && ps[1].has(2) && ps[1].has(6) && !ps[1].has(11)) return `Bar 2 has Bm's 3rd and 5th (D and F#), but nothing plays its root, B. Put B in the chord, or add a bass that plays it.`;
            if (!c[0] || degreeOf(c[0], 2, [5]) === null) return `Bar 1 should be V in D major (A or A7); you have ${c[0] ? nms(c[0]) : "single notes or a rest, not a chord (write ^5@7, not ^5)"}.`;
            if (!c[1] || degreeOf(c[1], 2, [6]) === null) return `Bar 2 should be vi in D major (Bm or Bm7); you have ${c[1] ? nms(c[1]) : "single notes or a rest, not a chord (write ^6@7, not ^6)"}.`;
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
        { code: `-- Two voices a fifth apart, moving together. Listen: they fuse into one hollow line.\n-- Change the upper notes to e3 f3 g3 a3, a third above the bass each time: still parallel, but sweet and full instead of hollow.\nvoice fifths = [{c3 g3} {d3 a3} {e3 b3} {f3 c4}]` },
        `<p>That hollow sound is <b>parallel fifths</b>: two voices a fifth apart moving to another fifth. Parallel octaves do the same. Classical rules avoid both because two lines merge into one. One cure is <b>contrary motion</b>, where one voice goes up while the other goes down.</p>`,
        { code: `-- G7 to C. B rises to C, and F falls to E.\n-- Change the last note e4 to f4: the F no longer resolves, and the C chord sounds wrong.\nvoice resolve = [{g2 b3 d4 f4} _ {c3 c4 c4 e4} _]` },
        `<p>Some notes have a direction built in. These are <b>tendency tones</b>. The <b>leading tone rises</b> a half step to the tonic. A <b>chordal seventh falls</b> by step. In the example, B is the leading tone and F the seventh of G7. (D falls to C too, so C appears twice; that is normal.)</p>`,
        { code: `-- Two lines: the third and the seventh of each chord, over the bass.\n-- Delete .guide to hear the full chords. The two lines are still inside them.\nlet tune = changes("Dm7 | G7 | Cmaj7 | Fmaj7 | Bm7b5 | E7 | Am7 | %")\nvoice guide = tune.guide.voicelead(around: g4).inst(vibes)\nvoice bass  = tune.root.octave(-1).inst(upright)\nvoice ride  = [ride [ride ride] ride [ride ride]].swing.vel(.4)`, bars: 8 },
        `<p>Those are <b>guide tones</b>, and the two melodies they make are a <b>guide-tone line</b>, the most important voice leading in jazz. The third and seventh tell maj7, m7 and 7 apart. In a chain of falling fifths the seventh of each chord falls a half or whole step to the third of the next, and the other guide tone usually holds. Dm7's C falls to G7's B while F holds. G7's F falls to Cmaj7's E while B holds. Into a minor chord, a dominant's third slips down a half step instead: E7's G# falls to G in Am7. Soloists play these lines to make the changes audible without a piano.</p>`,
        { code: `-- Partly done: F, Dm, Bb, C. Bar 1 and bar 2 are voiced by hand, close together.\n-- Voice bar 3 (Bb) and bar 4 (C) the same way: try {f4 bb4 d5} and {e4 g4 c5}.\nvoice chords = <{f4 a4 c5} {f4 a4 d5} {bb3 d4 f4} {c4 e4 g4}>`, bars: 4 },
        { exercise: {
          task: `<p>Write <code>voice chords</code> playing <b>C, Am, F, G</b> as three-note chords, one per bar, so that the voice leading is smooth: from each chord to the next, the voices together move <b>no more than 6 half steps</b> in total. Voice them by hand or let Tine help.</p>`,
          starter: `voice chords = <c4@maj a3@m f3@maj g3@maj>`,
          solution: `voice chords = <c4@maj a3@m f3@maj g3@maj>.voicelead`,
          bars: 4,
          check: (_s, n) => {
            const m = need(n, "chords"); if (m) return m;
            const c = barChords(n, "chords", 4);
            const want: [number, string][] = [[0, ""], [9, "m"], [5, ""], [7, ""]];
            for (let b = 0; b < 4; b++) if (!c[b] || !isChord(c[b]!, want[b][0], want[b][1])) return `Bar ${b + 1} should be ${["C", "Am", "F", "G"][b]}${c[b] ? `; you have ${nms(c[b]!)}` : ""}.`;
            for (let b = 0; b < 4; b++) if (c[b]!.length !== 3) return `Bar ${b + 1} has ${c[b]!.length} notes; use three-note chords.`;
            for (let b = 1; b < 4; b++) { const mv = movement(c[b - 1]!, c[b]!); if (mv > 6) return `From bar ${b} to bar ${b + 1} the voices move ${mv === Infinity ? "unevenly (different numbers of notes)" : mv + " half steps"}. Try another inversion of bar ${b + 1}.`; }
            return null;
          },
        } },
        { quiz: [
          { q: "Listen. The same four chords in C, played twice. Which time is voice-led?", listen: `voice x = <c4@maj f4@maj g4@maj c4@maj {c4 e4 g4} {c4 f4 a4} {b3 d4 g4} {c4 e4 g4}>`, bars: 8, options: ["The first time", "The second time"], answer: 1, explain: "The second time C holds into F, and no voice moves more than three half steps. The first time every chord jumps." },
          { q: "In G major, where does the leading tone F# usually go?", options: ["G", "E", "D", "F"], answer: 0, explain: "Up a half step to the tonic." },
          { q: "In Dm7 to G7, which note of Dm7 falls a half step to become the third of G7?", options: ["D", "F", "A", "C"], answer: 3, explain: "C, the seventh of Dm7, falls to B." },
          { q: "Which move makes parallel fifths?", options: ["C-G to D-A", "C-E to D-F", "C-G to B-G", "C-G to C-A"], answer: 0, explain: "Both voices move up a step and stay a fifth apart. C-E to D-F is parallel thirds, which is fine." },
          { q: "From the cadence lesson: V to vi is which cadence?", options: ["Authentic", "Half", "Plagal", "Deceptive"], answer: 3 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "nonchord", title: "Melody and nonchord tones",
      parts: [
        `<p>The pad below holds Cmaj7 (C E G B). Listen to the line over it. Two of its notes are not in the chord, yet nothing sounds wrong.</p>`,
        { code: `-- C D E, then E F E. D and F are not in the chord.\n-- Change f5 to d5: it is still a step away and back, now from below.\nvoice pad = c3@maj7.inst(pad).vel(.4)\nvoice top = [c5 d5 e5 f5 e5 _ _ .].inst(vibes)` },
        `<p>Notes outside the chord are <b>nonchord tones</b>. The ear accepts them when they move by step between chord tones. D is a <b>passing tone</b>: it steps from C to E in one direction. F is a <b>neighbor tone</b>: it steps up from E and back down to it.</p>`,
        { code: `-- Cmaj7 for two beats, then G. The C in the top line is held as the chord changes under it.\n-- Change [c5 _ _ b4] to [c5 _ b4 _]: B now arrives with the G chord, and the tension is gone.\nvoice pad = [c3@maj7 g3@maj].inst(pad).vel(.4)\nvoice top = [c5 _ _ b4].inst(vibes)` },
        `<p>That is a <b>suspension</b>. C belonged to the first chord, was held into the second where it clashes, then fell by step to B, a chord tone of G. C is a fourth above the bass G and B is a third, so this is a <b>4-3 suspension</b>.</p>`,
        { code: `-- Bar 1 over G: a leap up to E on beat 3, then a step down to D.\n-- Bar 2 over Cmaj7: a step up to F, then a leap down to C.\n-- Change e5 in bar 1 to d5 and the leap lands on a chord tone: no tension at all.\nvoice pad = <g3@maj c3@maj7>.inst(pad).vel(.4)\nvoice top = <[g4 _ e5 d5] [e5 f5 c5 _]>.inst(vibes)`, bars: 2 },
        `<p>The E in bar 1 is an <b>appoggiatura</b>: reached by leap, on a strong beat, resolved by step. The F in bar 2 is an <b>escape tone</b>: reached by step, left by leap the other way.</p>`,
        { code: `-- G7 for three beats, then Cmaj7 on beat 4. The top line's C arrives half a beat before its chord.\n-- Change [d5 _ b4 _ _ c5 _ _] to [d5 _ b4 _ _ _ c5 _]: now C waits for the chord.\nvoice pad = [g3@7 _ _ _ _ _ c3@maj7 _].inst(pad).vel(.4)\nvoice top = [d5 _ b4 _ _ c5 _ _].inst(vibes)` },
        `<p>An early note like that is an <b>anticipation</b>. In jazz it is the push you met in the rhythm lesson. Here are all six side by side.</p>
         <table class="t"><tr><th>name</th><th>approach</th><th>leave</th></tr>
         <tr><td>passing tone</td><td>step</td><td>step, same direction</td></tr>
         <tr><td>neighbor tone</td><td>step</td><td>step back</td></tr>
         <tr><td>suspension</td><td>held over from the last chord</td><td>step down</td></tr>
         <tr><td>appoggiatura</td><td>leap, on a strong beat</td><td>step</td></tr>
         <tr><td>escape tone</td><td>step</td><td>leap the other way</td></tr>
         <tr><td>anticipation</td><td>arrives early</td><td>stays as a chord tone</td></tr></table>`,
        { code: `-- A bebop line over Cmaj7. Listen for E and for the G on beat 4: each is reached from outside.\n-- Change d#5 to f5: E is now approached from above instead of below.\ntempo 160\nvoice pad = [c3@maj7].inst(pad).vel(.35)\nvoice line = [c5 d#5 e5 g5 a5 f#5 g5 .].swing.inst(vibes)` },
        `<p>Jazz players lean on two more devices. A <b>chromatic approach</b> slides into a chord tone from a half step away: D# into E. An <b>enclosure</b> surrounds the target, one note above and one below, then lands on it: A and F# around G. The general rule of a bebop line is <b>chord tones on the beat, color between</b>. Enclosures bend it: the note above the target may sit on a beat, as long as the target lands on the next one.</p>`,
        { code: `-- Partly done, over Fmaj7: chord tones on the beats, and rests after A, C and E.\n-- Fill them with notes outside the chord: bb4 after a4, d5 after c5, and d5 at the end.\nvoice pad = f3@maj7.inst(pad).vel(.4)\nvoice line = [f4 g4 a4 . c5 . e5 .].swing.inst(vibes)` },
        { exercise: {
          task: `<p>Over a bar of <b>Cmaj7</b>, write <code>voice line</code>: eight eighth notes. Every note <b>on a beat</b> (notes 1, 3, 5 and 7) must be a <b>chord tone</b> (C, E, G or B). At least <b>two</b> of the notes between beats must <b>not</b> be chord tones.</p>`,
          starter: `voice pad = c3@maj7.inst(pad)\nvoice line = [c5 e5 g5 b5 g5 e5 c5 e5]`,
          solution: `voice pad = c3@maj7.inst(pad)\nvoice line = [c5 d5 e5 f#5 g5 a5 b5 a5].swing`,
          check: (_s, n) => {
            const m = need(n, "line"); if (m) return m;
            const g = groups(inBar(of(n, "line"), 0));
            if (g.length !== 8) return `That is ${g.length} notes; write 8 eighths.`;
            const ct = new Set([0, 4, 7, 11]);
            for (let i = 0; i < 8; i += 2) if (!ct.has(pc(g[i].semis[0]))) return `Note ${i + 1} (${nm(g[i].semis[0], "sharps")}) is on a beat but is not in Cmaj7.`;
            const off = [1, 3, 5, 7].filter(i => !ct.has(pc(g[i].semis[0]))).length;
            return off >= 2 ? null : `${off === 0 ? "None of the notes between beats are" : "Only one note between beats is"} outside the chord; make at least two of them passing, neighbor or approach tones.`;
          },
        } },
        { quiz: [
          { q: "Listen. The pad holds C major. Which note of the line is not in the chord?", listen: `voice pad = c3@maj.inst(pad).vel(.4)\nvoice top = [c5 e5 f5 e5].inst(vibes)`, bars: 1, options: ["The first", "The second", "The third", "The fourth"], answer: 2, explain: "F, a neighbor tone between two Es." },
          { q: "A note that steps away from a chord tone and steps back is a...", options: ["passing tone", "neighbor tone", "escape tone", "suspension"], answer: 1 },
          { q: "In a 4-3 suspension, the dissonant note...", options: ["leaps up", "resolves down by step", "resolves up by step", "is repeated"], answer: 1, explain: "The fourth above the bass falls to the third." },
          { q: "Name the notes of an enclosure of E that approaches from above first.", options: ["F, D#, E", "E, F, G", "C, E, G", "D, E, F"], answer: 0, explain: "Above, below, then the target." },
          { q: "From the voice-leading lesson: which way does the seventh of a chord tend to move?", options: ["Up by step", "Down by step", "Up a fifth", "It stays put"], answer: 1, explain: "A chordal seventh falls by step, like the F of G7 falling to E." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "twofive", title: "The ii-V-I",
      parts: [
        `<p>The ii-V-I is the most common progression in jazz. Here it is in Bb, the trumpet and tenor key, with the bass on roots.</p>`,
        { code: `-- Cm7, F7, Bbmaj7. Listen to the bass: each root falls a fifth (or rises a fourth).\n-- Change Bbmaj7 to Bbm7 and the same move lands in a darker home.\ntempo 120\nlet tune = changes("Cm7 | F7 | Bbmaj7 | %")\nvoice comp = tune.voicelead\nvoice bass = tune.root.octave(-1).inst(upright)`, bars: 4 },
        `<p>That is <b>ii7, V7, Imaj7</b>. Three forces push it forward. The roots fall by fifths (C, F, Bb). Each chord's seventh falls a half step to the next chord's third: Bb to A, then Eb to D. The dominant's tritone (A and Eb) resolves into the tonic. Standards are strings of ii-Vs moving through keys, so jazz musicians practice them in all twelve.</p>`,
        { code: `-- Bar 1: the three chords in rootless A form. Bar 2: B form. Bar 3: A, B, A, the smooth way.\n-- Change form: "b" to form: "a" in bar 2 and the first two bars match.\nprint(name(c3@m7.rootless), "|", name(f3@7.rootless), "|", name(bb3@maj7.rootless))\nvoice v = cat([c3@m7 f3@7 bb3@maj7 .].rootless, [c3@m7 f3@7 bb3@maj7 .].rootless(form: "b"), [(c3@m7.rootless) (f3@7.rootless(form: "b")) (bb3@maj7.rootless) .])`, bars: 3 },
        `<p>Pianists rarely play roots; the bassist has them. A <b>rootless voicing</b> keeps four notes: the 3rd, the 7th and two colors. On ii and I the colors are the 5th and 9th. On V the 13th replaces the 5th. Starting on the 3rd is the <b>A form</b>, starting on the 7th the <b>B form</b>. Played in turn, an A-form ii goes smoothly to a B-form V and back to an A-form I. <code>.rootless.voicelead</code> finds smooth inversions like these for you, though not always the textbook A or B shape.</p>`,
        { code: `-- The A-form Cm9 voicing, alone.\n-- Change v to {c3 eb3 g3 bb3 d4} (add the root back): the name becomes Cm9.\nlet v = {eb3 g3 bb3 d4}\nprint(name(v))\nvoice x = v` },
        `<p>Cm9 without its root is Ebmaj7. Rootless voicings are ambiguous by design: the bass note decides what they mean.</p>`,
        { code: `-- Comping in the Charleston rhythm over a ii-V-I and a G7 back to the top.\n-- Change the charleston to [. . . 0 . . . 0]: chords only on the "and" of 2 and of 4, pushing the bar forward. Delete .voicelead and hear the chords jump between bars.\ntempo 150\nlet charleston = [0 . . 0 . . . .]\nlet tune = changes("Cm7 | F7 | Bbmaj7 | G7")\nvoice comp = (charleston + tune).rootless.voicelead.swing.vel(.6)\nvoice bass = ([0 0 0 0] + tune.root.octave(-1)).inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.45)\nvoice hat  = [. pedal . pedal].vel(.5)`, bars: 4 },
        `<p>As in lesson 10, a rhythm of zeros plus the changes gives chords in that rhythm. The G7 in bar 4 is the V of Cm7, turning the progression back to the top. You will meet it again as a secondary dominant. The bass only repeats roots; a real bassist walks, which is the lesson after next.</p>`,
        { code: `-- Partly done, in G: Am7 (A form) and D7 (B form) are voiced by hand.\n-- Replace the two rests with Gmaj7 in A form: 3rd, 5th, 7th, 9th from the bottom. Try {b3 d4 f#4 a4}.\nvoice comp = <{c4 e4 g4 b4} {c4 e4 f#4 b4} . .>\nvoice bass = <a2 d2 g2 g2>.inst(upright)`, bars: 4 },
        { exercise: {
          task: `<p>Write <code>voice comp</code>: a ii-V-I in <b>Eb major</b> (Fm7 for a bar, Bb7 for a bar, Ebmaj7 for two bars) with <b>rootless voicings written by hand</b>, four notes each. Use the <b>A form</b> (3rd on the bottom) on Fm7 and Ebmaj7, and the <b>B form</b> (7th on the bottom) on Bb7, so the hands barely move.</p>`,
          starter: `voice comp = <. . . .>`,
          solution: `voice comp = <{ab3 c4 eb4 g4} {ab3 c4 d4 g4} {g3 bb3 d4 f4} {g3 bb3 d4 f4}>`,
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
              const low = pc(Math.min(...ch)), form = b === 1 ? "B" : "A", bot = form === "A" ? third : seventh;
              if (low !== bot) return `Bar ${b + 1} (${nms(ch)}) starts on ${nm(low)}. The ${form} form on ${nmn} puts its ${form === "A" ? "3rd" : "7th"}, ${nm(bot)}, on the bottom.`;
            }
            return null;
          },
        } },
        { quiz: [
          { q: "Listen. How many different chords do you hear before it repeats?", listen: `tempo 110\nlet tune = changes("Dm7 | G7 | Cmaj7 | %")\nvoice c = tune.rootless.voicelead\nvoice b = tune.root.octave(-1).inst(upright)`, bars: 4, options: ["Two", "Three", "Four"], answer: 1, explain: "ii, V, then I held for two bars." },
          { q: "Listen. The first chord is home. Is the second chord ii or IV?", listen: `tempo 110\nlet tune = changes("Fmaj7 | Gm7 | C7 | Fmaj7")\nvoice c = tune.rootless.voicelead\nvoice b = tune.root.octave(-1).inst(upright)`, bars: 4, options: ["ii", "IV"], answer: 0, explain: "Gm7 in F: a minor chord, and the bass falls a fifth to C. IV would be a major chord a step below V." },
          { q: "What are the guide tones of G7?", options: ["G and D", "B and F", "D and F", "G and B"], answer: 1, explain: "The 3rd and 7th." },
          { q: "In a rootless voicing for a dominant chord, what usually replaces the 5th?", options: ["The root", "The 13th", "The 11th", "The b9"], answer: 1 },
          { q: "From the cadence lesson: ii-V-I ends with which kind of cadence?", options: ["Authentic", "Half", "Plagal", "Deceptive"], answer: 0, explain: "V to I: an authentic cadence with a predominant in front." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "blues", title: "The twelve-bar blues",
      parts: [
        `<p>Here is one chorus of a blues in F: twelve bars, with piano, bass and drums. Count the bars as it plays, and notice where the harmony moves.</p>`,
        { code: `-- A basic blues in F. Listen for the change in bar 2.\n-- Change the Bb7 in bar 2 to F7 and hear the opening chord sit for four bars.\ntempo 120\nlet chorus = changes("F7 | Bb7 | F7 | % | Bb7 | % | F7 | % | C7 | Bb7 | F7 | C7")\nvoice comp = ([0 . . 0 . . . .] + chorus).rootless.voicelead.swing.vel(.6)\nvoice bass = ([0 0 0 0] + chorus.root.octave(-1)).inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.45)\nvoice hat  = [. pedal . pedal].vel(.5)`, bars: 12 },
        `<p>The <b>twelve-bar blues</b> is three four-bar phrases on three chords, I, IV and V. Every chord is a dominant seventh, including the tonic. That breaks a classical rule (a dominant seventh on I "should" resolve to IV), and the sound is the point.</p>
         <table class="t"><tr><td>I7</td><td>I7 (or IV7)</td><td>I7</td><td>I7</td></tr><tr><td>IV7</td><td>IV7</td><td>I7</td><td>I7</td></tr><tr><td>V7</td><td>IV7</td><td>I7</td><td>V7</td></tr></table>
         <p>Playing IV7 in bar 2 is called a <b>quick four</b>. The V7 in the last bar turns the form back to the top.</p>`,
        { code: `-- The jazz blues in F.\n-- Change Bdim7 in bar 6 back to Bb7 and the bass step from Bb up to B becomes a repeated Bb.\ntempo 140\nlet chorus = changes("F7 | Bb7 | F7 | Cm7 F7 | Bb7 | Bdim7 | F7 | D7 | Gm7 | C7 | F7 D7 | Gm7 C7")\nvoice comp = ([0 . . 0 0 . . 0] + chorus).rootless.voicelead.swing.vel(.6)\nvoice bass = ([0 0 0 0] + chorus.root.octave(-1)).inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.45)`, bars: 12 },
        `<p>Jazz musicians reharmonize the blues. Bar 4 becomes a ii-V into IV. Bar 6 swaps IV7 for a passing diminished chord, Bdim7. Bar 8 becomes D7, the dominant of Gm7. Bars 9 and 10 become a ii-V. Bars 11 and 12 are a I VI7 ii V turnaround (VI7 is vi made into a dominant). This is the <b>jazz blues</b>, and Theory 201 explains every substitution in it.</p>`,
        { code: `-- A blues melody over the basic blues. Listen for which phrase is new.\n-- Change ^3 in the riff to ^4 (Cb, the flat five; it sounds as B) for more bite.\ntempo 120\nkey f blues\nlet riff = [^5 ^6 ^5 ^3 ^2 ^1 . .]\nlet chorus = changes("F7 | Bb7 | F7 | % | Bb7 | % | F7 | % | C7 | Bb7 | F7 | C7")\nvoice horn = cat(riff, [.], riff, [.], riff, [.], riff, [.], [^7 _ ^6 ^5 ^4 ^3 ^2 ^1], [.], [^1 _ _ _], [.]).swing.inst(lead).vel(.55)\nvoice comp = chorus.rootless.voicelead.vel(.4)\nvoice bass = chorus.root.octave(-1).inst(upright)`, bars: 12 },
        `<p>Blues melodies often use the blues scale over all three chords. In F, the blue third (Ab) rubs against the major third of F7 (A), yet it is the seventh of Bb7. One scale, three chords, a different tension on each. The form of the melody is often <b>AAB</b>: a four-bar phrase, the same phrase again over IV, and a different answer in the last four bars.</p>`,
        { code: `-- Partly done, in G: bars 1 to 8 are written.\n-- Add the last four bars, V7 IV7 I7 V7 (D7, C7, G7, D7), to the chorus.\nlet chorus = changes("G7 | C7 | G7 | % | C7 | % | G7 | %")\nvoice comp = chorus.rootless.voicelead\nvoice bass = chorus.root.octave(-1).inst(upright)`, bars: 8 },
        { exercise: {
          task: `<p>Write <code>voice comp</code>: a basic twelve-bar blues in <b>Bb</b>, with a quick four in bar 2 and V7 in the last bar. Every chord is a dominant seventh. (<code>changes</code> with <code>%</code> to repeat a bar will save typing.)</p>`,
          starter: `voice comp = changes("Bb7 | % | % | %")`,
          solution: `voice comp = changes("Bb7 | Eb7 | Bb7 | % | Eb7 | % | Bb7 | % | F7 | Eb7 | Bb7 | F7")`,
          bars: 12,
          check: (_s, n) => {
            const m = need(n, "comp"); if (m) return m;
            const c = barChords(n, "comp", 12), roots = blues(10);
            const dom = (ch: number[], rt: number) => { const set = new Set(pcset(ch)); return guides(ch, rt, 4, 10) && !set.has((rt + 11) % 12) && !set.has((rt + 5) % 12); };
            for (let b = 0; b < 12; b++) {
              if (!c[b] || !dom(c[b]!, roots[b])) return `Bar ${b + 1} should be ${nm(roots[b])}7${c[b] ? `; you have ${nms(c[b]!)}` : ""}.`;
              const t = groups(inBar(of(n, "comp"), b)).find(g => g.semis.length >= 2)!.t;
              if (!rootHeard(n, "comp", t, roots[b], c[b]!)) return `Bar ${b + 1} should be ${nm(roots[b])}7, but nothing plays its root, ${nm(roots[b])}. You have ${nms(c[b]!)}. Put ${nm(roots[b])} in the chord, or add a bass that plays it.`;
            }
            return null;
          },
        } },
        { quiz: [
          { q: "Listen. The first chord is I7. In which bar does IV7 first arrive?", listen: `tempo 160\nlet chorus = changes("F7 | % | % | % | Bb7 | % | F7 | %")\nvoice c = chorus.rootless.voicelead\nvoice b = chorus.root.octave(-1).inst(upright)`, bars: 8, options: ["Bar 2", "Bar 5", "Bar 9"], answer: 1, explain: "No quick four here: the I chord holds for four bars and IV arrives in bar 5." },
          { q: "Listen. Is this a basic blues or a jazz blues?", listen: `tempo 160\nlet chorus = changes("F7 | Bb7 | F7 | Cm7 F7 | Bb7 | Bdim7 | F7 | D7 | Gm7 | C7 | F7 D7 | Gm7 C7")\nvoice c = chorus.rootless.voicelead\nvoice b = chorus.root.octave(-1).inst(upright)`, bars: 12, options: ["Basic blues", "Jazz blues"], answer: 1, explain: "Listen for the ii-V in bars 9 and 10 and the turnaround." },
          { q: "In a basic blues, which chord is in bar 9?", options: ["I7", "IV7", "V7", "ii7"], answer: 2 },
          { q: "What quality is the I chord in a blues?", options: ["Major seventh", "Dominant seventh", "Minor seventh", "A plain triad"], answer: 1, explain: "Every chord in a basic blues is a dominant seventh." },
          { q: "From the ii-V-I lesson: in the jazz blues in F, Gm7 C7 in bars 9 and 10 lead to which chord?", options: ["Bb7", "C7", "F7", "D7"], answer: 2, explain: "Gm7 C7 is ii-V of F, and bar 11 is F7." },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "walking", title: "Walking bass",
      parts: [
        `<p>Two bass lines over the same ii-V-I in C. Listen to how differently they move the time.</p>`,
        { code: `-- Half notes on roots and fifths: a "two-feel".\n-- Change tempo 130 to tempo 190: the ride gets busy, but the bass still moves only twice a bar, so the band sounds relaxed.\ntempo 130\nvoice two  = <[d2 _ a2 _] [g2 _ d2 _] [c2 _ g2 _] [c2 _ g2 _]>.inst(upright)\nvoice comp = changes("Dm7 | G7 | Cmaj7 | %").rootless.voicelead.vel(.5)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.4)`, bars: 4 },
        { code: `-- Quarter notes: a walking line.\n-- Change ab2 at the end of bar 1 to f#2: G is now approached from below instead of above.\ntempo 130\nvoice walk = <[d2 f2 a2 ab2] [g2 f2 d2 db2] [c2 d2 e2 b1] [c2 e2 g2 eb2]>.inst(upright)\nvoice comp = changes("Dm7 | G7 | Cmaj7 | %").rootless.voicelead.vel(.5)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.4)`, bars: 4 },
        `<p>The first is a <b>two-feel</b>: half notes on roots and fifths. Bassists use it under a melody to leave room. The second is a <b>walking bass</b>: steady quarter notes that spell out the harmony and drive the time. The method most bassists learn:</p>
         <ul><li>Beat 1: the <b>root</b> of the chord.</li>
         <li>Beats 2 and 3: other chord tones or scale steps.</li>
         <li>Beat 4: an <b>approach note</b> into the next bar's root, a half step above or below, or a scale step.</li></ul>
         <p>In the line above, every beat 4 is a half step from the next root: Ab into G, Db into C, B into C, Eb into D.</p>`,
        { code: `-- The method as code. Change (root(nxt) - 1) to (root(nxt) + 1): every approach now comes from above.\ntempo 140\nlet chords = [d3@m7 g3@7 c3@maj7 a3@7]\nlet walk(bar) =\n  let now = at(chords, bar)\n  let nxt = at(chords, bar + 1)\n  [root(now) at(tones(now), 1) at(tones(now), 2) (root(nxt) - 1)].octave(-1)\nvoice bass = per_bar(walk).inst(upright)\nvoice comp = per_bar(bar => at(chords, bar)).rootless.voicelead.vel(.5)`, bars: 4 },
        `<p><code>let walk(bar) =</code> defines a function: an indented recipe that takes a bar number and returns that bar's notes. Its last line is the result. <code>per_bar(walk)</code> calls it once for every bar. The function gets the bar number, looks up this bar's chord and the next, and builds four notes: root, third, fifth, and a half step below the next root. <code>tones</code> lists a chord's notes from the bottom, so <code>at(tones(now), 1)</code> is its third. <code>at(list, i)</code> picks item i, counting from 0, and wraps around, so after the last bar the next chord is the first. Listen for the leap in bar 2, from D3 down to B1, more than an octave. The function always uses the same octave. A bassist picks octaves to keep the line mostly stepwise, as the hand-written line did.</p>`,
        { code: `-- Partly done: roots on beat 1, chord tones on 2 and 3. Beat 4 is a rest in every bar.\n-- Fill each rest with a half step into the next root: ab2 (or f#2), db2 (or b1), b1 (or db2), c#2 (or eb2).\nvoice bass = <[d2 f2 a2 .] [g2 f2 d2 .] [c2 e2 g2 .] [c2 e2 g2 .]>.inst(upright)\nvoice comp = changes("Dm7 | G7 | Cmaj7 | %").rootless.voicelead.vel(.5)`, bars: 4 },
        { exercise: {
          task: `<p>Over <b>Gm7 | C7 | Fmaj7 | Fmaj7</b>, write <code>voice bass</code>: four quarter notes per bar. Beat 1 must be the <b>root</b> of the bar's chord, and beat 4 must be exactly one <b>half step</b> above or below the note that starts the next bar (before a C2, play Db2 or B1, not Db3). (After the last bar, the progression starts again on Gm7.)</p>`,
          starter: `voice comp = changes("Gm7 | C7 | Fmaj7 | %").rootless.voicelead.vel(.5)\nvoice bass = [g2 bb2 d3 f3].inst(upright)`,
          solution: `voice comp = changes("Gm7 | C7 | Fmaj7 | %").rootless.voicelead.vel(.5)\nvoice bass = <[g2 bb2 d3 db3] [c3 bb2 g2 e2] [f2 a2 c3 e2] [f2 a2 c3 ab2]>.inst(upright)`,
          bars: 4,
          check: (_s, n) => {
            const m = need(n, "bass"); if (m) return m;
            const roots = [7, 0, 5, 5];
            const bar = (b: number) => groups(inBar(of(n, "bass"), b));
            for (let b = 0; b < 4; b++) {
              const g = bar(b);
              if (g.length !== 4) return `Bar ${b + 1} has ${g.length} notes; walk four quarter notes.`;
              if (pc(g[0].semis[0]) !== roots[b]) return `Beat 1 of bar ${b + 1} is ${nm(g[0].semis[0])}; it should be the root, ${nm(roots[b])}.`;
            }
            for (let b = 0; b < 4; b++) {
              const four = bar(b)[3].semis[0], next = bar((b + 1) % 4)[0].semis[0];
              if (Math.abs(four - next) !== 1 && [1, 11].includes(((four - next) % 12 + 12) % 12)) return `Beat 4 of bar ${b + 1}, ${nm(four, four < next ? "sharps" : "flats")}, is the right note in the wrong octave: it is ${Math.abs(four - next)} half steps from the ${nm(next)} that starts bar ${(b + 1) % 4 + 1}. Move it an octave so it sits right next to that ${nm(next)}.`;
              if (Math.abs(four - next) !== 1) return `Beat 4 of bar ${b + 1} is ${nm(four, four < next ? "sharps" : "flats")}; make it a half step above or below the ${nm(next)} that starts bar ${(b + 1) % 4 + 1}, in the same octave.`;
            }
            return null;
          },
        } },
        { quiz: [
          { q: "Listen. Two-feel or walking?", listen: `tempo 140\nvoice b = <[c2 _ g2 _] [f2 _ c3 _]>.inst(upright)\nvoice r = [ride [ride ride] ride [ride ride]].swing.vel(.4)`, bars: 2, options: ["Two-feel", "Walking"], answer: 0, explain: "Half notes: two per bar." },
          { q: "Listen. The bass walks into the next chord on beat 4. Does the approach come from above or below?", listen: `tempo 120\nvoice c = changes("Fmaj7 | Bbmaj7").rootless.voicelead.vel(.5)\nvoice b = <[f2 a2 c3 b2] [bb2 _ _ .]>.inst(upright)`, bars: 2, options: ["From above", "From below"], answer: 0, explain: "B natural falls a half step to Bb." },
          { q: "In a walking line, beat 1 is most often...", options: ["the root", "the seventh", "an approach note", "a rest"], answer: 0 },
          { q: "Which note is a chromatic approach from below into G?", options: ["F", "F#", "A", "Ab"], answer: 1 },
          { q: "From the nonchord-tone lesson: a bass note on beat 4 that slides a half step into the next root is the same device a soloist calls a...", options: ["suspension", "chromatic approach", "escape tone", "pedal"], answer: 1 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "cycles", title: "Circle progressions and sequences",
      parts: [
        `<p>Listen to the bass in this progression through every chord of C major. Each root is a fifth below the last (or a fourth above, the same note one octave up).</p>`,
        { code: `-- Two chords a bar, roots falling in fifths: C F B E A D G C.\n-- Change the last ^1@7 to ^6@7 (and ^1 to ^6 in the bass): the cycle stops short of home.\nkey c major\nvoice cycle = <[^1@7 ^4@7] [^7@7 ^3@7] [^6@7 ^2@7] [^5@7 ^1@7]>.voicelead\nvoice bass  = <[^1 ^4] [^7 ^3] [^6 ^2] [^5 ^1]>.octave(-2).inst(upright)`, bars: 4 },
        `<p>That is the <b>diatonic cycle of fifths</b>: I, IV, viiø, iii, vi, ii, V, I. Root motion by fifth is the strongest in tonal music, and the cycle chains it through the whole key. To stay in the key one fifth has to be a tritone, F to B. The ear accepts it because every other step is a perfect fifth.</p>`,
        { code: `-- The same cycle in A minor, comped. From bar 2 on (Dm7 to Am7) it is the A section of the standard "Autumn Leaves", moved to A minor.\n-- Change E7 to Em7 and the pull back to Am weakens: G# is gone.\ntempo 120\nlet cyc = changes("Am7 | Dm7 | G7 | Cmaj7 | Fmaj7 | Bm7b5 | E7 | Am7")\nvoice comp = ([0 . . 0 . . . .] + cyc).voicelead.swing.vel(.6)\nvoice bass = ([0 0 0 0] + cyc.root.octave(-1)).inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.4)`, bars: 8 },
        `<p>In minor, the cycle is <b>i iv VII III VI iiø V i</b>. It holds two ii-V-Is: one into the relative major (Dm7 G7 Cmaj7) and one into the minor tonic (Bm7b5 E7 Am7).</p>`,
        { code: `-- A four-note motif, stepped down one scale degree each bar.\n-- Change <0 -1 -2 -3> to <0 1 2 3> and the sequence climbs instead.\nkey d minor\nvoice seq  = [^5 ^3 ^4 ^2].step(<0 -1 -2 -3>).inst(vibes)\nvoice bass = <^8 ^7 ^6 ^5>.octave(-2).inst(upright)`, bars: 4 },
        `<p>That is a <b>sequence</b>: a pattern repeated at another pitch level. Sequences build momentum and are a common way to change key. In Tine, <code>.step</code> moves a pattern by scale steps, staying in the key, and its argument can change bar by bar. The cycle of fifths you started with is one too: a two-chord pattern, moved down one scale step each bar.</p>`,
        { code: `-- Partly done, in F major: bar 1 is written. Fill bars 2 to 4 with the rest of the cycle.\n-- Each bar is bar 1 moved down one scale step. Bar 2 starts on ^7.\nkey f major\nvoice cycle = <[^1@7 ^4@7] . . .>.voicelead`, bars: 4 },
        { exercise: {
          task: `<p>Write <code>voice cycle</code>: the diatonic cycle of fifths in <b>D minor</b> as seventh chords, two per bar over four bars, from i back to i. Make V a dominant seventh, as in the A minor example, so it pulls home. If you use <code>.rootless</code>, add a bass that plays the roots.</p>`,
          starter: `key d minor\nvoice cycle = <^1@7>`,
          solution: `key d minor\nvoice cycle = <[^1@7 ^4@7] [^7@7 ^3@7] [^6@7 ^2@7] [^5@dom7 ^1@7]>.voicelead`,
          hint: `<p>The degrees are the same as in major: ^1 ^4, ^7 ^3, ^6 ^2, ^5 ^1. In natural minor <code>^5@7</code> is a minor seventh; <code>^5@dom7</code> makes it dominant.</p>`,
          bars: 4,
          check: (_s, n) => {
            const all = groups(of(n, "cycle")).filter(g => g.semis.length >= 2);
            if (all.length < 8) return `I hear ${all.length} chord${all.length === 1 ? "" : "s"}; the cycle has eight, two a bar.`;
            if (all.slice(0, 8).some(g => pcset(g.semis).length < 4)) return "Use seventh chords, four notes each: ^1@7 rather than ^1@3, or Dm7 rather than Dm.";
            const v = all[6];
            if (v && isChord(v.semis, 9, "m7")) return "Chord 7 is Am7, the minor v of natural minor. Make it A7 with ^5@dom7, so its C# leads up to D.";
            const why = expectChords(n, "cycle", [[2, "m7"], [7, "m7"], [0, "7"], [5, "maj7"], [10, "maj7"], [4, "m7b5"], [9, "7"], [2, "m7"]]); if (why) return why;
            const g = groups(of(n, "cycle")).filter(x => x.semis.length >= 2);
            if (g.slice(0, 8).some((x, i) => Math.abs(x.t - i / 2) > 1e-3)) return "Play two chords a bar, on beats 1 and 3, for four bars.";
            return null;
          },
        } },
        { quiz: [
          { q: "Listen. The first chord is home. Does the bass fall in fifths or move by step?", listen: `key bb major\nvoice c = <^1@7 ^4@7 ^7@7 ^3@7 ^6@7 ^2@7 ^5@7 ^1@7>.voicelead\nvoice b = <^1 ^4 ^7 ^3 ^6 ^2 ^5 ^1>.octave(-2).inst(upright)`, bars: 8, options: ["Fifths", "Steps"], answer: 0, explain: "Bb, Eb, A, D, G, C, F, Bb: the diatonic cycle." },
          { q: "Listen. Is the second bar a sequence of the first?", listen: `key g major\nvoice m = [^1 ^2 ^3 ^1].step(<0 1>).inst(vibes)\nvoice d = <^1@3 ^2@3>.voicelead.vel(.4)`, bars: 2, options: ["Yes, one step higher", "No, a new idea"], answer: 0, explain: "The same shape, moved up one scale step." },
          { q: "In the diatonic cycle of fifths in a major key, which fifth is diminished?", options: ["I to IV", "IV to vii", "ii to V", "V to I"], answer: 1, explain: "F to B is a tritone." },
          { q: "The minor-key cycle contains a ii-V-I into which key?", options: ["The dominant", "The relative major", "The parallel major", "The subdominant"], answer: 1 },
          { q: "<code>.step(-1)</code> moves a pattern...", options: ["down a half step", "down one scale degree", "down an octave", "one bar earlier"], answer: 1 },
          { q: "From the ii-V-I lesson: in the C major cycle, which two chords in a row make the ii-V?", options: ["Cmaj7 Fmaj7", "Am7 Dm7", "Dm7 G7", "Bm7b5 Em7"], answer: 2 },
        ] },
      ],
    },
    // ------------------------------------------------------------------
    {
      id: "form", title: "Phrase and song form",
      parts: [
        `<p>Two four-bar phrases in G major. They start the same. Listen to how each one ends.</p>`,
        { code: `-- Change the last melody bar of cons, [^1 _ _ .], to [^3 _ _ .]: the answer still lands home, but less firmly.\ntempo 110\nkey g major\nsection ante 4\n  voice m = <[^3 ^4 ^5 ^3] [^2 ^3 ^4 _] [^5 ^3 ^4 ^2] [^2 _ _ .]>.inst(vibes)\n  voice c = <^1@7 ^4@7 ^2@7 ^5@7>.voicelead.vel(.5)\n  voice b = <^1 ^4 ^2 ^5>.octave(-2).inst(upright)\nsection cons 4\n  voice m = <[^3 ^4 ^5 ^3] [^2 ^3 ^4 _] [^5 ^4 ^3 ^2] [^1 _ _ .]>.inst(vibes)\n  voice c = <^1@7 ^4@7 ^5@7 ^1@7>.voicelead.vel(.5)\n  voice b = <^1 ^4 ^5 ^1>.octave(-2).inst(upright)\nform ante cons` },
        `<p>Music is organized in <b>phrases</b>, the way prose is organized in sentences. A phrase is a musical thought ending in a cadence, often four bars long. The first phrase you heard ends on V, a half cadence. The second ends V to I, an authentic cadence. A weak ending answered by a strong one is a <b>period</b>: <b>antecedent</b> and <b>consequent</b>, question and answer.</p>
         <p>In Tine, <code>section</code> names a block of bars and <code>form</code> plays the sections in order.</p>`,
        { code: `-- A 16-bar tune: a strain (one section of a tune, here four bars of changes), the strain again, something new, the strain again.\n-- Change the form to main main bridge bridge: the strain never comes back after the bridge, so the shape is no longer A A B A.\ntempo 160\nsection main 4\n  voice comp = ([0 . . 0 . . . .] + changes("Cmaj7 | Am7 | Dm7 | G7")).rootless.voicelead.swing.vel(.5)\n  voice bass = changes("Cmaj7 | Am7 | Dm7 | G7").root.octave(-1).inst(upright)\nsection bridge 4\n  voice comp = ([0 . . 0 . . . .] + changes("Gm7 | C7 | Fmaj7 | G7")).rootless.voicelead.swing.vel(.5)\n  voice bass = changes("Gm7 | C7 | Fmaj7 | G7").root.octave(-1).inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.4)\nform main main bridge main` },
        { code: `-- Two halves: listen to how each one ends.\n-- Change the form to open half open half and both halves end on G7, unfinished.\ntempo 150\nsection open 2\n  voice comp = changes("Cmaj7 | A7").rootless.voicelead.vel(.5)\n  voice bass = changes("Cmaj7 | A7").root.octave(-1).inst(upright)\nsection half 2\n  voice comp = changes("Dm7 | G7").rootless.voicelead.vel(.5)\n  voice bass = changes("Dm7 | G7").root.octave(-1).inst(upright)\nsection close 2\n  voice comp = changes("Dm7 G7 | Cmaj7").rootless.voicelead.vel(.5)\n  voice bass = changes("Dm7 G7 | Cmaj7").root.octave(-1).inst(upright)\nvoice ride = [ride [ride ride] ride [ride ride]].swing.vel(.4)\nform open half open close` },
        `<p>Most jazz standards come from the American popular song, and most of those use one of two 32-bar forms built from 8-bar sections.</p>
         <ul><li><b>AABA</b>: a strain, the same again (often with a stronger ending), a contrasting <b>bridge</b> (also called the B section, or the release), and the strain once more. The bridge often moves to IV or to a distant key. The 16-bar tune goes to F, the IV of C, through its own ii-V (Gm7 C7), then G7 leads back.</li>
         <li><b>ABAC</b>: two halves that start alike and end differently, as in the open, half, close example.</li></ul>
         <p>The twelve-bar blues is the third common jazz form. A performance plays the form many times: the melody (the <b>head</b>), solos over the same changes, then the head again. Each pass is a <b>chorus</b>.</p>`,
        { code: `-- Partly done: the A strain is written, and the form only plays it twice.\n-- Add a bridge section of your own (try changes("Bbmaj7 | C7")) and make the form main main bridge main.\nsection main 2\n  voice comp = changes("Fmaj7 | C7").voicelead\nform main main` },
        { exercise: {
          task: `<p>In F major, write a <code>section bridge</code> of two bars, in a voice named <code>comp</code>, that lands on <b>IV</b> (Bbmaj7) in its second bar. Get there through IV's own <b>ii-V</b>, both chords in the first bar. Then make the <code>form</code> an <b>AABA</b> using <code>main</code> and <code>bridge</code>. (Section names can't be a lone letter from a to g, since those are notes.)</p>`,
          starter: `section main 2\n  voice comp = changes("Fmaj7 | C7").voicelead\nsection bridge 2\n  voice comp = changes("Fmaj7 | C7").voicelead\nform main main main main`,
          solution: `section main 2\n  voice comp = changes("Fmaj7 | C7").voicelead\nsection bridge 2\n  voice comp = changes("Cm7 F7 | Bbmaj7").voicelead\nform main main bridge main`,
          hint: `<p>IV in F is Bb. The ii-V of Bb is Cm7 F7, as you found in the ii-V-I lesson.</p>`,
          bars: 8,
          check: (s, n) => {
            const f = (s.form ?? []).flatMap(i => Array(i.times).fill(i.name));
            if (JSON.stringify(f) !== JSON.stringify(["main", "main", "bridge", "main"])) return `Your form plays ${f.join(" ") || "nothing"}. AABA is main, main, bridge, main.`;
            const b1 = groups(inBar(of(n, "comp"), 4)).filter(g => g.semis.length >= 2), c6 = barChords(n, "comp", 8)[5];
            if (b1.length !== 2) return `The bridge's first bar has ${b1.length} chord${b1.length === 1 ? "" : "s"}; it needs two, the ii and the V of Bb.`;
            const rootless = "Put the root in the chord, or add a bass that plays it.";
            if (!guides(b1[0].semis, 0, 3, 10)) return `The bridge's first chord is ${nms(b1[0].semis)}; make it ii of Bb, Cm7.`;
            if (!rootHeard(n, "comp", b1[0].t, 0, b1[0].semis)) return `The bridge's first chord has no C, so it does not sound like Cm7. ${rootless}`;
            if (!guides(b1[1].semis, 5, 4, 10)) return `The bridge's second chord is ${nms(b1[1].semis)}; make it V7 of Bb, F7.`;
            if (!rootHeard(n, "comp", b1[1].t, 5, b1[1].semis)) return `The bridge's second chord has no F, so it does not sound like F7. ${rootless}`;
            if (!c6 || !guides(c6, 10, 4, 11)) return `The bridge's second bar is ${c6 ? nms(c6) : "empty"}; make it Bbmaj7.`;
            const t6 = groups(inBar(of(n, "comp"), 5)).find(g => g.semis.length >= 2)!.t;
            if (!rootHeard(n, "comp", t6, 10, c6)) return `The bridge's second bar has no Bb, so it does not sound like Bbmaj7. ${rootless}`;
            return null;
          },
        } },
        { quiz: [
          { q: "Listen. A in C, A again, then a new section. Where does the new section go?", listen: `tempo 160\nsection main 2\n  voice c = changes("Cmaj7 | G7").rootless.voicelead\n  voice b = changes("Cmaj7 | G7").root.octave(-1).inst(upright)\nsection bridge 2\n  voice c = changes("Fmaj7 | G7").rootless.voicelead\n  voice b = changes("Fmaj7 | G7").root.octave(-1).inst(upright)\nform main main bridge main`, bars: 8, options: ["To IV (F)", "To V (G)", "To vi (Am)"], answer: 0, explain: "The bridge opens on Fmaj7, the IV chord, then G7 leads back to the A section." },
          { q: "In a period, the antecedent phrase usually ends with...", options: ["a perfect authentic cadence", "a half cadence", "a plagal cadence", "no cadence"], answer: 1 },
          { q: "How many bars are in a standard AABA song form?", options: ["12", "16", "24", "32"], answer: 3 },
          { q: "In jazz, one time through the whole form is called a...", options: ["chorus", "verse", "bridge", "head"], answer: 0, explain: "The head is the chorus where the melody is played." },
          { q: "From the blues lesson: how many bars long is one chorus of a blues?", options: ["8", "12", "16", "32"], answer: 1 },
        ] },
      ],
    },
  ],
};
void chordPcs;
