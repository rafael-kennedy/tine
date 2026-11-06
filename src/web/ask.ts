// "Ask about this lesson": a small chat with Claude, available when the page
// is opened as a published Claude artifact (the `sample` capability). Claude
// gets the lesson text, the code currently in the page, a Tine primer, and a
// run_tine tool so it can check any example before it offers it. Tine code
// blocks in an answer become live cells. Elsewhere (tine theory on your own
// machine) the panel says how to get answers instead.
import { evaluate, renderNotes, builtinList, pitchName } from "../core";
import { DRUMS } from "../core/pitch";
import { h, makeCell } from "./cells";
import PRIMER_MD from "../../docs/REFERENCE.md" with { type: "text" };

type Turn = { role: "user" | "assistant"; content: string };
type Sample = ((input: string | Turn[], opts?: any) => Promise<{ text: string; truncated: boolean }>) & { limits?: () => Promise<any> };

const PRIMER = PRIMER_MD.split("\n## Built-in functions")[0] + "\n## Built-in functions (signature: description)\n" +
  builtinList().map(b => `${b.sig}: ${b.doc}`).join("\n");

let samplePromise: Promise<Sample | null> | null = null;
function getSample(): Promise<Sample | null> {
  if (!samplePromise) {
    const c = (window as any).claude;
    samplePromise = c?.use ? Promise.resolve(c.use("sample")).catch(() => null) : Promise.resolve(null);
  }
  return samplePromise;
}

export const ASK_CSS = `
.ask{border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:30px 0 10px;background:var(--ink2)}
.ask h3{margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--brass2)}
.ask .turn{margin:12px 0}
.ask .me{color:var(--mute);border-left:3px solid var(--line);padding-left:10px;white-space:pre-wrap}
.ask .ans p{margin:8px 0}
.ask .ans pre{background:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px 10px;overflow-x:auto}
.ask textarea{width:100%;box-sizing:border-box;min-height:64px;font:inherit;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:var(--ink);color:var(--text);resize:vertical}
.ask .row{display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap}
.ask .status{color:var(--mute);font-size:13px}
`;

const esc = (s: string) => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
function inline(s: string) {
  return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>");
}

// A small Markdown renderer: paragraphs, lists, inline code, bold. A ```tine block becomes a live cell.
function renderAnswer(md: string, el: HTMLElement, seed: () => number, live: boolean) {
  el.innerHTML = "";
  const parts = md.split(/```([a-z]*)\n?([\s\S]*?)(?:```|$)/);
  for (let i = 0; i < parts.length; i += 3) {
    for (const block of parts[i].split(/\n{2,}/)) {
      const b = block.trim(); if (!b) continue;
      const lines = b.split("\n");
      if (lines.every(l => /^\s*([-*]|\d+\.)\s/.test(l))) {
        const ul = h("ul");
        for (const l of lines) ul.append(h("li", { html: inline(l.replace(/^\s*([-*]|\d+\.)\s/, "")) }));
        el.append(ul);
      } else el.append(h("p", { html: inline(b).replace(/\n/g, "<br>") }));
    }
    if (i + 2 < parts.length) {
      const lang = parts[i + 1], code = parts[i + 2].replace(/\n$/, "");
      if (live && (lang === "tine" || lang === "")) el.append(makeCell({ code }, { seed }));
      else el.append(h("pre", {}, code));
    }
  }
}

// Run Tine code the way the page does, and describe what it plays in words Claude can check.
function runTine(code: string, bars: number, seed: number): string {
  try {
    const s = evaluate(code, { seed });
    const { notes } = renderNotes(s, s.form ? undefined : Math.max(1, Math.min(16, bars)));
    const beats = s.meter?.[0] ?? 4;
    const rows = notes.slice(0, 80).map(n => {
      const beat = (n.bar % 1) * beats + 1;
      const drum = n.params?.inst === "kit" || n.params?.drum ? DRUM_NAME[Math.round(n.semi)] : undefined;
      return `${n.voice}: bar ${Math.floor(n.bar) + 1} beat ${Math.round(beat * 100) / 100} ${drum ?? pitchName(n.semi)} for ${Math.round(n.bars * beats * 100) / 100} beat(s)`;
    });
    return [`${notes.length} notes.`, ...rows, notes.length > 80 ? "(more notes not shown)" : "", ...s.prints.map(p => "print: " + p)].filter(Boolean).join("\n");
  } catch (e) {
    return "Error: " + (e as Error).message;
  }
}

const DRUM_NAME: Record<number, string> = Object.fromEntries(Object.entries(DRUMS).map(([k, v]) => [v, k]));

const MESSAGE: Record<string, string> = {
  rate_limited: "Too many questions at once, or your Claude usage limit was reached. Try again in a little while.",
  session_expired: "Sign in to Claude again, then ask.",
  refused: "Claude could not answer that one. Try rewording the question.",
  empty_completion: "No answer came back. Try asking more simply.",
  prompt_too_large: "This lesson is too long to send whole. Ask about one part of it.",
};

