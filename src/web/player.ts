// Standalone player for a packed piece (tine pack). One HTML file, no install.
import { evaluate, renderNotes, mix, encodeWav, toMidiFile, timeline, Scene } from "../core";
import { Engine } from "./engine";
import { library, ensure as ensureSamples } from "./samples";
import { Transport } from "./transport";
import { Roll } from "./roll";
import { CSS, LOGO_SVG } from "./theme";
import { TOUCH_CSS, setupMobile } from "./mobile";

const PCSS = `
body{min-height:100vh;display:grid;place-items:center;padding:16px}
.card{width:min(720px,100%);border:1px solid var(--line);border-radius:16px;padding:24px;background:var(--ink2)}
h1{font-family:var(--serif);font-weight:600;font-size:30px;margin:8px 0 2px}
.meta{color:var(--mute);font-family:var(--mono);font-size:13px}
canvas{width:100%;height:160px;border-radius:10px;margin:18px 0;display:block}
.ctl{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.ctl .sp{flex:1}
details{margin-top:16px} pre{white-space:pre-wrap;font-family:var(--mono);font-size:12.5px;background:var(--ink);padding:12px;border-radius:10px;overflow:auto}
.foot{margin-top:14px;font-size:12px;color:var(--faint)}
`;

function main() {
  const style = document.createElement("style"); style.textContent = CSS + PCSS + TOUCH_CSS; document.head.append(style);
  setupMobile();
  const el = document.getElementById("piece");
  const src = el?.textContent?.trim() || `tempo 100\nkey c major\nvoice demo = [^1 ^3 ^5 ^8].inst(bell)`;
  const title = el?.getAttribute("data-title") || "Untitled";
  let scene: Scene;
  try { scene = evaluate(src, { seed: 1 }); }
  catch (e) { document.body.textContent = `This piece could not be read: ${(e as Error).message}`; return; }
  const tl = timeline(scene);
  const total = scene.form ? tl.seconds : 16 * (scene.meter[0] * 60 / scene.tempo);
  const logo = document.createElement("div"); logo.className = "logo"; logo.innerHTML = LOGO_SVG + "tine";
  const card = document.createElement("div"); card.className = "card";
  card.innerHTML = `<h1></h1><div class="meta"></div><canvas></canvas>
  <div class="ctl"><button class="primary" id="play">▶ Play</button><button id="stop">■ Stop</button><span class="sp"></span><button id="wav" class="small">download wav</button><button id="mid" class="small">download midi</button><button id="tine" class="small">download .tine</button></div>
  <details><summary>Source</summary><pre></pre></details>
  <div class="foot">Made with Tine. Every random choice is fixed by the seed, so this plays the same everywhere.</div>`;
  card.prepend(logo);
  card.querySelector("h1")!.textContent = title;
  card.querySelector(".meta")!.textContent = `${scene.tempo} bpm · ${scene.meter[0]}/${scene.meter[1]} · seed ${scene.seed} · ${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")}${scene.form ? "" : " (loop)"}`;
  card.querySelector("pre")!.textContent = src;
  document.body.append(card);
  const roll = new Roll(card.querySelector("canvas")!);
  const { notes } = renderNotes(scene, scene.form ? undefined : 16);
  roll.set(notes); roll.follow = true; roll.window = 4; roll.head = 0; roll.draw();
  let engine: Engine | null = null, tr: Transport | null = null;
  const dl = (name: string, data: BlobPart, type: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); };
  (card.querySelector("#play") as HTMLButtonElement).onclick = async () => {
    if (!engine) { engine = new Engine(); tr = new Transport(engine); tr.mode = scene.form ? "form" : "live"; tr.loopForm = false; tr.load(scene); }
    if (tr!.playing) return;
    await tr!.start(0);
    const tick = () => { if (!tr!.playing) return; roll.head = tr!.currentBar(); roll.draw(); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };
  (card.querySelector("#stop") as HTMLButtonElement).onclick = () => tr?.stop();
  (card.querySelector("#wav") as HTMLButtonElement).onclick = async () => { const r = renderNotes(scene, scene.form ? undefined : 16); await ensureSamples(r.notes); const [L, R] = mix(r.notes, r.seconds, 44100, { tuningRef: scene.tuningRef, samples: library }); dl(`${title}.wav`, encodeWav([L, R], 44100) as BlobPart, "audio/wav"); };
  (card.querySelector("#mid") as HTMLButtonElement).onclick = () => dl(`${title}.mid`, toMidiFile(scene, notes) as BlobPart, "audio/midi");
  (card.querySelector("#tine") as HTMLButtonElement).onclick = () => dl(`${title}.tine`, src, "text/plain");
}
main();
