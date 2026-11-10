// Samples: the library of sounds, how a name finds a sound, and the one
// playback routine that the command line, WAV export, the DAW and packed
// players all share, so a chopped, reversed or stretched sample sounds the
// same everywhere.
//
// Names. A sound has a full name ("bd_haus", or "bd/BT0A0A7" from a pack
// folder) and belongs to a bank ("bd"). sample("bd_haus") plays that sound;
// sample("bd") plays the bank's first sound and sample("bd", n: 3) or
// sample("bd:3") its fourth, wrapping around. On a drum phrase, sample() with
// no name plays the drum names through the bundled kit.
import { decodeAdpcm, encodeAdpcm } from "./adpcm";

export interface SampleData { channels: Float32Array[]; sr: number }

export function toMono(d: SampleData): SampleData {
  if (d.channels.length === 1) return d;
  const n = d.channels[0].length, m = new Float32Array(n), k = 1 / d.channels.length;
  for (const c of d.channels) for (let i = 0; i < n; i++) m[i] += c[i] * k;
  return { channels: [m], sr: d.sr };
}

// ---------- packs: many sounds in one file ----------
// "TSB1", uint32 index length, a JSON index, then each sound as IMA ADPCM.

export interface PackEntry { name: string; bank: string; sr: number; frames: number; off: number; len: number }

export function encodePack(sounds: { name: string; bank: string; data: SampleData }[]): Uint8Array {
  const blobs = sounds.map(s => encodeAdpcm(toMono(s.data).channels[0]));
  let off = 0;
  const index: PackEntry[] = sounds.map((s, i) => { const e = { name: s.name, bank: s.bank, sr: s.data.sr, frames: s.data.channels[0].length, off, len: blobs[i].length }; off += blobs[i].length; return e; });
  const head = new TextEncoder().encode(JSON.stringify({ v: 1, sounds: index }));
  const out = new Uint8Array(8 + head.length + off);
  out.set([0x54, 0x53, 0x42, 0x31]);
  new DataView(out.buffer).setUint32(4, head.length, true);
  out.set(head, 8);
  let p = 8 + head.length;
  for (const b of blobs) { out.set(b, p); p += b.length; }
  return out;
}

export function readPack(bytes: Uint8Array): { entries: PackEntry[]; decode: (e: PackEntry) => SampleData } {
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== "TSB1") throw new Error("not a Tine sample pack");
  const hl = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true);
  const index = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + hl)));
  const base = 8 + hl;
  return { entries: index.sounds, decode: e => ({ channels: [decodeAdpcm(bytes.subarray(base + e.off, base + e.off + e.len), e.frames)], sr: e.sr }) };
}

// ---------- the library ----------

interface Entry { bank: string; data?: SampleData; load?: () => SampleData; url?: string; failed?: boolean }

export class SampleLibrary {
  private entries = new Map<string, Entry>();
  private banks = new Map<string, string[]>();
  version = 0; // bumps when a sound arrives, so caches keyed on it refresh

  add(name: string, src: SampleData | (() => SampleData), bank = bankOf(name)) {
    const e: Entry = typeof src === "function" ? { bank, load: src } : { bank, data: toMono(src) };
    this.put(name, e);
  }
  // a sound fetched on first use (a pack loaded from a URL)
  addRemote(name: string, url: string, bank = bankOf(name)) { const e = this.entries.get(name); if (!e?.data && !e?.load) this.put(name, { bank, url }); }
  // keep: sounds already present (the user's own) win over the pack's
  addPack(bytes: Uint8Array, opts: { keep?: boolean } = {}) {
    const p = readPack(bytes);
    for (const e of p.entries) if (!opts.keep || !this.entries.has(e.name)) this.add(e.name, () => p.decode(e), e.bank);
    return p.entries.length;
  }
  // A pack's banks replace the same-named banks already here: after
  // samples("github:tidalcycles/dirt-samples"), "bd" means Dirt's bd, and the
  // bundled bd_haus is still there by its full name.
  addRemotePack(entries: { name: string; bank: string; url: string }[]) {
    for (const b of new Set(entries.map(e => e.bank))) this.banks.set(b, []);
    for (const e of entries) this.addRemote(e.name, e.url, e.bank);
  }
  replaceBanks(banks: Iterable<string>) { for (const b of banks) this.banks.set(b, []); }

  private put(name: string, e: Entry) {
    const had = this.entries.get(name);
    this.entries.set(name, e);
    const inBank = had ? this.banks.get(had.bank)?.indexOf(name) ?? -1 : -1;
    if (had && had.bank === e.bank && inBank >= 0) { this.version++; return; }
    if (had && inBank >= 0) this.banks.get(had.bank)!.splice(inBank, 1);
    const list = this.banks.get(e.bank) ?? [];
    list.push(name); list.sort(natural);
    this.banks.set(e.bank, list);
    this.version++;
  }

