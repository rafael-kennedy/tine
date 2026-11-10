// The evaluator. Tine is interpreted: a program evaluates to a Scene, which
// is a set of named voices (patterns) plus tempo, key, seed and form. The
// evaluator itself has no notion of real time; schedulers query the Scene.

import { parse, Node, Stmt, Program } from "./parser";
import { TineError, Span, suggest } from "./errors";
import { R, ONE, ZERO } from "./rational";
import { Pitch, Degree, Key, Scale, parseNote, parseDegree, SCALES, DRUMS, DEFAULT_KEY } from "./pitch";
import { Pat, Chord, REST, Rest, toPat, seq, stack, alt, fast, choice, degrade, silence, mapV, sampleAt, Ctx, makeCtx } from "./pattern";
import { hashStr, Stream, rand01 } from "./rng";
import { Env, Closure, Builtin, Rec, typeName, show, num, isNum, truthy } from "./values";
import { makeChord, registerBuiltins } from "./builtins";

export interface VoiceDef { name: string; pat: Pat; span: Span; section?: string; active?: boolean }
export interface SectionDef { name: string; bars: number; voices: Map<string, VoiceDef>; tempo?: number; key?: Key; span: Span }

export interface Scene {
  tempo: number;
  meter: [number, number];
  seed: number;
  seedExplicit: boolean;
  key: Key;
  tuningRef: number;
  voices: Map<string, VoiceDef>;
  sections: Map<string, SectionDef>;
  form: { name: string; times: number }[] | null;
  prints: string[];
  errors: TineError[];
  sampleSources: string[];                      // samples(...) lines: packs to load
  soundfontSources: string[];                   // soundfont(...) lines
  env: Env;
}

export interface EvalOptions {
  seed?: number;                                // used when the program has no `seed` line
  readFile?: (path: string) => string;          // for `use`
  globals?: Env;                                // reuse (REPL)
  keepGoing?: boolean;                          // collect errors per statement instead of throwing
}

export const MAX_DEPTH = 400;
export const INSTRUMENTS = ["keys", "sine", "tri", "saw", "square", "pluck", "bass", "pad", "bell", "organ", "kit", "lead", "upright", "vibes",
  "synth", "fm", "supersaw", "tb303", "reese", "wobble", "chip", "brass", "strings", "marimba", "noise"];

export class Interp {
  env: Env;
  scene: Scene;
  stream: Stream;
  saltBase = 0;
  saltN = 0;
  depth = 0;
  src = "";
  opts: EvalOptions;
  sectionStack: SectionDef[] = [];
  queryCtx: Ctx | null = null;

  constructor(opts: EvalOptions = {}) {
    this.opts = opts;
    const root = opts.globals ?? Interp.rootEnv();
    this.env = opts.globals ? root : new Env(root);
    const seed = opts.seed ?? 0;
    this.scene = {
      tempo: 120, meter: [4, 4], seed, seedExplicit: false, key: DEFAULT_KEY, tuningRef: 440,
      voices: new Map(), sections: new Map(), form: null, prints: [], errors: [], sampleSources: [], soundfontSources: [], env: this.env,
    };
    this.stream = new Stream([seed, 0]);
  }

  static _root: Env | null = null;
  static rootEnv(): Env {
    if (Interp._root) return Interp._root;
    const env = new Env();
    for (const [k, s] of Object.entries(SCALES)) env.set(k, s);
    for (const [k, n] of Object.entries(DRUMS)) env.set(k, new Pitch(n, k));
    for (const i of INSTRUMENTS) env.set(i, i);
    env.set("silence", silence);
    env.set("rest", REST);
    env.set("pi", Math.PI);
    registerBuiltins(env);
    Interp._root = env;
    return env;
  }

