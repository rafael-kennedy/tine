// Generates JetBrains IDE support into editors/jetbrains/ from the same sources
// the language server reads (builtins.ts, docs.ts), so nothing is hand-listed:
//   templates/*.xml           Live Templates: one per builtin, statement and word
//   tine-settings.zip         the same, packaged for File > Manage IDE Settings > Import Settings
//   tine-bundle/              a TextMate bundle (VS Code layout) for highlighting, brackets, comments
//   lsp4ij/tine/template.json an LSP4IJ template that runs `tine lsp`
//   plugin/src/main/resources/{liveTemplates,tine}/  data for the IntelliJ plugin:
//                             the same templates scoped to Tine files, and word lists for its lexer
import { mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { builtinList, SCALES, DRUMS, INSTRUMENT_DOCS } from "../src/core";
import { KEYWORDS } from "../src/core/lexer";
import { describeWord, KEYWORD_DOCS } from "../src/core/docs";

const root = join(import.meta.dir, "..");
const out = join(root, "editors/jetbrains");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;

// ---------- template model ----------

type Var = { name: string; def: string };
type Tpl = { name: string; text: string; vars: Var[]; desc: string };

// Template text treats $NAME$ as a variable, so a literal $ is $$.
const lit = (s: string) => s.replace(/\$/g, "$$$$");

function makeVars(defaults: string[]): { refs: string[]; vars: Var[] } {
  const vars: Var[] = [];
  const used = new Set(["END", "SELECTION"]);
  const refs = defaults.map((d, i) => {
    let name = /^[A-Za-z_]\w*$/.test(d) ? d.toUpperCase() : `ARG${i + 1}`;
    while (used.has(name)) name += "_";
    used.add(name);
    vars.push({ name, def: d });
    return `$${name}$`;
  });
  return { refs, vars };
}

// Split a parameter list on top-level commas: "p, n, f, at: n-1" -> 4 parts.
function splitParams(s: string): string[] {
  const parts: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) { parts.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

// A builtin's signature becomes its expansion. Optional named arguments
// ("at: n-1") and variadic "..." stay in the description, not the expansion.
// A first argument named p is a pattern, written as a method call: [c e g].fast(2).
function fromBuiltin(name: string, sig: string, doc: string, category: string): Tpl {
  const main = sig.split(" or ")[0];
  const m = main.match(/^\w+\((.*)\)$/);
  let params = m ? splitParams(m[1]) : [];
  params = params.filter(p => p !== "..." && !/^\.\.\./.test(p) && !/^\w+:\s/.test(p));
  const method = params[0] === "p";
  if (method) params = params.slice(1);
  const { refs, vars } = makeVars(params);
  const text = refs.length ? `${name}(${refs.join(", ")})$END$` : `${name}$END$`;
  const how = method ? `Method: p.${name}${refs.length ? "(...)" : ""}. ` : "";
  return { name, text, vars, desc: `${sig}  [${category}]  ${how}${doc}` };
}

// "tempo bpm\nBeats per minute." -> tempo $BPM$
function fromKeyword(word: string): Tpl {
  const [usage, ...rest] = KEYWORD_DOCS[word].split("\n");
  const args = usage.split("  /  ")[0].trim().split(/\s+/).slice(1);
  const simple = args.every(a => /^[A-Za-z_]\w*$/.test(a));
  const { refs, vars } = makeVars(simple ? args : [args.join(" ")]);
  return { name: word, text: `${word} ${refs.join(" ")}$END$`, vars, desc: `${usage}  [statement]  ${rest.join(" ")}` };
}

// VS Code snippet bodies (${1:x}, $0) become live template variables.
function fromSnippet(label: string, prefix: string, body: string[]): Tpl {
  const defs = new Map<string, string>();
  let text = lit(body.join("\n")).replace(/\$\$\{(\d+):([^}]*)\}/g, (_, n, d) => {
    defs.set(n, d.replace(/\$\$/g, "$"));
    return `$P${n}$`;
  }).replace(/\$\$0/g, "$END$");
  if (!text.includes("$END$")) text += "$END$";
  const vars = [...defs].sort((a, b) => +a[0] - +b[0]).map(([n, d]) => ({ name: `P${n}`, def: d }));
  return { name: prefix, text, vars, desc: `${label} (snippet)` };
}

const word = (name: string, desc: string): Tpl => ({ name, text: `${name}$END$`, vars: [], desc });

// ---------- collect ----------

const builtins = builtinList();
const builtinNames = new Set(builtins.map(b => b.name));
const functions = builtins.map(b => fromBuiltin(b.name, b.sig, b.doc, b.category));

const snippetSrc = JSON.parse(readFileSync(join(root, "editors/vscode/snippets.json"), "utf8"));
const snippets = Object.entries(snippetSrc).map(([label, s]: [string, any]) => fromSnippet(label, s.prefix, s.body));
for (const t of snippets) if (KEYWORD_DOCS[t.name]) t.desc += `  ${KEYWORD_DOCS[t.name].replace(/\n/g, "  ")}`;
const snippetNames = new Set(snippets.map(t => t.name));
const structure = [...snippets, ...Object.keys(KEYWORD_DOCS).filter(k => !snippetNames.has(k)).map(fromKeyword)];

const words: Tpl[] = [];
const seen = new Set<string>();
const addWord = (n: string) => {
  if (seen.has(n) || builtinNames.has(n) || !/^[A-Za-z_]\w*$/.test(n)) return;
  seen.add(n);
  words.push(word(n, describeWord(n)!.replace(/\n/g, "  ")));
};
Object.keys(SCALES).forEach(addWord);
Object.keys(DRUMS).forEach(addWord);
Object.keys(INSTRUMENT_DOCS).forEach(addWord);
// Instruments that share a name with a builtin (sine, saw, fm...) are completed
// by the builtin's template; say so in its description.
for (const t of functions) if (t.name in INSTRUMENT_DOCS) t.desc += `  Also an instrument: ${INSTRUMENT_DOCS[t.name]}`;

// ---------- Live Templates XML ----------

// Templates apply in the Everywhere context, the only one that reaches files
// highlighted by a TextMate bundle. Common languages are switched off so that
// "map" or "sum" do not pop up in Java, Python, etc. Unknown ids are ignored.
const OFF = ["JAVA_CODE", "KOTLIN", "GROOVY", "SCALA", "Python", "JAVA_SCRIPT", "TypeScript", "HTML", "XML",
  "CSS", "JSON", "YAML", "SQL", "MARKDOWN", "Properties", "SHELL_SCRIPT", "GO", "RUST", "PHP", "RUBY", "OC_SOURCE"];
const everywhere = `      <context>\n        <option name="OTHER" value="true" />\n${OFF.map(id => `        <option name="${id}" value="false" />`).join("\n")}\n      </context>`;

const x = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\n/g, "&#10;");

