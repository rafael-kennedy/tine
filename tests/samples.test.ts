import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  evaluate, renderNotes, mix, encodeAdpcm, decodeAdpcm, encodePack, readPack, SampleLibrary, renderSample,
  applyCuts, parseSampleMap, sampleMapUrl, KIT,
} from "../src/core";

const ramp = (n: number) => Float32Array.from({ length: n }, (_, i) => i / n * 0.5);
const lib = () => { const l = new SampleLibrary(); l.add("ramp", { channels: [ramp(1000)], sr: 1000 }); return l; };
const notes = (src: string, bars = 1) => renderNotes(evaluate(src, { seed: 1 }), bars).notes;

describe("block ADPCM", () => {
  test("round trip keeps the signal", () => {
    const x = Float32Array.from({ length: 20000 }, (_, i) => 0.5 * Math.sin(i * 0.03) + 0.1 * Math.sin(i * 1.3));
    const y = decodeAdpcm(encodeAdpcm(x), x.length);
    let s = 0, n = 0;
    for (let i = 0; i < x.length; i++) { s += x[i] ** 2; n += (x[i] - y[i]) ** 2; }
    expect(10 * Math.log10(s / n)).toBeGreaterThan(30);
  });
  test("a hit at the very start survives", () => {
    const x = new Float32Array(400); x[0] = 0.9; x[1] = -0.8; x[2] = 0.7;
    const y = decodeAdpcm(encodeAdpcm(x), x.length);
    expect(Math.abs(y[0] - 0.9)).toBeLessThan(0.1);
  });
  test("odd lengths decode to the same length", () => {
    expect(decodeAdpcm(encodeAdpcm(ramp(37)), 37).length).toBe(37);
  });
});

describe("packs and names", () => {
  test("a pack round trips names, banks and rates", () => {
    const b = encodePack([{ name: "bd_a", bank: "bd", data: { channels: [ramp(100)], sr: 22050 } }, { name: "sn/x", bank: "sn", data: { channels: [ramp(50), ramp(50)], sr: 44100 } }]);
    const p = readPack(b);
    expect(p.entries.map(e => [e.name, e.bank, e.sr, e.frames])).toEqual([["bd_a", "bd", 22050, 100], ["sn/x", "sn", 44100, 50]]);
    expect(p.decode(p.entries[1]).channels.length).toBe(1);
  });
  test("full names, banks, bank:n with wrap-around, and the drum kit", () => {
    const l = new SampleLibrary();
    for (const n of ["bd_b", "bd_a", "bd_c", "hat/2", "hat/10", "bd_haus"]) l.add(n, { channels: [ramp(10)], sr: 100 });
    expect(l.resolve("bd_b")).toBe("bd_b");
    expect(l.resolve("bd")).toBe("bd_a");
    expect(l.resolve("bd", 1)).toBe("bd_b");
    expect(l.resolve("bd:5")).toBe("bd_b"); // 4 sounds in bd: a, b, c, haus
    expect(l.resolve("bd", -1)).toBe("bd_haus");
    expect(l.resolve("hat", 1)).toBe("hat/10"); // natural order: 2 before 10
    expect(l.resolve("", undefined, "kick")).toBe(KIT.kick);
    expect(l.resolve("nope")).toBeNull();
  });
  test("the bundled library has every kit sound", () => {
    const l = new SampleLibrary();
    expect(l.addPack(new Uint8Array(readFileSync(join(import.meta.dir, "../assets/samples/tine-samples.tsb"))))).toBeGreaterThan(200);
    for (const [drum, name] of Object.entries(KIT)) expect([drum, l.has(name)]).toEqual([drum, true]);
  });
  test("a loaded pack's banks replace bundled banks of the same name", () => {
    const l = new SampleLibrary();
    l.add("bd_haus", { channels: [ramp(10)], sr: 100 });
    l.addRemotePack([{ name: "bd/0", bank: "bd", url: "https://x/a.wav" }, { name: "bd/1", bank: "bd", url: "https://x/b.wav" }]);
    expect(l.resolve("bd")).toBe("bd/0");
    expect(l.resolve("bd", 2)).toBe("bd/0");
    expect(l.resolve("bd_haus")).toBe("bd_haus");
    expect(l.pendingUrl("bd/1")).toBe("https://x/b.wav");
  });
  test("strudel.json sample maps and github shorthand", () => {
    const m = parseSampleMap({ _base: "https://x.org/s/", bd: ["bd/a.wav", "bd/b.wav"], sn: "sn/c.wav" }, "https://x.org/strudel.json");
    expect(m).toEqual([
      { name: "bd/0", bank: "bd", url: "https://x.org/s/bd/a.wav" },
      { name: "bd/1", bank: "bd", url: "https://x.org/s/bd/b.wav" },
      { name: "sn/0", bank: "sn", url: "https://x.org/s/sn/c.wav" },
    ]);
    expect(parseSampleMap({ hh: ["a.wav"] }, "https://y.org/p/strudel.json")[0].url).toBe("https://y.org/p/a.wav");
    expect(sampleMapUrl("github:tidalcycles/dirt-samples")).toBe("https://raw.githubusercontent.com/tidalcycles/dirt-samples/main/strudel.json");
  });
});