  // ---------- program ----------
  run(src: string, file = "<input>"): Scene {
    this.src = src;
    let prog: Program;
    prog = parse(src);
    // seed first, so randomness anywhere in the file uses it
    for (const st of prog.stmts) if (st.t === "directive" && st.name === "seed") {
      this.scene.seed = Math.floor(num(this.eval(st.args[0], this.env)));
      this.scene.seedExplicit = true;
    }
    for (const st of prog.stmts) {
      try { this.stmt(st, this.env); }
      catch (e) {
        const err = this.wrap(e, st.span);
        if (this.opts.keepGoing) this.scene.errors.push(err); else throw err;
      }
    }
    return this.scene;
  }

  wrap(e: unknown, span: Span): TineError {
    if (e instanceof TineError) { if (!e.span) e.span = span; return e; }
    if (e instanceof RangeError && /call stack/i.test(e.message)) return new TineError("runtime", "recursion went too deep", span, "check that recursive functions have a base case");
    const msg = e instanceof Error ? e.message : String(e);
    return new TineError(e instanceof TypeError ? "type" : "runtime", msg, span);
  }

  beginStatement(key: string) {
    this.saltBase = hashStr(key);
    this.saltN = 0;
    this.stream = new Stream([this.scene.seed, this.saltBase]);
  }
  salt(): number { return (this.saltBase + Math.imul(++this.saltN, 0x9e3779b1)) >>> 0; }

