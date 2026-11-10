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
        // a chained .inst(x) must reach the notes; a chain that binds to the
        // wrong thing (like the 2 in "[...]*2\n  .inst(saw)") leaves it unset
        // (checked per voice; a voice that plays nothing, like held() with no keyboard, is skipped)
        for (const v of part.code.split(/\n(?=\s*voice )/)) {
          const name = v.match(/(?:^|\n)\s*voice (\w+)/)?.[1];
          const own = notes.filter(n => n.voice === name);
          if (!own.length) continue;
          const insts = new Set(own.map(n => String(n.params.inst ?? "")));
          for (const m of v.matchAll(/\.inst\((\w+)\)/g)) expect([name, m[1], insts.has(m[1])]).toEqual([name, m[1], true]);
        }
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
