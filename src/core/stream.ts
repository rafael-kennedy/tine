// Streaming mixer: the offline mix() cut into blocks, for live playback outside
// the browser. Notes are added ahead of time at absolute frames; render(n)
// returns the next n frames. Effects (BusFx) and the reverb keep their state
// from block to block, so a held reverb or a delay tail runs on unbroken.
//
// Two differences from mix(): there is no final peak normalisation (a live
// stream cannot look ahead at its loudest moment), and each voice has a gain
// that can change while it plays (mute, solo, faders), smoothed over a block.
import { TimedNote } from "./scene";
import { Freeverb, BusFx, Fx, hasFx, fxOf } from "./fx";
import { noteBuffer, placement, NoteSources } from "./render";

const FADE = 128; // frames: the fade when a note is cut off (cut groups, panic)

interface Playing { buf: Float32Array; at: number; gl: number; gr: number; send: number; voice: string; cut?: number; stopAt: number }
interface Bus { fx: BusFx; L: Float32Array; R: Float32Array; events: { at: number; fx?: Fx; duck?: boolean }[]; last: Fx | null; quiet: number }

export class StreamMixer {
  frame = 0;                                   // the next frame render() returns
  master = 1;
  private playing: Playing[] = [];
  private buses = new Map<string, Bus>();
  private verb: [Freeverb, Freeverb];
  private cache = new Map<string, Float32Array>();
  private target = new Map<string, number>();  // voice gains as set
  private gain = new Map<string, number>();    // voice gains as heard (ramped per block)

  constructor(public sr = 44100, public sources: NoteSources = {}) {
    this.verb = [new Freeverb(sr, 0), new Freeverb(sr, 23)];
  }

  setGain(voice: string, g: number) { this.target.set(voice, g); }
  gainOf(voice: string) { return this.target.get(voice) ?? 1; }

  // Add a note that starts at absolute frame `at`. Returns false if it makes no sound here.
  add(n: TimedNote, at: number): boolean {
    const buf = noteBuffer(n, this.sr, this.sources, this.cache);
    if (!buf) return false;
    at = Math.max(at, this.frame);
    const { gl, gr, send } = placement(n.params);
    if (hasFx(n.params)) {
      let bus = this.buses.get(n.voice);
      if (!bus) this.buses.set(n.voice, bus = { fx: new BusFx(this.sr), L: new Float32Array(0), R: new Float32Array(0), events: [], last: null, quiet: 0 });
      const fx = fxOf(n.params);
      bus.events.push({ at, fx }); bus.last = fx;
    }
    // a note of this voice ducks every bus set to duck on it
    for (const bus of this.buses.values()) if ((bus.last ?? bus.fx.fx).duck === n.voice) bus.events.push({ at, duck: true });
    const cut = n.params.cut !== undefined ? Number(n.params.cut) : undefined;
    if (cut !== undefined) for (const p of this.playing) if (p.cut === cut && p.at < at) p.stopAt = Math.min(p.stopAt, at);
    this.playing.push({ buf, at, gl, gr, send, voice: n.voice, cut, stopAt: Infinity });
    return true;
  }

  // Fade out everything that is sounding or waiting. Effect and reverb tails ring on.
  panic() {
    for (const p of this.playing) p.stopAt = Math.min(p.stopAt, this.frame);
    this.playing = this.playing.filter(p => p.at < this.frame);
  }

  get busy(): boolean { return this.playing.length > 0; }

  render(n: number): [Float32Array, Float32Array] {
    const F = this.frame, E = F + n, sr = this.sr;
    const L = new Float32Array(n), R = new Float32Array(n);
    const sL = new Float32Array(n), sR = new Float32Array(n);
    for (const bus of this.buses.values()) if (bus.L.length !== n) { bus.L = new Float32Array(n); bus.R = new Float32Array(n); } else { bus.L.fill(0); bus.R.fill(0); }
    const ramps = new Map<string, [number, number]>();
    const ramp = (v: string) => {
      let r = ramps.get(v);
      if (!r) { const to = this.target.get(v) ?? 1, from = this.gain.get(v) ?? to; ramps.set(v, r = [from, to]); }
      return r;
    };
    const keep: Playing[] = [];
    for (const p of this.playing) {
      const end = Math.min(p.at + p.buf.length, p.stopAt + FADE);
      if (p.at >= E) { keep.push(p); continue; }
      const [g0, g1] = ramp(p.voice);
      const bus = this.buses.get(p.voice);
      const oL = bus ? bus.L : L, oR = bus ? bus.R : R;
      for (let i = Math.max(F, p.at); i < Math.min(E, end); i++) {
        const k = i - F;
        let v = p.buf[i - p.at] * (g0 + (g1 - g0) * k / n);
        if (i >= p.stopAt) v *= 1 - (i - p.stopAt) / FADE;
        oL[k] += v * p.gl; oR[k] += v * p.gr;
        if (p.send > 0) { sL[k] += v * p.gl * p.send; sR[k] += v * p.gr * p.send; }
      }
      if (end > E) keep.push(p);
    }
    this.playing = keep;
    for (const [v, [, to]] of ramps) this.gain.set(v, to);
    // voice buses: settings change and ducks trigger at their frames within the block
    for (const [voice, bus] of this.buses) {
      bus.events.sort((a, b) => a.at - b.at);
      let from = 0;
      while (from < n) {
        while (bus.events.length && bus.events[0].at <= F + from) {
          const e = bus.events.shift()!;
          if (e.fx) bus.fx.set(e.fx);
          if (e.duck) bus.fx.duck(0);
        }
        const to = bus.events.length ? Math.min(n, bus.events[0].at - F) : n;
        bus.fx.process(bus.L, bus.R, from, to, (F + from) / sr);
        from = to;
      }
      let peak = 0;
      for (let k = 0; k < n; k++) { L[k] += bus.L[k]; R[k] += bus.R[k]; peak = Math.max(peak, Math.abs(bus.L[k]), Math.abs(bus.R[k])); }
      // a bus that has been silent for three seconds with nothing to play is dropped
      bus.quiet = peak < 1e-5 && !bus.events.length && !this.playing.some(p => p.voice === voice) ? bus.quiet + n : 0;
      if (bus.quiet > 3 * sr) this.buses.delete(voice);
    }
    const [vl, vr] = this.verb, m = this.master;
    for (let k = 0; k < n; k++) {
      L[k] = Math.tanh((L[k] + vl.run(sL[k])) * 0.9) * m;
      R[k] = Math.tanh((R[k] + vr.run(sR[k])) * 0.9) * m;
    }
    this.frame = E;
    return [L, R];
  }
}

// Interleaved 16-bit little-endian PCM, the format audio devices take everywhere.
export function toPcm16(L: Float32Array, R: Float32Array): Uint8Array {
  const out = new Uint8Array(L.length * 4), v = new DataView(out.buffer);
  for (let i = 0; i < L.length; i++) {
    const l = Math.max(-1, Math.min(1, L[i])), r = Math.max(-1, Math.min(1, R[i]));
    v.setInt16(i * 4, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    v.setInt16(i * 4 + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
  }
  return out;
}