  stmt(st: Stmt, env: Env): any {
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
        const def: VoiceDef = { name: st.name, pat, span: st.span, section: sec?.name, active: st.active };
        (sec ? sec.voices : this.scene.voices).set(st.name, def);
        return pat;
      }
      case "directive": {
        this.beginStatement(`directive:${st.name}`);
        const args = st.args.map(a => this.eval(a, env));
        if (st.name === "tempo") {
          const t = num(args[0]);
          if (!(t > 0 && t < 2000)) throw new TineError("runtime", "tempo must be between 0 and 2000 BPM", st.span);
          if (sec) sec.tempo = t; else this.scene.tempo = t;
        } else if (st.name === "meter") {
          this.scene.meter = [num(args[0]), num(args[1])];
        } else if (st.name === "key") {
          const k = this.makeKey(args[0], args[1] ?? SCALES.major, st.span);
          if (sec) sec.key = k; else this.scene.key = k;
        } else if (st.name === "seed") {
          // handled up front; inside a REPL it applies immediately
          this.scene.seed = Math.floor(num(args[0])); this.scene.seedExplicit = true;
        } else if (st.name === "tuning") {
          const r = args[0] instanceof Pitch ? args[0].freq() : num(args[0]);
          this.scene.tuningRef = r;
        }
        return null;
      }
      case "section": {
        const bars = num(this.eval(st.bars, env));
        const def: SectionDef = { name: st.name, bars, voices: new Map(), span: st.span };
        this.scene.sections.set(st.name, def);
        this.sectionStack.push(def);
        const inner = new Env(env);
        try { for (const s of st.body) this.stmt(s, inner); }
        finally { this.sectionStack.pop(); }
        return null;
      }
      case "form": {
        this.scene.form = st.items.map(i => ({ name: i.name, times: i.times }));
        for (const i of st.items) if (!this.scene.sections.has(i.name)) {
          throw new TineError("name", `there is no section named '${i.name}'`, i.span, (() => { const s = suggest(i.name, this.scene.sections.keys()); return s ? `did you mean '${s}'?` : "define it with: section name bars"; })());
        }
        return null;
      }
      case "use": {
        if (!this.opts.readFile) throw new TineError("runtime", "'use' is not available here", st.span);
        const src = this.opts.readFile(st.path);
        const sub = new Interp({ ...this.opts, globals: env, seed: this.scene.seed });
        sub.scene = this.scene;
        sub.run(src, st.path);
        return null;
      }
      case "expr": {
        this.beginStatement(`expr:${st.span.start}`);
        const v = this.eval(st.e, env);
        if (v && typeof v === "object" && typeof (v as any).__soundfont === "string") {
          if (!this.scene.soundfontSources.includes((v as any).__soundfont)) this.scene.soundfontSources.push((v as any).__soundfont);
          return null;
        }
        if (v && typeof v === "object" && typeof (v as any).__samples === "string") {
          if (!this.scene.sampleSources.includes((v as any).__samples)) this.scene.sampleSources.push((v as any).__samples);
          return null;
        }
        return v;
      }
    }
  }

  makeKey(root: any, scale: any, span: Span): Key {
    if (!(root instanceof Pitch)) throw new TineError("type", `a key needs a root note like d or f#3, got ${typeName(root)}`, span);
    if (!(scale instanceof Scale)) throw new TineError("type", `a key needs a scale like major or dorian, got ${typeName(scale)}`, span);
    // bare note names in a key default to octave 4 already
    return new Key(root, scale);
  }

  asPattern(v: any, span: Span): Pat {
    if (v instanceof Pat) return v;
    if (v instanceof Pitch || v instanceof Degree || v instanceof Chord || isNum(v) || v instanceof Rest || v instanceof Rec) return toPat(v);
    throw new TineError("type", `a voice must be something playable, but this is ${typeName(v)}`, span, "voices take phrases like [c e g], notes, chords or patterns");
  }

  // ---------- expressions ----------
  eval(n: Node, env: Env): any {
    switch (n.t) {
      case "num": {
        let v: R | number = n.float ? n.n / n.d : new R(n.n, n.d);
        if (n.unit === "cents") return n.float ? (n.n / n.d) / 100 : new R(n.n, n.d * 100);
        if (n.unit === "edo") return n.float ? (n.n / n.d) * 12 / n.edo! : new R(n.n * 12, n.d * n.edo!);
        if (n.unit === "hz") return Pitch.fromFreq(n.n / n.d, this.scene.tuningRef);
        return v;
      }
      case "str": return n.v;
      case "bool": return n.v;
      case "note": return parseNote(n.text);
      case "degree": return parseDegree(n.text);
      case "rest": return REST;
      case "ident": {
        if (env.has(n.name)) return env.get(n.name);
        const s = suggest(n.name, env.names());
        throw new TineError("name", `'${n.name}' is not defined`, n.span, s ? `did you mean '${s}'?` : undefined);
      }
      case "phrase": return this.phrase(n, env);
      case "choice": {
        const opts = n.options.map(o => toPat(this.eval(o, env)));
        return choice(opts, this.salt());
      }
      case "mod": return this.mod(n, env);
      case "record": {
        const f: Record<string, any> = {};
        for (const x of n.fields) f[x.name] = this.eval(x.value, env);
        return new Rec(f);
      }
      case "lambda": return new Closure("lambda", n.params, n.body, env);
      case "if": return truthy(this.eval(n.c, env)) ? this.eval(n.a, env) : this.eval(n.b, env);
      case "block": {
        const inner = new Env(env);
        for (const s of n.stmts) {
          if (s.t === "let") {
            if (s.params) inner.set(s.name, new Closure(s.name, s.params, s.value, inner));
            else inner.set(s.name, this.eval(s.value, inner));
          } else if (s.t === "expr") this.eval(s.e, inner);
          else throw new TineError("syntax", `'${s.t}' is not allowed inside a function body`, s.span);
        }
        return this.eval(n.result, inner);
      }
      case "unary": {
        const v = this.eval(n.e, env);
        if (n.op === "not") return liftUnary(v, x => !truthy(x));
        return liftUnary(v, x => neg(x, n.span));
      }
      case "binary": {
        if (n.op === "and") return truthy(this.eval(n.l, env)) ? this.eval(n.r, env) : false;
        if (n.op === "or") { const l = this.eval(n.l, env); return truthy(l) ? l : this.eval(n.r, env); }
        const l = this.eval(n.l, env), r = this.eval(n.r, env);
        if (n.op === "..") return rangeSeq(l, r, n.span);
        return binop(n.op, l, r, n.span);
      }
      case "call": {
        const f = this.eval(n.callee, env);
        const args = n.args.map(a => this.eval(a, env));
        const named: Record<string, any> = {};
        for (const x of n.named) named[x.name] = this.eval(x.value, env);
        return this.call(f, args, named, n.span, n.callee.t === "ident" ? n.callee.name : undefined);
      }
      case "method": {
        const obj = this.eval(n.obj, env);
        if (obj instanceof Rec && n.name in obj.fields) {
          const fv = obj.fields[n.name];
          if (n.args === null) return fv;
          return this.call(fv, n.args.map(a => this.eval(a, env)), {}, n.span, n.name);
        }
        if (!env.has(n.name)) {
          const s = suggest(n.name, env.names());
          throw new TineError("name", `there is no function '${n.name}'`, n.nameSpan, s ? `did you mean '${s}'?` : undefined);
        }
        const f = env.get(n.name);
        const args = (n.args ?? []).map(a => this.eval(a, env));
        const named: Record<string, any> = {};
        for (const x of n.named) named[x.name] = this.eval(x.value, env);
        return this.call(f, [obj, ...args], named, n.span, n.name);
      }
    }
  }

  call(f: any, args: any[], named: Record<string, any>, span?: Span, name?: string): any {
    if (this.depth > MAX_DEPTH) throw new TineError("runtime", "recursion went too deep", span, "check that recursive functions have a base case");
    if (f instanceof Builtin) {
      try { return f.impl(args, named, { span, interp: this }); }
      catch (e) {
        if (e instanceof TineError) { if (!e.span) e.span = span; throw e; }
        if (e instanceof RangeError && /call stack/i.test(e.message)) throw e;
        throw new TineError(e instanceof TypeError ? "type" : "runtime", `${f.name}: ${e instanceof Error ? e.message : e}`, span, `usage: ${f.sig}`);
      }
    }
    if (f instanceof Closure) {
      const env = new Env(f.env);
      const all = [...args];
      f.params.forEach((p, i) => {
        if (p in named) env.set(p, named[p]);
        else if (i < all.length) env.set(p, all[i]);
        else throw new TineError("type", `${f.name} needs ${f.params.length} argument${f.params.length === 1 ? "" : "s"} (${f.params.join(", ")}) but got ${args.length}`, span);
      });
      if (args.length > f.params.length) throw new TineError("type", `${f.name} takes ${f.params.length} argument${f.params.length === 1 ? "" : "s"} but got ${args.length}`, span);
      this.depth++;
      try { return this.eval(f.body, env); } finally { this.depth--; }
    }
    if (f instanceof Pat || f instanceof Pitch || isNum(f)) {
      throw new TineError("type", `${name ? `'${name}'` : "this"} is ${typeName(f)}, not a function`, span, f instanceof Pat ? "to put things in sequence, use a phrase: [a b c]" : undefined);
    }
    throw new TineError("type", `${name ? `'${name}'` : "this value"} is ${typeName(f)}, not a function`, span);
  }

  // Call a user function from inside a pattern query (per_bar, map, ...)
  // with randomness keyed to a bar, so results never depend on query order.
  callKeyed(f: any, args: any[], ctx: Ctx, bar: number, salt: number): any {
    const saved = [this.stream, this.saltBase, this.saltN, this.queryCtx] as const;
    const g = bar + ctx.offset.toNumber();
    this.stream = new Stream([ctx.seed, ctx.voice, salt, g]);
    this.saltBase = (salt ^ Math.imul(g + 1, 0x85ebca6b)) >>> 0; this.saltN = 0;
    this.queryCtx = ctx;
    try { return this.call(f, args, {}); }
    finally { [this.stream, this.saltBase, this.saltN, this.queryCtx] = saved as any; }
  }

  phrase(n: Extract<Node, { t: "phrase" }>, env: Env): any {
    if (n.kind === "seq") {
      const children: { pat: Pat; w: R }[] = [];
      const items: any[] = [];
      for (const it of n.items) {
        if (it.node.t === "mod" && it.node.kind === "rep") {
          const v = this.eval(it.node.e, env);
          const times = Math.max(0, Math.round(num(this.eval(it.node.arg!, env))));
          for (let k = 0; k < times; k++) { children.push({ pat: toPat(v), w: R.of(it.weight) }); items.push(v); }
          continue;
        }
        const v = this.eval(it.node, env);
        children.push({ pat: toPat(v), w: R.of(it.weight) });
        items.push(v);
      }
      if (children.length === 0) { const p = seq([], []); p.items = []; return p; }
      return seq(children, items);
    }
    const vals = n.items.map(it => this.eval(it.node, env));
    if (n.kind === "stack") {
      if (vals.every(v => v instanceof Pitch || v instanceof Degree || isNum(v) || v instanceof Chord)) {
        return new Chord(vals.flatMap(v => (v instanceof Chord ? v.notes : [v])));
      }
      return stack(vals.map(toPat));
    }
    return alt(vals.map(toPat));
  }

  mod(n: Extract<Node, { t: "mod" }>, env: Env): any {
    const v = this.eval(n.e, env);
    switch (n.kind) {
      case "fast": return fast(R.of(num(this.eval(n.arg!, env))), toPat(v));
      case "chance": {
        const p = n.arg ? num(this.eval(n.arg, env)) : 0.5;
        return degrade(1 - p, this.salt(), toPat(v));
      }
      case "chord": {
        const q = n.arg!.t === "str" ? n.arg!.v : String(num(this.eval(n.arg!, env)));
        try { return liftUnary(v, x => makeChord(x, q)); }
        catch (e) { throw new TineError("type", (e as Error).message, n.span); }
      }
      case "rep": return v;
    }
  }
}

