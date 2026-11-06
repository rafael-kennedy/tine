import { UNIT1 } from "./unit1";
import { UNIT2 } from "./unit2";
import { UNIT3 } from "./unit3";
import type { Unit, Lesson } from "./types";
export const UNITS: Unit[] = [UNIT1, UNIT2, UNIT3];
export const COURSE_LESSONS: (Lesson & { unit: Unit; n: number })[] = UNITS.flatMap(u => u.lessons.map(l => ({ ...l, unit: u }))).map((l, i) => ({ ...l, n: i + 1 }));
export type { Unit, Lesson };
