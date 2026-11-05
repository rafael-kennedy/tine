// Browser audio + MIDI engine. Notes are rendered with the same pure DSP
// code the command line uses (src/core/synth.ts), one AudioBuffer per note,
// so the DAW, the tutorial and exported WAVs sound alike.
import { renderNote, freqOf, bendFor, TimedNote } from "../core";

export interface PlayableNote { semi: number; vel: number; durSec: number; params: Record<string, any>; voice: string }

export class Engine {
  ctx: AudioContext;
  master: GainNode;
  verbSend: GainNode;
  analyser: AnalyserNode;
  samples = new Map<string, AudioBuffer>();
  cache = new Map<string, AudioBuffer>();
  midi: MIDIAccess | null = null;
  midiOutId: string | null = null;
  midiInId: string | "all" | null = "all";
  cc = new Map<string, number>();       // "ch:num" and "*:num" -> 0..1
  held = new Set<number>();
  onMidiIn: ((msg: { type: string; note?: number; vel?: number; cc?: number; value?: number; ch: number; t: number }) => void) | null = null;
  thru: { inst: string; enabled: boolean } = { inst: "keys", enabled: true };
  tuningRef = 440;
  private mpeRot = 0;
  private thruNodes = new Map<number, { src: AudioBufferSourceNode; g: GainNode }>();

  constructor() {
    this.ctx = new AudioContext({ latencyHint: "interactive" });
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -8; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.master.connect(comp).connect(this.analyser).connect(this.ctx.destination);
    const verb = this.ctx.createConvolver();
    verb.buffer = this.impulse(2.4);
    this.verbSend = this.ctx.createGain();
    this.verbSend.gain.value = 1;
    this.verbSend.connect(verb).connect(this.master);
  }

  get now() { return this.ctx.currentTime; }
  async resume() { if (this.ctx.state !== "running") await this.ctx.resume(); }