// Inside the plugin, templates use its own "TINE" context: Tine files only.
const tineOnly = `      <context>\n        <option name="TINE" value="true" />\n      </context>`;

function templateXml(t: Tpl, context = everywhere): string {
  const vars = t.vars.map(v => `      <variable name="${v.name}" expression="" defaultValue="${x(JSON.stringify(v.def))}" alwaysStopAt="true" />`);
  return [
    `    <template name="${x(t.name)}" value="${x(t.text)}" description="${x(t.desc)}" toReformat="false" toShortenFQNames="false">`,
    ...vars, context, `    </template>`,
  ].join("\n");
}

// Three groups, so each can be switched off on its own. A name may repeat
// across groups (the "key" statement and the key() function); the IDE then
// offers both.
const groups: [string, string, Tpl[]][] = [
  ["Tine-statements.xml", "Tine statements", structure],
  ["Tine-functions.xml", "Tine functions", functions],
  ["Tine-words.xml", "Tine words", words],
];
const xmlOf = (group: string, ts: Tpl[], context = everywhere) =>
  `<!-- Generated by scripts/gen-jetbrains.ts from Tine ${version}. Do not edit by hand. -->\n<templateSet group="${group}">\n${ts.map(t => templateXml(t, context)).join("\n")}\n</templateSet>\n`;
