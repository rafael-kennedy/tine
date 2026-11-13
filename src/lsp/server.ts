// Tine language server: a small, dependency-free implementation of the
// Language Server Protocol over stdio. Any LSP-capable editor (VS Code,
// Neovim, Helix, Zed, Emacs, Sublime) gets diagnostics, completion, hover,
// signature help, go-to-definition, outline and formatting.
import {
  evaluate, parse, renderNotes, TineError, builtinList, KEYWORDS, SCALES, DRUMS, INSTRUMENTS, CHORDS, describeWord, VERSION, Stmt, Node, Span, lex,
} from "../core";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type Pos = { line: number; character: number };
const docs = new Map<string, string>();
const builtins = new Map(builtinList().map(b => [b.name, b]));

function send(msg: any) {
  const body = JSON.stringify({ jsonrpc: "2.0", ...msg });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
}

function offsetToPos(src: string, off: number): Pos {
  let line = 0, last = 0;
  for (let i = 0; i < off && i < src.length; i++) if (src[i] === "\n") { line++; last = i + 1; }
  return { line, character: Math.max(0, Math.min(off, src.length) - last) };
}
function posToOffset(src: string, p: Pos): number {
  let line = 0, i = 0;
  while (line < p.line && i < src.length) { if (src[i] === "\n") line++; i++; }
  return Math.min(src.length, i + p.character);
}
const range = (src: string, s: Span) => ({ start: offsetToPos(src, s.start), end: offsetToPos(src, Math.max(s.end, s.start + 1)) });

function readerFor(uri: string) {
  try { const dir = dirname(fileURLToPath(uri)); return (p: string) => readFileSync(resolve(dir, p), "utf8"); } catch { return undefined; }
}

// `use "drums.tine" as drums` lines in a file, and what the used file defines.
function usesIn(src: string): Extract<Stmt, { t: "use" }>[] {
  try { return parse(src).stmts.filter((s): s is Extract<Stmt, { t: "use" }> => s.t === "use"); } catch { return []; }
}
function usedFile(uri: string, path: string): { uri: string; src: string } | null {
  try {
    const file = resolve(dirname(fileURLToPath(uri)), path);
    const u = pathToFileURL(file).href;
    return { uri: u, src: docs.get(u) ?? readFileSync(file, "utf8") };
  } catch { return null; }
}
// The namespace a word belongs to, when it is written alias.word.
function namespaced(uri: string, src: string, start: number): { alias: string; file: { uri: string; src: string } } | null {
  const m = src.slice(Math.max(0, start - 64), start).match(/([A-Za-z_][A-Za-z0-9_]*)\.$/);
  if (!m) return null;
  const u = usesIn(src).find(x => x.as === m[1]);
  const file = u && usedFile(uri, u.path);
  return file ? { alias: m[1], file } : null;
}

export const INEXACT_MSG = (v: string) => `voice ${v}: its timing needs fractions too large to keep exact, so some times are rounded (by at most a millionth of a bar). It plays, but a note can miss a bar line by that much. Simpler ratios keep it exact.`;

function diagnose(uri: string) {
  const src = docs.get(uri) ?? "";
  const diags: any[] = [];
  const add = (e: TineError, severity = 1) => diags.push({ range: range(src, e.span ?? { start: 0, end: 1 }), severity, source: "tine", message: e.message + (e.hint ? `\n${e.hint}` : ""), code: e.kind });
  try {
    const scene = evaluate(src, { seed: 1, keepGoing: true, readFile: readerFor(uri) });
    for (const e of scene.errors) add(e);
    if (!scene.errors.length) {
      // query a little music so errors that happen at play time show up now
      const spanOf = (v: string) => {
        const d = scene.voices.get(v) ?? [...scene.sections.values()].find(s => s.voices.has(v))?.voices.get(v);
        return d?.file ? d.at : d?.span;   // a voice from a used file is reported on its use line
      };
      const warned = new Set<string>();
      const onInexact = (v: string) => { if (!warned.has(v)) { warned.add(v); add(new TineError("timing", INEXACT_MSG(v), spanOf(v)), 2); } };
      try { renderNotes(scene, scene.form ? undefined : 2, { onInexact, onError: (v, e) => add(new TineError("runtime", `voice ${v}: ${(e as Error).message}`, spanOf(v))) }); }
      catch (e) { if (e instanceof TineError) add(e); }
    }
  } catch (e) {
    if (e instanceof TineError) add(e);
    else diags.push({ range: range(src, { start: 0, end: 1 }), severity: 1, source: "tine", message: String((e as Error).message) });
  }
  send({ method: "textDocument/publishDiagnostics", params: { uri, diagnostics: diags } });
}

