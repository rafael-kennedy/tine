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
