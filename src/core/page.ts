// Printed pages: sizes, a text-width estimate (the command line has no font
// engine), and the HTML wrapper that prints one SVG per sheet.

export type Paper = "letter" | "a4";
export const PAPER: Record<Paper, { w: number; h: number; css: string }> = {
  letter: { w: 612, h: 792, css: "letter" },   // points
  a4: { w: 595, h: 842, css: "A4" },
};

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const fmt = (x: number) => String(Math.round(x * 100) / 100);

// Advance widths in ems, close to common serif faces (Georgia, Times, Palatino).
const NARROW = new Set([..."ijlI.,:;'|!()[]/ "]);
const WIDE = new Set([..."MWmw"]);
export function textWidth(s: string, size: number, bold = false): number {
  let w = 0;
  for (const ch of s) {
    if (NARROW.has(ch)) w += 0.3;
    else if (WIDE.has(ch)) w += 0.85;
    else if (ch === "♭" || ch === "♯" || ch === "𝄫" || ch === "𝄪") w += 0.45;
    else if (ch >= "A" && ch <= "Z") w += 0.68;
    else if (ch === "Δ" || ch === "ø" || ch === "°") w += 0.6;
    else w += 0.52;
  }
  return w * size * (bold ? 1.06 : 1);
}

export function svgPage(paper: Paper, body: string): string {
  const p = PAPER[paper];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}pt" height="${p.h}pt" viewBox="0 0 ${p.w} ${p.h}" font-family="Georgia, 'Palatino Linotype', Palatino, 'Times New Roman', serif"><rect width="${p.w}" height="${p.h}" fill="#fff"/>${body}</svg>`;
}

// A standalone page: on screen the sheets stack on a grey desk; printed, one per sheet.
export function htmlDocument(title: string, pages: string[], paper: Paper): string {
  const p = PAPER[paper];
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>
@page { size: ${p.css}; margin: 0 }
html, body { margin: 0; background: #e9e7e2 }
.sheet { width: ${p.w}pt; max-width: calc(100vw - 32px); margin: 24px auto; box-shadow: 0 1px 6px rgba(0,0,0,.18); background: #fff }
.sheet svg { display: block; width: 100%; height: auto }
@media print { html, body { background: #fff } .sheet { margin: 0; box-shadow: none; max-width: none; break-after: page } .sheet:last-child { break-after: auto } }
</style></head><body>
${pages.map(s => `<div class="sheet">${s}</div>`).join("\n")}
</body></html>
`;
}
