// Live, editable code cells, checked exercises and quizzes: the building
// blocks shared by the tutorial (learn.ts) and the theory course (course.ts).
import { EditorView } from "@codemirror/view";
import { evaluate, renderNotes, TineError, formatError, Scene, TimedNote, buildChart, chartPages, buildScore, scorePages } from "../core";
import { Engine } from "./engine";
import { Transport } from "./transport";
import { makeEditor, showError, flash } from "./editor";
import { Roll } from "./roll";

export type SheetKind = "chart" | "lead" | "score";
// broken: an example that shows an error on purpose; sheet: show it as a chord chart, lead sheet or score under the code
export interface Cell { code: string; bars?: number; broken?: boolean; sheet?: SheetKind }
export interface Exercise { task: string; starter: string; solution: string; bars?: number; hint?: string; sheet?: SheetKind; check: (s: Scene, n: TimedNote[], src?: string) => string | null }
export interface Question { q: string; options: string[]; answer: number; explain?: string; listen?: string; bars?: number }

export const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* storage may be unavailable */ } },
};

export const CELL_CSS = `
.cell{margin:16px 0 22px;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--ink2)}
.cell .cm-editor{border-radius:0;height:auto}
.cell .cm-content{padding:10px 4px}
.bar{display:flex;gap:8px;align-items:center;padding:8px 10px;border-top:1px solid var(--line);flex-wrap:wrap}
.bar .sp{flex:1}
.cell canvas{width:100%;height:84px;display:block;border-top:1px solid var(--line)}
.cell .msg{padding:0 12px 10px}
.cell .msg:empty{display:none}
.cell .msg div{padding-top:8px}
.ex{border:1px solid color-mix(in srgb,var(--brass) 60%,var(--line));border-radius:12px;padding:14px 16px;margin:22px 0;background:color-mix(in srgb,var(--brass) 6%,transparent)}
.ex h3,.quiz h3{margin:0 0 6px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--brass2)}
.ex .cell{margin:10px 0 0}
.ex .hint{margin-top:8px;font-size:14px}
.ok{color:var(--ok);font-weight:600}
.quiz{border:1px solid color-mix(in srgb,var(--teal) 55%,var(--line));border-radius:12px;padding:14px 16px;margin:22px 0;background:color-mix(in srgb,var(--teal) 6%,transparent)}
.quiz h3{color:var(--teal)}
.qq{margin:14px 0 4px}
.qq:first-of-type{margin-top:4px}
.qq p{margin:0 0 8px}
.qopts{display:flex;flex-direction:column;gap:6px}
.qopts button{text-align:left;padding:7px 12px;background:var(--ink2)}
.qopts button.right{border-color:var(--ok);background:color-mix(in srgb,var(--ok) 18%,var(--ink2))}
.qopts button.wrong{border-color:var(--coral);background:color-mix(in srgb,var(--coral) 14%,var(--ink2))}
.qexp{font-size:14px;margin-top:6px;color:var(--mute)}
.listen{display:flex;gap:8px;align-items:center;margin:4px 0 10px}
.cell .sheet{background:#fff;border-top:1px solid var(--line);padding:6px 0}
.cell .sheet svg{display:block;width:100%;height:auto}
.cell .sheet:empty{display:none}
`;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...kids: (Node | string | null | undefined)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) (el as any)[k.toLowerCase()] = v;
    else if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined) el.append(c);
  return el;
}

// ---------- shared audio ----------

let engine: Engine | null = null;
let transport: Transport | null = null;
let current: { stop: () => void; owner: unknown } | null = null;

function audio() {
  if (!engine) { engine = new Engine(); transport = new Transport(engine); }
  return { engine: engine!, transport: transport! };
}
export function stopAll() { if (current) { const c = current; current = null; c.stop(); } }

