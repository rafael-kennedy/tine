// Tine Theory: a jazz-forward music theory course, from fundamentals (101) to jazz harmony (202).
// Every example is live; challenges are checked by listening to what your code plays.
import { randomSeed, VERSION, builtinList, SCALES, parseQuality } from "../core";
import { CSS, LOGO_SVG } from "./theme";
import { h, store, makeCell, makeExercise, makeQuiz, stopAll, CELL_CSS } from "./cells";
import { UNITS, COURSE_LESSONS } from "./course/index";

const COURSE_CSS = `
body{min-height:100vh}
.wrap{display:grid;grid-template-columns:290px minmax(0,1fr);min-height:100vh}
nav{border-right:1px solid var(--line);padding:18px 14px 40px;position:sticky;top:0;height:100vh;overflow:auto}
nav .logo{margin-bottom:4px}
nav .sub{font-size:12px;color:var(--mute);margin:0 0 14px 2px;letter-spacing:.04em}
nav .unit{margin:16px 4px 6px;font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--brass2)}
nav .unit span{color:var(--mute);letter-spacing:.02em;text-transform:none;font-size:12px;display:block}
nav a.l{display:flex;gap:6px;align-items:baseline;padding:5px 8px;border-radius:8px;color:var(--text);text-decoration:none;font-size:14px;line-height:1.35}
nav a.l:hover{background:var(--ink2)}
nav a.l.act{background:var(--ink3);box-shadow:inset 3px 0 var(--brass)}
nav a.l .n{width:22px;flex:none;color:var(--mute);font-variant-numeric:tabular-nums;font-size:12.5px}
nav a.l .tick{width:14px;color:var(--ok);flex:none;margin-left:auto}
nav .seedbox{margin-top:22px;font-size:13px;color:var(--mute)}
nav .seedbox b{font-family:var(--mono);color:var(--brass2)}
article{max-width:840px;padding:34px 40px 120px;width:100%}
article h1{font-family:var(--serif);font-weight:600;font-size:34px;margin:0 0 18px;letter-spacing:-.01em;line-height:1.15}
article .kicker{font-size:12.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--brass2);margin-bottom:6px}
article p,article li{font-size:16px;line-height:1.65}
article ul{padding-left:22px}
table.t{border-collapse:collapse;margin:14px 0 18px;font-size:14.5px;width:100%}
table.t th,table.t td{border-bottom:1px solid var(--line);padding:6px 10px 6px 0;text-align:left;vertical-align:top}
table.t th{color:var(--mute);font-weight:500;font-size:13px}
.pager{display:flex;justify-content:space-between;gap:16px;margin-top:40px;flex-wrap:wrap}
.hero{border:1px solid var(--line);border-radius:14px;padding:22px;margin-bottom:26px;background:linear-gradient(135deg,color-mix(in srgb,var(--brass) 10%,transparent),transparent)}
.hero p{margin:6px 0}
.units{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:18px 0}
.ucard{border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:var(--ink2)}
.ucard h3{margin:2px 0 4px;font-family:var(--serif);font-weight:600;font-size:19px}
.ucard .code{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--brass2)}
.ucard p{font-size:14px;color:var(--mute);margin:4px 0 8px;line-height:1.5}
.ucard ol{margin:0;padding-left:22px;font-size:14px}
.ucard li{line-height:1.6;font-size:14px}
.bar-progress{height:6px;border-radius:4px;background:var(--ink3);overflow:hidden;margin:8px 0 2px}
.bar-progress i{display:block;height:100%;background:var(--ok)}
.ref td{padding:4px 12px 4px 0;vertical-align:top;font-size:14px}
.ref td:first-child{font-family:var(--mono);white-space:nowrap;color:var(--c-fn)}
.ref h3{margin-top:22px}
@media (max-width: 860px){
  .wrap{grid-template-columns:1fr}
  nav{position:static;height:auto;max-height:none;border-right:none;border-bottom:1px solid var(--line)}
  nav .lessons{display:none}
  nav.open .lessons{display:block}
  article{padding:20px 16px 80px}
  article h1{font-size:28px}
  table.t{font-size:13.5px}
}
nav .toggle{display:none}
@media (max-width: 860px){ nav .toggle{display:inline-block;margin-left:10px} }
`;

let seed = Number(store.get("theory.seed")) || randomSeed();
const done = new Set<string>((() => { try { return JSON.parse(store.get("theory.done") || "[]"); } catch { return []; } })());
const seedLabel = h("b", {}, String(seed));
const seedOf = () => seed;
const save = () => { store.set("theory.done", JSON.stringify([...done])); renderNav(); };