// ---------- operators ----------

function liftUnary(v: any, f: (x: any) => any): any {
  if (v instanceof Pat) return mapV(v, x => (x instanceof Rest ? x : f(x)));
  if (v instanceof Chord) return v.map(f);
  return f(v);
}

function neg(x: any, span: Span): any {
  if (x instanceof R) return x.neg();
  if (typeof x === "number") return -x;
  throw new TineError("type", `cannot negate ${typeName(x)}`, span);
}

function arith(op: string, a: any, b: any): R | number {
  if (a instanceof R && b instanceof R) {
    switch (op) {
      case "+": return a.add(b); case "-": return a.sub(b); case "*": return a.mul(b);
      case "/": if (b.n === 0) throw new Error("division by zero"); return a.div(b);
      case "%": { const q = a.div(b).floor(); return a.sub(b.mul(new R(q))); }
      case "**": if (b.isInt() && Math.abs(b.n) < 64) { let r = ONE; const base = b.n < 0 ? ONE.div(a) : a; for (let i = 0; i < Math.abs(b.n); i++) r = r.mul(base); return r; }
    }
  }
  const x = num(a), y = num(b);
  switch (op) {
    case "+": return x + y; case "-": return x - y; case "*": return x * y;
    case "/": if (y === 0) throw new Error("division by zero"); return x / y;
    case "%": return ((x % y) + y) % y;
    case "**": return Math.pow(x, y);
  }
  throw new Error(`unknown operator ${op}`);
}