export function makeAsk(o: { lessonTitle: string; unit: string; level: string; lessonText: () => string; pageCode: () => string[]; seed: () => number }): HTMLElement {
  const box = h("section", { class: "ask" });
  const log = h("div");
  const ta = h("textarea", { id: "ask-input", placeholder: "Ask anything about this lesson. For example: why does the octave number change at C?" }) as HTMLTextAreaElement;
  const askBtn = h("button", { class: "primary small" }, "Ask");
  const stopBtn = h("button", { class: "small" }, "Stop");
  const status = h("span", { class: "status" }, "");
  stopBtn.hidden = true;
  box.append(h("h3", {}, "Ask about this lesson"), log, ta, h("div", { class: "row" }, askBtn, stopBtn, status));
  const turns: Turn[] = [];
  let ctl: AbortController | null = null;

  const rules = () => [
    `You are a patient music theory tutor inside an interactive course called Tine Theory. The learner is on "${o.lessonTitle}" (${o.unit}, ${o.level}).`,
    `Examples in the course are written in Tine, a small language for music. Its reference is below. Do not invent syntax: when you give Tine code, call run_tine on it first and check that it plays what you say. Put Tine code in a fenced block marked tine; the page turns it into a playable example.`,
    `Answer the question asked, at the learner's level. Use plain words and short sentences. Define any term the lesson has not introduced. Prefer something the learner can hear: a short example they can play, with what to listen for. If the question is about their own code, look at it, run it, and say exactly what to change. Keep answers under about 200 words unless asked for more. Never use em-dashes.`,
    `--- The lesson, as the learner sees it ---\n${o.lessonText().slice(0, 14000)}`,
    `--- The code currently in each box on the page (the learner may have edited it) ---\n${o.pageCode().map((c, i) => `[box ${i + 1}]\n${c}`).join("\n\n").slice(0, 8000)}`,
    `--- Tine reference ---\n${PRIMER}`,
  ].join("\n\n");

  const addTurn = (who: "me" | "ans", text: string) => {
    const el = h("div", { class: "turn " + who });
    if (who === "me") el.textContent = text; else renderAnswer(text, el, o.seed, true);
    log.append(el);
    return el;
  };

  const ask = async () => {
    const q = ta.value.trim(); if (!q) return;
    const sample = await getSample();
    if (!sample) return;
    ta.value = ""; addTurn("me", q);
    turns.push({ role: "user", content: q });
    const out = h("div", { class: "turn ans" }, h("p", { class: "status" }, "Thinking..."));
    log.append(out);
    askBtn.disabled = true; stopBtn.hidden = false; status.textContent = "";
    ctl = new AbortController();
    const limits = await sample.limits?.().catch(() => null);
    const tools = limits?.tools ? [{
      name: "run_tine",
      description: "Run Tine code exactly as the course page does and get back every note it plays (voice, bar, beat, note name, length in beats), or the error message. Use it to check any code before you show it, and to see what the learner's code really does.",
      inputSchema: { type: "object", properties: { code: { type: "string", description: "Tine source code" }, bars: { type: "number", description: "How many bars to render, 1 to 16. Default 2." } }, required: ["code"] },
      execute: (input: any) => { status.textContent = "Trying the code..."; return runTine(String(input.code ?? ""), Number(input.bars ?? 2) || 2, o.seed()); },
    }] : undefined;
    try {
      const recent = turns.slice(-9); while (recent[0]?.role === "assistant") recent.shift();
      const input: Turn[] = [{ role: "user", content: rules() }, ...recent];
      const { text, truncated } = await sample(input, {
        cache: tools ? undefined : false, tools, signal: ctl.signal,
        onText: ({ text }: { text: string }) => { status.textContent = ""; renderAnswer(text, out, o.seed, false); },
      });
      renderAnswer(text, out, o.seed, true);
      turns.push({ role: "assistant", content: text });
      if (truncated) status.textContent = "The answer was cut short. Ask for one part at a time.";
    } catch (e: any) {
      if (e?.text && e.code !== "refused") renderAnswer(e.text, out, o.seed, true); else out.remove();
      turns.pop();
      if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(e?.code)) {
        box.replaceChildren(h("h3", {}, "Ask about this lesson"), h("p", { class: "dim" }, "Asking Claude is turned off for this page. You can allow it from the page's Permissions menu."));
      } else if (e?.code !== "cancelled") status.textContent = MESSAGE[e?.code] ?? "The answer was interrupted. Try again.";
    } finally {
      askBtn.disabled = false; stopBtn.hidden = true; ctl = null;
    }
  };
  askBtn.onclick = ask;
  stopBtn.onclick = () => ctl?.abort();
  ta.onkeydown = (e: KeyboardEvent) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ask(); } };

  // Without the capability (a local copy, or another host), say where answers can come from.
  box.hidden = true;
  getSample().then(s => {
    if (s) { box.hidden = false; return; }
    box.replaceChildren(h("h3", {}, "Questions?"), h("p", { class: "dim", html: "Open the published course in Claude to ask questions about any lesson. The full language reference is in <code>docs/REFERENCE.md</code>." }));
    box.hidden = false;
  });
  return box;
}
