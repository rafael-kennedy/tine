// ../../src/core/rational.ts
function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}
var SAFE = Number.MAX_SAFE_INTEGER;

class R {
  n;
  d;
  constructor(n, d = 1) {
    if (d === 0)
      throw new Error("division by zero");
    if (d < 0) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d);
    this.n = n / g;
    this.d = d / g;
  }
  static of(x) {
    if (x instanceof R)
      return x;
    if (Number.isInteger(x))
      return new R(x, 1);
    return R.approx(x);
  }
  static approx(x, maxD = 1e6) {
    if (!isFinite(x))
      throw new Error("non-finite time value");
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = x;
    for (let i = 0;i < 64; i++) {
      const a = Math.floor(b);
      const h2 = a * h1 + h0, k2 = a * k1 + k0;
      if (k2 > maxD)
        break;
      h0 = h1;
      h1 = h2;
      k0 = k1;
      k1 = k2;
      if (Math.abs(x - h1 / k1) < 0.000000000001)
        break;
      b = 1 / (b - a);
      if (!isFinite(b))
        break;
    }
    return new R(sign * h1, k1);
  }
  static safe(n, d) {
    if (Math.abs(n) > SAFE || Math.abs(d) > SAFE)
      return R.approx(n / d);
    return new R(n, d);
  }
  add(o) {
    return R.safe(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o) {
    return R.safe(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o) {
    return R.safe(this.n * o.n, this.d * o.d);
  }
  div(o) {
    if (o.n === 0)
      throw new Error("division by zero");
    return R.safe(this.n * o.d, this.d * o.n);
  }
  neg() {
    return new R(-this.n, this.d);
  }
  cmp(o) {
    const x = this.n * o.d - o.n * this.d;
    return x < 0 ? -1 : x > 0 ? 1 : 0;
  }
  lt(o) {
    return this.cmp(o) < 0;
  }
  le(o) {
    return this.cmp(o) <= 0;
  }
  gt(o) {
    return this.cmp(o) > 0;
  }
  ge(o) {
    return this.cmp(o) >= 0;
  }
  eq(o) {
    return this.n === o.n && this.d === o.d;
  }
  floor() {
    return Math.floor(this.n / this.d);
  }
  ceil() {
    return Math.ceil(this.n / this.d);
  }
  sam() {
    return new R(this.floor(), 1);
  }
  cyclePos() {
    return this.sub(this.sam());
  }
  isInt() {
    return this.d === 1;
  }
  valueOf() {
    return this.n / this.d;
  }
  toNumber() {
    return this.n / this.d;
  }
  toString() {
    return this.d === 1 ? `${this.n}` : `${this.n}/${this.d}`;
  }
  static min(a, b) {
    return a.lt(b) ? a : b;
  }
  static max(a, b) {
    return a.gt(b) ? a : b;
  }
}
var ZERO = new R(0);
var ONE = new R(1);
// ../../src/core/errors.ts
class TineError extends Error {
  span;
  hint;
  kind;
  constructor(kind, message, span, hint) {
    super(message);
    this.kind = kind;
    this.span = span;
    this.hint = hint;
  }
}
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1;j <= n; j++)
    dp[0][j] = j;
  for (let i = 1;i <= m; i++)
    for (let j = 1;j <= n; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
    }
  return dp[m][n];
}
function suggest(name, candidates) {
  let best, bestD = Infinity;
  for (const c of candidates) {
    const d = levenshtein(name, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best && bestD <= (name.length <= 3 ? 1 : Math.max(2, Math.floor(name.length / 3))) ? best : undefined;
}
// ../../src/core/lexer.ts
var KEYWORDS = new Set([
  "let",
  "voice",
  "section",
  "form",
  "tempo",
  "meter",
  "key",
  "seed",
  "tuning",
  "use",
  "if",
  "then",
  "else",
  "and",
  "or",
  "not",
  "true",
  "false"
]);
var NOTE_RE = /^[A-Ga-g](?:#|b)*\d?$/;
var OPS = [
  "=>",
  "==",
  "!=",
  "<=",
  ">=",
  "**",
  "..",
  "+",
  "-",
  "*",
  "/",
  "%",
  "=",
  "<",
  ">",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  ",",
  ":",
  ".",
  "?",
  "|",
  "@",
  "!",
  "_"
];
var isIdStart = (c) => /[A-Za-z_]/.test(c);
var isId = (c) => /[A-Za-z0-9_#]/.test(c);
var isDigit = (c) => c >= "0" && c <= "9";
function decimalToFraction(intPart, frac) {
  const d = Math.pow(10, frac.length);
  return { n: parseInt(intPart || "0", 10) * d + (frac ? parseInt(frac, 10) : 0), d };
}
function lex(src) {
  const toks = [];
  const indents = [0];
  let i = 0;
  let depth = 0;
  let atLineStart = true;
  let sawSpace = false;
  const push = (t) => {
    t.spaceBefore = sawSpace;
    sawSpace = false;
    toks.push(t);
  };
  while (i < src.length) {
    if (atLineStart) {
      let j = i, col = 0;
      while (j < src.length && (src[j] === " " || src[j] === "\t")) {
        col += src[j] === "\t" ? 4 : 1;
        j++;
      }
      if (j >= src.length) {
        i = j;
        break;
      }
      if (src[j] === `
` || src[j] === "\r") {
        i = j + 1;
        continue;
      }
      if (src.startsWith("--", j)) {
        while (j < src.length && src[j] !== `
`)
          j++;
        i = j;
        continue;
      }
      const continues = src[j] === "." && isIdStart(src[j + 1] ?? "") && toks.length > 0;
      if (depth === 0 && !continues) {
        if (toks.length && toks[toks.length - 1].type !== "newline")
          push({ type: "newline", text: `
`, start: j, end: j });
        const top = indents[indents.length - 1];
        if (col > top) {
          indents.push(col);
          push({ type: "indent", text: "", start: j, end: j });
        } else {
          while (col < indents[indents.length - 1]) {
            indents.pop();
            push({ type: "dedent", text: "", start: j, end: j });
          }
          if (col !== indents[indents.length - 1])
            throw new TineError("syntax", "inconsistent indentation", { start: i, end: j }, "indent blocks by a consistent number of spaces");
        }
      }
      i = j;
      atLineStart = false;
      sawSpace = true;
      continue;
    }
    const c = src[i];
    if (c === `
`) {
      i++;
      atLineStart = true;
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") {
      i++;
      sawSpace = true;
      continue;
    }
    if (src.startsWith("--", i)) {
      while (i < src.length && src[i] !== `
`)
        i++;
      continue;
    }
    const start = i;
    if (c === '"') {
      i++;
      let s = "";
      while (i < src.length && src[i] !== '"') {
        if (src[i] === "\\") {
          i++;
          const e = src[i];
          s += e === "n" ? `
` : e === "t" ? "\t" : e;
          i++;
        } else if (src[i] === `
`)
          throw new TineError("syntax", "unterminated string", { start, end: i });
        else
          s += src[i++];
      }
      if (i >= src.length)
        throw new TineError("syntax", "unterminated string", { start, end: i });
      i++;
      push({ type: "str", text: s, start, end: i });
      continue;
    }
    if (isDigit(c) || c === "." && isDigit(src[i + 1] ?? "") && !isId(src[i - 1] ?? " ") && src[i - 1] !== ")" && src[i - 1] !== "]") {
      let ip = "";
      while (isDigit(src[i] ?? ""))
        ip += src[i++];
      let fp = "";
      let float = false;
      if (src[i] === "." && isDigit(src[i + 1] ?? "")) {
        i++;
        while (isDigit(src[i] ?? ""))
          fp += src[i++];
      }
      let { n, d } = decimalToFraction(ip, fp);
      let unit;
      let edo;
      if (src[i] === "e" && (isDigit(src[i + 1] ?? "") || src[i + 1] === "-")) {
        let ex = "e";
        i++;
        if (src[i] === "-")
          ex += src[i++];
        while (isDigit(src[i] ?? ""))
          ex += src[i++];
        const v = parseFloat(`${ip || "0"}.${fp || "0"}${ex}`);
        n = v;
        d = 1;
        float = true;
      }
      if (src.startsWith("hz", i) && !isId(src[i + 2] ?? " ")) {
        unit = "hz";
        i += 2;
      } else if (src[i] === "c" && !isId(src[i + 1] ?? " ")) {
        unit = "cents";
        i += 1;
      } else if (src[i] === "\\" && isDigit(src[i + 1] ?? "")) {
        i++;
        let e = "";
        while (isDigit(src[i] ?? ""))
          e += src[i++];
        unit = "edo";
        edo = parseInt(e, 10);
      }
      if (isIdStart(src[i] ?? " "))
        throw new TineError("syntax", `unexpected '${src[i]}' after number`, { start, end: i + 1 }, "units are written 25c (cents), 5\\31 (EDO steps) or 440hz");
      push({ type: "num", text: src.slice(start, i), start, end: i, num: { n, d, float, unit, edo } });
      continue;
    }
    if (c === "^") {
      i++;
      while (src[i] === "#" || src[i] === "b")
        i++;
      if (src[i] === "-")
        i++;
      if (!isDigit(src[i] ?? ""))
        throw new TineError("syntax", "a scale degree needs a number, like ^1 or ^b3", { start, end: i + 1 });
      while (isDigit(src[i] ?? ""))
        i++;
      push({ type: "degree", text: src.slice(start, i), start, end: i });
      continue;
    }
    if (isIdStart(c)) {
      while (i < src.length && isId(src[i]))
        i++;
      let text = src.slice(start, i);
      if (text === "_") {
        push({ type: "op", text: "_", start, end: i });
        continue;
      }
      if (NOTE_RE.test(text)) {
        push({ type: "note", text, start, end: i });
        continue;
      }
      if (text.includes("#"))
        throw new TineError("syntax", `'${text}' is not a valid name or note`, { start, end: i }, "notes look like c4, f#3, eb5; '#' cannot appear in names");
      push({ type: KEYWORDS.has(text) ? "kw" : "ident", text, start, end: i });
      continue;
    }
    let matched = "";
    for (const op of OPS)
      if (src.startsWith(op, i)) {
        matched = op;
        break;
      }
    if (!matched)
      throw new TineError("syntax", `unexpected character '${c}'`, { start, end: i + 1 });
    i += matched.length;
    if (matched === "(" || matched === "[" || matched === "{")
      depth++;
    if (matched === ")" || matched === "]" || matched === "}")
      depth = Math.max(0, depth - 1);
    push({ type: "op", text: matched, start, end: i });
  }
  if (toks.length && toks[toks.length - 1].type !== "newline")
    push({ type: "newline", text: `
`, start: src.length, end: src.length });
  while (indents.length > 1) {
    indents.pop();
    push({ type: "dedent", text: "", start: src.length, end: src.length });
  }
  push({ type: "eof", text: "", start: src.length, end: src.length });
  return toks;
}
// ../../src/core/parser.ts
var sp = (a, b) => ({ start: a.start, end: b.end });
function parse(src) {
  const p = new Parser(src, lex(src));
  return { stmts: p.program(), src };
}

class Parser {
  src;
  toks;
  i = 0;
  constructor(src, toks) {
    this.src = src;
    this.toks = toks;
  }
  get tok() {
    return this.toks[this.i];
  }
  peek(k = 1) {
    return this.toks[Math.min(this.i + k, this.toks.length - 1)];
  }
  isOp(text, t = this.tok) {
    return t.type === "op" && t.text === text;
  }
  isKw(text, t = this.tok) {
    return t.type === "kw" && t.text === text;
  }
  next() {
    return this.toks[this.i++];
  }
  spanOf(t) {
    return { start: t.start, end: t.end };
  }
  err(msg, t = this.tok, hint) {
    const span = t.type === "eof" || t.type === "newline" ? { start: Math.max(0, t.start - 1), end: t.start } : this.spanOf(t);
    throw new TineError("syntax", msg, span, hint);
  }
  expectOp(text, hint) {
    if (!this.isOp(text))
      this.err(`expected '${text}' but found ${this.describe(this.tok)}`, this.tok, hint);
    return this.next();
  }
  describe(t) {
    if (t.type === "eof")
      return "end of input";
    if (t.type === "newline")
      return "end of line";
    if (t.type === "indent")
      return "an indented block";
    if (t.type === "dedent")
      return "end of block";
    return `'${t.text}'`;
  }
  skipNewlines() {
    while (this.tok.type === "newline")
      this.next();
  }
  program() {
    const out = [];
    this.skipNewlines();
    while (this.tok.type !== "eof") {
      if (this.tok.type === "indent")
        this.err("unexpected indentation", this.tok, "only bodies of let, voice and section are indented");
      out.push(this.statement());
      this.endStatement();
    }
    return out;
  }
  endStatement() {
    if (this.tok.type === "newline") {
      this.skipNewlines();
      return;
    }
    if (this.tok.type === "eof" || this.tok.type === "dedent")
      return;
    if (this.toks[this.i - 1]?.type === "dedent")
      return;
    this.err(`unexpected ${this.describe(this.tok)}`, this.tok, "each statement goes on its own line");
  }
  block() {
    if (this.tok.type !== "indent")
      this.err("expected an indented block");
    this.next();
    const out = [];
    while (this.tok.type !== "dedent" && this.tok.type !== "eof") {
      out.push(this.statement());
      this.endStatement();
    }
    if (this.tok.type === "dedent")
      this.next();
    return out;
  }
  valueOrBlock() {
    if (this.tok.type === "newline" && this.peek().type === "indent") {
      const startTok = this.tok;
      this.next();
      const stmts = this.block();
      const last = stmts[stmts.length - 1];
      if (!last || last.t !== "expr")
        throw new TineError("syntax", "a block must end with an expression (its value)", this.spanOf(startTok));
      stmts.pop();
      return { t: "block", stmts, result: last.e, span: { start: startTok.start, end: last.span.end } };
    }
    return this.expr();
  }
  statement() {
    const t = this.tok;
    if (this.isKw("let")) {
      this.next();
      const nameTok = this.tok;
      if (nameTok.type !== "ident")
        this.err(nameTok.type === "note" ? `'${nameTok.text}' is a note name and cannot be used as a variable` : "expected a name after 'let'", nameTok);
      this.next();
      let params = null;
      if (this.isOp("("))
        params = this.paramList();
      this.expectOp("=");
      const value = this.valueOrBlock();
      return { t: "let", name: nameTok.text, params, value, span: sp(this.spanOf(t), value.span), nameSpan: this.spanOf(nameTok) };
    }
    if (this.isKw("voice")) {
      this.next();
      const nameTok = this.tok;
      if (nameTok.type !== "ident" && nameTok.type !== "note")
        this.err("expected a voice name", nameTok);
      this.next();
      this.expectOp("=");
      const value = this.valueOrBlock();
      return { t: "voice", name: nameTok.text, value, span: sp(this.spanOf(t), value.span), nameSpan: this.spanOf(nameTok) };
    }
    if (t.type === "kw" && ["tempo", "seed", "tuning"].includes(t.text) && !this.isOp("(", this.peek())) {
      this.next();
      const e = this.expr();
      return { t: "directive", name: t.text, args: [e], span: sp(this.spanOf(t), e.span) };
    }
    if (this.isKw("meter")) {
      this.next();
      const a = this.tok;
      if (a.type !== "num")
        this.err("meter is written like 4/4 or 7/8");
      this.next();
      this.expectOp("/");
      const b = this.tok;
      if (b.type !== "num")
        this.err("meter is written like 4/4 or 7/8");
      this.next();
      return { t: "directive", name: "meter", args: [this.numNode(a), this.numNode(b)], span: sp(this.spanOf(t), this.spanOf(b)) };
    }
    if (this.isKw("key") && !this.isOp("(", this.peek())) {
      this.next();
      const root = this.unary();
      const args = [root];
      if (this.tok.type !== "newline" && this.tok.type !== "eof" && this.tok.type !== "dedent")
        args.push(this.expr());
      return { t: "directive", name: "key", args, span: sp(this.spanOf(t), args[args.length - 1].span) };
    }
    if (this.isKw("section")) {
      this.next();
      const nameTok = this.tok;
      if (nameTok.type !== "ident")
        this.err("expected a section name", nameTok);
      this.next();
      const bars = this.unary();
      if (this.tok.type === "ident" && (this.tok.text === "bars" || this.tok.text === "bar"))
        this.next();
      if (this.tok.type !== "newline")
        this.err("expected the section body on the following indented lines");
      this.next();
      const body = this.block();
      return { t: "section", name: nameTok.text, bars, body, span: sp(this.spanOf(t), this.spanOf(nameTok)), nameSpan: this.spanOf(nameTok) };
    }
    if (this.isKw("form")) {
      this.next();
      const items = [];
      while (this.tok.type === "ident") {
        const n = this.next();
        let times = 1;
        if (this.isOp("*")) {
          this.next();
          const c = this.tok;
          if (c.type !== "num")
            this.err("expected a repeat count after '*'");
          this.next();
          times = c.num.n / c.num.d;
        }
        items.push({ name: n.text, times, span: this.spanOf(n) });
      }
      if (!items.length)
        this.err("form lists section names in order, like: form intro verse*2 chorus");
      return { t: "form", items, span: sp(this.spanOf(t), items[items.length - 1].span) };
    }
    if (this.isKw("use")) {
      this.next();
      const s = this.tok;
      if (s.type !== "str")
        this.err('use expects a file path in quotes, like use "drums.tine"');
      this.next();
      return { t: "use", path: s.text, span: sp(this.spanOf(t), this.spanOf(s)) };
    }
    const e = this.expr();
    if (this.isOp("="))
      this.err("to define a name, write 'let name = ...'", this.tok);
    return { t: "expr", e, span: e.span };
  }
  paramList() {
    this.expectOp("(");
    const ps = [];
    while (!this.isOp(")")) {
      const t = this.tok;
      if (t.type !== "ident")
        this.err(t.type === "note" ? `'${t.text}' is a note name and cannot be a parameter` : "expected a parameter name", t);
      ps.push(t.text);
      this.next();
      if (this.isOp(","))
        this.next();
      else if (!this.isOp(")"))
        this.err("expected ',' or ')'");
    }
    this.next();
    return ps;
  }
  numNode(t) {
    return { t: "num", n: t.num.n, d: t.num.d, float: t.num.float, unit: t.num.unit, edo: t.num.edo, span: this.spanOf(t) };
  }
  expr() {
    if (this.isKw("if")) {
      const s = this.next();
      const c = this.expr();
      if (!this.isKw("then"))
        this.err("expected 'then'");
      this.next();
      const a = this.expr();
      if (!this.isKw("else"))
        this.err("expected 'else'", this.tok, "every 'if' needs both branches because it is an expression");
      this.next();
      const b = this.expr();
      return { t: "if", c, a, b, span: sp(this.spanOf(s), b.span) };
    }
    if (this.tok.type === "ident" && this.isOp("=>", this.peek())) {
      const s = this.next();
      this.next();
      const body = this.expr();
      return { t: "lambda", params: [s.text], body, span: sp(this.spanOf(s), body.span) };
    }
    if (this.isOp("(") && this.lambdaAhead()) {
      const s = this.tok;
      const params = this.paramList();
      this.expectOp("=>");
      const body = this.expr();
      return { t: "lambda", params, body, span: sp(this.spanOf(s), body.span) };
    }
    return this.binary(0);
  }
  lambdaAhead() {
    let d = 0;
    for (let k = this.i;k < this.toks.length; k++) {
      const t = this.toks[k];
      if (t.type === "op" && t.text === "(")
        d++;
      else if (t.type === "op" && t.text === ")") {
        d--;
        if (d === 0) {
          const n = this.toks[k + 1];
          return !!n && n.type === "op" && n.text === "=>";
        }
      } else if (t.type === "eof")
        return false;
    }
    return false;
  }
  static PREC = {
    or: 1,
    "||": 1,
    and: 2,
    "&&": 2,
    "==": 3,
    "!=": 3,
    "<": 4,
    ">": 4,
    "<=": 4,
    ">=": 4,
    "..": 5,
    "+": 6,
    "-": 6,
    "*": 7,
    "/": 7,
    "%": 7
  };
  binary(minPrec) {
    let l = this.unary();
    for (;; ) {
      const t = this.tok;
      const op = t.type === "op" || t.type === "kw" && (t.text === "and" || t.text === "or") ? t.text : "";
      const prec = Parser.PREC[op];
      if (prec === undefined || prec <= minPrec)
        break;
      this.next();
      const r = this.binary(prec);
      l = { t: "binary", op: op === "&&" ? "and" : op === "||" ? "or" : op, l, r, span: sp(l.span, r.span) };
    }
    return l;
  }
  unary() {
    const t = this.tok;
    if (this.isOp("-") || this.isKw("not") || this.isOp("!")) {
      this.next();
      const e = this.unary();
      return { t: "unary", op: t.text === "-" ? "-" : "not", e, span: sp(this.spanOf(t), e.span) };
    }
    return this.power();
  }
  power() {
    const base = this.postfix(this.primary(false), false);
    if (this.isOp("**")) {
      this.next();
      const e = this.unary();
      return { t: "binary", op: "**", l: base, r: e, span: sp(base.span, e.span) };
    }
    if (this.isOp("@")) {
      this.next();
      const q = this.tok;
      if (q.type !== "ident" && q.type !== "num" && q.type !== "note")
        this.err("expected a chord quality after '@', like c4@maj7 or ^2@4");
      this.next();
      const arg = q.type === "num" ? this.numNode(q) : { t: "str", v: q.text, span: this.spanOf(q) };
      return this.postfix({ t: "mod", kind: "chord", e: base, arg, span: sp(base.span, this.spanOf(q)) }, false);
    }
    return base;
  }
  args() {
    this.expectOp("(");
    const args = [];
    const named = [];
    while (!this.isOp(")")) {
      if ((this.tok.type === "ident" || this.tok.type === "kw" || this.tok.type === "note") && this.isOp(":", this.peek())) {
        const n = this.next();
        this.next();
        named.push({ name: n.text, value: this.expr() });
      } else {
        if (named.length)
          this.err("positional arguments must come before named ones");
        args.push(this.expr());
      }
      if (this.isOp(","))
        this.next();
      else if (!this.isOp(")"))
        this.err(`expected ',' or ')' but found ${this.describe(this.tok)}`);
    }
    const end = this.next();
    return { args, named, end };
  }
  postfix(e, inPhrase) {
    for (;; ) {
      if (this.isOp("(") && (!inPhrase || !this.tok.spaceBefore)) {
        const { args, named, end } = this.args();
        e = { t: "call", callee: e, args, named, span: sp(e.span, this.spanOf(end)) };
        continue;
      }
      if (this.isOp(".") && !(inPhrase && this.tok.spaceBefore) && (this.peek().type === "ident" || this.peek().type === "kw" || this.peek().type === "note") && !this.peek().spaceBefore) {
        this.next();
        const nameTok = this.next();
        if (this.isOp("(") && !this.tok.spaceBefore) {
          const { args, named, end } = this.args();
          e = { t: "method", obj: e, name: nameTok.text, args, named, span: sp(e.span, this.spanOf(end)), nameSpan: this.spanOf(nameTok) };
        } else {
          e = { t: "method", obj: e, name: nameTok.text, args: null, named: [], span: sp(e.span, this.spanOf(nameTok)), nameSpan: this.spanOf(nameTok) };
        }
        continue;
      }
      return e;
    }
  }
  primary(inPhrase) {
    const t = this.tok;
    switch (t.type) {
      case "num":
        this.next();
        return this.numNode(t);
      case "str":
        this.next();
        return { t: "str", v: t.text, span: this.spanOf(t) };
      case "note":
        this.next();
        return { t: "note", text: t.text, span: this.spanOf(t) };
      case "degree":
        this.next();
        return { t: "degree", text: t.text, span: this.spanOf(t) };
      case "ident":
        this.next();
        return { t: "ident", name: t.text, span: this.spanOf(t) };
      case "kw":
        if (t.text === "true" || t.text === "false") {
          this.next();
          return { t: "bool", v: t.text === "true", span: this.spanOf(t) };
        }
        if (["key", "seed", "tempo", "tuning"].includes(t.text)) {
          this.next();
          return { t: "ident", name: t.text, span: this.spanOf(t) };
        }
        if (t.text === "if" || t.text === "not")
          return this.expr();
        this.err(`'${t.text}' is a keyword and cannot be used here`);
      case "op":
        if (t.text === "(") {
          this.next();
          if ((this.tok.type === "ident" || this.tok.type === "note") && this.isOp(":", this.peek())) {
            const fields = [];
            while (!this.isOp(")")) {
              const n = this.tok;
              if (n.type !== "ident" && n.type !== "note")
                this.err("expected a field name");
              this.next();
              this.expectOp(":");
              fields.push({ name: n.text, value: this.expr() });
              if (this.isOp(","))
                this.next();
              else if (!this.isOp(")"))
                this.err("expected ',' or ')'");
            }
            const end = this.next();
            return { t: "record", fields, span: sp(this.spanOf(t), this.spanOf(end)) };
          }
          const e = this.expr();
          this.expectOp(")");
          return e;
        }
        if (t.text === "[")
          return this.phrase("[", "]", "seq");
        if (t.text === "{")
          return this.phrase("{", "}", "stack");
        if (t.text === "<")
          return this.phrase("<", ">", "alt");
        if (inPhrase && (t.text === "." || t.text === "..")) {
          this.next();
          return { t: "rest", span: this.spanOf(t) };
        }
      default:
        this.err(`unexpected ${this.describe(t)}`, t, t.text === "]" || t.text === ")" ? "check for an unmatched bracket" : undefined);
    }
  }
  phrase(open, close, kind) {
    const s = this.next();
    const items = [];
    while (!this.isOp(close)) {
      if (this.tok.type === "eof" || this.tok.type === "newline" || this.tok.type === "dedent")
        this.err(`unclosed '${open}'`, s, `add a matching '${close}'`);
      if (this.isOp("_")) {
        const h = this.next();
        if (!items.length)
          throw new TineError("syntax", "'_' extends the previous step, so it cannot come first", this.spanOf(h));
        items[items.length - 1].weight += 1;
        continue;
      }
      if (this.isOp("..")) {
        const r = this.next();
        items.push({ node: { t: "rest", span: this.spanOf(r) }, weight: 1, span: this.spanOf(r) });
        items.push({ node: { t: "rest", span: this.spanOf(r) }, weight: 1, span: this.spanOf(r) });
        continue;
      }
      if (this.isOp(",") && kind === "stack") {
        this.next();
        continue;
      }
      const el = this.choiceElement();
      items.push(el);
    }
    const e = this.next();
    return { t: "phrase", kind, items, span: sp(this.spanOf(s), this.spanOf(e)) };
  }
  choiceElement() {
    const first = this.element();
    if (!this.isOp("|"))
      return first;
    const opts = [first.node];
    while (this.isOp("|")) {
      this.next();
      opts.push(this.element().node);
    }
    const span = sp(first.span, opts[opts.length - 1].span);
    return { node: { t: "choice", options: opts, span }, weight: first.weight, span };
  }
  phraseNum() {
    const t = this.tok;
    if (t.type !== "num")
      this.err("expected a number");
    this.next();
    let n = this.numNode(t);
    if (this.isOp("/") && !this.tok.spaceBefore && this.peek().type === "num") {
      this.next();
      const d = this.next();
      n = { t: "binary", op: "/", l: n, r: this.numNode(d), span: sp(n.span, this.spanOf(d)) };
    }
    return n;
  }
  element() {
    let node;
    const t = this.tok;
    if (this.isOp("-") && this.peek().type === "num" && !this.peek().spaceBefore) {
      this.next();
      const n = this.phraseNum();
      node = { t: "unary", op: "-", e: n, span: sp(this.spanOf(t), n.span) };
    } else if (t.type === "num") {
      node = this.phraseNum();
    } else {
      node = this.postfix(this.primary(true), true);
    }
    let weight = 1;
    for (;; ) {
      const m = this.tok;
      if (m.spaceBefore)
        break;
      if (this.isOp("*")) {
        this.next();
        const a = this.phraseNum();
        node = { t: "mod", kind: "fast", e: node, arg: a, span: sp(node.span, a.span) };
        continue;
      }
      if (this.isOp(":")) {
        this.next();
        const a = this.tok;
        if (a.type !== "num")
          this.err("expected a length after ':' like c:2");
        this.next();
        weight = a.num.n / a.num.d;
        continue;
      }
      if (this.isOp("!")) {
        this.next();
        const a = this.phraseNum();
        node = { t: "mod", kind: "rep", e: node, arg: a, span: sp(node.span, a.span) };
        continue;
      }
      if (this.isOp("?")) {
        this.next();
        let a = null;
        if (this.tok.type === "num" && !this.tok.spaceBefore)
          a = this.phraseNum();
        node = { t: "mod", kind: "chance", e: node, arg: a, span: sp(node.span, a ? a.span : this.spanOf(m)) };
        continue;
      }
      if (this.isOp("@")) {
        this.next();
        const q = this.tok;
        if (q.type !== "ident" && q.type !== "num" && q.type !== "note")
          this.err("expected a chord quality after '@'");
        this.next();
        const arg = q.type === "num" ? this.numNode(q) : { t: "str", v: q.text, span: this.spanOf(q) };
        node = { t: "mod", kind: "chord", e: node, arg, span: sp(node.span, arg.span) };
        continue;
      }
      break;
    }
    return { node, weight, span: node.span };
  }
}
// ../../src/core/pitch.ts
class Pitch {
  semi;
  drum;
  constructor(semi, drum) {
    this.semi = semi;
    this.drum = drum;
  }
  freq(ref = 440) {
    return ref * Math.pow(2, (this.semi - 69) / 12);
  }
  static fromFreq(hz, ref = 440) {
    return new Pitch(69 + 12 * Math.log2(hz / ref));
  }
  toString() {
    if (this.drum)
      return this.drum;
    return pitchName(this.semi);
  }
}

class Degree {
  deg;
  acc;
  shift;
  constructor(deg, acc = 0, shift = 0) {
    this.deg = deg;
    this.acc = acc;
    this.shift = shift;
  }
  toString() {
    const oct = Math.trunc(this.acc / 12), acc = this.acc - oct * 12;
    const a = acc > 0 ? "#".repeat(acc) : "b".repeat(-acc);
    let s = `^${a}${this.deg}`;
    if (this.shift)
      s = `(${s} ${this.shift > 0 ? "+" : "-"} ${Math.abs(this.shift)})`;
    if (oct)
      s += `.octave(${oct})`;
    return s;
  }
}

class Scale {
  name;
  steps;
  period;
  constructor(name, steps, period = 12) {
    this.name = name;
    this.steps = steps;
    this.period = period;
  }
  toString() {
    return `scale ${this.name}`;
  }
  semitoneOf(index) {
    const n = this.steps.length;
    const oct = Math.floor(index / n);
    const i = (index % n + n) % n;
    return oct * this.period + this.steps[i];
  }
  indexOf(semi) {
    const n = this.steps.length;
    const oct = Math.floor(semi / this.period);
    let best = 0, bestD = Infinity;
    for (let o = oct - 1;o <= oct + 1; o++)
      for (let i = 0;i < n; i++) {
        const d = Math.abs(o * this.period + this.steps[i] - semi);
        if (d < bestD) {
          bestD = d;
          best = o * n + i;
        }
      }
    return best;
  }
}

class Key {
  root;
  scale;
  constructor(root, scale) {
    this.root = root;
    this.scale = scale;
  }
  resolve(d) {
    const idx = d.deg > 0 ? d.deg - 1 : d.deg - 1;
    return this.root.semi + this.scale.semitoneOf(idx + d.shift) + d.acc;
  }
  toString() {
    return `key ${pitchName(this.root.semi)} ${this.scale.name}`;
  }
}
var LETTERS = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
function parseNote(text, defaultOctave = 4) {
  const letter = text[0].toLowerCase();
  let i = 1, acc = 0;
  while (text[i] === "#" || text[i] === "b") {
    acc += text[i] === "#" ? 1 : -1;
    i++;
  }
  const oct = i < text.length ? parseInt(text.slice(i), 10) : defaultOctave;
  return new Pitch(12 * (oct + 1) + LETTERS[letter] + acc);
}
function parseDegree(text) {
  let i = 1, acc = 0;
  while (text[i] === "#" || text[i] === "b") {
    acc += text[i] === "#" ? 1 : -1;
    i++;
  }
  return new Degree(parseInt(text.slice(i), 10), acc);
}
var NAMES = ["c", "c#", "d", "eb", "e", "f", "f#", "g", "ab", "a", "bb", "b"];
function pitchName(semi) {
  const r = Math.round(semi);
  const cents = Math.round((semi - r) * 100);
  const name = NAMES[(r % 12 + 12) % 12] + (Math.floor(r / 12) - 1);
  return cents ? `${name}${cents > 0 ? "+" : ""}${cents}c` : name;
}
var ET = (name, steps) => new Scale(name, steps);
var SCALES = {
  major: ET("major", [0, 2, 4, 5, 7, 9, 11]),
  minor: ET("minor", [0, 2, 3, 5, 7, 8, 10]),
  ionian: ET("ionian", [0, 2, 4, 5, 7, 9, 11]),
  dorian: ET("dorian", [0, 2, 3, 5, 7, 9, 10]),
  phrygian: ET("phrygian", [0, 1, 3, 5, 7, 8, 10]),
  lydian: ET("lydian", [0, 2, 4, 6, 7, 9, 11]),
  mixolydian: ET("mixolydian", [0, 2, 4, 5, 7, 9, 10]),
  aeolian: ET("aeolian", [0, 2, 3, 5, 7, 8, 10]),
  locrian: ET("locrian", [0, 1, 3, 5, 6, 8, 10]),
  harmonic_minor: ET("harmonic_minor", [0, 2, 3, 5, 7, 8, 11]),
  melodic_minor: ET("melodic_minor", [0, 2, 3, 5, 7, 9, 11]),
  major_pent: ET("major_pent", [0, 2, 4, 7, 9]),
  minor_pent: ET("minor_pent", [0, 3, 5, 7, 10]),
  blues: ET("blues", [0, 3, 5, 6, 7, 10]),
  whole_tone: ET("whole_tone", [0, 2, 4, 6, 8, 10]),
  chromatic: ET("chromatic", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
  hirajoshi: ET("hirajoshi", [0, 2, 3, 7, 8]),
  double_harmonic: ET("double_harmonic", [0, 1, 4, 5, 7, 8, 11]),
  just_major: new Scale("just_major", [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8].map((r) => 12 * Math.log2(r))),
  slendro: new Scale("slendro", [0, 2.4, 4.8, 7.2, 9.6]),
  bohlen_pierce: new Scale("bohlen_pierce", [1, 27 / 25, 25 / 21, 9 / 7, 7 / 5, 75 / 49, 5 / 3, 9 / 5, 49 / 25].map((r) => 12 * Math.log2(r)), 12 * Math.log2(3))
};
var DEFAULT_KEY = new Key(new Pitch(60), SCALES.major);
var CHORDS = {
  maj: [0, 4, 7],
  M: [0, 4, 7],
  min: [0, 3, 7],
  m: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  "5": [0, 7],
  power: [0, 7, 12],
  "6": [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  "7": [0, 4, 7, 10],
  dom7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  M7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  min7: [0, 3, 7, 10],
  mmaj7: [0, 3, 7, 11],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  hdim: [0, 3, 6, 10],
  aug7: [0, 4, 8, 10],
  "9": [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  add9: [0, 4, 7, 14],
  "11": [0, 4, 7, 10, 14, 17],
  m11: [0, 3, 7, 10, 14, 17],
  "13": [0, 4, 7, 10, 14, 21],
  otonal: [1, 5 / 4, 3 / 2, 7 / 4].map((r) => 12 * Math.log2(r)),
  utonal: [1, 4 / 5, 2 / 3, 4 / 7].map((r) => 12 * Math.log2(r))
};
var DRUMS = {
  kick: 36,
  kick2: 35,
  rim: 37,
  snare: 38,
  clap: 39,
  snare2: 40,
  tom1: 41,
  hat: 42,
  tom2: 43,
  pedal: 44,
  tom3: 45,
  ohat: 46,
  tom4: 47,
  tom5: 48,
  crash: 49,
  tom6: 50,
  ride: 51,
  china: 52,
  ridebell: 53,
  tamb: 54,
  splash: 55,
  cowbell: 56,
  crash2: 57,
  ride2: 59,
  bongo: 60,
  bongo2: 61,
  conga: 62,
  conga2: 63,
  shaker: 70,
  clave: 75,
  block: 76
};
// ../../src/core/rng.ts
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0;i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function mix(h, x) {
  x = Math.imul(x >>> 0, 3432918353);
  x = x << 15 | x >>> 17;
  x = Math.imul(x, 461845907);
  h ^= x;
  h = h << 13 | h >>> 19;
  h = Math.imul(h, 5) + 3864292196 >>> 0;
  return h >>> 0;
}
function fin(h) {
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}
function rand01(...keys) {
  let h = 2538058380;
  for (const k of keys) {
    if (Number.isInteger(k) && Math.abs(k) < 2 ** 31)
      h = mix(h, k | 0);
    else {
      const f = new Float64Array([k]);
      const u = new Uint32Array(f.buffer);
      h = mix(mix(h, u[0]), u[1]);
    }
  }
  return fin(h) / 4294967296;
}

class Stream {
  keys;
  n = 0;
  constructor(keys) {
    this.keys = keys;
  }
  next() {
    return rand01(...this.keys, this.n++);
  }
}
// ../../src/core/pattern.ts
var NO_INPUTS = { cc: () => 0, held: () => [] };
function makeCtx(seed, voice = 0, key = DEFAULT_KEY, offset = ZERO, inputs = NO_INPUTS) {
  return { seed, voice, key, offset, inputs };
}

class Chord {
  notes;
  constructor(notes) {
    this.notes = notes;
  }
  toString() {
    return `{${this.notes.map(String).join(" ")}}`;
  }
}

class Rest {
  toString() {
    return ".";
  }
}
var REST = new Rest;

class Pat {
  query;
  items;
  label;
  sig;
  constructor(query, items, label) {
    this.query = query;
    this.items = items;
    this.label = label;
  }
  toString() {
    return this.label ?? (this.items ? `[${this.items.map(String).join(" ")}]` : "<pattern>");
  }
}
var EMPTY = [];
var silence = new Pat(() => EMPTY, [], "silence");
function* bars(a, b) {
  for (let c = a.floor();c < b.toNumber(); c++) {
    const cs = new R(c), ce = new R(c + 1);
    const lo = R.max(a, cs), hi = R.min(b, ce);
    if (lo.lt(hi))
      yield { c, lo, hi };
  }
}
function pure(v) {
  if (v instanceof Pat)
    return v;
  const p = new Pat((a, b) => {
    const out = [];
    for (let c = a.ceil();c < b.toNumber(); c++)
      out.push({ s: new R(c), e: new R(c + 1), v, p: {} });
    return out;
  }, undefined, String(v));
  p.items = [v];
  return p;
}
function toPat(v) {
  if (v instanceof Pat)
    return v;
  if (Array.isArray(v))
    return seq(v.map((x) => ({ pat: toPat(x), w: ONE })), v);
  if (v === null || v === undefined || v instanceof Rest)
    return restPat;
  return pure(v);
}
var restPat = new Pat(() => EMPTY, [REST], ".");
function seq(children, items) {
  const total = children.reduce((s, c) => s.add(c.w), ZERO);
  if (total.n === 0)
    return silence;
  let acc = ZERO;
  const slots = children.map((ch) => {
    const x0 = acc.div(total);
    acc = acc.add(ch.w);
    return { pat: ch.pat, x0, w: ch.w.div(total) };
  });
  return new Pat((a, b, ctx) => {
    const out = [];
    for (const { c, lo, hi } of bars(a, b)) {
      const C = new R(c);
      for (const sl of slots) {
        const gs = C.add(sl.x0), ge = gs.add(sl.w);
        const l = R.max(lo, gs), h = R.min(hi, ge);
        if (!l.lt(h))
          continue;
        const toLocal = (t) => C.add(t.sub(gs).div(sl.w));
        const toGlobal = (u) => gs.add(u.sub(C).mul(sl.w));
        for (const ev of sl.pat.query(toLocal(l), toLocal(h), ctx)) {
          out.push({ s: toGlobal(ev.s), e: toGlobal(ev.e), v: ev.v, p: ev.p });
        }
      }
    }
    return out;
  }, items);
}
function stack(pats) {
  if (pats.length === 1)
    return pats[0];
  return new Pat((a, b, ctx) => pats.flatMap((p) => p.query(a, b, ctx)));
}
function alt(pats) {
  const n = pats.length;
  if (!n)
    return silence;
  return new Pat((a, b, ctx) => {
    const out = [];
    for (const { c, lo, hi } of bars(a, b)) {
      const i = (c % n + n) % n;
      const off = new R(Math.floor(c / n) - c);
      for (const ev of pats[i].query(lo.add(off), hi.add(off), ctx))
        out.push({ s: ev.s.sub(off), e: ev.e.sub(off), v: ev.v, p: ev.p });
    }
    return out;
  });
}
function fast(k, p) {
  if (k.n <= 0)
    return silence;
  if (k.eq(ONE))
    return p;
  return new Pat((a, b, ctx) => p.query(a.mul(k), b.mul(k), ctx).map((ev) => ({ s: ev.s.div(k), e: ev.e.div(k), v: ev.v, p: ev.p })));
}
function shift(t, p) {
  if (t.n === 0)
    return p;
  return new Pat((a, b, ctx) => p.query(a.sub(t), b.sub(t), ctx).map((ev) => ({ s: ev.s.add(t), e: ev.e.add(t), v: ev.v, p: ev.p })));
}
function rev(p) {
  return new Pat((a, b, ctx) => {
    const out = [];
    for (const { c } of bars(a, b)) {
      const m = new R(2 * c + 1);
      for (const ev of p.query(new R(c), new R(c + 1), ctx)) {
        const s = m.sub(ev.e), e = m.sub(ev.s);
        if (s.ge(a) && s.lt(b))
          out.push({ s, e, v: ev.v, p: ev.p });
      }
    }
    return out;
  });
}
function perBarSelect(fn) {
  return new Pat((a, b, ctx) => {
    const out = [];
    for (const { c, lo, hi } of bars(a, b))
      for (const ev of fn(c, ctx).query(lo, hi, ctx))
        out.push(ev);
    return out;
  });
}
function perBar(fn) {
  const cache = new Map;
  return perBarSelect((c, ctx) => {
    const k = `${ctx.seed}|${ctx.voice}|${ctx.offset}|${c}`;
    let p = cache.get(k);
    if (!p) {
      p = fn(c, ctx);
      cache.set(k, p);
      if (cache.size > 256)
        cache.delete(cache.keys().next().value);
    }
    return p;
  });
}
function mapEv(p, f) {
  const np = new Pat((a, b, ctx) => {
    const out = [];
    for (const ev of p.query(a, b, ctx)) {
      const r = f(ev, ctx);
      if (r)
        out.push(r);
    }
    return out;
  });
  return np;
}
function mapV(p, f) {
  const np = mapEv(p, (ev, ctx) => ({ ...ev, v: f(ev.v, ctx) }));
  if (p.items && !p.sig)
    np.items = p.items.map((v) => v instanceof Pat ? mapV(v, f) : v instanceof Rest ? v : f(v, makeCtx(0)));
  if (p.sig) {
    const s = p.sig;
    np.sig = (t, ctx) => f(s(t, ctx), ctx);
  }
  return np;
}
function withCtx(p, f) {
  const np = new Pat((a, b, ctx) => p.query(a, b, f(ctx)), p.items);
  if (p.sig) {
    const s = p.sig;
    np.sig = (t, ctx) => s(t, f(ctx));
  }
  return np;
}
function sampleAt(v, t, ctx) {
  if (!(v instanceof Pat))
    return v;
  if (v.sig)
    return v.sig(t.toNumber(), ctx);
  const c = t.floor();
  const evs = v.query(new R(c), new R(c + 1), ctx);
  let best;
  for (const ev of evs)
    if (ev.s.le(t) && (!best || ev.s.gt(best.s)))
      best = ev;
  if (!best)
    best = evs[0];
  return best ? best.v : undefined;
}
function setParam(p, name, value) {
  return mapEv(p, (ev, ctx) => ({ ...ev, p: { ...ev.p, [name]: sampleAt(value, ev.s, ctx) } }));
}
function signal(fn, label = "signal") {
  const p = new Pat((a, b, ctx) => {
    const out = [];
    for (let c = a.ceil();c < b.toNumber(); c++)
      out.push({ s: new R(c), e: new R(c + 1), v: fn(c, ctx), p: {} });
    return out;
  }, undefined, label);
  p.sig = fn;
  return p;
}
function segment(n, p) {
  const step = new R(1, 1).div(R.of(n));
  return new Pat((a, b, ctx) => {
    const out = [];
    let k = a.div(step).ceil();
    for (;; k++) {
      const s = step.mul(new R(k));
      if (!s.lt(b))
        break;
      out.push({ s, e: s.add(step), v: sampleAt(p, s, ctx), p: {} });
    }
    return out;
  });
}
function filterEv(p, f) {
  return mapEv(p, (ev, ctx) => f(ev, ctx) ? ev : null);
}
function evRand(ctx, salt, t, extra = 0) {
  const g = t.add(ctx.offset);
  return rand01(ctx.seed, ctx.voice, salt, g.n, g.d, extra);
}
function degrade(prob, salt, p) {
  return filterEv(p, (ev, ctx) => evRand(ctx, salt, ev.s) >= Number(sampleAt(prob, ev.s, ctx)));
}
function choice(opts, salt) {
  return perBarSelect((c, ctx) => {
    const r = rand01(ctx.seed, ctx.voice, salt, c + ctx.offset.toNumber());
    return opts[Math.floor(r * opts.length)];
  });
}
function bjorklund(k, n) {
  k = Math.max(0, Math.min(k, n));
  return Array.from({ length: n }, (_, i) => i * k % n < k);
}
function euclid(p, k, n, rot = 0) {
  let bits = bjorklund(k, n);
  if (rot) {
    const r = (rot % n + n) % n;
    bits = [...bits.slice(r), ...bits.slice(0, r)];
  }
  return seq(bits.map((b) => ({ pat: b ? p : restPat, w: ONE })));
}
function every(n, f, p, offset) {
  return perBarSelect((c) => ((c - offset) % n + n) % n === 0 ? f : p);
}
function arrange(parts) {
  const total = parts.reduce((s, x) => s + x.bars, 0);
  if (!total)
    return silence;
  return new Pat((a, b, ctx) => {
    const out = [];
    for (const { c, lo, hi } of bars(a, b)) {
      const loop = Math.floor(c / total), pos = c - loop * total;
      let acc = 0;
      for (const part of parts) {
        if (pos < acc + part.bars) {
          const start = loop * total + acc;
          const off = new R(start);
          for (const ev of part.pat.query(lo.sub(off), hi.sub(off), ctx))
            out.push({ s: ev.s.add(off), e: ev.e.add(off), v: ev.v, p: ev.p });
          break;
        }
        acc += part.bars;
      }
    }
    return out;
  });
}
function valueToSemis(v, key) {
  if (v === null || v === undefined || v instanceof Rest || v === false)
    return [];
  if (v instanceof Pitch)
    return [v.semi];
  if (v instanceof Degree)
    return [key.resolve(v)];
  if (v instanceof R)
    return [v.toNumber()];
  if (typeof v === "number")
    return [v];
  if (v instanceof Chord)
    return v.notes.flatMap((n) => valueToSemis(n, key));
  if (v === true)
    return [60];
  if (typeof v === "object" && !(v instanceof Pat) && "note" in v)
    return valueToSemis(v.note, key);
  return [];
}
function resolveNotes(voice, evs, ctx) {
  const out = [];
  for (const ev of evs) {
    const key = ev.p.key ?? ctx.key;
    const semis = valueToSemis(ev.v, key);
    if (!semis.length)
      continue;
    const legato = ev.p.legato !== undefined ? Number(ev.p.legato) : 1;
    const dur = ev.p.dur !== undefined ? R.of(Number(ev.p.dur)) : ev.e.sub(ev.s).mul(R.of(legato));
    let vel = ev.p.vel !== undefined ? Number(ev.p.vel) : 0.8;
    if (typeof ev.v === "object" && ev.v && "vel" in ev.v)
      vel = Number(ev.v.vel);
    const params = { ...ev.p };
    if (ev.v instanceof Pitch && ev.v.drum && params.inst === undefined)
      params.inst = "kit";
    delete params.key;
    delete params.vel;
    delete params.legato;
    delete params.dur;
    for (const semi of semis)
      out.push({ voice, start: ev.s, dur, semi, vel: Math.max(0, Math.min(1, vel)), params });
  }
  return out;
}
// ../../src/core/values.ts
class Rec {
  fields;
  constructor(fields) {
    this.fields = fields;
  }
  toString() {
    return `(${Object.entries(this.fields).map(([k, v]) => `${k}: ${show(v)}`).join(", ")})`;
  }
}

class Closure {
  name;
  params;
  body;
  env;
  constructor(name, params, body, env) {
    this.name = name;
    this.params = params;
    this.body = body;
    this.env = env;
  }
  toString() {
    return `<fn ${this.name}(${this.params.join(", ")})>`;
  }
}

class Builtin {
  name;
  impl;
  sig;
  doc;
  category;
  constructor(name, impl, sig, doc, category) {
    this.name = name;
    this.impl = impl;
    this.sig = sig;
    this.doc = doc;
    this.category = category;
  }
  toString() {
    return `<builtin ${this.name}>`;
  }
}

class Env {
  parent;
  vars = new Map;
  constructor(parent) {
    this.parent = parent;
  }
  get(name) {
    let e = this;
    while (e) {
      if (e.vars.has(name))
        return e.vars.get(name);
      e = e.parent;
    }
    return;
  }
  has(name) {
    let e = this;
    while (e) {
      if (e.vars.has(name))
        return true;
      e = e.parent;
    }
    return false;
  }
  set(name, v) {
    this.vars.set(name, v);
  }
  names() {
    const s = new Set;
    let e = this;
    while (e) {
      for (const k of e.vars.keys())
        s.add(k);
      e = e.parent;
    }
    return [...s];
  }
}
function typeName(v) {
  if (v instanceof R || typeof v === "number")
    return "number";
  if (typeof v === "string")
    return "text";
  if (typeof v === "boolean")
    return "boolean";
  if (v instanceof Pitch)
    return v.drum ? "drum" : "pitch";
  if (v instanceof Degree)
    return "degree";
  if (v instanceof Chord)
    return "chord";
  if (v instanceof Pat)
    return v.items ? "phrase" : v.sig ? "signal" : "pattern";
  if (v instanceof Key)
    return "key";
  if (v instanceof Scale)
    return "scale";
  if (v instanceof Closure || v instanceof Builtin)
    return "function";
  if (v instanceof Rec)
    return "record";
  if (v instanceof Rest)
    return "rest";
  if (v === null || v === undefined)
    return "nothing";
  return typeof v;
}
function show(v) {
  if (v === null || v === undefined)
    return "nothing";
  if (typeof v === "string")
    return JSON.stringify(v);
  if (typeof v === "number")
    return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
  return String(v);
}
function num(v) {
  if (v instanceof R)
    return v.toNumber();
  if (typeof v === "number")
    return v;
  if (typeof v === "boolean")
    return v ? 1 : 0;
  if (v instanceof Pitch)
    return v.semi;
  throw new TypeError(`expected a number, got ${typeName(v)}`);
}
function isNum(v) {
  return v instanceof R || typeof v === "number";
}
function truthy(v) {
  if (v === false || v === null || v === undefined)
    return false;
  if (v instanceof R)
    return v.n !== 0;
  if (typeof v === "number")
    return v !== 0;
  return true;
}
// ../../src/core/builtins.ts
var DEFS = [];
function def(name, sig, doc, category, impl) {
  DEFS.push(new Builtin(name, impl, sig, doc, category));
}
function builtinList() {
  return DEFS;
}
var P = (x) => toPat(x);
var N = (x, d) => x === undefined ? d : num(x);
var RR = (x) => x instanceof R ? x : R.of(num(x));
function items(x) {
  if (Array.isArray(x))
    return x;
  if (x instanceof Pat && x.items)
    return x.items;
  if (x instanceof Chord)
    return x.notes;
  throw new TypeError(`expected a list like [a b c], got ${typeName(x)}`);
}
var list = (vals) => toPat(vals);
function fnCall(call, f, args) {
  return call.interp.call(f, args, {}, call.span);
}
function fnKeyed(call, f, args, ctx, keys, salt) {
  return call.interp.callKeyed(f, args, ctx, keys.reduce((h, k) => Math.imul(h, 31) + (k | 0) | 0, 7), salt);
}
var asFn = (call, f) => (p) => P(fnCall(call, f, [p]));
var DIATONIC = { "3": [0, 2, 4], "5": [0, 2, 4], "6": [0, 2, 4, 5], "7": [0, 2, 4, 6], "9": [0, 2, 4, 6, 8], "11": [0, 2, 4, 6, 8, 10], "13": [0, 2, 4, 6, 8, 10, 12] };
function makeChord(root, q) {
  if (root instanceof Degree) {
    if (DIATONIC[q])
      return new Chord(DIATONIC[q].map((k) => new Degree(root.deg, root.acc, root.shift + k)));
    const offs = CHORDS[q];
    if (!offs)
      throw new Error(`unknown chord quality '${q}'`);
    return new Chord(offs.map((o) => new Degree(root.deg, root.acc + o, root.shift)));
  }
  const semi = root instanceof Pitch ? root.semi : isNum(root) ? num(root) : NaN;
  if (isNaN(semi))
    throw new Error(`cannot build a chord on ${typeName(root)}`);
  const offs = CHORDS[q];
  if (!offs)
    throw new Error(`unknown chord quality '${q}'; try maj, m, 7, maj7, m7, dim, sus4, 9`);
  return new Chord(offs.map((o) => new Pitch(semi + o)));
}
function semisOf(v, key) {
  if (v instanceof Pitch)
    return [v.semi];
  if (v instanceof Degree)
    return [key.resolve(v)];
  if (isNum(v))
    return [num(v)];
  if (v instanceof Chord)
    return v.notes.flatMap((n) => semisOf(n, key));
  return [];
}
function registerBuiltins(env) {
  for (const b of DEFS)
    env.set(b.name, b);
}
var cat = { time: "time", rand: "chance", pitch: "pitch", param: "sound", list: "lists", math: "math", gen: "generators", io: "input", misc: "misc" };
def("fast", "fast(p, n)", "Play p n times faster (n times per bar).", cat.time, ([p, n]) => fast(RR(n), P(p)));
def("slow", "slow(p, n)", "Stretch p over n bars.", cat.time, ([p, n]) => fast(ONE.div(RR(n)), P(p)));
def("late", "late(p, t)", "Delay p by t bars (1/8 = an eighth note in 4/4... of a bar).", cat.time, ([p, t]) => shift(RR(t), P(p)));
def("early", "early(p, t)", "Shift p earlier by t bars.", cat.time, ([p, t]) => shift(RR(t).neg(), P(p)));
def("rev", "rev(p)", "Reverse p within each bar. On a list, reverses the list.", cat.time, ([p]) => {
  const q = P(p);
  const r = rev(q);
  if (q.items)
    r.items = [...q.items].reverse();
  return r;
});
def("every", "every(p, n, f, at: n-1)", "Apply f on one bar out of every n (the last one by default, where fills belong).", cat.time, ([p, n, f], named, call) => {
  const k = Math.round(N(n));
  const at = named.at !== undefined ? Math.round(N(named.at)) : k - 1;
  return every(k, asFn(call, f)(P(p)), P(p), at);
});
def("palindrome", "palindrome(p)", "Play p forwards, then backwards, alternating bars.", cat.time, ([p]) => alt([P(p), rev(P(p))]));
def("iter", "iter(p, n)", "Rotate the start of p by 1/n each bar.", cat.time, ([p, n]) => {
  const k = Math.round(N(n));
  const q = P(p);
  return perBarSelect((c) => shift(new R(-((c % k + k) % k), k), q));
});
def("off", "off(p, t, f)", "Layer p with a copy shifted by t bars and transformed by f.", cat.time, ([p, t, f], _n, call) => {
  const q = P(p);
  return stack([q, shift(RR(t), f ? asFn(call, f)(q) : q)]);
});
def("echo", "echo(p, times: 3, time: 1/8, decay: 0.6)", "Repeat each event, quieter each time.", cat.time, ([p, times, time, decay], named) => {
  const k = Math.round(N(named.times ?? times, 3)), dt = RR(named.time ?? time ?? new R(1, 8)), dc = N(named.decay ?? decay, 0.6);
  const q = P(p);
  const layers = [q];
  for (let i = 1;i <= k; i++)
    layers.push(mapEv(shift(dt.mul(new R(i)), q), (ev) => ({ ...ev, p: { ...ev.p, vel: (ev.p.vel ?? 0.8) * Math.pow(dc, i) } })));
  return stack(layers);
});
def("ply", "ply(p, n)", "Repeat each event n times within its own length.", cat.time, ([p, n]) => {
  const k = Math.round(N(n));
  const q = P(p);
  return new Pat((a, b, ctx) => {
    const out = [];
    for (const ev of q.query(new R(a.floor() - 1), b.add(ONE), ctx)) {
      const step = ev.e.sub(ev.s).div(new R(k));
      for (let i = 0;i < k; i++) {
        const s = ev.s.add(step.mul(new R(i)));
        if (s.ge(a) && s.lt(b))
          out.push({ s, e: s.add(step), v: ev.v, p: ev.p });
      }
    }
    return out;
  });
});
def("swing", "swing(p, amount: 1/3, div: 8)", "Delay every second subdivision (eighths by default) by a fraction of a step.", cat.time, ([p, amount, div], named) => {
  const amt = N(named.amount ?? amount, 1 / 3), d = Math.round(N(named.div ?? div, 8));
  const grid = new R(1, d), q = P(p);
  return new Pat((a, b, ctx) => q.query(a.sub(grid), b, ctx).flatMap((ev) => {
    const pos = ev.s.cyclePos().div(grid);
    let { s, e } = ev;
    if (pos.isInt() && pos.n % 2 === 1) {
      const dt = grid.mul(R.of(amt));
      s = s.add(dt);
      e = e.add(dt);
    }
    return s.ge(a) && s.lt(b) ? [{ ...ev, s, e }] : [];
  }));
});
def("humanize", "humanize(p, time: 0.004, vel: 0.1)", "Seeded random drift in timing (bars) and velocity. Replayable like all randomness.", cat.rand, ([p, time, vel], named, call) => {
  const dt = N(named.time ?? time, 0.004), dv = N(named.vel ?? vel, 0.1), salt = call.interp.salt(), q = P(p);
  return new Pat((a, b, ctx) => q.query(a, b, ctx).map((ev) => {
    const j = R.approx((evRand(ctx, salt, ev.s, 1) * 2 - 1) * dt, 1e5);
    return { ...ev, s: ev.s.add(j), e: ev.e.add(j), p: { ...ev.p, vel: Math.max(0, Math.min(1, (ev.p.vel ?? 0.8) + (evRand(ctx, salt, ev.s, 2) * 2 - 1) * dv)) } };
  }));
});
def("stack", "stack(a, b, ...)", "Play patterns at the same time.", cat.time, (args) => stack(args.map(P)));
def("cat", "cat(a, b, ...)", "One pattern per bar, in turn.", cat.time, (args) => alt(args.map(P)));
def("seq", "seq(a, b, ...)", "Squeeze patterns one after another into a single bar.", cat.time, (args) => seq(args.map((a) => ({ pat: P(a), w: ONE })), args));
def("arrange", "arrange(p1, bars1, p2, bars2, ...)", "Chain patterns, each lasting the given number of bars, and loop the whole.", cat.time, (args) => {
  const parts = [];
  for (let i = 0;i + 1 < args.length; i += 2)
    parts.push({ pat: P(args[i]), bars: Math.round(N(args[i + 1])) });
  return arrange(parts);
});
def("poly", "poly(p, steps)", "Polymeter: step through p's elements at `steps` per bar, whatever its length.", cat.time, ([p, steps]) => {
  const q = P(p);
  const n = q.items?.length ?? 1;
  return fast(RR(steps).div(new R(n)), q);
});
def("euclid", "euclid(p, hits, steps, rot: 0)", "Spread `hits` events as evenly as possible over `steps` (Euclidean rhythm).", cat.time, ([p, k, n, rot], named) => euclid(P(p), Math.round(N(k)), Math.round(N(n)), Math.round(N(named.rot ?? rot, 0))));
def("trunc", "trunc(p, fraction)", "Play only the first fraction of each bar.", cat.time, ([p, f]) => {
  const fr = RR(f);
  return filterEv(P(p), (ev) => ev.s.cyclePos().lt(fr));
});
def("per_bar", "per_bar(bar => pattern)", "Build each bar from a function of the bar number. Randomness inside is keyed to the bar.", cat.time, ([f], _n, call) => {
  const salt = call.interp.salt();
  return perBar((c, ctx) => P(call.interp.callKeyed(f, [new R(c)], ctx, c, salt)));
});
def("loop", "loop(p, bars)", "Repeat the first `bars` bars of p forever.", cat.time, ([p, b]) => {
  const n = Math.max(1, Math.round(N(b))), q = P(p);
  return new Pat((a, bb, ctx) => {
    const out = [];
    for (let c = a.floor();c < bb.toNumber(); c++) {
      const off = new R(c - (c % n + n) % n);
      const lo = R.max(a, new R(c)), hi = R.min(bb, new R(c + 1));
      for (const ev of q.query(lo.sub(off), hi.sub(off), ctx))
        out.push({ ...ev, s: ev.s.add(off), e: ev.e.add(off) });
    }
    return out;
  });
});
def("degrade", "degrade(p, amount: 0.5)", "Randomly drop events (seeded).", cat.rand, ([p, amt], named, call) => degrade(named.amount ?? amt ?? 0.5, call.interp.salt(), P(p)));
function sometimesBy(prob, p, f, salt) {
  const fp = f(p);
  const keep = filterEv(p, (ev, ctx) => evRand(ctx, salt, ev.s) >= N(sampleAt(prob, ev.s, ctx)));
  const take = filterEv(fp, (ev, ctx) => evRand(ctx, salt, ev.s) < N(sampleAt(prob, ev.s, ctx)));
  return stack([keep, take]);
}
def("sometimes", "sometimes(p, prob, f)", "Apply f to each event with the given probability (seeded).", cat.rand, ([p, prob, f], _n, call) => {
  if (f === undefined) {
    f = prob;
    prob = 0.5;
  }
  return sometimesBy(prob, P(p), asFn(call, f), call.interp.salt());
});
def("often", "often(p, f)", "Apply f to about 75% of events.", cat.rand, ([p, f], _n, call) => sometimesBy(0.75, P(p), asFn(call, f), call.interp.salt()));
def("rarely", "rarely(p, f)", "Apply f to about 25% of events.", cat.rand, ([p, f], _n, call) => sometimesBy(0.25, P(p), asFn(call, f), call.interp.salt()));
def("maybe", "maybe(p, prob, f)", "Apply f to whole bars with the given probability (seeded).", cat.rand, ([p, prob, f], _n, call) => {
  const q = P(p), fq = asFn(call, f)(q), salt = call.interp.salt();
  return perBarSelect((c, ctx) => rand01(ctx.seed, ctx.voice, salt, c + ctx.offset.toNumber()) < N(prob) ? fq : q);
});
def("dice", "dice(list, steps: 1)", "A new seeded random pick from list on each of `steps` steps per bar.", cat.rand, ([l, n], named, call) => {
  const xs = items(l), k = Math.round(N(named.steps ?? n, 1)), salt = call.interp.salt();
  const step = new R(1, k);
  return new Pat((a, b, ctx) => {
    const out = [];
    for (let i = a.div(step).ceil();; i++) {
      const s = step.mul(new R(i));
      if (!s.lt(b))
        break;
      const v = xs[Math.floor(evRand(ctx, salt, s) * xs.length)];
      for (const ev of P(v).query(new R(0), ONE, ctx))
        out.push({ s: s.add(ev.s.mul(step)), e: s.add(ev.e.mul(step)), v: ev.v, p: ev.p });
    }
    return out;
  });
});
def("walk", "walk(list, steps: 8, stride: 1)", "A seeded random walk through list: each step moves at most `stride` places.", cat.rand, ([l, n, m], named, call) => {
  const xs = items(l), k = Math.round(N(named.steps ?? n, 8)), mx = Math.round(N(named.stride ?? m, 1)), salt = call.interp.salt();
  return perBar((c, ctx) => {
    let i = Math.floor(rand01(ctx.seed, ctx.voice, salt, c + ctx.offset.toNumber()) * xs.length);
    const vals = [];
    for (let s = 0;s < k; s++) {
      vals.push(xs[i]);
      const r = Math.floor(rand01(ctx.seed, ctx.voice, salt, c + ctx.offset.toNumber(), s + 1) * (2 * mx + 1)) - mx;
      i = Math.max(0, Math.min(xs.length - 1, i + r));
    }
    return list(vals);
  });
});
def("scramble", "scramble(p)", "Shuffle the elements of a phrase into a new seeded order each bar.", cat.rand, ([p], _n, call) => {
  const xs = items(p), salt = call.interp.salt();
  return perBar((c, ctx) => {
    const a = [...xs];
    for (let i = a.length - 1;i > 0; i--) {
      const j = Math.floor(rand01(ctx.seed, ctx.voice, salt, c + ctx.offset.toNumber(), i) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return list(a);
  });
});
def("rand", "rand()", "A seeded random number in [0, 1). Same seed, same number.", cat.rand, (_a, _n, call) => call.interp.stream.next());
def("rand_int", "rand_int(lo, hi)", "A seeded random whole number from lo to hi inclusive.", cat.rand, ([lo, hi], _n, call) => {
  const a = Math.round(N(lo)), b = Math.round(N(hi));
  return new R(a + Math.floor(call.interp.stream.next() * (b - a + 1)));
});
def("pick", "pick(list)", "One seeded random element of list.", cat.rand, ([l], _n, call) => {
  const xs = items(l);
  return xs[Math.floor(call.interp.stream.next() * xs.length)];
});
def("weighted", "weighted(list, weights)", "A seeded random element, chosen in proportion to weights.", cat.rand, ([l, w], _n, call) => {
  const xs = items(l), ws = items(w).map((x) => N(x));
  const tot = ws.reduce((s, x) => s + x, 0);
  let r = call.interp.stream.next() * tot;
  for (let i = 0;i < xs.length; i++) {
    r -= ws[i] ?? 0;
    if (r < 0)
      return xs[i];
  }
  return xs[xs.length - 1];
});
def("shuffle", "shuffle(list)", "The list in a seeded random order (decided once).", cat.rand, ([l], _n, call) => {
  const a = [...items(l)];
  for (let i = a.length - 1;i > 0; i--) {
    const j = Math.floor(call.interp.stream.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return list(a);
});
def("chance", "chance(prob)", "true with the given probability (seeded).", cat.rand, ([p], _n, call) => call.interp.stream.next() < N(p, 0.5));
function mapPitch(v, f) {
  if (v instanceof Chord)
    return new Chord(v.notes.map(f));
  if (v instanceof Rest || v === null || v === undefined)
    return v;
  return f(v);
}
function transposeVal(x, st) {
  if (x instanceof Pitch)
    return x.drum ? x : new Pitch(x.semi + st);
  if (x instanceof Degree)
    return new Degree(x.deg, x.acc + st, x.shift);
  if (isNum(x))
    return isNum(st) && x instanceof R && Number.isInteger(st) ? x.add(new R(st)) : num(x) + st;
  if (x instanceof Rec && "note" in x.fields)
    return new Rec({ ...x.fields, note: transposeVal(x.fields.note, st) });
  return x;
}
function pitchMapPat(p, valueArg, f) {
  if (!(p instanceof Pat) && !(valueArg instanceof Pat))
    return mapPitch(p, (x) => f(x, N(valueArg), null, null));
  const q = P(p);
  const np = mapEv(q, (ev, ctx) => ({ ...ev, v: mapPitch(ev.v, (x) => f(x, N(sampleAt(valueArg, ev.s, ctx)), ctx, ev)) }));
  if (q.items && !(valueArg instanceof Pat))
    np.items = q.items.map((v) => v instanceof Pat ? pitchMapPat(v, valueArg, f) : mapPitch(v, (x) => f(x, N(valueArg), { key: SCALES && new Key(new Pitch(60), SCALES.major) }, null)));
  return np;
}
def("transpose", "transpose(p, semitones)", "Move by semitones (fractions allowed: 0.5 is a quarter tone). Works on notes, degrees, chords and patterns.", cat.pitch, ([p, st]) => pitchMapPat(p, st, (x, k) => transposeVal(x, k)));
def("octave", "octave(p, n)", "Move by n octaves (of the scale's period for degrees).", cat.pitch, ([p, n]) => pitchMapPat(p, n, (x, k) => x instanceof Degree ? new Degree(x.deg, x.acc + 12 * k, x.shift) : transposeVal(x, 12 * k)));
def("step", "step(p, n)", "Move by n steps of the current scale (diatonic transposition).", cat.pitch, ([p, n]) => pitchMapPat(p, n, (x, k, ctx, ev) => {
  if (x instanceof Degree)
    return new Degree(x.deg, x.acc, x.shift + Math.round(k));
  if (x instanceof Pitch && !x.drum) {
    const key = ev?.p?.key ?? ctx?.key;
    if (!key)
      return x;
    const idx = key.scale.indexOf(x.semi - key.root.semi);
    return new Pitch(key.root.semi + key.scale.semitoneOf(idx + Math.round(k)));
  }
  return x;
}));
def("degrees", "degrees(p)", "Treat numbers as 0-based scale steps: [0 2 4].degrees is [^1 ^3 ^5].", cat.pitch, ([p]) => pitchMapPat(p, 0, (x) => isNum(x) ? new Degree(1, 0, Math.round(num(x))) : x));
def("key", "key(root, scale) or p.key(root, scale)", "Make a key, or play p in a key. Degrees like ^3 resolve against it.", cat.pitch, (args) => {
  if (args[0] instanceof Pat || args[0] instanceof Degree || args[0] instanceof Chord) {
    const k = args[1] instanceof Key ? args[1] : new Key(args[1], args[2] ?? SCALES.major);
    return withCtx(P(args[0]), (ctx) => ({ ...ctx, key: k }));
  }
  if (!(args[0] instanceof Pitch))
    throw new TypeError("key needs a root note, like key(d, dorian)");
  return new Key(args[0], args[1] ?? SCALES.major);
});
def("chord", "chord(root, quality)", 'A chord: chord(c4, "maj7") is the same as c4@maj7.', cat.pitch, ([r, q]) => makeChord(r, String(q instanceof Pitch ? q.toString() : q)));
def("invert", "invert(p, n: 1)", "Chord inversion: move the lowest n notes up an octave.", cat.pitch, ([p, n]) => {
  const k = Math.round(N(n, 1));
  const inv = (c, key) => {
    if (!(c instanceof Chord))
      return c;
    let s = semisOf(c, key).sort((a, b) => a - b);
    for (let i = 0;i < k; i++) {
      const lo = s.shift();
      s.push(lo + 12);
    }
    for (let i = 0;i > k; i--) {
      const hi = s.pop();
      s.unshift(hi - 12);
    }
    return new Chord(s.map((x) => new Pitch(x)));
  };
  if (p instanceof Chord)
    return inv(p, new Key(new Pitch(60), SCALES.major));
  return mapEv(P(p), (ev, ctx) => ({ ...ev, v: inv(ev.v, ev.p.key ?? ctx.key) }));
});
def("arp", 'arp(p, mode: "up")', "Spread each chord's notes across its length. Modes: up, down, updown, downup, out, random.", cat.pitch, ([p, mode], named, call) => {
  const m = String(named.mode ?? mode ?? "up"), salt = call.interp.salt(), q = P(p);
  return new Pat((a, b, ctx) => {
    const out = [];
    for (const ev of q.query(new R(a.floor()), new R(b.ceil()), ctx)) {
      if (!(ev.v instanceof Chord)) {
        if (ev.s.ge(a) && ev.s.lt(b))
          out.push(ev);
        continue;
      }
      const key = ev.p.key ?? ctx.key;
      let notes = [...ev.v.notes].sort((x, y) => semisOf(x, key)[0] - semisOf(y, key)[0]);
      if (m === "down")
        notes.reverse();
      else if (m === "updown")
        notes = [...notes, ...notes.slice(1, -1).reverse()];
      else if (m === "downup") {
        const d = [...notes].reverse();
        notes = [...d, ...d.slice(1, -1).reverse()];
      } else if (m === "out") {
        const o = [];
        let i = 0, j = notes.length - 1;
        while (i <= j) {
          o.push(notes[i++]);
          if (i <= j)
            o.push(notes[j--]);
        }
        notes = o;
      } else if (m === "random") {
        notes = notes.map((x, i) => [x, evRand(ctx, salt, ev.s, i)]).sort((x, y) => x[1] - y[1]).map((x) => x[0]);
      }
      if (!notes.length)
        continue;
      const step = ev.e.sub(ev.s).div(new R(notes.length));
      notes.forEach((nt, i) => {
        const s = ev.s.add(step.mul(new R(i)));
        if (s.ge(a) && s.lt(b))
          out.push({ s, e: s.add(step), v: nt, p: ev.p });
      });
    }
    return out;
  });
});
def("strum", "strum(p, spread: 1/48)", "Roll each chord's notes, low to high, `spread` bars apart.", cat.pitch, ([p, sp], named) => {
  const d = RR(named.spread ?? sp ?? new R(1, 48)), q = P(p);
  return new Pat((a, b, ctx) => q.query(a.sub(ONE), b, ctx).flatMap((ev) => {
    if (!(ev.v instanceof Chord))
      return ev.s.ge(a) && ev.s.lt(b) ? [ev] : [];
    const key = ev.p.key ?? ctx.key;
    const notes = [...ev.v.notes].sort((x, y) => semisOf(x, key)[0] - semisOf(y, key)[0]);
    return notes.map((nt, i) => {
      const s = ev.s.add(d.mul(new R(i)));
      return { s, e: ev.e, v: nt, p: ev.p };
    }).filter((e) => e.s.ge(a) && e.s.lt(b));
  }));
});
def("hz", "hz(pitch)", "Frequency of a pitch in Hz (at the current tuning).", cat.pitch, ([p], _n, call) => (p instanceof Pitch ? p : new Pitch(N(p))).freq(call.interp.scene.tuningRef));
def("note_num", "note_num(pitch)", "The (possibly fractional) MIDI note number of a pitch.", cat.pitch, ([p]) => p instanceof Pitch ? p.semi : N(p));
def("pitch", "pitch(n)", "A pitch from a MIDI note number (fractions allowed).", cat.pitch, ([n]) => new Pitch(N(n)));
def("ratio", "ratio(r)", "The size of a frequency ratio in semitones: ratio(3/2) is about 7.02.", cat.pitch, ([r]) => 12 * Math.log2(N(r)));
def("scale", "scale(semitones, period: 12)", "A scale from semitone offsets (fractions allowed).", cat.pitch, ([l, period], named) => new Scale("custom", items(l).map((x) => N(x)), N(named.period ?? period, 12)));
def("just", "just(ratios, period: 2)", "A just-intonation scale from frequency ratios, e.g. just([1 9/8 5/4 3/2 5/3]).", cat.pitch, ([l, period], named) => new Scale("just", items(l).map((x) => 12 * Math.log2(N(x))), 12 * Math.log2(N(named.period ?? period, 2))));
def("edo", "edo(n, steps)", "An n-tone equal division of the octave. With steps, a scale picked from it: edo(31, [0 5 10 13 18 23 28]).", cat.pitch, ([n, l]) => {
  const k = N(n);
  const st = l === undefined ? Array.from({ length: k }, (_, i) => i) : items(l).map((x) => N(x));
  return new Scale(`${k}edo`, st.map((s) => s * 12 / k));
});
def("cents", "cents(list, period: 1200)", "A scale from offsets in cents.", cat.pitch, ([l, period], named) => new Scale("cents", items(l).map((x) => N(x) / 100), N(named.period ?? period, 1200) / 100));
def("scala", "scala(text)", "A scale from the text of a Scala .scl file (the common microtonal tuning format).", cat.pitch, ([t]) => parseScala(String(t)));
def("mode", "mode(scale, n)", "Rotate a scale to start on its n-th degree (1-based): mode(major, 2) is dorian.", cat.pitch, ([s, n]) => {
  if (!(s instanceof Scale))
    throw new TypeError("mode needs a scale");
  const k = Math.round(N(n)) - 1, L = s.steps.length;
  const base = s.semitoneOf(k);
  return new Scale(`${s.name}/${k + 1}`, Array.from({ length: L }, (_, i) => s.semitoneOf(k + i) - base), s.period);
});
function parseScala(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => !l.startsWith("!"));
  const name = lines[0] || "scala";
  const count = parseInt(lines[1], 10);
  const vals = [];
  for (const l of lines.slice(2)) {
    if (!l)
      continue;
    const tok = l.split(/\s+/)[0];
    if (tok.includes("."))
      vals.push(parseFloat(tok) / 100);
    else if (tok.includes("/")) {
      const [a, b] = tok.split("/").map(Number);
      vals.push(12 * Math.log2(a / b));
    } else
      vals.push(12 * Math.log2(Number(tok)));
    if (vals.length >= count)
      break;
  }
  const period = vals.pop() ?? 12;
  return new Scale(name.slice(0, 40), [0, ...vals], period);
}
var param = (name, sig, doc) => def(name, sig, doc, cat.param, ([p, v]) => setParam(P(p), name, v));
param("vel", "vel(p, v)", "Velocity 0 to 1. v may itself be a pattern: .vel([1 .5 .7 .5]).");
param("legato", "legato(p, x)", "Note length as a fraction of its step (1 = full, 0.5 = staccato).");
param("gain", "gain(p, x)", "Output level multiplier for the built-in synth.");
param("pan", "pan(p, x)", "Stereo position from -1 (left) to 1 (right).");
param("cutoff", "cutoff(p, hz)", "Filter cutoff for the built-in synth.");
param("res", "res(p, x)", "Filter resonance 0 to 1.");
param("attack", "attack(p, seconds)", "Envelope attack time.");
param("release", "release(p, seconds)", "Envelope release time.");
param("decay", "decay(p, seconds)", "Envelope decay time.");
param("sustain", "sustain(p, level)", "Envelope sustain level 0 to 1.");
param("reverb", "reverb(p, amount)", "Send to the built-in reverb, 0 to 1.");
def("dur", "dur(p, beats)", "Fixed note length in beats, independent of the step length.", cat.param, ([p, v]) => setParam(P(p), "durBeats", v));
def("set", "set(p, name, value)", "Attach any named parameter to events (it is passed through to MIDI CC maps and exports).", cat.param, ([p, n, v]) => setParam(P(p), String(n), v));
def("inst", "inst(p, name, ...options)", "Choose a built-in instrument: keys, sine, tri, saw, square, pluck, bass, pad, bell, organ, kit, or a loaded sample name.", cat.param, ([p, name], named) => {
  const nm = name instanceof Pitch && name.drum ? name.drum : String(name);
  let q = setParam(P(p), "inst", nm);
  for (const [k, v] of Object.entries(named))
    q = setParam(q, k, v);
  return q;
});
def("sample", "sample(p, name, fit: false)", "Play a loaded audio sample (drop files into the DAW). With fit: true it is stretched to the event length, for loops.", cat.param, ([p, name, fit], named) => {
  let q = setParam(P(p), "inst", `sample:${String(name)}`);
  if (truthy(named.fit ?? fit ?? false))
    q = setParam(q, "fit", true);
  return q;
});
def("midi", 'midi(p, channel: 1, port: "")', "Send to an external MIDI device instead of the built-in synth.", cat.param, ([p, ch, port], named) => {
  let q = setParam(P(p), "midi", Math.round(N(named.channel ?? ch, 1)));
  const pt = named.port ?? port;
  if (pt !== undefined)
    q = setParam(q, "port", String(pt));
  return q;
});
def("mpe", "mpe(p)", "Send each note on its own MIDI channel (2 to 16) so microtonal pitch bends do not collide.", cat.param, ([p]) => setParam(P(p), "mpe", true));
def("cc", "cc(number, channel: any)", "A live signal (0 to 1) from a MIDI controller knob or fader.", cat.io, ([n, ch]) => {
  const k = Math.round(N(n)), c = ch === undefined ? undefined : Math.round(N(ch));
  return signal((_t, ctx) => ctx.inputs.cc(k, c), `cc(${k})`);
});
def("held", "held(steps: 1)", "The notes currently held on your MIDI keyboard, as a chord, sampled `steps` times per bar. Try held(4).arp.", cat.io, ([n]) => {
  const s = signal((_t, ctx) => {
    const h = ctx.inputs.held();
    return h.length ? new Chord(h.map((x) => new Pitch(x))) : REST;
  }, "held");
  return segment(Math.round(N(n, 1)), s);
});
var sig = (name, sigStr, doc, f) => def(name, sigStr, doc, cat.gen, ([period]) => {
  const T = N(period, 1);
  return signal((t) => f((t / T % 1 + 1) % 1), `${name}(${T})`);
});
sig("sine", "sine(period: 1)", "A smooth signal from 0 to 1 and back, once per `period` bars.", (x) => 0.5 - 0.5 * Math.cos(2 * Math.PI * x));
sig("tri", "tri(period: 1)", "A triangle signal, 0 up to 1 and back.", (x) => x < 0.5 ? 2 * x : 2 - 2 * x);
sig("saw", "saw(period: 1)", "A ramp from 0 to 1 every `period` bars.", (x) => x);
sig("square", "square(period: 1)", "Alternates between 0 and 1.", (x) => x < 0.5 ? 0 : 1);
def("noise", "noise(rate: 16)", "A seeded random signal holding a new value `rate` times per bar.", cat.gen, ([r], _n, call) => {
  const k = N(r, 16), salt = call.interp.salt();
  return signal((t, ctx) => rand01(ctx.seed, ctx.voice, salt, Math.floor((t + ctx.offset.toNumber()) * k)), "noise");
});
def("drift", "drift(rate: 1)", "A smooth seeded random signal, wandering between 0 and 1.", cat.gen, ([r], _n, call) => {
  const k = N(r, 1), salt = call.interp.salt();
  return signal((t, ctx) => {
    const x = (t + ctx.offset.toNumber()) * k, i = Math.floor(x), f = x - i;
    const a = rand01(ctx.seed, ctx.voice, salt, i), b = rand01(ctx.seed, ctx.voice, salt, i + 1);
    const w = 0.5 - 0.5 * Math.cos(Math.PI * f);
    return a + (b - a) * w;
  }, "drift");
});
def("range", "range(signal, lo, hi)", "Rescale a 0..1 signal or pattern to lo..hi.", cat.gen, ([s, lo, hi]) => {
  const a = N(lo), b = N(hi);
  return mapV(P(s), (v) => isNum(v) ? a + num(v) * (b - a) : v);
});
def("seg", "seg(signal, n)", "Sample a signal n times per bar, turning it into discrete events.", cat.gen, ([s, n]) => segment(N(n), P(s)));
def("run", "run(n)", "The phrase [0 1 2 ... n-1].", cat.gen, ([n]) => list(Array.from({ length: Math.max(0, Math.round(N(n))) }, (_, i) => new R(i))));
def("len", "len(list)", "Number of elements.", cat.list, ([l]) => typeof l === "string" ? new R(l.length) : new R(items(l).length));
def("at", "at(list, i)", "Element i (0-based; wraps around, so negative counts from the end).", cat.list, ([l, i]) => {
  const xs = items(l);
  const k = Math.round(N(i));
  return xs[(k % xs.length + xs.length) % xs.length];
});
def("map", "map(p, f)", "Apply f to every element of a list, or every event of a pattern.", cat.list, ([p, f], _n, call) => {
  if (p instanceof Chord)
    return new Chord(p.notes.map((x) => fnCall(call, f, [x])));
  const q = P(p), salt = call.interp.salt();
  const np = mapEv(q, (ev, ctx) => ev.v instanceof Rest ? ev : { ...ev, v: fnKeyed(call, f, [ev.v], ctx, [ev.s.n, ev.s.d], salt) });
  if (q.items)
    np.items = q.items.map((x) => x instanceof Rest ? x : fnCall(call, f, [x]));
  return np;
});
def("filter", "filter(list, f)", "Keep elements (or events) for which f is true.", cat.list, ([p, f], _n, call) => {
  const q = P(p);
  if (q.items && !q.items.some((x) => x instanceof Pat))
    return list(q.items.filter((x) => truthy(fnCall(call, f, [x]))));
  return filterEv(q, (ev) => truthy(fnCall(call, f, [ev.v])));
});
def("fold", "fold(list, start, f)", "Combine elements left to right: fold([1 2 3], 0, (a, x) => a + x).", cat.list, ([l, s, f], _n, call) => items(l).reduce((acc, x) => fnCall(call, f, [acc, x]), s));
def("concat", "concat(a, b, ...)", "Join lists into one longer list (one bar, more steps).", cat.list, (args) => list(args.flatMap((a) => items(a))));
def("repeat", "repeat(x, n)", "A list of n copies of x.", cat.list, ([x, n]) => list(Array.from({ length: Math.max(0, Math.round(N(n))) }, () => x)));
def("take", "take(list, n)", "The first n elements.", cat.list, ([l, n]) => list(items(l).slice(0, Math.round(N(n)))));
def("drop", "drop(list, n)", "All but the first n elements.", cat.list, ([l, n]) => list(items(l).slice(Math.round(N(n)))));
def("rotate", "rotate(list, n)", "Rotate a list left by n places.", cat.list, ([l, n]) => {
  const xs = items(l), k = (Math.round(N(n)) % xs.length + xs.length) % xs.length;
  return list([...xs.slice(k), ...xs.slice(0, k)]);
});
def("sum", "sum(list)", "Add up the elements.", cat.list, ([l]) => items(l).reduce((a, x) => a instanceof R && x instanceof R ? a.add(x) : num(a) + num(x), new R(0)));
var m1 = (name, f, doc) => def(name, `${name}(x)`, doc, cat.math, ([x]) => {
  if (x instanceof Pat)
    return mapV(x, (v) => isNum(v) ? f(num(v)) : v);
  const r = f(N(x));
  return Number.isInteger(r) && Math.abs(r) < 2 ** 52 ? new R(r) : r;
});
m1("floor", Math.floor, "Round down.");
m1("ceil", Math.ceil, "Round up.");
m1("round", Math.round, "Round to nearest.");
m1("abs", Math.abs, "Absolute value.");
m1("sqrt", Math.sqrt, "Square root.");
m1("sin", Math.sin, "Sine (radians).");
m1("cos", Math.cos, "Cosine (radians).");
m1("log2", Math.log2, "Base-2 logarithm.");
m1("exp", Math.exp, "e to the power x.");
def("min", "min(a, b, ...)", "Smallest value.", cat.math, (args) => args.reduce((a, b) => num(b) < num(a) ? b : a));
def("max", "max(a, b, ...)", "Largest value.", cat.math, (args) => args.reduce((a, b) => num(b) > num(a) ? b : a));
def("clamp", "clamp(x, lo, hi)", "Limit x to the range lo..hi.", cat.math, ([x, lo, hi]) => Math.max(N(lo), Math.min(N(hi), N(x))));
def("lerp", "lerp(a, b, t)", "Linear blend from a to b.", cat.math, ([a, b, t]) => N(a) + (N(b) - N(a)) * N(t));
def("print", "print(x, ...)", "Show values in the console.", cat.misc, (args, _n, call) => {
  call.interp.scene.prints.push(args.map((a) => typeof a === "string" ? a : show(a)).join(" "));
  return args[0] ?? null;
});
def("str", "str(x)", "Text form of a value.", cat.misc, ([x]) => typeof x === "string" ? x : show(x));
def("type", "type(x)", "The name of a value's type.", cat.misc, ([x]) => typeName(x));

// ../../src/core/interp.ts
var MAX_DEPTH = 400;
var INSTRUMENTS = ["keys", "sine", "tri", "saw", "square", "pluck", "bass", "pad", "bell", "organ", "kit", "lead"];

class Interp {
  env;
  scene;
  stream;
  saltBase = 0;
  saltN = 0;
  depth = 0;
  src = "";
  opts;
  sectionStack = [];
  queryCtx = null;
  constructor(opts = {}) {
    this.opts = opts;
    const root = opts.globals ?? Interp.rootEnv();
    this.env = opts.globals ? root : new Env(root);
    const seed = opts.seed ?? 0;
    this.scene = {
      tempo: 120,
      meter: [4, 4],
      seed,
      seedExplicit: false,
      key: DEFAULT_KEY,
      tuningRef: 440,
      voices: new Map,
      sections: new Map,
      form: null,
      prints: [],
      errors: [],
      env: this.env
    };
    this.stream = new Stream([seed, 0]);
  }
  static _root = null;
  static rootEnv() {
    if (Interp._root)
      return Interp._root;
    const env = new Env;
    for (const [k, s] of Object.entries(SCALES))
      env.set(k, s);
    for (const [k, n] of Object.entries(DRUMS))
      env.set(k, new Pitch(n, k));
    for (const i of INSTRUMENTS)
      env.set(i, i);
    env.set("silence", silence);
    env.set("rest", REST);
    env.set("pi", Math.PI);
    registerBuiltins(env);
    Interp._root = env;
    return env;
  }
  run(src, file = "<input>") {
    this.src = src;
    let prog;
    prog = parse(src);
    for (const st of prog.stmts)
      if (st.t === "directive" && st.name === "seed") {
        this.scene.seed = Math.floor(num(this.eval(st.args[0], this.env)));
        this.scene.seedExplicit = true;
      }
    for (const st of prog.stmts) {
      try {
        this.stmt(st, this.env);
      } catch (e) {
        const err = this.wrap(e, st.span);
        if (this.opts.keepGoing)
          this.scene.errors.push(err);
        else
          throw err;
      }
    }
    return this.scene;
  }
  wrap(e, span) {
    if (e instanceof TineError) {
      if (!e.span)
        e.span = span;
      return e;
    }
    if (e instanceof RangeError && /call stack/i.test(e.message))
      return new TineError("runtime", "recursion went too deep", span, "check that recursive functions have a base case");
    const msg = e instanceof Error ? e.message : String(e);
    return new TineError(e instanceof TypeError ? "type" : "runtime", msg, span);
  }
  beginStatement(key) {
    this.saltBase = hashStr(key);
    this.saltN = 0;
    this.stream = new Stream([this.scene.seed, this.saltBase]);
  }
  salt() {
    return this.saltBase + Math.imul(++this.saltN, 2654435761) >>> 0;
  }
  stmt(st, env) {
    const sec = this.sectionStack[this.sectionStack.length - 1];
    switch (st.t) {
      case "let": {
        this.beginStatement(`let:${st.name}`);
        if (st.params) {
          const c = new Closure(st.name, st.params, st.value, env);
          env.set(st.name, c);
          return c;
        }
        const v = this.eval(st.value, env);
        env.set(st.name, v);
        return v;
      }
      case "voice": {
        this.beginStatement(`voice:${st.name}`);
        const v = this.eval(st.value, env);
        const pat = this.asPattern(v, st.value.span);
        const def = { name: st.name, pat, span: st.span, section: sec?.name };
        (sec ? sec.voices : this.scene.voices).set(st.name, def);
        return pat;
      }
      case "directive": {
        this.beginStatement(`directive:${st.name}`);
        const args = st.args.map((a) => this.eval(a, env));
        if (st.name === "tempo") {
          const t = num(args[0]);
          if (!(t > 0 && t < 2000))
            throw new TineError("runtime", "tempo must be between 0 and 2000 BPM", st.span);
          if (sec)
            sec.tempo = t;
          else
            this.scene.tempo = t;
        } else if (st.name === "meter") {
          this.scene.meter = [num(args[0]), num(args[1])];
        } else if (st.name === "key") {
          const k = this.makeKey(args[0], args[1] ?? SCALES.major, st.span);
          if (sec)
            sec.key = k;
          else
            this.scene.key = k;
        } else if (st.name === "seed") {
          this.scene.seed = Math.floor(num(args[0]));
          this.scene.seedExplicit = true;
        } else if (st.name === "tuning") {
          const r = args[0] instanceof Pitch ? args[0].freq() : num(args[0]);
          this.scene.tuningRef = r;
        }
        return null;
      }
      case "section": {
        const bars = num(this.eval(st.bars, env));
        const def = { name: st.name, bars, voices: new Map, span: st.span };
        this.scene.sections.set(st.name, def);
        this.sectionStack.push(def);
        const inner = new Env(env);
        try {
          for (const s of st.body)
            this.stmt(s, inner);
        } finally {
          this.sectionStack.pop();
        }
        return null;
      }
      case "form": {
        this.scene.form = st.items.map((i) => ({ name: i.name, times: i.times }));
        for (const i of st.items)
          if (!this.scene.sections.has(i.name)) {
            throw new TineError("name", `there is no section named '${i.name}'`, i.span, (() => {
              const s = suggest(i.name, this.scene.sections.keys());
              return s ? `did you mean '${s}'?` : "define it with: section name bars";
            })());
          }
        return null;
      }
      case "use": {
        if (!this.opts.readFile)
          throw new TineError("runtime", "'use' is not available here", st.span);
        const src = this.opts.readFile(st.path);
        const sub = new Interp({ ...this.opts, globals: env, seed: this.scene.seed });
        sub.scene = this.scene;
        sub.run(src, st.path);
        return null;
      }
      case "expr": {
        this.beginStatement(`expr:${st.span.start}`);
        return this.eval(st.e, env);
      }
    }
  }
  makeKey(root, scale, span) {
    if (!(root instanceof Pitch))
      throw new TineError("type", `a key needs a root note like d or f#3, got ${typeName(root)}`, span);
    if (!(scale instanceof Scale))
      throw new TineError("type", `a key needs a scale like major or dorian, got ${typeName(scale)}`, span);
    return new Key(root, scale);
  }
  asPattern(v, span) {
    if (v instanceof Pat)
      return v;
    if (v instanceof Pitch || v instanceof Degree || v instanceof Chord || isNum(v) || v instanceof Rest || v instanceof Rec)
      return toPat(v);
    throw new TineError("type", `a voice must be something playable, but this is ${typeName(v)}`, span, "voices take phrases like [c e g], notes, chords or patterns");
  }
  eval(n, env) {
    switch (n.t) {
      case "num": {
        let v = n.float ? n.n / n.d : new R(n.n, n.d);
        if (n.unit === "cents")
          return n.float ? n.n / n.d / 100 : new R(n.n, n.d * 100);
        if (n.unit === "edo")
          return n.float ? n.n / n.d * 12 / n.edo : new R(n.n * 12, n.d * n.edo);
        if (n.unit === "hz")
          return Pitch.fromFreq(n.n / n.d, this.scene.tuningRef);
        return v;
      }
      case "str":
        return n.v;
      case "bool":
        return n.v;
      case "note":
        return parseNote(n.text);
      case "degree":
        return parseDegree(n.text);
      case "rest":
        return REST;
      case "ident": {
        if (env.has(n.name))
          return env.get(n.name);
        const s = suggest(n.name, env.names());
        throw new TineError("name", `'${n.name}' is not defined`, n.span, s ? `did you mean '${s}'?` : undefined);
      }
      case "phrase":
        return this.phrase(n, env);
      case "choice": {
        const opts = n.options.map((o) => toPat(this.eval(o, env)));
        return choice(opts, this.salt());
      }
      case "mod":
        return this.mod(n, env);
      case "record": {
        const f = {};
        for (const x of n.fields)
          f[x.name] = this.eval(x.value, env);
        return new Rec(f);
      }
      case "lambda":
        return new Closure("lambda", n.params, n.body, env);
      case "if":
        return truthy(this.eval(n.c, env)) ? this.eval(n.a, env) : this.eval(n.b, env);
      case "block": {
        const inner = new Env(env);
        for (const s of n.stmts) {
          if (s.t === "let") {
            if (s.params)
              inner.set(s.name, new Closure(s.name, s.params, s.value, inner));
            else
              inner.set(s.name, this.eval(s.value, inner));
          } else if (s.t === "expr")
            this.eval(s.e, inner);
          else
            throw new TineError("syntax", `'${s.t}' is not allowed inside a function body`, s.span);
        }
        return this.eval(n.result, inner);
      }
      case "unary": {
        const v = this.eval(n.e, env);
        if (n.op === "not")
          return liftUnary(v, (x) => !truthy(x));
        return liftUnary(v, (x) => neg(x, n.span));
      }
      case "binary": {
        if (n.op === "and")
          return truthy(this.eval(n.l, env)) ? this.eval(n.r, env) : false;
        if (n.op === "or") {
          const l = this.eval(n.l, env);
          return truthy(l) ? l : this.eval(n.r, env);
        }
        const l = this.eval(n.l, env), r = this.eval(n.r, env);
        if (n.op === "..")
          return rangeSeq(l, r, n.span);
        return binop(n.op, l, r, n.span);
      }
      case "call": {
        const f = this.eval(n.callee, env);
        const args = n.args.map((a) => this.eval(a, env));
        const named = {};
        for (const x of n.named)
          named[x.name] = this.eval(x.value, env);
        return this.call(f, args, named, n.span, n.callee.t === "ident" ? n.callee.name : undefined);
      }
      case "method": {
        const obj = this.eval(n.obj, env);
        if (obj instanceof Rec && n.name in obj.fields) {
          const fv = obj.fields[n.name];
          if (n.args === null)
            return fv;
          return this.call(fv, n.args.map((a) => this.eval(a, env)), {}, n.span, n.name);
        }
        if (!env.has(n.name)) {
          const s = suggest(n.name, env.names());
          throw new TineError("name", `there is no function '${n.name}'`, n.nameSpan, s ? `did you mean '${s}'?` : undefined);
        }
        const f = env.get(n.name);
        const args = (n.args ?? []).map((a) => this.eval(a, env));
        const named = {};
        for (const x of n.named)
          named[x.name] = this.eval(x.value, env);
        return this.call(f, [obj, ...args], named, n.span, n.name);
      }
    }
  }
  call(f, args, named, span, name) {
    if (this.depth > MAX_DEPTH)
      throw new TineError("runtime", "recursion went too deep", span, "check that recursive functions have a base case");
    if (f instanceof Builtin) {
      try {
        return f.impl(args, named, { span, interp: this });
      } catch (e) {
        if (e instanceof TineError) {
          if (!e.span)
            e.span = span;
          throw e;
        }
        if (e instanceof RangeError && /call stack/i.test(e.message))
          throw e;
        throw new TineError(e instanceof TypeError ? "type" : "runtime", `${f.name}: ${e instanceof Error ? e.message : e}`, span, `usage: ${f.sig}`);
      }
    }
    if (f instanceof Closure) {
      const env = new Env(f.env);
      const all = [...args];
      f.params.forEach((p, i) => {
        if (p in named)
          env.set(p, named[p]);
        else if (i < all.length)
          env.set(p, all[i]);
        else
          throw new TineError("type", `${f.name} needs ${f.params.length} argument${f.params.length === 1 ? "" : "s"} (${f.params.join(", ")}) but got ${args.length}`, span);
      });
      if (args.length > f.params.length)
        throw new TineError("type", `${f.name} takes ${f.params.length} argument${f.params.length === 1 ? "" : "s"} but got ${args.length}`, span);
      this.depth++;
      try {
        return this.eval(f.body, env);
      } finally {
        this.depth--;
      }
    }
    if (f instanceof Pat || f instanceof Pitch || isNum(f)) {
      throw new TineError("type", `${name ? `'${name}'` : "this"} is ${typeName(f)}, not a function`, span, f instanceof Pat ? "to put things in sequence, use a phrase: [a b c]" : undefined);
    }
    throw new TineError("type", `${name ? `'${name}'` : "this value"} is ${typeName(f)}, not a function`, span);
  }
  callKeyed(f, args, ctx, bar, salt) {
    const saved = [this.stream, this.saltBase, this.saltN, this.queryCtx];
    const g = bar + ctx.offset.toNumber();
    this.stream = new Stream([ctx.seed, ctx.voice, salt, g]);
    this.saltBase = (salt ^ Math.imul(g + 1, 2246822507)) >>> 0;
    this.saltN = 0;
    this.queryCtx = ctx;
    try {
      return this.call(f, args, {});
    } finally {
      [this.stream, this.saltBase, this.saltN, this.queryCtx] = saved;
    }
  }
  phrase(n, env) {
    if (n.kind === "seq") {
      const children = [];
      const items = [];
      for (const it of n.items) {
        if (it.node.t === "mod" && it.node.kind === "rep") {
          const v = this.eval(it.node.e, env);
          const times = Math.max(0, Math.round(num(this.eval(it.node.arg, env))));
          for (let k = 0;k < times; k++) {
            children.push({ pat: toPat(v), w: R.of(it.weight) });
            items.push(v);
          }
          continue;
        }
        const v = this.eval(it.node, env);
        children.push({ pat: toPat(v), w: R.of(it.weight) });
        items.push(v);
      }
      if (children.length === 0) {
        const p = seq([], []);
        p.items = [];
        return p;
      }
      return seq(children, items);
    }
    const vals = n.items.map((it) => this.eval(it.node, env));
    if (n.kind === "stack") {
      if (vals.every((v) => v instanceof Pitch || v instanceof Degree || isNum(v) || v instanceof Chord)) {
        return new Chord(vals.flatMap((v) => v instanceof Chord ? v.notes : [v]));
      }
      return stack(vals.map(toPat));
    }
    return alt(vals.map(toPat));
  }
  mod(n, env) {
    const v = this.eval(n.e, env);
    switch (n.kind) {
      case "fast":
        return fast(R.of(num(this.eval(n.arg, env))), toPat(v));
      case "chance": {
        const p = n.arg ? num(this.eval(n.arg, env)) : 0.5;
        return degrade(1 - p, this.salt(), toPat(v));
      }
      case "chord": {
        const q = n.arg.t === "str" ? n.arg.v : String(num(this.eval(n.arg, env)));
        try {
          return liftUnary(v, (x) => makeChord(x, q));
        } catch (e) {
          throw new TineError("type", e.message, n.span);
        }
      }
      case "rep":
        return v;
    }
  }
}
function liftUnary(v, f) {
  if (v instanceof Pat)
    return mapV(v, (x) => x instanceof Rest ? x : f(x));
  if (v instanceof Chord)
    return new Chord(v.notes.map(f));
  return f(v);
}
function neg(x, span) {
  if (x instanceof R)
    return x.neg();
  if (typeof x === "number")
    return -x;
  throw new TineError("type", `cannot negate ${typeName(x)}`, span);
}
function arith(op, a, b) {
  if (a instanceof R && b instanceof R) {
    switch (op) {
      case "+":
        return a.add(b);
      case "-":
        return a.sub(b);
      case "*":
        return a.mul(b);
      case "/":
        if (b.n === 0)
          throw new Error("division by zero");
        return a.div(b);
      case "%": {
        const q = a.div(b).floor();
        return a.sub(b.mul(new R(q)));
      }
      case "**":
        if (b.isInt() && Math.abs(b.n) < 64) {
          let r = ONE;
          const base = b.n < 0 ? ONE.div(a) : a;
          for (let i = 0;i < Math.abs(b.n); i++)
            r = r.mul(base);
          return r;
        }
    }
  }
  const x = num(a), y = num(b);
  switch (op) {
    case "+":
      return x + y;
    case "-":
      return x - y;
    case "*":
      return x * y;
    case "/":
      if (y === 0)
        throw new Error("division by zero");
      return x / y;
    case "%":
      return (x % y + y) % y;
    case "**":
      return Math.pow(x, y);
  }
  throw new Error(`unknown operator ${op}`);
}
function compare(op, a, b) {
  if (op === "==")
    return equal(a, b);
  if (op === "!=")
    return !equal(a, b);
  let x, y;
  if (typeof a === "string" && typeof b === "string") {
    x = a < b ? -1 : a > b ? 1 : 0;
    y = 0;
  } else {
    x = a instanceof Pitch ? a.semi : num(a);
    y = b instanceof Pitch ? b.semi : num(b);
  }
  switch (op) {
    case "<":
      return x < y;
    case ">":
      return x > y;
    case "<=":
      return x <= y;
    case ">=":
      return x >= y;
  }
  return false;
}
function equal(a, b) {
  if (isNum(a) && isNum(b))
    return Math.abs(num(a) - num(b)) < 0.000000000001;
  if (a instanceof Pitch && b instanceof Pitch)
    return Math.abs(a.semi - b.semi) < 0.000000001;
  if (a instanceof Degree && b instanceof Degree)
    return a.deg === b.deg && a.acc === b.acc && a.shift === b.shift;
  return a === b;
}
function scalar(op, a, b, span) {
  if (a instanceof Rest || b instanceof Rest)
    return REST;
  if (["==", "!=", "<", ">", "<=", ">="].includes(op))
    return compare(op, a, b);
  if (a instanceof Chord)
    return new Chord(a.notes.map((x) => scalar(op, x, b, span)));
  if (b instanceof Chord && isNum(a))
    return new Chord(b.notes.map((x) => scalar(op, a, x, span)));
  if (a instanceof Pitch) {
    if (isNum(b)) {
      if (op === "+")
        return new Pitch(a.semi + num(b));
      if (op === "-")
        return new Pitch(a.semi - num(b));
      if (op === "*")
        return new Pitch(a.semi + 12 * Math.log2(num(b)));
      if (op === "/")
        return new Pitch(a.semi - 12 * Math.log2(num(b)));
    }
    if (b instanceof Pitch && op === "-")
      return a.semi - b.semi;
    throw new TineError("type", `cannot ${opWord(op)} a pitch and ${typeName(b)}`, span, "pitch + n moves by semitones, pitch * 3/2 moves by a frequency ratio");
  }
  if (b instanceof Pitch && isNum(a) && op === "+")
    return new Pitch(b.semi + num(a));
  if (a instanceof Degree) {
    if (isNum(b) && (op === "+" || op === "-")) {
      const k = num(b);
      if (!Number.isInteger(k))
        throw new TineError("type", "scale degrees move in whole steps", span, "use .transpose(x) to move by a fractional number of semitones");
      return new Degree(a.deg, a.acc, a.shift + (op === "+" ? k : -k));
    }
    throw new TineError("type", `cannot ${opWord(op)} a degree and ${typeName(b)}`, span, "^1 + 2 moves up two scale steps");
  }
  if (b instanceof Degree && isNum(a) && op === "+")
    return scalar(op, b, a, span);
  if (typeof a === "string" && op === "+")
    return a + (typeof b === "string" ? b : show(b));
  if (isNum(a) && isNum(b))
    return arith(op, a, b);
  throw new TineError("type", `cannot ${opWord(op)} ${typeName(a)} and ${typeName(b)}`, span);
}
function opWord(op) {
  return { "+": "add", "-": "subtract", "*": "multiply", "/": "divide", "%": "take the remainder of", "**": "raise" }[op] ?? `apply '${op}' to`;
}
function binop(op, l, r, span) {
  if (l instanceof Pat && r instanceof Pat) {
    const np = new Pat((a, b, ctx) => l.query(a, b, ctx).map((ev) => ({ ...ev, v: scalar(op, ev.v, sampleAt(r, ev.s, ctx), span) })));
    return np;
  }
  if (l instanceof Pat && isNum(r) && (op === "*" || op === "/")) {
    const k = r instanceof R ? r : R.of(num(r));
    if (k.n === 0)
      throw new TineError("runtime", op === "*" ? "a pattern repeated 0 times is silence; use silence instead" : "division by zero", span);
    return fast(op === "*" ? k : ONE.div(k), l);
  }
  if (l instanceof Pat)
    return mapV(l, (x) => scalar(op, x, r, span));
  if (r instanceof Pat)
    return mapV(r, (x) => scalar(op, l, x, span));
  return scalar(op, l, r, span);
}
function rangeSeq(l, r, span) {
  const a = num(l), b = num(r);
  if (!Number.isInteger(a) || !Number.isInteger(b))
    throw new TineError("type", "ranges use whole numbers, like 0..7", span);
  if (Math.abs(b - a) > 1e4)
    throw new TineError("runtime", "range is too large", span);
  const vals = [];
  if (a <= b)
    for (let i = a;i <= b; i++)
      vals.push(new R(i));
  else
    for (let i = a;i >= b; i--)
      vals.push(new R(i));
  return toPat(vals);
}
function evaluate(src, opts = {}) {
  const it = new Interp(opts);
  return it.run(src);
}
// ../../src/core/scene.ts
function barSeconds(scene, tempo = scene.tempo) {
  return scene.meter[0] * 60 / tempo;
}
function timeline(scene) {
  const segs = [];
  let bar = 0, sec = 0;
  for (const item of scene.form ?? []) {
    const s = scene.sections.get(item.name);
    if (!s)
      continue;
    for (let k = 0;k < item.times; k++) {
      const tempo = s.tempo ?? scene.tempo;
      segs.push({ section: s, startBar: bar, bars: s.bars, tempo, startSec: sec, key: s.key ?? scene.key });
      bar += s.bars;
      sec += s.bars * barSeconds(scene, tempo);
    }
  }
  return { segments: segs, bars: bar, seconds: sec };
}
function queryVoice(v, a, b, ctx, opts) {
  if (opts.muted?.has(v.name))
    return [];
  try {
    return resolveNotes(v.name, v.pat.query(a, b, ctx), ctx);
  } catch (e) {
    if (opts.onError) {
      opts.onError(v.name, e);
      return [];
    }
    throw e instanceof TineError ? e : new TineError("runtime", `in voice '${v.name}': ${e.message}`, v.span);
  }
}
function finish(scene, n, offsetBar, offsetSec, tempo, section) {
  const bs = barSeconds(scene, tempo);
  const local = n.start.toNumber();
  let bars = n.dur.toNumber();
  if (n.params.durBeats !== undefined)
    bars = Number(n.params.durBeats) / scene.meter[0];
  const params = { ...n.params };
  delete params.durBeats;
  return { voice: n.voice, bar: offsetBar + local, bars, time: offsetSec + local * bs, durSec: bars * bs, semi: n.semi, vel: n.vel, params, section };
}
function liveNotes(scene, a, b, opts = {}) {
  const out = [];
  const A = R.approx(a), B = R.approx(b);
  const inputs = opts.inputs ?? NO_INPUTS;
  const sec = opts.section ? scene.sections.get(opts.section) : undefined;
  const voices = new Map(scene.voices);
  if (sec)
    for (const [k, v] of sec.voices)
      voices.set(k, v);
  const key = sec?.key ?? scene.key;
  const tempo = sec?.tempo ?? scene.tempo;
  for (const v of voices.values()) {
    const inSec = v.section !== undefined;
    const off = inSec ? opts.sectionStart ?? 0 : 0;
    const ctx = makeCtx(scene.seed, hashStr(v.name), key, R.approx(off), inputs);
    const offR = R.approx(off);
    for (const n of queryVoice(v, A.sub(offR), B.sub(offR), ctx, opts))
      out.push(finish(scene, n, off, off * barSeconds(scene, tempo), tempo, v.section));
  }
  return out.sort((x, y) => x.bar - y.bar);
}
function formNotes(scene, a, b, opts = {}) {
  const { segments } = timeline(scene);
  const out = [];
  const inputs = opts.inputs ?? NO_INPUTS;
  for (const seg of segments) {
    const s0 = Math.max(a, seg.startBar), s1 = Math.min(b, seg.startBar + seg.bars);
    if (s0 >= s1)
      continue;
    const voices = new Map(scene.voices);
    for (const [k, v] of seg.section.voices)
      voices.set(k, v);
    for (const v of voices.values()) {
      const ctx = makeCtx(scene.seed, hashStr(v.name), seg.key, new R(seg.startBar), inputs);
      const lo = R.approx(s0 - seg.startBar), hi = R.approx(s1 - seg.startBar);
      for (const n of queryVoice(v, lo, hi, ctx, opts))
        out.push(finish(scene, n, seg.startBar, seg.startSec, seg.tempo, seg.section.name));
    }
  }
  return out.sort((x, y) => x.bar - y.bar);
}
function renderNotes(scene, bars, opts = {}) {
  if (scene.form && scene.form.length) {
    const tl = timeline(scene);
    const n = bars ?? tl.bars;
    return { notes: formNotes(scene, 0, n, opts), seconds: tl.seconds * (n / tl.bars), bars: n };
  }
  const n = bars ?? 8;
  return { notes: liveNotes(scene, 0, n, opts), seconds: n * barSeconds(scene), bars: n };
}
// ../../src/core/synth.ts
var INSTRUMENT_DOCS = {
  keys: "Electric piano: FM tines, warm and bell-like. The default.",
  sine: "Pure sine wave.",
  tri: "Triangle wave, soft and hollow.",
  saw: "Sawtooth through a low-pass filter, bright.",
  square: "Square wave, reedy.",
  pluck: "Plucked string (Karplus-Strong).",
  bass: "Saw-and-sub bass with a filter envelope.",
  pad: "Three detuned saws, slow attack, wide.",
  bell: "FM bell with a long ring.",
  organ: "Drawbar-style additive organ.",
  lead: "Detuned square and saw lead.",
  kit: "Drum kit: plays General MIDI drum note numbers (kick, snare, hat, ...)."
};
// ../../src/core/docs.ts
var builtins = new Map(builtinList().map((b) => [b.name, b]));
function describeWord(word) {
  const b = builtins.get(word);
  if (b)
    return `${b.sig}
${b.doc}`;
  if (NOTE_RE.test(word)) {
    const p = parseNote(word);
    return `note ${pitchName(p.semi)}: MIDI ${p.semi}, ${p.freq().toFixed(2)} Hz`;
  }
  if (word in DRUMS)
    return `drum ${word}: General MIDI note ${DRUMS[word]}`;
  if (word in SCALES)
    return `scale ${word}: ${SCALES[word].steps.map((x) => Math.round(x * 100) / 100).join(" ")} (period ${Math.round(SCALES[word].period * 100) / 100})`;
  if (word in CHORDS)
    return `chord quality ${word}: ${CHORDS[word].map((x) => Math.round(x * 100) / 100).join(" ")} semitones`;
  if (INSTRUMENTS.includes(word))
    return `instrument ${word}: ${INSTRUMENT_DOCS[word] ?? ""}`;
  const k = {
    voice: `voice name = pattern
A named part that loops (or plays in sections).`,
    let: `let name = value  /  let f(x) = body
Define a value or a function.`,
    section: `section name bars
An indented block of voices lasting that many bars.`,
    form: `form a b*2 c
Play sections in order: a finished piece.`,
    tempo: `tempo bpm
Beats (the meter's denominator) per minute.`,
    key: `key root scale
The key that degrees like ^3 resolve against.`,
    seed: `seed n
Freeze all randomness so the piece replays exactly.`,
    meter: `meter 7/8
Beats per bar and beat unit.`,
    tuning: `tuning 432
Frequency of A4 in Hz.`
  };
  return k[word] ?? null;
}
// ../../src/lsp/server.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var import_node_url = require("node:url");
var docs2 = new Map;
var builtins3 = new Map(builtinList().map((b) => [b.name, b]));
function send(msg) {
  const body = JSON.stringify({ jsonrpc: "2.0", ...msg });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r
\r
${body}`);
}
function offsetToPos(src, off) {
  let line = 0, last = 0;
  for (let i = 0;i < off && i < src.length; i++)
    if (src[i] === `
`) {
      line++;
      last = i + 1;
    }
  return { line, character: Math.max(0, Math.min(off, src.length) - last) };
}
function posToOffset(src, p) {
  let line = 0, i = 0;
  while (line < p.line && i < src.length) {
    if (src[i] === `
`)
      line++;
    i++;
  }
  return Math.min(src.length, i + p.character);
}
var range = (src, s) => ({ start: offsetToPos(src, s.start), end: offsetToPos(src, Math.max(s.end, s.start + 1)) });
function readerFor(uri) {
  try {
    const dir = import_node_path.dirname(import_node_url.fileURLToPath(uri));
    return (p) => import_node_fs.readFileSync(import_node_path.resolve(dir, p), "utf8");
  } catch {
    return;
  }
}
function diagnose(uri) {
  const src = docs2.get(uri) ?? "";
  const diags = [];
  const add = (e, severity = 1) => diags.push({ range: range(src, e.span ?? { start: 0, end: 1 }), severity, source: "tine", message: e.message + (e.hint ? `
${e.hint}` : ""), code: e.kind });
  try {
    const scene = evaluate(src, { seed: 1, keepGoing: true, readFile: readerFor(uri) });
    for (const e of scene.errors)
      add(e);
    if (!scene.errors.length) {
      try {
        renderNotes(scene, scene.form ? undefined : 2, { onError: (v, e) => add(new TineError("runtime", `voice ${v}: ${e.message}`, scene.voices.get(v)?.span ?? [...scene.sections.values()].find((s) => s.voices.has(v))?.voices.get(v)?.span)) });
      } catch (e) {
        if (e instanceof TineError)
          add(e);
      }
    }
  } catch (e) {
    if (e instanceof TineError)
      add(e);
    else
      diags.push({ range: range(src, { start: 0, end: 1 }), severity: 1, source: "tine", message: String(e.message) });
  }
  send({ method: "textDocument/publishDiagnostics", params: { uri, diagnostics: diags } });
}
function wordAt(src, off) {
  let s = off, e = off;
  while (s > 0 && /[A-Za-z0-9_#^]/.test(src[s - 1]))
    s--;
  while (e < src.length && /[A-Za-z0-9_#]/.test(src[e]))
    e++;
  return { word: src.slice(s, e), start: s, end: e };
}
function definitions(src) {
  let prog;
  try {
    prog = parse(src);
  } catch {
    return [];
  }
  const walk = (stmts) => stmts.flatMap((st) => {
    if (st.t === "let")
      return [{ name: st.name, kind: st.params ? "fn" : "let", span: st.span, nameSpan: st.nameSpan, detail: st.params ? `let ${st.name}(${st.params.join(", ")})` : `let ${st.name}` }];
    if (st.t === "voice")
      return [{ name: st.name, kind: "voice", span: st.span, nameSpan: st.nameSpan, detail: `voice ${st.name}` }];
    if (st.t === "section")
      return [{ name: st.name, kind: "section", span: { start: st.span.start, end: endOfBlock(st) }, nameSpan: st.nameSpan, detail: `section ${st.name}`, children: walk(st.body) }];
    return [];
  });
  const endOfBlock = (st) => st.body.length ? st.body[st.body.length - 1].span.end : st.span.end;
  return walk(prog.stmts);
}
function hover(uri, p) {
  const src = docs2.get(uri) ?? "";
  const off = posToOffset(src, p);
  const { word, start, end } = wordAt(src, off);
  if (!word)
    return null;
  let text = describeWord(word);
  if (!text && word.startsWith("^")) {
    try {
      const keyLine = src.slice(0, start).match(/^\s*key\s+(.+)$/gm)?.pop();
      const s = evaluate(`${keyLine ?? ""}
voice probe = ${word}`, { seed: 1 });
      const n = renderNotes(s, 1).notes[0];
      text = `scale degree ${word}${n ? ` = MIDI ${Math.round(n.semi * 100) / 100} in ${s.key}` : ""}`;
    } catch {
      text = `scale degree ${word}`;
    }
  }
  if (!text) {
    const d = flat(definitions(src)).find((x) => x.name === word);
    if (d) {
      text = d.detail;
      if (d.kind === "voice") {
        try {
          const s = evaluate(src, { seed: 1, keepGoing: true, readFile: readerFor(uri) });
          const ns = renderNotes({ ...s, form: null }, 1).notes.filter((n) => n.voice === word);
          text += `
${ns.length} note${ns.length === 1 ? "" : "s"} in bar 1`;
        } catch {}
      }
    }
  }
  if (!text)
    return null;
  return { contents: { kind: "markdown", value: "```tine\n" + text.split(`
`)[0] + "\n```\n" + text.split(`
`).slice(1).join(`
`) }, range: range(src, { start, end }) };
}
var flat = (ds) => ds.flatMap((d) => [d, ...flat(d.children ?? [])]);
function completion(uri, p) {
  const src = docs2.get(uri) ?? "";
  const off = posToOffset(src, p);
  const before = src.slice(Math.max(0, off - 40), off);
  const items = [];
  if (/@[A-Za-z0-9]*$/.test(before)) {
    for (const q of Object.keys(CHORDS))
      items.push({ label: q, kind: 12, detail: `chord ${CHORDS[q].map((x) => Math.round(x * 100) / 100).join(" ")}` });
    for (const q of ["3", "7", "9", "11", "13"])
      items.push({ label: q, kind: 12, detail: "diatonic chord on a degree" });
    return items;
  }
  const afterDot = /\.[A-Za-z_]*$/.test(before);
  for (const b of builtinList())
    items.push({ label: b.name, kind: 3, detail: b.sig, documentation: b.doc, insertText: b.name });
  for (const d of flat(definitions(src)))
    if (d.kind === "fn" || d.kind === "let")
      items.push({ label: d.name, kind: d.kind === "fn" ? 3 : 6, detail: d.detail });
  if (!afterDot) {
    for (const k of KEYWORDS)
      items.push({ label: k, kind: 14 });
    for (const s of Object.keys(SCALES))
      items.push({ label: s, kind: 7, detail: "scale" });
    for (const d of Object.keys(DRUMS))
      items.push({ label: d, kind: 21, detail: `drum (MIDI ${DRUMS[d]})` });
    for (const i of INSTRUMENTS)
      items.push({ label: i, kind: 7, detail: "instrument" });
  }
  return items;
}
function signature(uri, p) {
  const src = docs2.get(uri) ?? "";
  let off = posToOffset(src, p) - 1;
  let depth = 0, commas = 0;
  for (;off >= 0; off--) {
    const c = src[off];
    if (c === ")" || c === "]" || c === "}")
      depth++;
    else if (c === "(" || c === "[" || c === "{") {
      if (depth === 0)
        break;
      depth--;
    } else if (c === "," && depth === 0)
      commas++;
    else if (c === `
` && depth === 0 && !/^\s/.test(src.slice(off + 1)))
      return null;
  }
  if (off < 0 || src[off] !== "(")
    return null;
  const m = src.slice(0, off).match(/(\.)?([A-Za-z_][A-Za-z0-9_]*)$/);
  if (!m)
    return null;
  const b = builtins3.get(m[2]);
  let label, doc = "";
  if (b) {
    label = b.sig;
    doc = b.doc;
  } else {
    const d = flat(definitions(src)).find((x) => x.name === m[2] && x.kind === "fn");
    if (!d)
      return null;
    label = d.detail.replace(/^let /, "");
  }
  const params = (label.match(/\((.*)\)/)?.[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const active = m[1] ? commas + 1 : commas;
  return { signatures: [{ label, documentation: doc, parameters: params.map((x) => ({ label: x })) }], activeSignature: 0, activeParameter: Math.min(active, Math.max(0, params.length - 1)) };
}
function definition(uri, p) {
  const src = docs2.get(uri) ?? "";
  const { word } = wordAt(src, posToOffset(src, p));
  const d = flat(definitions(src)).find((x) => x.name === word);
  return d ? { uri, range: range(src, d.nameSpan) } : null;
}
function symbols(uri) {
  const src = docs2.get(uri) ?? "";
  const conv = (d) => ({
    name: d.name,
    detail: d.detail,
    kind: d.kind === "fn" ? 12 : d.kind === "let" ? 13 : d.kind === "voice" ? 24 : 3,
    range: range(src, d.span),
    selectionRange: range(src, d.nameSpan),
    children: (d.children ?? []).map(conv)
  });
  return definitions(src).map(conv);
}
function format(src) {
  const lines = src.replace(/\r\n/g, `
`).split(`
`).map((l) => l.replace(/\t/g, "  ").replace(/\s+$/, ""));
  const out = [];
  for (const l of lines) {
    if (l === "" && out[out.length - 1] === "")
      continue;
    out.push(l);
  }
  while (out.length && out[out.length - 1] === "")
    out.pop();
  return out.join(`
`) + `
`;
}
function semanticLegend() {
  return { tokenTypes: ["keyword", "number", "string", "function", "variable", "enumMember", "operator", "comment", "type", "parameter"], tokenModifiers: [] };
}
function semanticTokens(src) {
  let toks;
  try {
    toks = lex(src);
  } catch {
    return { data: [] };
  }
  const data = [];
  let pl = 0, pc = 0;
  for (const t of toks) {
    let type = -1;
    if (t.type === "kw")
      type = 0;
    else if (t.type === "num")
      type = 1;
    else if (t.type === "str")
      type = 2;
    else if (t.type === "note" || t.type === "degree")
      type = 5;
    else if (t.type === "ident")
      type = builtins3.has(t.text) ? 3 : (t.text in DRUMS) ? 5 : (t.text in SCALES) || INSTRUMENTS.includes(t.text) ? 8 : 4;
    if (type < 0 || t.end <= t.start)
      continue;
    const p = offsetToPos(src, t.start);
    data.push(p.line - pl, p.line === pl ? p.character - pc : p.character, t.end - t.start, type, 0);
    pl = p.line;
    pc = p.character;
  }
  return { data };
}
function startServer() {
  let buf = Buffer.alloc(0);
  const timers = new Map;
  const schedule = (uri) => {
    clearTimeout(timers.get(uri));
    timers.set(uri, setTimeout(() => diagnose(uri), 180));
  };
  process.stdin.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;; ) {
      const sep = buf.indexOf(`\r
\r
`);
      if (sep < 0)
        return;
      const m = buf.subarray(0, sep).toString().match(/Content-Length:\s*(\d+)/i);
      if (!m) {
        buf = buf.subarray(sep + 4);
        continue;
      }
      const len = parseInt(m[1], 10);
      if (buf.length < sep + 4 + len)
        return;
      const msg = JSON.parse(buf.subarray(sep + 4, sep + 4 + len).toString("utf8"));
      buf = buf.subarray(sep + 4 + len);
      handle(msg);
    }
  });
  const handle = (msg) => {
    const reply = (result) => send({ id: msg.id, result });
    const P = msg.params ?? {};
    try {
      switch (msg.method) {
        case "initialize":
          return reply({
            capabilities: {
              textDocumentSync: 1,
              completionProvider: { triggerCharacters: [".", "@", "^"] },
              hoverProvider: true,
              signatureHelpProvider: { triggerCharacters: ["(", ","] },
              definitionProvider: true,
              documentSymbolProvider: true,
              documentFormattingProvider: true,
              semanticTokensProvider: { legend: semanticLegend(), full: true }
            },
            serverInfo: { name: "tine-lsp", version: "1.0.0" }
          });
        case "initialized":
          return;
        case "shutdown":
          return reply(null);
        case "exit":
          process.exit(0);
        case "textDocument/didOpen":
          docs2.set(P.textDocument.uri, P.textDocument.text);
          schedule(P.textDocument.uri);
          return;
        case "textDocument/didChange":
          docs2.set(P.textDocument.uri, P.contentChanges[P.contentChanges.length - 1].text);
          schedule(P.textDocument.uri);
          return;
        case "textDocument/didClose":
          docs2.delete(P.textDocument.uri);
          send({ method: "textDocument/publishDiagnostics", params: { uri: P.textDocument.uri, diagnostics: [] } });
          return;
        case "textDocument/hover":
          return reply(hover(P.textDocument.uri, P.position));
        case "textDocument/completion":
          return reply(completion(P.textDocument.uri, P.position));
        case "textDocument/signatureHelp":
          return reply(signature(P.textDocument.uri, P.position));
        case "textDocument/definition":
          return reply(definition(P.textDocument.uri, P.position));
        case "textDocument/documentSymbol":
          return reply(symbols(P.textDocument.uri));
        case "textDocument/semanticTokens/full":
          return reply(semanticTokens(docs2.get(P.textDocument.uri) ?? ""));
        case "textDocument/formatting": {
          const src = docs2.get(P.textDocument.uri) ?? "";
          const out = format(src);
          if (out === src)
            return reply([]);
          return reply([{ range: { start: { line: 0, character: 0 }, end: offsetToPos(src, src.length) }, newText: out }]);
        }
        default:
          if (msg.id !== undefined)
            send({ id: msg.id, error: { code: -32601, message: `unhandled ${msg.method}` } });
      }
    } catch (e) {
      if (msg.id !== undefined)
        send({ id: msg.id, error: { code: -32603, message: String(e.message) } });
    }
  };
}

// ../../src/lsp/entry.ts
startServer();
