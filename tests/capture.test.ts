import { test, expect } from "bun:test";
import { captureToCode } from "../src/web/capture";
import { evaluate, renderNotes } from "../src/core";

test("captured playing becomes code that plays the same notes", () => {
  const played = [
    { note: 60, on: 0, off: 0.24, vel: 0.8 }, { note: 64, on: 0.25, off: 0.49, vel: 0.8 },
    { note: 67, on: 0.5, off: 0.99, vel: 0.8 }, { note: 60, on: 1.0, off: 1.1, vel: 0.8 }, { note: 64, on: 1.0, off: 1.1, vel: 0.8 },
  ];
  const code = captureToCode(played, 2, 16, "take1", "keys");
  expect(code).toBe("voice take1 = <[c4 e4 g4 _] [{c4 e4} . . . . . . .]>.inst(keys).vel(0.80)");
  const notes = renderNotes(evaluate(code, { seed: 1 }), 2).notes;
  expect(notes.map(n => [n.bar, n.semi])).toEqual([[0, 60], [0.25, 64], [0.5, 67], [1, 60], [1, 64]]);
});
