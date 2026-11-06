// CodeMirror setup shared by the DAW, the tutorial and the player.
import { EditorView, keymap, hoverTooltip, Decoration, DecorationSet, ViewPlugin, ViewUpdate, lineNumbers, highlightActiveLine, drawSelection } from "@codemirror/view";
import { EditorState, Extension, StateField, StateEffect } from "@codemirror/state";
import { StreamLanguage, HighlightStyle, syntaxHighlighting, indentUnit, bracketMatching, StringStream } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { defaultKeymap, history, historyKeymap, indentWithTab, toggleComment } from "@codemirror/commands";
import { autocompletion, CompletionContext, closeBrackets } from "@codemirror/autocomplete";
import { builtinList, KEYWORDS, NOTE_RE, SCALES, DRUMS, INSTRUMENTS, describeWord } from "../core";

const builtins = new Map(builtinList().map(b => [b.name, b]));

const tineMode = StreamLanguage.define<{ inPhrase: number }>({
  name: "tine",
  startState: () => ({ inPhrase: 0 }),
  token(stream: StringStream, state) {
    if (stream.eatSpace()) return null;
    if (stream.match(/^--\s*@[A-Za-z0-9_]+\s*$/)) return "labelName"; // a performance toggle tag
    if (stream.match("--")) { stream.skipToEnd(); return "comment"; }
    if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return "string";
    if (stream.match(/^\^(?:#|b)*-?\d+/)) return "atom";
    if (stream.match(/^\d+(?:\.\d+)?(?:hz|c(?![A-Za-z0-9_])|\\\d+)?/)) return "number";
    if (stream.match(/^[A-Za-z_][A-Za-z0-9_#]*/)) {
      const w = stream.current();
      if (NOTE_RE.test(w)) return "atom";
      if (w === "active" && stream.match(/^\s+voice\b/, false)) return "keyword";
      if (KEYWORDS.has(w)) return w === "true" || w === "false" ? "bool" : "keyword";
      if (w in DRUMS) return "special";
      if (builtins.has(w)) return "function";
      if (w in SCALES || INSTRUMENTS.includes(w)) return "typeName";
      return "variableName";
    }
    if (stream.match(/^@[A-Za-z0-9#+]+(?:\/[A-Ga-g](?:#|b)?\d?)?/)) return "operator";
    const ch = stream.next()!;
    if ("[{<".includes(ch)) { state.inPhrase++; return "bracket"; }
    if ("]}>".includes(ch)) { state.inPhrase = Math.max(0, state.inPhrase - 1); return "bracket"; }
    if (ch === "." && state.inPhrase && !/[A-Za-z_]/.test(stream.peek() ?? "")) return "meta";
    if (ch === "_" ) return "meta";
    if ("|?@!*:".includes(ch) && state.inPhrase) return "operator";
    if ("+-*/%=<>!&|@".includes(ch)) return "operator";
    return null;
  },
  languageData: { commentTokens: { line: "--" }, closeBrackets: { brackets: ["(", "[", "{", '"'] } },
  tokenTable: { special: t.special(t.variableName), typeName: t.typeName, function: t.function(t.variableName), bool: t.bool },
});

export const tineHighlight = HighlightStyle.define([
  { tag: t.comment, color: "var(--c-comment)", fontStyle: "italic" },
  { tag: t.keyword, color: "var(--c-keyword)", fontWeight: "600" },
  { tag: t.labelName, color: "var(--teal)", fontWeight: "600" },
  { tag: t.atom, color: "var(--c-note)" },
  { tag: t.number, color: "var(--c-number)" },
  { tag: t.string, color: "var(--c-string)" },
  { tag: t.function(t.variableName), color: "var(--c-fn)" },
  { tag: t.special(t.variableName), color: "var(--c-drum)" },
  { tag: t.typeName, color: "var(--c-type)" },
  { tag: t.meta, color: "var(--c-rest)", fontWeight: "700" },
  { tag: t.operator, color: "var(--c-op)" },
  { tag: t.bracket, color: "var(--c-bracket)" },
  { tag: t.bool, color: "var(--c-number)" },
]);

function complete(ctx: CompletionContext) {
  const w = ctx.matchBefore(/[A-Za-z_][A-Za-z0-9_]*/);
  if (!w || (w.from === w.to && !ctx.explicit)) return null;
  const doc = ctx.state.doc.toString();
  const locals = new Set<string>();
  for (const m of doc.matchAll(/\blet\s+([A-Za-z_][A-Za-z0-9_]*)/g)) locals.add(m[1]);
  const options = [
    ...builtinList().map(b => ({ label: b.name, type: "function", detail: b.sig, info: b.doc })),
    ...[...KEYWORDS].map(k => ({ label: k, type: "keyword" })),
    ...Object.keys(SCALES).map(s => ({ label: s, type: "type", detail: "scale" })),
    ...Object.keys(DRUMS).map(d => ({ label: d, type: "constant", detail: `drum ${DRUMS[d]}` })),
    ...INSTRUMENTS.map(i => ({ label: i, type: "type", detail: "instrument" })),
    ...[...locals].map(l => ({ label: l, type: "variable" })),
  ];
  return { from: w.from, options, validFor: /^[A-Za-z0-9_]*$/ };
}

const hover = hoverTooltip((view, pos) => {
  const line = view.state.doc.lineAt(pos);
  const text = line.text;
  let s = pos - line.from, e = s;
  while (s > 0 && /[A-Za-z0-9_#^]/.test(text[s - 1])) s--;
  while (e < text.length && /[A-Za-z0-9_#]/.test(text[e])) e++;
  const word = text.slice(s, e);
  if (!word) return null;
  let info = describeWord(word);
  if (!info && /^\^/.test(word)) info = `scale degree ${word}: resolves in the current key`;
  if (!info) return null;
  return {
    pos: line.from + s, end: line.from + e, above: true,
    create: () => { const d = document.createElement("div"); d.className = "tine-tip"; d.textContent = info!; return { dom: d }; },
  };
});

// error underline
export const setErrorEffect = StateEffect.define<{ from: number; to: number; msg: string } | null>();
const errorMark = Decoration.mark({ class: "tine-error" });
const errorField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = tr.docChanged ? Decoration.none : deco;
    for (const e of tr.effects) if (e.is(setErrorEffect)) {
      if (!e.value) deco = Decoration.none;
      else {
        const len = tr.state.doc.length;
        const from = Math.max(0, Math.min(e.value.from, len)), to = Math.max(from + 1, Math.min(e.value.to, len));
        deco = from < len ? Decoration.set([Decoration.mark({ class: "tine-error", attributes: { title: e.value.msg } }).range(from, to)]) : Decoration.none;
      }
    }
    return deco;
  },
  provide: f => EditorView.decorations.from(f),
});

// flash evaluated text
export const flashEffect = StateEffect.define<{ from: number; to: number }>();
const flashField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(flashEffect)) deco = e.value.to > e.value.from ? Decoration.set([Decoration.mark({ class: "tine-flash" }).range(e.value.from, e.value.to)]) : Decoration.none;
    }
    return deco;
  },
  provide: f => EditorView.decorations.from(f),
});

export function flash(view: EditorView, from = 0, to = view.state.doc.length) {
  view.dispatch({ effects: flashEffect.of({ from, to }) });
  setTimeout(() => view.dispatch({ effects: flashEffect.of({ from: 0, to: 0 }) }), 220);
}

export function showError(view: EditorView, span: { start: number; end: number } | undefined, msg: string) {
  view.dispatch({ effects: setErrorEffect.of(span ? { from: span.start, to: span.end, msg } : null) });
}

export interface EditorOpts {
  doc: string;
  parent: HTMLElement;
  onEval?: () => void;
  onStop?: () => void;
  onSave?: () => void;
  onChange?: (doc: string) => void;
  compact?: boolean;
}

export function makeEditor(o: EditorOpts): EditorView {
  const keys = keymap.of([
    { key: "Mod-Enter", run: () => { o.onEval?.(); return true; } },
    { key: "Shift-Enter", run: () => { o.onEval?.(); return true; } },
    { key: "Mod-.", run: () => { o.onStop?.(); return true; } },
    { key: "Mod-s", run: () => { o.onSave?.(); return true; }, preventDefault: true },
    { key: "Mod-/", run: toggleComment },
    indentWithTab,
  ]);
  const ext: Extension[] = [
    keys,
    history(),
    drawSelection(),
    bracketMatching(),
    closeBrackets(),
    indentUnit.of("  "),
    tineMode,
    syntaxHighlighting(tineHighlight),
    autocompletion({ override: [complete], icons: false }),
    hover,
    errorField, flashField,
    keymap.of([...defaultKeymap, ...historyKeymap]),
    EditorView.lineWrapping,
    EditorView.updateListener.of((u: ViewUpdate) => { if (u.docChanged) o.onChange?.(u.state.doc.toString()); }),
  ];
  if (!o.compact) ext.push(lineNumbers(), highlightActiveLine());
  return new EditorView({ state: EditorState.create({ doc: o.doc, extensions: ext }), parent: o.parent });
}
