// Drawing a chord chart (chart.ts) as printed pages of SVG: four bars to a
// line, a boxed mark at each section, repeat signs for a section played
// twice in a row, % for a bar that repeats the one before, and a road map
// when sections come back later in the form.
import { Chart, ChartBar, ChartChord, chordText, keyLabel, SymbolStyle } from "./chart";
import { Paper, PAPER, esc, fmt, svgPage, textWidth, htmlDocument } from "./page";

export interface ChartDrawOptions { paper?: Paper; perLine?: number; style?: SymbolStyle }

const ROOT = 21, QUAL = 13.5, BASS = 17, H = 40, ROW = 62, MARK = 24;
const INK = "#111", SOFT = "#666";

export function symbol(c: ChartChord, x: number, y: number, flats: boolean | undefined, style: SymbolStyle, scale: number) {
  const t = chordText(c, flats, style);
  const r = ROOT * scale, q = QUAL * scale, b = BASS * scale, up = 7.5 * scale;
  let s = `<text x="${fmt(x)}" y="${fmt(y)}" font-size="${fmt(r)}" font-weight="600" fill="${INK}">${esc(t.root)}`;
  if (t.quality) s += `<tspan font-size="${fmt(q)}" dy="${fmt(-up)}">${esc(t.quality)}</tspan>`;
  if (t.bass) s += `<tspan font-size="${fmt(b)}" dy="${fmt(t.quality ? up : 0)}">/${esc(t.bass)}</tspan>`;
  return s + `</text>`;
}
export function symbolWidth(c: ChartChord, flats: boolean | undefined, style: SymbolStyle, scale: number) {
  const t = chordText(c, flats, style);
  return (textWidth(t.root, ROOT, true) + textWidth(t.quality, QUAL) + (t.bass ? textWidth("/" + t.bass, BASS) : 0)) * scale;
}

// the beat note of a tempo mark, drawn, not typed: few text faces have a good ♩
// unit is the meter's lower number: 2 a half note, 4 a quarter, 8 an eighth
export function crotchet(x: number, y: number, size = 1, unit = 4) {
  const cy = y - 2.4 * size, sx = x + 3 * size, top = y - 13 * size;
  const head = unit === 2
    ? `<ellipse cx="${fmt(x)}" cy="${fmt(cy)}" rx="${fmt(3.1 * size)}" ry="${fmt(2.1 * size)}" transform="rotate(-22 ${fmt(x)} ${fmt(cy)})" fill="none" stroke="${SOFT}" stroke-width="${fmt(0.9 * size)}"/>`
    : `<ellipse cx="${fmt(x)}" cy="${fmt(cy)}" rx="${fmt(3.4 * size)}" ry="${fmt(2.4 * size)}" transform="rotate(-22 ${fmt(x)} ${fmt(cy)})" fill="${SOFT}"/>`;
  const flag = unit === 8 ? `<path d="M${fmt(sx)} ${fmt(top)} q${fmt(1 * size)} ${fmt(3.5 * size)} ${fmt(4.2 * size)} ${fmt(5.5 * size)} q${fmt(1 * size)} ${fmt(1.5 * size)} ${fmt(0.2 * size)} ${fmt(4 * size)}" fill="none" stroke="${SOFT}" stroke-width="${fmt(1 * size)}"/>` : "";
  return head + `<line x1="${fmt(sx)}" y1="${fmt(y - 3 * size)}" x2="${fmt(sx)}" y2="${fmt(top)}" stroke="${SOFT}" stroke-width="${fmt(0.9 * size)}"/>` + flag;
}
const tempoMark = (x: number, y: number, bpm: number, anchorEnd: boolean, italic = false, unit = 4) => {
  const t = `= ${fmt(bpm)}`, w = textWidth(t, 11.5), x0 = anchorEnd ? x - w - 10 : x;
  return crotchet(x0 + 3.4, y + 1, 1, unit) + `<text x="${fmt(x0 + 10)}" y="${fmt(y)}" font-size="11.5"${italic ? ' font-style="italic"' : ""} fill="${SOFT}">${t}</text>`;
};
const line = (x1: number, y1: number, x2: number, y2: number, w = 1) => `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="${INK}" stroke-width="${w}"/>`;
const dot = (x: number, y: number) => `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="2.2" fill="${INK}"/>`;

