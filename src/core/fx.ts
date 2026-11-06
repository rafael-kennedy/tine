// Per-voice effects: high-pass, low-pass, drive and a feedback delay, in that
// order. They sit on a voice's bus, after its notes are mixed, so a delay
// repeats the whole voice and drive saturates chords together. Settings come
// from each note's parameters; the latest note sets the bus. A note without
// them puts the bus back to neutral, so deleting `.delay(...)` from the code
// switches the delay off on the next bar.
//
// The browser engine (src/web/engine.ts) builds the same chain from Web Audio
// nodes; this file is the offline version used for WAV export and the CLI.

export interface Fx { hpf: number; lpf: number; drive: number; delay: number; delaySec: number; feedback: number }

export const NEUTRAL_FX: Fx = { hpf: 0, lpf: 0, drive: 0, delay: 0, delaySec: 0.375, feedback: 0.4 };
export const MAX_DELAY_SEC = 4;
export const DRIVE_RANGE = 4; // the drive curve is tanh over [-4, 4]

export function hasFx(p: Record<string, any>): boolean {
  return p.hpf !== undefined || p.lpf !== undefined || p.drive !== undefined || p.delay !== undefined;
}

const clamp = (x: any, lo: number, hi: number) => {
  const v = x && typeof x.toNumber === "function" ? x.toNumber() : Number(x); // exact rationals arrive as R
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo;
};

export function fxOf(p: Record<string, any>): Fx {
  return {
    hpf: p.hpf !== undefined ? clamp(p.hpf, 0, 20000) : 0,
    lpf: p.lpf !== undefined ? clamp(p.lpf, 0, 20000) : 0,
    drive: p.drive !== undefined ? clamp(p.drive, 0, 1) : 0,
    delay: p.delay !== undefined ? clamp(p.delay, 0, 1) : 0,
    delaySec: p.delaySec !== undefined ? clamp(p.delaySec, 0.001, MAX_DELAY_SEC) : NEUTRAL_FX.delaySec,
    feedback: p.feedback !== undefined ? clamp(p.feedback, 0, 0.95) : NEUTRAL_FX.feedback,
  };
}

// Drive: y = tanh(k x) / k^0.7 with k = 1 + 15 d. At d = 0 it is a gentle
// tanh (near unity for normal levels); at d = 1 small signals gain about 2.3x
// and peaks are squashed hard.
export function driveGains(d: number): { pre: number; post: number; k: number } {
  const k = 1 + 15 * d;
  return { pre: k / DRIVE_RANGE, post: 1 / Math.pow(k, 0.7), k };
}

// RBJ cookbook biquad, Q = 1/sqrt(2) (Butterworth), the same response as a
// Web Audio BiquadFilterNode with that Q.
class Biquad {
  b0 = 1; b1 = 0; b2 = 0; a1 = 0; a2 = 0;
  x1 = 0; x2 = 0; y1 = 0; y2 = 0;
  set(type: "lp" | "hp", f: number, sr: number) {
    const w = 2 * Math.PI * Math.min(f, sr * 0.49) / sr, c = Math.cos(w), al = Math.sin(w) / (2 * Math.SQRT1_2);
    const a0 = 1 + al;
    if (type === "lp") { this.b0 = (1 - c) / 2 / a0; this.b1 = (1 - c) / a0; this.b2 = this.b0; }
    else { this.b0 = (1 + c) / 2 / a0; this.b1 = -(1 + c) / a0; this.b2 = this.b0; }
    this.a1 = -2 * c / a0; this.a2 = (1 - al) / a0;
  }
  run(x: number) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// Apply a voice's effects in place. `changes` are (seconds, settings), sorted by time.
export function processBus(L: Float32Array, R: Float32Array, sr: number, changes: { time: number; fx: Fx }[]) {
  if (!changes.length) return;
  const chans = [L, R].map(() => ({ hp: new Biquad(), lp: new Biquad() }));
  const ring = [new Float32Array(Math.ceil(MAX_DELAY_SEC * sr) + 1), new Float32Array(Math.ceil(MAX_DELAY_SEC * sr) + 1)];
  let w = 0, ci = 0;
  let fx = NEUTRAL_FX, dg = driveGains(0), dlen = 1;
  const apply = (f: Fx) => {
    fx = f; dg = driveGains(f.drive); dlen = Math.max(1, Math.round(f.delaySec * sr));
    for (const c of chans) { if (f.hpf > 0) c.hp.set("hp", f.hpf, sr); if (f.lpf > 0) c.lp.set("lp", f.lpf, sr); }
  };
  for (let i = 0; i < L.length; i++) {
    while (ci < changes.length && changes[ci].time * sr <= i) apply(changes[ci++].fx);
    for (let c = 0; c < 2; c++) {
      const buf = c ? R : L, st = chans[c];
      let x = buf[i];
      if (fx.hpf > 0) x = st.hp.run(x);
      if (fx.lpf > 0) x = st.lp.run(x);
      if (fx.drive > 0) x = Math.tanh(dg.k * x) * dg.post;
      const rb = ring[c], r = (w - dlen + rb.length) % rb.length;
      const echo = rb[r];
      rb[w] = fx.delay > 0 ? x + echo * fx.feedback : x;
      buf[i] = x + echo * fx.delay;
    }
    w = (w + 1) % ring[0].length;
  }
}
