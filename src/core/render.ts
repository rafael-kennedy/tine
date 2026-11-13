// Offline rendering: notes -> stereo audio, WAV encoding/decoding, and
// Standard MIDI File export. All pure, so it runs in the CLI and the browser.
import { TimedNote, timeline, barSeconds } from "./scene";
import { Scene } from "./interp";
import { renderNote, reverb, noteLength, performed } from "./synth";
import { hasFx, fxOf, processBus, Fx } from "./fx";
import { SampleData, SampleLibrary, renderSample, applyCuts } from "./samples";
import { SoundFont, presetFor, renderSf } from "./sf2";

export function freqOf(semi: number, ref = 440) { return ref * Math.pow(2, (semi - 69) / 12); }

export function mix(notes: TimedNote[], seconds: number, sr = 44100, opts: { tuningRef?: number; samples?: SampleLibrary; soundfont?: SoundFont | null; tail?: number } = {}): [Float32Array, Float32Array] {
  const tail = opts.tail ?? 2.5;
  const len = Math.ceil((seconds + tail) * sr);
  const L = new Float32Array(len), R = new Float32Array(len);
  const sendL = new Float32Array(len), sendR = new Float32Array(len);
  const cache = new Map<string, Float32Array>();
  // voices with effects mix into their own bus first
  const fxVoices = new Set(notes.filter(n => hasFx(n.params)).map(n => n.voice));
  const buses = new Map<string, { L: Float32Array; R: Float32Array; changes: { time: number; fx: Fx }[] }>();
  for (const v of fxVoices) buses.set(v, { L: new Float32Array(len), R: new Float32Array(len), changes: [] });
  if (notes.some(n => n.params.cut !== undefined)) notes = applyCuts(notes);
  for (const heard of notes) {
    if (heard.params.midi !== undefined || heard.params.ccOut !== undefined || heard.params.dirt !== undefined) continue; // routed to external gear
    const n = performed(heard);
    if (!n) continue; // inside a slurred run, which its first note plays
    const inst = String(n.params.inst ?? "keys");
    let buf: Float32Array;
    if (inst.startsWith("sample:")) {
      const name = opts.samples?.resolve(inst.slice(7), n.params.sampleN, n.params.drum);
      const sm = name ? opts.samples!.get(name) : undefined;
      if (!sm) continue;
      buf = renderSample(sm, n, sr);
    } else if (inst === "gm") {
      const pre = opts.soundfont ? presetFor(opts.soundfont, n.params) : undefined;
      if (!pre) continue;
      const gain = Number(n.params.gain ?? 1), key = `gm|${pre.bank}:${pre.program}|${n.semi.toFixed(4)}|${n.vel.toFixed(3)}|${n.durSec.toFixed(4)}|${gain}|${opts.tuningRef ?? 440}|${n.params.curve ?? ""}`;
      buf = cache.get(key)!;
      if (!buf) { buf = renderSf(opts.soundfont!, pre, { semi: n.semi + 12 * Math.log2((opts.tuningRef ?? 440) / 440), vel: n.vel, durSec: n.durSec, gain, curve: n.params.curve }, sr); if (cache.size < 2000) cache.set(key, buf); }
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
    const bus = buses.get(n.voice);
    if (bus) bus.changes.push({ time: n.time, fx: fxOf(n.params) });
    const oL = bus ? bus.L : L, oR = bus ? bus.R : R;
    for (let i = start, j = 0; i < end; i++, j++) {
      if (i < 0) continue;
      const v = buf[j];
      oL[i] += v * gl; oR[i] += v * gr;
      if (send > 0) { sendL[i] += v * gl * send; sendR[i] += v * gr * send; }
    }
  }
  // ducking: the onsets of the voice each bus ducks on, while it is set to
  const onsets = new Map<string, number[]>();
  for (const n of notes) { if (!onsets.has(n.voice)) onsets.set(n.voice, []); onsets.get(n.voice)!.push(n.time); }
  for (const bus of buses.values()) {
    bus.changes.sort((a, b) => a.time - b.time);
    const ducks: number[] = [];
    bus.changes.forEach((c, i) => {
      if (!c.fx.duck) return;
      const end = bus.changes[i + 1]?.time ?? Infinity;
      for (const t of onsets.get(c.fx.duck) ?? []) if (t >= c.time && t < end) ducks.push(t);
    });
    processBus(bus.L, bus.R, sr, bus.changes, [...new Set(ducks)].sort((a, b) => a - b));
    for (let i = 0; i < len; i++) { L[i] += bus.L[i]; R[i] += bus.R[i]; }
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

// Split a fractional pitch into a MIDI note and a 14-bit pitch bend
// (+-2 semitones, or +-SLIDE_RANGE on a voice that slides).
export function bendFor(semi: number, range = 2): { note: number; bend: number } {
  const note = Math.round(semi);
  return { note: Math.max(0, Math.min(127, note)), bend: bendValue(semi - note, range) };
}
const bendValue = (off: number, range: number) => Math.max(0, Math.min(16383, Math.round(8192 + (off / range) * 8192)));

// Slides in MIDI are pitch bend, so a voice that slides gets a wider bend
// range than the General MIDI default of 2. Wider than an octave and a slide
// jumps at the end of its ramp.
export const SLIDE_RANGE = 12;
export const slides = (p: Record<string, any>) => (Number(p.glide) > 0 && p.glideFrom !== undefined) || (p.join !== undefined && p.join.gliss > 0);

// The pitch bends that play a note's slides, in seconds from its start:
// a glide starts at the note before and bends home; a glissando bends this
// note to the next one's pitch, and the next note's own bend resets it.
const BEND_STEP = 0.01;
export function slideBends(n: { semi: number; params: Record<string, any> }, ch: number, range = SLIDE_RANGE): { sec: number; data: number[] }[] {
  const p = n.params, out: { sec: number; data: number[] }[] = [];
  const micro = n.semi - Math.round(n.semi);
  const ramp = (t0: number, t1: number, a: number, b: number) => {
    const steps = Math.max(1, Math.ceil((t1 - t0) / BEND_STEP));
    for (let k = 0; k <= steps; k++) {
      const v = bendValue(micro + a + (b - a) * k / steps, range);
      out.push({ sec: t0 + (t1 - t0) * k / steps, data: [0xe0 | ch, v & 0x7f, v >> 7] });
    }
  };
  if (Number(p.glide) > 0 && p.glideFrom !== undefined) ramp(0, Number(p.glide), Number(p.glideFrom) - n.semi, 0);
  if (p.join !== undefined && p.join.gliss > 0) ramp(p.join.at * (1 - p.join.gliss), p.join.at, 0, p.join.semi);
  return out;
}

// A note slurred to the next one is held until just after it starts, which
// a mono synth hears as legato. Where the two slide, the bend is shared by
// the channel, so the first note ends as the second starts instead.
export const LEGATO_OVERLAP = 0.02;
export function heldSec(n: { durSec: number; params: Record<string, any> }): number {
  const j = n.params.join;
  if (j === undefined) return n.durSec;
  return j.gliss > 0 || j.glide > 0 ? j.at : Math.max(n.durSec, j.at + LEGATO_OVERLAP);
}

// The MIDI messages one Tine note becomes, in send order. Shared by the live
// engine and the MIDI file writer so both say exactly the same thing.
// `chans` remembers each channel's program and pitch bend, so a program change
// is sent once and a bend is reset after a microtonal note.
export type ChannelState = Map<number, { program?: number; bend: number }>;
export function noteMessages(n: { semi: number; vel: number; params: Record<string, any> }, ch: number, chans: ChannelState, opts: { bend?: boolean; range?: number } = {}): { on: number[][]; off: number[] | null } {
  const on: number[][] = [];
  const p = n.params;
  let st = chans.get(ch);
  if (!st) chans.set(ch, (st = { bend: 8192 }));
  if (p.program !== undefined && st.program !== p.program) { st.program = p.program; on.push([0xc0 | ch, p.program - 1]); }
  if (p.ctl) for (const [k, v] of Object.entries(p.ctl)) on.push([0xb0 | ch, Number(k), Math.round(Number(v) * 127)]);
  if (p.ccOut !== undefined) { on.push([0xb0 | ch, p.ccOut, Math.round(Number(p.ccValue) * 127)]); return { on, off: null }; }
  const { note, bend } = bendFor(n.semi, opts.range);
  const v = Math.max(1, Math.min(127, Math.round(n.vel * 127)));
  if (opts.bend !== false && (opts.bend || bend !== st.bend)) { st.bend = bend; on.push([0xe0 | ch, bend & 0x7f, bend >> 7]); }
  on.push([0x90 | ch, note, v]);
  return { on, off: [0x80 | ch, note, 0] };
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
    const programs: ChannelState = new Map();
    // bend range: 2 semitones (the General MIDI default), or SLIDE_RANGE
    // for a voice that slides; set explicitly
    const range = ns.some(n => slides(n.params)) ? SLIDE_RANGE : 2;
    const used = new Set<number>();
    for (const n of ns) {
      let ch = base;
      if (n.params.mpe) { ch = 1 + (rot++ % 15); }
      if (!used.has(ch)) { used.add(ch); evs.push(...[[0x65, 0], [0x64, 0], [0x06, range], [0x26, 0]].map(([c, v]) => ({ tick: 0, data: [0xb0 | ch, c, v], order: 0 }))); }
      // seconds within this note to ticks
      const perSec = n.durSec > 0 ? n.bars / n.durSec : 0, tickAt = (sec: number) => tickOf(n.bar + sec * perSec);
      const t0 = tickOf(n.bar), t1 = Math.max(t0 + 1, tickAt(heldSec(n)));
      const bends = ch === 9 ? [] : slideBends(n, ch, range);
      const glidesIn = bends.length > 0 && bends[0].sec === 0;
      const m = noteMessages(n, ch, programs, ch === 9 || glidesIn ? { bend: false, range } : { range });
      // a glide's first bend goes before the note-on, so the note starts at the pitch before
      if (glidesIn) evs.push({ tick: t0, data: bends.shift()!.data, order: 1 });
      for (const data of m.on) evs.push({ tick: t0, data, order: 1 });
      for (const b of bends) evs.push({ tick: tickAt(b.sec), data: b.data, order: 1 });
      if (bends.length && ch !== 9) { const last = bends[bends.length - 1].data; programs.get(ch)!.bend = last[1] | (last[2] << 7); }
      if (m.off) evs.push({ tick: t1, data: m.off, order: 0 });
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
