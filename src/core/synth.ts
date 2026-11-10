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
  if (spec.inst === "vibes") return Math.min(8, spec.dur + rel + 0.1);
  if (spec.inst === "pluck" || spec.inst === "bell") return Math.min(8, spec.dur + rel + (spec.inst === "bell" ? 2.5 : 1.2));
  return Math.min(20, spec.dur + rel);
}

function defaultsFor(inst: string) {
  switch (inst) {
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

export function renderNote(spec: NoteSpec, sr: number): Float32Array {
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
  const f = spec.freq, dt = f / sr;
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
        let v = 0; for (let h = 0; h < draw.length; h++) v += draw[h] * Math.sin(2 * Math.PI * ph * (h + 1));
        out[i] = v * 0.4 * env(i, sr, a, dc, s, r, held) * amp; ph = (ph + dt) % 1;
      }
      return out;
    }
    case "pad": {
      const det = [1, 1.0059, 0.9941]; const ph = [0, 0.33, 0.66];
      const cutoff = Number(p.cutoff ?? 1800);
      for (let i = 0; i < len; i++) {
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
        const e = env(i, sr, a, dc, s, r, held);
        const v = 0.5 * osc("square", p1, dt) + 0.5 * osc("saw", p2, dt * 1.004);
        out[i] = lp.run(v, cutoff, res, sr) * e * amp * 0.9;
        p1 = (p1 + dt) % 1; p2 = (p2 + dt * 1.004) % 1;
      }
      return out;
    }
    default: {
      const kind = ["sine", "tri", "square", "saw"].includes(spec.inst) ? spec.inst : "saw";
      const cutoff = Number(p.cutoff ?? (kind === "saw" || kind === "square" ? 4000 : 18000));
      let ph = 0;
      for (let i = 0; i < len; i++) {
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