// A lesson is complete when its challenges and quizzes are all done.
function tasksOf(id: string): string[] {
  const l = COURSE_LESSONS.find(x => x.id === id)!;
  const keys: string[] = []; let e = 0, q = 0;
  for (const p of l.parts) {
    if (typeof p === "string") continue;
    if ("exercise" in p) keys.push(`${id}:ex${e++}`);
    else if ("quiz" in p) keys.push(`${id}:q${q++}`);
  }
  return keys;
}
const complete = (id: string) => { const t = tasksOf(id); return t.length > 0 && t.every(k => done.has(k)); };

const navEl = h("div", { class: "lessons" });
function renderNav() {
  navEl.innerHTML = "";
  const cur = location.hash.slice(1) || "home";
  navEl.append(h("a", { class: "l" + (cur === "home" ? " act" : ""), href: "#home" }, h("span", { class: "n" }, ""), "Course home"));
  for (const u of UNITS) {
    navEl.append(h("div", { class: "unit" }, u.code, h("span", {}, u.title)));
    for (const l of COURSE_LESSONS.filter(x => x.unit === u)) {
      navEl.append(h("a", { class: "l" + (cur === l.id ? " act" : ""), href: `#${l.id}` }, h("span", { class: "n" }, String(l.n)), l.title, h("span", { class: "tick" }, complete(l.id) ? "✓" : "")));
    }
  }
  navEl.append(h("div", { class: "unit" }, "Appendix"));
  navEl.append(h("a", { class: "l" + (cur === "reference" ? " act" : ""), href: "#reference" }, h("span", { class: "n" }, ""), "Harmony reference"));
}

function renderHome(article: HTMLElement) {
  const total = COURSE_LESSONS.length, finished = COURSE_LESSONS.filter(l => complete(l.id)).length;
  article.append(
    h("div", { class: "kicker" }, "Tine Theory"),
    h("h1", {}, "Music theory, jazz first"),
    h("div", { class: "hero" },
      h("p", { html: `A college theory sequence, <b>Theory 101 through 202</b>, taught in <b>Tine</b>, a programming language for music. It covers what a first and second year of conservatory theory cover (scales, intervals, chords, function, voice leading, chromatic harmony, form) with jazz as the home language rather than an elective at the end. Swing comes in lesson 3, seventh chords in lesson 8, the ii-V-I in lesson 14 and the blues in lesson 15.` }),
      h("p", { html: `Every example is live. Edit it and press <b>▶ play</b> or <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Enter</kbd>. <b>Challenges</b> are checked by what your code plays, so any correct answer passes. <b>Quizzes</b> include ear training: press <b>▶ listen</b> and name what you hear. Progress is saved in this browser.` }),
      h("p", { html: `If you have never used Tine, the code reads like this: <code>[c e g]</code> divides a bar into three notes, <code>{c e g}</code> plays them together, <code>c4@maj7</code> builds a chord, <code>^5</code> is the fifth degree of the current key, and <code>changes("Dm7 G7 | Cmaj7")</code> reads a lead sheet. Each lesson introduces what it uses.` }),
      h("div", { class: "bar-progress" }, h("i", { style: `width:${(100 * finished / total).toFixed(1)}%` })),
      h("p", { class: "dim" }, `${finished} of ${total} lessons complete`)),
  );
  const units = h("div", { class: "units" });
  for (const u of UNITS) {
    const ol = h("ol", { start: String(COURSE_LESSONS.find(l => l.unit === u)!.n) });
    for (const l of COURSE_LESSONS.filter(x => x.unit === u)) ol.append(h("li", {}, h("a", { href: `#${l.id}` }, l.title), complete(l.id) ? h("span", { class: "ok" }, " ✓") : null));
    units.append(h("div", { class: "ucard" }, h("div", { class: "code" }, u.code), h("h3", {}, u.title), h("p", {}, u.blurb), ol));
  }
  article.append(units);
  article.append(h("p", { html: `<b>A note on spelling.</b> Tine works in sounding pitch: C# and Db are the same note to it, and it has no staff notation. Theory often cares which spelling a chord uses, because spelling records function. The course says so wherever it matters (augmented sixths, lesson 23, are the clearest case) and otherwise uses the spellings a jazz lead sheet would.` }));
  article.append(h("p", {}, "Start with ", h("a", { href: `#${COURSE_LESSONS[0].id}` }, `1. ${COURSE_LESSONS[0].title}`), ". Browsers need one click on the page before they make sound."));
}

