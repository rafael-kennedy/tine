// Learn Tine: an interactive tutorial. Every example is editable and playable.
import { randomSeed, VERSION } from "../core";
import { CSS, LOGO_SVG } from "./theme";
import { LESSONS, Lesson, Cell, Exercise } from "./lessons";
import { h, store, makeCell, makeExercise, stopAll, CELL_CSS } from "./cells";
import { TOUCH_CSS, setupMobile, keyBar, focusedEditor } from "./mobile";

const LEARN_CSS = `
body{min-height:100vh}
.wrap{display:grid;grid-template-columns:260px minmax(0,1fr);min-height:100vh}
nav{border-right:1px solid var(--line);padding:18px 14px;position:sticky;top:0;height:100vh;overflow:auto}
nav .logo{margin-bottom:16px}
nav a.l{display:flex;gap:8px;align-items:center;padding:6px 8px;border-radius:8px;color:var(--text);text-decoration:none;font-size:14px}
nav a.l:hover{background:var(--ink2)}
nav a.l.act{background:var(--ink3);box-shadow:inset 3px 0 var(--brass)}
nav a.l .tick{width:16px;color:var(--ok);flex:none}
nav .seedbox{margin-top:18px;font-size:13px;color:var(--mute)}
nav .seedbox b{font-family:var(--mono);color:var(--brass2)}
article{max-width:820px;padding:34px 40px 120px;width:100%}
article h1{font-family:var(--serif);font-weight:600;font-size:34px;margin:0 0 18px;letter-spacing:-.01em}
article p,article li{font-size:16px;line-height:1.65}
.pager{display:flex;justify-content:space-between;margin-top:40px}
.hero{border:1px solid var(--line);border-radius:14px;padding:22px;margin-bottom:26px;background:linear-gradient(135deg,color-mix(in srgb,var(--brass) 10%,transparent),transparent)}
.hero p{margin:6px 0}
.ref td{padding:4px 12px 4px 0;vertical-align:top;font-size:14px}
.ref td:first-child{font-family:var(--mono);white-space:nowrap;color:var(--c-fn)}
.ref h3{margin-top:22px;text-transform:capitalize}
article pre.static{font-family:var(--mono);font-size:14px;line-height:1.5;border:1px dashed var(--line);border-radius:10px;padding:12px 14px;overflow:auto;color:var(--mute)}
article table.ref{margin:8px 0 14px}
@media (max-width: 800px){ .wrap{grid-template-columns:1fr} nav{position:static;height:auto;border-right:none;border-bottom:1px solid var(--line)} article{padding:20px 16px 80px} nav .lessons{display:none} nav.open .lessons{display:block} }
nav .toggle{display:none}
@media (max-width: 800px){ nav .toggle{display:inline-block;margin-left:10px} }
`;

let seed = Number(store.get("learn.seed")) || randomSeed();
const done = new Set<string>((() => { try { return JSON.parse(store.get("learn.done") || "[]"); } catch { return []; } })());
const seedLabel = h("b", {}, String(seed));
const seedOf = () => seed;
const saveDone = () => { store.set("learn.done", JSON.stringify([...done])); renderNav(); };
const cellOf = (c: Cell) => makeCell(c, { seed: seedOf });
const exerciseOf = (ex: Exercise, lessonId: string, idx: number) =>
  makeExercise(ex, `${lessonId}:${idx}`, { seed: seedOf, done, onDone: saveDone, saveAs: `learn.ex.${lessonId}:${idx}` });

const navEl = h("div");
function renderNav() {
  navEl.innerHTML = "";
  const cur = location.hash.slice(1) || "intro";
  navEl.append(h("a", { class: "l" + (cur === "intro" ? " act" : ""), href: "#intro" }, h("span", { class: "tick" }, ""), "Start here"));
  LESSONS.forEach((l, i) => {
    const exCount = l.parts.filter(p => typeof p === "object" && "exercise" in p).length;
    const finished = exCount > 0 && [...Array(exCount).keys()].every(k => done.has(`${l.id}:${k}`));
    navEl.append(h("a", { class: "l" + (cur === l.id ? " act" : ""), href: `#${l.id}` }, h("span", { class: "tick" }, finished ? "✓" : ""), l.title));
  });
  navEl.append(h("a", { class: "l" + (cur === "reference" ? " act" : ""), href: "#reference" }, h("span", { class: "tick" }, ""), "Reference"));
}

