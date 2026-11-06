import { test, expect, describe } from "bun:test";
import { evaluate, renderNotes, toMidiFile, noteMessages, ChannelState, mix } from "../src/core";
import { ClockFollower } from "../src/web/clockin";

const scene = (src: string) => evaluate(src, { seed: 1 });
const notes = (src: string, bars = 1) => renderNotes(scene(src), bars).notes;
const has = (bytes: Uint8Array, seq: number[]) => {
  outer: for (let i = 0; i + seq.length <= bytes.length; i++) { for (let j = 0; j < seq.length; j++) if (bytes[i + j] !== seq[j]) continue outer; return true; }
  return false;
};

describe("MIDI out", () => {
  test("ctl sends a control change before each note", () => {
    const n = notes("voice a = [c e].ctl(74, [0 1]).midi(2)");
    const st: ChannelState = new Map();
    const m = noteMessages(n[0], 1, st);
    expect(m.on[0]).toEqual([0xb1, 74, 0]);
    expect(m.on[m.on.length - 1][0]).toBe(0x91);
    expect(noteMessages(n[1], 1, st).on[0]).toEqual([0xb1, 74, 127]);
  });
  test("program change is sent only when it changes", () => {
    const n = notes("voice a = [c e g].program(5).midi(1)");
    const st: ChannelState = new Map();
    expect(noteMessages(n[0], 0, st).on[0]).toEqual([0xc0, 4]);
    expect(noteMessages(n[1], 0, st).on.some(x => x[0] === 0xc0)).toBe(false);
  });
  test("a bend is reset after a microtonal note", () => {
    const n = notes("voice a = [(c + 50c) d]");
    const st: ChannelState = new Map();
    expect(noteMessages(n[0], 0, st).on[0][0]).toBe(0xe0);
    expect(noteMessages(n[1], 0, st).on[0]).toEqual([0xe0, 0, 64]);
  });
  test("as_cc turns a signal into control changes, not notes", () => {
    const n = notes("voice sweep = saw(1).as_cc(1, rate: 4).midi(1)");
    expect(n.length).toBe(4);
    expect(n.map(x => x.params.ccValue)).toEqual([0, 0.25, 0.5, 0.75]);
    const m = noteMessages(n[2], 0, new Map());
    expect(m.on).toEqual([[0xb0, 1, 64]]);
    expect(m.off).toBe(null);
  });
  test("as_cc voices are silent in the built-in synth", () => {
    const [L] = mix(notes("voice sweep = saw(1).as_cc(1)"), 1, 8000, { tail: 0 });
    expect(L.every(x => x === 0)).toBe(true);
  });
  test("the MIDI file carries program and CC", () => {
    const s = scene("voice a = [c e].program(33).ctl(10, 1)\nvoice k = sine(1).as_cc(74, rate: 2)");
    const f = toMidiFile(s, renderNotes(s, 1).notes);
    expect(has(f, [0xc0, 32])).toBe(true);
    expect(has(f, [0xb0, 10, 127])).toBe(true);
    expect(has(f, [74, 127])).toBe(true);
  });
  test("as_cc rejects pitches with a hint", () => {
    expect(() => notes("voice a = [c e].as_cc(1)")).toThrow(/numbers from 0 to 1/);
  });
});

describe("MIDI clock in", () => {
  test("tempo from steady ticks", () => {
    const f = new ClockFollower();
    const ms = 60000 / (128 * 24);
    let bpm = 0;
    for (let i = 0; i < 48; i++) bpm = f.tick(1000 + i * ms);
    expect(bpm).toBeCloseTo(128, 3);
  });
  test("jitter is smoothed", () => {
    const f = new ClockFollower();
    const ms = 60000 / (100 * 24);
    let bpm = 0, x = 7;
    for (let i = 0; i < 96; i++) { x = (x * 1103515245 + 12345) % 2147483648; bpm = f.tick(i * ms + (x / 2147483648 - 0.5) * 2); }
    expect(Math.abs(bpm - 100)).toBeLessThan(0.5);
  });
  test("start sets the phase", () => {
    const f = new ClockFollower();
    f.start();
    for (let i = 0; i < 25; i++) f.tick(i * 20);
    expect(f.quarters()).toBe(1);
  });
});
