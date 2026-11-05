// Turn notes played on a MIDI keyboard into Tine phrase code.
import { pitchName } from "../core";

export interface Captured { note: number; on: number; off: number; vel: number } // bars relative to capture start

function barTokens(notes: Captured[], bar: number, grid: number): string[] {
  const steps: { notes: number[]; len: number }[] = Array.from({ length: grid }, () => ({ notes: [], len: 0 }));
  for (const n of notes) {
    const k = Math.round((n.on - bar) * grid);
    if (k < 0 || k >= grid) continue;
    steps[k].notes.push(n.note);
    steps[k].len = Math.max(steps[k].len, Math.max(1, Math.round((n.off - n.on) * grid)));
  }
  const toks: string[] = [];
  for (let k = 0; k < grid; ) {
    const s = steps[k];
    if (!s.notes.length) { toks.push("."); k++; continue; }
    const names = [...new Set(s.notes)].sort((a, b) => a - b).map(pitchName);
    toks.push(names.length === 1 ? names[0] : `{${names.join(" ")}}`);
    let j = 1;
    while (j < s.len && k + j < grid && !steps[k + j].notes.length) { toks.push("_"); j++; }
    k += j;
  }
  // halve the resolution wherever that keeps the rhythm exact
  let t = toks;
  while (t.length % 2 === 0 && t.length > 1) {
    const out: string[] = [];
    let ok = true;
    for (let i = 0; i < t.length; i += 2) {
      const a = t[i], b = t[i + 1];
      if (b === "_" && a !== ".") out.push(a);
      else if (a === "." && b === ".") out.push(".");
      else { ok = false; break; }
    }
    if (!ok) break;
    t = out;
  }
  return t;
}

export function captureToCode(notes: Captured[], bars: number, grid: number, name: string, inst: string): string {
  if (!notes.length) return "";
  const phrases: string[] = [];
  for (let b = 0; b < bars; b++) {
    const toks = barTokens(notes, b, grid);
    phrases.push(toks.every(x => x === "." || x === "_") ? "." : `[${toks.join(" ")}]`);
  }
  const unique = new Set(phrases);
  const body = unique.size === 1 ? phrases[0] : `<${phrases.join(" ")}>`;
  const vel = notes.reduce((s, n) => s + n.vel, 0) / notes.length;
  return `voice ${name} = ${body}.inst(${inst}).vel(${vel.toFixed(2)})`;
}
