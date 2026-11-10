// The per-voice effect chain and the shared reverb, run on the audio thread.
// It is the same code as WAV export (core/fx.ts), so effects sound the same
// live and in the file. Settings and duck triggers arrive as messages stamped
// with the audio-clock time they take effect, accurate to the sample.
import { BusFx, Fx, Freeverb } from "../core/fx";

declare const sampleRate: number;
declare const currentTime: number;
declare function registerProcessor(name: string, ctor: any): void;
declare class AudioWorkletProcessor { port: MessagePort; }

type Msg = { time: number; fx?: Fx; duck?: boolean };

class TineBus extends AudioWorkletProcessor {
  private bus = new BusFx(sampleRate);
  private q: Msg[] = [];
  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<Msg>) => { this.q.push(e.data); this.q.sort((a, b) => a.time - b.time); };
  }
  process(inputs: Float32Array[][], outputs: Float32Array[][]) {
    const inp = inputs[0], out = outputs[0], L = out[0], R = out[1] ?? out[0], n = L.length;
    if (inp && inp.length) { L.set(inp[0]); if (R !== L) R.set(inp[1] ?? inp[0]); } else { L.fill(0); R.fill(0); }
    const t0 = currentTime;
    let from = 0;
    while (this.q.length && this.q[0].time < t0 + n / sampleRate) {
      const m = this.q.shift()!;
      const at = Math.max(from, Math.min(n, Math.round((m.time - t0) * sampleRate)));
      if (at > from) { this.bus.process(L, R, from, at, t0 + from / sampleRate); from = at; }
      if (m.fx) this.bus.set(m.fx); else if (m.duck) this.bus.duck(0);
    }
    if (from < n) this.bus.process(L, R, from, n, t0 + from / sampleRate);
    return true;
  }
}

// The reverb every voice sends to: Freeverb, wet only, as in core/render.ts.
class TineVerb extends AudioWorkletProcessor {
  private v = [new Freeverb(sampleRate, 0), new Freeverb(sampleRate, 23)];
  process(inputs: Float32Array[][], outputs: Float32Array[][]) {
    const inp = inputs[0], out = outputs[0];
    for (let c = 0; c < out.length; c++) {
      const x = inp && inp.length ? inp[Math.min(c, inp.length - 1)] : null, y = out[c], v = this.v[Math.min(c, 1)];
      for (let i = 0; i < y.length; i++) y[i] = v.run(x ? x[i] : 0);
    }
    return true;
  }
}

registerProcessor("tine-bus", TineBus);
registerProcessor("tine-verb", TineVerb);
