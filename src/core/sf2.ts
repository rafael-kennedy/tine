// SoundFont 2 player. A SoundFont is one file of recorded instruments with
// the rules for playing them: which recording covers which keys and
// velocities, where it loops, its envelope and tuning. General MIDI banks
// such as GeneralUser GS or FluidR3 give all 128 standard instruments and the
// drum kits in one download.
//
// This reads the file and renders one note to a buffer, like renderSample, so
// export and the DAW share it. It covers what makes General MIDI banks sound
// right: key and velocity zones, root key and tuning, loops, the volume
// envelope, attenuation and the initial low-pass filter. Modulators and the
// modulation envelope are not applied; chorus and reverb sends are left to
// Tine's own effects.

export interface SfSample { name: string; start: number; end: number; loopStart: number; loopEnd: number; rate: number; root: number; correction: number }
export interface SfPreset { name: string; bank: number; program: number; zones: { gens: Map<number, number>; inst: number }[]; global: Map<number, number> }
interface SfInst { name: string; zones: { gens: Map<number, number>; sample: number }[]; global: Map<number, number> }

export interface SoundFont { name: string; presets: SfPreset[]; insts: SfInst[]; samples: SfSample[]; data: Int16Array }

// generator numbers from the SoundFont 2.04 specification
const G = {
  startOffset: 0, endOffset: 1, loopStartOffset: 2, loopEndOffset: 3, startCoarse: 4, filterFc: 8, filterQ: 9, endCoarse: 12, pan: 17,
  delayVol: 33, attackVol: 34, holdVol: 35, decayVol: 36, sustainVol: 37, releaseVol: 38, keynumToVolHold: 39, keynumToVolDecay: 40,
  instrument: 41, keyRange: 43, velRange: 44, loopStartCoarse: 45, keynum: 46, velocity: 47, attenuation: 48, loopEndCoarse: 50,
  coarseTune: 51, fineTune: 52, sampleID: 53, sampleModes: 54, scaleTuning: 56, rootKey: 58,
};
const RANGE = new Set([G.keyRange, G.velRange]);

export function parseSf2(bytes: Uint8Array): SoundFont {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  if (tag(0) !== "RIFF" || tag(8) !== "sfbk") throw new Error("not a SoundFont 2 file");
  const chunks = new Map<string, { o: number; size: number }>();
  let name = "";
  const walk = (o: number, end: number) => {
    while (o + 8 <= end) {
      const id = tag(o), size = v.getUint32(o + 4, true);
      if (id === "LIST") walk(o + 12, o + 8 + size);
      else chunks.set(id, { o: o + 8, size });
      o += 8 + size + (size & 1);
    }
  };
  walk(12, bytes.length);
  const str = (o: number, n: number) => { let s = ""; for (let i = 0; i < n && bytes[o + i]; i++) s += String.fromCharCode(bytes[o + i]); return s.trim(); };
  const inam = chunks.get("INAM"); if (inam) name = str(inam.o, inam.size);
  const need = (id: string) => { const c = chunks.get(id); if (!c) throw new Error(`SoundFont has no ${id} chunk`); return c; };
  const smpl = need("smpl");
  const data = new Int16Array(smpl.size >> 1);
  for (let i = 0; i < data.length; i++) data[i] = v.getInt16(smpl.o + 2 * i, true);

  const records = (id: string, size: number) => { const c = need(id); return Array.from({ length: Math.floor(c.size / size) }, (_, i) => c.o + i * size); };
  const gens = (id: string) => records(id, 4).map(o => {
    const oper = v.getUint16(o, true);
    return { oper, amount: RANGE.has(oper) ? (bytes[o + 2] | (bytes[o + 3] << 8)) : v.getInt16(o + 2, true) };
  });
  const bags = (id: string) => records(id, 4).map(o => v.getUint16(o, true));
  const pgen = gens("pgen"), igen = gens("igen"), pbag = bags("pbag"), ibag = bags("ibag");
  const zonesOf = (bagFrom: number, bagTo: number, bag: number[], gen: { oper: number; amount: number }[], key: number) => {
    const zones: Map<number, number>[] = [];
    for (let b = bagFrom; b < bagTo; b++) {
      const m = new Map<number, number>();
      for (let g = bag[b]; g < bag[b + 1]; g++) m.set(gen[g].oper, gen[g].amount);
      zones.push(m);
    }
    // a first zone without the terminal generator is the global zone
    const global = zones.length && !zones[0].has(key) ? zones.shift()! : new Map<number, number>();
    return { zones: zones.filter(z => z.has(key)), global };
  };

  const shdr = records("shdr", 46);
  const samples: SfSample[] = shdr.slice(0, -1).map(o => ({
    name: str(o, 20), start: v.getUint32(o + 20, true), end: v.getUint32(o + 24, true), loopStart: v.getUint32(o + 28, true), loopEnd: v.getUint32(o + 32, true),
    rate: v.getUint32(o + 36, true), root: bytes[o + 40], correction: v.getInt8(o + 41),
  }));
  const instRecs = records("inst", 22);
  const insts: SfInst[] = instRecs.slice(0, -1).map((o, i) => {
    const z = zonesOf(v.getUint16(o + 20, true), v.getUint16(instRecs[i + 1] + 20, true), ibag, igen, G.sampleID);
    return { name: str(o, 20), global: z.global, zones: z.zones.map(g => ({ gens: g, sample: g.get(G.sampleID)! })) };
  });
  const phdr = records("phdr", 38);
  const presets: SfPreset[] = phdr.slice(0, -1).map((o, i) => {
    const z = zonesOf(v.getUint16(o + 24, true), v.getUint16(phdr[i + 1] + 24, true), pbag, pgen, G.instrument);
    return { name: str(o, 20), program: v.getUint16(o + 20, true), bank: v.getUint16(o + 22, true), global: z.global, zones: z.zones.map(g => ({ gens: g, inst: g.get(G.instrument)! })) };
  });
  return { name, presets, insts, samples, data };
}

