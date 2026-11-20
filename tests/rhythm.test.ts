import { test, expect, describe } from "bun:test";
import { evaluate, renderNotes } from "../src/core";

const notes = (src: string, bars = 1, seed = 1) => renderNotes(evaluate(src, { seed }), bars).notes;
const pitches = (src: string, bars = 1) => notes(src, bars).map(n => Math.round(n.semi * 1000) / 1000);
const starts = (src: string, bars = 1) => notes(src, bars).map(n => n.bar);
const lens = (src: string, bars = 1) => notes(src, bars).map(n => n.bars);
const vels = (src: string, bars = 1) => notes(src, bars).map(n => Math.round(n.vel * 100) / 100);

describe("lengths in beats", () => {
  test("fractions after ':'", () => {
    expect(starts("voice a = [c:3/2 d:1/2 e:2]")).toEqual([0, 0.375, 0.5]);
  });
  test("a .beats line is measured in beats and crosses bar lines", () => {
    // 3/2 + 1/2 + 2 + 3 + 1/2 + 1/2 + 4 = 12 beats = 3 bars of 4/4
    const src = "voice a = [c4:3/2 d4:1/2 [e4 f4 g4]:2 a4:3 g4:1/2 f4:1/2 e4:4].beats";
    expect(pitches(src, 3)).toEqual([60, 62, 64, 65, 67, 69, 67, 65, 64]);
    const s = starts(src, 3);
    expect(s[0]).toBe(0); expect(s[1]).toBe(0.375); expect(s[2]).toBe(0.5);
    expect(s[5]).toBe(1); expect(s[6]).toBe(1.75); expect(s[8]).toBe(2);
    expect(lens(src, 3)[8]).toBe(1);
  });
  test("a line that ends mid-bar rests to the bar line, then loops", () => {
    expect(starts("voice a = [c d e].beats", 2)).toEqual([0, 0.25, 0.5, 1, 1.25, 1.5]);
  });
  test("the beat follows the meter, and unit overrides it", () => {
    expect(starts("meter 6/8\nvoice a = [c d e f g a].beats", 1)).toEqual([0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6]);
    expect(starts("voice a = [c d e f].beats(1/8)", 1)).toEqual([0, 0.125, 0.25, 0.375]);
  });
  test("each loop plays the phrase's next cycle", () => {
    expect(pitches("voice a = [c <d e>:3].beats", 2)).toEqual([60, 62, 60, 64]);
  });
  test("beats needs a phrase as written", () => {
    expect(() => evaluate("voice a = [c d].fast(2).beats")).toThrow(/as written/);
  });
});

describe("hits", () => {
  test("x X o are hits with accents", () => {
    expect(starts("voice a = [x . o X]")).toEqual([0, 0.5, 0.75]);
    expect(vels("voice a = [x . o X]")).toEqual([0.8, 0.36, 1]);
  });
  test("a rhythm plus a value plays the value with the hit's timing and accent", () => {
    expect(pitches("voice a = [X . x x] + c3")).toEqual([48, 48, 48]);
    expect(vels("voice a = [X . x x] + c3")).toEqual([1, 0.8, 0.8]);
  });
});

