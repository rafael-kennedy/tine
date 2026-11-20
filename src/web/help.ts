// The DAW's function reference: every builtin, searchable and grouped by
// category. Opening one shows its guide from core/guide: a short introduction
// and a few examples, each a live cell that plays, with a sentence leading
// into it. Cells are built only when a function is opened.
import { builtinList } from "../core";
import { GUIDES, Guide } from "../core/guide";
import { h, makeCell } from "./cells";

export const HELP_CSS = `
.fnsearch{width:100%;margin:2px 0 8px}
.fngroup h4{margin-top:16px}
details.fn{border-bottom:1px solid color-mix(in srgb,var(--line) 60%,transparent)}
details.fn > summary{cursor:pointer;padding:5px 0;list-style:none;display:flex;flex-direction:column;gap:1px}
details.fn > summary::-webkit-details-marker{display:none}
details.fn > summary .sig{font-family:var(--mono);font-size:12.5px;color:var(--text)}
details.fn > summary .sig::before{content:"▸ ";color:var(--mute)}
details.fn[open] > summary .sig::before{content:"▾ "}
details.fn > summary .doc{font-size:12px;color:var(--mute)}
details.fn[open] > summary .doc{display:none}
.fnbody{padding:2px 0 10px}
.fnbody p{margin:8px 0 4px;line-height:1.45}
.fnbody code{font-family:var(--mono);font-size:.92em;background:var(--ink2);border-radius:4px;padding:0 3px}
.fnbody a.fnlink{color:var(--teal);cursor:pointer;text-decoration:none}
.fnbody a.fnlink:hover{text-decoration:underline}
.fnbody .cell{margin:4px 0 10px}
.fnbody .cell canvas{height:56px}
.fnbody pre{margin:4px 0 4px;padding:8px 10px;background:var(--ink2);border:1px solid var(--line);border-radius:10px;font-family:var(--mono);font-size:12px;white-space:pre-wrap}
.fnbody .note{font-size:12px;color:var(--mute);margin:0 0 10px}
.fnbody .see{font-size:12px;color:var(--mute);margin-top:6px}
`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// `code` in a guide's text becomes <code>; a builtin named there becomes a link to it.
export function richText(text: string, self = ""): string {
  return esc(text).replace(/`([^`]+)`/g, (_m, c: string) => {
    const name = c.match(/^\.?([A-Za-z_][A-Za-z0-9_]*)(?:\(|$)/)?.[1];
    return name && name !== self && GUIDES[name] ? `<a class="fnlink" data-fn="${name}"><code>${c}</code></a>` : `<code>${c}</code>`;
  });
}

export interface HelpOptions {
  /** Put an example into the piece being edited. */
  addToPiece: (code: string, name: string) => void;
}

export function functionHelp(o: HelpOptions): HTMLElement {
  const box = h("div", { class: "fnhelp" });
  const search = h("input", { class: "fnsearch", type: "search", placeholder: "search functions (name or words)" }) as HTMLInputElement;
  const entries = new Map<string, { el: HTMLDetailsElement; text: string; group: HTMLElement }>();
  const groups: HTMLElement[] = [];

  const byCat = new Map<string, ReturnType<typeof builtinList>>();
  for (const b of builtinList()) { if (!byCat.has(b.category)) byCat.set(b.category, []); byCat.get(b.category)!.push(b); }

  for (const [cat, bs] of byCat) {
    const group = h("div", { class: "fngroup" }, h("h4", {}, cat));
    groups.push(group);
    for (const b of bs) {
      const g = GUIDES[b.name];
      const el = h("details", { class: "fn" }, h("summary", {}, h("span", { class: "sig" }, b.sig), h("span", { class: "doc" }, b.doc))) as HTMLDetailsElement;
      el.dataset.fn = b.name;
      let built = false;
      el.addEventListener("toggle", () => { if (el.open && !built) { built = true; el.append(guideBody(b.name, b.doc, g)); } });
      group.append(el);
      entries.set(b.name, { el, group, text: [b.name, b.sig, b.doc, g?.intro ?? "", ...(g?.examples.map(e => e.say) ?? [])].join(" ").toLowerCase() });
    }
  }

  function guideBody(name: string, doc: string, g: Guide | undefined): HTMLElement {
    const body = h("div", { class: "fnbody" });
    if (!g) { body.append(h("p", {}, doc)); return body; }
    body.append(h("p", { html: richText(g.intro, name) }));
    for (const e of g.examples) {
      body.append(h("p", { html: richText(e.say, name) }));
      const add = h("button", { class: "small", title: "Add this example to the end of your piece" }, "add to piece");
      add.onclick = () => o.addToPiece(e.code, name);
      if (e.live === false) {
        body.append(h("pre", {}, e.code), h("div", { class: "note" }, "Needs a file, a device or the network to be heard, so it does not play here. ", add));
      } else {
        body.append(makeCell({ code: e.code, bars: e.bars }, { seed: () => 1, extra: [add] }));
      }
    }
    if (g.see?.length) {
      const see = h("div", { class: "see" }, "See also: ");
      g.see.forEach((s, i) => { if (i) see.append(", "); see.append(h("a", { class: "fnlink", "data-fn": s }, h("code", {}, s))); });
      body.append(see);
    }
    return body;
  }

  const filter = () => {
    const q = search.value.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    for (const { el, text } of entries.values()) el.style.display = words.every(w => text.includes(w)) ? "" : "none";
    for (const g of groups) g.style.display = [...g.querySelectorAll("details.fn")].some(d => (d as HTMLElement).style.display !== "none") ? "" : "none";
  };
  search.oninput = filter;

  /** Open a function's entry and scroll to it. */
  const open = (name: string) => {
    const e = entries.get(name); if (!e) return;
    if (e.el.style.display === "none") { search.value = ""; filter(); }
    e.el.open = true;
    requestAnimationFrame(() => e.el.scrollIntoView({ block: "start", behavior: "smooth" }));
  };
  box.addEventListener("click", ev => {
    const a = (ev.target as HTMLElement).closest("a.fnlink") as HTMLElement | null;
    if (a?.dataset.fn) { ev.preventDefault(); open(a.dataset.fn); }
  });

  box.append(search, ...groups);
  (box as any).openFunction = open;
  return box;
}

// Top-level settings in an example would take over the piece it is added to,
// so they go in as comments.
const SETTING = /^(tempo|key|seed|meter|tuning)\b/;
export function exampleForPiece(code: string, name: string): string {
  const lines = code.split("\n").map(l => (SETTING.test(l) ? `-- ${l}   (setting from the example, left off)` : l));
  return `\n-- from the help: ${name}\n${lines.join("\n")}\n`;
}
