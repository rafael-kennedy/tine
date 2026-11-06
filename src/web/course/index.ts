import { UNIT0 } from "./unit0";
import { UNIT1 } from "./unit1";
import { UNIT2 } from "./unit2";
import { UNIT3 } from "./unit3";
import { UNIT4 } from "./unit4";
import type { Unit, Lesson } from "./types";
export const UNITS: Unit[] = [UNIT0, UNIT1, UNIT2, UNIT3, UNIT4];
// Theory 100 lessons are numbered 0.1, 0.2, ...; the college sequence keeps 1 to 35, so "lesson 14" in the prose stays right.
const ZERO = UNIT0.lessons.length;
export const COURSE_LESSONS: (Lesson & { unit: Unit; n: number; label: string })[] = UNITS.flatMap(u => u.lessons.map(l => ({ ...l, unit: u })))
  .map((l, i) => ({ ...l, n: i + 1, label: l.unit === UNIT0 ? `0.${i + 1}` : String(i + 1 - ZERO) }));
export type { Unit, Lesson };
