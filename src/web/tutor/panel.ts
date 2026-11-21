// The tutor panel: a chat about Tine and music theory that can see the page's
// editors, their errors and output, run code to check itself, and propose
// changes the learner applies with one click (and undoes with Ctrl/Cmd+Z).
import type { EditorView } from "@codemirror/view";
import { h, makeCell } from "../cells";
import { connect, settings, MODELS, EFFORTS, Backend, Session, Tool } from "./backend";
import { runTine, errorsIn, describeEditor, applyEdits, diffLines, trimDiff, Edit } from "./tools";
import REFERENCE from "../../../docs/REFERENCE.md" with { type: "text" };

export interface TutorOptions {
  where: string;                                   // where the learner is, in a sentence
  audience?: string;                               // who they are, if known
  editors: () => { label: string; view: EditorView }[];
  extra?: () => string;                            // page state that changes, sent with each question
  page?: () => string;                             // page text that does not change, read once
  seed: () => number;
  compact?: boolean;                               // narrow side panel (the DAW)
  quick?: string[];                                // one-tap questions
  title?: string;
}

export const TUTOR_CSS = `
.tutor{display:flex;flex-direction:column;gap:8px}
.tutor [hidden]{display:none !important}
.tutor.boxed{border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:30px 0 10px;background:var(--ink2)}
.tutor .hd{display:flex;align-items:center;gap:8px}
.tutor .hd h3{margin:0;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--brass2);flex:1}
.tutor .log{display:flex;flex-direction:column;gap:12px}
.tutor .me{color:var(--mute);border-left:3px solid var(--line);padding-left:10px;white-space:pre-wrap}
.tutor .ans p{margin:8px 0;line-height:1.55}
.tutor .ans ul{margin:6px 0;padding-left:20px}
.tutor .ans pre{background:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px 10px;overflow-x:auto;font-family:var(--mono);font-size:12.5px}
.tutor .ans h4{margin:12px 0 4px;font-size:13px;color:var(--text);text-transform:none;letter-spacing:0}
.tutor textarea{width:100%;box-sizing:border-box;min-height:60px;font:inherit;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:var(--ink);color:var(--text);resize:vertical}
.tutor .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;border:none;padding:0}
.tutor .status{color:var(--mute);font-size:12.5px}
.tutor .chip{font-size:12px;padding:3px 9px;border-radius:999px}
.tutor .prop{border:1px solid var(--brass);border-radius:10px;margin:10px 0;overflow:hidden}
.tutor .prop .why{padding:6px 10px;font-size:13px;background:color-mix(in srgb,var(--brass) 12%,transparent)}
.tutor .prop .diff{font-family:var(--mono);font-size:12px;margin:0;padding:6px 0;overflow-x:auto;background:var(--ink);white-space:pre}
.tutor .prop .diff div{padding:0 10px}
.tutor .prop .diff .add{background:color-mix(in srgb,var(--ok) 18%,transparent)}
.tutor .prop .diff .del{background:color-mix(in srgb,var(--coral) 18%,transparent);text-decoration:line-through;text-decoration-color:color-mix(in srgb,var(--coral) 60%,transparent)}
.tutor .prop .diff .gap{color:var(--faint)}
.tutor .prop .row{padding:6px 10px}
.tutor .set{border:1px solid var(--line);border-radius:10px;padding:10px;font-size:13px;display:flex;flex-direction:column;gap:8px}
.tutor .set label{display:flex;align-items:center;gap:8px}
.tutor .set label > span{width:58px;color:var(--mute);flex:none}
.tutor .set select,.tutor .set input{flex:1;min-width:0}
.tutor .set .warn{color:var(--mute);font-size:12px;margin:0}
.tutor.compact .ans .cell{margin:8px 0}
`;

