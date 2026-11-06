import { test, expect, describe } from "bun:test";
import { evaluate, liveNotes } from "../src/core";
import { findToggles, toggleBlock, comboOf, Trigger, hasModifier } from "../src/web/toggles";
import { Transport } from "../src/web/transport";

const SRC = `tempo 120
voice kick = [kick . . .]
-- @fill
-- a crash on one
voice crash = [crash . . .]
voice roll = [snare*16]
-- @end
voice hats = [hat*8]  -- @hats
`;

describe("performance toggles", () => {
  test("blocks and single lines are found", () => {
    const t = findToggles(SRC);
    expect(t.map(x => [x.tag, x.lines, x.on])).toEqual([["fill", [3, 4, 5], true], ["hats", [7], true]]);
  });
  test("a block switches off and back on exactly", () => {
    const off = toggleBlock(SRC, "fill");
    expect(off).toContain("--~ voice crash");
    expect(off).toContain("--~ -- a crash on one");
    expect(findToggles(off)[0].on).toBe(false);
    const s = evaluate(off, { seed: 1 });
    expect([...s.voices.keys()]).toEqual(["kick", "hats"]);
    expect(toggleBlock(off, "fill")).toBe(SRC);
  });
  test("a single tagged line toggles", () => {
    const off = toggleBlock(SRC, "hats");
    expect(off).toContain("--~ voice hats = [hat*8]  -- @hats");
    expect(toggleBlock(off, "hats")).toBe(SRC);
  });
  test("a blank line ends a block", () => {
    expect(findToggles("-- @a\nvoice x = [c]\n\nvoice y = [d]")[0].lines).toEqual([1]);
  });
  test("keys and controls", () => {
    expect(comboOf({ key: "1", ctrlKey: false, metaKey: false, altKey: true, shiftKey: false })).toBe("Alt+1");
    expect(comboOf({ key: "Shift", ctrlKey: false, metaKey: false, altKey: false, shiftKey: true })).toBe(null);
    expect(hasModifier("Alt+1")).toBe(true);
    expect(hasModifier("Q")).toBe(false);
    const t = new Trigger();
    expect([0, 1, 1, 0, 0.8].map(v => t.cc(20, 1, v))).toEqual([false, true, false, false, true]);
  });
});

describe("active voices", () => {
  test("parse, and 'active' is still a name elsewhere", () => {
    const s = evaluate("let active = [c e]\nactive voice lead = active\nvoice pad = [g]", { seed: 1 });
    expect(s.voices.get("lead")!.active).toBe(true);
    expect(s.voices.get("pad")!.active).toBeFalsy();
  });
  test("only active voices swap, at once; others wait", () => {
    const engine: any = { now: 0, onRealtime: null };
    const tr = new Transport(engine);
    const a = evaluate("active voice lead = [c]\nvoice pad = [e]", { seed: 1 });
    tr.load(a);
    (tr as any).playing = true;
    const b = evaluate("active voice lead = [d]\nvoice pad = [f]", { seed: 1 });
    expect(tr.swapActive(b, new Set(["lead", "pad"]))).toEqual(["lead"]);
    const notes = liveNotes(tr.scene!, 0, 1);
    expect(notes.map(n => [n.voice, n.semi]).sort()).toEqual([["lead", 62], ["pad", 64]]);
  });
  test("a deleted active voice stops; a broken one keeps playing", () => {
    const engine: any = { now: 0, onRealtime: null };
    const tr = new Transport(engine);
    tr.load(evaluate("active voice lead = [c]\nactive voice bass = [c2]", { seed: 1 }));
    (tr as any).playing = true;
    tr.swapActive(evaluate("voice other = [e]", { seed: 1 }), new Set(["bass", "other"]));
    expect([...tr.scene!.voices.keys()]).toEqual(["bass"]);
  });
});
