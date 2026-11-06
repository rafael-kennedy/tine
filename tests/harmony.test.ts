import { test, expect } from "bun:test";
import { evaluate, renderNotes, parseQuality, nameOf, liveNotes } from "../src/core";

const notes = (src: string, bars = 1) => renderNotes(evaluate(src, { seed: 1 }), bars).notes;
const chords = (src: string, bars = 1) => {
  const m = new Map<number, number[]>();
  for (const n of notes(src, bars)) { const k = Math.round(n.bar * 1000) / 1000; m.set(k, [...(m.get(k) ?? []), n.semi].sort((a, b) => a - b)); }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]);
};
const prints = (src: string) => evaluate(src, { seed: 1 }).prints;

test("chord symbols parse into semitones", () => {
  expect(parseQuality("")).toEqual([0, 4, 7]);
  expect(parseQuality("m7b5")).toEqual([0, 3, 6, 10]);
  expect(parseQuality("7b9")).toEqual([0, 4, 7, 10, 13]);
  expect(parseQuality("7#9b13")).toEqual([0, 4, 7, 10, 15, 20]);
  expect(parseQuality("maj7#11")).toEqual([0, 4, 7, 11, 18]);
  expect(parseQuality("9sus4")).toEqual([0, 5, 7, 10, 14]);
  expect(parseQuality("13")).toEqual([0, 4, 7, 10, 14, 21]);
  expect(parseQuality("m13")).toEqual([0, 3, 7, 10, 14, 17, 21]);
  expect(parseQuality("69")).toEqual([0, 4, 7, 9, 14]);
  expect(parseQuality("7alt")).toEqual([0, 4, 10, 13, 15, 20]);
  expect(parseQuality("mmaj7")).toEqual([0, 3, 7, 11]);
  expect(parseQuality("madd9")).toEqual([0, 3, 7, 14]);
  expect(parseQuality("nonsense")).toBeNull();
});

test("@ takes full chord symbols, slash basses, and keeps diatonic numbers on degrees", () => {
  expect(chords("voice x = g3@7#9")).toEqual([[55, 59, 62, 65, 70]]);
  expect(chords("voice x = c4@maj7/e")).toEqual([[52, 60, 64, 67, 71]]);
  expect(chords("voice x = ^5@7")).toEqual([[67, 71, 74, 77]]);
  expect(chords("voice x = ^2@m7")).toEqual([[62, 65, 69, 72]]);
  // an altered degree with a number names the quality: bVII7 is a dominant seventh
  expect(chords("voice x = ^b7@7")).toEqual([[70, 74, 77, 80]]);
  expect(chords("voice x = [c@maj7.drop2 e]")[0]).toEqual([55, 60, 64, 71]);
});

test("changes reads a lead sheet", () => {
  const c = chords(`voice x = changes("Dm7 G7 | Cmaj7 / / A7b9 | %")`, 3);
  expect(c[0]).toEqual([50, 53, 57, 60]);
  expect(c[1]).toEqual([55, 59, 62, 65]);
  expect(c[2]).toEqual([48, 52, 55, 59]);
  expect(c[3]).toEqual([57, 61, 64, 67, 70]);
  expect(c[4]).toEqual(c[2]);
  const n = notes(`voice x = changes("Cmaj7 / / A7b9")`);
  expect(n.filter(x => x.semi === 57)[0].bar).toBeCloseTo(0.75);
  expect(() => evaluate(`voice x = changes("Dm7 Q7")`)).toThrow();
});

test("naming chords", () => {
  expect(nameOf([60, 64, 67])).toBe("C");
  expect(nameOf([52, 55, 60])).toBe("C/E");
  expect(nameOf([55, 59, 62, 65, 68])).toBe("G7b9");
  expect(nameOf([53, 57, 60, 64])).toBe("Fmaj7"); // a rootless Dm9 is also an Fmaj7
  expect(prints(`print(name(changes("Dm7 G7 | Cmaj7"), bars: 2))`)).toEqual(["Dm7 G7 | Cmaj7"]);
  expect(prints(`print(name({e g c5}), name(b3@m7b5))`)).toEqual(["C/E Bm7b5"]);
});

