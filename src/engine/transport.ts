// The engine's scheduler: the browser Transport (src/web/transport.ts) moved
// onto a sample clock. Time is the mixer's frame count, so the audio device
// that pulls frames is the only clock and nothing can drift. Before each block
// is rendered, tick() schedules every note that starts before the end of the
// block plus a short look-ahead, so note audio is made ahead of its frame.
//
// Swaps happen at the next bar (or beat, or at once), as in the browser.
// Mute and solo are voice gains in the mixer, so they act within a block
// instead of waiting for the look-ahead.
import { Scene, VoiceDef, liveNotes, formNotes, timeline, barSeconds, TimedNote, StreamMixer } from "../core";

export type Quantize = "bar" | "beat" | "now";

export class EngineTransport {
  scene: Scene | null = null;
  pending: Scene | null = null;
  playing = false;
  mode: "live" | "form" = "live";
  quantize: Quantize = "bar";
  loopForm = false;
  muted = new Set<string>();
  soloed = new Set<string>();
  faders = new Map<string, number>();
  section: string | undefined;
  sectionStart = 0;
  pendingSection: string | null | undefined = undefined; // null clears

  private anchorTime = 0;   // bar anchorBar sounds at anchorTime (seconds of the sample clock)
  private anchorBar = 0;
  private barSec = 2;
  private scheduledTo = 0;  // bars
  private formStart = 0;
  lookahead = 0.1;

  onError: ((voice: string, err: unknown) => void) | null = null;
  onSwap: ((bar: number) => void) | null = null;
  onSection: ((name: string | undefined) => void) | null = null;
  onEnd: (() => void) | null = null;
  onNote: ((n: TimedNote, frame: number) => void) | null = null;

  constructor(public mixer: StreamMixer) {}

  get now() { return this.mixer.frame / this.mixer.sr; }

  hasForm(s = this.scene) { return !!(s?.form && s.form.length); }

  tempo(): number {
    const s = this.scene; if (!s) return 120;
    if (this.mode === "live" && this.section) return s.sections.get(this.section)?.tempo ?? s.tempo;
    return s.tempo;
  }

  bar(t = this.now): number { return this.anchorBar + (t - this.anchorTime) / this.barSec; }
  timeOfBar(b: number): number { return this.anchorTime + (b - this.anchorBar) * this.barSec; }
  currentBar(t = this.now): number { return this.mode === "form" && this.hasForm() ? this.formBarAt(t) : this.bar(t); }

  // Every voice name in a scene, top level and in sections.
  static voiceNames(s: Scene | null): string[] {
    if (!s) return [];
    return [...new Set([...s.voices.keys(), ...[...s.sections.values()].flatMap(x => [...x.voices.keys()])])];
  }

  applyGains() {
    for (const v of new Set([...EngineTransport.voiceNames(this.scene), ...EngineTransport.voiceNames(this.pending)])) {
      const off = this.muted.has(v) || (this.soloed.size > 0 && !this.soloed.has(v));
      this.mixer.setGain(v, off ? 0 : this.faders.get(v) ?? 1);
    }
  }

  load(scene: Scene) {
    if (!this.playing || !this.scene) { this.scene = scene; this.pending = null; this.applyGains(); return; }
    this.pending = scene;
    this.applyGains();
    if (this.quantize === "now") this.applyPending(this.scheduledTo);
  }