// Program numbers here count from 0, as in the file; Tine's gm() counts from 1.
export function findPreset(sf: SoundFont, program: number, bank = 0): SfPreset | undefined {
  return sf.presets.find(p => p.program === program && p.bank === bank) ?? sf.presets.find(p => p.program === program && p.bank === (bank >= 128 ? 128 : 0)) ?? (bank >= 128 ? sf.presets.find(p => p.bank === 128) : undefined);
}
export function findPresetByName(sf: SoundFont, name: string): SfPreset | undefined {
  const n = name.toLowerCase();
  return sf.presets.find(p => p.name.toLowerCase() === n) ?? sf.presets.find(p => p.name.toLowerCase().includes(n));
}

const inRange = (r: number | undefined, x: number) => r === undefined || (x >= (r & 255) && x <= (r >> 8));
const tc = (x: number | undefined, d: number) => Math.pow(2, (x ?? d) / 1200); // timecents to seconds

// The zones a key and velocity play, with preset generators added to instrument ones.
export function regions(sf: SoundFont, preset: SfPreset, key: number, vel: number): { g: (id: number, d: number) => number; sample: SfSample }[] {
  const out: { g: (id: number, d: number) => number; sample: SfSample }[] = [];
  for (const pz of preset.zones) {
    const pr = (id: number) => pz.gens.get(id) ?? preset.global.get(id);
    if (!inRange(pr(G.keyRange), key) || !inRange(pr(G.velRange), vel)) continue;
    const inst = sf.insts[pz.inst]; if (!inst) continue;
    for (const iz of inst.zones) {
      const ir = (id: number) => iz.gens.get(id) ?? inst.global.get(id);
      if (!inRange(ir(G.keyRange), key) || !inRange(ir(G.velRange), vel)) continue;
      const sample = sf.samples[iz.sample]; if (!sample) continue;
      // instrument values are absolute; preset values add to them (spec 9.4)
      const g = (id: number, d: number) => (ir(id) ?? d) + (id === G.sampleModes || id === G.rootKey || id === G.keynum || id === G.velocity ? 0 : (pr(id) ?? 0));
      out.push({ g, sample });
    }
  }
  return out;
}

export interface SfNote { semi: number; vel: number; durSec: number; gain?: number }

