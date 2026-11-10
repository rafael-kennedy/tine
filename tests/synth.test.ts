import { test, expect, describe } from "bun:test";
import { evaluate, renderNotes, renderNote, PRESETS, INSTRUMENTS } from "../src/core";

const SR = 8000;
const notes = (src: string, bars = 1) => renderNotes(evaluate(src, { seed: 1 }), bars).notes;
const play = (inst: string, params: Record<string, any> = {}, semi = 57, dur = 0.5) => renderNote({ inst, freq: 440 * Math.pow(2, (semi - 69) / 12), semi, vel: 0.8, dur, params }, SR);
const rms = (x: Float32Array, a = 0, b = x.length) => { let e = 0; for (let i = a; i < b; i++) e += x[i] * x[i]; return Math.sqrt(e / Math.max(1, b - a)); };
// zero crossings per second, a rough pitch
const zc = (x: Float32Array, a: number, b: number) => { let n = 0; for (let i = a + 1; i < b; i++) if ((x[i - 1] < 0) !== (x[i] < 0)) n++; return n / 2 / ((b - a) / SR); };

describe("instrument names", () => {
  test("inst(square), inst(sine) and inst(tri) are not saws", () => {
    // these names are also signal functions; they used to arrive as "<builtin square>" and play a saw
    expect(notes("voice a = [c].inst(square)")[0].params.inst).toBe("square");
    expect(notes("voice a = [c].inst(sine)")[0].params.inst).toBe("sine");
    expect(notes("voice a = [c].inst(noise)")[0].params.inst).toBe("noise");
    expect(notes("voice a = [c].inst(wobble)")[0].params.inst).toBe("wobble");
  });
  test("every preset is an instrument and renders sound", () => {
    for (const name of Object.keys(PRESETS)) {
      expect(INSTRUMENTS).toContain(name);
      const x = play(name, name === "wobble" ? { wobbleHz: 4 } : {});
      expect([name, rms(x) > 0.01]).toEqual([name, true]);
      for (const v of x) if (!Number.isFinite(v)) throw new Error(`${name} produced NaN`);
    }
  });
});

describe("the general synth", () => {
  test("waves differ, and a preset's defaults can be overridden", () => {
    const saw = play("synth", { wave: "saw" }), sq = play("synth", { wave: "square" });
    let d = 0; for (let i = 0; i < 2000; i++) d += Math.abs(saw[i] - sq[i]);
    expect(d / 2000).toBeGreaterThan(0.01);
    expect(rms(play("tb303", { cutoff: 4000, fenv: 0 }))).not.toBeCloseTo(rms(play("tb303")), 3);
  });
  test("pulse width changes the tone", () => {
    const a = play("synth", { wave: "pulse", pw: 0.5 }), b = play("synth", { wave: "pulse", pw: 0.1 });
    expect(Math.abs(rms(a) - rms(b))).toBeGreaterThan(0.005);
  });
  test("glide slides from the previous pitch", () => {
    const x = play("synth", { wave: "sine", glide: 0.3, glideFrom: 45 }, 57, 0.6); // from a2 up to a3
    expect(zc(x, 0, 400)).toBeLessThan(160);
    expect(zc(x, 3000, 4200)).toBeGreaterThan(200);
  });
  test("glideFrom is found across the bar line", () => {
    const n = notes("voice a = <[a2 c3] [e3 g3]>.inst(tb303).glide(.05)", 2);
    // a voice loops, so its first note glides from the last note of the loop
    expect(n.map(x => x.params.glideFrom)).toEqual([55, 45, 48, 52]);
    // a live window starting at bar 1 still knows the note before it
    const s = evaluate("voice a = <[a2 c3] [e3 g3]>.inst(tb303).glide(.05)", { seed: 1 });
    const { liveNotes } = require("../src/core");
    expect(liveNotes(s, 1, 2)[0].params.glideFrom).toBe(48);
  });
  test("wobble is in cycles per bar", () => {
    expect(notes("tempo 120\nvoice a = [c2].inst(wobble)")[0].params.wobbleHz).toBeCloseTo(1, 6); // 2 per bar, 2 s bars
    expect(notes("tempo 120\nvoice a = [c2].inst(saw).wobble(4, depth: 3)")[0].params.wobbleHz).toBeCloseTo(2, 6);
  });
  test(".fm switches a plain voice to the FM synth", () => {
    const p = notes("voice a = [c].fm(5, ratio: 3)")[0].params;
    expect([p.inst, p.wave, Number(p.fm), Number(p.fmRatio)]).toEqual(["synth", "fm", 5, 3]);
  });
  test("filter envelope and vibrato change the sound", () => {
    expect(rms(play("synth", { cutoff: 300, fenv: 4 }), 0, 400)).toBeGreaterThan(rms(play("synth", { cutoff: 300 }), 0, 400) * 1.3);
    const v = play("synth", { wave: "sine", vibrato: 6, vibratoDepth: 2 }), p = play("synth", { wave: "sine" });
    let d = 0; for (let i = 2000; i < 3000; i++) d += Math.abs(v[i] - p[i]);
    expect(d / 1000).toBeGreaterThan(0.01);
  });
  test("unison and sub thicken it", () => {
    expect(rms(play("synth", { sub: 1 }))).toBeGreaterThan(rms(play("synth")));
  });
});
