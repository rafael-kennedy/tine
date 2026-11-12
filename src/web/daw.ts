// Tine DAW: a live-coding workstation in the browser.
import { EditorView } from "@codemirror/view";
import {
  evaluate, Scene, VoiceDef, TineError, formatError, makeCtx, R, hashStr, randomSeed, renderNotes, mix, encodeWav, toMidiFile, lineCol, VERSION, timeline, INSTRUMENT_DOCS, builtinList, parseSf2, buildChart, chartPages, buildScore, scorePages, htmlDocument,
} from "../core";
import { Engine } from "./engine";
import { library, loadBundled, ensure as ensureSamples, onWarn, nameOf, bankOfPath, setSoundfont, soundfont, loadSoundfont } from "./samples";
import { Transport, Quantize } from "./transport";
import { makeEditor, showError, flash } from "./editor";
import { findToggles, toggleEdits, comboOf, hasModifier, describe as describeBinding, matches as bindingMatches, Trigger, Binding } from "./toggles";
import { Roll } from "./roll";
import { CSS, LOGO_SVG } from "./theme";
import { captureToCode, Captured } from "./capture";
import { TOUCH_CSS, setupMobile, keyBar } from "./mobile";

const DEFAULT_CODE = `-- Welcome to the Tine DAW.
-- Ctrl/Cmd+Enter evaluates (changes land on the next bar). Ctrl/Cmd+. stops.
-- An 'active voice' plays each edit as soon as it is valid. Ctrl/Cmd+/ comments lines.
tempo 92
key d dorian

voice drums = {[kick . . kick . . snare .] [hat*8].vel([.9 .45]).degrade(.15)}
voice bass  = [^1 . ^1 ^5 . ^4 _ ^b3].octave(-2).inst(bass)
voice keys  = <^1@7 ^4@7 ^5@7 ^1@9>.strum.vel(.55).inst(keys)
voice tune  = [^5 ^3|^4 . ^1 ^2 _ ^3|^7 .]
  .every(4, rev)
  .inst(pluck)
  .pan(sine(4).range(-.6, .6))
`;

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

interface Take { time: number; seed: number; code: string; star?: boolean }

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...kids: (Node | string | null | undefined)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) (el as any)[k.toLowerCase()] = v;
    else if (k === "class") el.className = v;
    else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined) el.append(c);
  return el;
}

const DAW_CSS = `

.sheetbar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
.sheetbar button.on{box-shadow:inset 0 0 0 1px var(--brass);color:var(--text)}
.sheets .pg{background:#fff;margin:0 0 10px;box-shadow:0 1px 4px rgba(0,0,0,.25)}
.sheets .pg svg{display:block;width:100%;height:auto}
#sheetview{position:fixed;inset:0;z-index:50;background:var(--ink2,#222);display:none;flex-direction:column}
#sheetview.open{display:flex}
#sheetview .sheetbar{padding:8px 14px;margin:0;border-bottom:1px solid var(--line)}
#sheetview .sheets{overflow:auto;flex:1;padding:20px}
#sheetview .sheets .pg{max-width:820px;margin:0 auto 20px}
body{height:100vh;overflow:hidden}
#app{display:grid;grid-template-rows:auto 1fr 150px;height:100vh}
header{display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid var(--line);flex-wrap:wrap}
header .grp{display:flex;align-items:center;gap:6px}
header .sep{flex:1}
.pos{font-family:var(--mono);font-size:18px;min-width:70px;text-align:center;color:var(--brass2)}
.seed{font-family:var(--mono);color:var(--brass2)}
main{display:grid;grid-template-columns:minmax(0,1fr) 340px;min-height:0}
#ed{min-height:0;padding:10px;overflow:hidden}
#ed .cm-editor{height:100%}
aside{border-left:1px solid var(--line);display:flex;flex-direction:column;min-height:0}
.tabs{display:flex;border-bottom:1px solid var(--line)}
.tabs button{flex:1;border:none;border-radius:0;background:transparent;padding:9px 4px;font-size:13px;color:var(--mute)}
.tabs button.act{color:var(--text);box-shadow:inset 0 -2px var(--brass)}
.panel{padding:12px;overflow:auto;flex:1;display:none;font-size:13.5px}
.panel.act{display:block}
.row{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid color-mix(in srgb,var(--line) 60%,transparent)}
.row .name{flex:1;font-family:var(--mono);overflow:hidden;text-overflow:ellipsis}
.dot{width:10px;height:10px;border-radius:50%;flex:none}
.led{width:8px;height:8px;border-radius:50%;background:var(--ink3);flex:none;transition:background .15s}
.led.hit{background:var(--brass2);transition:none}
.led.live{box-shadow:0 0 0 2px var(--teal)}
.tag-active{font-size:10px;color:var(--teal);border:1px solid var(--teal);border-radius:4px;padding:0 4px;margin-left:4px}
.dest{font-size:11.5px;color:var(--mute);font-family:var(--mono)}
h4{margin:14px 0 6px;font-size:11.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--mute)}
h4:first-child{margin-top:0}
.scene{display:block;width:100%;text-align:left;margin:4px 0;font-family:var(--mono)}
.scene.live{border-color:var(--teal);box-shadow:inset 3px 0 var(--teal)}
.scene.queued{border-color:var(--brass);border-style:dashed}
footer{border-top:1px solid var(--line);display:grid;grid-template-columns:minmax(0,1fr) 340px;min-height:0}
footer .rw{position:relative;min-height:0;overflow:hidden} footer canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#console{border-left:1px solid var(--line);padding:8px 10px;overflow:auto;font-family:var(--mono);font-size:12px;white-space:pre-wrap}
#console .e{color:var(--coral)} #console .i{color:var(--mute)} #console .p{color:var(--text)}
label.chk{display:flex;align-items:center;gap:6px;margin:6px 0}
.field{display:flex;align-items:center;gap:8px;margin:6px 0}
.field > span{width:72px;color:var(--mute)}
.field select{flex:1;min-width:0}
.take{display:flex;gap:6px;align-items:center;padding:5px 0;border-bottom:1px solid color-mix(in srgb,var(--line) 60%,transparent)}
.take .t{flex:1;font-family:var(--mono);font-size:12px}
.drop{border:1.5px dashed var(--line);border-radius:10px;padding:10px;text-align:center;color:var(--mute);margin-top:8px}
body.dragging .drop{border-color:var(--brass);color:var(--text)}
.banks details{margin:2px 0}.banks summary{cursor:pointer;font-family:var(--mono);font-size:12.5px}
.banks .chip{margin:2px 3px 2px 0;font-family:var(--mono);font-size:11px}
.kb td{padding:2px 8px 2px 0;vertical-align:top}
.ccbox{font-family:var(--mono);background:var(--ink2);border-radius:8px;padding:8px;margin:6px 0}
@media (max-width: 860px){
  main{grid-template-columns:1fr} aside{border-left:none;border-top:1px solid var(--line);max-height:42vh}
  #app{grid-template-rows:auto 1fr 110px} footer{grid-template-columns:1fr} #console{display:none}
  body{overflow:auto;height:auto} #app{height:auto;min-height:100vh} #ed{height:55vh}
}
`;

