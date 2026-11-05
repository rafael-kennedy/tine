import { lex, Token } from "./lexer";
import { TineError, Span } from "./errors";

// ---------- AST ----------
export type Node =
  | { t: "num"; n: number; d: number; float: boolean; unit?: "cents" | "edo" | "hz"; edo?: number; span: Span }
  | { t: "str"; v: string; span: Span }
  | { t: "bool"; v: boolean; span: Span }
  | { t: "note"; text: string; span: Span }
  | { t: "degree"; text: string; span: Span }
  | { t: "ident"; name: string; span: Span }
  | { t: "rest"; span: Span }
  | { t: "phrase"; kind: "seq" | "stack" | "alt"; items: PItem[]; span: Span }
  | { t: "choice"; options: Node[]; span: Span }
  | { t: "call"; callee: Node; args: Node[]; named: { name: string; value: Node }[]; span: Span }
  | { t: "method"; obj: Node; name: string; args: Node[] | null; named: { name: string; value: Node }[]; span: Span; nameSpan: Span }
  | { t: "binary"; op: string; l: Node; r: Node; span: Span }
  | { t: "unary"; op: string; e: Node; span: Span }
  | { t: "lambda"; params: string[]; body: Node; span: Span }
  | { t: "if"; c: Node; a: Node; b: Node; span: Span }
  | { t: "record"; fields: { name: string; value: Node }[]; span: Span }
  | { t: "block"; stmts: Stmt[]; result: Node; span: Span }
  | { t: "mod"; kind: "fast" | "weight" | "chance" | "chord" | "rep"; e: Node; arg: Node | null; span: Span };

// A phrase item: a node plus its relative length (weight) in the phrase.
export interface PItem { node: Node; weight: number; span: Span }

export type Stmt =
  | { t: "let"; name: string; params: string[] | null; value: Node; span: Span; nameSpan: Span; doc?: string }
  | { t: "voice"; name: string; value: Node; span: Span; nameSpan: Span }
  | { t: "directive"; name: "tempo" | "meter" | "key" | "seed" | "tuning"; args: Node[]; span: Span }
  | { t: "section"; name: string; bars: Node; body: Stmt[]; span: Span; nameSpan: Span }
  | { t: "form"; items: { name: string; times: number; span: Span }[]; span: Span }
  | { t: "use"; path: string; span: Span }
  | { t: "expr"; e: Node; span: Span };

export interface Program { stmts: Stmt[]; src: string }

const sp = (a: Span, b: Span): Span => ({ start: a.start, end: b.end });

export function parse(src: string): Program {
  const p = new Parser(src, lex(src));
  return { stmts: p.program(), src };
}

class Parser {
  i = 0;
  constructor(public src: string, public toks: Token[]) {}

  get tok() { return this.toks[this.i]; }
  peek(k = 1) { return this.toks[Math.min(this.i + k, this.toks.length - 1)]; }
  isOp(text: string, t = this.tok) { return t.type === "op" && t.text === text; }
  isKw(text: string, t = this.tok) { return t.type === "kw" && t.text === text; }
  next() { return this.toks[this.i++]; }
  spanOf(t: Token): Span { return { start: t.start, end: t.end }; }
  err(msg: string, t: Token = this.tok, hint?: string): never {
    const span = t.type === "eof" || t.type === "newline" ? { start: Math.max(0, t.start - 1), end: t.start } : this.spanOf(t);
    throw new TineError("syntax", msg, span, hint);
  }
  expectOp(text: string, hint?: string) {
    if (!this.isOp(text)) this.err(`expected '${text}' but found ${this.describe(this.tok)}`, this.tok, hint);
    return this.next();
  }
  describe(t: Token) {
    if (t.type === "eof") return "end of input";
    if (t.type === "newline") return "end of line";
    if (t.type === "indent") return "an indented block";
    if (t.type === "dedent") return "end of block";
    return `'${t.text}'`;
  }
  skipNewlines() { while (this.tok.type === "newline") this.next(); }