  private applyPending(atBar: number) {
    if (!this.pending) return;
    this.scene = this.pending; this.pending = null;
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

  // Active voices take new code at once; the rest wait for the bar (see the browser Transport).
  swapActive(next: Scene, present: Set<string>): string[] {
    const swapped: string[] = [];
    const merge = (into: Scene): Scene => {
      const out: Scene = { ...into, voices: new Map(into.voices), sections: new Map([...into.sections].map(([k, v]) => [k, { ...v, voices: new Map(v.voices) }])) };
      const apply = (dst: Map<string, VoiceDef>, src: Map<string, VoiceDef> | undefined) => {
        for (const [name, v] of src ?? []) if (v.active) { dst.set(name, v); if (!swapped.includes(name)) swapped.push(name); }
        for (const [name, v] of dst) if (v.active && !present.has(name) && !src?.has(name)) dst.delete(name);
      };
      apply(out.voices, next.voices);
      for (const [k, sec] of out.sections) apply(sec.voices, next.sections.get(k)?.voices);
      return out;
    };
    if (!this.scene) return [];
    this.scene = merge(this.scene);
    if (this.pending) this.pending = merge(this.pending);
    return swapped;
  }

  launch(section: string | null) {
    this.pendingSection = section;
    if (!this.playing) { this.section = section ?? undefined; this.sectionStart = 0; this.pendingSection = undefined; this.onSection?.(this.section); }
  }

  start(fromBar = 0) {
    if (!this.scene) return;
    this.mode = this.hasForm() ? "form" : "live";
    this.playing = true;
    this.barSec = barSeconds(this.scene, this.tempo());
    // start a hair after the current frame, so the first notes are not late
    this.anchorTime = this.now + 0.02;
    this.anchorBar = fromBar;
    this.scheduledTo = fromBar;
    this.formStart = this.anchorTime - (this.mode === "form" ? this.formSecOf(fromBar) : 0);
  }

  stop() {
    this.playing = false;
    this.pendingSection = undefined;
    this.mixer.panic();
  }

  // Schedule everything that starts before `until` seconds (plus the look-ahead).
  tick(until = this.now) {
    if (!this.playing || !this.scene) return;
    if (this.mode === "form" && this.hasForm()) { this.formTick(until); return; }
    const horizon = this.bar(until + this.lookahead);
    let a = this.scheduledTo;
    while (a < horizon - 1e-9) {
      // query in quarter bars, which keeps the windows exact fractions, and
      // stop at the next swap point so new code takes over exactly there
      let b = Math.min(horizon, Math.floor(a * 4 + 1e-9) / 4 + 0.25);
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
  }

  private scheduleLive(a: number, b: number) {
    const notes = liveNotes(this.scene!, a, b, { onError: (v, e) => this.onError?.(v, e), section: this.section, sectionStart: this.sectionStart });
    for (const n of notes) this.dispatch({ ...n, durSec: n.bars * this.barSec }, this.timeOfBar(n.bar));
  }

  // ---- form mode: the arrangement may change tempo, so it runs on seconds ----
  private formSecOf(bar: number, scene = this.scene!): number {
    const tl = timeline(scene); if (!tl.bars) return 0;
    const loops = Math.floor(bar / tl.bars), r = bar - loops * tl.bars;
    const seg = tl.segments.find(g => r < g.startBar + g.bars) ?? tl.segments[tl.segments.length - 1];
    return loops * tl.seconds + seg.startSec + (r - seg.startBar) * barSeconds(scene, seg.tempo);
  }
  formBarAt(t = this.now): number {
    const scene = this.scene; if (!scene) return 0;
    const tl = timeline(scene); if (!tl.seconds) return 0;
    const s = t - this.formStart;
    const loops = Math.floor(s / tl.seconds), r = s - loops * tl.seconds;
    const seg = tl.segments.find(g => r < g.startSec + g.bars * barSeconds(scene, g.tempo)) ?? tl.segments[tl.segments.length - 1];
    return loops * tl.bars + seg.startBar + (r - seg.startSec) / barSeconds(scene, seg.tempo);
  }
  formLength(): { bars: number; seconds: number } { const tl = this.scene ? timeline(this.scene) : { bars: 0, seconds: 0 }; return { bars: tl.bars, seconds: tl.seconds }; }

  private formTick(until: number) {
    const scene = this.scene!; const tl = timeline(scene);
    if (!tl.bars) return;
    let horizon = this.formBarAt(until + this.lookahead);
    if (!this.loopForm) {
      horizon = Math.min(horizon, tl.bars);
      if (this.now > this.formStart + tl.seconds + 0.05) { this.playing = false; this.onEnd?.(); return; }
    }
    let a = this.scheduledTo;
    while (a < horizon - 1e-9) {
      let b = Math.min(horizon, Math.floor(a * 4 + 1e-9) / 4 + 0.25);
      const nb = Math.floor(a + 1e-9) + 1;
      const loops = Math.floor(a / tl.bars + 1e-9);
      b = Math.min(b, (loops + 1) * tl.bars);
      const notes = formNotes(scene, a - loops * tl.bars, b - loops * tl.bars, { onError: (v, e) => this.onError?.(v, e) });
      for (const n of notes) {
        const bar = n.bar + loops * tl.bars, when = this.formStart + this.formSecOf(bar);
        this.dispatch({ ...n, bar, durSec: this.formSecOf(bar + n.bars) - this.formSecOf(bar) }, when);
      }
      a = b;
      if (this.pending && Math.abs(a - nb) < 1e-9) {
        // keep bar `a` where it is in time, under the new arrangement's tempos
        const at = this.formStart + this.formSecOf(a);
        this.scene = this.pending; this.pending = null;
        if (!this.hasForm()) { this.mode = "live"; this.anchorBar = a; this.anchorTime = at; this.barSec = barSeconds(this.scene, this.tempo()); }
        else this.formStart = at - this.formSecOf(a);
        this.onSwap?.(a);
        this.scheduledTo = a;
        return this.tick(until);
      }
    }
    this.scheduledTo = a;
  }

  private dispatch(n: TimedNote, when: number) {
    const frame = Math.round(when * this.mixer.sr);
    if (this.mixer.add(n, frame)) this.onNote?.(n, frame);
  }
}