// kind: single | double | final | start (repeat) | end (repeat)
function barline(kind: string, x: number, y: number) {
  const top = y, bot = y + H;
  switch (kind) {
    case "double": return line(x - 3, top, x - 3, bot) + line(x, top, x, bot);
    case "final": return line(x - 6, top, x - 6, bot) + line(x - 1.75, top, x - 1.75, bot, 3.5);
    case "end": return line(x - 6, top, x - 6, bot) + line(x - 1.75, top, x - 1.75, bot, 3.5) + dot(x - 11, y + H / 2 - 6) + dot(x - 11, y + H / 2 + 6);
    case "start": return line(x + 1.75, top, x + 1.75, bot, 3.5) + line(x + 6, top, x + 6, bot) + dot(x + 11, y + H / 2 - 6) + dot(x + 11, y + H / 2 + 6);
    default: return line(x, top, x, bot);
  }
}

function simile(cx: number, y: number) {
  const m = y + H / 2;
  return `<line x1="${fmt(cx - 9)}" y1="${fmt(m + 9)}" x2="${fmt(cx + 9)}" y2="${fmt(m - 9)}" stroke="${INK}" stroke-width="3.2"/>` + dot(cx - 8, m - 6) + dot(cx + 8, m + 6);
}
const slash = (x: number, y: number) => `<line x1="${fmt(x - 4)}" y1="${fmt(y + 4)}" x2="${fmt(x + 4)}" y2="${fmt(y - 10)}" stroke="${SOFT}" stroke-width="2.4"/>`;

const same = (a: ChartBar | undefined, b: ChartBar) => !!a && !a.nc && !b.nc && a.chords.length > 0 && a.chords.length === b.chords.length &&
  a.chords.every((c, i) => c.beat === b.chords[i].beat && c.root === b.chords[i].root && c.sym === b.chords[i].sym && c.bass === b.chords[i].bass);

