import { Freeverb } from "./fx";
// The built-in instruments, as pure sample-generating functions.
// The same code renders offline WAV files on the command line and renders
// each note into an AudioBuffer in the browser, so a piece sounds the same
// in the DAW, the tutorial and an exported file.

export interface NoteSpec {
  inst: string;
  freq: number;
  semi: number;
  vel: number;      // 0..1
  dur: number;      // seconds the key is held
  params: Record<string, any>;
}

export const INSTRUMENT_DOCS: Record<string, string> = {
  keys: "Electric piano: FM tines, warm and bell-like. The default.",
  sine: "Pure sine wave.",
  tri: "Triangle wave, soft and hollow.",
  saw: "Sawtooth through a low-pass filter, bright.",
  square: "Square wave, reedy.",
  pluck: "Plucked string (Karplus-Strong).",
  bass: "Saw-and-sub bass with a filter envelope.",
  pad: "Three detuned saws, slow attack, wide.",
  bell: "FM bell with a long ring.",
  organ: "Drawbar-style additive organ.",
  lead: "Detuned square and saw lead.",
  upright: "Upright (acoustic) bass: a round plucked tone with a soft finger thump. For walking lines.",
  vibes: "Vibraphone: struck metal bars with a motor tremolo and a long ring.",
  kit: "Drum kit: plays General MIDI drum note numbers (kick, snare, hat, ...).",
  synth: "The general synth: choose .wave (saw, square, pulse, tri, sine, super, fm, noise), then shape it with .fenv, .pw, .unison, .sub, .vibrato, .wobble and .glide.",
  fm: "Two-operator FM: a sine modulated by a sine. .fm(index, ratio, decay) sets the colour.",
  supersaw: "Seven detuned saws, the trance and big-room lead.",
  tb303: "Acid bass: a resonant filter that snaps shut on every note. Add .glide(.06) for slides.",
  reese: "Detuned saws with a sub, the drum and bass bass.",
  wobble: "Saw and sub through a filter that wobbles in time: .wobble(rate per bar, depth).",
  chip: "Pulse wave with a quick vibrato, like a game console.",
  brass: "Saws with a filter that opens slowly, for stabs and swells.",
  strings: "A soft detuned ensemble with slow attack and gentle vibrato.",
  marimba: "FM mallet: a short woody strike.",
  noise: "Filtered white noise, for risers, sweeps and hats.",
};

// Named sounds made from the general synth: a preset is only default
// parameters, so anything set in code overrides it: inst(tb303).res(.5).
export const PRESETS: Record<string, Record<string, any>> = {
  fm: { wave: "fm", fm: 3, fmRatio: 2, fmDecay: 0.4, attack: 0.002, decay: 0.8, sustain: 0.3, release: 0.2 },
  supersaw: { wave: "super", unison: 7, detune: 25, cutoff: 7000, attack: 0.01, decay: 0.2, sustain: 0.85, release: 0.3 },
  tb303: { wave: "saw", cutoff: 350, res: 0.85, fenv: 3.5, fdecay: 0.18, attack: 0.002, decay: 0.3, sustain: 0.6, release: 0.04 },
  reese: { wave: "super", unison: 3, detune: 18, sub: 0.5, cutoff: 900, res: 0.2, attack: 0.005, decay: 0.1, sustain: 1, release: 0.1 },
  wobble: { wave: "saw", sub: 0.6, cutoff: 250, res: 0.5, wobble: 2, wobbleDepth: 3.5, attack: 0.005, decay: 0.1, sustain: 1, release: 0.06 },
  chip: { wave: "pulse", pw: 0.25, vibrato: 6, vibratoDepth: 0.15, vibratoDelay: 0.15, attack: 0.001, decay: 0.1, sustain: 0.7, release: 0.02 },
  brass: { wave: "super", unison: 2, detune: 8, cutoff: 600, res: 0.1, fenv: 2.2, fattack: 0.06, fdecay: 0.5, attack: 0.04, decay: 0.3, sustain: 0.85, release: 0.15 },
  strings: { wave: "super", unison: 4, detune: 12, cutoff: 3200, vibrato: 5, vibratoDepth: 0.08, vibratoDelay: 0.3, attack: 0.4, decay: 0.3, sustain: 0.9, release: 0.8 },
  marimba: { wave: "fm", fm: 2.2, fmRatio: 4, fmDecay: 0.04, attack: 0.001, decay: 0.45, sustain: 0, release: 0.12 },
  noise: { wave: "noise", cutoff: 8000, attack: 0.005, decay: 0.2, sustain: 0.8, release: 0.2 },
};

