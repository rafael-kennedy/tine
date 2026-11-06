import { test, expect } from "bun:test";
import { evaluate, renderNotes, renderNote } from "../src/core";
import { plainParams } from "../src/web/engine";

test("a job survives the trip to the synthesis worker", () => {
  const n = renderNotes(evaluate("voice v = [b3 d4].inst(tri).gain(.8).pan(1/2).ctl(1, 1/2)", { seed: 1 }), 1).notes[0];
  const sent = structuredClone(plainParams(n.params));
  const data = renderNote({ inst: "tri", freq: 247, semi: n.semi, vel: n.vel, dur: 0.2, params: sent }, 8000);
  expect(data.every(Number.isFinite)).toBe(true);
  expect(data.some(x => x !== 0)).toBe(true);
  expect(sent.pan).toBe(0.5);
});
