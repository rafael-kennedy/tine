import { test, expect, describe } from "bun:test";
import { evaluate, renderNotes, mix, renderNote, processBus, fxOf } from "../src/core";

const render = (src: string, bars = 1) => {
  const s = evaluate(src, { seed: 1 });
  const r = renderNotes(s, bars);
  return mix(r.notes, r.seconds, 8000, { tail: 2 })[0];
};
const energy = (x: Float32Array, a: number, b: number) => { let e = 0; for (let i = a; i < Math.min(b, x.length); i++) e += x[i] * x[i]; return e; };

describe("per-voice effects", () => {
  test("delay time is in bars and becomes seconds", () => {
    const n = renderNotes(evaluate("tempo 120\nvoice a = [c].delay(.5, time: 1/4)", { seed: 1 }), 1).notes;
    expect(n[0].params.delaySec).toBeCloseTo(0.5, 6);
    expect(n[0].params.delayTime).toBeUndefined();
  });
  test("a delay repeats the voice", () => {
    const dry = render("tempo 120\nvoice a = [c . . .].legato(.1).inst(sine).reverb(0)");
    const wet = render("tempo 120\nvoice a = [c . . .].legato(.1).inst(sine).reverb(0).delay(.8, time: 1/4, feedback: 0)");
    // 1/4 bar at 120 bpm in 4/4 is 0.5 s: the echo lands at 4000 samples
    expect(energy(wet, 4000, 4800)).toBeGreaterThan(energy(dry, 4000, 4800) * 20);
  });
  test("lpf darkens", () => {
    const hi = (x: Float32Array) => { let e = 0; for (let i = 1; i < x.length; i++) e += (x[i] - x[i - 1]) ** 2; return e; };
    const open = render("voice a = [c5 e5].inst(saw).reverb(0)");
    const shut = render("voice a = [c5 e5].inst(saw).reverb(0).lpf(300)");
    expect(hi(shut)).toBeLessThan(hi(open) / 4);
  });
  test("drive raises quiet signals", () => {
    const L = new Float32Array(100).fill(0.01), R = new Float32Array(100).fill(0.01);
    processBus(L, R, 8000, [{ time: 0, fx: fxOf({ drive: 1 }) }]);
    expect(L[50]).toBeGreaterThan(0.02);
  });
  test("no effects, no change", () => {
    const a = render("voice a = [c e g]");
    const b = render("voice a = [c e g].lpf(0)");
    expect(b.length).toBe(a.length);
  });
  test("a note renders the same whatever came before", () => {
    const spec = { inst: "kit", freq: 0, semi: 38, vel: 0.8, dur: 0.2, params: {} };
    const first = renderNote(spec, 8000);
    renderNote({ ...spec, semi: 42 }, 8000);
    expect([...renderNote(spec, 8000)]).toEqual([...first]);
  });
});