function compare(op: string, a: any, b: any): boolean {
  if (op === "==") return equal(a, b);
  if (op === "!=") return !equal(a, b);
  let x: number, y: number;
  if (typeof a === "string" && typeof b === "string") { x = a < b ? -1 : a > b ? 1 : 0; y = 0; }
  else { x = a instanceof Pitch ? a.semi : num(a); y = b instanceof Pitch ? b.semi : num(b); }
  switch (op) { case "<": return x < y; case ">": return x > y; case "<=": return x <= y; case ">=": return x >= y; }
  return false;
}

function equal(a: any, b: any): boolean {
  if (isNum(a) && isNum(b)) return Math.abs(num(a) - num(b)) < 1e-12;
  if (a instanceof Pitch && b instanceof Pitch) return Math.abs(a.semi - b.semi) < 1e-9;
  if (a instanceof Degree && b instanceof Degree) return a.deg === b.deg && a.acc === b.acc && a.shift === b.shift;
  return a === b;
}

export function scalar(op: string, a: any, b: any, span?: Span): any {
  if (a instanceof Rest || b instanceof Rest) return REST;
  if (["==", "!=", "<", ">", "<=", ">="].includes(op)) return compare(op, a, b);
  if (a instanceof Chord) return a.map(x => scalar(op, x, b, span));
  if (b instanceof Chord && isNum(a)) return b.map(x => scalar(op, a, x, span));
  if (a instanceof Pitch) {
    if (isNum(b)) {
      if (op === "+") return new Pitch(a.semi + num(b));
      if (op === "-") return new Pitch(a.semi - num(b));
      if (op === "*") return new Pitch(a.semi + 12 * Math.log2(num(b)));
      if (op === "/") return new Pitch(a.semi - 12 * Math.log2(num(b)));
    }
    if (b instanceof Pitch && op === "-") return a.semi - b.semi;
    throw new TineError("type", `cannot ${opWord(op)} a pitch and ${typeName(b)}`, span, "pitch + n moves by semitones, pitch * 3/2 moves by a frequency ratio");
  }
  if (b instanceof Pitch && isNum(a) && op === "+") return new Pitch(b.semi + num(a));
  if (a instanceof Degree) {
    if (isNum(b) && (op === "+" || op === "-")) {
      const k = num(b);
      if (!Number.isInteger(k)) throw new TineError("type", "scale degrees move in whole steps", span, "use .transpose(x) to move by a fractional number of semitones");
      return new Degree(a.deg, a.acc, a.shift + (op === "+" ? k : -k));
    }
    throw new TineError("type", `cannot ${opWord(op)} a degree and ${typeName(b)}`, span, "^1 + 2 moves up two scale steps");
  }
  if (b instanceof Degree && isNum(a) && op === "+") return scalar(op, b, a, span);
  if (typeof a === "string" && op === "+") return a + (typeof b === "string" ? b : show(b));
  if (isNum(a) && isNum(b)) return arith(op, a, b);
  throw new TineError("type", `cannot ${opWord(op)} ${typeName(a)} and ${typeName(b)}`, span);
}

