// Per-voice effects. They sit on a voice's bus, after its notes are mixed, so
// a delay repeats the whole voice and drive saturates chords together.
// Settings come from each note's parameters; the latest note sets the bus. A
// note without them puts the bus back to neutral, so deleting `.delay(...)`
// from the code switches the delay off on the next bar.
//
// The chain, always in this order:
//   high-pass, low-pass, vowel, drive, crush, coarse, ring, chorus, phaser,
//   compressor, delay, room, duck
//
// This one implementation runs everywhere: offline for WAV export and the
// command line (processBus), and live inside an AudioWorklet in the browser
// (src/web/bus-worklet.ts), so an effect sounds the same in the DAW as in
// the exported file.

export interface Fx {
  hpf: number; lpf: number; drive: number;
  delay: number; delaySec: number; feedback: number;
  vowel: number;                                  // 0 off, 1-5 a e i o u
  crush: number;                                  // bits, 0 off
  coarse: number;                                 // hold every n samples, 0 or 1 off
  ring: number; ringHz: number;
  chorus: number; chorusHz: number; chorusDepth: number;
  phaser: number; phaserHz: number; phaserDepth: number;
  comp: number; compRatio: number;                // threshold in dB below full scale, 0 off
  room: number; roomSize: number;
  duck: string; duckDepth: number; duckSec: number; // duck on this voice's notes
}

export const NEUTRAL_FX: Fx = {
  hpf: 0, lpf: 0, drive: 0, delay: 0, delaySec: 0.375, feedback: 0.4,
  vowel: 0, crush: 0, coarse: 0, ring: 0, ringHz: 0,
  chorus: 0, chorusHz: 0.8, chorusDepth: 0.5, phaser: 0, phaserHz: 0.5, phaserDepth: 0.7,
  comp: 0, compRatio: 4, room: 0, roomSize: 0.5, duck: "", duckDepth: 0.8, duckSec: 0.25,
};
export const MAX_DELAY_SEC = 4;
export const DRIVE_RANGE = 4; // the drive curve is tanh over [-4, 4]
export const VOWELS = ["", "a", "e", "i", "o", "u"];

const FX_PARAMS = ["hpf", "lpf", "drive", "delay", "vowel", "crush", "coarse", "ring", "chorus", "phaser", "comp", "room", "duck"];
export function hasFx(p: Record<string, any>): boolean {
  for (const k of FX_PARAMS) if (p[k] !== undefined) return true;
  return false;
}

const clamp = (x: any, lo: number, hi: number, dflt = lo) => {
  const v = x && typeof x.toNumber === "function" ? x.toNumber() : Number(x); // exact rationals arrive as R
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt;
};
const opt = (p: Record<string, any>, k: string, lo: number, hi: number, d: number) => p[k] !== undefined ? clamp(p[k], lo, hi, d) : d;

export function fxOf(p: Record<string, any>): Fx {
  const N = NEUTRAL_FX;
  return {
    hpf: opt(p, "hpf", 0, 20000, 0),
    lpf: opt(p, "lpf", 0, 20000, 0),
    drive: opt(p, "drive", 0, 1, 0),
    delay: opt(p, "delay", 0, 1, 0),
    delaySec: opt(p, "delaySec", 0.001, MAX_DELAY_SEC, N.delaySec),
    feedback: opt(p, "feedback", 0, 0.95, N.feedback),
    vowel: p.vowel !== undefined ? Math.max(0, VOWELS.indexOf(String(p.vowel).toLowerCase())) : 0,
    crush: p.crush !== undefined ? Math.round(clamp(p.crush, 1, 16, 0)) : 0,
    coarse: p.coarse !== undefined ? Math.round(clamp(p.coarse, 1, 64, 0)) : 0,
    ring: p.ring !== undefined ? opt(p, "ringMix", 0, 1, 1) : 0,
    ringHz: opt(p, "ring", 0, 20000, 0),
    chorus: opt(p, "chorus", 0, 1, 0),
    chorusHz: opt(p, "chorusHz", 0.01, 20, N.chorusHz),
    chorusDepth: opt(p, "chorusDepth", 0, 1, N.chorusDepth),
    phaser: opt(p, "phaser", 0, 1, 0),
    phaserHz: opt(p, "phaserHz", 0.01, 20, N.phaserHz),
    phaserDepth: opt(p, "phaserDepth", 0, 1, N.phaserDepth),
    comp: p.comp !== undefined ? clamp(p.comp, -60, -0.1, 0) : 0,
    compRatio: opt(p, "compRatio", 1, 30, N.compRatio),
    room: opt(p, "room", 0, 1, 0),
    roomSize: opt(p, "roomSize", 0, 1, N.roomSize),
    duck: p.duck !== undefined ? String(p.duck) : "",
    duckDepth: opt(p, "duckDepth", 0, 1, N.duckDepth),
    duckSec: opt(p, "duckSec", 0.005, 8, N.duckSec),
  };
}