function wordAt(src: string, off: number): { word: string; start: number; end: number } {
  let s = off, e = off;
  while (s > 0 && /[A-Za-z0-9_#^]/.test(src[s - 1])) s--;
  while (e < src.length && /[A-Za-z0-9_#]/.test(src[e])) e++;
  return { word: src.slice(s, e), start: s, end: e };
}

interface Def { name: string; kind: "let" | "fn" | "voice" | "section"; span: Span; nameSpan: Span; detail: string; children?: Def[] }
function definitions(src: string): Def[] {
  let prog;
  try { prog = parse(src); } catch { return []; }
  const walk = (stmts: Stmt[]): Def[] => stmts.flatMap((st): Def[] => {
    if (st.t === "let") return [{ name: st.name, kind: st.params ? "fn" : "let", span: st.span, nameSpan: st.nameSpan, detail: st.params ? `let ${st.name}(${st.params.join(", ")})` : `let ${st.name}` }];
    if (st.t === "voice") return [{ name: st.name, kind: "voice", span: st.span, nameSpan: st.nameSpan, detail: `voice ${st.name}` }];
    if (st.t === "section") return [{ name: st.name, kind: "section", span: { start: st.span.start, end: endOfBlock(st) }, nameSpan: st.nameSpan, detail: `section ${st.name}`, children: walk(st.body) }];
    return [];
  });
  const endOfBlock = (st: Extract<Stmt, { t: "section" }>) => st.body.length ? st.body[st.body.length - 1].span.end : st.span.end;
  return walk(prog.stmts);
}

function hover(uri: string, p: Pos) {
  const src = docs.get(uri) ?? "";
  const off = posToOffset(src, p);
  const { word, start, end } = wordAt(src, off);
  if (!word) return null;
  let text = describeWord(word);
  if (!text && word.startsWith("^")) {
    try {
      const keyLine = src.slice(0, start).match(/^\s*key\s+(.+)$/gm)?.pop();
      const s = evaluate(`${keyLine ?? ""}\nvoice probe = ${word}`, { seed: 1 });
      const n = renderNotes(s, 1).notes[0];
      text = `scale degree ${word}${n ? ` = MIDI ${Math.round(n.semi * 100) / 100} in ${s.key}` : ""}`;
    } catch { text = `scale degree ${word}`; }
  }
  const ns = namespaced(uri, src, start);
  if (ns) {
    const d = definitions(ns.file.src).find(x => x.name === word && (x.kind === "let" || x.kind === "fn"));
    text = d ? `${d.detail}\nfrom ${ns.alias} (${ns.file.uri.split("/").pop()})` : null;
  }
  const u = !text && usesIn(src).find(x => x.as === word);
  if (u) text = `use "${u.path}" as ${u.as}\n${(() => { const f = usedFile(uri, u.path); return f ? definitions(f.src).filter(d => d.kind === "let" || d.kind === "fn").map(d => d.name).join(", ") || "no lets" : "file not found"; })()}`;
  if (!text) {
    const d = flat(definitions(src)).find(x => x.name === word);
    if (d) {
      text = d.detail;
      if (d.kind === "voice") {
        try {
          const s = evaluate(src, { seed: 1, keepGoing: true, readFile: readerFor(uri) });
          const ns = renderNotes({ ...s, form: null } as any, 1).notes.filter(n => n.voice === word);
          text += `\n${ns.length} note${ns.length === 1 ? "" : "s"} in bar 1`;
        } catch { /* fine */ }
      }
    }
  }
  if (!text) return null;
  return { contents: { kind: "markdown", value: "```tine\n" + text.split("\n")[0] + "\n```\n" + text.split("\n").slice(1).join("\n") }, range: range(src, { start, end }) };
}
const flat = (ds: Def[]): Def[] => ds.flatMap(d => [d, ...flat(d.children ?? [])]);

function completion(uri: string, p: Pos) {
  const src = docs.get(uri) ?? "";
  const off = posToOffset(src, p);
  const before = src.slice(Math.max(0, off - 40), off);
  const items: any[] = [];
  if (/@[A-Za-z0-9#+]*$/.test(before)) {
    for (const q of Object.keys(CHORDS)) items.push({ label: q, kind: 12, detail: `chord ${CHORDS[q].map(x => Math.round(x * 100) / 100).join(" ")}` });
    for (const q of ["3", "7", "9", "11", "13"]) items.push({ label: q, kind: 12, detail: "diatonic chord on a degree" });
    for (const q of ["7b9", "7#9", "7#11", "7b13", "7alt", "maj7#11", "9sus4", "13sus4", "69", "m69", "maj13", "m13", "mmaj7", "7#5", "7b5"]) if (!items.some(i => i.label === q)) items.push({ label: q, kind: 12, detail: "chord symbol" });
    return items;
  }
  const nsm = before.match(/([A-Za-z_][A-Za-z0-9_]*)\.[A-Za-z_]*$/);
  const ns = nsm && namespaced(uri, src, off - (before.length - before.lastIndexOf(".") - 1));
  if (ns) {
    const file = ns.file.uri.split("/").pop();
    return definitions(ns.file.src).filter(d => d.kind === "fn" || d.kind === "let")
      .map(d => ({ label: d.name, kind: d.kind === "fn" ? 3 : 6, detail: `${d.detail}  (${file})` }));
  }
  const afterDot = /\.[A-Za-z_]*$/.test(before);
  for (const b of builtinList()) items.push({ label: b.name, kind: 3, detail: b.sig, documentation: b.doc, insertText: b.name });
  for (const d of flat(definitions(src))) if (d.kind === "fn" || d.kind === "let") items.push({ label: d.name, kind: d.kind === "fn" ? 3 : 6, detail: d.detail });
  if (!afterDot) for (const u of usesIn(src)) if (u.as) items.push({ label: u.as, kind: 9, detail: `use "${u.path}"` });
  if (!afterDot) {
    for (const k of KEYWORDS) items.push({ label: k, kind: 14 });
    for (const s of Object.keys(SCALES)) items.push({ label: s, kind: 7, detail: "scale" });
    for (const d of Object.keys(DRUMS)) items.push({ label: d, kind: 21, detail: `drum (MIDI ${DRUMS[d]})` });
    for (const i of INSTRUMENTS) items.push({ label: i, kind: 7, detail: "instrument" });
  }
  return items;
}

function signature(uri: string, p: Pos) {
  const src = docs.get(uri) ?? "";
  let off = posToOffset(src, p) - 1;
  let depth = 0, commas = 0;
  for (; off >= 0; off--) {
    const c = src[off];
    if (c === ")" || c === "]" || c === "}") depth++;
    else if (c === "(" || c === "[" || c === "{") { if (depth === 0) break; depth--; }
    else if (c === "," && depth === 0) commas++;
    else if (c === "\n" && depth === 0 && !/^\s/.test(src.slice(off + 1))) return null;
  }
  if (off < 0 || src[off] !== "(") return null;
  const m = src.slice(0, off).match(/(\.)?([A-Za-z_][A-Za-z0-9_]*)$/);
  if (!m) return null;
  const b = builtins.get(m[2]);
  let label: string, doc = "";
  if (b) { label = b.sig; doc = b.doc; }
  else { const d = flat(definitions(src)).find(x => x.name === m[2] && x.kind === "fn"); if (!d) return null; label = d.detail.replace(/^let /, ""); }
  const params = (label.match(/\((.*)\)/)?.[1] ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const active = m[1] ? commas + 1 : commas; // method calls supply the first argument
  return { signatures: [{ label, documentation: doc, parameters: params.map(x => ({ label: x })) }], activeSignature: 0, activeParameter: Math.min(active, Math.max(0, params.length - 1)) };
}

function definition(uri: string, p: Pos) {
  const src = docs.get(uri) ?? "";
  const off = posToOffset(src, p);
  const { word, start } = wordAt(src, off);
  const top = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
  // on the path of a use line, or on a namespace name: open the file
  const u = usesIn(src).find(x => (off >= x.pathSpan.start && off <= x.pathSpan.end) || x.as === word);
  if (u) { const f = usedFile(uri, u.path); return f ? { uri: f.uri, range: top } : null; }
  const ns = namespaced(uri, src, start);
  if (ns) {
    const d = definitions(ns.file.src).find(x => x.name === word);
    return { uri: ns.file.uri, range: d ? range(ns.file.src, d.nameSpan) : top };
  }
  const d = flat(definitions(src)).find(x => x.name === word);
  return d ? { uri, range: range(src, d.nameSpan) } : null;
}

function symbols(uri: string) {
  const src = docs.get(uri) ?? "";
  const conv = (d: Def): any => ({
    name: d.name, detail: d.detail, kind: d.kind === "fn" ? 12 : d.kind === "let" ? 13 : d.kind === "voice" ? 24 : 3,
    range: range(src, d.span), selectionRange: range(src, d.nameSpan), children: (d.children ?? []).map(conv),
  });
  return definitions(src).map(conv);
}

export function format(src: string): string {
  // Conservative: trailing spaces, tabs to two spaces, at most one blank line in a row, final newline.
  const lines = src.replace(/\r\n/g, "\n").split("\n").map(l => l.replace(/\t/g, "  ").replace(/\s+$/, ""));
  const out: string[] = [];
  for (const l of lines) { if (l === "" && out[out.length - 1] === "") continue; out.push(l); }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n") + "\n";
}

function semanticLegend() { return { tokenTypes: ["keyword", "number", "string", "function", "variable", "enumMember", "operator", "comment", "type", "parameter"], tokenModifiers: [] }; }

function semanticTokens(src: string) {
  let toks;
  try { toks = lex(src); } catch { return { data: [] }; }
  const data: number[] = [];
  let pl = 0, pc = 0;
  for (const t of toks) {
    let type = -1;
    if (t.type === "kw") type = 0;
    else if (t.type === "num") type = 1;
    else if (t.type === "str") type = 2;
    else if (t.type === "note" || t.type === "degree") type = 5;
    else if (t.type === "ident") type = builtins.has(t.text) ? 3 : t.text in DRUMS ? 5 : t.text in SCALES || INSTRUMENTS.includes(t.text) ? 8 : 4;
    if (type < 0 || t.end <= t.start) continue;
    const p = offsetToPos(src, t.start);
    data.push(p.line - pl, p.line === pl ? p.character - pc : p.character, t.end - t.start, type, 0);
    pl = p.line; pc = p.character;
  }
  return { data };
}

export function startServer() {
  let buf = Buffer.alloc(0);
  const timers = new Map<string, any>();
  const schedule = (uri: string) => { clearTimeout(timers.get(uri)); timers.set(uri, setTimeout(() => diagnose(uri), 180)); };
  process.stdin.on("data", (chunk: Buffer) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      const sep = buf.indexOf("\r\n\r\n");
      if (sep < 0) return;
      const m = buf.subarray(0, sep).toString().match(/Content-Length:\s*(\d+)/i);
      if (!m) { buf = buf.subarray(sep + 4); continue; }
      const len = parseInt(m[1], 10);
      if (buf.length < sep + 4 + len) return;
      const msg = JSON.parse(buf.subarray(sep + 4, sep + 4 + len).toString("utf8"));
      buf = buf.subarray(sep + 4 + len);
      handle(msg);
    }
  });
  const handle = (msg: any) => {
    const reply = (result: any) => send({ id: msg.id, result });
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
              semanticTokensProvider: { legend: semanticLegend(), full: true },
            },
            serverInfo: { name: "tine-lsp", version: VERSION },
          });
        case "initialized": return;
        case "shutdown": return reply(null);
        case "exit": process.exit(0);
        case "textDocument/didOpen": docs.set(P.textDocument.uri, P.textDocument.text); schedule(P.textDocument.uri); return;
        case "textDocument/didChange": docs.set(P.textDocument.uri, P.contentChanges[P.contentChanges.length - 1].text); schedule(P.textDocument.uri); return;
        case "textDocument/didClose": docs.delete(P.textDocument.uri); send({ method: "textDocument/publishDiagnostics", params: { uri: P.textDocument.uri, diagnostics: [] } }); return;
        case "textDocument/hover": return reply(hover(P.textDocument.uri, P.position));
        case "textDocument/completion": return reply(completion(P.textDocument.uri, P.position));
        case "textDocument/signatureHelp": return reply(signature(P.textDocument.uri, P.position));
        case "textDocument/definition": return reply(definition(P.textDocument.uri, P.position));
        case "textDocument/documentSymbol": return reply(symbols(P.textDocument.uri));
        case "textDocument/semanticTokens/full": return reply(semanticTokens(docs.get(P.textDocument.uri) ?? ""));
        case "textDocument/formatting": {
          const src = docs.get(P.textDocument.uri) ?? "";
          const out = format(src);
          if (out === src) return reply([]);
          return reply([{ range: { start: { line: 0, character: 0 }, end: offsetToPos(src, src.length) }, newText: out }]);
        }
        default:
          if (msg.id !== undefined) send({ id: msg.id, error: { code: -32601, message: `unhandled ${msg.method}` } });
      }
    } catch (e) {
      if (msg.id !== undefined) send({ id: msg.id, error: { code: -32603, message: String((e as Error).message) } });
    }
  };
}


