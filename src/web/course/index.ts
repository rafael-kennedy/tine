import { UNIT1 } from "./unit1";
import { UNIT2 } from "./unit2";
import type { Unit, Lesson } from "./types";
export const UNITS: Unit[] = [UNIT1, UNIT2];
export const COURSE_LESSONS: (Lesson & { unit: Unit; n: number })[] = UNITS.flatMap(u => u.lessons.map(l => ({ ...l, unit: u }))).map((l, i) => ({ ...l, n: i + 1 }));
export type { Unit, Lesson };
