import { Guide } from "./types";
import { TIME } from "./time";
import { RHYTHM } from "./rhythm";
import { CHANCE } from "./chance";
import { GEN } from "./gen";
import { PITCH } from "./pitch";
import { HARMONY } from "./harmony";
import { LISTS } from "./lists";
import { SOUND } from "./sound";

export type { Guide, Example } from "./types";

/** The guide for each builtin, by name. */
export const GUIDES: Record<string, Guide> = { ...TIME, ...RHYTHM, ...CHANCE, ...GEN, ...PITCH, ...HARMONY, ...LISTS, ...SOUND };