let noiseSeed = 22222;
function noise() { noiseSeed = (Math.imul(noiseSeed, 1103515245) + 12345) >>> 0; return (noiseSeed / 2147483648) - 1; }

function env(i: number, sr: number, a: number, d: number, s: number, r: number, held: number): number {
  const t = i / sr;
  if (t < a) return t / a;
  let level: number;
  if (t < a + d) level = 1 - (1 - s) * ((t - a) / d);
  else level = s;
  if (t >= held) {
    // level at release start
    const tr = held;
    let l0: number;
    if (tr < a) l0 = tr / a; else if (tr < a + d) l0 = 1 - (1 - s) * ((tr - a) / d); else l0 = s;
    const k = (t - held) / Math.max(r, 1e-4);
    return k >= 1 ? 0 : l0 * Math.pow(1 - k, 2);
  }
  return level;
}

// Topology-preserving state-variable low-pass filter
class LP {
  ic1 = 0; ic2 = 0;
  run(x: number, cutoff: number, res: number, sr: number): number {
    const g = Math.tan(Math.PI * Math.min(cutoff, sr * 0.45) / sr);
    const k = 2 - 2 * Math.min(0.98, Math.max(0, res));
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x - this.ic2, v1 = a1 * this.ic1 + a2 * v3, v2 = this.ic2 + a2 * this.ic1 + a3 * v3;
    this.ic1 = 2 * v1 - this.ic1; this.ic2 = 2 * v2 - this.ic2;
    return v2;
  }
}

