import { test, expect, describe } from "bun:test";
import { createSocket } from "node:dgram";
import { oscMessage, oscBundle, oscDecode, dirtArgs, evaluate, renderNotes } from "../src/core";
import { dirtSender } from "../src/cli/dirt";

const args = (src: string, i = 0) => { const n = renderNotes(evaluate(src, { seed: 1 }), 1).notes[i]; const a = dirtArgs(n); const o: Record<string, any> = {}; for (let k = 0; k < a.length; k += 2) { const v: any = a[k + 1]; o[a[k] as string] = typeof v === "object" ? v.i : v; } return o; };

describe("OSC", () => {
  test("a message is padded to 4 bytes and round trips", () => {
    const m = oscMessage("/dirt/play", ["s", "bd", "n", { i: 3 }, "gain", 0.5]);
    expect(m.length % 4).toBe(0);
    expect(oscDecode(m).messages[0]).toEqual({ address: "/dirt/play", args: ["s", "bd", "n", 3, "gain", 0.5] });
  });
  test("a bundle carries an NTP time tag", () => {
    const b = oscBundle(1700000000.25, [oscMessage("/a", [1])]);
    expect(new TextDecoder().decode(b.subarray(0, 7))).toBe("#bundle");
    const d = oscDecode(b);
    expect(d.time!).toBeCloseTo(1700000000.25, 5);
    expect(d.messages[0].address).toBe("/a");
  });
});

describe("SuperDirt mapping", () => {
  test("sample names become s and n; a bar is a cycle", () => {
    const a = args(`tempo 120\nvoice d = ["bd:3" "sn"].dirt()`);
    expect([a.s, a.n, a.cps, a.cycle]).toEqual(["bd", 3, 0.5, 0]);
    expect(a.note).toBeUndefined(); // a named sample plays as recorded
  });
  test("drum names go to Dirt-Samples banks; instruments to SuperDirt synths", () => {
    expect(args(`voice d = [snare].dirt()`).s).toBe("sn");
    const k = args(`voice k = [e4].dirt()`);
    expect([k.s, k.note]).toEqual(["superpiano", 4]);
    expect(args(`voice k = [e4].inst(saw).dirt("superzow")`).s).toBe("superzow");
  });
  test("parameters are translated", () => {
    const a = args(`tempo 120\nvoice a = ["break"].loopAt(2).chop(4).lpf(800).room(.4, size: .9).pan(1).cut(1).dirt(orbit: 2)`);
    expect([a.unit, a.speed, a.begin, a.end, a.cutoff, a.room, a.pan, a.cut, a.orbit]).toEqual(["c", 0.5, 0, 0.25, 800, expect.any(Number), 1, 1, 2]);
    expect(a.size).toBeCloseTo(0.9, 5);
  });
  test("dirt notes are not in the built-in mix", () => {
    const { mix } = require("../src/core");
    const r = renderNotes(evaluate(`voice a = [c e g].dirt()`, { seed: 1 }), 1);
    expect(mix(r.notes, r.seconds, 8000, { tail: 0 })[0].every((v: number) => v === 0)).toBe(true);
  });
  test("packets reach a UDP listener", async () => {
    const sock = createSocket("udp4");
    await new Promise<void>(r => sock.bind(0, "127.0.0.1", () => r()));
    const port = (sock.address() as any).port;
    const got = new Promise<Buffer>(r => sock.once("message", m => r(m)));
    const out = dirtSender(`127.0.0.1:${port}`);
    const n = renderNotes(evaluate(`voice d = ["hh"].dirt()`, { seed: 1 }), 1).notes[0];
    out.send(n, 1700000000);
    const d = oscDecode(new Uint8Array(await got));
    expect(d.time!).toBeCloseTo(1700000000, 3);
    expect(d.messages[0].args.slice(0, 2)).toEqual(["s", "hh"]);
    out.close(); sock.close();
  });
});
