// Performance toggles: blocks of code switched on and off from a MIDI
// control or a key, like muting a channel, but for any lines of code.
//
// A block is named in the code itself, so it survives edits and lives in the file:
//
//   -- @fill                      a line holding only a tag opens a block
//   voice crash = [crash . . .]
//   voice roll = [snare*16].vel(saw(1))
//   -- @end                       and @end (or a blank line) closes it
//
//   voice hats = [hat*8]  -- @hats    a tag at the end of a line marks that one line
//
// Switching a block off puts "--~ " in front of each of its lines. The tilde
// keeps toggled-off code apart from ordinary comments, so a block switches
// back on exactly as it was, ordinary comments included.

export const OFF = "--~ ";
const TAG_LINE = /^\s*--\s*@([A-Za-z0-9_]+)\s*$/;
const TAG_END = /--\s*@([A-Za-z0-9_]+)\s*$/;

export interface Toggle { tag: string; lines: number[]; on: boolean }

export function findToggles(src: string): Toggle[] {
  const lines = src.split("\n");
  const map = new Map<string, number[]>();
  const add = (tag: string, i: number) => { if (!map.has(tag)) map.set(tag, []); map.get(tag)!.push(i); };
  let open: string | null = null;
  lines.forEach((line, i) => {
    const head = TAG_LINE.exec(line);
    if (head) { open = head[1] === "end" ? null : head[1]; if (open) map.has(open) || map.set(open, []); return; }
    if (!line.trim()) { open = null; return; }
    if (open) { add(open, i); return; }
    const tail = TAG_END.exec(line);
    if (tail && tail[1] !== "end") add(tail[1], i);
  });
  return [...map].map(([tag, ls]) => ({ tag, lines: ls, on: !ls.some(i => isOff(lines[i])) }));
}

const isOff = (line: string) => line.trimStart().startsWith(OFF.trimEnd());

// The edits that flip one block: [line, from column, to column, insert].
export function toggleEdits(src: string, tag: string): { line: number; from: number; to: number; insert: string }[] {
  const t = findToggles(src).find(x => x.tag === tag);
  if (!t) return [];
  const lines = src.split("\n");
  return t.lines.map(i => {
    const line = lines[i], indent = line.length - line.trimStart().length;
    if (!t.on) {
      const rest = line.slice(indent);
      const n = rest.startsWith(OFF) ? OFF.length : OFF.trimEnd().length;
      return { line: i, from: indent, to: indent + n, insert: "" };
    }
    return { line: i, from: indent, to: indent, insert: OFF };
  });
}

export function toggleBlock(src: string, tag: string): string {
  const lines = src.split("\n");
  for (const e of toggleEdits(src, tag)) lines[e.line] = lines[e.line].slice(0, e.from) + e.insert + lines[e.line].slice(e.to);
  return lines.join("\n");
}

// ---------- bindings ----------

export type Binding = { kind: "key"; combo: string } | { kind: "note"; note: number; ch: number } | { kind: "cc"; cc: number; ch: number };

export function comboOf(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }): string | null {
  if (["Control", "Meta", "Alt", "Shift", "Escape"].includes(e.key)) return null;
  const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  return [e.ctrlKey && "Ctrl", e.metaKey && "Cmd", e.altKey && "Alt", e.shiftKey && "Shift", k].filter(Boolean).join("+");
}

export const hasModifier = (combo: string) => /^(Ctrl|Cmd|Alt)\+/.test(combo) || /^F\d+$/.test(combo);

export function describe(b: Binding): string {
  if (b.kind === "key") return b.combo;
  if (b.kind === "note") return `note ${b.note} (ch ${b.ch})`;
  return `cc ${b.cc} (ch ${b.ch})`;
}

// A button on a controller sends a note, or a CC that jumps to 127 and back.
// A CC fires when it rises through the middle, so a held or wobbling knob fires once.
export class Trigger {
  private last = new Map<string, number>();
  cc(cc: number, ch: number, value: number): boolean {
    const k = `${ch}:${cc}`, prev = this.last.get(k) ?? 0;
    this.last.set(k, value);
    return prev < 0.5 && value >= 0.5;
  }
}

export function matches(b: Binding, msg: { type: string; note?: number; cc?: number; ch: number }): boolean {
  if (b.kind === "note") return msg.type === "on" && msg.note === b.note && msg.ch === b.ch;
  if (b.kind === "cc") return msg.type === "cc" && msg.cc === b.cc && msg.ch === b.ch;
  return false;
}
