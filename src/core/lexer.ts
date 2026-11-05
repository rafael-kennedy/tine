import { TineError } from "./errors";

export type TokType =
  | "num" | "str" | "ident" | "kw" | "note" | "degree" | "op"
  | "newline" | "indent" | "dedent" | "eof";

export interface Token {
  type: TokType;
  text: string;
  start: number;
  end: number;
  // Extra payload for literals.
  num?: { n: number; d: number; float: boolean; unit?: "cents" | "edo" | "hz"; edo?: number };
  spaceBefore?: boolean;
}

export const KEYWORDS = new Set([
  "let", "voice", "section", "form", "tempo", "meter", "key", "seed", "tuning", "use",
  "if", "then", "else", "and", "or", "not", "true", "false",
]);

// A bare word is a note name if it is a letter A-G, any number of # or b
// accidentals, and an optional octave number. Such words cannot be variables.
export const NOTE_RE = /^[A-Ga-g](?:#|b)*\d?$/;

const OPS = [
  "=>", "==", "!=", "<=", ">=", "**", "..",
  "+", "-", "*", "/", "%", "=", "<", ">", "(", ")", "[", "]", "{", "}",
  ",", ":", ".", "?", "|", "@", "!", "_",
];

const isIdStart = (c: string) => /[A-Za-z_]/.test(c);
const isId = (c: string) => /[A-Za-z0-9_#]/.test(c);
const isDigit = (c: string) => c >= "0" && c <= "9";

function decimalToFraction(intPart: string, frac: string): { n: number; d: number } {
  const d = Math.pow(10, frac.length);
  return { n: parseInt(intPart || "0", 10) * d + (frac ? parseInt(frac, 10) : 0), d };
}

export function lex(src: string): Token[] {
  const toks: Token[] = [];
  const indents = [0];
  let i = 0;
  let depth = 0; // bracket nesting: newlines inside brackets are ignored
  let atLineStart = true;
  let sawSpace = false;

  const push = (t: Token) => { t.spaceBefore = sawSpace; sawSpace = false; toks.push(t); };

  while (i < src.length) {
    if (atLineStart) {
      // Measure indentation; skip blank and comment-only lines.
      let j = i, col = 0;
      while (j < src.length && (src[j] === " " || src[j] === "\t")) { col += src[j] === "\t" ? 4 : 1; j++; }
      if (j >= src.length) { i = j; break; }
      if (src[j] === "\n" || src[j] === "\r") { i = j + 1; continue; }
      if (src.startsWith("--", j)) { while (j < src.length && src[j] !== "\n") j++; i = j; continue; }
      // A line starting with ".name" continues the previous line (method chains).
      const continues = src[j] === "." && isIdStart(src[j + 1] ?? "") && toks.length > 0;
      if (depth === 0 && !continues) {
        if (toks.length && toks[toks.length - 1].type !== "newline") push({ type: "newline", text: "\n", start: j, end: j });
        const top = indents[indents.length - 1];
        if (col > top) { indents.push(col); push({ type: "indent", text: "", start: j, end: j }); }
        else {
          while (col < indents[indents.length - 1]) { indents.pop(); push({ type: "dedent", text: "", start: j, end: j }); }
          if (col !== indents[indents.length - 1]) throw new TineError("syntax", "inconsistent indentation", { start: i, end: j }, "indent blocks by a consistent number of spaces");
        }
      }
      i = j; atLineStart = false; sawSpace = true;
      continue;
    }
    const c = src[i];
    if (c === "\n") { i++; atLineStart = true; continue; }
    if (c === " " || c === "\t" || c === "\r") { i++; sawSpace = true; continue; }
    if (src.startsWith("--", i)) { while (i < src.length && src[i] !== "\n") i++; continue; }

    const start = i;
    // Strings
    if (c === '"') {
      i++; let s = "";
      while (i < src.length && src[i] !== '"') {
        if (src[i] === "\\") { i++; const e = src[i]; s += e === "n" ? "\n" : e === "t" ? "\t" : e; i++; }
        else if (src[i] === "\n") throw new TineError("syntax", "unterminated string", { start, end: i });
        else s += src[i++];
      }
      if (i >= src.length) throw new TineError("syntax", "unterminated string", { start, end: i });
      i++;
      push({ type: "str", text: s, start, end: i });
      continue;
    }
    // Numbers, with optional unit: 25c (cents), 5\31 (EDO steps), 432hz (frequency)
    if (isDigit(c) || (c === "." && isDigit(src[i + 1] ?? "") && !isId(src[i - 1] ?? " ") && src[i - 1] !== ")" && src[i - 1] !== "]")) {
      let ip = ""; while (isDigit(src[i] ?? "")) ip += src[i++];
      let fp = ""; let float = false;
      if (src[i] === "." && isDigit(src[i + 1] ?? "")) { i++; while (isDigit(src[i] ?? "")) fp += src[i++]; }
      let { n, d } = decimalToFraction(ip, fp);
      let unit: "cents" | "edo" | "hz" | undefined; let edo: number | undefined;
      if (src[i] === "e" && (isDigit(src[i + 1] ?? "") || src[i + 1] === "-")) {
        // scientific notation makes a float
        let ex = "e"; i++; if (src[i] === "-") ex += src[i++]; while (isDigit(src[i] ?? "")) ex += src[i++];
        const v = parseFloat(`${ip || "0"}.${fp || "0"}${ex}`); n = v; d = 1; float = true;
      }
      if (src.startsWith("hz", i) && !isId(src[i + 2] ?? " ")) { unit = "hz"; i += 2; }
      else if (src[i] === "c" && !isId(src[i + 1] ?? " ")) { unit = "cents"; i += 1; }
      else if (src[i] === "\\" && isDigit(src[i + 1] ?? "")) {
        i++; let e = ""; while (isDigit(src[i] ?? "")) e += src[i++]; unit = "edo"; edo = parseInt(e, 10);
      }
      if (isIdStart(src[i] ?? " ")) throw new TineError("syntax", `unexpected '${src[i]}' after number`, { start, end: i + 1 }, "units are written 25c (cents), 5\\31 (EDO steps) or 440hz");
      push({ type: "num", text: src.slice(start, i), start, end: i, num: { n, d, float, unit, edo } });
      continue;
    }
    // Scale degrees: ^1 ^b3 ^#4 ^-2
    if (c === "^") {
      i++;
      while (src[i] === "#" || src[i] === "b") i++;
      if (src[i] === "-") i++;
      if (!isDigit(src[i] ?? "")) throw new TineError("syntax", "a scale degree needs a number, like ^1 or ^b3", { start, end: i + 1 });
      while (isDigit(src[i] ?? "")) i++;
      push({ type: "degree", text: src.slice(start, i), start, end: i });
      continue;
    }
    // Words
    if (isIdStart(c)) {
      while (i < src.length && isId(src[i])) i++;
      let text = src.slice(start, i);
      if (text === "_") { push({ type: "op", text: "_", start, end: i }); continue; }
      if (NOTE_RE.test(text)) { push({ type: "note", text, start, end: i }); continue; }
      if (text.includes("#")) throw new TineError("syntax", `'${text}' is not a valid name or note`, { start, end: i }, "notes look like c4, f#3, eb5; '#' cannot appear in names");
      push({ type: KEYWORDS.has(text) ? "kw" : "ident", text, start, end: i });
      continue;
    }
    // Operators
    let matched = "";
    for (const op of OPS) if (src.startsWith(op, i)) { matched = op; break; }
    if (!matched) throw new TineError("syntax", `unexpected character '${c}'`, { start, end: i + 1 });
    i += matched.length;
    if (matched === "(" || matched === "[" || matched === "{") depth++;
    if (matched === ")" || matched === "]" || matched === "}") depth = Math.max(0, depth - 1);
    push({ type: "op", text: matched, start, end: i });
  }
  if (toks.length && toks[toks.length - 1].type !== "newline") push({ type: "newline", text: "\n", start: src.length, end: src.length });
  while (indents.length > 1) { indents.pop(); push({ type: "dedent", text: "", start: src.length, end: src.length }); }
  push({ type: "eof", text: "", start: src.length, end: src.length });
  return toks;
}