test("voicings: shell, guide, rootless, drops", () => {
  expect(chords("voice x = c3@7.shell")).toEqual([[48, 52, 58]]);
  expect(chords("voice x = g3@7.guide")).toEqual([[59, 65]]);
  expect(chords("voice x = d3@m7.rootless")).toEqual([[53, 57, 60, 64]]);
  expect(chords("voice x = g3@7.rootless")).toEqual([[59, 64, 65, 69]]);         // 3 13 b7 9
  expect(chords(`voice x = g3@7.rootless(form: "b")`)).toEqual([[53, 57, 59, 64]]); // b7 9 3 13
  expect(chords("voice x = c4@maj7.drop3")).toEqual([[52, 60, 67, 71]]);
  expect(chords("voice x = c4@maj7.drop24")).toEqual([[48, 55, 64, 71]]);
});

test("voicelead moves each chord the least, and is the same in any query order", () => {
  const src = `voice x = changes("Dm7 G7 | Cmaj7 | Fmaj7 | Bm7b5 E7 | Am7 D7 | Gm7 C7").voicelead`;
  const c = chords(src, 6);
  for (let i = 1; i < c.length; i++) {
    const move = c[i].reduce((t, x, k) => t + Math.abs(x - (c[i - 1][k] ?? x)), 0);
    expect(move).toBeLessThanOrEqual(6);
  }
  const s = evaluate(src, { seed: 1 });
  const late = liveNotes(s, 4, 5).map(n => n.semi);
  const s2 = evaluate(src, { seed: 1 });
  const all = liveNotes(s2, 0, 6).filter(n => n.bar >= 4 && n.bar < 5).map(n => n.semi);
  expect(late).toEqual(all);
  // guide tones in a ii-V-I: F C, then F B, then E B
  expect(chords(`voice x = changes("Dm7 G7 | Cmaj7").guide.voicelead(around: g4)`, 2)).toEqual([[65, 72], [65, 71], [64, 71]]);
});

test("root, bassnote and intervals", () => {
  expect(notes(`voice x = changes("Dm7 G7 | C/E").root.octave(-1)`, 2).map(n => n.semi)).toEqual([38, 43, 36]);
  expect(notes(`voice x = changes("C/E").bassnote`).map(n => n.semi)).toEqual([40]);
  expect(notes(`voice x = {e4 g4 c5}.root`).map(n => n.semi)).toEqual([60]);
  expect(prints(`print(interval(c4, e4), interval(c4, g5), interval(d4, ab4, long: true))`)).toEqual(["M3 P12 tritone"]);
});

test("jazz scales and instruments", () => {
  expect(notes(`key g altered\nvoice x = [^1 ^2 ^3 ^4 ^5 ^6 ^7]`).map(n => n.semi)).toEqual([67, 68, 70, 71, 73, 75, 77]);
  expect(notes(`key c bebop_dominant\nvoice x = run(8).degrees`).map(n => n.semi)).toEqual([60, 62, 64, 65, 67, 69, 70, 71]);
  expect(notes(`voice x = [c2 e2].inst(upright)`).length).toBe(2);
  expect(notes(`voice x = c@maj7.inst(vibes)`).length).toBe(4);
});

test(".key on a pattern re-keys its degrees (and an inner key wins)", () => {
  expect(notes(`voice x = [^1 ^3].key(a3, minor)`).map(n => n.semi)).toEqual([57, 60]);
  expect(notes(`voice x = cat([^3].key(a3, minor), [^3].key(a3, major))`, 2).map(n => n.semi)).toEqual([60, 61]);
  expect(notes(`voice x = [^1 ^3].key(d4, minor).key(g4, major)`).map(n => n.semi)).toEqual([62, 65]);
});

test("within folds a slash-chord bass line into one octave", () => {
  const ns = notes(`voice b = changes("Bm | F#/A# | A | E/G# | G | D/F# | Em | F#7", octave: 2).bassnote.within(e1, e2)`, 8);
  expect(ns.map(n => n.semi)).toEqual([35, 34, 33, 32, 31, 30, 28, 30]);
});

test("within moves chords as a unit and leaves notes in range alone", () => {
  const ns = notes(`voice v = [c2@maj7 g4 c7].within(c4, c5)`);
  expect(ns.map(n => n.semi).sort((a, b) => a - b)).toEqual([60, 60, 64, 67, 67, 71]);
});
