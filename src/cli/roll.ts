// ASCII piano roll for the terminal REPL.
import { TimedNote, pitchName } from "../core";

const C = { dim: "\x1b[2m", reset: "\x1b[0m", brass: "\x1b[38;5;179m", teal: "\x1b[38;5;73m", red: "\x1b[31m", bold: "\x1b[1m" };
export const color = (on: boolean) => (on ? C : { dim: "", reset: "", brass: "", teal: "", red: "", bold: "" });

function lcmDen(xs: number[], cap = 48): number {
  let grid = 1;
  for (const x of xs) {
    let d = 1; while (d <= cap && Math.abs(Math.round(x * d) - x * d) > 1e-6) d++;
    if (d > cap) return cap;
    const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
    grid = (grid * d) / g(grid, d);
    if (grid > cap) return cap;
  }
  return grid;
}

export function roll(notes: TimedNote[], bars: number, useColor = true, width = 64): string {
  const c = color(useColor);
  if (!notes.length) return `${c.dim}(silence)${c.reset}`;
  let steps = lcmDen(notes.flatMap(n => [n.bar % 1, (n.bar + n.bars) % 1]));
  steps = Math.max(steps, 4);
  while (steps * bars > width && steps > 4) steps = Math.ceil(steps / 2);
  const cols = steps * bars;
  const rows = new Map<string, { semi: number; cells: string[] }>();
  for (const n of notes) {
    const label = n.params.inst === "kit" ? drumName(Math.round(n.semi)) : pitchName(n.semi);
    const key = `${label}`;
    if (!rows.has(key)) rows.set(key, { semi: n.semi, cells: Array(cols).fill(" ") });
    const r = rows.get(key)!;
    const a = Math.floor(n.bar * steps + 1e-9), b = Math.max(a + 1, Math.round((n.bar + n.bars) * steps));
    for (let i = a; i < b && i < cols; i++) if (i >= 0) r.cells[i] = i === a ? "●" : (r.cells[i] === "●" ? "●" : "─");
  }
  const sorted = [...rows.entries()].sort((x, y) => y[1].semi - x[1].semi);
  const w = Math.max(...sorted.map(([k]) => k.length));
  const lines: string[] = [];
  for (const [k, r] of sorted) {
    let line = "";
    for (let i = 0; i < cols; i++) {
      const bar = i % steps === 0;
      const ch = r.cells[i];
      line += ch === " " ? `${c.dim}${bar ? "┊" : "·"}${c.reset}` : ch === "●" ? `${c.brass}●${c.reset}` : `${c.brass}─${c.reset}`;
    }
    lines.push(`${c.teal}${k.padStart(w)}${c.reset} ${line}`);
  }
  return lines.join("\n");
}

const DRUM_NAMES: Record<number, string> = { 35: "kick2", 36: "kick", 37: "rim", 38: "snare", 39: "clap", 40: "snare2", 42: "hat", 44: "pedal", 46: "ohat", 49: "crash", 51: "ride", 56: "cowbell" };
function drumName(n: number) { return DRUM_NAMES[n] ?? `drum${n}`; }
