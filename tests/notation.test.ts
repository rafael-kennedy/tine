import { test, expect, describe } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { evaluate, renderNotes, buildChart, chartPages, chordText, qualityText, buildScore, scorePages, harmonyVoices } from "../src/core";

const scene = (src: string) => evaluate(src, { seed: 1 });
const bars = (src: string, opts = {}) => buildChart(scene(src), "t", opts).sections.flatMap(s => s.bars).map(b =>
  b.nc ? "N.C." : b.chords.map(c => { const t = chordText(c, false); return (c.beat ? `${c.beat}:` : "") + t.root + t.quality + (t.bass ? "/" + t.bass : ""); }).join(" "));
const EX = join(import.meta.dir, "../examples");
const examples = readdirSync(EX).filter(f => f.endsWith(".tine"));
const load = (f: string) => evaluate(readFileSync(join(EX, f), "utf8"), { seed: 1, readFile: p => readFileSync(join(EX, p), "utf8") });

describe("chord charts", () => {
  test("changes() reads back as written, beat by beat", () => {
    expect(bars(`voice c = changes("Dm7 G7 | Cmaj7 | %")`, { bars: 3 })).toEqual(["Dm7 2:G7", "Cmaj7", "Cmaj7"]);
  });
  test("slash chords and no chord", () => {
    expect(bars(`voice c = changes("C/E | N.C. | F")`, { bars: 3 })).toEqual(["C/E", "N.C.", "F"]);
  });
  test("strum and arp keep the chord's name", () => {
    expect(bars(`voice c = <c@7 f@maj7>.strum`, { bars: 2 })).toEqual(["C7", "Fmaj7"]);
    expect(bars(`voice c = <c@m7 f@7>.arp("updown")`, { bars: 2 })).toEqual(["Cm7", "F7"]);
    // the root survives transposing the spread notes
    expect(bars(`voice c = <c@m7>.arp.transpose(2)`, { bars: 1 })).toEqual(["Dm7"]);
  });
  test("a melody does not rename the chords when symbols are present", () => {
    const s = scene(`voice c = <c@maj7 a@m7>\nvoice m = [c5 d5 e5 f#5 g5 a5 b5 c6]`);
    expect(harmonyVoices(renderNotes(s, 2).notes, 4)).toEqual(["c"]);
  });
  test("voices without symbols are read when they play chords", () => {
    expect(bars(`voice c = <{c e g} {a c5 e5}>`, { bars: 2 })).toEqual(["C", "Am"]);
  });
  test("a loop is charted for its own length", () => {
    const c = buildChart(scene(`voice c = <c@7 f@7 g@7>`), "t");
    expect(c.loop).toBe(true);
    expect(c.sections[0].bars.length).toBe(3);
  });
  test("a section that comes back is printed once, with a road map", () => {
    const c = buildChart(scene(`section head 2\n  voice c = <c@maj7 a@m7>\nsection verse 2\n  voice c = <f@maj7 g@7>\nform head head verse head`), "t");
    expect(c.sections.map(s => [s.name, s.times])).toEqual([["head", 2], ["verse", 1]]);
    expect(c.roadmap).toEqual(["head", "head", "verse", "head"]);
  });
  test("jazz symbols", () => {
    expect(qualityText("m7b5", "jazz")).toBe("ø7");
    expect(qualityText("maj7", "jazz")).toBe("Δ7");
    expect(qualityText("m7", "jazz")).toBe("–7");
    expect(qualityText("7b9#11")).toBe("7♭9♯11");
  });
  test("every example charts", () => {
    for (const f of examples) {
      const pages = chartPages(buildChart(load(f), f));
      for (const p of pages) { expect(p.startsWith("<svg")).toBe(true); expect(p).not.toMatch(/NaN|undefined/); }
    }
  });
});

describe("sheet music", () => {
  // every layer of every measure fills the bar exactly
  const filled = (s: ReturnType<typeof buildScore>) => {
    for (const p of s.parts) p.measures.forEach(m => {
      for (let L = 0; L < m.layers; L++) expect(m.evs.filter(e => e.layer === L).reduce((a, e) => a + e.len, 0)).toBe(s.M);
    });
  };
  test("every bar adds up, in every example, as a score and a lead sheet", () => {
    for (const f of examples) for (const kind of ["score", "lead"] as const) {
      const s = buildScore(load(f), f, kind);
      filled(s);
      for (const p of scorePages(s)) { expect(p.startsWith("<svg")).toBe(true); expect(p).not.toMatch(/NaN|undefined|Infinity/); }
    }
  });
  test("a syncopated note is split at the beat and tied", () => {
    const s = buildScore(scene(`voice a = [c4 d4:2 e4]`), "t", "score", { bars: 1 });
    const evs = s.parts[0].measures[0].evs;
    expect(evs.map(e => e.type)).toEqual(["quarter", "quarter", "quarter", "quarter"]);
    expect(evs[1].heads[0].tieStart).toBe(true);
    expect(evs[2].heads[0].tieStop).toBe(true);
  });
  test("an off-beat eighth across the beat is tied at the beat", () => {
    const s = buildScore(scene(`voice a = [c4:1 d4:2 e4:5]`), "t", "score", { bars: 1 });
    expect(s.parts[0].measures[0].evs.map(e => e.type)).toEqual(["eighth", "eighth", "eighth", "eighth", "half"]);
  });
  test("accidentals follow the key and the bar", () => {
    const s = buildScore(scene(`key f major\nvoice a = [bb4 b4 b4 bb4]`), "t", "score", { bars: 1 });
    expect(s.parts[0].measures[0].evs.map(e => e.heads[0].acc ?? "")).toEqual(["", "accidentalNatural", "", "accidentalFlat"]);
  });
  test("microtones get a quarter-tone accidental or cents", () => {
    const s = buildScore(scene(`voice a = [(c4 + 50c) (c4 + 20c) c4 c4]`), "t", "score", { bars: 1 });
    const hs = s.parts[0].measures[0].evs.map(e => e.heads[0]);
    expect(hs[0].acc).toBe("accidentalQuarterToneSharpStein");
    expect(hs[1].acc).toBe("accidentalNatural");
    expect(hs[1].cents).toBe(20);
  });
  test("a strummed chord is written as one chord", () => {
    const s = buildScore(scene(`voice a = {c4 e4 g4}.strum`), "t", "score", { bars: 1 });
    const evs = s.parts[0].measures[0].evs;
    expect(evs.length).toBe(1);
    expect(evs[0].heads.length).toBe(3);
  });
  test("a lead sheet takes the melody and leaves echoes out", () => {
    const s = buildScore(scene(`voice keys = <c@maj7>\nvoice tune = [e5 . g5 .].echo(2)`), "t", "lead", { bars: 1 });
    expect(s.parts.map(p => p.name)).toEqual(["tune"]);
    expect(s.parts[0].measures[0].evs.filter(e => !e.rest).length).toBe(2);
    expect(s.measures[0].chords?.chords[0].sym).toBe("maj7");
  });
  test("drums go on a percussion staff", () => {
    const s = buildScore(scene(`voice d = [kick hat snare hat]`), "t", "score", { bars: 1 });
    expect(s.parts[0].clef).toBe("perc");
    expect(s.parts[0].measures[0].evs.some(e => e.heads.some(h => h.cross))).toBe(true);
  });
});
