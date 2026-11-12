// Everything derived from the language must agree with it. When one of these
// fails after a language change, run `bun run sync` (or fix the doc sample it names).
import { test, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { evaluate, renderNotes, builtinList, KEYWORDS, SCALES, DRUMS, INSTRUMENTS, VERSION, describeWord } from "../src/core";
import { derivedFiles, version } from "../scripts/sync";
import { textmateGrammar, DECLARATIONS, DIRECTIVES } from "../scripts/grammar";

const root = join(import.meta.dir, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

// 1. Generated files are current.
for (const [path, want] of Object.entries(derivedFiles()))
  test(`${path} is current (run \`bun run sync\`)`, () => expect(read(path) === want).toBe(true));

// 2. One version everywhere.
test("one version: package.json, VERSION, the VS Code extension", () => {
  const v = version();
  expect(VERSION).toBe(v);
  expect(JSON.parse(read("editors/vscode/package.json")).version).toBe(v);
  expect(read("package.json")).toContain(`tine-${v}.vsix`);
});

// 3. Every word the language knows is highlighted as what it is.
const grammar = JSON.parse(textmateGrammar()).patterns as { name?: string; match?: string }[];
const rule = (name: string) => new RegExp(grammar.find(p => p.name === name)!.match!);
const whole = (re: RegExp, w: string) => { const m = re.exec(w); return !!m && m[0] === w; };
test("grammar: every builtin is a builtin", () => {
  const re = rule("support.function.builtin.tine");
  expect(builtinList().map(b => b.name).filter(n => !whole(re, n))).toEqual([]);
});
test("grammar: every scale and instrument", () => {
  const re = rule("support.type.scale.tine");
  expect([...Object.keys(SCALES), ...INSTRUMENTS].filter(n => !whole(re, n))).toEqual([]);
});
test("grammar: every drum", () => {
  const re = rule("support.constant.drum.tine");
  expect(Object.keys(DRUMS).filter(n => !whole(re, n))).toEqual([]);
});
test("grammar: every lexer keyword has a highlighting rule", () => {
  const all = JSON.stringify(grammar);
  expect([...KEYWORDS].filter(k => !new RegExp(`[(|]${k}[|)]`).test(all))).toEqual([]);
});
test("vim and emacs know every drum, scale and instrument", () => {
  const vim = read("editors/vim/syntax/tine.vim"), el = read("editors/emacs/tine-mode.el");
  const words = [...Object.keys(DRUMS), ...Object.keys(SCALES), ...INSTRUMENTS];
  expect(words.filter(w => !new RegExp(`\\s${w}(\\s|$)`, "m").test(vim))).toEqual([]);
  expect(words.filter(w => !el.includes(`"${w}"`))).toEqual([]);
});

// 4. Every statement keyword and builtin has a hover doc (the LSP, the DAW and JetBrains show them).
test("hover docs for every statement keyword", () => {
  expect([...DECLARATIONS, ...DIRECTIVES].filter(k => !describeWord(k))).toEqual([]);
});
test("every builtin has a signature, a doc and a category", () => {
  expect(builtinList().filter(b => !b.sig || !b.doc || !b.category).map(b => b.name)).toEqual([]);
});

// 5. Every fenced ```tine block in the README and docs runs and plays.
const mdFiles = ["README.md", ...readdirSync(join(root, "docs")).filter(f => f.endsWith(".md")).map(f => "docs/" + f),
  ...["editors/README.md", "editors/vscode/README.md"]];
for (const f of mdFiles) {
  let i = 0;
  for (const m of read(f).matchAll(/```tine\n([\s\S]*?)```/g)) {
    const n = ++i;
    test(`${f} tine block ${n} runs`, () => {
      const s = evaluate(m[1], { seed: 1, readFile: () => "" });
      expect(renderNotes(s, s.form ? undefined : 2).notes.length).toBeGreaterThan(0);
    });
  }
}