  program(): Stmt[] {
    const out: Stmt[] = [];
    this.skipNewlines();
    while (this.tok.type !== "eof") {
      if (this.tok.type === "indent") this.err("unexpected indentation", this.tok, "only bodies of let, voice and section are indented");
      out.push(this.statement());
      this.endStatement();
    }
    return out;
  }

  endStatement() {
    if (this.tok.type === "newline") { this.skipNewlines(); return; }
    if (this.tok.type === "eof" || this.tok.type === "dedent") return;
    if (this.toks[this.i - 1]?.type === "dedent") return; // a block body just ended
    this.err(`unexpected ${this.describe(this.tok)}`, this.tok, "each statement goes on its own line");
  }

  block(): Stmt[] {
    // expects newline already consumed and an indent token
    if (this.tok.type !== "indent") this.err("expected an indented block");
    this.next();
    const out: Stmt[] = [];
    while (this.tok.type !== "dedent" && this.tok.type !== "eof") {
      out.push(this.statement());
      this.endStatement();
    }
    if (this.tok.type === "dedent") this.next();
    return out;
  }

  // value after '=': either an expression on the same line, or an indented block
  valueOrBlock(): Node {
    if (this.tok.type === "newline" && this.peek().type === "indent") {
      const startTok = this.tok;
      this.next();
      const stmts = this.block();
      const last = stmts[stmts.length - 1];
      if (!last || last.t !== "expr") throw new TineError("syntax", "a block must end with an expression (its value)", this.spanOf(startTok));
      stmts.pop();
      return { t: "block", stmts, result: last.e, span: { start: startTok.start, end: last.span.end } };
    }
    return this.expr();
  }

  statement(): Stmt {
    const t = this.tok;
    if (this.isKw("let")) {
      this.next();
      const nameTok = this.tok;
      if (nameTok.type !== "ident") this.err(nameTok.type === "note" ? `'${nameTok.text}' is a note name and cannot be used as a variable` : "expected a name after 'let'", nameTok);
      this.next();
      let params: string[] | null = null;
      if (this.isOp("(")) params = this.paramList();
      this.expectOp("=");
      const value = this.valueOrBlock();
      return { t: "let", name: nameTok.text, params, value, span: sp(this.spanOf(t), value.span), nameSpan: this.spanOf(nameTok) };
    }
    if (this.isKw("voice")) {
      this.next();
      const nameTok = this.tok;
      // voice names live in their own namespace, so even note-like names are fine
      if (nameTok.type !== "ident" && nameTok.type !== "note") this.err("expected a voice name", nameTok);
      this.next();
      this.expectOp("=");
      const value = this.valueOrBlock();
      return { t: "voice", name: nameTok.text, value, span: sp(this.spanOf(t), value.span), nameSpan: this.spanOf(nameTok) };
    }
    if (t.type === "kw" && ["tempo", "seed", "tuning"].includes(t.text) && !this.isOp("(", this.peek())) {
      this.next();
      const e = this.expr();
      return { t: "directive", name: t.text as any, args: [e], span: sp(this.spanOf(t), e.span) };
    }
    if (this.isKw("meter")) {
      this.next();
      const a = this.tok; if (a.type !== "num") this.err("meter is written like 4/4 or 7/8");
      this.next(); this.expectOp("/");
      const b = this.tok; if (b.type !== "num") this.err("meter is written like 4/4 or 7/8");
      this.next();
      return { t: "directive", name: "meter", args: [this.numNode(a), this.numNode(b)], span: sp(this.spanOf(t), this.spanOf(b)) };
    }
    if (this.isKw("key") && !this.isOp("(", this.peek())) {
      this.next();
      const root = this.unary();
      const args = [root];
      if (this.tok.type !== "newline" && this.tok.type !== "eof" && this.tok.type !== "dedent") args.push(this.expr());
      return { t: "directive", name: "key", args, span: sp(this.spanOf(t), args[args.length - 1].span) };
    }
    if (this.isKw("section")) {
      this.next();
      const nameTok = this.tok;
      if (nameTok.type !== "ident") this.err("expected a section name", nameTok);
      this.next();
      const bars = this.unary();
      if (this.tok.type === "ident" && (this.tok.text === "bars" || this.tok.text === "bar")) this.next();
      if (this.tok.type !== "newline") this.err("expected the section body on the following indented lines");
      this.next();
      const body = this.block();
      return { t: "section", name: nameTok.text, bars, body, span: sp(this.spanOf(t), this.spanOf(nameTok)), nameSpan: this.spanOf(nameTok) };
    }
    if (this.isKw("form")) {
      this.next();
      const items: { name: string; times: number; span: Span }[] = [];
      while (this.tok.type === "ident") {
        const n = this.next();
        let times = 1;
        if (this.isOp("*")) { this.next(); const c = this.tok; if (c.type !== "num") this.err("expected a repeat count after '*'"); this.next(); times = c.num!.n / c.num!.d; }
        items.push({ name: n.text, times, span: this.spanOf(n) });
      }
      if (!items.length) this.err("form lists section names in order, like: form intro verse*2 chorus");
      return { t: "form", items, span: sp(this.spanOf(t), items[items.length - 1].span) };
    }
    if (this.isKw("use")) {
      this.next();
      const s = this.tok; if (s.type !== "str") this.err('use expects a file path in quotes, like use "drums.tine"');
      this.next();
      return { t: "use", path: s.text, span: sp(this.spanOf(t), this.spanOf(s)) };
    }
    const e = this.expr();
    if (this.isOp("=") ) this.err("to define a name, write 'let name = ...'", this.tok);
    return { t: "expr", e, span: e.span };
  }

