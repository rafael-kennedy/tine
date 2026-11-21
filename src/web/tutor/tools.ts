// The tutor's hands: run Tine code and describe what it plays, describe a
// page's editors for the model, and check a proposed edit before it is shown.
// Nothing here touches the DOM, so the tests can run it directly.
import { evaluate, renderNotes, pitchName, formatError, TineError } from "../../core";
import { DRUMS } from "../../core/pitch";

const DRUM_NAME: Record<number, string> = Object.fromEntries(Object.entries(DRUMS).map(([k, v]) => [v, k]));
const round = (x: number) => Math.round(x * 100) / 100;

// Run code the way the pages do and list what it plays, in words the model can check.
export function runTine(code: string, bars: number, seed: number, limit = 80): string {
  try {
    const s = evaluate(code, { seed, keepGoing: true });
    if (s.errors.length) return s.errors.map(e => formatError(code, e, "code")).join("\n");
    const { notes } = renderNotes(s, s.form ? undefined : Math.max(1, Math.min(16, bars)));
    const beats = s.meter?.[0] ?? 4;
    const rows = notes.slice(0, limit).map(n => {
      const beat = (n.bar % 1) * beats + 1;
      const drum = n.params?.inst === "kit" || n.params?.drum ? DRUM_NAME[Math.round(n.semi)] : undefined;
      return `${n.voice}: bar ${Math.floor(n.bar) + 1} beat ${round(beat)} ${drum ?? pitchName(n.semi)} for ${round(n.bars * beats)} beat(s)`;
    });
    return [
      `tempo ${round(s.tempo)}, meter ${s.meter[0]}/${s.meter[1]}, seed ${s.seed}. ${notes.length} notes.`,
      ...rows, notes.length > limit ? `(${notes.length - limit} more notes not shown)` : "",
      ...s.prints.map(p => "print: " + p),
    ].filter(Boolean).join("\n");
  } catch (e) {
    return formatError(code, e instanceof TineError ? e : new TineError("runtime", (e as Error).message), "code");
  }
}

// The errors in some code, or null when it runs (and can play its first bars).
export function errorsIn(code: string, seed: number): string | null {
  try {
    const s = evaluate(code, { seed, keepGoing: true });
    if (s.errors.length) return s.errors.map(e => formatError(code, e, "code")).join("\n");
    renderNotes(s, s.form ? undefined : 2);
    return null;
  } catch (e) {
    return formatError(code, e instanceof TineError ? e : new TineError("runtime", (e as Error).message), "code");
  }
}

// What an editor holds and what the language makes of it, for the model to read.
export interface EditorState { label: string; code: string }
export function describeEditor(ed: EditorState, seed: number): string {
  let status: string;
  try {
    const s = evaluate(ed.code, { seed, keepGoing: true });
    status = s.errors.length
      ? "Errors:\n" + s.errors.map(e => formatError(ed.code, e, ed.label)).join("\n")
      : `Runs without errors. Voices: ${[...s.voices.keys()].join(", ") || "none"}.` + (s.prints.length ? `\nprint output:\n${s.prints.join("\n")}` : "");
  } catch (e) {
    status = "Errors:\n" + formatError(ed.code, e, ed.label);
  }
  const numbered = ed.code.split("\n").map((l, i) => `${String(i + 1).padStart(3)}| ${l}`).join("\n");
  return `[${ed.label}]\n${numbered}\n${status}`;
}

// A change the tutor proposes: exact find/replace pairs, as a code editor's
// search would do them. Each `find` must occur once, so the edit lands where
// the model meant it even if the learner typed elsewhere meanwhile.
export interface Edit { find: string; replace: string }
export function applyEdits(code: string, edits: Edit[]): { code: string } | { error: string } {
  let out = code;
  for (const [i, e] of edits.entries()) {
    if (e.find === "") { if (edits.length === 1 && out.trim() === "") { out = e.replace; continue; } return { error: `edit ${i + 1}: find is empty` }; }
    const at = out.indexOf(e.find);
    if (at < 0) return { error: `edit ${i + 1}: the text to find is not in the editor. Copy it exactly from the editor contents.` };
    if (out.indexOf(e.find, at + 1) >= 0) return { error: `edit ${i + 1}: the text to find occurs more than once. Include more of the surrounding lines.` };
    out = out.slice(0, at) + e.replace + out.slice(at + e.find.length);
  }
  return { code: out };
}

// A line diff (longest common subsequence), small enough for pieces of a few hundred lines.
export type DiffLine = { op: " " | "-" | "+"; text: string };
export function diffLines(a: string, b: string): DiffLine[] {
  const x = a.split("\n"), y = b.split("\n");
  const n = x.length, m = y.length;
  if (n * m > 400_000) return [...x.map(text => ({ op: "-" as const, text })), ...y.map(text => ({ op: "+" as const, text }))];
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { out.push({ op: " ", text: x[i] }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) out.push({ op: "-", text: x[i++] });
    else out.push({ op: "+", text: y[j++] });
  }
  while (i < n) out.push({ op: "-", text: x[i++] });
  while (j < m) out.push({ op: "+", text: y[j++] });
  return out;
}

// Keep only changed lines and two lines of context around them.
export function trimDiff(d: DiffLine[], ctx = 2): (DiffLine | null)[] {
  const keep = d.map((l, i) => d.slice(Math.max(0, i - ctx), i + ctx + 1).some(k => k.op !== " "));
  const out: (DiffLine | null)[] = [];
  d.forEach((l, i) => { if (keep[i]) out.push(l); else if (out[out.length - 1] !== null) out.push(null); });
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}
