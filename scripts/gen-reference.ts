import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { builtinList, SCALES, DRUMS, CHORDS, INSTRUMENT_DOCS, parseQuality } from "../src/core";
export function referenceMarkdown(): string {
const head = readFileSync(join(import.meta.dir, "../docs/reference-head.md"), "utf8");
let out = head + "\n## Built-in functions\n\nAny function can be called as `f(x, y)` or, on its first argument, as `x.f(y)`. With no other arguments the parentheses are optional: `p.rev`.\n";
const byCat = new Map<string, ReturnType<typeof builtinList>>();
for (const b of builtinList()) { if (!byCat.has(b.category)) byCat.set(b.category, []); byCat.get(b.category)!.push(b); }
for (const [cat, bs] of byCat) {
  out += `\n### ${cat[0].toUpperCase() + cat.slice(1)}\n\n| Function | Description |\n| --- | --- |\n`;
  for (const b of bs) out += `| \`${b.sig.replace(/\|/g, "\\|")}\` | ${b.doc.replace(/\|/g, "\\|")} |\n`;
}
out += `\n## Scales\n\n| Name | Steps (semitones) |\n| --- | --- |\n`;
for (const [k, s] of Object.entries(SCALES)) out += `| \`${k}\` | ${s.steps.map(x => Math.round(x * 100) / 100).join(" ")}${Math.abs(s.period - 12) > 1e-9 ? ` (period ${Math.round(s.period * 100) / 100})` : ""} |\n`;
out += `\n## Chord qualities\n\nAfter \`@\` you write a chord symbol the way a lead sheet does: \`c@maj7\`, \`g@7b9\`, \`f#@m7b5\`, \`bb@13#11\`, \`d@9sus4\`, \`eb@7alt\`, and a slash bass with \`c@7/e\`. On a degree, plain numbers count diatonic chord tones (\`^5@7\` is the seventh chord on the fifth degree, \`^2@3\` a triad), symbols give a fixed quality (\`^2@m7\`), and on an altered degree a number names the quality (\`^b7@7\` is a dominant seventh). \`changes("Dm7 G7 | Cmaj7")\` reads whole lead sheets with the same symbols.\n\n`;
out += `Symbols are parsed, not looked up, so they combine freely. The grammar: a family (\`m\`, \`maj\`/\`M\`, \`dim\`/\`o\`, \`aug\`/\`+\`, \`m7b5\`, \`mmaj\`), then a number (\`5 6 69 7 9 11 13\`; 9, 11 and 13 include the seventh and the extensions below them, except 13 skips the 11 on major and dominant chords), then any of \`sus2 sus4 sus\`, \`b5 #5 b9 #9 #11 b13\`, \`add2 add4 add9 add11 add13\`, \`no3 no5\`, \`alt\` (b9, #9 and b13 with no fifth). Some examples:\n\n| Symbol | Semitones |\n| --- | --- |\n`;
for (const k of ["", "m", "7", "maj7", "m7", "m7b5", "dim7", "mmaj7", "6", "69", "9", "maj9", "m9", "11", "m11", "13", "m13", "7sus4", "9sus4", "7b9", "7#9", "7#11", "7b13", "7alt", "maj7#11", "aug", "7#5"]) out += `| \`${k || "(none: major)"}\` | ${parseQuality(k)!.join(" ")} |\n`;
out += `\nAlso available by name: ${Object.keys(CHORDS).map(k => "\`" + k + "\`").join(", ")} (including \`otonal\` and \`utonal\` for just intonation).\n`;
out += `\n## Drums\n\n| Name | General MIDI note |\n| --- | --- |\n`;
for (const [k, v] of Object.entries(DRUMS)) out += `| \`${k}\` | ${v} |\n`;
out += `\n## Instruments\n\n| Name | Sound |\n| --- | --- |\n`;
for (const [k, v] of Object.entries(INSTRUMENT_DOCS)) out += `| \`${k}\` | ${v} |\n`;
return out;
}

if (import.meta.main) {
  writeFileSync(join(import.meta.dir, "../docs/REFERENCE.md"), referenceMarkdown());
  console.log("docs/REFERENCE.md written");
}