async function playScene(s: Scene, owner: unknown, onStop: () => void, onTick?: (bar: number) => void) {
  const { transport } = audio();
  const mine = current?.owner === owner && transport.playing;
  if (!mine) stopAll();
  transport.mode = s.form ? "form" : "live";
  transport.loopForm = true;
  transport.load(s);
  if (!transport.playing) await transport.start(0);
  current = { owner, stop: () => { transport.stop(); onStop(); } };
  const tick = () => {
    if (current?.owner !== owner || !transport.playing) return;
    onTick?.(transport.currentBar());
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const autoBars = (code: string) => (/<|every|cat\(|per_bar|arrange|slow|walk|dice|changes|\|/.test(code) ? 4 : 1);

// ---------- sheet music under a cell ----------

// The page the command line prints, cropped to what is drawn on it.
function drawSheet(el: HTMLElement, s: Scene, kind: SheetKind, bars: number) {
  el.innerHTML = "";
  try {
    const opts = { bars: s.form ? undefined : bars };
    const pages = kind === "chart" ? chartPages(buildChart(s, "", opts)) : scorePages(buildScore(s, "", kind, opts));
    for (const pg of pages) {
      const d = h("div", { html: pg });
      el.append(d);
      const svg = d.querySelector("svg");
      if (!svg) continue;
      // after layout, so getBBox can measure
      requestAnimationFrame(() => {
        try {
          // measured on screen, so every transform is applied, then turned back into page units
          const vb = svg.viewBox.baseVal, r = svg.getBoundingClientRect(), k = vb.width / (r.width || 1);
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          for (const c of Array.from(svg.children)) {
            if (c.tagName === "rect" || c.tagName === "defs") continue;
            const b = c.getBoundingClientRect();
            if (!b.width && !b.height) continue;
            x0 = Math.min(x0, (b.left - r.left) * k); y0 = Math.min(y0, (b.top - r.top) * k);
            x1 = Math.max(x1, (b.right - r.left) * k); y1 = Math.max(y1, (b.bottom - r.top) * k);
          }
          if (isFinite(y0)) {
            const pad = 10;
            svg.setAttribute("viewBox", `${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`);
            svg.removeAttribute("width"); svg.removeAttribute("height");
            // keep the printed size: a narrow crop is not blown up to the cell's width
            svg.style.width = `${Math.min(100, ((x1 - x0 + 20) / (vb.width - 108)) * 100)}%`;
          }
        } catch { /* keep the whole page */ }
      });
    }
  } catch (e) { el.append(h("div", { class: "dim", style: "padding:8px 12px" }, `could not draw this: ${(e as Error).message}`)); }
}

// ---------- code cells ----------

export interface CellOptions { seed: () => number; onScene?: (s: Scene, src: string) => void; extra?: HTMLElement[]; initial?: string }

export function makeCell(cell: Cell, o: CellOptions): HTMLElement & { view: () => EditorView } {
  const bars = cell.bars ?? autoBars(cell.code);
  const box = h("div", { class: "cell" }) as unknown as HTMLElement & { view: () => EditorView };
  const edHost = h("div");
  const playBtn = h("button", { class: "primary small" }, "▶ play");
  const stopBtn = h("button", { class: "small" }, "■");
  const resetBtn = h("button", { class: "small", title: "restore the original example" }, "reset");
  const info = h("span", { class: "dim" }, "");
  const canvas = h("canvas");
  const msg = h("div", { class: "msg" });
  const sheet = h("div", { class: "sheet" });
  box.append(edHost, h("div", { class: "bar" }, playBtn, stopBtn, info, h("span", { class: "sp" }), ...(o.extra ?? []), resetBtn), canvas, sheet, msg);
  const roll = new Roll(canvas);
  roll.window = Math.max(1, bars);
  roll.follow = false;
  let view: EditorView;

  const compile = (): Scene | null => {
    const src = view.state.doc.toString();
    msg.innerHTML = "";
    try {
      const s = evaluate(src, { seed: o.seed() });
      const { notes } = renderNotes(s, s.form ? undefined : bars);
      roll.window = s.form ? Math.max(1, notes.reduce((m, n) => Math.max(m, Math.ceil(n.bar + n.bars - 1e-9)), 1)) : bars;
      roll.set(notes); roll.head = -1; roll.draw();
      info.textContent = `${notes.length} notes · seed ${s.seed}`;
      for (const p of s.prints) msg.append(h("div", { class: "dim" }, p));
      if (cell.sheet) drawSheet(sheet, s, cell.sheet, bars);
      showError(view, undefined, "");
      o.onScene?.(s, src);
      return s;
    } catch (e) {
      const err = e instanceof TineError ? e : new TineError("runtime", (e as Error).message);
      showError(view, err.span, err.message);
      msg.append(h("div", { class: "err" }, formatError(src, err, "example")));
      return null;
    }
  };

  const play = async () => {
    const s = compile(); flash(view);
    if (!s) return;
    playBtn.classList.add("on");
    await playScene(s, box, () => { playBtn.classList.remove("on"); roll.head = -1; roll.draw(); }, b => { roll.head = b % roll.window; roll.draw(); });
  };

  view = makeEditor({ doc: o.initial ?? cell.code, parent: edHost, compact: true, onEval: play, onStop: () => stopAll() });
  playBtn.onclick = play;
  stopBtn.onclick = () => stopAll();
  resetBtn.onclick = () => { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: cell.code } }); compile(); };
  requestAnimationFrame(() => compile());
  // a page can ask every cell to run again in place (a new seed), keeping the reader's edits
  box.addEventListener("tine:recompile", () => compile());
  box.view = () => view;
  return box;
}