export function chartPages(chart: Chart, opts: ChartDrawOptions = {}): string[] {
  const paper = opts.paper ?? "letter", style = opts.style ?? "plain", per = opts.perLine ?? 4;
  const P = PAPER[paper], M = 54, W = P.w - 2 * M, cw = W / per, beats = chart.meter[0];
  const pages: string[] = [];
  let body = "", y = 0;

  const header = (first: boolean) => {
    if (first) {
      body += `<text x="${P.w / 2}" y="${M + 26}" font-size="26" text-anchor="middle" fill="${INK}">${esc(chart.title)}</text>`;
      body += `<text x="${M}" y="${M + 52}" font-size="11.5" fill="${SOFT}">${esc(keyLabel(chart.key))}</text>`;
      body += tempoMark(P.w - M, M + 52, chart.tempo, true, false, chart.meter[1]);
      y = M + 64;
      if (chart.roadmap) {
        body += `<text x="${P.w / 2}" y="${y + 6}" font-size="11.5" font-style="italic" text-anchor="middle" fill="${SOFT}">Form: ${esc(chart.roadmap.join(" · "))}</text>`;
        y += 16;
      }
      y += 26;
    } else {
      body += `<text x="${M}" y="${M}" font-size="11" font-style="italic" fill="${SOFT}">${esc(chart.title)} (continued)</text>`;
      y = M + 30;
    }
  };
  const finishPage = () => { pages.push(body); body = ""; };
  header(true);

  chart.sections.forEach((sec, si) => {
    const last = si === chart.sections.length - 1;
    const rows: ChartBar[][] = [];
    for (let i = 0; i < sec.bars.length; i += per) rows.push(sec.bars.slice(i, i + per));
    if (!rows.length) rows.push([]);
    rows.forEach((row, ri) => {
      const mark = ri === 0 && (sec.name !== null || sec.keyChanged || sec.tempoChanged || !!sec.empty);
      const need = ROW + (mark ? MARK : 0);
      if (y + need > P.h - M - 16) { finishPage(); header(false); }
      if (mark) {
        let x = M;
        if (sec.name !== null) {
          const w = textWidth(sec.name, 12.5, true) + 12;
          body += `<rect x="${M}" y="${y - 2}" width="${fmt(w)}" height="19" fill="none" stroke="${INK}" stroke-width="1.2"/>`;
          body += `<text x="${M + 6}" y="${y + 12}" font-size="12.5" font-weight="700" fill="${INK}">${esc(sec.name)}</text>`;
          x += w + 10;
        }
        const notes = [sec.keyChanged ? keyLabel(sec.key) : "", sec.empty ? "no chords" : ""].filter(Boolean).join(" · ");
        if (notes) { body += `<text x="${fmt(x)}" y="${y + 12}" font-size="11.5" font-style="italic" fill="${SOFT}">${esc(notes)}</text>`; x += textWidth(notes, 11.5) + 14; }
        if (sec.tempoChanged) body += tempoMark(x, y + 12, sec.tempo, false, true, chart.meter[1]);
        if (sec.times > 2) body += `<text x="${fmt(M + W)}" y="${y + 12}" font-size="12" font-weight="600" text-anchor="end" fill="${INK}">×${sec.times}</text>`;
        y += MARK;
      }
      row.forEach((bar, bi) => {
        const idx = ri * per + bi, x = M + bi * cw;
        const firstOfAll = si === 0 && idx === 0;
        // left edge of the line, and repeat starts
        if (bi === 0) body += barline(idx === 0 && sec.times > 1 ? "start" : "single", x, y);
        // right edge
        const end = idx === sec.bars.length - 1;
        body += barline(end ? (sec.times > 1 ? "end" : last ? "final" : "double") : "single", x + cw, y);
        let left = x + (bi === 0 && idx === 0 && sec.times > 1 ? 18 : 9);
        if (firstOfAll) {
          body += `<text x="${fmt(left + 5)}" y="${y + 18}" font-size="17" font-weight="700" text-anchor="middle" fill="${INK}">${chart.meter[0]}</text>`;
          body += `<text x="${fmt(left + 5)}" y="${y + 35}" font-size="17" font-weight="700" text-anchor="middle" fill="${INK}">${chart.meter[1]}</text>`;
          left += 18;
        }
        const right = x + cw - (end && sec.times > 1 ? 16 : 8);
        const base = y + 27;
        if (bar.nc) { body += `<text x="${fmt((left + right) / 2)}" y="${base}" font-size="16" font-style="italic" text-anchor="middle" fill="${INK}">N.C.</text>`; return; }
        if (!bar.chords.length) return;
        if (idx > 0 && same(sec.bars[idx - 1], bar)) { body += simile((left + right) / 2, y); return; }
        const span = right - left;
        const xs = bar.chords.map(c => left + (c.beat / beats) * span);
        let scale = 1;
        for (let k = 0; k < 5; k++) {
          const fits = bar.chords.every((c, i) => xs[i] + symbolWidth(c, chart.flats, style, scale) <= (i + 1 < xs.length ? xs[i + 1] - 5 : right + 4));
          if (fits) break;
          scale *= 0.88;
        }
        bar.chords.forEach((c, i) => { body += symbol(c, xs[i], base, chart.flats, style, scale); });
        // irregular changes: show every beat as a slash so the rhythm reads
        const even = bar.chords.every(c => (c.beat * 2) % beats === 0);
        if (bar.chords.length > 1 && !even) {
          for (let k = 0; k < beats; k++) if (!bar.chords.some(c => c.beat === k)) body += slash(left + (k / beats) * span + 8, base);
        }
      });
      y += ROW;
    });
  });
  if (chart.voices.length === 0) {
    body += `<text x="${P.w / 2}" y="${y + 10}" font-size="12" font-style="italic" text-anchor="middle" fill="${SOFT}">No chords found: no voice plays three notes at once or uses chord symbols.</text>`;
  }
  finishPage();
  return pages.map((b, i) => svgPage(paper, b + (pages.length > 1 ? `<text x="${P.w / 2}" y="${P.h - 28}" font-size="9" text-anchor="middle" fill="${SOFT}">${i + 1} / ${pages.length}</text>` : "")));
}

export function chartHtml(chart: Chart, opts: ChartDrawOptions = {}): string {
  return htmlDocument(`${chart.title}: chord chart`, chartPages(chart, opts), opts.paper ?? "letter");
}