describe("sample playback", () => {
  const sm = { channels: [ramp(1000)], sr: 1000 };
  const play = (params: Record<string, any>, semi = 60, durSec = 1) => renderSample(sm, { semi, vel: 1, durSec, params }, 1000);
  test("as recorded at c4, an octave up at c5", () => {
    expect(play({}).length).toBe(1000);
    expect(Math.abs(play({}, 72).length - 500)).toBeLessThan(3);
  });
  test("speed, and negative speed plays backwards", () => {
    expect(Math.abs(play({ speed: 2 }).length - 500)).toBeLessThan(3);
    const r = play({ speed: -1 });
    expect(r[1]).toBeGreaterThan(r[r.length - 2]);
  });
  test("begin and end choose the part", () => {
    const x = play({ begin: 0.5, end: 0.75 });
    expect(Math.abs(x.length - 250)).toBeLessThan(3);
    expect(x[100]).toBeCloseTo(ramp(1000)[600], 2);
  });
  test("fit stretches the part to the note; loopSec stretches the whole sound", () => {
    expect(Math.abs(play({ fit: true }, 60, 2).length - 2000)).toBeLessThan(3);
    expect(Math.abs(play({ loopSec: 4, begin: 0, end: 0.25 }).length - 1000)).toBeLessThan(3);
  });
  test("accel bends the speed as it plays", () => {
    expect(play({ accel: 1 }).length).toBeLessThan(800);
  });
  test("cutSec stops it", () => {
    expect(play({ cutSec: 0.1 }).length).toBe(100);
  });
  test("gain and velocity scale it", () => {
    expect(renderSample(sm, { semi: 60, vel: 1, durSec: 1, params: { gain: 0.5 } }, 1000)[500]).toBeCloseTo(0.125, 2);
  });
});

describe("sample patterns", () => {
  test("a string in a phrase is a sample name, played unpitched", () => {
    const n = notes(`voice a = ["bd_haus" . "sn:2" .]`);
    expect(n.map(x => x.params.inst)).toEqual(["sample:bd_haus", "sample:sn:2"]);
    expect(n[0].params.hit).toBe(true);
  });
  test("sample() on drum names keeps the drum", () => {
    const n = notes(`voice d = [kick snare].sample()`);
    expect(n.map(x => [x.params.inst, x.params.drum])).toEqual([["sample:", "kick"], ["sample:", "snare"]]);
  });
  test("sample name and n may be patterns", () => {
    const n = notes(`voice h = [c*4].sample("hat", n: [0 1 2 3])`);
    expect(n.map(x => x.params.sampleN)).toEqual([0, 1, 2, 3]);
  });
  test("slice, splice and chop", () => {
    expect(notes(`voice a = [c c].sample("x").slice(4, [1 3])`).map(x => [x.params.begin, x.params.end])).toEqual([[0.25, 0.5], [0.75, 1]]);
    expect(notes(`voice a = [c].sample("x").splice(2, 1)`)[0].params.fit).toBe(true);
    const c = notes(`voice a = ["loop"].chop(4)`);
    expect(c.map(x => [x.bar, x.params.begin, x.params.end])).toEqual([[0, 0, 0.25], [0.25, 0.25, 0.5], [0.5, 0.5, 0.75], [0.75, 0.75, 1]]);
  });
  test("loopAt slows the phrase and sets the sound's length in seconds", () => {
    const n = notes(`tempo 120\nvoice a = ["loop"].loopAt(2).chop(4)`, 2);
    expect(n.map(x => x.bar)).toEqual([0, 0.5, 1, 1.5]);
    expect(n[0].params.loopSec).toBeCloseTo(4, 6);
  });
  test("chop keeps working in the second bar of a long loop", () => {
    const s = evaluate(`voice a = ["loop"].loopAt(4).chop(8)`, { seed: 1 });
    const n = renderNotes(s, 4).notes;
    expect(n.length).toBe(8);
    expect(n[5].params.begin).toBeCloseTo(5 / 8, 9);
  });
  test("cut groups stop the previous sound in any voice", () => {
    const n = applyCuts([{ time: 0, params: { cut: 1 } }, { time: 0.5, params: { cut: 2 } }, { time: 0.75, params: { cut: 1 } }]);
    expect(n[0].params.cutSec).toBe(0.75);
    expect(n[1].params.cutSec).toBeUndefined();
  });
  test("samples(...) lines are collected by the scene", () => {
    const s = evaluate(`samples("github:tidalcycles/dirt-samples")\nsamples("./drums")\nvoice a = [c]`, { seed: 1 });
    expect(s.sampleSources).toEqual(["github:tidalcycles/dirt-samples", "./drums"]);
  });
  test("mix plays library sounds and skips unknown ones", () => {
    const l = lib();
    const out = (src: string) => { const s = evaluate(src, { seed: 1 }); const r = renderNotes(s, 1); return mix(r.notes, r.seconds, 1000, { samples: l, tail: 0 })[0]; };
    const peak = (x: Float32Array) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(peak(out(`voice a = ["ramp"]`))).toBeGreaterThan(0.1);
    expect(peak(out(`voice a = ["nothing"]`))).toBe(0);
  });
});
