import { test, expect, describe } from "bun:test";
import { evaluate, renderNotes, mix, StreamMixer, SampleLibrary } from "../src/core";
import { Engine, EngineIO } from "../src/engine/server";

// An engine with an in-memory file system and a captured stdout.
function harness(files: Record<string, string>) {
  const json: any[] = [];
  const audio: Int16Array[] = [];
  let pending = new Uint8Array(0);
  const out = {
    write(b: Uint8Array) {
      const all = new Uint8Array(pending.length + b.length); all.set(pending); all.set(b, pending.length); pending = all;
      while (pending.length >= 5) {
        const dv = new DataView(pending.buffer, pending.byteOffset);
        const type = pending[0], len = dv.getUint32(1, true);
        if (pending.length < 5 + len) break;
        const pl = pending.slice(5, 5 + len); pending = pending.slice(5 + len);
        if (type === 1) json.push(JSON.parse(new TextDecoder().decode(pl)));
        else audio.push(new Int16Array(pl.buffer.slice(4)));
      }
    },
  };
  const io: EngineIO = {
    readFile: p => { if (!(p in files)) throw new Error(`no file ${p}`); return files[p]; },
    loadSamples: async () => new SampleLibrary(),
    loadSoundfont: async () => null,
    fetchNeeded: async () => {},
    exit: () => {},
  };
  const e = new Engine(out, 44100, io);
  let id = 0;
  const call = (method: string, params: any = {}) => { const i = ++id; e.handle({ id: i, method, params }); return json.find(m => m.id === i)?.result; };
  const pull = (seconds: number) => { for (let i = 0; i < Math.ceil(seconds * 44100 / 512); i++) e.handle({ method: "pull", params: { frames: 512 } }); };
  const peak = (from = 0) => audio.slice(from).reduce((m, a) => Math.max(m, ...Array.from(a, Math.abs)), 0);
  return { e, json, audio, call, pull, peak };
}

const FILES = {
  "/p/main.tine": "tempo 120\nuse \"parts/drums.tine\" as drums\nvoice lead = [c e g b]",
  "/p/parts/drums.tine": "tempo 90\nvoice beat = [kick snare kick snare]",
};

describe("tine engine", () => {
  test("evaluates a piece across files and describes it", () => {
    const h = harness(FILES);
    const r = h.call("eval", { main: "/p/main.tine" });
    expect(r.ok).toBe(true);
    expect(r.files).toEqual(["/p/main.tine", "/p/parts/drums.tine"]);
    expect(r.tempo).toBe(120);
    const beat = r.voices.find((v: any) => v.name === "drums.beat");
    expect(beat.file).toBe("/p/parts/drums.tine");
    expect(beat.line).toBe(1);
  });

  test("unsaved buffers win over the disk, and errors land in the file they are in", () => {
    const h = harness(FILES);
    h.call("eval", { main: "/p/main.tine" });
    const r = h.call("eval", { buffers: { "/p/parts/drums.tine": "voice beat = [kick nope]" } });
    expect(r.ok).toBe(false);
    expect(r.errors[0].file).toBe("/p/parts/drums.tine");
    expect(r.errors[0].message).toBe("'nope' is not defined");
    expect(r.errors[0].via.file).toBe("/p/main.tine");
    expect(r.errors[0].via.line).toBe(1);
  });

  test("a broken voice keeps its last good version", () => {
    const h = harness(FILES);
    h.call("eval", { main: "/p/main.tine" });
    const r = h.call("eval", { buffers: { "/p/parts/drums.tine": "voice beat = [kick nope]" } });
    expect(r.kept).toEqual(["drums.beat"]);
    expect(h.e.transport.scene!.voices.has("drums.beat")).toBe(true);
  });

  test("plays, reports position, and swaps new code at the bar line", () => {
    const h = harness(FILES);
    expect(h.call("play", { main: "/p/main.tine" }).playing).toBe(true);
    h.pull(1);
    expect(h.peak()).toBeGreaterThan(1000);
    const pos = h.json.filter(m => m.method === "position");
    expect(pos.length).toBeGreaterThan(10);
    expect(pos[pos.length - 1].params.bar).toBeGreaterThan(0.4);
    const r = h.call("eval", { buffers: { "/p/main.tine": "tempo 120\nvoice lead = [c]" } });
    expect(r.pending).toBe(true);
    h.pull(2);
    const swap = h.json.find(m => m.method === "swap");
    expect(swap.params.bar).toBe(1);
  });

  test("mute silences a voice within a block", () => {
    const h = harness({ "/p/one.tine": "voice a = [c e g b].inst(organ).reverb(0)" });
    h.call("play", { main: "/p/one.tine" });
    h.pull(0.5);
    h.call("mute", { voice: "a" });
    h.pull(0.1);                // the fade
    const from = h.audio.length;
    h.pull(0.5);
    expect(h.peak(from)).toBeLessThan(50);
  });

  test("stop fades out and the form ends on its own", () => {
    const h = harness({ "/p/f.tine": "tempo 240\nsection intro 1\n  voice x = [c e]\nform intro" });
    h.call("play", { main: "/p/f.tine" });
    h.pull(2);
    expect(h.json.some(m => m.method === "ended")).toBe(true);
    expect(h.e.transport.playing).toBe(false);
  });
});

test("the streaming mixer sounds like the offline mix", () => {
  const s = evaluate("voice a = [c e g b].inst(pad)\nvoice b = [c3 _ g2 _].inst(bass).delay(.3)\nvoice d = [kick snare].lpf(800)", { seed: 1 });
  const { notes, seconds } = renderNotes(s, 2);
  const [L] = mix(notes, seconds, 44100);
  const m = new StreamMixer(44100);
  for (const n of notes) m.add(n, Math.round(n.time * 44100));
  const out: number[] = [];
  while (m.frame < L.length) for (const x of m.render(512)[0]) out.push(x);
  let peak = 0; for (const x of L) peak = Math.max(peak, Math.abs(x));
  expect(peak).toBeLessThan(0.89);   // under the offline normaliser, so the two should match
  let diff = 0; for (let i = 0; i < L.length; i++) diff = Math.max(diff, Math.abs(L[i] - out[i]));
  expect(diff).toBeLessThan(1e-3);
});