  private impulse(sec: number): AudioBuffer {
    const sr = this.ctx.sampleRate, len = Math.floor(sec * sr);
    const b = this.ctx.createBuffer(2, len, sr);
    let seed = 1;
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; d[i] = ((seed / 2147483648) - 1) * Math.pow(1 - i / len, 3.2) * 0.5; }
    }
    return b;
  }

  bufferFor(n: PlayableNote): AudioBuffer | null {
    const inst = String(n.params.inst ?? "keys");
    if (inst.startsWith("sample:")) return this.samples.get(inst.slice(7)) ?? null;
    const dur = Math.min(n.durSec, 12);
    const key = `${inst}|${n.semi.toFixed(3)}|${n.vel.toFixed(2)}|${dur.toFixed(3)}|${n.params.cutoff ?? ""}|${n.params.res ?? ""}|${n.params.attack ?? ""}|${n.params.decay ?? ""}|${n.params.sustain ?? ""}|${n.params.release ?? ""}|${n.params.gain ?? ""}`;
    let b = this.cache.get(key);
    if (b) { this.cache.delete(key); this.cache.set(key, b); return b; }
    const data = renderNote({ inst, freq: freqOf(n.semi, this.tuningRef), semi: n.semi, vel: n.vel, dur, params: n.params }, this.ctx.sampleRate);
    b = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate);
    b.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
    this.cache.set(key, b);
    if (this.cache.size > 600) this.cache.delete(this.cache.keys().next().value!);
    return b;
  }

  play(n: PlayableNote, when: number) {
    if (n.params.midi !== undefined) { this.sendMidi(n, when); return; }
    const buf = this.bufferFor(n);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const inst = String(n.params.inst ?? "keys");
    const g = this.ctx.createGain();
    if (inst.startsWith("sample:")) {
      g.gain.value = Math.pow(n.vel, 1.2) * Number(n.params.gain ?? 1);
      if (n.params.fit) src.playbackRate.value = buf.duration / Math.max(0.01, n.durSec);
      else src.playbackRate.value = Math.pow(2, (n.semi - 60) / 12);
    }
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, Number(n.params.pan ?? 0)));
    src.connect(g).connect(pan).connect(this.master);
    const send = Number(n.params.reverb ?? (inst === "pad" || inst === "bell" ? 0.35 : 0.12));
    if (send > 0) { const sg = this.ctx.createGain(); sg.gain.value = send; pan.connect(sg).connect(this.verbSend); }
    src.start(Math.max(when, this.ctx.currentTime));
  }

  // ---------- MIDI ----------
  async initMidi(): Promise<string> {
    if (!("requestMIDIAccess" in navigator)) return "This browser has no Web MIDI. Chrome, Edge and Opera support it; Firefox asks for permission.";
    try {
      this.midi = await navigator.requestMIDIAccess({ sysex: false });
      this.midi.onstatechange = () => this.bindInputs();
      this.bindInputs();
      return "";
    } catch (e) { return `MIDI unavailable: ${(e as Error).message}`; }
  }

  outputs(): MIDIOutput[] { return this.midi ? [...this.midi.outputs.values()] : []; }
  inputs(): MIDIInput[] { return this.midi ? [...this.midi.inputs.values()] : []; }

  output(port?: string): MIDIOutput | null {
    const outs = this.outputs();
    if (port) return outs.find(o => (o.name ?? "").toLowerCase().includes(port.toLowerCase())) ?? null;
    return outs.find(o => o.id === this.midiOutId) ?? outs[0] ?? null;
  }

  private bindInputs() {
    for (const inp of this.inputs()) {
      inp.onmidimessage = (e: MIDIMessageEvent) => {
        if (this.midiInId !== "all" && inp.id !== this.midiInId) return;
        this.handleMidi(e.data!, e.timeStamp);
      };
    }
  }

  handleMidi(d: Uint8Array, t: number) {
    const st = d[0] & 0xf0, ch = (d[0] & 0x0f) + 1;
    if (st === 0x90 && d[2] > 0) {
      this.held.add(d[1]);
      this.onMidiIn?.({ type: "on", note: d[1], vel: d[2] / 127, ch, t });
      if (this.thru.enabled) this.thruOn(d[1], d[2] / 127);
    } else if (st === 0x80 || (st === 0x90 && d[2] === 0)) {
      this.held.delete(d[1]);
      this.onMidiIn?.({ type: "off", note: d[1], ch, t });
      this.thruOff(d[1]);
    } else if (st === 0xb0) {
      const v = d[2] / 127;
      this.cc.set(`${ch}:${d[1]}`, v); this.cc.set(`*:${d[1]}`, v);
      this.onMidiIn?.({ type: "cc", cc: d[1], value: v, ch, t });
    }
  }

  private thruOn(note: number, vel: number) {
    this.thruOff(note);
    const buf = this.bufferFor({ semi: note, vel, durSec: 4, params: { inst: this.thru.inst }, voice: "thru" });
    if (!buf) return;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); src.connect(g).connect(this.master);
    src.start();
    this.thruNodes.set(note, { src, g });
  }
  private thruOff(note: number) {
    const n = this.thruNodes.get(note); if (!n) return;
    const t = this.ctx.currentTime;
    n.g.gain.setValueAtTime(n.g.gain.value, t); n.g.gain.linearRampToValueAtTime(0, t + 0.25);
    n.src.stop(t + 0.3); this.thruNodes.delete(note);
  }

  ccValue(num: number, ch?: number) { return this.cc.get(`${ch ?? "*"}:${num}`) ?? 0; }

  toPerf(when: number): number {
    const lat = (this.ctx.outputLatency || this.ctx.baseLatency || 0);
    return performance.now() + (when - this.ctx.currentTime + lat) * 1000;
  }

  sendMidi(n: PlayableNote, when: number) {
    const out = this.output(n.params.port);
    if (!out) return;
    let ch = Math.max(1, Math.min(16, Number(n.params.midi))) - 1;
    if (n.params.mpe) ch = 1 + (this.mpeRot++ % 15);
    const semi = n.semi + 12 * Math.log2(this.tuningRef / 440);
    const { note, bend } = bendFor(semi);
    const vel = Math.max(1, Math.min(127, Math.round(n.vel * 127)));
    const t0 = this.toPerf(when), t1 = this.toPerf(when + Math.max(0.01, n.durSec));
    if (Math.abs(semi - note) > 0.001 || n.params.mpe) out.send([0xe0 | ch, bend & 0x7f, bend >> 7], t0);
    out.send([0x90 | ch, note, vel], t0);
    out.send([0x80 | ch, note, 0], t1);
  }

  sendClock(when: number) { const out = this.output(); out?.send([0xf8], this.toPerf(when)); }
  sendStartStop(start: boolean) { const out = this.output(); out?.send([start ? 0xfa : 0xfc]); }
  panic() { for (const o of this.outputs()) for (let c = 0; c < 16; c++) o.send([0xb0 | c, 123, 0]); }

  async loadSample(name: string, data: ArrayBuffer) {
    const buf = await this.ctx.decodeAudioData(data);
    this.samples.set(name, buf);
  }
}