// Drive: y = tanh(k x) / k^0.7 with k = 1 + 15 d. At d = 0 it is a gentle
// tanh (near unity for normal levels); at d = 1 small signals gain about 2.3x
// and peaks are squashed hard.
export function driveGains(d: number): { pre: number; post: number; k: number } {
  const k = 1 + 15 * d;
  return { pre: k / DRIVE_RANGE, post: 1 / Math.pow(k, 0.7), k };
}

// RBJ cookbook biquad. Q = 1/sqrt(2) (Butterworth) for the filters, the same
// response as a Web Audio BiquadFilterNode with that Q.
export class Biquad {
  b0 = 1; b1 = 0; b2 = 0; a1 = 0; a2 = 0;
  x1 = 0; x2 = 0; y1 = 0; y2 = 0;
  set(type: "lp" | "hp" | "bp", f: number, sr: number, q = Math.SQRT1_2) {
    const w = 2 * Math.PI * Math.min(f, sr * 0.49) / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q);
    const a0 = 1 + al;
    if (type === "lp") { this.b0 = (1 - c) / 2 / a0; this.b1 = (1 - c) / a0; this.b2 = this.b0; }
    else if (type === "hp") { this.b0 = (1 + c) / 2 / a0; this.b1 = -(1 + c) / a0; this.b2 = this.b0; }
    else { this.b0 = al / a0; this.b1 = 0; this.b2 = -al / a0; } // band-pass, 0 dB peak
    this.a1 = -2 * c / a0; this.a2 = (1 - al) / a0;
  }
  run(x: number) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// Formants (Hz) and their levels for a e i o u, a male voice: the classic
// table from Csound's vowel data, three formants each.
const FORMANTS: [number, number][][] = [
  [],
  [[800, 1], [1150, 0.5], [2900, 0.25]],
  [[350, 1], [2000, 0.1], [2800, 0.18]],
  [[270, 1], [2140, 0.25], [2950, 0.05]],
  [[450, 1], [800, 0.28], [2830, 0.08]],
  [[325, 1], [700, 0.25], [2530, 0.03]],
];

// Freeverb (Jezar at Dreampoint, public domain): eight damped combs and four
// all-passes per channel, the right channel spread by 23 samples. The global
// reverb send uses the same rooms.
export class Freeverb {
  private combs: { buf: Float32Array; i: number; f: number }[];
  private aps: { buf: Float32Array; i: number }[];
  fb = 0.84; damp = 0.2;
  constructor(sr: number, spread: number) {
    this.combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map(x => ({ buf: new Float32Array(Math.round(x * sr / 44100) + spread), i: 0, f: 0 }));
    this.aps = [556, 441, 341, 225].map(x => ({ buf: new Float32Array(Math.round(x * sr / 44100) + spread), i: 0 }));
  }
  size(s: number) { this.fb = 0.7 + 0.28 * s; }
  run(x: number): number {
    let s = 0;
    const inp = x * 0.015, fb = this.fb, d = this.damp;
    for (const c of this.combs) { const y = c.buf[c.i]; c.f = y * (1 - d) + c.f * d; c.buf[c.i] = inp + c.f * fb; if (++c.i === c.buf.length) c.i = 0; s += y; }
    for (const a of this.aps) { const b = a.buf[a.i]; const y = -s + b; a.buf[a.i] = s + b * 0.5; if (++a.i === a.buf.length) a.i = 0; s = y; }
    return s;
  }
}

// A smoothed gain: settings jump at note times, gains glide over about 5 ms so they do not click.
class Smooth { v = 0; constructor(public k: number) {} to(t: number) { this.v += (t - this.v) * this.k; return this.v; } }

interface Chan {
  hp: Biquad; lp: Biquad; vf: Biquad[];
  ring: Float32Array; cho: Float32Array; ap: number[]; apy: number; verb: Freeverb; hold: number;
}