const all = groups.flatMap(g => g[2]);

// ---------- write ----------

// Clear only what this script writes; README.md is hand-written.
for (const d of ["templates", "tine-settings.zip", "tine-bundle", "lsp4ij"]) rmSync(join(out, d), { recursive: true, force: true });
mkdirSync(join(out, "templates"), { recursive: true });
for (const [file, group, ts] of groups) writeFileSync(join(out, "templates", file), xmlOf(group, ts));

// Import Settings expects a zip holding the settings folders plus this marker file.
const stage = join(out, ".settings-stage");
mkdirSync(join(stage, "templates"), { recursive: true });
for (const [file, group, ts] of groups) writeFileSync(join(stage, "templates", file), xmlOf(group, ts));
writeFileSync(join(stage, "IntelliJ IDEA Global Settings"), "");
// Fixed timestamps keep the zip byte-identical from run to run.
const epoch = new Date("2000-01-01T00:00:00Z");
for (const p of ["templates", ...groups.map(g => `templates/${g[0]}`), "IntelliJ IDEA Global Settings"]) utimesSync(join(stage, p), epoch, epoch);
execFileSync("zip", ["-qrX", join(out, "tine-settings.zip"), "templates", "IntelliJ IDEA Global Settings"], { cwd: stage });
rmSync(stage, { recursive: true });

// TextMate bundle in VS Code layout: grammar plus brackets and comments.
// (JetBrains reads snippets from bundles only in internal mode, so none are included.)
const bundle = join(out, "tine-bundle");
mkdirSync(join(bundle, "syntaxes"), { recursive: true });
copyFileSync(join(root, "editors/vscode/syntaxes/tine.tmLanguage.json"), join(bundle, "syntaxes/tine.tmLanguage.json"));
copyFileSync(join(root, "editors/vscode/language-configuration.json"), join(bundle, "language-configuration.json"));
writeFileSync(join(bundle, "package.json"), JSON.stringify({
  name: "tine", displayName: "Tine", version,
  contributes: {
    languages: [{ id: "tine", aliases: ["Tine"], extensions: [".tine"], configuration: "./language-configuration.json" }],
    grammars: [{ language: "tine", scopeName: "source.tine", path: "./syntaxes/tine.tmLanguage.json" }],
  },
}, null, 2) + "\n");

// LSP4IJ custom template: New Language Server > Template > Import from custom template.
mkdirSync(join(out, "lsp4ij/tine"), { recursive: true });
writeFileSync(join(out, "lsp4ij/tine/template.json"), JSON.stringify({
  id: "tine", name: "Tine",
  programArgs: { default: "tine lsp", windows: "cmd /C tine lsp" },
  fileTypeMappings: [{ fileType: { name: "Tine", patterns: ["*.tine"] }, languageId: "tine" }],
}, null, 2) + "\n");

// ---------- plugin resources ----------

const res = join(out, "plugin/src/main/resources");
for (const d of ["liveTemplates", "tine"]) rmSync(join(res, d), { recursive: true, force: true });
mkdirSync(join(res, "liveTemplates"), { recursive: true });
mkdirSync(join(res, "tine"), { recursive: true });
for (const [file, group, ts] of groups) writeFileSync(join(res, "liveTemplates", file), xmlOf(group, ts, tineOnly));
// One word per line. The lexer colors words by which list they are in.
const lists: Record<string, string[]> = {
  keywords: [...KEYWORDS],
  builtins: builtins.map(b => b.name),
  scales: Object.keys(SCALES),
  drums: Object.keys(DRUMS),
  instruments: Object.keys(INSTRUMENT_DOCS),
};
for (const [k, v] of Object.entries(lists)) writeFileSync(join(res, "tine", `${k}.txt`), v.join("\n") + "\n");
writeFileSync(join(res, "tine", "version.txt"), version + "\n");

console.log(`editors/jetbrains written: ${all.length} live templates (${structure.length} structure, ${functions.length} functions, ${words.length} words)`);
