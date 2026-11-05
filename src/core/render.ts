// Offline rendering: notes -> stereo audio, WAV encoding/decoding, and
// Standard MIDI File export. All pure, so it runs in the CLI and the browser.
import { TimedNote, timeline, barSeconds } from "./scene";
import { Scene } from "./interp";
import { renderNote, reverb, noteLength } from "./synth";

export interface SampleData { channels: Float32Array[]; sr: number }

export function freqOf(semi: number, ref = 440) { return ref * Math.pow(2, (semi - 69) / 12); }

export function mix(notes: TimedNote[], seconds: number, sr = 44100, opts: { tuningRef?: number; samples?: Map<string, SampleData>; tail?: number } = {}): [Float32Array, Float32Array] {
  const tail = opts.tail ?? 2.5;
  const len = Math.ceil((seconds + tail) * sr);
  const L = new Float32Array(len), R = new Float32Array(len);
  const sendL = new Float32Array(len), sendR = new Float32Array(len);
  const cache = new Map<string, Float32Array>();
  for (const n of notes) {
    if (n.params.midi !== undefined) continue; // routed to external gear
    const inst = String(n.params.inst ?? "keys");
    let buf: Float32Array;
    if (inst.startsWith("sample:")) {
      const sm = opts.samples?.get(inst.slice(7));
      if (!sm) continue;
      buf = playSample(sm, n, sr);
    } else {
      const key = `${inst}|${n.semi.toFixed(4)}|${n.vel.toFixed(3)}|${n.durSec.toFixed(4)}|${JSON.stringify(n.params)}`;
      buf = cache.get(key)!;
      if (!buf) {
        buf = renderNote({ inst, freq: freqOf(n.semi, opts.tuningRef), semi: n.semi, vel: n.vel, dur: n.durSec, params: n.params }, sr);
        if (cache.size < 2000) cache.set(key, buf);
      }
    }
    const pan = Math.max(-1, Math.min(1, Number(n.params.pan ?? 0)));
    const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
    const send = Number(n.params.reverb ?? (inst === "pad" || inst === "bell" ? 0.35 : 0.12));
    const start = Math.round(n.time * sr);
    const end = Math.min(len, start + buf.length);
    for (let i = start, j = 0; i < end; i++, j++) {
      if (i < 0) continue;
      const v = buf[j];
      L[i] += v * gl; R[i] += v * gr;
      if (send > 0) { sendL[i] += v * gl * send; sendR[i] += v * gr * send; }
    }
  }
  const [wl, wr] = reverb(sendL, sendR, sr);
  let peak = 0;
  for (let i = 0; i < len; i++) {
    L[i] = Math.tanh((L[i] + wl[i]) * 0.9);
    R[i] = Math.tanh((R[i] + wr[i]) * 0.9);
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  if (peak > 0.89) { const g = 0.89 / peak; for (let i = 0; i < len; i++) { L[i] *= g; R[i] *= g; } }
  // trim silent tail
  let last = len - 1;
  while (last > seconds * sr && Math.abs(L[last]) < 1e-4 && Math.abs(R[last]) < 1e-4) last--;
  return [L.slice(0, last + 1), R.slice(0, last + 1)];
}

function playSample(sm: SampleData, n: TimedNote, sr: number): Float32Array {
  const src = sm.channels[0];
  const srcDur = src.length / sm.sr;
  let rate = (sm.sr / sr) * (n.params.fit ? srcDur / Math.max(0.01, n.durSec) : Math.pow(2, (n.semi - 60) / 12));
  const outLen = Math.min(Math.floor(src.length / rate), sr * 30);
  const out = new Float32Array(outLen);
  const g = Math.pow(n.vel, 1.2) * Number(n.params.gain ?? 1);
  for (let i = 0; i < outLen; i++) {
    const x = i * rate, k = Math.floor(x), f = x - k;
    out[i] = ((src[k] ?? 0) * (1 - f) + (src[k + 1] ?? 0) * f) * g;
  }
  return out;
}

export function encodeWav(channels: Float32Array[], sr: number): Uint8Array {
  const nch = channels.length, len = channels[0].length;
  const buf = new ArrayBuffer(44 + len * nch * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + len * nch * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nch, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * nch * 2, true); v.setUint16(32, nch * 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, len * nch * 2, true);
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < nch; c++) { const s = Math.max(-1, Math.min(1, channels[c][i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return new Uint8Array(buf);
}

export function decodeWav(bytes: Uint8Array): SampleData {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("not a WAV file");
  let o = 12, fmt = { ch: 1, sr: 44100, bits: 16, format: 1 };
  while (o + 8 <= bytes.length) {
    const id = tag(o), size = v.getUint32(o + 4, true);
    if (id === "fmt ") fmt = { format: v.getUint16(o + 8, true), ch: v.getUint16(o + 10, true), sr: v.getUint32(o + 12, true), bits: v.getUint16(o + 22, true) };
    if (id === "data") {
      const bps = fmt.bits / 8, frames = Math.floor(size / (bps * fmt.ch));
      const chans = Array.from({ length: fmt.ch }, () => new Float32Array(frames));
      for (let i = 0; i < frames; i++) for (let c = 0; c < fmt.ch; c++) {
        const p = o + 8 + (i * fmt.ch + c) * bps;
        let s = 0;
        if (fmt.format === 3 && fmt.bits === 32) s = v.getFloat32(p, true);
        else if (fmt.bits === 16) s = v.getInt16(p, true) / 32768;
        else if (fmt.bits === 24) { const x = v.getUint8(p) | (v.getUint8(p + 1) << 8) | (v.getInt8(p + 2) << 16); s = x / 8388608; }
        else if (fmt.bits === 8) s = (v.getUint8(p) - 128) / 128;
        else if (fmt.bits === 32) s = v.getInt32(p, true) / 2147483648;
        chans[c][i] = s;
      }
      return { channels: chans, sr: fmt.sr };
    }
    o += 8 + size + (size % 2);
  }
  throw new Error("WAV file has no data");
}

// ---------- Standard MIDI File (type 1) ----------

const PPQ = 480;
function vlq(n: number): number[] {
  const out = [n & 0x7f]; n >>= 7;
  while (n > 0) { out.unshift((n & 0x7f) | 0x80); n >>= 7; }
  return out;
}

export interface MidiEvent { tick: number; data: number[]; order: number }

// Split a fractional pitch into a MIDI note and a 14-bit pitch bend (+-2 semitones).
export function bendFor(semi: number): { note: number; bend: number } {
  const note = Math.round(semi);
  const bend = Math.max(0, Math.min(16383, Math.round(8192 + ((semi - note) / 2) * 8192)));
  return { note: Math.max(0, Math.min(127, note)), bend };
}

export function assignChannels(notes: TimedNote[]): Map<string, number> {
  const map = new Map<string, number>();
  let next = 1;
  for (const n of notes) {
    if (map.has(n.voice)) continue;
    if (n.params.midi !== undefined) { map.set(n.voice, Math.max(1, Math.min(16, Number(n.params.midi)))); continue; }
    if (n.params.inst === "kit") { map.set(n.voice, 10); continue; }
    if (next === 10) next++;
    map.set(n.voice, Math.min(16, next++));
  }
  return map;
}

export function toMidiFile(scene: Scene, notes: TimedNote[]): Uint8Array {
  const tracks: number[][] = [];
  // SMF ticks count quarter notes; a bar of 7/8 is 3.5 quarters.
  const quartersPerBar = scene.meter[0] * (4 / scene.meter[1]);
  const tickOf = (bar: number) => Math.round(bar * quartersPerBar * PPQ);
  const usPerBeat = (tempo: number) => Math.round(60_000_000 / tempo);
  const segs = timeline(scene).segments;

  // conductor track
  const cond: MidiEvent[] = [];
  const den = Math.round(Math.log2(scene.meter[1]));
  cond.push({ tick: 0, data: [0xff, 0x58, 4, scene.meter[0], den, 24, 8], order: 0 });
  const tempi = segs.length ? segs.map(s => ({ bar: s.startBar, tempo: s.tempo })) : [{ bar: 0, tempo: scene.tempo }];
  let lastT = -1;
  for (const t of tempi) {
    if (t.tempo === lastT) continue; lastT = t.tempo;
    // a beat here is the meter's denominator; SMF tempo is per quarter note
    const q = t.tempo * (4 / scene.meter[1]); // quarter notes per minute
    const us = usPerBeat(q);
    cond.push({ tick: tickOf(t.bar), data: [0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255], order: 1 });
  }
  cond.push({ tick: 0, data: [0xff, 0x01, ...textBytes(`made with Tine, seed ${scene.seed}`)], order: 2 });
  tracks.push(encodeTrack(cond, "Tine"));

  const chans = assignChannels(notes);
  const byVoice = new Map<string, TimedNote[]>();
  for (const n of notes) { if (!byVoice.has(n.voice)) byVoice.set(n.voice, []); byVoice.get(n.voice)!.push(n); }
  for (const [voice, ns] of byVoice) {
    const evs: MidiEvent[] = [];
    const base = chans.get(voice)! - 1;
    let rot = 0;
    // bend range = 2 semitones (the General MIDI default), set explicitly
    const used = new Set<number>();
    for (const n of ns) {
      let ch = base;
      if (n.params.mpe) { ch = 1 + (rot++ % 15); }
      if (!used.has(ch)) { used.add(ch); evs.push(...[[0x65, 0], [0x64, 0], [0x06, 2], [0x26, 0]].map(([c, v]) => ({ tick: 0, data: [0xb0 | ch, c, v], order: 0 }))); }
      const { note, bend } = bendFor(n.semi);
      const t0 = tickOf(n.bar), t1 = Math.max(t0 + 1, tickOf(n.bar + n.bars));
      const v = Math.max(1, Math.min(127, Math.round(n.vel * 127)));
      if (ch !== 9) evs.push({ tick: t0, data: [0xe0 | ch, bend & 0x7f, bend >> 7], order: 1 });
      evs.push({ tick: t0, data: [0x90 | ch, note, v], order: 2 });
      evs.push({ tick: t1, data: [0x80 | ch, note, 0], order: 0 });
    }
    tracks.push(encodeTrack(evs, voice));
  }
  const header = [..."MThd"].map(c => c.charCodeAt(0)).concat([0, 0, 0, 6, 0, 1, (tracks.length >> 8) & 255, tracks.length & 255, (PPQ >> 8) & 255, PPQ & 255]);
  return new Uint8Array([...header, ...tracks.flat()]);
}

function textBytes(s: string) { const b = [...new TextEncoder().encode(s)]; return [...vlq(b.length), ...b]; }

function encodeTrack(evs: MidiEvent[], name: string): number[] {
  evs.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const body: number[] = [0, 0xff, 0x03, ...textBytes(name)];
  let last = 0;
  for (const e of evs) { body.push(...vlq(e.tick - last), ...e.data); last = e.tick; }
  body.push(0, 0xff, 0x2f, 0);
  const len = body.length;
  return [..."MTrk"].map(c => c.charCodeAt(0)).concat([(len >> 24) & 255, (len >> 16) & 255, (len >> 8) & 255, len & 255], body);
}

export { barSeconds, noteLength };