function renderReference(article: HTMLElement) {
  article.append(h("div", { class: "kicker" }, "Appendix"), h("h1", {}, "Harmony reference"));
  article.append(h("p", { html: `Chord symbols work after <code>@</code> (<code>g3@7b9</code>, <code>c4@maj7/e</code>) and inside <code>changes("...")</code> with a root (<code>"Bb7#11"</code>, <code>"F#m7b5"</code>, <code>"C/E"</code>). They are parsed, so they combine freely. On a degree, a plain number counts diatonic chord tones (<code>^5@7</code>), a symbol gives a fixed quality (<code>^6@dom7</code>), and on an altered degree a number names the quality (<code>^b7@7</code> is a dominant seventh).` }));
  const t = h("table", { class: "t" }, h("tr", {}, h("th", {}, "symbol"), h("th", {}, "semitones above the root")));
  for (const k of ["", "m", "dim", "aug", "sus4", "6", "m6", "69", "7", "maj7", "m7", "m7b5", "dim7", "mmaj7", "7sus4", "9", "maj9", "m9", "11", "m11", "13", "m13", "7b9", "7#9", "7#11", "7b13", "7alt", "7#5", "maj7#11", "9sus4", "13sus4"]) {
    t.append(h("tr", {}, h("td", {}, h("code", {}, k || "(major)")), h("td", {}, parseQuality(k)!.join(" "))));
  }
  article.append(t);
  for (const cat of ["harmony", "pitch"]) {
    const rows = builtinList().filter(b => b.category === cat);
    const tb = h("table", { class: "ref" });
    for (const b of rows) tb.append(h("tr", {}, h("td", {}, b.sig), h("td", {}, b.doc)));
    article.append(h("div", { class: "ref" }, h("h3", {}, cat === "harmony" ? "Harmony functions" : "Pitch functions"), tb));
  }
  const sc = h("table", { class: "t" }, h("tr", {}, h("th", {}, "scale"), h("th", {}, "semitones")));
  for (const [k, s] of Object.entries(SCALES)) sc.append(h("tr", {}, h("td", {}, h("code", {}, k)), h("td", {}, s.steps.map(x => Math.round(x * 100) / 100).join(" "))));
  article.append(h("h3", {}, "Scales"), sc);
}

function renderPage() {
  stopAll();
  const id = location.hash.slice(1) || "home";
  const article = document.querySelector("article")!;
  article.innerHTML = "";
  window.scrollTo(0, 0);
  document.querySelector("nav")?.classList.remove("open");
  renderNav();
  if (id === "reference") { renderReference(article); return; }
  const idx = COURSE_LESSONS.findIndex(l => l.id === id);
  if (idx < 0) { renderHome(article); return; }
  const lesson = COURSE_LESSONS[idx];
  document.title = `${lesson.n}. ${lesson.title} · Tine Theory`;
  article.append(h("div", { class: "kicker" }, `${lesson.unit.code} · Lesson ${lesson.n}`), h("h1", {}, lesson.title));
  let e = 0, q = 0;
  for (const part of lesson.parts) {
    if (typeof part === "string") article.append(h("div", { html: part }));
    else if ("exercise" in part) { const k = `${lesson.id}:ex${e}`; article.append(makeExercise(part.exercise, k, { seed: seedOf, done, onDone: save, title: `Challenge${tasksOf(lesson.id).filter(x => x.includes(":ex")).length > 1 ? ` ${e + 1}` : ""}`, saveAs: `theory.ex.${k}` })); e++; }
    else if ("quiz" in part) { article.append(makeQuiz(part.quiz, `${lesson.id}:q${q++}`, { seed: seedOf, done, onDone: save })); }
    else article.append(makeCell(part, { seed: seedOf }));
  }
  const prev = COURSE_LESSONS[idx - 1], next = COURSE_LESSONS[idx + 1];
  article.append(h("div", { class: "pager" },
    prev ? h("a", { href: `#${prev.id}` }, `← ${prev.n}. ${prev.title}`) : h("a", { href: "#home" }, "← Course home"),
    next ? h("a", { href: `#${next.id}` }, `${next.n}. ${next.title} →`) : h("a", { href: "#reference" }, "Harmony reference →")));
}

function main() {
  const style = document.createElement("style"); style.textContent = CSS + CELL_CSS + COURSE_CSS; document.head.append(style);
  const logo = h("a", { class: "logo", href: "#home" }); logo.innerHTML = LOGO_SVG + "tine";
  const toggle = h("button", { class: "small toggle", onclick: () => nav.classList.toggle("open") }, "lessons");
  const reroll = h("button", { class: "small", onclick: () => { seed = randomSeed(); seedLabel.textContent = String(seed); store.set("theory.seed", String(seed)); renderPage(); } }, "🎲 new seed");
  const nav = h("nav", {}, h("div", {}, logo, toggle), h("div", { class: "sub" }, "THEORY 101 TO 202, JAZZ FIRST"), navEl, h("div", { class: "seedbox" }, "seed ", seedLabel, " ", reroll, h("p", {}, `Tine ${VERSION}`)));
  document.body.append(h("div", { class: "wrap" }, nav, h("article")));
  window.addEventListener("hashchange", renderPage);
  renderPage();
}
main();
