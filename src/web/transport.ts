// Look-ahead scheduler. A timer wakes every 25 ms and schedules every note
// that begins in the next ~120 ms, using exact audio-clock timestamps. New
// code is swapped in on the next bar line (or beat, or immediately), so
// re-evaluating never disturbs the groove.
import { Scene, liveNotes, formNotes, timeline, barSeconds, TimedNote, Inputs } from "../core";
import { Engine } from "./engine";

export type Quantize = "bar" | "beat" | "now";

export interface ScheduledNote extends TimedNote { when: number }

export class Transport {
  scene: Scene | null = null;
  pending: Scene | null = null;
  playing = false;
  mode: "live" | "form" = "live";
  quantize: Quantize = "bar";
  loopForm = true;
  muted = new Set<string>();
  soloed = new Set<string>();
  section: string | undefined;
  sectionStart = 0;
  pendingSection: string | null | undefined = undefined; // null means "clear"
  clockOut = false;

  // time anchor: bar `anchorBar` happens at audio time `anchorTime`
  private anchorTime = 0;
  private anchorBar = 0;
  private barSec = 2;
  private scheduledTo = 0; // bars
  private timer: any = null;
  private nextClock = 0;
  lookahead = 0.12;

  onNotes: ((notes: ScheduledNote[]) => void) | null = null;
  onError: ((voice: string, err: unknown) => void) | null = null;
  onSwap: ((bar: number) => void) | null = null;
  onSection: ((name: string | undefined) => void) | null = null;
  onEnd: (() => void) | null = null;

  constructor(public engine: Engine) {}

  get inputs(): Inputs {
    return { cc: (n, ch) => this.engine.ccValue(n, ch), held: () => [...this.engine.held].sort((a, b) => a - b) };
  }

  tempo(): number {
    const s = this.scene; if (!s) return 120;
    if (this.mode === "live" && this.section) return s.sections.get(this.section)?.tempo ?? s.tempo;
    return s.tempo;
  }

  bar(t = this.engine.now): number { return this.anchorBar + (t - this.anchorTime) / this.barSec; }
  timeOfBar(b: number): number { return this.anchorTime + (b - this.anchorBar) * this.barSec; }

  load(scene: Scene) {
    if (!this.playing || !this.scene) { this.scene = scene; this.pending = null; this.engine.tuningRef = scene.tuningRef; return; }
    this.pending = scene;
    if (this.quantize === "now") this.applyPending(this.scheduledTo);
  }

  private applyPending(atBar: number) {
    if (!this.pending) return;
    this.scene = this.pending; this.pending = null;
    this.engine.tuningRef = this.scene.tuningRef;
    if (this.section && !this.scene.sections.has(this.section)) { this.section = undefined; this.onSection?.(undefined); }
    this.reanchor(atBar);
    this.onSwap?.(atBar);
  }

  private reanchor(atBar: number) {
    if (!this.scene) return;
    const t = this.timeOfBar(atBar);
    this.anchorBar = atBar; this.anchorTime = t;
    this.barSec = barSeconds(this.scene, this.tempo());
  }

  launch(section: string | null) { this.pendingSection = section; if (!this.playing) { this.section = section ?? undefined; this.sectionStart = 0; this.onSection?.(this.section); } }

  async start(fromBar = 0) {
    if (!this.scene) return;
    await this.engine.resume();
    this.playing = true;
    this.barSec = barSeconds(this.scene, this.tempo());
    this.anchorTime = this.engine.now + 0.08;
    this.anchorBar = fromBar;
    this.scheduledTo = fromBar;
    this.nextClock = this.anchorTime;
    this.formStart = this.anchorTime;
    if (this.clockOut) this.engine.sendStartStop(true);
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
  }