const CHORUS_SEC = 0.05;

// The streaming effect chain. `t` is the time in seconds of the first frame
// passed to process(); it sets the phase of the chorus, phaser and ring
// modulator, so they line up with the music in an export.
export class BusFx {
  fx: Fx = NEUTRAL_FX;
  private ch: Chan[];
  private w = 0; private dw = 0; private dlen = 1;
  private dg = driveGains(0);
  private env = 0; private holdN = 0;
  private duckAt = -1;
  private sm = { delay: new Smooth(0), chorus: new Smooth(0), phaser: new Smooth(0), ring: new Smooth(0), room: new Smooth(0), duck: new Smooth(0) };
  private atk: number; private rel: number;
  constructor(public sr: number) {
    const ringLen = Math.ceil(MAX_DELAY_SEC * sr) + 1, choLen = Math.ceil(CHORUS_SEC * sr) + 2;
    this.ch = [0, 23].map(spread => ({ hp: new Biquad(), lp: new Biquad(), vf: [new Biquad(), new Biquad(), new Biquad()], ring: new Float32Array(ringLen), cho: new Float32Array(choLen), ap: [0, 0, 0, 0, 0, 0, 0, 0], apy: 0, verb: new Freeverb(sr, spread), hold: 0 }));
    const k = 1 - Math.exp(-1 / (0.005 * sr));
    for (const s of Object.values(this.sm)) s.k = k;
    this.atk = 1 - Math.exp(-1 / (0.003 * sr)); this.rel = 1 - Math.exp(-1 / (0.12 * sr));
  }

  set(f: Fx) {
    const sr = this.sr;
    this.fx = f; this.dg = driveGains(f.drive); this.dlen = Math.max(1, Math.round(f.delaySec * sr));
    for (const c of this.ch) {
      if (f.hpf > 0) c.hp.set("hp", f.hpf, sr);
      if (f.lpf > 0) c.lp.set("lp", f.lpf, sr);
      if (f.vowel) FORMANTS[f.vowel].forEach(([hz], i) => c.vf[i].set("bp", hz, sr, 8));
      c.verb.size(f.roomSize);
    }
  }

  // a note of the voice this bus ducks on starts now (frame offset within the next process call)
  duck(frame: number) { this.duckAt = frame; }
  private duckT = Infinity; // seconds since the last duck trigger