export async function startDaw() {
  const style = document.createElement("style"); style.textContent = CSS + DAW_CSS + TOUCH_CSS; document.head.append(style);
  setupMobile();
  const engine = new Engine();
  const transport = new Transport(engine);
  let fileInfo: { path: string; name: string; content: string } | null = null;
  try { const r = await fetch("/api/file"); if (r.ok) { const j = await r.json(); if (j.path) fileInfo = j; } } catch { /* standalone */ }

  let seed = Number(store.get("tine.seed")) || randomSeed();
  let lastScene: Scene | null = null;
  let takes: Take[] = (() => { try { return JSON.parse(store.get("tine.takes") || "[]"); } catch { return []; } })();
  const activity = new Map<string, HTMLElement>();

  // ---------- layout ----------
  const posEl = h("div", { class: "pos" }, "1.1");
  const playBtn = h("button", { class: "primary", title: "Play (Ctrl/Cmd+Enter also starts)" }, "▶ Play");
  const stopBtn = h("button", { title: "Stop (Ctrl/Cmd+.)" }, "■ Stop");
  const bpmEl = h("span", { class: "dim" }, "120 bpm");
  const quant = h("select", { title: "When new code takes over" }, h("option", { value: "bar" }, "swap on bar"), h("option", { value: "beat" }, "swap on beat"), h("option", { value: "now" }, "swap now"));
  const modeSel = h("select", { title: "Loop the voices, or play the arrangement in 'form'" }, h("option", { value: "live" }, "live loop"), h("option", { value: "form" }, "play form"));
  const seedEl = h("span", { class: "seed", title: "Every run is replayable from its seed" }, String(seed));
  const rerollBtn = h("button", { class: "small", title: "New seed: re-roll every random choice" }, "🎲 reroll");
  const keepBtn = h("button", { class: "small", title: "Freeze this seed into the code and star the take" }, "★ keep take");
  const saveBtn = h("button", { class: "small", title: "Save (Ctrl/Cmd+S)" }, fileInfo ? `save ${fileInfo.name}` : "save .tine");
  const wavBtn = h("button", { class: "small" }, "export wav");
  const midBtn = h("button", { class: "small" }, "export midi");
  const themeBtn = h("button", { class: "small", title: "Light/dark" }, "◐");

  const header = h("header", {},
    h("a", { class: "logo", href: "#", title: `Tine ${VERSION}` }, ...(() => { const s = h("span"); s.innerHTML = LOGO_SVG; return [s.firstChild as Node, "tine"]; })()),
    h("div", { class: "grp" }, playBtn, stopBtn, posEl, bpmEl),
    h("div", { class: "grp" }, quant, modeSel),
    h("div", { class: "grp" }, h("span", { class: "dim" }, "seed"), seedEl, rerollBtn, keepBtn),
    h("div", { class: "sep" }),
    h("div", { class: "grp" }, saveBtn, wavBtn, midBtn, themeBtn),
  );

  const edWrap = h("section", { id: "ed" });
  const tabs = ["Tracks", "Scenes", "Sheet", "MIDI", "Takes", "Help"];
  const tabBar = h("div", { class: "tabs" });
  const panels: Record<string, HTMLElement> = {};
  for (const t of tabs) {
    const b = h("button", { onclick: () => selectTab(t) }, t); b.dataset.tab = t; tabBar.append(b);
    panels[t] = h("div", { class: "panel" });
  }
  const selectTab = (t: string) => {
    for (const b of tabBar.querySelectorAll("button")) b.classList.toggle("act", (b as HTMLElement).dataset.tab === t);
    for (const [k, p] of Object.entries(panels)) p.classList.toggle("act", k === t);
    store.set("tine.tab", t);
    if (t === "Sheet") setTimeout(() => { try { renderSheet(); } catch { /* not set up yet: drawn after the first evaluation */ } }, 0);
  };
  const aside = h("aside", {}, tabBar, ...Object.values(panels));
  const canvas = h("canvas");
  const consoleEl = h("div", { id: "console" });
  const app = h("div", { id: "app" }, header, h("main", {}, edWrap, aside), h("footer", {}, h("div", { class: "rw" }, canvas), consoleEl));
  document.body.append(app);
  selectTab(store.get("tine.tab") ?? "Tracks");

  const log = (msg: string, kind: "e" | "i" | "p" = "i") => {
    const line = h("div", { class: kind }, msg);
    consoleEl.append(line);
    while (consoleEl.childNodes.length > 200) consoleEl.firstChild!.remove();
    consoleEl.scrollTop = consoleEl.scrollHeight;
  };

  // ---------- editor ----------
  const initial = fileInfo?.content ?? store.get("tine.code") ?? DEFAULT_CODE;
  const view: EditorView = makeEditor({
    doc: initial, parent: edWrap,
    onEval: () => run(true), onStop: () => stop(), onSave: () => save(),
    onChange: d => { store.set("tine.code", d); scheduleLive(); },
  });
  keyBar({ view: () => view, onRun: () => run(true), onStop: () => stop() });
  const code = () => view.state.doc.toString();
  const setCode = (s: string) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: s } });

  // ---------- evaluation ----------
  const voiceNamesIn = (src: string) => [...src.matchAll(/^\s*(?:active\s+)?voice\s+([A-Za-z_][A-Za-z0-9_#]*)/gm)].map(m => m[1]);

  // Active voices: every edit that leaves the code in a good state is heard
  // at once, without Ctrl/Cmd+Enter. "Good" means the file evaluates and the
  // voice can play its next bar; until then the voice keeps its last good code.
  let liveTimer: any = null;
  function scheduleLive() {
    if (liveTimer) clearTimeout(liveTimer);
    liveTimer = setTimeout(liveEval, 150);
  }
  function liveEval() {
    liveTimer = null;
    const src = code();
    if (!transport.playing || !/^\s*active\s+voice\b/m.test(src)) return;
    let scene: Scene;
    try { scene = evaluate(src, { seed, keepGoing: true }); } catch (e) { const err = e as TineError; showError(view, err.span, err.message); return; }
    if (scene.errors.length) showError(view, scene.errors[0].span, scene.errors[0].message); else showError(view, undefined, "");
    // a voice that fails while playing its next bar is not swapped in
    const bar = Math.floor(transport.currentBar());
    const ctx = makeCtx(scene.seed, 0, scene.key, new R(0), transport.inputs);
    const check = (m: Map<string, VoiceDef>) => { for (const [name, v] of m) if (v.active) { try { v.pat.query(new R(bar), new R(bar + 2), { ...ctx, voice: hashStr(name) }); } catch (e) { m.delete(name); showError(view, v.span, `voice ${name}: ${(e as Error).message}`); } } };
    check(scene.voices);
    for (const sec of scene.sections.values()) check(sec.voices);
    const swapped = transport.swapActive(scene, new Set(voiceNamesIn(src)));
    if (swapped.length) flashActive(swapped);
  }
  const activeLed = new Map<string, number>();
  function flashActive(names: string[]) {
    for (const n of names) { const led = activity.get(n); if (led) { led.classList.add("live"); clearTimeout(activeLed.get(n)); activeLed.set(n, setTimeout(() => led.classList.remove("live"), 300) as any); } }
  }

  function compile(): Scene | null {
    const src = code();
    let scene: Scene;
    try {
      scene = evaluate(src, { seed, keepGoing: true });
    } catch (e) {
      const err = e instanceof TineError ? e : new TineError("runtime", String((e as Error).message ?? e));
      showError(view, err.span, err.message);
      log(formatError(src, err, fileInfo?.name ?? "daw"), "e");
      log("kept the previous version playing", "i");
      return null;
    }
    if (scene.errors.length) {
      const first = scene.errors[0];
      showError(view, first.span, first.message);
      for (const e of scene.errors) log(formatError(src, e, fileInfo?.name ?? "daw"), "e");
      // a voice that failed keeps its last good version
      if (lastScene) for (const name of voiceNamesIn(src)) if (!scene.voices.has(name) && lastScene.voices.has(name)) { scene.voices.set(name, lastScene.voices.get(name)!); log(`voice ${name}: kept the last good version`, "i"); }
    } else showError(view, undefined, "");
    for (const p of scene.prints) log(p, "p");
    return scene;
  }

  async function run(startIfStopped: boolean) {
    const scene = compile();
    flash(view);
    if (!scene) return;
    if (scene.seedExplicit) seed = scene.seed;
    seedEl.textContent = String(scene.seed) + (scene.seedExplicit ? " 🔒" : "");
    store.set("tine.seed", String(seed));
    lastScene = scene;
    transport.mode = modeSel.value as any;
    transport.load(scene);
    bpmEl.textContent = `${Math.round(scene.tempo * 10) / 10} bpm · ${scene.meter[0]}/${scene.meter[1]}`;
    recordTake(scene);
    renderTracks(); renderScenes(); renderSheet();
    if (startIfStopped && !transport.playing) await play();
  }

  async function play() {
    if (!lastScene) { const s = compile(); if (!s) return; lastScene = s; transport.load(s); renderTracks(); renderScenes(); renderSheet(); }
    await engine.resume();
    transport.mode = modeSel.value as any;
    if (!transport.playing) { roll.notes = []; await transport.start(0); log(`playing, seed ${lastScene!.seed}`, "i"); }
    playBtn.classList.add("on");
  }
  function stop() { transport.stop(); playBtn.classList.remove("on"); log("stopped", "i"); }

  playBtn.onclick = () => (lastScene ? play() : run(true));
  stopBtn.onclick = stop;
  quant.onchange = () => { transport.quantize = quant.value as Quantize; store.set("tine.quant", quant.value); };
  quant.value = store.get("tine.quant") ?? "bar"; transport.quantize = quant.value as Quantize;
  modeSel.onchange = () => { const was = transport.playing; if (was) transport.stop(); transport.mode = modeSel.value as any; if (was) play(); };

  rerollBtn.onclick = () => {
    seed = randomSeed();
    const src = code();
    if (/^\s*seed\s+\d+/m.test(src)) setCode(src.replace(/^(\s*seed\s+)\d+/m, `$1${seed}`));
    run(false);
    log(`new seed ${seed}`, "i");
  };
  keepBtn.onclick = () => {
    const s = lastScene?.seed ?? seed;
    const src = code();
    if (/^\s*seed\s+\d+/m.test(src)) setCode(src.replace(/^(\s*seed\s+)\d+/m, `$1${s}`));
    else setCode(`seed ${s}\n` + src);
    const t: Take = { time: Date.now(), seed: s, code: code(), star: true };
    takes.unshift(t); saveTakes(); renderTakes();
    log(`kept take with seed ${s}: it will replay exactly`, "i");
  };

  // ---------- takes ----------
  function recordTake(scene: Scene) {
    const src = code();
    if (takes[0] && takes[0].code === src && takes[0].seed === scene.seed) return;
    takes.unshift({ time: Date.now(), seed: scene.seed, code: src });
    const starred = takes.filter(t => t.star), rest = takes.filter(t => !t.star).slice(0, 150);
    takes = [...takes.filter(t => starred.includes(t) || rest.includes(t))];
    saveTakes(); renderTakes();
  }
  function saveTakes() { store.set("tine.takes", JSON.stringify(takes.slice(0, 300))); }
  function renderTakes() {
    const p = panels.Takes; p.innerHTML = "";
    p.append(h("p", { class: "dim" }, "Every evaluation is recorded with its seed, so anything you heard can be brought back exactly. Star the ones worth keeping."));
    for (const t of takes.slice(0, 120)) {
      const d = new Date(t.time);
      const row = h("div", { class: "take" },
        h("button", { class: "small" + (t.star ? " on" : ""), title: "star", onclick: () => { t.star = !t.star; saveTakes(); renderTakes(); } }, "★"),
        h("span", { class: "t" }, `${d.toLocaleTimeString()}  seed ${t.seed}`),
        h("button", { class: "small", title: "load this code and seed", onclick: () => { seed = t.seed; setCode(t.code); run(false); log(`restored take from ${d.toLocaleTimeString()} (seed ${t.seed})`); } }, "restore"),
        h("button", { class: "small", title: "download as a .tine file with its seed", onclick: () => download(`take-${t.seed}.tine`, /^\s*seed\s+\d+/m.test(t.code) ? t.code : `seed ${t.seed}\n${t.code}`, "text/plain") }, "⇩"),
      );
      p.append(row);
    }
  }

  // ---------- tracks ----------
  const allVoices = (s: Scene) => {
    const out: { name: string; section?: string; dest: string; active?: boolean }[] = [];
    const destOf = (v: any) => {
      try {
        const ns = renderNotes({ ...s, form: null } as Scene, 1).notes.filter(n => n.voice === v.name);
        const p = ns[0]?.params; if (!p) return "";
        if (p.midi !== undefined) return `MIDI ch ${p.midi}${p.port ? ` · ${p.port}` : ""}${p.mpe ? " · mpe" : ""}`;
        const inst = String(p.inst ?? "keys");
        if (!inst.startsWith("sample:")) return inst;
        const names = [...new Set(ns.map(n => String(n.params.inst).slice(7) || "kit"))];
        return `samples: ${names.slice(0, 2).join(", ")}${names.length > 2 ? "…" : ""}`;
      } catch { return ""; }
    };
    for (const v of s.voices.values()) out.push({ name: v.name, dest: destOf(v), active: v.active });
    for (const sec of s.sections.values()) for (const v of sec.voices.values()) out.push({ name: v.name, section: sec.name, dest: "", active: v.active });
    return out;
  };
  function renderTracks() {
    const p = panels.Tracks; p.innerHTML = ""; activity.clear();
    if (!lastScene) { p.append(h("p", { class: "dim" }, "Evaluate some code to see its voices.")); return; }
    const vs = allVoices(lastScene);
    if (!vs.length) p.append(h("p", { class: "dim" }, "No voices yet. Add a line like: voice beat = [kick . snare .]"));
    let lastSec: string | undefined = "§";
    for (const v of vs) {
      if (v.section !== lastSec) { p.append(h("h4", {}, v.section ? `section ${v.section}` : "voices")); lastSec = v.section; }
      const led = h("span", { class: "led" });
      if (!activity.has(v.name)) activity.set(v.name, led);
      const m = h("button", { class: "small" + (transport.muted.has(v.name) ? " on" : ""), title: "mute", onclick: () => { transport.muted.has(v.name) ? transport.muted.delete(v.name) : transport.muted.add(v.name); renderTracks(); } }, "M");
      const so = h("button", { class: "small" + (transport.soloed.has(v.name) ? " on" : ""), title: "solo", onclick: () => { transport.soloed.has(v.name) ? transport.soloed.delete(v.name) : transport.soloed.add(v.name); renderTracks(); } }, "S");
      p.append(h("div", { class: "row" }, h("span", { class: "dot", style: `background:${roll.color(v.name)}` }), led, h("span", { class: "name" }, v.name, v.active ? h("span", { class: "tag-active", title: "active: edits play as soon as they are good" }, "active") : null), h("span", { class: "dest" }, v.dest), m, so));
    }
    renderToggles(p);
    p.append(h("h4", {}, "sounds"));
    const sl = h("div", {});
    for (const [k, d] of Object.entries(INSTRUMENT_DOCS)) sl.append(h("div", { class: "dest" }, `${k}: ${d}`));
    p.append(sl, h("h4", {}, `samples (${library.size})`));
    // the sample library by bank; click a name to hear it
    const banks = library.bankList();
    if (!banks.length) p.append(h("div", { class: "dest" }, "loading the bundled samples…"));
    const bl = h("div", { class: "banks" });
    for (const b of banks) {
      const d = h("details", {}, h("summary", {}, `${b.bank} `, h("span", { class: "dest" }, String(b.names.length))));
      d.addEventListener("toggle", () => {
        if (!d.open || d.childElementCount > 1) return;
        b.names.forEach((nm, i) => d.append(h("button", { class: "small chip", title: `"${b.bank}:${i}" also plays it`, onclick: () => { engine.resume(); engine.audition(nm); } }, nm)));
      }, { once: false });
      bl.append(d);
    }
    p.append(bl, h("div", { class: "drop" }, "Click a name to hear it. Play one in a phrase: [\"bd_haus\" . \"sn_dolf\" .], or [kick . snare .].sample() for the kit. Drop audio files anywhere to add your own."));
  }

  // ---------- performance toggles (see toggles.ts) ----------
  const bindings = new Map<string, Binding>(Object.entries((() => { try { return JSON.parse(store.get("tine.toggles") ?? "{}"); } catch { return {}; } })()));
  const saveBindings = () => store.set("tine.toggles", JSON.stringify(Object.fromEntries(bindings)));
  let learning: string | null = null;
  const trigger = new Trigger();

  function toggle(tag: string) {
    const doc = view.state.doc;
    const edits = toggleEdits(doc.toString(), tag);
    if (!edits.length) return;
    view.dispatch({ changes: edits.map(e => { const l = doc.line(e.line + 1); return { from: l.from + e.from, to: l.from + e.to, insert: e.insert }; }) });
    const on = findToggles(code()).find(t => t.tag === tag)?.on;
    log(`${tag} ${on ? "on" : "off"}`, "i");
    if (transport.playing) void run(false); else renderTracks();
  }
  function bind(tag: string, b: Binding) {
    for (const [k, v] of bindings) if (k !== tag && describeBinding(v) === describeBinding(b)) bindings.delete(k); // one control, one block
    bindings.set(tag, b); learning = null; saveBindings();
    log(`${tag} is on ${describeBinding(b)}`, "i"); renderTracks();
  }
  function renderToggles(p: HTMLElement) {
    const ts = findToggles(code());
    p.append(h("h4", {}, "toggles"));
    if (!ts.length) { p.append(h("p", { class: "dim" }, "Name a block with a line like -- @fill (end it with -- @end or a blank line), or end one line with -- @hats. Then bind it to a key or a MIDI button here, and switch it on and off while you play.")); return; }
    for (const t of ts) {
      const b = bindings.get(t.tag);
      const sw = h("button", { class: "small" + (t.on ? " on" : ""), title: "switch on or off", onclick: () => toggle(t.tag) }, t.on ? "on" : "off");
      const learn = h("button", { class: "small" + (learning === t.tag ? " on" : ""), title: "bind a key or MIDI control", onclick: () => { learning = learning === t.tag ? null : t.tag; renderTracks(); } }, learning === t.tag ? "press a key or a MIDI button…" : b ? describeBinding(b) : "bind");
      const un = b ? h("button", { class: "small", title: "remove binding", onclick: () => { bindings.delete(t.tag); saveBindings(); renderTracks(); } }, "×") : null;
      p.append(h("div", { class: "row" }, sw, h("span", { class: "name" }, `@${t.tag}`), h("span", { class: "dest" }, `${t.lines.length} line${t.lines.length === 1 ? "" : "s"}`), learn, un));
    }
  }
  window.addEventListener("keydown", e => {
    const combo = comboOf(e);
    if (learning) {
      if (e.key === "Escape") { learning = null; renderTracks(); e.preventDefault(); return; }
      if (!combo) return;
      e.preventDefault(); e.stopPropagation(); bind(learning, { kind: "key", combo }); return;
    }
    if (!combo) return;
    const typing = view.hasFocus || (e.target as HTMLElement)?.closest?.("input, select, textarea");
    for (const [tag, b] of bindings) if (b.kind === "key" && b.combo === combo && (hasModifier(combo) || !typing)) { e.preventDefault(); e.stopPropagation(); toggle(tag); return; }
  }, true);
  function toggleMidi(msg: { type: string; note?: number; vel?: number; cc?: number; value?: number; ch: number }) {
    const rising = msg.type === "cc" ? trigger.cc(msg.cc!, msg.ch, msg.value!) : msg.type === "on";
    if (learning) {
      if (msg.type === "on") bind(learning, { kind: "note", note: msg.note!, ch: msg.ch });
      else if (msg.type === "cc" && rising) bind(learning, { kind: "cc", cc: msg.cc!, ch: msg.ch });
      return;
    }
    if (!rising) return;
    for (const [tag, b] of bindings) if (bindingMatches(b, msg)) toggle(tag);
  }

  // ---------- scenes ----------
  function renderScenes() {
    const p = panels.Scenes; p.innerHTML = "";
    if (!lastScene) return;
    p.append(h("p", { class: "dim" }, "Sections work as scenes: click one to launch it on the next bar. Top-level voices keep playing underneath."));
    const base = h("button", { class: "scene" + (!transport.section ? " live" : ""), onclick: () => { transport.launch(null); renderScenes(); } }, "◦ top-level voices only");
    if (transport.pendingSection === null) base.classList.add("queued");
    p.append(base);
    for (const s of lastScene.sections.values()) {
      const b = h("button", { class: "scene" + (transport.section === s.name ? " live" : "") + (transport.pendingSection === s.name ? " queued" : ""), onclick: () => { transport.launch(s.name); renderScenes(); } },
        `▸ ${s.name}  `, h("span", { class: "dim" }, `${s.bars} bars · ${s.voices.size} voice${s.voices.size === 1 ? "" : "s"}${s.tempo ? ` · ${s.tempo} bpm` : ""}`));
      p.append(b);
    }
    if (lastScene.form) {
      const tl = timeline(lastScene);
      p.append(h("h4", {}, "form"), h("div", { class: "dest" }, `${lastScene.form.map(f => f.times > 1 ? `${f.name}*${f.times}` : f.name).join(" ")}  (${tl.bars} bars, ${tl.seconds.toFixed(1)}s)`));
      const lp = h("input", { type: "checkbox" }) as HTMLInputElement; lp.checked = transport.loopForm; lp.onchange = () => (transport.loopForm = lp.checked);
      p.append(h("label", { class: "chk" }, lp, "loop the form"), h("p", { class: "dim" }, "Choose 'play form' at the top to hear the arrangement start to finish."));
    }
  }
  transport.onSection = () => renderScenes();

  // ---------- MIDI ----------
  let capture: { armed: boolean; recording: boolean; startBar: number; bars: number; grid: number; notes: Captured[]; open: Map<number, Captured> } | null = null;
  let takeN = 1;
  const lastCc = h("div", { class: "ccbox" }, "move a knob or fader…");
  function renderMidi(status = "") {
    const p = panels.MIDI; p.innerHTML = "";
    if (!engine.midi) {
      p.append(h("p", { class: "dim" }, "Connect keyboards, controllers, drum machines and other DAWs over MIDI."),
        h("button", { class: "primary", onclick: async () => { const e = await engine.initMidi(); renderMidi(e); if (!e) log("MIDI enabled", "i"); } }, "Enable MIDI"));
      if (status) p.append(h("p", { class: "err" }, status));
      p.append(midiHelp());
      return;
    }
    const outSel = h("select", {}, ...engine.outputs().map(o => h("option", { value: o.id }, o.name ?? o.id)));
    if (!engine.outputs().length) outSel.append(h("option", { value: "" }, "no outputs found"));
    outSel.value = engine.midiOutId ?? engine.outputs()[0]?.id ?? "";
    outSel.onchange = () => (engine.midiOutId = outSel.value);
    const inSel = h("select", {}, h("option", { value: "all" }, "all inputs"), ...engine.inputs().map(i => h("option", { value: i.id }, i.name ?? i.id)));
    inSel.value = engine.midiInId ?? "all"; inSel.onchange = () => (engine.midiInId = inSel.value);
    const thruSel = h("select", {}, h("option", { value: "" }, "off"), ...Object.keys(INSTRUMENT_DOCS).filter(k => k !== "kit").map(k => h("option", { value: k }, k)));
    thruSel.value = engine.thru.enabled ? engine.thru.inst : ""; thruSel.onchange = () => { engine.thru.enabled = !!thruSel.value; if (thruSel.value) engine.thru.inst = thruSel.value; };
    const clk = h("input", { type: "checkbox" }) as HTMLInputElement; clk.checked = transport.clockOut; clk.onchange = () => (transport.clockOut = clk.checked);
    const fol = h("input", { type: "checkbox" }) as HTMLInputElement; fol.checked = transport.followClock;
    fol.onchange = () => { transport.followClock = fol.checked; transport.clockTempo = null; if (fol.checked) { transport.clockOut = clk.checked = false; } log(fol.checked ? "following MIDI clock: press play on the other device" : "Tine keeps its own tempo again", "i"); };
    p.append(
      h("div", { class: "field" }, h("span", {}, "output"), outSel),
      h("div", { class: "field" }, h("span", {}, "input"), inSel),
      h("div", { class: "field" }, h("span", {}, "play-thru"), thruSel),
      h("label", { class: "chk" }, clk, "send MIDI clock (other gear follows Tine's tempo)"),
      h("label", { class: "chk" }, fol, "follow MIDI clock (Tine follows other gear's tempo, start and stop)"),
      h("h4", {}, "controllers"), lastCc,
      h("h4", {}, "capture"),
    );
    const barsSel = h("select", {}, ...[1, 2, 4, 8].map(n => h("option", { value: n }, `${n} bar${n > 1 ? "s" : ""}`)));
    barsSel.value = "2";
    const gridSel = h("select", {}, h("option", { value: 8 }, "1/8"), h("option", { value: 16 }, "1/16"), h("option", { value: 12 }, "1/8 triplets"), h("option", { value: 24 }, "1/16 triplets"), h("option", { value: 48 }, "fine (1/48)"));
    gridSel.value = "16";
    const capBtn = h("button", { class: capture ? "on" : "primary" }, capture ? (capture.recording ? "● recording…" : "armed: waits for next bar") : "● capture");
    capBtn.onclick = async () => {
      if (capture) { capture = null; renderMidi(); return; }
      if (!transport.playing) await play();
      capture = { armed: true, recording: false, startBar: Math.ceil(transport.bar() + 0.02), bars: Number(barsSel.value), grid: Number(gridSel.value), notes: [], open: new Map() };
      renderMidi();
    };
    p.append(h("div", { class: "field" }, barsSel, gridSel), capBtn,
      h("p", { class: "dim" }, "Play along: Tine records from the next bar, quantizes, and writes what you played as a new voice in the editor."));
    p.append(midiHelp());
  }
  function midiHelp() {
    return h("div", {}, h("h4", {}, "in code"),
      h("div", { class: "dest" }, ".midi(1)  send a voice to channel 1"),
      h("div", { class: "dest" }, ".midi(2, port: \"IAC\")  pick a port by name"),
      h("div", { class: "dest" }, ".mpe  one channel per note (microtonal chords)"),
      h("div", { class: "dest" }, "cc(74)  a knob as a 0..1 signal"),
      h("div", { class: "dest" }, "held(8).arp  arpeggiate the keys you hold"));
  }
  engine.onMidiIn = msg => {
    toggleMidi(msg);
    if (msg.type === "cc") {
      lastCc.innerHTML = "";
      lastCc.append(`cc ${msg.cc} = ${msg.value!.toFixed(2)} (ch ${msg.ch})  `, h("button", { class: "small", onclick: () => insertAtCursor(`cc(${msg.cc})`) }, `insert cc(${msg.cc})`));
    }
    if (!capture || !capture.recording) return;
    const b = transport.bar() - capture.startBar;
    if (msg.type === "on") { const c = { note: msg.note!, on: b, off: b + 0.25, vel: msg.vel! }; capture.open.set(msg.note!, c); capture.notes.push(c); }
    if (msg.type === "off") { const c = capture.open.get(msg.note!); if (c) { c.off = b; capture.open.delete(msg.note!); } }
  };
  function insertAtCursor(text: string) {
    const pos = view.state.selection.main.head;
    view.dispatch({ changes: { from: pos, insert: text }, selection: { anchor: pos + text.length } });
    view.focus();
  }
  function finishCapture() {
    if (!capture) return;
    const c = capture; capture = null;
    for (const o of c.open.values()) o.off = Math.min(c.bars, transport.bar() - c.startBar);
    const notes = c.notes.filter(n => n.on >= -0.03 && n.on < c.bars).map(n => ({ ...n, on: Math.max(0, n.on) }));
    const name = `take${takeN++}`;
    const line = captureToCode(notes, c.bars, c.grid, name, engine.thru.enabled ? engine.thru.inst : "keys");
    if (!line) { log("capture finished: no notes were played", "i"); renderMidi(); return; }
    const doc = code();
    view.dispatch({ changes: { from: doc.length, insert: (doc.endsWith("\n") ? "" : "\n") + line + "\n" } });
    log(`captured ${notes.length} notes as voice ${name}`, "i");
    run(false); renderMidi();
  }

  // ---------- export / save ----------
  function download(name: string, data: BlobPart, type: string) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = h("a", { href: url, download: name }); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  async function save() {
    if (fileInfo) {
      try { await fetch("/api/file", { method: "POST", body: code() }); log(`saved ${fileInfo.path}`, "i"); return; } catch { log("save failed; downloading instead", "e"); }
    }
    download("piece.tine", code(), "text/plain");
  }
  saveBtn.onclick = save;
  wavBtn.onclick = async () => {
    const s = compile(); if (!s) return;
    log("rendering…", "i");
    await new Promise(r => setTimeout(r, 30));
    const bars = s.form ? undefined : 16;
    const { notes, seconds } = renderNotes(s, bars);
    await ensureSamples(notes);
    if (s.soundfontSources.length) await loadSoundfont(s.soundfontSources);
    const [L, R] = mix(notes, seconds, 44100, { tuningRef: s.tuningRef, samples: library, soundfont });
    download(`tine-${s.seed}.wav`, encodeWav([L, R], 44100) as BlobPart, "audio/wav");
    log(`exported ${seconds.toFixed(1)}s (${s.form ? "the form" : "16 bars"}), seed ${s.seed}`, "i");
  };
  midBtn.onclick = () => {
    const s = compile(); if (!s) return;
    const { notes } = renderNotes(s, s.form ? undefined : 16);
    download(`tine-${s.seed}.mid`, toMidiFile(s, notes) as BlobPart, "audio/midi");
    log(`exported MIDI, ${notes.length} notes, seed ${s.seed}`, "i");
  };
  themeBtn.onclick = () => {
    const cur = document.documentElement.dataset.theme ?? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.dataset.theme = cur === "light" ? "dark" : "light";
    store.set("tine.theme", document.documentElement.dataset.theme);
  };
  const th = store.get("tine.theme"); if (th) document.documentElement.dataset.theme = th;

  // samples: the bundled library, messages about packs, drag and drop
  onWarn(msg => log(msg, "i"));
  loadBundled().then(() => renderTracks());
  document.addEventListener("dragover", e => { e.preventDefault(); document.body.classList.add("dragging"); });
  document.addEventListener("dragleave", () => document.body.classList.remove("dragging"));
  document.addEventListener("drop", async e => {
    e.preventDefault(); document.body.classList.remove("dragging");
    for (const f of [...(e.dataTransfer?.files ?? [])]) {
      if (/\.tine$/i.test(f.name)) { setCode(await f.text()); run(false); continue; }
      if (/\.sf2$/i.test(f.name)) {
        try { const sf = parseSf2(new Uint8Array(await f.arrayBuffer())); setSoundfont(sf, f.name); log(`SoundFont ${sf.name || f.name}: ${sf.presets.length} presets. Play them with .gm(1) to .gm(128), or .gm("name")`, "i"); }
        catch (err) { log(`${f.name}: ${(err as Error).message}`, "e"); }
        continue;
      }
      const name = f.name.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_]+/g, "_");
      try { await engine.loadSample(name, await f.arrayBuffer()); log(`loaded sample "${name}": use .sample("${name}")`, "i"); }
      catch { log(`could not decode ${f.name}`, "e"); }
    }
    renderTracks();
  });
  if (fileInfo) {
    try {
      const list: string[] = await (await fetch("/api/samples")).json();
      for (const f of list) {
        try { await engine.loadSample(nameOf(f), await (await fetch(`/api/samples/${f.split("/").map(encodeURIComponent).join("/")}`)).arrayBuffer(), bankOfPath(f)); } catch { /* skip */ }
      }
      if (list.length) log(`loaded ${list.length} sample${list.length > 1 ? "s" : ""} from the samples folder`, "i");
    } catch { /* none */ }
    // the file changed on disk (edited in another editor): reload and re-evaluate
    try {
      const es = new EventSource("/api/watch");
      es.onmessage = ev => { const { content } = JSON.parse(ev.data); if (content !== code()) { setCode(content); run(false); log("file changed on disk: re-evaluated", "i"); } };
    } catch { /* no SSE */ }
  }

  // ---------- sheet music ----------
  // A chord chart, lead sheet or score of the code as it stands, redrawn on
  // every evaluation. The engraver is the one 'tine chart/lead/score' uses.
  let sheetKind = store.get("tine.sheet") ?? "chart";
  let sheetJazz = store.get("tine.sheetJazz") === "1";
  const sheetView = h("div", { id: "sheetview" });
  document.body.append(sheetView);
  function sheetPagesFor(s: Scene): { pages: string[]; title: string } {
    const title = fileInfo?.name?.replace(/\.tine$/, "") ?? "piece";
    const style = sheetJazz ? "jazz" as const : "plain" as const;
    if (sheetKind === "chart") return { pages: chartPages(buildChart(s, title), { style }), title: `${title}: chord chart` };
    const kind = sheetKind === "lead" ? "lead" : "score";
    return { pages: scorePages(buildScore(s, title, kind), { style }), title: `${title}: ${kind === "lead" ? "lead sheet" : "score"}` };
  }
  function sheetBar(full: boolean) {
    const kinds: [string, string][] = [["chart", "Chart"], ["lead", "Lead sheet"], ["score", "Score"]];
    const bar = h("div", { class: "sheetbar" });
    for (const [k, label] of kinds) bar.append(h("button", { class: `small${sheetKind === k ? " on" : ""}`, onclick: () => { sheetKind = k; store.set("tine.sheet", k); renderSheet(); } }, label));
    bar.append(h("button", { class: `small${sheetJazz ? " on" : ""}`, title: "Jazz chord symbols: C-7, CΔ7, Cø7", onclick: () => { sheetJazz = !sheetJazz; store.set("tine.sheetJazz", sheetJazz ? "1" : "0"); renderSheet(); } }, "C–7"));
    bar.append(h("span", { style: "flex:1" }));
    if (!full) bar.append(h("button", { class: "small", onclick: () => { sheetView.classList.add("open"); renderSheet(); } }, "⤢ full view"));
    bar.append(h("button", { class: "small", title: "Print or save as PDF", onclick: printSheet }, "print"));
    bar.append(h("button", { class: "small", onclick: () => { const s = lastScene ?? compile(); if (!s) return; const { pages, title } = sheetPagesFor(s); download(`${title.replace(/[^\w.-]+/g, "-")}.html`, htmlDocument(title, pages, "letter"), "text/html"); } }, "download"));
    if (full) bar.append(h("button", { class: "small", onclick: () => sheetView.classList.remove("open") }, "✕ close"));
    return bar;
  }
  function printSheet() {
    const s = lastScene ?? compile(); if (!s) return;
    const { pages, title } = sheetPagesFor(s);
    const w = window.open("", "_blank");
    if (!w) { log("the browser blocked the print window; use download and print that page", "e"); return; }
    w.document.write(htmlDocument(title, pages, "letter")); w.document.close();
    setTimeout(() => w.print(), 300);
  }
  let sheetTimer: any = null;
  function renderSheet() {
    const p = panels.Sheet, full = sheetView.classList.contains("open");
    if (!full && !p.classList.contains("act")) return;
    clearTimeout(sheetTimer);
    sheetTimer = setTimeout(() => {
      const s = lastScene;
      const draw = (el: HTMLElement, isFull: boolean) => {
        el.innerHTML = "";
        el.append(sheetBar(isFull));
        if (!s) { el.append(h("p", { class: "dim" }, "Evaluate the code to see it as sheet music.")); return; }
        const box = h("div", { class: "sheets" });
        try { for (const pg of sheetPagesFor(s).pages) { const d = h("div", { class: "pg" }); d.innerHTML = pg; box.append(d); } }
        catch (e) { box.append(h("p", { class: "dim" }, `could not draw this: ${(e as Error).message}`)); }
        el.append(box);
      };
      if (p.classList.contains("act")) draw(p, false);
      if (full) draw(sheetView, true);
    }, 150);
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape" && sheetView.classList.contains("open")) sheetView.classList.remove("open"); });

  // ---------- help ----------
  panels.Help.append(
    h("h4", {}, "keys"),
    (() => {
      const t = h("table", { class: "kb" });
      for (const [k, d] of [["Ctrl/Cmd + Enter", "evaluate (and play)"], ["Shift + Enter", "evaluate"], ["Ctrl/Cmd + .", "stop"], ["Ctrl/Cmd + S", "save"], ["Ctrl/Cmd + /", "toggle comment"], ["Ctrl + Space", "complete a name"]]) t.append(h("tr", {}, h("td", {}, h("kbd", {}, k)), h("td", {}, d)));
      return t;
    })(),
    h("h4", {}, "phrases"),
    ...["[c e g]  three steps in a bar", "[c . e _]  rest and hold", "[c:3 e]  weights", "[c [d e]]  subdivide", "[hat*4]  ratchet", "{c e g}  together", "<a b>  one per bar", "[c|e|g]  random each bar", "[kick?]  50% chance"].map(s => h("div", { class: "dest" }, s)),
    h("h4", {}, "learn"),
    h("p", {}, h("a", { href: fileInfo ? "/learn" : "#", target: "_blank" }, "Open the interactive tutorial"), h("span", { class: "dim" }, " (run 'tine learn' if this is a standalone page)")),
    h("h4", {}, "functions"),
    ...builtinList().map(b => h("div", { class: "dest", title: b.doc }, b.sig)),
  );

  // ---------- visuals ----------
  const roll = new Roll(canvas);
  roll.window = 2;
  transport.onNotes = notes => {
    roll.add(notes);
    for (const n of notes) {
      const led = activity.get(n.voice); if (!led) continue;
      const delay = Math.max(0, (n.when - engine.now) * 1000);
      setTimeout(() => { led.classList.add("hit"); setTimeout(() => led.classList.remove("hit"), 90); }, delay);
    }
  };
  transport.onError = (voice, e) => { log(`voice ${voice}: ${(e as Error).message}`, "e"); };
  transport.onSwap = bar => log(`new code playing from bar ${Math.floor(bar) + 1}`, "i");
  transport.onRemote = on => { if (on) { playBtn.classList.add("on"); log("started by MIDI clock", "i"); } else { playBtn.classList.remove("on"); log("stopped by MIDI clock", "i"); } };
  transport.onEnd = () => { playBtn.classList.remove("on"); log("the form finished", "i"); };
  const frame = () => {
    if (transport.playing) {
      posEl.textContent = transport.positionText();
      if (transport.followClock && transport.clockTempo && lastScene) bpmEl.textContent = `${transport.clockTempo.toFixed(1)} bpm (clock) · ${lastScene.meter[0]}/${lastScene.meter[1]}`;
      roll.head = transport.currentBar();
      if (capture) {
        const b = transport.bar();
        if (!capture.recording && b >= capture.startBar) { capture.recording = true; renderMidi(); log(`recording ${capture.bars} bar${capture.bars > 1 ? "s" : ""}…`, "i"); }
        if (capture.recording && b >= capture.startBar + capture.bars) finishCapture();
      }
    }
    roll.draw();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  (window as any).__tine = { transport, roll, engine, view };
  renderTakes(); renderMidi(); renderTracks(); renderScenes();
  log(`Tine ${VERSION}. Ctrl/Cmd+Enter to evaluate and play.${fileInfo ? ` Editing ${fileInfo.path}; edits made in other editors reload here.` : ""}`, "i");
  // evaluate once so tracks show up, without making sound
  const s = compile(); if (s) { lastScene = s; transport.load(s); seedEl.textContent = String(s.seed) + (s.seedExplicit ? " 🔒" : ""); bpmEl.textContent = `${s.tempo} bpm · ${s.meter[0]}/${s.meter[1]}`; renderTracks(); renderScenes(); renderSheet(); }
}

startDaw();