function polyblep(t: number, dt: number): number {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

function osc(kind: string, phase: number, dt: number): number {
  switch (kind) {
    case "sine": return Math.sin(2 * Math.PI * phase);
    case "tri": return 1 - 4 * Math.abs(phase - 0.5);
    case "square": { let v = phase < 0.5 ? 1 : -1; v += polyblep(phase, dt); v -= polyblep((phase + 0.5) % 1, dt); return v; }
    default: return 2 * phase - 1 - polyblep(phase, dt); // saw
  }
}

export function noteLength(spec: NoteSpec): number {
  const rel = Number(spec.params.release ?? defaultsFor(spec.inst).r);
  if (spec.inst === "kit") return drumLength(Math.round(spec.semi));
  if (PRESETS[spec.inst]) { const p = { ...PRESETS[spec.inst], ...spec.params }; return Math.min(20, spec.dur + Number(p.release ?? 0.12)); }
  if (spec.inst === "vibes") return Math.min(8, spec.dur + rel + 0.1);
  if (spec.inst === "pluck" || spec.inst === "bell") return Math.min(8, spec.dur + rel + (spec.inst === "bell" ? 2.5 : 1.2));
  return Math.min(20, spec.dur + rel);
}

function defaultsFor(inst: string) {
  switch (inst) {
    case "synth": return { a: 0.005, d: 0.2, s: 0.75, r: 0.12 };
    case "pad": return { a: 0.35, d: 0.3, s: 0.8, r: 0.9 };
    case "bass": return { a: 0.004, d: 0.18, s: 0.6, r: 0.06 };
    case "organ": return { a: 0.01, d: 0.05, s: 1, r: 0.08 };
    case "keys": return { a: 0.002, d: 1.2, s: 0.35, r: 0.25 };
    case "lead": return { a: 0.01, d: 0.2, s: 0.7, r: 0.12 };
    case "upright": return { a: 0.004, d: 0.9, s: 0, r: 0.07 };
    case "vibes": return { a: 0.001, d: 1.8, s: 0, r: 0.45 };
    case "sine": case "tri": return { a: 0.005, d: 0.1, s: 0.85, r: 0.1 };
    default: return { a: 0.004, d: 0.15, s: 0.7, r: 0.1 };
  }
}

// ---------- slurs and glissandos ----------
// Audio plays a slurred run as its first note, held for the whole run (see
// withSlurs in scene.ts); the other notes of the run are not played.
export function performed<T extends { durSec: number; params: Record<string, any> }>(n: T): T | null {
  if (n.params.slurIn) return null;
  return n.params.runSec !== undefined ? { ...n, durSec: Number(n.params.runSec) } : n;
}

// A run's pitch path, [time, semitones, time, semitones, ...] joined by
// straight lines, as a frequency ratio at sample i. Asked in order of i.
export function bender(curve: unknown, sr: number): ((i: number) => number) | null {
  if (!Array.isArray(curve) || curve.length < 2) return null;
  const c = curve.map(Number);
  let k = 0;
  return (i: number) => {
    const t = i / sr;
    while (k < c.length && c[k] <= t) k += 2;
    let semi: number;
    if (k === 0) semi = 0;
    else if (k >= c.length) semi = c[c.length - 1];
    else { const t0 = c[k - 2], s0 = c[k - 1], t1 = c[k], s1 = c[k + 1]; semi = t1 > t0 ? s0 + (s1 - s0) * (t - t0) / (t1 - t0) : s1; }
    return Math.pow(2, semi / 12);
  };
}

export function renderNote(spec: NoteSpec, sr: number): Float32Array {
  if (PRESETS[spec.inst]) spec = { ...spec, inst: "synth", params: { ...PRESETS[spec.inst], ...spec.params } };
  const len = Math.max(1, Math.ceil(noteLength(spec) * sr));
  const out = new Float32Array(len);
  // Noise restarts for every note, so a note sounds the same whichever thread
  // renders it and in whatever order.
  noiseSeed = (22222 + Math.round(spec.semi * 1000) * 7919) >>> 0;
  const p = spec.params;
  const amp = Math.pow(spec.vel, 1.3) * Number(p.gain ?? 1) * 0.32;
  const d = defaultsFor(spec.inst);
  const a = Number(p.attack ?? d.a), dc = Number(p.decay ?? d.d), s = Number(p.sustain ?? d.s), r = Number(p.release ?? d.r);
  const held = Math.max(0.005, spec.dur);
  const f = spec.freq, dt0 = f / sr, bend = bender(p.curve, sr);
  let dt = dt0;
  const lp = new LP();
  const res = Number(p.res ?? 0.1);
  switch (spec.inst) {
    case "kit": return renderDrum(Math.round(spec.semi), spec.vel * Number(p.gain ?? 1), sr, out);
    case "pluck": {
      const N = Math.max(2, Math.round(sr / f));
      const buf = new Float32Array(N);
      for (let i = 0; i < N; i++) buf[i] = noise();
      let idx = 0, last = 0;
      const damp = 0.996 - 0.25 / Math.max(1, f / 50) * 0.01;
      const cutoff = Number(p.cutoff ?? 6000);
      for (let i = 0; i < len; i++) {
        const cur = buf[idx];
        const nxt = 0.5 * (cur + buf[(idx + 1) % N]) * damp;
        buf[idx] = nxt; idx = (idx + 1) % N;
        const rel = i / sr > held ? Math.max(0, 1 - (i / sr - held) / Math.max(0.05, r)) : 1;
        last = lp.run(cur, cutoff, 0, sr);
        out[i] = last * amp * 1.4 * rel;
      }
      return out;
    }
    case "keys": case "bell": {
      const ratio = spec.inst === "bell" ? 3.5 : 1;
      const idx0 = spec.inst === "bell" ? 5 : 2.2 * (0.5 + spec.vel);
      const decayT = spec.inst === "bell" ? 1.4 : 0.6;
      const tine = spec.inst === "keys" ? 14 : 0; // the bright metallic "tine" partial
      let pc = 0, pm = 0, pt = 0;
      for (let i = 0; i < len; i++) {
        if (bend) dt = dt0 * bend(i);
        const t = i / sr;
        const e = spec.inst === "bell" ? Math.exp(-t / 2.2) * (t > held + 2.5 ? 0 : 1) : env(i, sr, a, dc, s, r, held);
        const index = idx0 * Math.exp(-t / decayT);
        const m = Math.sin(2 * Math.PI * pm) * index;
        let v = Math.sin(2 * Math.PI * pc + m);
        if (tine) v += 0.12 * Math.sin(2 * Math.PI * pt) * Math.exp(-t / 0.05);
        out[i] = v * e * amp;
        pc += dt; pm += dt * ratio; pt += dt * tine; pc %= 1; pm %= 1; pt %= 1;
      }
      return out;
    }
    case "organ": {
      const draw = [1, 0.6, 0.4, 0.25, 0.15];
      let ph = 0;
      for (let i = 0; i < len; i++) {
        if (bend) dt = dt0 * bend(i);
        let v = 0; for (let h = 0; h < draw.length; h++) v += draw[h] * Math.sin(2 * Math.PI * ph * (h + 1));
        out[i] = v * 0.4 * env(i, sr, a, dc, s, r, held) * amp; ph = (ph + dt) % 1;
      }
      return out;
    }
    case "pad": {
      const det = [1, 1.0059, 0.9941]; const ph = [0, 0.33, 0.66];
      const cutoff = Number(p.cutoff ?? 1800);
      for (let i = 0; i < len; i++) {
        if (bend) dt = dt0 * bend(i);
        let v = 0; for (let k = 0; k < 3; k++) { v += osc("saw", ph[k], dt * det[k]); ph[k] = (ph[k] + dt * det[k]) % 1; }
        const e = env(i, sr, a, dc, s, r, held);
        out[i] = lp.run(v / 3, cutoff * (0.6 + 0.4 * e), res, sr) * e * amp * 1.2;
      }
      return out;
    }
    case "bass": {
      let ph = 0, ps = 0;
      const cutoff = Number(p.cutoff ?? 900);
      for (let i = 0; i < len; i++) {
        if (bend) dt = dt0 * bend(i);
        const t = i / sr;
        const e = env(i, sr, a, dc, s, r, held);
        const fe = Math.exp(-t / 0.12);
        const v = 0.6 * osc("saw", ph, dt) + 0.6 * Math.sin(2 * Math.PI * ps);
        out[i] = lp.run(v, cutoff * (0.5 + 3 * fe), Math.max(res, 0.25), sr) * e * amp * 1.3;
        ph = (ph + dt) % 1; ps = (ps + dt / 2) % 1;
      }
      return out;
    }
    case "upright": {
      // sine body, quickly fading 2nd and 3rd partials, a finger thump, and a closing filter
      let ph = 0;
      const cutoff = Number(p.cutoff ?? 1400);
      for (let i = 0; i < len; i++) {
        if (bend) dt = dt0 * bend(i);
        const t = i / sr;
        const rel = t > held ? Math.max(0, 1 - (t - held) / Math.max(0.03, r)) : 1;
        const e = Math.exp(-t / dc) * Math.min(1, t / 0.003) * rel;
        const w = 2 * Math.PI * ph;
        const v = 0.6 * Math.sin(w) + 0.33 * Math.sin(2 * w) * Math.exp(-t / 0.22) + 0.18 * Math.sin(3 * w) * Math.exp(-t / 0.09) + 0.15 * noise() * Math.exp(-t / 0.006);
        out[i] = lp.run(v, cutoff * (0.7 + 1.6 * Math.exp(-t / 0.06)), 0.05, sr) * e * amp * 1.5;
        ph = (ph + dt) % 1;
      }
      return out;
    }
    case "vibes": {
      // fundamental plus the bar's 4th partial, motor tremolo, damper on release
      let ph = 0;
      const rate = Number(p.tremolo ?? 5.5);
      for (let i = 0; i < len; i++) {
        if (bend) dt = dt0 * bend(i);
        const t = i / sr;
        const rel = t > held ? Math.max(0, 1 - (t - held) / Math.max(0.05, r)) : 1;
        const trem = 1 - 0.3 * (0.5 - 0.5 * Math.cos(2 * Math.PI * rate * t));
        const w = 2 * Math.PI * ph;
        const v = Math.sin(w) + 0.3 * Math.sin(4 * w) * Math.exp(-t / 0.25) + 0.08 * Math.sin(10 * w) * Math.exp(-t / 0.03);
        out[i] = v * Math.exp(-t / dc) * Math.min(1, t / 0.0015) * rel * trem * amp;
        ph = (ph + dt) % 1;
      }
      return out;
    }
    case "lead": {
      let p1 = 0, p2 = 0.5;
      const cutoff = Number(p.cutoff ?? 3200);
      for (let i = 0; i < len; i++) {
        if (bend) dt = dt0 * bend(i);
        const e = env(i, sr, a, dc, s, r, held);
        const v = 0.5 * osc("square", p1, dt) + 0.5 * osc("saw", p2, dt * 1.004);
        out[i] = lp.run(v, cutoff, res, sr) * e * amp * 0.9;
        p1 = (p1 + dt) % 1; p2 = (p2 + dt * 1.004) % 1;
      }
      return out;
    }
    case "synth": return renderSynth(spec, sr, out, amp, a, dc, s, r, held);
    default: {
      const kind = ["sine", "tri", "square", "saw"].includes(spec.inst) ? spec.inst : "saw";
      const cutoff = Number(p.cutoff ?? (kind === "saw" || kind === "square" ? 4000 : 18000));
      let ph = 0;
      for (let i = 0; i < len; i++) {
        if (bend) dt = dt0 * bend(i);
        let v = osc(kind, ph, dt);
        if (kind === "saw" || kind === "square" || p.cutoff !== undefined) v = lp.run(v, cutoff, res, sr);
        out[i] = v * env(i, sr, a, dc, s, r, held) * amp * (kind === "sine" || kind === "tri" ? 1.1 : 0.7);
        ph = (ph + dt) % 1;
      }
      return out;
    }
  }
}

function drumLength(n: number): number {
  if (n === 35 || n === 36) return 0.5;
  if (n === 49 || n === 57 || n === 52 || n === 55) return 1.6;
  if (n === 51 || n === 59 || n === 53) return 1.0;
  if (n === 46) return 0.45;
  if (n >= 41 && n <= 50 && n !== 42 && n !== 44 && n !== 46) return 0.6;
  return 0.3;
}

function renderDrum(n: number, vel: number, sr: number, out: Float32Array): Float32Array {
  const len = out.length;
  const amp = Math.pow(vel, 1.2) * 0.9;
  const hp = { x: 0, y: 0 };
  const highpass = (x: number, c: number) => { const y = c * (hp.y + x - hp.x); hp.x = x; hp.y = y; return y; };
  const lp = new LP();
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let v = 0;
    if (n === 35 || n === 36) {
      const f = 48 + 110 * Math.exp(-t / 0.035);
      ph += f / sr; v = Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.28) + 0.3 * noise() * Math.exp(-t / 0.004);
      v = Math.tanh(v * 1.6);
    } else if (n === 38 || n === 40) {
      ph += (185 + 60 * Math.exp(-t / 0.02)) / sr;
      v = 0.55 * Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.06) + 0.7 * highpass(noise(), 0.9) * Math.exp(-t / 0.13);
    } else if (n === 39) {
      const bursts = [0, 0.011, 0.022];
      let e = 0; for (const b of bursts) if (t >= b) e = Math.max(e, Math.exp(-(t - b) / (b === 0.022 ? 0.09 : 0.008)));
      v = lp.run(highpass(noise(), 0.95), 2400, 0.4, sr) * e * 1.8;
    } else if (n === 42 || n === 44) {
      v = highpass(noise(), 0.6) * Math.exp(-t / 0.035) * 0.6;
    } else if (n === 46) {
      v = highpass(noise(), 0.6) * Math.exp(-t / 0.2) * 0.5;
    } else if (n === 49 || n === 57 || n === 52 || n === 55) {
      v = highpass(noise(), 0.7) * Math.exp(-t / 0.6) * 0.45;
    } else if (n === 51 || n === 59 || n === 53) {
      ph += 5200 / sr;
      v = (0.25 * highpass(noise(), 0.8) + 0.18 * Math.sin(2 * Math.PI * ph)) * Math.exp(-t / 0.4);
    } else if (n === 37 || n === 75 || n === 76) {
      ph += (n === 37 ? 1700 : n === 75 ? 2500 : 1100) / sr; v = Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.015);
    } else if (n === 56) {
      const e = Math.exp(-t / 0.12);
      v = 0.35 * ((Math.sin(2 * Math.PI * 540 * t) > 0 ? 1 : -1) + (Math.sin(2 * Math.PI * 800 * t) > 0 ? 1 : -1)) * e;
      v = lp.run(v, 2500, 0.3, sr);
    } else if (n === 54 || n === 70 || n === 69) {
      v = highpass(noise(), 0.5) * Math.exp(-t / 0.06) * 0.5;
    } else if (n >= 41 && n <= 50) {
      const base = 70 + (n - 41) * 18;
      ph += (base + base * 0.6 * Math.exp(-t / 0.05)) / sr; v = Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.22);
    } else {
      // any other note: a tuned percussive blip, so nothing is ever silent
      const f = 440 * Math.pow(2, (n - 69) / 12);
      ph += f / sr; v = Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.08);
    }
    out[i] = v * amp;
  }
  return out;
}