// ---------- checked exercises ----------

export function makeExercise(ex: Exercise, key: string, o: { seed: () => number; done: Set<string>; onDone: () => void; title?: string; saveAs?: string }): HTMLElement {
  const result = h("span", {});
  const checkBtn = h("button", { class: "small" }, "check");
  const showBtn = h("button", { class: "small" }, "show answer");
  const saved = o.saveAs ?? `ex.${key}`;
  const cellEl = makeCell({ code: ex.starter, bars: ex.bars, sheet: ex.sheet }, { seed: o.seed, initial: store.get(saved) ?? ex.starter, onScene: (_s, src) => store.set(saved, src), extra: [checkBtn, showBtn] });
  const hint = ex.hint ? h("details", { class: "hint" }, h("summary", {}, "hint"), h("span", { html: ex.hint })) : null;
  checkBtn.onclick = () => {
    const src = cellEl.view().state.doc.toString();
    try {
      const s = evaluate(src, { seed: o.seed() });
      const { notes } = renderNotes(s, ex.bars ?? 1);
      const problem = ex.check(s, notes, src);
      if (problem) { result.className = "err"; result.textContent = problem; }
      else { result.className = "ok"; result.textContent = "✓ That's it."; o.done.add(key); o.onDone(); }
    } catch (e) { result.className = "err"; result.textContent = (e as Error).message; }
  };
  showBtn.onclick = () => { const v = cellEl.view(); v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: ex.solution } }); };
  if (o.done.has(key)) { result.className = "ok"; result.textContent = "✓ Done before. Check again any time."; }
  return h("div", { class: "ex" }, h("h3", {}, o.title ?? "Try it"), h("div", { html: ex.task }), cellEl, hint, h("div", { style: "margin-top:8px" }, result));
}

// ---------- quizzes ----------

// A listen button plays code the reader cannot see, for ear training.
export function makeListen(code: string, bars: number | undefined, seed: () => number): HTMLElement {
  const btn = h("button", { class: "small primary" }, "▶ listen");
  const stop = h("button", { class: "small" }, "■");
  const owner = {};
  btn.onclick = async () => {
    try {
      const s = evaluate(code, { seed: seed() });
      btn.classList.add("on");
      await playScene(s, owner, () => btn.classList.remove("on"));
      void bars;
    } catch (e) { btn.textContent = "error: " + (e as Error).message; }
  };
  stop.onclick = () => stopAll();
  return h("div", { class: "listen" }, btn, stop);
}

export function makeQuiz(qs: Question[], key: string, o: { seed: () => number; done: Set<string>; onDone: () => void }): HTMLElement {
  const box = h("div", { class: "quiz" }, h("h3", {}, qs.some(q => q.listen) ? "Check your ears" : "Check your understanding"));
  const right = new Set<number>();
  qs.forEach((q, i) => {
    const qk = `${key}.${i}`;
    const exp = h("div", { class: "qexp" });
    const opts = h("div", { class: "qopts" });
    const btns = q.options.map((t, j) => h("button", { html: t, onclick: () => {
      btns.forEach(b => b.classList.remove("right", "wrong"));
      if (j === q.answer) {
        btns[j].classList.add("right"); right.add(i);
        exp.innerHTML = q.explain ? `<span class="ok">Yes.</span> ${q.explain}` : `<span class="ok">Yes.</span>`;
        if (right.size === qs.length) { o.done.add(key); o.onDone(); }
        o.done.add(qk); o.onDone();
      } else {
        btns[j].classList.add("wrong");
        exp.innerHTML = `Not quite. Listen or look again.`;
      }
    } }));
    opts.append(...btns);
    if (o.done.has(qk)) { btns[q.answer].classList.add("right"); right.add(i); exp.innerHTML = q.explain ? `<span class="ok">Answered.</span> ${q.explain}` : ""; }
    box.append(h("div", { class: "qq" }, h("p", { html: `<b>${i + 1}.</b> ${q.q}` }), q.listen ? makeListen(q.listen, q.bars, o.seed) : null, opts, exp));
  });
  return box;
}
