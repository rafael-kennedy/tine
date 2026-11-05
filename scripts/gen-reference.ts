import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { builtinList, SCALES, DRUMS, CHORDS, INSTRUMENT_DOCS } from "../src/core";
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
out += `\n## Chord qualities\n\nOn a pitch: \`c4@maj7\`. On a degree, numbers count diatonic chord tones (\`^5@7\` is the seventh chord on the fifth degree) and names give a fixed quality (\`^2@m7\`).\n\n| Quality | Semitones |\n| --- | --- |\n`;
for (const [k, v] of Object.entries(CHORDS)) out += `| \`${k}\` | ${v.map(x => Math.round(x * 100) / 100).join(" ")} |\n`;
out += `\n## Drums\n\n| Name | General MIDI note |\n| --- | --- |\n`;
for (const [k, v] of Object.entries(DRUMS)) out += `| \`${k}\` | ${v} |\n`;
out += `\n## Instruments\n\n| Name | Sound |\n| --- | --- |\n`;
for (const [k, v] of Object.entries(INSTRUMENT_DOCS)) out += `| \`${k}\` | ${v} |\n`;
writeFileSync(join(import.meta.dir, "../docs/REFERENCE.md"), out);
console.log("docs/REFERENCE.md written");
