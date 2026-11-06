import type { Cell, Exercise, Question } from "../cells";
export type { Cell, Exercise, Question };
export type Part = string | Cell | { exercise: Exercise } | { quiz: Question[] };
export interface Lesson { id: string; title: string; parts: Part[] }
export interface Unit { id: string; code: string; title: string; blurb: string; lessons: Lesson[] }
