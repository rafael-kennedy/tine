// Phone and tablet support shared by every browser app: touch-sized
// controls, iOS audio, the installable app's offline cache, and the key bar
// that stands in for Ctrl/Cmd shortcuts on a touch keyboard.
import { EditorView } from "@codemirror/view";
import { toggleComment, undo, redo } from "@codemirror/commands";

// Touch sizing applies to any coarse pointer, at any width, so an iPad in
// landscape gets it too. Layout changes stay with each app's width queries.
export const TOUCH_CSS = `
@media (pointer: coarse){
  button,select,input{min-height:40px}
  button.small{min-height:36px;padding:6px 12px;font-size:13px}
  .tabs button{min-height:44px}
  summary{min-height:36px;display:list-item}
  a.l{min-height:40px}
  .cm-editor{font-size:15px}
}
.keybar{display:none}
.keybar[hidden]{display:none!important}
@media (pointer: coarse){
  body.has-keybar{padding-bottom:calc(52px + env(safe-area-inset-bottom))}
  .keybar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:40;gap:6px;align-items:center;
    padding:6px 8px calc(6px + env(safe-area-inset-bottom));background:var(--ink2);border-top:1px solid var(--line);
    overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;transform:translateY(var(--kb-lift,0px))}
  .keybar::-webkit-scrollbar{display:none}
  .keybar button{flex:none;min-width:40px;min-height:40px;padding:4px 10px;font-family:var(--mono);font-size:16px}
  .keybar button.primary{font-family:var(--sans);font-size:15px}
  .keybar .gap{flex:none;width:1px;height:26px;background:var(--line);margin:0 2px}
}
`;

// Characters Tine leans on that phone keyboards bury two layers deep.
export const KEYBAR_SYMBOLS = ["[", "]", ".", "_", "^", "<", ">", "{", "}", "(", ")", "|", "@", "*", "~", ":", "!", "?", "-"];

/** Call once per page, before any audio starts. */
export function setupMobile() {
  // iOS Safari 16.4+: "playback" lets Web Audio sound with the ring/silent
  // switch on silent, like any music app. Other browsers lack the property.
  try { const s = (navigator as any).audioSession; if (s && s.type !== "playback") s.type = "playback"; } catch { /* unsupported */ }
  // The installable build sets this flag; the CLI's local pages do not.
  if ((window as any).TINE_PWA && "serviceWorker" in navigator && location.protocol !== "file:")
    navigator.serviceWorker.register("sw.js").catch(() => { /* offline cache is a bonus */ });
}

export interface KeyBarOptions {
  /** The editor the keys act on. Null hides the bar (no editor focused). */
  view: () => EditorView | null;
  onRun: (view: EditorView) => void;
  onStop: () => void;
  runLabel?: string;
  /** Show the bar only while an editor has focus (pages with many small editors). */
  onlyWhenFocused?: boolean;
}

/** A fixed bar with Run, Stop, comment, undo and the symbols a phone keyboard hides. */
export function keyBar(opt: KeyBarOptions): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "keybar";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "Editor keys");
  const withView = (f: (v: EditorView) => void) => () => { const v = opt.view(); if (v) f(v); };
  const btn = (label: string, title: string, act: () => void, cls = "") => {
    const b = document.createElement("button");
    b.textContent = label; b.title = title; if (cls) b.className = cls;
    // preventDefault on pointerdown keeps the editor focused, so the keyboard stays up
    b.addEventListener("pointerdown", e => e.preventDefault());
    b.addEventListener("mousedown", e => e.preventDefault());
    b.addEventListener("click", e => { e.preventDefault(); act(); });
    bar.append(b);
    return b;
  };
  btn(opt.runLabel ?? "▶ Run", "Evaluate (Ctrl/Cmd+Enter)", withView(opt.onRun), "primary");
  btn("■", "Stop (Ctrl/Cmd+.)", opt.onStop);
  btn("--", "Comment or uncomment lines (Ctrl/Cmd+/)", withView(v => { toggleComment(v); v.focus(); }));
  btn("↶", "Undo", withView(v => { undo(v); }));
  btn("↷", "Redo", withView(v => { redo(v); }));
  const g = document.createElement("span"); g.className = "gap"; bar.append(g);
  for (const s of KEYBAR_SYMBOLS) btn(s, `type ${s}`, withView(v => { v.dispatch(v.state.replaceSelection(s)); v.focus(); }));
  document.body.append(bar);
  if (opt.onlyWhenFocused) {
    bar.hidden = true;
    const sync = () => { bar.hidden = !opt.view(); document.body.classList.toggle("has-keybar", !bar.hidden); };
    document.addEventListener("focusin", sync);
    document.addEventListener("focusout", () => setTimeout(sync, 0));
  } else document.body.classList.add("has-keybar");
  // Keep the bar above the on-screen keyboard. iOS does not resize the layout
  // viewport for the keyboard, so follow the visual viewport instead.
  const vv = window.visualViewport;
  if (vv) {
    const place = () => {
      const hidden = window.innerHeight - vv.height - vv.offsetTop;
      bar.style.setProperty("--kb-lift", `${-Math.max(0, hidden)}px`);
    };
    vv.addEventListener("resize", place); vv.addEventListener("scroll", place); place();
  }
  return bar;
}

/** The editor that holds focus, if any. */
export function focusedEditor(): EditorView | null {
  const el = document.activeElement?.closest?.(".cm-editor");
  return el ? EditorView.findFromDOM(el as HTMLElement) : null;
}

export const isTouch = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
