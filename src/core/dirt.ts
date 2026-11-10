// SuperDirt, the sound engine of TidalCycles, as an output. A note with
// .dirt() (or every note, under `tine dirt`) becomes one /dirt/play message.
// A Tine bar is a Tidal cycle, so cps is bars per second and cycle the bar.
import { oscMessage, oscBundle, OscArg } from "./osc";
import { DRUMS } from "./pitch";

const DRUM_NAME = new Map(Object.entries(DRUMS).map(([k, v]) => [v, k]).reverse()); // first name wins for each number

// Tine's own instruments and drum names, as the closest SuperDirt sounds.
// SuperDirt's synths come from its default synth library; the drum banks are
// Dirt-Samples. Anything else passes through by name: .dirt("superzow").
export const DIRT_SYNTHS: Record<string, string> = {
  keys: "superpiano", saw: "supersaw", square: "supersquare", synth: "supersaw", supersaw: "supersaw",
  fm: "superfm", noise: "supernoise", organ: "superhammond", chip: "superchip", pad: "supersaw", lead: "supersquare", sine: "sine",
};
export const DIRT_DRUMS: Record<string, string> = {
  kick: "bd", kick2: "bd", snare: "sn", snare2: "sn", clap: "cp", hat: "hh", pedal: "hh", ohat: "oh", crash: "cr",
  crash2: "cr", ride: "ride", rim: "rm", cowbell: "cb", tom1: "lt", tom2: "lt", tom3: "mt", tom4: "mt", tom5: "ht", tom6: "ht",
};

export interface DirtNote { semi: number; vel: number; durSec: number; bars: number; bar: number; params: Record<string, any> }

const n = (v: any) => (v && typeof v.toNumber === "function" ? v.toNumber() : Number(v));

// The /dirt/play arguments for one note, as alternating names and values.
export function dirtArgs(note: DirtNote): OscArg[] {
  const p = note.params, out: OscArg[] = [];
  const put = (k: string, v: OscArg | undefined) => { if (v !== undefined && !(typeof v === "number" && !Number.isFinite(v))) out.push(k, v); };
  const barSec = note.bars > 0 ? note.durSec / note.bars : 2;
  const inst = String(p.inst ?? "keys");
  // the sound: .dirt("name"), else a sample name, else a drum name, else the instrument
  let s = typeof p.dirt === "string" && p.dirt ? p.dirt : "", idx = p.sampleN !== undefined ? n(p.sampleN) : undefined, pitched = true;
  if (!s && inst.startsWith("sample:")) {
    const spec = inst.slice(7), m = /^(.*):(-?\d+)$/.exec(spec);
    s = m ? m[1] : spec; if (m) idx = Number(m[2]);
    if (!s && p.drum) s = DIRT_DRUMS[p.drum] ?? p.drum;
    pitched = !p.hit && !p.drum;
  }
  if (!s && (p.drum || inst === "kit")) { const d = p.drum ?? DRUM_NAME.get(Math.round(note.semi)) ?? ""; s = DIRT_DRUMS[d] ?? "bd"; pitched = false; }
  if (!s) s = DIRT_SYNTHS[inst] ?? inst;
  put("s", s);
  if (idx !== undefined) put("n", idx);
  put("orbit", { i: Math.max(0, Math.round(n(p.orbit ?? 0))) });
  put("cps", 1 / barSec);
  put("cycle", note.bar);
  put("delta", note.durSec);
  if (pitched) put("note", note.semi - 60);
  put("amp", 0.4 * note.vel / 0.8 * (p.gain !== undefined ? n(p.gain) : 1));
  if (p.pan !== undefined) put("pan", (Math.max(-1, Math.min(1, n(p.pan))) + 1) / 2);
  if (!inst.startsWith("sample:") || p.fit || p.loopSec !== undefined) put("sustain", note.durSec);
  if (p.loopSec !== undefined) { put("unit", "c"); put("speed", barSec / n(p.loopSec) * (p.speed !== undefined ? n(p.speed) : 1)); }
  else if (p.speed !== undefined) put("speed", n(p.speed));
  const same: [string, string][] = [["begin", "begin"], ["end", "end"], ["accel", "accelerate"], ["cut", "cut"], ["coarse", "coarse"], ["crush", "crush"], ["drive", "shape"],
    ["lpf", "cutoff"], ["hpf", "hcutoff"], ["res", "resonance"], ["room", "room"], ["roomSize", "size"], ["delay", "delay"], ["feedback", "delayfeedback"],
    ["attack", "attack"], ["release", "release"], ["vowel", "vowel"]];
  for (const [k, d] of same) if (p[k] !== undefined) put(d, k === "vowel" ? String(p[k]) : k === "cut" ? { i: Math.round(n(p[k])) } : n(p[k]));
  if (p.ring !== undefined) { put("ring", p.ringMix !== undefined ? n(p.ringMix) : 1); put("ringf", n(p.ring)); }
  if (p.delaySec !== undefined && p.delay !== undefined) put("delaytime", n(p.delaySec));
  if (p.cutoff !== undefined && p.lpf === undefined) put("cutoff", n(p.cutoff));
  return out;
}

// One OSC bundle for a note that should sound at `unixSeconds`.
export function dirtPacket(note: DirtNote, unixSeconds: number): Uint8Array {
  return oscBundle(unixSeconds, [oscMessage("/dirt/play", dirtArgs(note))]);
}