// Simple Schroeder/Freeverb-style reverb used for the offline mix.
export function reverb(L: Float32Array, R: Float32Array, sr: number) {
  const run = (inp: Float32Array, spread: number) => {
    const v = new Freeverb(sr, spread), out = new Float32Array(inp.length);
    for (let n = 0; n < inp.length; n++) out[n] = v.run(inp[n]);
    return out;
  };
  return [run(L, 0), run(R, 23)];
}

// ---------- the general synth ----------
// One oscillator section (saw, square, pulse, tri, sine, a detuned stack of
// saws, two-operator FM, or noise) with a sub, a resonant low-pass with its
// own envelope and a tempo-synced wobble, vibrato, and glide from the
// previous note. Every named preset above is this with different defaults.

const num = (v: any, d: number) => { const x = v && typeof v.toNumber === "function" ? v.toNumber() : Number(v ?? d); return Number.isFinite(x) ? x : d; };

function pulse(phase: number, dt: number, w: number): number {
  let v = phase < w ? 1 : -1;
  v += polyblep(phase, dt);
  v -= polyblep((phase - w + 1) % 1, dt);
  return v - (2 * w - 1); // remove the DC a narrow pulse carries
}

function renderSynth(spec: NoteSpec, sr: number, out: Float32Array, amp: number, a: number, dc: number, s: number, r: number, held: number): Float32Array {
  const p = spec.params, len = out.length;
  const wave = String(p.wave ?? "saw");
  const pw = Math.max(0.02, Math.min(0.98, num(p.pw, 0.5)));
  const unison = Math.max(1, Math.min(16, Math.round(num(p.unison, wave === "super" ? 7 : 1))));
  const detune = num(p.detune, wave === "super" ? 25 : 0);
  const sub = Math.max(0, Math.min(1, num(p.sub, 0)));
  const cutoff = num(p.cutoff, 18000), res = Math.max(0, Math.min(0.98, num(p.res, 0.1)));
  const fenv = num(p.fenv, 0), fa = Math.max(1e-4, num(p.fattack, 0.001)), fd = Math.max(1e-4, num(p.fdecay, 0.2));
  const vib = num(p.vibrato, 0), vibD = num(p.vibratoDepth, 0.3), vibDelay = num(p.vibratoDelay, 0);
  const wob = num(p.wobbleHz, 0), wobD = num(p.wobbleDepth, 2);
  const glide = num(p.glide, 0), from = p.glideFrom !== undefined ? num(p.glideFrom, spec.semi) - spec.semi : 0;
  const bend = bender(p.curve, sr);
  const fmI = num(p.fm, 0), fmR = num(p.fmRatio, 2), fmD = Math.max(1e-4, num(p.fmDecay, 0.4));
  const filtered = p.cutoff !== undefined || fenv !== 0 || wob > 0 || wave === "noise" || cutoff < 18000;
  // unison voices spread evenly over +-detune cents, with fixed starting phases
  const ratios = Array.from({ length: unison }, (_, k) => unison === 1 ? 1 : Math.pow(2, (detune * (2 * k / (unison - 1) - 1)) / 1200));
  const phases = ratios.map((_, k) => (k * 0.618034) % 1);
  const gainU = 1 / Math.sqrt(unison);
  let pm = 0, ps = 0;
  const lp = new LP();
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let semis = 0;
    if (glide > 0 && from !== 0 && t < glide) semis += from * (1 - t / glide);
    if (vib > 0 && t > vibDelay) semis += vibD * Math.sin(2 * Math.PI * vib * (t - vibDelay)) * Math.min(1, (t - vibDelay) / 0.2);
    const f = spec.freq * (semis ? Math.pow(2, semis / 12) : 1) * (bend ? bend(i) : 1), dt = f / sr;
    let v = 0;
    if (wave === "noise") v = noise();
    else if (wave === "fm") {
      const idx = fmI * Math.exp(-t / fmD);
      v = Math.sin(2 * Math.PI * phases[0] + idx * Math.sin(2 * Math.PI * pm));
      phases[0] = (phases[0] + dt) % 1; pm = (pm + dt * fmR) % 1;
    } else {
      for (let k = 0; k < unison; k++) {
        const d = dt * ratios[k];
        v += wave === "pulse" ? pulse(phases[k], d, pw) : wave === "super" ? osc("saw", phases[k], d) : osc(wave, phases[k], d);
        phases[k] = (phases[k] + d) % 1;
      }
      v *= gainU;
    }
    if (sub > 0) { v += sub * Math.sin(2 * Math.PI * ps); ps = (ps + dt / 2) % 1; }
    if (filtered) {
      let oct = 0;
      if (fenv) oct += fenv * (t < fa ? t / fa : Math.exp(-(t - fa) / fd));
      if (wob > 0) oct += wobD * (0.5 - 0.5 * Math.cos(2 * Math.PI * wob * t));
      v = lp.run(v, Math.min(sr * 0.45, cutoff * Math.pow(2, oct)), res, sr);
    }
    out[i] = v * env(i, sr, a, dc, s, r, held) * amp * 0.8;
  }
  return out;
}