export function renderSf(sf: SoundFont, preset: SfPreset, n: SfNote, sr: number): Float32Array {
  const key = Math.max(0, Math.min(127, Math.round(n.semi))), vel = Math.max(1, Math.min(127, Math.round(n.vel * 127)));
  const regs = regions(sf, preset, key, vel);
  if (!regs.length) return new Float32Array(0);
  let longest = 0, last = 0;
  const parts = regs.map(r => {
    const rel = Math.min(8, tc(r.g(G.releaseVol, -12000), 0));
    longest = Math.max(longest, n.durSec + rel);
    return { r, rel };
  });
  const len = Math.ceil(Math.min(30, longest) * sr);
  const out = new Float32Array(len);
  const d = sf.data;
  for (const { r, rel } of parts) {
    const g = r.g, s = r.sample;
    const start = s.start + g(G.startOffset, 0) + 32768 * g(G.startCoarse, 0);
    const end = s.end + g(G.endOffset, 0) + 32768 * g(G.endCoarse, 0);
    const ls = s.loopStart + g(G.loopStartOffset, 0) + 32768 * g(G.loopStartCoarse, 0);
    const le = s.loopEnd + g(G.loopEndOffset, 0) + 32768 * g(G.loopEndCoarse, 0);
    const mode = g(G.sampleModes, 0) & 3, loops = (mode === 1 || mode === 3) && le > ls + 1;
    const rk = g(G.rootKey, -1), root = rk >= 0 ? rk : s.root;
    const cents = (n.semi - root) * g(G.scaleTuning, 100) + 100 * g(G.coarseTune, 0) + g(G.fineTune, 0) + s.correction;
    const step = Math.pow(2, cents / 1200) * s.rate / sr;
    // volume: attenuation in centibels (scaled 0.4, as FluidSynth and the E-mu hardware do), velocity on a square law
    const gain = Math.pow(10, -0.4 * Math.max(0, g(G.attenuation, 0)) / 200) * Math.pow(vel / 127, 2) * 1.5 * (n.gain ?? 1);
    const dly = tc(g(G.delayVol, -12000), 0), att = tc(g(G.attackVol, -12000), 0), hold = tc(g(G.holdVol, -12000), 0);
    const dec = tc(g(G.decayVol, -12000), 0), sus = Math.pow(10, -Math.max(0, Math.min(1440, g(G.sustainVol, 0))) / 200);
    const fc = g(G.filterFc, 13500), filt = fc < 13500;
    const fhz = 8.176 * Math.pow(2, fc / 1200), q = Math.max(0, g(G.filterQ, 0)) / 10; // dB of resonance
    let ic1 = 0, ic2 = 0;
    const fg = Math.tan(Math.PI * Math.min(fhz, sr * 0.45) / sr), fk = 1 / Math.max(0.5, Math.pow(10, q / 20) * Math.SQRT1_2);
    const a1 = 1 / (1 + fg * (fg + fk)), a2 = fg * a1, a3 = fg * a2;
    let pos = start, relLevel = -1;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      // envelope (spec 8.1.2): delay, linear attack, hold, then decay and
      // release fall 100 dB over their time, linearly in decibels
      let e: number;
      if (t < dly) e = 0;
      else if (t < dly + att) e = (t - dly) / att;
      else if (t < dly + att + hold) e = 1;
      else e = Math.max(sus, Math.pow(10, -5 * (t - dly - att - hold) / Math.max(1e-3, dec)));
      if (t >= n.durSec) {
        if (relLevel < 0) relLevel = e;
        const k = (t - n.durSec) / Math.max(1e-3, rel);
        if (k >= 1) break;
        e = relLevel * Math.pow(10, -5 * k);
      }
      const k = Math.floor(pos), f = pos - k;
      if (k >= end - 1 && !loops) break;
      const x0 = d[k] ?? 0, x1 = d[loops && k + 1 >= le ? ls : k + 1] ?? 0;
      let x = (x0 + (x1 - x0) * f) / 32768;
      if (filt) {
        const v3 = x - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
        ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2; x = v2;
      }
      out[i] += x * e * gain;
      if (i > last) last = i;
      pos += step;
      if (loops && (mode === 1 || t < n.durSec) && pos >= le) pos -= le - ls;
    }
  }
  return out.subarray(0, last + 1);
}

// The preset a note asks for: gm("name"), gm(program, bank), or the drum kit
// for drum names with no program.
const presetCache = new WeakMap<SoundFont, Map<string, SfPreset | undefined>>();
export function presetFor(sf: SoundFont, p: Record<string, any>): SfPreset | undefined {
  const key = `${p.gmName ?? ""}|${p.gmProgram ?? ""}|${p.gmBank ?? ""}|${p.drum ? 1 : 0}`;
  let m = presetCache.get(sf); if (!m) presetCache.set(sf, (m = new Map()));
  if (m.has(key)) return m.get(key);
  const r = p.gmName ? findPresetByName(sf, String(p.gmName))
    : p.gmProgram === undefined && p.drum ? findPreset(sf, 0, 128)
    : findPreset(sf, Number(p.gmProgram ?? 0), Number(p.gmBank ?? 0));
  m.set(key, r);
  return r;
}