async function renderReference(article: HTMLElement) {
  const { builtinList } = await import("../core");
  article.append(h("h1", {}, "Reference"));
  article.append(h("p", { html: "Every built-in function. Any function can be called as <code>f(x, y)</code> or <code>x.f(y)</code>." }));
  const byCat = new Map<string, any[]>();
  for (const b of builtinList()) { if (!byCat.has(b.category)) byCat.set(b.category, []); byCat.get(b.category)!.push(b); }
  for (const [cat, bs] of byCat) {
    const t = h("table", { class: "ref" });
    for (const b of bs) t.append(h("tr", {}, h("td", {}, b.sig), h("td", {}, b.doc)));
    article.append(h("div", { class: "ref" }, h("h3", {}, cat), t));
  }
  article.append(h("h3", {}, "Phrase notation"));
  const t = h("table", { class: "ref" });
  for (const [a, b] of [["[a b c]", "steps dividing a bar equally"], [".", "rest"], ["_", "hold the previous step"], ["x:3", "x takes 3 steps of time"], ["[a [b c]]", "subdivide a step"], ["x*3", "x three times within its step"], ["x!3", "x as three steps"], ["{a b c}", "simultaneous (chord or layers)"], ["<a b c>", "one per bar, in turn"], ["a|b|c", "seeded random choice, made each time the phrase comes around"], ["x? / x?0.3", "seeded chance to play"], ["x@maj7 / ^5@7", "chord on x"]]) t.append(h("tr", {}, h("td", {}, a), h("td", {}, b)));
  article.append(t);
}

function renderPage() {
  stopAll();
  const id = location.hash.slice(1) || "intro";
  const article = document.querySelector("article")!;
  article.innerHTML = "";
  window.scrollTo(0, 0);
  renderNav();
  if (id === "reference") { renderReference(article); return; }
  if (id === "intro") {
    article.append(
      h("h1", {}, "Learn Tine"),
      h("div", { class: "hero" },
        h("p", { html: "<b>Tine</b> is a programming language for music. You write short patterns of notes and drum hits, change them while they play, and build them into finished pieces. Every random choice comes from a numbered seed, so anything you hear can be played again exactly." }),
        h("p", { html: `This tutorial has ${LESSONS.length} short lessons. It assumes you can program and that you know no music theory: every musical term is explained where it first appears. Every example is live: edit it and press <b>▶ play</b> or <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Enter</kbd>. Sound needs one click on the page first (browsers require it).` })),
      cellOf({ code: `tempo 96\nkey d dorian\n\nvoice drums = {[kick . . kick . . snare .] [hat*8].vel([.9 .5]*4)}\nvoice bass  = [^1 . ^1 ^5 . ^4 _ ^b3].octave(-2).inst(bass)\nvoice keys  = <^1@7 ^4@7 ^5@7 ^1@9>.strum.vel(.55)\nvoice tune  = [^5 ^3|^4 . ^1 ^2 _ ^3|^7 .].inst(pluck)`, bars: 4 }),
      h("p", { html: `That is the kind of program this tutorial builds up to. By the end of lesson 10 you will be able to read every line of it. Start with <a href="#${LESSONS[0].id}">${LESSONS[0].title}</a>.` }),
    );
    return;
  }
  const idx = LESSONS.findIndex(l => l.id === id);
  const lesson: Lesson = LESSONS[idx] ?? LESSONS[0];
  article.append(h("h1", {}, lesson.title));
  let exIdx = 0;
  for (const part of lesson.parts) {
    if (typeof part === "string") article.append(h("div", { html: part }));
    else if ("exercise" in part) article.append(exerciseOf(part.exercise, lesson.id, exIdx++));
    else article.append(cellOf(part));
  }
  const prev = LESSONS[idx - 1], next = LESSONS[idx + 1];
  article.append(h("div", { class: "pager" },
    prev ? h("a", { href: `#${prev.id}` }, `← ${prev.title}`) : h("a", { href: "#intro" }, "← Start"),
    next ? h("a", { href: `#${next.id}` }, `${next.title} →`) : h("a", { href: "#reference" }, "Reference →")));
}

function main() {
  const style = document.createElement("style"); style.textContent = CSS + CELL_CSS + LEARN_CSS + TOUCH_CSS; document.head.append(style);
  setupMobile();
  const logo = h("a", { class: "logo", href: "#intro" }); logo.innerHTML = LOGO_SVG + "tine";
  const reroll = h("button", { class: "small", onclick: () => { seed = randomSeed(); seedLabel.textContent = String(seed); store.set("learn.seed", String(seed)); stopAll(); document.querySelectorAll(".cell").forEach(c => c.dispatchEvent(new Event("tine:recompile"))); } }, "🎲 new seed");
  const toggle = h("button", { class: "small toggle", onclick: () => nav.classList.toggle("open") }, "lessons");
  navEl.className = "lessons";
  const nav = h("nav", {}, h("div", {}, logo, toggle), navEl, h("div", { class: "seedbox" }, "seed ", seedLabel, " ", reroll, h("p", {}, `Tine ${VERSION}`)));
  document.body.append(h("div", { class: "wrap" }, nav, h("article")));
  window.addEventListener("hashchange", () => { nav.classList.remove("open"); renderPage(); });
  keyBar({ view: focusedEditor, onlyWhenFocused: true, runLabel: "▶ play", onRun: v => (v.dom.closest(".cell")?.querySelector("button.primary") as HTMLButtonElement | null)?.click(), onStop: () => stopAll() });
  renderPage();
}
main();
