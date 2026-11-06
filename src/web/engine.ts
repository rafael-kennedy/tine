// Browser audio + MIDI engine. Notes are rendered with the same pure DSP
// code the command line uses (src/core/synth.ts), one AudioBuffer per note,
// so the DAW, the tutorial and exported WAVs sound alike.
import { renderNote, freqOf, noteMessages, ChannelState, hasFx, fxOf, driveGains, DRIVE_RANGE, MAX_DELAY_SEC, Fx } from "../core";

interface Chain { input: GainNode; hp: BiquadFilterNode; lp: BiquadFilterNode; pre: GainNode; shaper: WaveShaperNode; post: GainNode; dly: DelayNode; fb: GainNode; wet: GainNode; drive: number }

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
  private chans = new Map<string, ChannelState>(); // output id -> channel -> program and bend
  onRealtime: ((status: number, t: number) => void) | null = null; // MIDI clock, start, continue, stop
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
    this.startWorker();
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

  // ---------- rendering ----------
  // Notes are rendered ahead of time in a Worker (see synth-worker.ts) so the
  // DSP never blocks the editor or the scheduler. A note whose buffer is not
  // back yet is rendered here, synchronously, as before: late, never silent.
  private worker: Worker | null = null;
  private pending = new Set<string>();
  stats = { ahead: 0, late: 0 };

  private startWorker() {
    const src = typeof document !== "undefined" ? document.getElementById("tine-synth-worker")?.textContent : null;
    if (!src) return;
    try {
      this.worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
      this.worker.onmessage = (e: MessageEvent<{ key: string; data: Float32Array }>) => {
        const { key, data } = e.data;
        this.pending.delete(key);
        if (!data.length || this.cache.has(key)) return;
        this.store(key, data);
      };
      this.worker.onerror = () => { this.worker?.terminate(); this.worker = null; this.pending.clear(); };
    } catch { this.worker = null; } // a page that forbids blob workers renders on the main thread
  }

  private keyOf(n: PlayableNote, inst: string, dur: number) {
    return `${inst}|${n.semi.toFixed(3)}|${n.vel.toFixed(2)}|${dur.toFixed(3)}|${n.params.cutoff ?? ""}|${n.params.res ?? ""}|${n.params.attack ?? ""}|${n.params.decay ?? ""}|${n.params.sustain ?? ""}|${n.params.release ?? ""}|${n.params.gain ?? ""}|${this.tuningRef}`;
  }

  private job(n: PlayableNote, inst: string, dur: number) {
    return { inst, freq: freqOf(n.semi, this.tuningRef), semi: n.semi, vel: n.vel, dur, params: n.params };
  }

  private store(key: string, data: Float32Array): AudioBuffer {
    const b = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate);
    b.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
    this.cache.set(key, b);
    if (this.cache.size > 600) this.cache.delete(this.cache.keys().next().value!);
    return b;
  }

  // Ask the worker for notes that will play soon. Cheap to call repeatedly.
  prepare(notes: PlayableNote[]) {
    if (!this.worker) return;
    for (const n of notes) {
      if (n.params.midi !== undefined || n.params.ccOut !== undefined) continue;
      const inst = String(n.params.inst ?? "keys");
      if (inst.startsWith("sample:")) continue;
      const dur = Math.min(n.durSec, 12), key = this.keyOf(n, inst, dur);
      if (this.cache.has(key) || this.pending.has(key)) continue;
      this.pending.add(key);
      this.worker.postMessage({ key, sr: this.ctx.sampleRate, note: this.job(n, inst, dur) });
    }
  }

  bufferFor(n: PlayableNote): AudioBuffer | null {
    const inst = String(n.params.inst ?? "keys");
    if (inst.startsWith("sample:")) return this.samples.get(inst.slice(7)) ?? null;
    const dur = Math.min(n.durSec, 12);
    const key = this.keyOf(n, inst, dur);
    let b = this.cache.get(key);
    if (b) { this.cache.delete(key); this.cache.set(key, b); this.stats.ahead++; return b; }
    this.stats.late++;
    return this.store(key, renderNote(this.job(n, inst, dur), this.ctx.sampleRate));
  }

  play(n: PlayableNote, when: number) {
    if (n.params.midi !== undefined || n.params.ccOut !== undefined) { this.sendMidi(n, when); return; }
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
    const dest = hasFx(n.params) || this.chains.has(n.voice) ? this.chainFor(n.voice, fxOf(n.params), when).input : this.master;
    src.connect(g).connect(pan).connect(dest);
    const send = Number(n.params.reverb ?? (inst === "pad" || inst === "bell" ? 0.35 : 0.12));
    if (send > 0) { const sg = this.ctx.createGain(); sg.gain.value = send; pan.connect(sg).connect(this.verbSend); }
    src.start(Math.max(when, this.ctx.currentTime));
  }

  // ---------- per-voice effects ----------
  // The same chain as core/fx.ts: high-pass, low-pass, drive, feedback delay.
  // Built the first time a voice uses an effect and kept, so echoes ring on
  // across code swaps; each note sets the chain at its own start time.
  private chains = new Map<string, Chain>();
  private driveCurve: Float32Array<ArrayBuffer> | null = null;

  private chainFor(voice: string, fx: Fx, when: number): Chain {
    let c = this.chains.get(voice);
    if (!c) {
      const x = this.ctx;
      c = { input: x.createGain(), hp: x.createBiquadFilter(), lp: x.createBiquadFilter(), pre: x.createGain(), shaper: x.createWaveShaper(), post: x.createGain(), dly: x.createDelay(MAX_DELAY_SEC), fb: x.createGain(), wet: x.createGain(), drive: 0 };
      c.hp.type = "highpass"; c.lp.type = "lowpass"; c.hp.Q.value = c.lp.Q.value = Math.SQRT1_2;
      c.hp.frequency.value = 10; c.lp.frequency.value = 20000; c.wet.gain.value = 0; c.fb.gain.value = 0;
      c.input.connect(c.hp).connect(c.lp).connect(c.pre).connect(c.shaper).connect(c.post).connect(this.master);
      c.post.connect(c.dly).connect(c.wet).connect(this.master);
      c.dly.connect(c.fb).connect(c.dly);
      this.chains.set(voice, c);
    }
    const t = Math.max(when, this.ctx.currentTime), tc = 0.005;
    c.hp.frequency.setTargetAtTime(fx.hpf > 0 ? fx.hpf : 10, t, tc);
    c.lp.frequency.setTargetAtTime(fx.lpf > 0 ? Math.min(fx.lpf, this.ctx.sampleRate * 0.49) : 20000, t, tc);
    const dg = fx.drive > 0 ? driveGains(fx.drive) : { pre: 1, post: 1 };
    c.pre.gain.setTargetAtTime(dg.pre, t, tc); c.post.gain.setTargetAtTime(dg.post, t, tc);
    if ((fx.drive > 0) !== (c.drive > 0)) {
      // a curve cannot be scheduled, so switch it when the note arrives
      const on = fx.drive > 0, chain = c;
      setTimeout(() => { chain.shaper.curve = on ? this.curve() : null; }, Math.max(0, (t - this.ctx.currentTime) * 1000));
    }
    c.drive = fx.drive;
    c.dly.delayTime.setTargetAtTime(fx.delaySec, t, 0.02);
    c.wet.gain.setTargetAtTime(fx.delay, t, tc);
    c.fb.gain.setTargetAtTime(fx.delay > 0 ? fx.feedback : 0, t, tc);
    return c;
  }

  private curve(): Float32Array<ArrayBuffer> {
    if (!this.driveCurve) {
      const n = 2049; this.driveCurve = new Float32Array(n);
      for (let i = 0; i < n; i++) this.driveCurve[i] = Math.tanh(DRIVE_RANGE * (i / (n - 1) * 2 - 1));
    }
    return this.driveCurve;
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
    if (d[0] >= 0xf8) { this.onRealtime?.(d[0], t); return; }
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

  // performance.now() milliseconds (MIDI timestamps) to audio-clock seconds, and back
  fromPerf(ms: number): number {
    const lat = (this.ctx.outputLatency || this.ctx.baseLatency || 0);
    return this.ctx.currentTime + (ms - performance.now()) / 1000 - lat;
  }
  toPerf(when: number): number {
    const lat = (this.ctx.outputLatency || this.ctx.baseLatency || 0);
    return performance.now() + (when - this.ctx.currentTime + lat) * 1000;
  }

  sendMidi(n: PlayableNote, when: number) {
    const out = this.output(n.params.port);
    if (!out) return;
    let ch = Math.max(1, Math.min(16, Number(n.params.midi ?? 1))) - 1;
    if (n.params.mpe && n.params.ccOut === undefined) ch = 1 + (this.mpeRot++ % 15);
    const semi = n.semi + 12 * Math.log2(this.tuningRef / 440);
    const key = out.id;
    if (!this.chans.has(key)) this.chans.set(key, new Map());
    const m = noteMessages({ semi, vel: n.vel, params: n.params }, ch, this.chans.get(key)!, n.params.mpe ? { bend: true } : {});
    const t0 = this.toPerf(when);
    for (const msg of m.on) out.send(msg, t0);
    if (m.off) out.send(m.off, this.toPerf(when + Math.max(0.01, n.durSec)));
  }

  sendClock(when: number) { const out = this.output(); out?.send([0xf8], this.toPerf(when)); }
  sendStartStop(start: boolean) { const out = this.output(); out?.send([start ? 0xfa : 0xfc]); }
  panic() { this.chans.clear(); for (const o of this.outputs()) for (let c = 0; c < 16; c++) o.send([0xb0 | c, 123, 0]); }

  async loadSample(name: string, data: ArrayBuffer) {
    const buf = await this.ctx.decodeAudioData(data);
    this.samples.set(name, buf);
  }
}
