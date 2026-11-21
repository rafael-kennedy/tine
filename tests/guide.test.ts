import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluate, renderNotes, builtinList } from "../src/core";
import { GUIDES } from "../src/core/guide";

const readFile = (p: string) => readFileSync(join(import.meta.dir, "../examples", p), "utf8");

describe("function guide", () => {
  test("every builtin has a guide with at least two examples", () => {
    const missing = builtinList().map(b => b.name).filter(n => !GUIDES[n] || GUIDES[n].examples.length < 2);
    expect(missing).toEqual([]);
  });
  test("every guide is for a builtin, and its see-also names exist", () => {
    const names = new Set(builtinList().map(b => b.name));
    expect(Object.keys(GUIDES).filter(n => !names.has(n))).toEqual([]);
    expect(Object.entries(GUIDES).flatMap(([n, g]) => (g.see ?? []).filter(s => !names.has(s)).map(s => `${n} -> ${s}`))).toEqual([]);
  });
  for (const [name, g] of Object.entries(GUIDES)) {
    g.examples.forEach((e, i) => {
      test(`${name} example ${i + 1}`, () => {
        expect(new RegExp(`\\b${name}\\b`).test(e.code)).toBe(true);
        const s = evaluate(e.code, { seed: 1, readFile });
        const { notes } = renderNotes(s, e.bars ?? 4);
        // an example that needs a device (a MIDI keyboard) may be silent here
        if (e.live !== false) expect(notes.length + s.prints.length).toBeGreaterThan(0);
        // a setting given a value it cannot use shows up as text like "<pattern>"
        expect(notes.flatMap(n => Object.values(n.params ?? {})).filter(v => typeof v === "string" && /<|object/.test(v))).toEqual([]);
        // a silently broken setting shows up as NaN
        expect(notes.filter(n => !Number.isFinite(n.vel) || !Number.isFinite(n.semi) || !Number.isFinite(n.bar)).length).toBe(0);
      });
    });
  }
});