describe("the 1.2 effects", () => {
  const SR = 8000;
  const sine = (hz: number, n = SR, a = 0.5) => Float32Array.from({ length: n }, (_, i) => a * Math.sin(2 * Math.PI * hz * i / SR));
  const noise = (n = SR) => { let s = 7; return Float32Array.from({ length: n }, () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s / 2 ** 32 - 0.5) * 0.5; }); };
  const run = (x: Float32Array, p: Record<string, any>, ducks: number[] = []) => { const L = x.slice(), R = x.slice(); processBus(L, R, SR, [{ time: 0, fx: fxOf(p) }], ducks); return L; };
  // energy at one frequency (Goertzel), over the second half
  const at = (x: Float32Array, hz: number) => { const k = 2 * Math.cos(2 * Math.PI * hz / SR); let a = 0, b = 0; for (let i = x.length >> 1; i < x.length; i++) { const c = x[i] + k * a - b; b = a; a = c; } return Math.sqrt(a * a + b * b - k * a * b) / (x.length / 2); };
  const rms = (x: Float32Array, a = 0, b = x.length) => { let e = 0; for (let i = a; i < b; i++) e += x[i] * x[i]; return Math.sqrt(e / (b - a)); };

  test("crush quantizes to 2^(bits-1) steps", () => {
    const y = run(sine(50), { crush: 2 });
    expect(new Set([...y].map(v => v.toFixed(4))).size).toBeLessThanOrEqual(5);
  });
  test("coarse holds samples", () => {
    const y = run(noise(), { coarse: 4 });
    expect(y[100]).toBe(y[101]); expect(y[101]).toBe(y[102]); expect(y[102]).toBe(y[103]);
  });
  test("ring moves a tone to sum and difference", () => {
    const y = run(sine(300), { ring: 1000 });
    expect(at(y, 1300)).toBeGreaterThan(0.1);
    expect(at(y, 700)).toBeGreaterThan(0.1);
    expect(at(y, 300)).toBeLessThan(0.02);
  });
  test("vowels shape the spectrum differently", () => {
    const a = run(noise(), { vowel: "a" }), i = run(noise(), { vowel: "i" });
    expect(at(a, 800) / at(a, 270)).toBeGreaterThan(at(i, 800) / at(i, 270));
  });
  test("chorus and phaser change the sound but keep its level", () => {
    for (const p of [{ chorus: 1 }, { phaser: 1, phaserDepth: 1 }]) {
      const x = noise(), y = run(x, p);
      let diff = 0; for (let i = 0; i < x.length; i++) diff += Math.abs(x[i] - y[i]);
      expect(diff / x.length).toBeGreaterThan(0.01);
      expect(rms(y) / rms(x)).toBeGreaterThan(0.5); expect(rms(y) / rms(x)).toBeLessThan(1.5);
    }
  });
  test("the compressor narrows the gap between loud and quiet", () => {
    const loud = rms(run(sine(200, SR, 0.9), { comp: -24, compRatio: 8 }), SR / 2), quiet = rms(run(sine(200, SR, 0.05), { comp: -24, compRatio: 8 }), SR / 2);
    expect(loud / quiet).toBeLessThan(0.9 / 0.05 / 3);
  });
  test("room leaves a tail", () => {
    const x = new Float32Array(SR); x.set(noise(SR / 4));
    expect(rms(run(x, { room: 1 }), SR / 2)).toBeGreaterThan(1e-3);
    expect(rms(run(x, {}), SR / 2)).toBe(0);
  });
  test("duck dips at each trigger and recovers", () => {
    const y = run(sine(200, SR), { duck: "kick", duckDepth: 1, duckSec: 0.25 }, [0.5]);
    const before = rms(y, 3600, 4000), dip = rms(y, 4080, 4200), after = rms(y, 7000, 7400);
    expect(dip).toBeLessThan(before * 0.3);
    expect(after).toBeGreaterThan(before * 0.9);
  });
  test("ducking follows the named voice in a mix", () => {
    const s = evaluate("tempo 120\nvoice pad = [c4].inst(sine).legato(1).reverb(0).duck(\"kick\", depth: 1, release: 1/16)\nvoice kick = [. . c6 .].inst(sine).gain(0).reverb(0)", { seed: 1 });
    const r = renderNotes(s, 1);
    const L = mix(r.notes, r.seconds, 8000, { tail: 0 })[0];
    // the kick lands at 1 s (bar 1/2 at 120 bpm)
    expect(rms(L, 8040, 8200)).toBeLessThan(rms(L, 7000, 7800) * 0.4);
  });
  test("everything at once stays finite and bounded", () => {
    const y = run(noise(), { hpf: 100, lpf: 3000, vowel: "o", drive: 1, crush: 6, coarse: 2, ring: 300, chorus: 1, phaser: 1, comp: -30, delay: 1, feedback: 0.95, room: 1, roomSize: 1, duck: "x" }, [0.1, 0.2]);
    for (const v of y) expect(Number.isFinite(v)).toBe(true);
    expect(y.reduce((m, v) => Math.max(m, Math.abs(v)), 0)).toBeLessThan(8);
  });
  test("the effect builtins set their parameters", () => {
    const n = renderNotes(evaluate("tempo 120\nvoice a = [c].ring(220, mix: .5).chorus(.4, rate: 2).phaser(depth: .3).compress(-12, ratio: 3).room(.6, size: .9).crush(8).coarse(2).vowel(\"e\").duck(\"b\", release: 1/4)", { seed: 1 }), 1).notes[0].params;
    expect(fxOf(n)).toMatchObject({ ring: 0.5, ringHz: 220, chorus: 0.4, chorusHz: 2, phaser: 0.5, phaserDepth: 0.3, comp: -12, compRatio: 3, room: 0.6, roomSize: 0.9, crush: 8, coarse: 2, vowel: 2, duck: "b" });
    expect(n.duckSec).toBeCloseTo(0.5, 6);
  });
});
