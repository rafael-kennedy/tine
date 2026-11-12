// Generates the TextMate grammar (VS Code, Sublime, JetBrains TextMate bundles, GitHub Linguist-style highlighters).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { builtinList, SCALES, DRUMS, INSTRUMENTS, KEYWORDS } from "../src/core";

// Keyword classes. Every lexer keyword lands in exactly one, so a keyword added
// to the lexer is highlighted (as a directive) without editing this file.
export const DECLARATIONS = ["let", "voice", "section"];
export const CONTROL = ["if", "then", "else", "and", "or", "not"];
export const BOOLEANS = ["true", "false"];
export const DIRECTIVES = [...KEYWORDS].filter(k => ![...DECLARATIONS, ...CONTROL, ...BOOLEANS].includes(k));

const names = (xs: string[]) => xs.sort((a, b) => b.length - a.length).map(x => x.replace(/[#]/g, "\\#")).join("|");
export function textmateGrammar(): string {
const g = {
  $schema: "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
  name: "Tine", scopeName: "source.tine", fileTypes: ["tine"],
  patterns: [
    { name: "entity.name.tag.toggle.tine", match: "--\\s*@[A-Za-z0-9_]+\\s*$" },
    { name: "comment.line.double-dash.tine", match: "--.*$" },
    { name: "string.quoted.double.tine", begin: "\"", end: "\"", patterns: [{ name: "constant.character.escape.tine", match: "\\\\." }] },
    { match: "^\\s*(?:(active)\\s+)?(voice|section)\\s+([A-Za-z_][A-Za-z0-9_#]*)", captures: { 1: { name: "storage.modifier.tine" }, 2: { name: "keyword.declaration.tine" }, 3: { name: "entity.name.section.tine" } } },
    { match: "^\\s*(let)\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*(\\()", captures: { 1: { name: "keyword.declaration.tine" }, 2: { name: "entity.name.function.tine" } } },
    { match: "^\\s*(let)\\s+([A-Za-z_][A-Za-z0-9_]*)", captures: { 1: { name: "keyword.declaration.tine" }, 2: { name: "variable.other.definition.tine" } } },
    { name: "keyword.control.tine", match: `\\b(${CONTROL.join("|")})\\b` },
    { name: "keyword.other.directive.tine", match: `^\\s*(${DIRECTIVES.join("|")})\\b` },
    { name: "constant.language.boolean.tine", match: "\\b(true|false|silence)\\b" },
    { name: "constant.other.degree.tine", match: "\\^(#|b)*-?\\d+" },
    { name: "constant.other.note.tine", match: "\\b[A-Ga-g](#|b)*\\d?(?![A-Za-z0-9_#])" },
    { name: "constant.numeric.tine", match: "\\b\\d+(\\.\\d+)?(hz|c(?![A-Za-z0-9_])|\\\\\\d+)?" },
    { name: "constant.numeric.tine", match: "(?<![A-Za-z0-9_\\)\\]])\\.\\d+" },
    { name: "support.constant.drum.tine", match: `\\b(${names(Object.keys(DRUMS))})\\b` },
    { name: "support.type.scale.tine", match: `\\b(${names([...Object.keys(SCALES), ...INSTRUMENTS])})\\b` },
    { name: "support.function.builtin.tine", match: `\\b(${names(builtinList().map(b => b.name))})\\b(?=\\s*\\(|)` },
    { name: "keyword.operator.chord.tine", match: "@[A-Za-z0-9#+]+(/[A-Ga-g](#|b)?\\d?)?" },
    { name: "keyword.operator.arrow.tine", match: "=>" },
    { name: "keyword.operator.phrase.tine", match: "[|?!_]" },
    { name: "keyword.operator.tine", match: "\\*\\*|==|!=|<=|>=|\\.\\.|[-+*/%=]" },
    { name: "punctuation.section.phrase.tine", match: "[\\[\\]{}<>]" },
    { name: "variable.other.tine", match: "\\b[A-Za-z_][A-Za-z0-9_]*\\b" },
  ],
};
return JSON.stringify(g, null, 2);
}

if (import.meta.main) {
  const out = textmateGrammar();
  writeFileSync(join(import.meta.dir, "../editors/vscode/syntaxes/tine.tmLanguage.json"), out);
  writeFileSync(join(import.meta.dir, "../editors/textmate/tine.tmLanguage.json"), out);
  console.log("grammar written");
}