  has(name: string) { return this.entries.has(name); }
  get size() { return this.entries.size; }
  names() { return [...this.entries.keys()]; }
  bankList() { return [...this.banks].map(([bank, names]) => ({ bank, names })).filter(b => b.names.length).sort((a, b) => a.bank.localeCompare(b.bank)); }

  // The full name a note plays: see the top of this file.
  resolve(spec: string, n?: number, drum?: string): string | null {
    let name = spec, idx = n;
    const colon = /^(.*):(-?\d+)$/.exec(spec);
    if (colon) { name = colon[1]; idx = Number(colon[2]); }
    if (!name && drum) { const k = KIT[drum]; return k && this.entries.has(k) ? k : null; }
    if (this.entries.has(name) && idx === undefined) return name;
    const bank = this.banks.get(name);
    if (bank?.length) { const i = Math.round(idx ?? 0); return bank[((i % bank.length) + bank.length) % bank.length]; }
    return this.entries.has(name) ? name : null;
  }

  // The decoded sound, or undefined while a remote one has not arrived.
  get(name: string): SampleData | undefined {
    const e = this.entries.get(name);
    if (!e) return undefined;
    if (!e.data && e.load) { e.data = toMono(e.load()); e.load = undefined; }
    return e.data;
  }
  pendingUrl(name: string): string | undefined { const e = this.entries.get(name); return e && !e.data && e.url && !e.failed ? e.url : undefined; }
  async fetch(name: string, fetchBytes: (url: string) => Promise<Uint8Array>, decode: (b: Uint8Array) => Promise<SampleData>): Promise<boolean> {
    const e = this.entries.get(name);
    if (!e?.url || e.data) return !!e?.data;
    const url = e.url;
    e.url = undefined; // one fetch at a time
    try { e.data = toMono(await decode(await fetchBytes(url))); this.version++; return true; }
    catch { e.url = url; e.failed = true; return false; }
  }

  // The sounds these notes play.
  used(notes: { params: Record<string, any> }[]): string[] {
    const out = new Set<string>();
    for (const n of notes) {
      const inst = String(n.params.inst ?? "");
      if (!inst.startsWith("sample:")) continue;
      const name = this.resolve(inst.slice(7), n.params.sampleN, n.params.drum);
      if (name) out.add(name);
    }
    return [...out];
  }

  // A pack of just these sounds, for a packed player.
  subset(names: Iterable<string>): Uint8Array {
    const sounds = [];
    for (const n of new Set(names)) { const d = this.get(n); if (d) sounds.push({ name: n, bank: this.entries.get(n)!.bank, data: d }); }
    return encodePack(sounds);
  }
}

export const bankOf = (name: string) => name.includes("/") ? name.slice(0, name.lastIndexOf("/")) : name.includes("_") ? name.slice(0, name.indexOf("_")) : name;
const natural = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

// Strudel's sample map format (strudel.json), which most published packs use:
// { "_base": "https://...", "bd": ["bd/a.wav", "bd/b.wav"], "sn": "sn/x.wav" }
export function parseSampleMap(json: any, url: string): { name: string; bank: string; url: string }[] {
  const base = typeof json._base === "string" ? json._base : url.slice(0, url.lastIndexOf("/") + 1);
  const out: { name: string; bank: string; url: string }[] = [];
  for (const [bank, v] of Object.entries(json)) {
    if (bank.startsWith("_")) continue;
    const files = Array.isArray(v) ? v : typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flat() : [];
    files.forEach((f, i) => {
      if (typeof f !== "string") return;
      const full = /^https?:/.test(f) ? f : base + f;
      out.push({ name: `${bank}/${i}`, bank, url: full });
    });
  }
  return out;
}

// "github:user/repo" is shorthand for that repository's strudel.json
export function sampleMapUrl(spec: string): string {
  const m = /^github:([^/]+)\/([^/]+)(?:\/(.*))?$/.exec(spec);
  if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3] ?? "main"}/strudel.json`;
  return spec;
}

// "github:user/repo/path/file.sf2" is that file on the repository's main branch
export function fontUrl(spec: string): string {
  const m = /^github:([^/]+)\/([^/]+)\/(.+)$/.exec(spec);
  return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/main/${m[3]}` : spec;
}