  process(L: Float32Array, R: Float32Array, from: number, to: number, t: number) {
    const f = this.fx, sr = this.sr, sm = this.sm;
    const ringLen = this.ch[0].ring.length, choLen = this.ch[0].cho.length;
    const vg = f.vowel ? FORMANTS[f.vowel].map(x => x[1]) : null;
    const thr = f.comp, slope = 1 - 1 / f.compRatio, makeup = f.comp ? Math.pow(10, (-thr * slope / 2) / 20) : 1;
    for (let i = from; i < to; i++) {
      const time = t + (i - from) / sr;
      if (this.duckAt >= 0 && i - from >= this.duckAt) { this.duckT = 0; this.duckAt = -1; }
      // shared per-frame values
      const dMix = sm.delay.to(f.delay), cMix = sm.chorus.to(f.chorus), pMix = sm.phaser.to(f.phaser), rMix = sm.ring.to(f.ring), vMix = sm.room.to(f.room);
      const ringMod = f.ringHz > 0 ? Math.sin(2 * Math.PI * f.ringHz * time) : 0;
      let coarseHold = false;
      if (f.coarse > 1) { coarseHold = this.holdN !== 0; this.holdN = (this.holdN + 1) % f.coarse; }
      // phaser: all-pass corner sweeps exponentially between 200 Hz and up to 3.2 kHz
      let apc = 0;
      if (f.phaser > 0 || pMix > 1e-4) {
        const lfo = 0.5 - 0.5 * Math.cos(2 * Math.PI * f.phaserHz * time);
        const fc = 200 * Math.pow(16, f.phaserDepth * lfo), tn = Math.tan(Math.PI * Math.min(fc, sr * 0.45) / sr);
        apc = (tn - 1) / (tn + 1);
      }
      // compressor: stereo-linked peak detector
      let cg = 1;
      if (f.comp) {
        const lvl = Math.max(Math.abs(L[i]), Math.abs(R[i]));
        this.env += (lvl - this.env) * (lvl > this.env ? this.atk : this.rel);
        const db = 20 * Math.log10(this.env + 1e-9);
        cg = (db > thr ? Math.pow(10, -(db - thr) * slope / 20) : 1) * makeup;
      }
      for (let c = 0; c < 2; c++) {
        const buf = c ? R : L, st = this.ch[c];
        let x = buf[i];
        if (f.hpf > 0) x = st.hp.run(x);
        if (f.lpf > 0) x = st.lp.run(x);
        if (vg) x = (st.vf[0].run(x) * vg[0] + st.vf[1].run(x) * vg[1] + st.vf[2].run(x) * vg[2]) * 2;
        if (f.drive > 0) x = Math.tanh(this.dg.k * x) * this.dg.post;
        if (f.crush > 0) { const q = Math.pow(2, f.crush - 1); x = Math.round(x * q) / q; }
        if (f.coarse > 1) { if (coarseHold) x = st.hold; else st.hold = x; }
        if (rMix > 1e-4) x = x * (1 - rMix) + x * ringMod * rMix;
        // chorus: two voices 90 degrees apart around 12 ms, each channel offset
        st.cho[this.w % choLen] = x;
        if (cMix > 1e-4) {
          const ph = 2 * Math.PI * f.chorusHz * time + c * Math.PI / 2;
          const dsec = 0.012 + 0.008 * f.chorusDepth * Math.sin(ph);
          const pos = (this.w % choLen) - dsec * sr, k = Math.floor(pos), fr = pos - k;
          const a = st.cho[((k % choLen) + choLen) % choLen], b = st.cho[(((k + 1) % choLen) + choLen) % choLen];
          x = x * (1 - cMix * 0.5) + (a + (b - a) * fr) * cMix * 0.5;
        }
        // phaser: four first-order all-passes with feedback
        if (pMix > 1e-4) {
          let y = x + st.apy * 0.5;
          for (let s = 0; s < 4; s++) { const xi = y; y = apc * xi + st.ap[2 * s] - apc * st.ap[2 * s + 1]; st.ap[2 * s] = xi; st.ap[2 * s + 1] = y; }
          st.apy = y;
          x = x * (1 - pMix * 0.5) + y * pMix * 0.5;
        }
        if (f.comp) x *= cg;
        // delay
        const rb = st.ring, r = (this.dw - this.dlen + ringLen) % ringLen, echo = rb[r];
        rb[this.dw] = f.delay > 0 ? x + echo * f.feedback : x;
        x = x + echo * dMix;
        // room
        if (vMix > 1e-4 || f.room > 0) { const wet = st.verb.run(x) * 3; x = x + (wet - x) * vMix * 0.5; }
        buf[i] = x;
      }
      // duck: dip at once, recover over duckSec with a squared curve
      let dk = 0;
      if (f.duck && this.duckT < f.duckSec) { const u = this.duckT / f.duckSec; dk = f.duckDepth * (1 - u) * (1 - u); }
      this.duckT += 1 / sr;
      const dgain = 1 - sm.duck.to(dk);
      if (dgain < 0.9999) { L[i] *= dgain; R[i] *= dgain; }
      this.dw = (this.dw + 1) % ringLen;
      this.w++;
    }
  }
}

// Apply a voice's effects in place. `changes` are (seconds, settings), sorted by
// time; `ducks` are the times of notes this bus ducks on, sorted.
export function processBus(L: Float32Array, R: Float32Array, sr: number, changes: { time: number; fx: Fx }[], ducks: number[] = []) {
  if (!changes.length) return;
  const bus = new BusFx(sr);
  const marks = new Set<number>();
  for (const c of changes) marks.add(Math.max(0, Math.round(c.time * sr)));
  for (const d of ducks) marks.add(Math.max(0, Math.round(d * sr)));
  const cuts = [...marks].filter(m => m < L.length).sort((a, b) => a - b);
  cuts.push(L.length);
  let ci = 0, di = 0, from = 0;
  for (const to of cuts) {
    if (to > from) bus.process(L, R, from, to, from / sr);
    from = to;
    while (ci < changes.length && Math.round(changes[ci].time * sr) <= from) bus.set(changes[ci++].fx);
    while (di < ducks.length && Math.round(ducks[di] * sr) <= from) { bus.duck(0); di++; }
  }
}
