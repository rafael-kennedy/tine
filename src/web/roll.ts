// Canvas piano roll with a playhead. Used by the DAW and tutorial cells.
import { VOICE_COLORS } from "./theme";

export interface RollNote { voice: string; bar: number; bars: number; semi: number; vel: number }

export class Roll {
  notes: RollNote[] = [];
  colors = new Map<string, string>();
  head = -1;
  window = 2;       // bars visible
  follow = true;
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
    const x = (b: number) => ((b - start) / this.window) * w;
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
    if (this.head >= start && this.head <= end) {
      g.fillStyle = css.getPropertyValue("--brass2");
      g.fillRect(x(this.head), 0, 2, h);
    }
  }
}