const RULES = (o: TutorOptions) => `You are the tutor built into Tine, a programming language for music. ${o.where}${o.audience ? ` The learner is ${o.audience}.` : ""}

You teach two things: the Tine language, and music theory through it. Explain, and demonstrate.

What you can see. Each question arrives with a snapshot of the page: the code in each editor with line numbers, any errors the language reports, print output, and other state. Read it before answering. A snapshot is left out when nothing changed since the last one.

Tools.
- run_tine runs code exactly as the page does and lists every note it plays, or the error. Call it on any Tine code before you show it, and on the learner's code when you need to know what it really does. Do not guess what code plays.
- propose_edit proposes a change to one of the learner's editors. They see it as a diff with an Apply button and decide. Use it when they ask you to fix, change or extend their code. Do not use it for examples that stand on their own; put those in the answer.

Rules for code.
- Use only syntax and functions the reference below documents. Do not invent any. If unsure, try it with run_tine.
- Put example code in a fenced block marked tine. The page turns it into a cell the learner can play and edit. Keep examples short, and say what to listen for.
- To explain an error, point to the line, say what the language expected, and show the fix.
- For a checked exercise or challenge, give a hint and name the idea first. Give the full answer only when they ask for it.

Style. Plain words, short sentences. Define any musical term the learner may not know. Prefer something they can hear over a description. Keep answers under about 200 words unless asked for more. Never use em-dashes.

--- Tine reference ---
${REFERENCE}${o.page ? `\n\n--- The page, as the learner sees it ---\n${o.page()}` : ""}`;

const esc = (s: string) => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
const inline = (s: string) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>");

