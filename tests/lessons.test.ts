import { test, expect } from "bun:test";
import { evaluate, renderNotes } from "../src/core";
import { LESSONS } from "../src/web/lessons";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Every example in the tutorial must run, and every exercise's answer must pass.
for (const lesson of LESSONS) {
  lesson.parts.forEach((part, i) => {
    if (typeof part === "string") return;
    if ("exercise" in part) {
      test(`${lesson.id} exercise ${i}`, () => {
        const s = evaluate(part.exercise.solution, { seed: 1 });
        const { notes } = renderNotes(s, part.exercise.bars ?? 1);
        expect(part.exercise.check(s, notes)).toBeNull();
        // and the starter should not already pass
        const s0 = evaluate(part.exercise.starter, { seed: 1 });
        expect(part.exercise.check(s0, renderNotes(s0, part.exercise.bars ?? 1).notes)).not.toBeNull();
      });
    } else {
      test(`${lesson.id} example ${i}`, () => {
        const s = evaluate(part.code, { seed: 1 });
        const { notes } = renderNotes(s, s.form ? undefined : part.bars ?? 1);
        expect(notes.length).toBeGreaterThan(0);
      });
    }
  });
}

const exdir = join(import.meta.dir, "../examples");
for (const f of readdirSync(exdir).filter(f => f.endsWith(".tine"))) {
  test(`example file ${f}`, () => {
    const s = evaluate(readFileSync(join(exdir, f), "utf8"), { seed: 1, readFile: p => readFileSync(join(exdir, p), "utf8") });
    expect(renderNotes(s, s.form ? undefined : 4).notes.length).toBeGreaterThan(0);
  });
}
