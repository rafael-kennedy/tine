// Canvas piano roll with a playhead. Used by the DAW and tutorial cells.
import { VOICE_COLORS } from "./theme";

export interface RollNote { voice: string; bar: number; bars: number; semi: number; vel: number }

export class Roll {
  notes: RollNote[] = [];
  colors = new Map<string, string>();
  head = -1;
  window = 2;       // bars visible
  follow = true;
  keys = true;      // draw a keyboard strip along the pitch axis
  private ctx: CanvasRenderingContext2D;
  constructor(public canvas: HTMLCanvasElement) { this.ctx = canvas.getContext("2d")!; }

  color(v: string) {
    if (!this.colors.has(v)) this.colors.set(v, VOICE_COLORS[this.colors.size % VOICE_COLORS.length]);
    return this.colors.get(v)!;
  }

  set(notes: RollNote[]) { this.notes = notes; }
  add(notes: RollNote[]) {
    this.notes.push(...notes);
    if (this.notes.length > 4000) { const cut = this.head - this.window * 2; this.notes = this.notes.filter(n => n.bar + n.bars > cut); }
  }

  draw() {
    const c = this.canvas, dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = this.ctx; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement);
    g.fillStyle = css.getPropertyValue("--ink2"); g.fillRect(0, 0, w, h);
    const start = this.follow && this.head >= 0 ? Math.floor(this.head / this.window) * this.window : 0;
    const end = start + this.window;
    const vis = this.notes.filter(n => n.bar < end && n.bar + n.bars > start);
    const pool = vis.length ? vis : this.notes;
    let lo = Infinity, hi = -Infinity;
    for (const n of pool) { lo = Math.min(lo, n.semi); hi = Math.max(hi, n.semi); }
    if (!isFinite(lo)) { lo = 48; hi = 72; }
    lo = Math.floor(lo) - 2; hi = Math.ceil(hi) + 2;
    const rows = hi - lo + 1, rh = h / rows;
    const kw = this.keys ? Math.round(Math.min(12, Math.max(8, w * 0.012))) : 0;
    const gx = kw ? kw + 2 : 0; // a small gap keeps a lit key apart from its note
    const x = (b: number) => gx + ((b - start) / this.window) * (w - gx);
    const black = (s: number) => [1, 3, 6, 8, 10].includes(((s % 12) + 12) % 12);
    const rowY = (s: number) => h - (s - lo + 1) * rh;
    // black-key rows are shaded across the grid, as in a DAW
    if (this.keys) {
      g.fillStyle = "rgba(0,0,0,0.14)";
      for (let s = lo; s <= hi; s++) if (black(s)) g.fillRect(gx, rowY(s), w - gx, rh);
    }
    // grid
    g.strokeStyle = css.getPropertyValue("--line"); g.lineWidth = 1;
    for (let b = start; b <= end; b += 0.25) {
      g.globalAlpha = Number.isInteger(b) ? 0.9 : 0.35;
      g.beginPath(); g.moveTo(Math.round(x(b)) + 0.5, 0); g.lineTo(Math.round(x(b)) + 0.5, h); g.stroke();
    }
    g.globalAlpha = 1;
    for (const n of vis) {
      const y = h - (n.semi - lo + 1) * rh;
      const nx = x(n.bar), nw = Math.max(2, x(n.bar + n.bars) - nx - 1);
      g.fillStyle = this.color(n.voice);
      g.globalAlpha = 0.35 + 0.65 * n.vel;
      g.fillRect(nx, y, nw, Math.max(2, rh - 1));
    }
    g.globalAlpha = 1;
    if (this.keys) {
      // keys light up, in the voice's color, while a note at that pitch sounds
      const on = this.head >= 0 ? vis.filter(n => n.bar <= this.head && n.bar + n.bars > this.head) : [];
      this.drawKeys(g, kw, h, lo, hi, rh, black, rowY, css, on);
    }
    if (this.head >= start && this.head <= end) {
      g.fillStyle = css.getPropertyValue("--brass2");
      g.fillRect(x(this.head), 0, 2, h);
    }
  }

  // A small keyboard: one row per half step, white keys full width, black keys shorter and dark.
  private drawKeys(g: CanvasRenderingContext2D, kw: number, h: number, lo: number, hi: number, rh: number,
                   black: (s: number) => boolean, rowY: (s: number) => number, css: CSSStyleDeclaration, on: RollNote[]) {
    g.fillStyle = "#ece7dc"; g.fillRect(0, 0, kw, h);
    g.strokeStyle = "rgba(0,0,0,0.28)"; g.lineWidth = 1;
    // lines between adjacent white keys: below C and below F (B|C and E|F have no black key between)
    for (let s = lo; s <= hi; s++) {
      const pc = ((s % 12) + 12) % 12;
      if (pc === 0 || pc === 5) { const y = Math.round(rowY(s) + rh) + 0.5; g.beginPath(); g.moveTo(0, y); g.lineTo(kw, y); g.stroke(); }
    }
    g.fillStyle = "#1d1b19";
    for (let s = lo; s <= hi; s++) if (black(s)) g.fillRect(0, rowY(s) + rh * 0.08, Math.round(kw * 0.62), rh * 0.84);
    for (const n of on) {
      const s = Math.round(n.semi);
      if (s < lo || s > hi) continue;
      g.fillStyle = this.color(n.voice);
      g.fillRect(0, rowY(s), black(s) ? Math.round(kw * 0.62) : kw - 1, rh);
    }
    g.fillStyle = css.getPropertyValue("--line") || "rgba(0,0,0,.3)"; g.fillRect(kw - 1, 0, 1, h);
    // name the Cs, just right of the strip, when there is room
    if (rh >= 3.5) {
      g.fillStyle = css.getPropertyValue("--mute") || "rgba(128,128,128,.8)"; g.globalAlpha = 0.7;
      g.font = `${Math.max(7, Math.min(9, Math.floor(rh * 1.4)))}px system-ui, sans-serif`;
      g.textAlign = "left"; g.textBaseline = "middle";
      for (let s = lo; s <= hi; s++) if (((s % 12) + 12) % 12 === 0) g.fillText(`C${Math.floor(s / 12) - 1}`, kw + 4, rowY(s) + rh / 2);
      g.globalAlpha = 1;
    }
  }
}