describe("taking patterns apart", () => {
  test("rhythm keeps timing, drops pitch", () => {
    const src = "voice a = [c:3 e g] .rhythm + d4";
    expect(starts(src)).toEqual([0, 0.6, 0.8]);
    expect(pitches(src)).toEqual([62, 62, 62]);
  });
  test("notes keeps the order, drops timing", () => {
    expect(pitches("voice a = [c:3 . [e g] {a c5}].notes")).toEqual([60, 64, 67, 69, 72]);
  });
  test("notes go back into a rhythm, one per hit, looping independently", () => {
    const src = "voice a = [c d e].on([x . x x])";
    expect(pitches(src, 2)).toEqual([60, 62, 64, 60, 62, 64]);
    expect(starts(src, 2)).toEqual([0, 0.5, 0.75, 1, 1.5, 1.75]);
    // 4 notes over 3 hits per bar
    expect(pitches("voice a = [c d e f].on([x x x])", 2)).toEqual([60, 62, 64, 65, 60, 62]);
  });
  test("in the notes, '.' skips a hit and '_' holds through it", () => {
    expect(pitches("voice a = [c . e].on([x x x x])")).toEqual([60, 64, 60]);
    const n = notes("voice a = [c _ e].on([x x x x])");
    expect(n.map(x => x.semi)).toEqual([60, 64, 60]);
    expect(n[0].bars).toBe(0.5);
  });
  test("accents survive the trip", () => {
    expect(vels("voice a = [c d].on([X o])")).toEqual([1, 0.36]);
  });
  test("decompose and recombine", () => {
    const src = "let t = [c:2 d e]\nvoice a = t.notes.rev.on(t.rhythm)";
    expect(pitches(src)).toEqual([64, 62, 60]);
    expect(starts(src)).toEqual([0, 0.5, 0.75]);
  });
  test("reset restarts the notes", () => {
    expect(pitches("voice a = [c d e].on([x x], reset: 1)", 2)).toEqual([60, 62, 60, 62]);
  });
  test("counting is the same in any order", () => {
    const ev = evaluate("voice a = [c d e f g].on([x . x x])", { seed: 3 });
    const all = renderNotes(ev, 8).notes.filter(n => n.bar >= 7).map(n => n.semi);
    const late = renderNotes(evaluate("voice a = [c d e f g].on([x . x x])", { seed: 3 }), 8).notes.filter(n => n.bar >= 7).map(n => n.semi);
    expect(all).toEqual(late);
    // bar 7 starts at hit 21: 21 mod 5 = 1, so d
    expect(all[0]).toBe(62);
  });
});

describe("rhythm operators", () => {
  test("rotate on an even phrase is a list rotation", () => {
    expect(starts("voice a = [x . . x].rotate(3)")).toEqual([0, 0.25]);
  });
  test("rotate on a weighted phrase turns by its grid", () => {
    expect(starts("voice a = [x:2 x x].rotate(1)")).toEqual([0.25, 0.5, 0.75]);
  });
  test("displace wraps inside the bar", () => {
    expect(starts("voice a = [x . . x].displace(1/4)")).toEqual([0, 0.25]);
  });
  test("flip swaps hits and rests", () => {
    expect(starts("voice a = [x . . x].flip")).toEqual([0.25, 0.5]);
  });
  test("thin keeps the downbeat, fill adds hits", () => {
    const t = starts("voice a = [x x x x].thin(2)");
    expect(t.length).toBe(2); expect(t[0]).toBe(0);
    expect(starts("voice a = [x . . .].fill(3)")).toEqual([0, 0.25, 0.5, 0.75]);
  });
  test("union, intersect, minus", () => {
    expect(starts("voice a = union([x . . .], [. . x .])")).toEqual([0, 0.5]);
    expect(starts("voice a = intersect([x . x x], [x x . x])")).toEqual([0, 0.75]);
    expect(starts("voice a = minus([x . x x], [x x . x])")).toEqual([0.5]);
  });
  test("mutate keeps the hit count, wanders, and replays the same", () => {
    const src = "voice a = [x . . x . . x .].mutate(.5)";
    const a = notes(src, 16, 5), b = notes(src, 16, 5);
    expect(a.map(n => n.bar)).toEqual(b.map(n => n.bar));
    for (let bar = 0; bar < 16; bar++) expect(a.filter(n => Math.floor(n.bar) === bar).length).toBe(3);
    expect(a.slice(0, 3).map(n => n.bar)).toEqual([0, 0.375, 0.75]);
    const later = a.filter(n => n.bar >= 15).map(n => n.bar - 15);
    expect(later).not.toEqual([0, 0.375, 0.75]);
  });
  test("operators chain into on", () => {
    expect(pitches("voice a = [c d e].on([x . x x].rotate(1))")).toEqual([60, 62, 64]);
  });
});
