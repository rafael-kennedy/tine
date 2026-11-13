import { test, expect, describe } from "bun:test";
import { evaluate, renderNotes, liveNotes, toMusicXml, toMidiFile, mix, buildScore, scorePages, performed, parse } from "../src/core";

const notes = (src: string, bars = 1) => renderNotes(evaluate(src, { seed: 1 }), bars).notes;

describe("slurs", () => {
  test("c4~ d4 plays as one sound that steps to d4", () => {
    const ns = notes("voice a = [c4~ d4 e4 f4].inst(synth)");
    expect(ns[1].params.slurIn).toBe(true);
    expect(ns[0].params.runSec).toBeCloseTo(1.0); // half a bar at 120 in 4/4
    expect(ns[0].params.curve.slice(0, 4)).toEqual([0.5, 0, 0.504, 2]);
    expect(performed(ns[1])).toBeNull();
    expect(performed(ns[0])!.durSec).toBeCloseTo(1.0);
    expect(ns[2].params.slurIn).toBeUndefined();
  });
  test(".slur slurs a phrase up to its last note", () => {
    const ns = notes("voice a = [c4 d4 e4 f4].slur.inst(synth)", 2);
    expect(ns.map(n => !!n.params.slurIn)).toEqual([false, true, true, true, false, true, true, true]);
    expect(ns[3].params.slur).toBe(false);
  });
  test(".gliss ramps across the note to the next one", () => {
    const ns = notes("voice a = [c4 g4 . .].gliss([1 0]).inst(synth)");
    expect(ns[0].params.curve).toEqual([0, 0, 0.5, 7]);
    expect(ns[1].params.slurIn).toBe(true);
  });
  test("a slurred glide slides", () => {
    const ns = notes("voice a = [a1~ a2 . .].inst(tb303).glide(.06)");
    expect(ns[0].params.curve).toEqual([0.5, 0, 0.56, 12]);
  });
  test("a slur that never ends breaks every four bars, so it still plays", () => {
    const ns = notes("voice a = [c4~ d4~]", 8);
    const heads = ns.filter(n => !n.params.slurIn).map(n => n.bar);
    expect(heads).toEqual([0, 4]);
  });
  test("live windows agree with a render", () => {
    const s = evaluate("voice a = [c4~ d4 e4~ f4].inst(synth)", { seed: 1 });
    const whole = renderNotes(s, 2).notes.map(n => `${n.bar}:${n.params.slurIn ? "in" : n.params.runSec ?? "-"}`);
    const live: string[] = [];
    for (let t = 0; t < 2; t += 0.125) for (const n of liveNotes(s, t, t + 0.125)) live.push(`${n.bar}:${n.params.slurIn ? "in" : n.params.runSec ?? "-"}`);
    expect(live).toEqual(whole);
  });
  test("a slurred run has no dip where the second note starts", () => {
    const rms = (src: string) => {
      const [L] = mix(notes(src), 2, 44100, { tail: 0 });
      let a = 0; for (let i = 22050; i < 22050 + 441; i++) a += L[i] * L[i];
      return Math.sqrt(a / 441);
    };
    expect(rms("voice a = [c4~ d4 . .].inst(synth).attack(.05)")).toBeGreaterThan(rms("voice a = [c4 d4 . .].inst(synth).attack(.05)"));
  });
  test("~ needs no space before it", () => {
    expect(() => parse("voice a = [c4 ~ d4]")).toThrow();
  });
});

describe("slurs in scores and MIDI", () => {
  const xml = (src: string) => { const s = evaluate(src, { seed: 1 }); return toMusicXml(s, renderNotes(s, 1).notes, 1); };
  test("MusicXML slurs and glissandos", () => {
    const x = xml("voice a = [c4~ d4~ e4 f4]");
    expect(x.match(/<slur type="start"/g)!.length).toBe(1);
    expect(x.match(/<slur type="stop"/g)!.length).toBe(1);
    expect(xml("voice a = [c4 g4 . .].gliss([1 0])")).toContain('<slide type="start" number="1" line-type="solid">gliss.</slide>');
  });
  test("a score draws them", () => {
    const s = evaluate("voice a = <[c4~ d4 e4 f4] [c4 g4].gliss([1 0])>", { seed: 1 });
    const svg = scorePages(buildScore(s, "t", "score", { bars: 2 })).join("");
    expect(svg).toContain(">gliss.</text>");
  });
  test("MIDI: a slur overlaps, a glissando bends with a wider range", () => {
    const bytes = (src: string) => { const s = evaluate(src, { seed: 1 }); return [...toMidiFile(s, renderNotes(s, 1).notes)]; };
    const has = (b: number[], seq: number[]) => b.some((_, i) => seq.every((x, k) => b[i + k] === x));
    const g = bytes("voice a = [c4 g4 . .].gliss([1 0])");
    expect(has(g, [0xb0, 0x06, 12])).toBe(true);
    expect(g.filter(x => x === 0xe0).length).toBeGreaterThan(10);
    const plain = bytes("voice a = [c4 g4 . .]");
    expect(has(plain, [0xb0, 0x06, 2])).toBe(true);
  });
});