// General MIDI drum names played through the bundled library.
export const KIT: Record<string, string> = {
  kick: "bd_haus", kick2: "bd_808", rim: "elec_tick", snare: "sn_dolf", clap: "perc_snap2", snare2: "sn_dub",
  hat: "drum_cymbal_closed", pedal: "drum_cymbal_pedal", ohat: "drum_cymbal_open",
  tom1: "drum_tom_lo_hard", tom2: "drum_tom_lo_soft", tom3: "drum_tom_mid_hard", tom4: "drum_tom_mid_soft", tom5: "drum_tom_hi_hard", tom6: "drum_tom_hi_soft",
  crash: "drum_cymbal_hard", crash2: "drum_splash_hard", ride: "ride_via", ride2: "ride_tri", ridebell: "perc_bell", china: "drum_cymbal_soft",
  tamb: "hat_tap", splash: "drum_splash_soft", cowbell: "drum_cowbell", bongo: "tabla_te1", bongo2: "tabla_na",
  conga: "tabla_tun1", conga2: "tabla_ke1", shaker: "hat_noiz", clave: "elec_wood", block: "elec_wood",
};

// ---------- playback ----------
//
// begin, end      the part of the sound to play, 0 to 1
// speed           playback rate; negative plays backwards from `end`
// accel           change in speed per second (a tape-stop is speed 1, accel -1)
// fit             stretch the part to the note's length
// loopSec         stretch the whole sound to this many seconds (loopAt, in bars, set by the scene)
// cutSec          stop after this long, with a 4 ms fade (cut groups, set by the mixer)
// Pitch: a pitched note plays at 2^((semi - 60) / 12), so c4 is the sound as recorded;
// a drum name, a name written in the phrase, or fit/loopAt, ignores pitch.

export interface SampleNote { semi: number; vel: number; durSec: number; params: Record<string, any> }

const MAX_SEC = 60;
const num = (v: any, d: number) => { const x = v && typeof v.toNumber === "function" ? v.toNumber() : Number(v ?? d); return Number.isFinite(x) ? x : d; };

export function renderSample(sm: SampleData, n: SampleNote, sr: number): Float32Array {
  const src = sm.channels[0], N = src.length, p = n.params;
  const b = Math.max(0, Math.min(1, num(p.begin, 0))), e = Math.max(0, Math.min(1, num(p.end, 1)));
  if (e <= b || N < 2) return new Float32Array(0);
  const s0 = b * (N - 1), s1 = e * (N - 1), part = (s1 - s0) / sm.sr;
  const speed = num(p.speed, 1), accel = num(p.accel, 0);
  let base: number;
  if (p.loopSec !== undefined) base = (N / sm.sr) / Math.max(0.01, num(p.loopSec, 1)); // the whole sound lasts loopSec, so a chopped piece keeps its share

  else if (p.fit) base = part / Math.max(0.01, n.durSec);
  else if (p.drum || p.hit) base = 1;
  else base = Math.pow(2, (n.semi - 60) / 12);
  const step0 = base * sm.sr / sr; // source frames per output frame at speed 1
  const g = Math.pow(n.vel, 1.2) * num(p.gain, 1);
  let maxLen = Math.floor(MAX_SEC * sr);
  const cut = p.cutSec !== undefined ? Math.max(0, num(p.cutSec, 0)) : Infinity;
  if (cut < MAX_SEC) maxLen = Math.floor(cut * sr);
  // length: integrate the speed until the play head leaves the part
  const out = new Float32Array(Math.min(maxLen, accel === 0 ? Math.ceil((s1 - s0) / Math.max(1e-6, step0 * Math.abs(speed))) + 1 : maxLen));
  let pos = speed < 0 ? s1 : s0, i = 0;
  const dt = 1 / sr;
  for (; i < out.length; i++) {
    if (pos < s0 || pos > s1) break;
    const k = Math.floor(pos), f = pos - k;
    out[i] = (src[k] * (1 - f) + (src[k + 1] ?? src[k]) * f) * g;
    const sp = speed + accel * i * dt;
    pos += step0 * sp;
  }
  const res = i < out.length ? out.subarray(0, i) : out;
  // short fades where the sound is cut mid-flight, so slices and cuts do not click
  const fin = b > 0 || (speed < 0 && e < 1) ? Math.min(res.length, Math.round(0.002 * sr)) : 0;
  for (let j = 0; j < fin; j++) res[j] *= j / fin;
  const fout = (e < 1 && speed > 0) || (b > 0 && speed < 0) || res.length >= maxLen ? Math.min(res.length, Math.round(0.004 * sr)) : 0;
  for (let j = 0; j < fout; j++) res[res.length - 1 - j] *= j / fout;
  return res;
}

// Cut groups: a sound in group g stops the one before it in the same group,
// in any voice (an open hat choked by a closed hat). Sets params.cutSec.
export function applyCuts<T extends { time: number; params: Record<string, any> }>(notes: T[]): T[] {
  const last = new Map<number, T>();
  const out = notes.slice().sort((a, b) => a.time - b.time);
  return out.map(n => {
    if (n.params.cut === undefined) return n;
    const g = Number(n.params.cut), prev = last.get(g);
    const copy = { ...n, params: { ...n.params } };
    if (prev) prev.params.cutSec = Math.max(0, copy.time - prev.time);
    last.set(g, copy);
    return copy;
  });
}