  paramList(): string[] {
    this.expectOp("(");
    const ps: string[] = [];
    while (!this.isOp(")")) {
      const t = this.tok;
      if (t.type !== "ident") this.err(t.type === "note" ? `'${t.text}' is a note name and cannot be a parameter` : "expected a parameter name", t);
      ps.push(t.text); this.next();
      if (this.isOp(",")) this.next(); else if (!this.isOp(")")) this.err("expected ',' or ')'");
    }
    this.next();
    return ps;
  }

  numNode(t: Token): Node {
    return { t: "num", n: t.num!.n, d: t.num!.d, float: t.num!.float, unit: t.num!.unit, edo: t.num!.edo, span: this.spanOf(t) };
  }

  // ---------- expressions ----------
  expr(): Node {
    if (this.isKw("if")) {
      const s = this.next();
      const c = this.expr();
      if (!this.isKw("then")) this.err("expected 'then'");
      this.next();
      const a = this.expr();
      if (!this.isKw("else")) this.err("expected 'else'", this.tok, "every 'if' needs both branches because it is an expression");
      this.next();
      const b = this.expr();
      return { t: "if", c, a, b, span: sp(this.spanOf(s), b.span) };
    }
    // lambda: x => ...
    if (this.tok.type === "ident" && this.isOp("=>", this.peek())) {
      const s = this.next(); this.next();
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

  lambdaAhead(): boolean {
    let d = 0;
    for (let k = this.i; k < this.toks.length; k++) {
      const t = this.toks[k];
      if (t.type === "op" && t.text === "(") d++;
      else if (t.type === "op" && t.text === ")") { d--; if (d === 0) { const n = this.toks[k + 1]; return !!n && n.type === "op" && n.text === "=>"; } }
      else if (t.type === "eof") return false;
    }
    return false;
  }

  static PREC: Record<string, number> = {
    "or": 1, "||": 1, "and": 2, "&&": 2, "==": 3, "!=": 3, "<": 4, ">": 4, "<=": 4, ">=": 4,
    "..": 5, "+": 6, "-": 6, "*": 7, "/": 7, "%": 7,
  };

  binary(minPrec: number): Node {
    let l = this.unary();
    for (;;) {
      const t = this.tok;
      const op = t.type === "op" || (t.type === "kw" && (t.text === "and" || t.text === "or")) ? t.text : "";
      const prec = Parser.PREC[op];
      if (prec === undefined || prec <= minPrec) break;
      this.next();
      const r = this.binary(prec);
      l = { t: "binary", op: op === "&&" ? "and" : op === "||" ? "or" : op, l, r, span: sp(l.span, r.span) };
    }
    return l;
  }

  unary(): Node {
    const t = this.tok;
    if (this.isOp("-") || this.isKw("not") || this.isOp("!")) {
      this.next();
      const e = this.unary();
      return { t: "unary", op: t.text === "-" ? "-" : "not", e, span: sp(this.spanOf(t), e.span) };
    }
    return this.power();
  }

  power(): Node {
    const base = this.postfix(this.primary(false), false);
    if (this.isOp("**")) { this.next(); const e = this.unary(); return { t: "binary", op: "**", l: base, r: e, span: sp(base.span, e.span) }; }
    if (this.isOp("@")) {
      this.next();
      const q = this.tok;
      if (q.type !== "ident" && q.type !== "num" && q.type !== "note") this.err("expected a chord quality after '@', like c4@maj7 or ^2@4");
      this.next();
      const arg: Node = q.type === "num" ? this.numNode(q) : { t: "str", v: q.text, span: this.spanOf(q) };
      return this.postfix({ t: "mod", kind: "chord", e: base, arg, span: sp(base.span, this.spanOf(q)) }, false);
    }
    return base;
  }

  args(): { args: Node[]; named: { name: string; value: Node }[]; end: Token } {
    this.expectOp("(");
    const args: Node[] = []; const named: { name: string; value: Node }[] = [];
    while (!this.isOp(")")) {
      if ((this.tok.type === "ident" || this.tok.type === "kw" || this.tok.type === "note") && this.isOp(":", this.peek())) {
        const n = this.next(); this.next();
        named.push({ name: n.text, value: this.expr() });
      } else {
        if (named.length) this.err("positional arguments must come before named ones");
        args.push(this.expr());
      }
      if (this.isOp(",")) this.next(); else if (!this.isOp(")")) this.err(`expected ',' or ')' but found ${this.describe(this.tok)}`);
    }
    const end = this.next();
    return { args, named, end };
  }

  postfix(e: Node, inPhrase: boolean): Node {
    for (;;) {
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

  primary(inPhrase: boolean): Node {
    const t = this.tok;
    switch (t.type) {
      case "num": this.next(); return this.numNode(t);
      case "str": this.next(); return { t: "str", v: t.text, span: this.spanOf(t) };
      case "note": this.next(); return { t: "note", text: t.text, span: this.spanOf(t) };
      case "degree": this.next(); return { t: "degree", text: t.text, span: this.spanOf(t) };
      case "ident": this.next(); return { t: "ident", name: t.text, span: this.spanOf(t) };
      case "kw":
        if (t.text === "true" || t.text === "false") { this.next(); return { t: "bool", v: t.text === "true", span: this.spanOf(t) }; }
        if (["key", "seed", "tempo", "tuning"].includes(t.text)) { this.next(); return { t: "ident", name: t.text, span: this.spanOf(t) }; }
        if (t.text === "if" || t.text === "not") return this.expr();
        this.err(`'${t.text}' is a keyword and cannot be used here`);
      case "op":
        if (t.text === "(") {
          this.next();
          if ((this.tok.type === "ident" || this.tok.type === "note") && this.isOp(":", this.peek())) {
            const fields: { name: string; value: Node }[] = [];
            while (!this.isOp(")")) {
              const n = this.tok; if (n.type !== "ident" && n.type !== "note") this.err("expected a field name");
              this.next(); this.expectOp(":");
              fields.push({ name: n.text, value: this.expr() });
              if (this.isOp(",")) this.next(); else if (!this.isOp(")")) this.err("expected ',' or ')'");
            }
            const end = this.next();
            return { t: "record", fields, span: sp(this.spanOf(t), this.spanOf(end)) };
          }
          const e = this.expr();
          this.expectOp(")");
          return e;
        }
        if (t.text === "[") return this.phrase("[", "]", "seq");
        if (t.text === "{") return this.phrase("{", "}", "stack");
        if (t.text === "<") return this.phrase("<", ">", "alt");
        if (inPhrase && (t.text === "." || t.text === "..")) { this.next(); return { t: "rest", span: this.spanOf(t) }; }
      // fallthrough
      default:
        this.err(`unexpected ${this.describe(t)}`, t, t.text === "]" || t.text === ")" ? "check for an unmatched bracket" : undefined);
    }
  }

  // ---------- phrase literals ----------
  phrase(open: string, close: string, kind: "seq" | "stack" | "alt"): Node {
    const s = this.next();
    const items: PItem[] = [];
    while (!this.isOp(close)) {
      if (this.tok.type === "eof" || this.tok.type === "newline" || this.tok.type === "dedent") this.err(`unclosed '${open}'`, s, `add a matching '${close}'`);
      if (this.isOp("_")) {
        const h = this.next();
        if (!items.length) throw new TineError("syntax", "'_' extends the previous step, so it cannot come first", this.spanOf(h));
        items[items.length - 1].weight += 1;
        continue;
      }
      if (this.isOp("..")) { const r = this.next(); items.push({ node: { t: "rest", span: this.spanOf(r) }, weight: 1, span: this.spanOf(r) }); items.push({ node: { t: "rest", span: this.spanOf(r) }, weight: 1, span: this.spanOf(r) }); continue; }
      if (this.isOp(",") && kind === "stack") { this.next(); continue; }
      const el = this.choiceElement();
      items.push(el);
    }
    const e = this.next();
    return { t: "phrase", kind, items, span: sp(this.spanOf(s), this.spanOf(e)) };
  }

  choiceElement(): PItem {
    const first = this.element();
    if (!this.isOp("|")) return first;
    const opts = [first.node];
    while (this.isOp("|")) { this.next(); opts.push(this.element().node); }
    const span = sp(first.span, opts[opts.length - 1].span);
    return { node: { t: "choice", options: opts, span }, weight: first.weight, span };
  }

  phraseNum(): Node {
    const t = this.tok;
    if (t.type !== "num") this.err("expected a number");
    this.next();
    let n = this.numNode(t);
    if (this.isOp("/") && !this.tok.spaceBefore && this.peek().type === "num") {
      this.next(); const d = this.next();
      n = { t: "binary", op: "/", l: n, r: this.numNode(d), span: sp(n.span, this.spanOf(d)) };
    }
    return n;
  }

  element(): PItem {
    let node: Node;
    const t = this.tok;
    if (this.isOp("-") && this.peek().type === "num" && !this.peek().spaceBefore) {
      this.next(); const n = this.phraseNum();
      node = { t: "unary", op: "-", e: n, span: sp(this.spanOf(t), n.span) };
    } else if (t.type === "num") {
      node = this.phraseNum();
    } else {
      node = this.postfix(this.primary(true), true);
    }
    let weight = 1;
    for (;;) {
      const m = this.tok;
      if (m.spaceBefore) break;
      if (this.isOp("*")) { this.next(); const a = this.phraseNum(); node = { t: "mod", kind: "fast", e: node, arg: a, span: sp(node.span, a.span) }; continue; }
      if (this.isOp(":")) { this.next(); const a = this.tok; if (a.type !== "num") this.err("expected a length after ':' like c:2"); this.next(); weight = a.num!.n / a.num!.d; continue; }
      if (this.isOp("!")) { this.next(); const a = this.phraseNum(); node = { t: "mod", kind: "rep", e: node, arg: a, span: sp(node.span, a.span) }; continue; }
      if (this.isOp("?")) {
        this.next();
        let a: Node | null = null;
        if (this.tok.type === "num" && !this.tok.spaceBefore) a = this.phraseNum();
        node = { t: "mod", kind: "chance", e: node, arg: a, span: sp(node.span, a ? a.span : this.spanOf(m)) };
        continue;
      }
      if (this.isOp("@")) {
        this.next();
        const q = this.tok;
        if (q.type !== "ident" && q.type !== "num" && q.type !== "note") this.err("expected a chord quality after '@'");
        this.next();
        const arg: Node = q.type === "num" ? this.numNode(q) : { t: "str", v: q.text, span: this.spanOf(q) };
        node = { t: "mod", kind: "chord", e: node, arg, span: sp(node.span, arg.span) };
        continue;
      }
      break;
    }
    return { node, weight, span: node.span };
  }
}