// A small Markdown renderer: headings, paragraphs, lists, inline code, bold. A tine block becomes a live cell once the answer is complete.
function renderAnswer(md: string, el: HTMLElement, seed: () => number, live: boolean) {
  el.innerHTML = "";
  const parts = md.split(/```([a-z]*)\n?([\s\S]*?)(?:```|$)/);
  for (let i = 0; i < parts.length; i += 3) {
    for (const block of parts[i].split(/\n{2,}/)) {
      const b = block.trim(); if (!b) continue;
      const lines = b.split("\n");
      if (/^#{1,6}\s/.test(b) && lines.length === 1) el.append(h("h4", { html: inline(b.replace(/^#+\s*/, "")) }));
      else if (lines.every(l => /^\s*([-*]|\d+\.)\s/.test(l))) {
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

// Replace only the part of the document that changed, as one undoable step.
function replaceMinimal(view: EditorView, next: string) {
  const cur = view.state.doc.toString();
  let a = 0; while (a < cur.length && a < next.length && cur[a] === next[a]) a++;
  let b = 0; while (b < cur.length - a && b < next.length - a && cur[cur.length - 1 - b] === next[next.length - 1 - b]) b++;
  view.dispatch({ changes: { from: a, to: cur.length - b, insert: next.slice(a, next.length - b) }, userEvent: "input.tutor" });
  view.focus();
}

export function makeTutor(o: TutorOptions): HTMLElement {
  const box = h("section", { class: "tutor" + (o.compact ? " compact" : " boxed") });
  const log = h("div", { class: "log" });
  const ta = h("textarea", { placeholder: o.compact ? "Ask about your code, an error, or any music idea." : "Ask about this lesson, your code, or any music idea." }) as HTMLTextAreaElement;
  const askBtn = h("button", { class: "primary small" }, "Ask");
  const stopBtn = h("button", { class: "small" }, "Stop");
  const status = h("span", { class: "status" }, "");
  const gear = h("button", { class: "small", title: "Tutor settings" }, "⚙");
  const clearBtn = h("button", { class: "small", title: "Start a new conversation" }, "new chat");
  const quick = h("div", { class: "row" });
  const setPane = h("div", { class: "set" });
  setPane.hidden = true;
  stopBtn.hidden = true;
  box.append(h("div", { class: "hd" }, h("h3", {}, o.title ?? "Tutor"), clearBtn, gear), setPane, log, quick, ta, h("div", { class: "row" }, askBtn, stopBtn, status));

  let backend: Backend | null = null;
  let session: Session | null = null;
  let lastSnapshot = "";
  let ctl: AbortController | null = null;
  let current: HTMLElement | null = null; // where proposals for the answer in progress go

  // ---------- what the model sees ----------
  const snapshot = () => {
    const eds = o.editors().map(e => describeEditor({ label: e.label, code: e.view.state.doc.toString() }, o.seed()));
    return [eds.join("\n\n"), o.extra?.() ?? ""].filter(Boolean).join("\n\n");
  };

  // ---------- tools ----------
  const tools: Tool[] = [
    {
      name: "run_tine", status: "Trying the code...",
      description: "Run Tine code exactly as the page does. Returns tempo, meter and every note it plays (voice, bar, beat, note name, length in beats) and any print output, or the error with its line. Use it to check code before you show it and to see what the learner's code really does.",
      input_schema: { type: "object", properties: { code: { type: "string", description: "Tine source code" }, bars: { type: "number", description: "How many bars to render, 1 to 16. Default 2." } }, required: ["code"] },
      run: input => {
        if (typeof input.code !== "string") throw new Error("code must be a string");
        return runTine(input.code, Number(input.bars ?? 2) || 2, o.seed());
      },
    },
    {
      name: "propose_edit", status: "Preparing a change...",
      description: "Propose a change to one of the learner's editors. Each edit replaces one exact piece of the editor's current text (copy it from the snapshot without the line-number prefix) with new text; the piece must occur exactly once. To fill an empty editor, use one edit with an empty find. The change is checked by running it, then shown to the learner as a diff with an Apply button. Returns whether it ran cleanly.",
      input_schema: {
        type: "object",
        properties: {
          editor: { type: "string", description: "The editor's label from the snapshot. May be left out when there is only one." },
          edits: { type: "array", items: { type: "object", properties: { find: { type: "string" }, replace: { type: "string" } }, required: ["find", "replace"] } },
          summary: { type: "string", description: "One short sentence the learner sees above the diff: what the change does." },
        },
        required: ["edits", "summary"],
      },
      run: input => {
        const eds = o.editors();
        const target = typeof input.editor === "string" ? eds.find(e => e.label === input.editor) : eds.length === 1 ? eds[0] : undefined;
        if (!target) throw new Error(`name an editor: ${eds.map(e => e.label).join(", ") || "there are none on this page"}`);
        if (!Array.isArray(input.edits) || !input.edits.every((e: any) => typeof e?.find === "string" && typeof e?.replace === "string")) throw new Error("edits must be a list of {find, replace} strings");
        const edits = input.edits as Edit[];
        const before = target.view.state.doc.toString();
        const r = applyEdits(before, edits);
        if ("error" in r) throw new Error(r.error);
        const bad = errorsIn(r.code, o.seed());
        showProposal(target, edits, r.code, String(input.summary ?? ""));
        return bad ? `Shown to the learner, but it does not run:\n${bad}\nFix it with another propose_edit, or explain the problem.` : "Shown to the learner with an Apply button. It runs without errors.";
      },
    },
  ];

  function showProposal(target: { label: string; view: EditorView }, edits: Edit[], after: string, summary: string) {
    const before = target.view.state.doc.toString();
    const d = h("div", { class: "diff" });
    for (const l of trimDiff(diffLines(before, after))) {
      if (!l) { d.append(h("div", { class: "gap" }, "  …")); continue; }
      d.append(h("div", { class: l.op === "+" ? "add" : l.op === "-" ? "del" : "" }, `${l.op} ${l.text}`));
    }
    const apply = h("button", { class: "primary small" }, "Apply");
    const dismiss = h("button", { class: "small" }, "Dismiss");
    const note = h("span", { class: "status" }, o.editors().length > 1 ? `in ${target.label}` : "");
    const card = h("div", { class: "prop" }, h("div", { class: "why" }, summary || "A proposed change"), d, h("div", { class: "row" }, apply, dismiss, note));
    apply.onclick = () => {
      // apply to the editor as it is now, so typing since the proposal is kept
      const r = applyEdits(target.view.state.doc.toString(), edits);
      if ("error" in r) { note.textContent = "The code changed since this was proposed. Ask again."; return; }
      replaceMinimal(target.view, r.code);
      apply.disabled = true; dismiss.disabled = true;
      note.textContent = "Applied. Ctrl/Cmd+Z undoes it.";
    };
    dismiss.onclick = () => card.remove();
    (current ?? log).append(card);
  }

  // ---------- conversation ----------
  const addTurn = (who: "me" | "ans", text: string) => {
    const el = h("div", { class: "turn " + who });
    if (who === "me") el.textContent = text;
    log.append(el);
    return el;
  };

  async function ask(q: string) {
    q = q.trim(); if (!q || ctl) return;
    if (!backend) { await ready(); if (!backend) { setPane.hidden = false; status.textContent = "Connect the tutor first."; return; } }
    session ??= backend.open(RULES(o), tools);
    ta.value = ""; addTurn("me", q);
    const out = addTurn("ans", "");
    const textEl = h("div"), cards = h("div");
    out.append(textEl, cards);
    textEl.append(h("p", { class: "status" }, "Thinking..."));
    current = cards;
    const snap = snapshot();
    const message = (snap === lastSnapshot ? "(Page unchanged since the last snapshot.)" : `<page>\n${snap}\n</page>`) + "\n\n" + q;
    askBtn.disabled = true; stopBtn.hidden = false; status.textContent = "";
    ctl = new AbortController();
    try {
      const { text, note } = await session.send(message, {
        signal: ctl.signal,
        onText: t => renderAnswer(t, textEl, o.seed, false),
        onStatus: s => { status.textContent = s; },
      });
      lastSnapshot = snap;
      if (text) renderAnswer(text, textEl, o.seed, true); else textEl.innerHTML = "";
      status.textContent = note ?? "";
    } catch (e) {
      if (!textEl.textContent || textEl.textContent === "Thinking...") textEl.innerHTML = "";
      status.textContent = (e as Error).message;
    } finally {
      askBtn.disabled = false; stopBtn.hidden = true; ctl = null; current = null;
    }
  }

  askBtn.onclick = () => ask(ta.value);
  stopBtn.onclick = () => ctl?.abort();
  ta.onkeydown = (e: KeyboardEvent) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.stopPropagation(); ask(ta.value); } };
  clearBtn.onclick = () => { if (ctl) return; session = null; lastSnapshot = ""; log.replaceChildren(); status.textContent = ""; };
  for (const q of o.quick ?? []) quick.append(h("button", { class: "small chip", onclick: () => ask(q) }, q));

  // ---------- settings and connection ----------
  function renderSettings() {
    const how = backend ? `Connected through ${backend.label}.` : "Not connected yet.";
    const model = h("select", { onchange: (e: Event) => { settings.model = (e.target as HTMLSelectElement).value; } }) as HTMLSelectElement;
    for (const m of MODELS) model.append(h("option", { value: m.id }, m.label));
    model.value = settings.model;
    const effort = h("select", { onchange: (e: Event) => { settings.effort = (e.target as HTMLSelectElement).value; } }) as HTMLSelectElement;
    for (const x of EFFORTS) effort.append(h("option", { value: x }, x === "low" ? "low (fastest)" : x));
    effort.value = settings.effort;
    const key = h("input", { type: "password", placeholder: "sk-ant-...", autocomplete: "off" }) as HTMLInputElement;
    const saveKey = h("button", { class: "small", onclick: async () => { if (!key.value.trim()) return; settings.key = key.value.trim(); backend = null; session = null; await ready(); if (backend) setPane.hidden = true; } }, "Save key");
    const forget = h("button", { class: "small", onclick: async () => { settings.key = null; backend = null; session = null; await ready(); } }, "Forget key");
    setPane.replaceChildren(h("p", { class: "warn" }, how));
    if (backend?.kind !== "artifact") setPane.append(h("label", {}, h("span", {}, "Model"), model), h("label", {}, h("span", {}, "Effort"), effort));
    if (backend?.kind === "artifact" || backend?.kind === "local") return;
    setPane.append(
      settings.key ? h("label", {}, h("span", {}, "API key"), h("span", { class: "status", style: "flex:1" }, "saved in this browser"), forget) : h("label", {}, h("span", {}, "API key"), key, saveKey),
      h("p", { class: "warn", html: "The key is kept in this browser only and sent only to the Claude API. Any script on this page could read it, so use a key with a spending limit. Questions are billed to it. Alternatives: run <code>tine daw</code> with <code>ANTHROPIC_API_KEY</code> set, or open the page as a Claude artifact." }),
    );
  }
  gear.onclick = () => { setPane.hidden = !setPane.hidden; if (!setPane.hidden) renderSettings(); };

  let connecting: Promise<void> | null = null;
  function ready() {
    connecting ??= connect().then(b => {
      backend = b; connecting = null;
      renderSettings();
      if (!b) { setPane.hidden = false; status.textContent = ""; }
    });
    return connecting;
  }
  ready();
  return box;
}