  stop() {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.clockOut) this.engine.sendStartStop(false);
    this.engine.panic();
  }

  private effectiveMuted(): Set<string> {
    if (!this.soloed.size || !this.scene) return this.muted;
    const m = new Set(this.muted);
    const all = new Set([...this.scene.voices.keys(), ...[...this.scene.sections.values()].flatMap(s => [...s.voices.keys()])]);
    for (const v of all) if (!this.soloed.has(v)) m.add(v);
    return m;
  }

  private tick() {
    if (!this.playing || !this.scene) return;
    if (this.mode === "form" && this.scene.form?.length) { this.formTick(); return; }
    const horizon = this.bar(this.engine.now + this.lookahead);
    let a = this.scheduledTo;
    while (a < horizon) {
      // stop at the next swap point so new code takes over exactly there
      let b = horizon;
      const q = this.quantize === "beat" ? 1 / this.scene.meter[0] : 1;
      const nextBoundary = Math.floor(a / q + 1e-9) * q + q;
      const swapping = (this.pending || this.pendingSection !== undefined) && this.quantize !== "now";
      if (swapping && b >= nextBoundary) b = nextBoundary;
      this.scheduleLive(a, b);
      a = b;
      if (swapping && Math.abs(a - nextBoundary) < 1e-9) {
        if (this.pending) this.applyPending(a);
        if (this.pendingSection !== undefined && Math.abs(a - Math.round(a)) < 1e-9) {
          this.section = this.pendingSection ?? undefined; this.sectionStart = Math.round(a); this.pendingSection = undefined;
          this.reanchor(a); this.onSection?.(this.section);
        }
      }
    }
    this.scheduledTo = a;
    this.clock();
  }

  private clock() {
    if (!this.clockOut || !this.scene) return;
    const tick = this.barSec / (this.scene.meter[0] * (4 / this.scene.meter[1]) * 24);
    const until = this.engine.now + this.lookahead;
    if (this.nextClock < this.engine.now - 0.5) this.nextClock = this.engine.now;
    while (this.nextClock < until) { this.engine.sendClock(this.nextClock); this.nextClock += tick; }
  }

  private scheduleLive(a: number, b: number) {
    const scene = this.scene!;
    const notes = liveNotes(scene, a, b, { inputs: this.inputs, muted: this.effectiveMuted(), onError: (v, e) => this.onError?.(v, e), section: this.section, sectionStart: this.sectionStart });
    this.dispatch(notes.map(n => ({ ...n, when: this.timeOfBar(n.bar), durSec: n.bars * this.barSec })));
  }

  // ---- form mode: the arrangement may change tempo, so it runs on seconds ----
  private formStart = 0;
  formBarAt(t = this.engine.now): number {
    const scene = this.scene; if (!scene) return 0;
    const tl = timeline(scene); if (!tl.seconds) return 0;
    const s = t - this.formStart;
    const loops = Math.floor(s / tl.seconds), r = s - loops * tl.seconds;
    const seg = tl.segments.find(g => r < g.startSec + g.bars * barSeconds(scene, g.tempo)) ?? tl.segments[tl.segments.length - 1];
    return loops * tl.bars + seg.startBar + (r - seg.startSec) / barSeconds(scene, seg.tempo);
  }
  private formTimeOf(bar: number): number {
    const scene = this.scene!; const tl = timeline(scene);
    const loops = Math.floor(bar / tl.bars), r = bar - loops * tl.bars;
    const seg = tl.segments.find(g => r < g.startBar + g.bars) ?? tl.segments[tl.segments.length - 1];
    return this.formStart + loops * tl.seconds + seg.startSec + (r - seg.startBar) * barSeconds(scene, seg.tempo);
  }
  private formTick() {
    const scene = this.scene!; const tl = timeline(scene);
    if (!tl.bars) return;
    let horizon = this.formBarAt(this.engine.now + this.lookahead);
    if (!this.loopForm) {
      horizon = Math.min(horizon, tl.bars);
      if (this.engine.now > this.formStart + tl.seconds + 0.2) { this.stop(); this.onEnd?.(); return; }
    }
    let a = this.scheduledTo;
    while (a < horizon - 1e-9) {
      let b = horizon;
      const nb = Math.floor(a + 1e-9) + 1;
      if (this.pending && b >= nb) b = nb;
      const loops = Math.floor(a / tl.bars + 1e-9);
      const lb = Math.min(b, (loops + 1) * tl.bars);
      const notes = formNotes(scene, a - loops * tl.bars, lb - loops * tl.bars, { inputs: this.inputs, muted: this.effectiveMuted(), onError: (v, e) => this.onError?.(v, e) });
      this.dispatch(notes.map(n => {
        const bar = n.bar + loops * tl.bars, when = this.formTimeOf(bar);
        return { ...n, bar, when, durSec: this.formTimeOf(bar + n.bars) - when };
      }));
      a = lb;
      if (this.pending && Math.abs(a - nb) < 1e-9) { this.scene = this.pending; this.pending = null; this.onSwap?.(a); return void (this.scheduledTo = a); }
    }
    this.scheduledTo = a;
    const seg = tl.segments.find(g => (a % tl.bars) < g.startBar + g.bars);
    if (seg) this.barSec = barSeconds(scene, seg.tempo);
    this.clock();
  }

  private dispatch(notes: ScheduledNote[]) {
    for (const n of notes) this.engine.play(n, n.when);
    if (notes.length) this.onNotes?.(notes);
  }

  currentBar(): number { return this.mode === "form" && this.scene?.form?.length ? this.formBarAt() : this.bar(); }

  positionText(): string {
    if (!this.scene || !this.playing) return "1.1";
    const b = Math.max(0, this.currentBar());
    const beats = this.scene.meter[0];
    return `${Math.floor(b) + 1}.${Math.floor((b % 1) * beats) + 1}`;
  }
}
