import { test, expect, describe } from "bun:test";
import { evaluate, renderNotes, toMusicXml, noteValues, spell, R } from "../src/core";

const xml = (src: string, bars = 1) => { const s = evaluate(src, { seed: 1 }); const r = renderNotes(s, bars); return toMusicXml(s, r.notes, bars); };
const durations = (x: string) => [...x.matchAll(/<note[^>]*>(?:(?!<\/note>).)*?<duration>(\d+)<\/duration>/g)].map(m => Number(m[1]));
const measureSums = (x: string) => [...x.matchAll(/<measure number="\d+">(.*?)<\/measure>/g)].map(m => {
  const body = m[1].split("<backup>")[0];
  return [...body.matchAll(/<note[^>]*>((?:(?!<\/note>).)*)<\/note>/g)].filter(n => !n[1].includes("<chord/>")).reduce((a, n) => a + Number(/<duration>(\d+)/.exec(n[1])![1]), 0);
});

describe("MusicXML", () => {
  test("note values", () => {
    expect(noteValues(new R(1))).toEqual([{ type: "quarter", dots: 0 }]);
    expect(noteValues(new R(3, 2))).toEqual([{ type: "quarter", dots: 1 }]);
    expect(noteValues(new R(5, 4))).toEqual([{ type: "quarter", dots: 0 }, { type: "16th", dots: 0 }]);
    expect(noteValues(new R(1, 3))).toEqual([{ type: "eighth", dots: 0, tuplet: [3, 2] }]);
    expect(noteValues(new R(1, 5))).toEqual([{ type: "16th", dots: 0, tuplet: [5, 4] }]);
  });
  test("spelling follows the key, and cents become a decimal alter", () => {
    expect(spell(61, false)).toEqual({ step: "C", alter: 1, octave: 4 });
    expect(spell(61, true)).toEqual({ step: "D", alter: -1, octave: 4 });
    expect(spell(60.5, false)).toEqual({ step: "C", alter: 0.5, octave: 4 });
  });
  test("every bar adds up", () => {
    const x = xml("meter 7/8\nvoice a = [c [d e f] g:2 . a [b c5 d5 e5 f5]]", 2);
    const M = Number(/<divisions>(\d+)/.exec(x)![1]) * 7 / 2;
    expect(measureSums(x)).toEqual([M, M]);
  });
  test("a note across a bar line is tied", () => {
    const x = xml("voice a = [. . . c].legato(2)", 2);
    expect(x).toContain('<tie type="start"/>');
    expect(x).toContain('<tie type="stop"/>');
  });
  test("chords stack and polyphony splits into voices", () => {
    const x = xml("voice a = {[c e] [g a b]}");
    expect(x).toContain("<backup>");
    const y = xml("voice a = [<c@maj7>]");
    expect((y.match(/<chord\/>/g) ?? []).length).toBe(3);
  });
  test("triplets carry a time modification", () => {
    expect(xml("voice a = [c e g]")).toContain("<actual-notes>3</actual-notes><normal-notes>2</normal-notes>");
  });
  test("control-change voices are left out", () => {
    expect(xml("voice a = [c]\nvoice k = saw(1).as_cc(1)")).not.toContain("<part-name>k</part-name>");
  });
});

import { keySpelling, pitchName } from "../src/core";
describe("spelling by key", () => {
  test("B minor spells sharps, F major flats", () => {
    const b = evaluate("key b minor\nvoice a = [b]", { seed: 1 }).key;
    expect(keySpelling(b)).toBe("sharps");
    expect(pitchName(70, keySpelling(b))).toBe("a#4");
    const f = evaluate("key f major\nvoice a = [f]", { seed: 1 }).key;
    expect(pitchName(70, keySpelling(f))).toBe("bb4");
    expect(xml("key b minor\nvoice a = [a# b]")).toContain("<step>A</step><alter>1</alter>");
  });
});
