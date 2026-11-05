// Diagnostics. Every error carries a source span so the REPL, the DAW and the
// language server can all point at the exact characters that caused it.

export interface Span { start: number; end: number; }

export class TineError extends Error {
  span?: Span;
  hint?: string;
  kind: "syntax" | "name" | "type" | "runtime";
  constructor(kind: TineError["kind"], message: string, span?: Span, hint?: string) {
    super(message);
    this.kind = kind; this.span = span; this.hint = hint;
  }
}

export function lineCol(src: string, offset: number): { line: number; col: number } {
  let line = 0, col = 0;
  for (let i = 0; i < offset && i < src.length; i++) {
    if (src[i] === "\n") { line++; col = 0; } else col++;
  }
  return { line, col };
}

// Pretty, caret-underlined error text for terminals.
export function formatError(src: string, err: unknown, file = "<input>"): string {
  if (!(err instanceof TineError) || !err.span) {
    const msg = err instanceof Error ? err.message : String(err);
    return `error: ${msg}`;
  }
  const { line, col } = lineCol(src, err.span.start);
  const lines = src.split("\n");
  const text = lines[line] ?? "";
  const len = Math.max(1, Math.min(err.span.end - err.span.start, text.length - col));
  const gutter = String(line + 1).length;
  let out = `${err.kind} error: ${err.message}\n`;
  out += `${" ".repeat(gutter)}--> ${file}:${line + 1}:${col + 1}\n`;
  out += `${" ".repeat(gutter)} |\n`;
  out += `${line + 1} | ${text}\n`;
  out += `${" ".repeat(gutter)} | ${" ".repeat(col)}${"^".repeat(len)}\n`;
  if (err.hint) out += `${" ".repeat(gutter)} = hint: ${err.hint}\n`;
  return out;
}

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}

export function suggest(name: string, candidates: Iterable<string>): string | undefined {
  let best: string | undefined, bestD = Infinity;
  for (const c of candidates) {
    const d = levenshtein(name, c);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best && bestD <= Math.max(1, Math.floor(name.length / 3)) ? best : undefined;
}
