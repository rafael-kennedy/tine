// Render course lessons as a learner meets them, with what every example plays,
// and flag rubric problems a machine can find. Usage: bun scripts/audit-course.ts [lessonId ...]
import { COURSE_LESSONS } from "../src/web/course/index";
import { evaluate, renderNotes, pitchName } from "../src/core";
import { DRUMS } from "../src/core/pitch";

const DRUM = Object.fromEntries(Object.entries(DRUMS).map(([k, v]) => [v, k]));
const text = (html: string) => html.replace(/<code>(.*?)<\/code>/g, "`$1`").replace(/<li>/g, "\n  - ").replace(/<tr>/g, "\n  | ").replace(/<\/t[dh]>/g, " | ").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n").trim();

function plays(code: string, bars?: number): string {
  try {
    const s = evaluate(code, { seed: 1 });
    const b = bars ?? 1;
    const { notes } = renderNotes(s, s.form ? undefined : b);
    const beats = s.meter[0];
    const byVoice = new Map<string, string[]>();
    for (const n of [...notes].sort((x, y) => x.bar - y.bar)) {
      const at = `${Math.floor(n.bar) + 1}.${Math.round(((n.bar % 1) * beats + 1) * 100) / 100}`;
      const name = n.params?.inst === "kit" ? DRUM[Math.round(n.semi)] ?? n.semi : pitchName(n.semi);
      const arr = byVoice.get(n.voice) ?? []; arr.push(`${at}:${name}/${Math.round(n.bars * beats * 100) / 100}`); byVoice.set(n.voice, arr);
    }
    const out = [...byVoice].map(([v, xs]) => `      ${v}: ${xs.slice(0, 40).join(" ")}${xs.length > 40 ? ` ...(+${xs.length - 40})` : ""}`);
    return [`      [${notes.length} notes over ${s.form ? "the form" : b + " bar(s)"}, tempo ${s.tempo}, meter ${s.meter.join("/")}]`, ...out, ...s.prints.map(p => "      print: " + p)].join("\n");
  } catch (e) { return "      ERROR: " + (e as Error).message.split("\n")[0]; }
}

const ids = process.argv.slice(2);
for (const l of COURSE_LESSONS.filter(l => !ids.length || ids.includes(l.id))) {
  const flags: string[] = [];
  console.log(`\n==================== ${l.label}. ${l.title}  [${l.unit.code}]  #${l.id}`);
  let prose = 0, examples = 0, suggest = 0, listens = 0, listenNoKey = 0, quizQs = 0;
  for (const p of l.parts) {
    if (typeof p === "string") {
      const t = text(p); prose++;
      if (prose >= 3) flags.push(`three prose blocks in a row with no sound before: "${t.slice(0, 50)}..."`);
      if (/\b(change|replace|try|edit|swap|add|remove|delete)\b/i.test(t)) suggest++;
      console.log("\n  PROSE: " + t.replace(/\n/g, "\n    "));
    } else if ("exercise" in p) {
      prose = 0;
      const e = p.exercise;
      console.log(`\n  CHALLENGE: ${text(e.task)}`);
      for (const [lab, code] of [["starter", e.starter], ["solution", e.solution]] as const) {
        let verdict = "";
        try { const s = evaluate(code, { seed: 1 }); verdict = e.check(s, renderNotes(s, e.bars ?? 1).notes) ?? "PASSES"; } catch (x) { verdict = "does not run: " + (x as Error).message.split("\n")[0]; }
        console.log(`    ${lab}: ${code.replace(/\n/g, " / ")}\n${plays(code, e.bars)}\n      check says: ${verdict}`);
      }
      if (e.hint) console.log(`    hint: ${text(e.hint)}`);
    } else if ("quiz" in p) {
      prose = 0;
      for (const q of p.quiz) {
        quizQs++;
        console.log(`\n  QUIZ: ${text(q.q)}  options: ${q.options.map((o, i) => (i === q.answer ? "*" : "") + text(o)).join(" | ")}${q.explain ? `  explain: ${text(q.explain)}` : ""}`);
        if (q.listen) {
          listens++;
          console.log(`    listen: ${q.listen.replace(/\n/g, " / ")}\n${plays(q.listen, q.bars ?? 2)}`);
        }
      }
    } else {
      prose = 0; examples++;
      if (/--.*\b(change|try|replace|swap|edit)\b/i.test(p.code)) suggest++;
      console.log(`\n  EXAMPLE${p.broken ? " (broken on purpose)" : ""}: ${p.code.replace(/\n/g, "\n           ")}\n${plays(p.code, p.bars)}`);
    }
  }
  if (examples < 4) flags.push(`only ${examples} examples`);
  if (suggest < 2) flags.push(`only ${suggest} suggested edits`);
  if (listens < 1) flags.push("no ear question");
  if (quizQs < 3) flags.push(`only ${quizQs} quiz questions`);
  console.log(`\n  FLAGS: ${flags.length ? flags.map(f => "\n    - " + f).join("") : "none"}`);
}