function opWord(op: string) {
  return ({ "+": "add", "-": "subtract", "*": "multiply", "/": "divide", "%": "take the remainder of", "**": "raise" } as any)[op] ?? `apply '${op}' to`;
}

export function binop(op: string, l: any, r: any, span?: Span): any {
  if (l instanceof Pat && r instanceof Pat) {
    // structure comes from the left; the right is sampled at each onset
    const np = new Pat((a, b, ctx) => l.query(a, b, ctx).map(ev => ({ ...ev, v: scalar(op, ev.v, sampleAt(r, ev.s, ctx), span) })));
    return np;
  }
  // pattern * n repeats it n times per bar, as x*n does inside a phrase;
  // pattern / n stretches it. Single pitches still multiply by frequency ratios.
  if (l instanceof Pat && isNum(r) && (op === "*" || op === "/")) {
    const k = r instanceof R ? r : R.of(num(r));
    if (k.n === 0) throw new TineError("runtime", op === "*" ? "a pattern repeated 0 times is silence; use silence instead" : "division by zero", span);
    return fast(op === "*" ? k : ONE.div(k), l);
  }
  if (l instanceof Pat) return mapV(l, x => scalar(op, x, r, span));
  if (r instanceof Pat) return mapV(r, x => scalar(op, l, x, span));
  return scalar(op, l, r, span);
}

function rangeSeq(l: any, r: any, span: Span): Pat {
  const a = num(l), b = num(r);
  if (!Number.isInteger(a) || !Number.isInteger(b)) throw new TineError("type", "ranges use whole numbers, like 0..7", span);
  if (Math.abs(b - a) > 10000) throw new TineError("runtime", "range is too large", span);
  const vals: R[] = [];
  if (a <= b) for (let i = a; i <= b; i++) vals.push(new R(i)); else for (let i = a; i >= b; i--) vals.push(new R(i));
  return toPat(vals);
}

// ---------- convenience ----------

export function evaluate(src: string, opts: EvalOptions = {}): Scene {
  const it = new Interp(opts);
  return it.run(src);
}
