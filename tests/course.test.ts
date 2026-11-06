import { test, expect } from "bun:test";
import { evaluate, renderNotes } from "../src/core";
import { UNITS, COURSE_LESSONS } from "../src/web/course/index";

// Every example in the theory course must play, every challenge's answer must pass
// (and its starter must not), and every quiz must be well formed and its listening examples must play.
for (const lesson of COURSE_LESSONS) {
  let ex = 0, q = 0;
  lesson.parts.forEach((part, i) => {
    if (typeof part === "string") {
      test(`${lesson.id} prose ${i} has no em-dashes`, () => expect(part.includes("—")).toBe(false));
      return;
    }
    if ("exercise" in part) {
      const e = part.exercise, k = ex++;
      test(`${lesson.id} challenge ${k}`, () => {
        expect(e.task.includes("—")).toBe(false);
        const s = evaluate(e.solution, { seed: 1 });
        expect(e.check(s, renderNotes(s, e.bars ?? 1).notes)).toBeNull();
        // a starter must not pass; one that does not even run (a fix-the-code task) counts as failing
        let verdict: string | null = "error";
        try { const s0 = evaluate(e.starter, { seed: 1 }); verdict = e.check(s0, renderNotes(s0, e.bars ?? 1).notes); } catch { /* fails, as it should */ }
        expect(verdict).not.toBeNull();
      });
    } else if ("quiz" in part) {
      const k = q++;
      test(`${lesson.id} quiz ${k}`, () => {
        for (const qq of part.quiz) {
          expect(qq.answer).toBeGreaterThanOrEqual(0);
          expect(qq.answer).toBeLessThan(qq.options.length);
          expect(new Set(qq.options).size).toBe(qq.options.length);
          for (const t of [qq.q, qq.explain ?? "", ...qq.options]) expect(t.includes("—")).toBe(false);
          if (qq.listen) {
            const s = evaluate(qq.listen, { seed: 1 });
            expect(renderNotes(s, s.form ? undefined : qq.bars ?? 2).notes.length).toBeGreaterThan(0);
          }
        }
      });
    } else if (part.broken) {
      test(`${lesson.id} example ${i} shows an error on purpose`, () => {
        expect(() => renderNotes(evaluate(part.code, { seed: 1 }), 1)).toThrow();
      });
    } else {
      test(`${lesson.id} example ${i}`, () => {
        const s = evaluate(part.code, { seed: 1 });
        expect(renderNotes(s, s.form ? undefined : part.bars ?? 1).notes.length).toBeGreaterThan(0);
      });
    }
  });
}

test("lesson ids are unique", () => {
  const ids = COURSE_LESSONS.map(l => l.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(UNITS.length).toBeGreaterThan(0);
});
