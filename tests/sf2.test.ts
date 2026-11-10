import { test, expect, describe } from "bun:test";
import { parseSf2, findPreset, findPresetByName, renderSf, presetFor, evaluate, renderNotes, mix } from "../src/core";

// A tiny SoundFont built by hand: one sine sample (root c4, 1000 samples a
// cycle-aligned loop), an instrument covering keys 0-127 with a short release,
// a melodic preset (bank 0, program 0) and a drum kit (bank 128, program 0)
// whose zone covers only key 36.
function tinySf2(): Uint8Array {
  const SR = 22050, N = 2205, hz = 22050 / 84; // 84 samples a cycle, near c4 (262.5 Hz)
  const smpl = new Int16Array(N + 46);
  for (let i = 0; i < N; i++) smpl[i] = Math.round(12000 * Math.sin(2 * Math.PI * hz * i / SR));
  const enc = new TextEncoder();
  const chunk = (id: string, body: Uint8Array) => { const out = new Uint8Array(8 + body.length + (body.length & 1)); out.set(enc.encode(id)); new DataView(out.buffer).setUint32(4, body.length, true); out.set(body, 8); return out; };
  const list = (type: string, parts: Uint8Array[]) => { const body = concat([enc.encode(type), ...parts]); return chunk("LIST", body); };
  const concat = (ps: Uint8Array[]) => { const o = new Uint8Array(ps.reduce((n, p) => n + p.length, 0)); let k = 0; for (const p of ps) { o.set(p, k); k += p.length; } return o; };
  const rec = (size: number, fill: (v: DataView, b: Uint8Array) => void) => { const b = new Uint8Array(size); fill(new DataView(b.buffer), b); return b; };
  const name = (b: Uint8Array, s: string) => b.set(enc.encode(s.slice(0, 19)));
  const phdr = concat([
    rec(38, (v, b) => { name(b, "Sine"); v.setUint16(20, 0, true); v.setUint16(22, 0, true); v.setUint16(24, 0, true); }),
    rec(38, (v, b) => { name(b, "Kit"); v.setUint16(20, 0, true); v.setUint16(22, 128, true); v.setUint16(24, 1, true); }),
    rec(38, (v, b) => { name(b, "EOP"); v.setUint16(24, 2, true); }),
  ]);
  const bag = (gens: number[]) => concat(gens.map(g => rec(4, v => v.setUint16(0, g, true))));
  const gen = (op: number, amount: number, range = false) => rec(4, (v, b) => { v.setUint16(0, op, true); if (range) { b[2] = amount & 255; b[3] = amount >> 8; } else v.setInt16(2, amount, true); });
  const pbag = bag([0, 1, 3]);
  const pgen = concat([gen(41, 0), gen(43, 36 | (36 << 8), true), gen(41, 0), gen(0, 0)]);
  const inst = concat([rec(22, (v, b) => { name(b, "SineInst"); v.setUint16(20, 0, true); }), rec(22, (v, b) => { name(b, "EOI"); v.setUint16(20, 1, true); })]);
  const ibag = bag([0, 3]);
  const igen = concat([gen(38, -2400), gen(54, 1), gen(53, 0), gen(0, 0)]); // release ~0.25 s, loop, sample 0
  const shdr = concat([
    rec(46, (v, b) => { name(b, "sine"); v.setUint32(20, 0, true); v.setUint32(24, N, true); v.setUint32(28, 84 * 5, true); v.setUint32(32, 84 * 25, true); v.setUint32(36, SR, true); b[40] = 60; }),
    rec(46, (v, b) => name(b, "EOS")),
  ]);
  const imod = new Uint8Array(10), pmod = new Uint8Array(10);
  const body = concat([enc.encode("sfbk"),
    list("INFO", [chunk("ifil", new Uint8Array([2, 0, 1, 0])), chunk("INAM", enc.encode("Tiny\0"))]),
    list("sdta", [chunk("smpl", new Uint8Array(smpl.buffer))]),
    list("pdta", [chunk("phdr", phdr), chunk("pbag", pbag), chunk("pmod", pmod), chunk("pgen", pgen), chunk("inst", inst), chunk("ibag", ibag), chunk("imod", imod), chunk("igen", igen), chunk("shdr", shdr)]),
  ]);
  return chunk("RIFF", body);
}

const SR = 22050;
const zc = (x: Float32Array, a: number, b: number) => { let n = 0; for (let i = a + 1; i < b; i++) if ((x[i - 1] < 0) !== (x[i] < 0)) n++; return n / 2 / ((b - a) / SR); };

describe("SoundFont 2", () => {
  const sf = parseSf2(tinySf2());
  test("presets, instruments and samples are read", () => {
    expect(sf.name).toBe("Tiny");
    expect(sf.presets.map(p => [p.name, p.bank, p.program])).toEqual([["Sine", 0, 0], ["Kit", 128, 0]]);
    expect(sf.samples[0]).toMatchObject({ name: "sine", root: 60, rate: 22050 });
    expect(findPresetByName(sf, "sin")!.name).toBe("Sine");
  });
  test("a note plays at its pitch, transposed from the root key", () => {
    const x = renderSf(sf, findPreset(sf, 0)!, { semi: 72, vel: 0.8, durSec: 0.5 }, SR);
    expect(zc(x, 2000, 8000)).toBeGreaterThan(500); expect(zc(x, 2000, 8000)).toBeLessThan(550);
  });
  test("the loop sustains past the sample's end, and the release ends it", () => {
    const x = renderSf(sf, findPreset(sf, 0)!, { semi: 60, vel: 0.8, durSec: 1 }, SR); // the sample is 0.1 s
    const rms = (a: number, b: number) => { let e = 0; for (let i = a; i < b; i++) e += x[i] * x[i]; return Math.sqrt(e / (b - a)); };
    expect(rms(15000, 20000)).toBeGreaterThan(0.05);
    expect(x.length).toBeLessThan(SR * 1.3);
  });
  test("key ranges: the kit plays only on its key", () => {
    const kit = findPreset(sf, 0, 128)!;
    expect(renderSf(sf, kit, { semi: 36, vel: 0.8, durSec: 0.2 }, SR).length).toBeGreaterThan(0);
    expect(renderSf(sf, kit, { semi: 50, vel: 0.8, durSec: 0.2 }, SR).length).toBe(0);
  });
  test("gm() picks programs from 1, names, and the kit for drums", () => {
    const n = renderNotes(evaluate(`voice a = [c].gm(1)\nvoice b = [c].gm("sine")\nvoice d = [kick].gm()`, { seed: 1 }), 1).notes;
    const by = (v: string) => n.find(x => x.voice === v)!.params;
    expect(by("a").gmProgram).toBe(0);
    expect(presetFor(sf, by("b"))!.name).toBe("Sine");
    expect(presetFor(sf, by("d"))!.name).toBe("Kit");
  });
  test("soundfont(...) lines are collected, and mix renders gm voices", () => {
    const s = evaluate(`soundfont("x.sf2")\nvoice a = [c e g].gm(1)`, { seed: 1 });
    expect(s.soundfontSources).toEqual(["x.sf2"]);
    const r = renderNotes(s, 1);
    const L = mix(r.notes, r.seconds, SR, { soundfont: sf, tail: 0 })[0];
    expect(L.reduce((m, v) => Math.max(m, Math.abs(v)), 0)).toBeGreaterThan(0.05);
    expect(mix(r.notes, r.seconds, SR, { tail: 0 })[0].every(v => v === 0)).toBe(true);
  });
});
