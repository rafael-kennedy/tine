import { test, expect, describe } from "bun:test";
import { evaluate, renderNotes, liveNotes, formNotes, timeline, TineError, R, parse, formatError } from "../src/core";

const notes = (src: string, bars = 1, seed = 1) => renderNotes(evaluate(src, { seed }), bars).notes;
const pitches = (src: string, bars = 1) => notes(src, bars).map(n => Math.round(n.semi * 1000) / 1000);
const starts = (src: string, bars = 1) => notes(src, bars).map(n => n.bar);

describe("rationals", () => {
  test("exact thirds", () => {
    const a = new R(1, 3);
    expect(a.add(a).add(a).eq(new R(1))).toBe(true);
  });
  test("approx", () => { expect(R.approx(0.125).toString()).toBe("1/8"); });
});

describe("phrases", () => {
  test("equal subdivision", () => {
    expect(starts("voice a = [c d e f]")).toEqual([0, 0.25, 0.5, 0.75]);
    expect(pitches("voice a = [c d e f]")).toEqual([60, 62, 64, 65]);
  });
  test("rests and holds", () => {
    const n = notes("voice a = [c _ . e]");
    expect(n.map(x => x.bar)).toEqual([0, 0.75]);
    expect(n[0].bars).toBe(0.5);
  });
  test("weights", () => { expect(starts("voice a = [c:3 e]")).toEqual([0, 0.75]); });
  test("nesting makes tuplets", () => {
    const s = starts("voice a = [c [d e f]]");
    expect(s[0]).toBe(0); expect(s[1]).toBe(0.5); expect(s[2]).toBeCloseTo(0.5 + 1 / 6, 10);
  });
  test("ratchet and replicate", () => {
    expect(starts("voice a = [c*2 e]")).toEqual([0, 0.25, 0.5]);
    expect(starts("voice a = [c!3 e]")).toEqual([0, 0.25, 0.5, 0.75]);
  });
  test("alternation advances per bar", () => {
    expect(pitches("voice a = [c <d e>]", 3)).toEqual([60, 62, 60, 64, 60, 62]);
  });
  test("chords from braces and @", () => {
    expect(pitches("voice a = {c e g}")).toEqual([60, 64, 67]);
    expect(pitches("voice a = c4@maj7")).toEqual([60, 64, 67, 71]);
  });
  test("stack of patterns", () => { expect(notes("voice a = {[c c] [e e e]}").length).toBe(5); });
  test("variables and drums inside phrases", () => {
    const n = notes("let x = e4\nvoice a = [kick x]");
    expect(n.map(z => z.semi)).toEqual([36, 64]);
    expect(n[0].params.inst).toBe("kit");
  });
  test("negative numbers in phrases are MIDI numbers", () => { expect(pitches("voice a = [60 -1]")).toEqual([60, -1]); });
});

describe("pitch", () => {
  test("degrees in a key", () => {
    expect(pitches("key d dorian\nvoice a = [^1 ^3 ^5 ^8]")).toEqual([62, 65, 69, 74]);
    expect(pitches("key a minor\nvoice a = [^b3 ^#4 ^0]")).toEqual([71, 75, 67]);
  });
  test("diatonic chords on degrees", () => {
    expect(pitches("key c major\nvoice a = ^5@7")).toEqual([67, 71, 74, 77]);
    expect(pitches("key c major\nvoice a = ^2@3")).toEqual([62, 65, 69]);
  });
  test("microtones: cents, edo, ratios, hz", () => {
    expect(pitches("voice a = c4 + 50c")).toEqual([60.5]);
    expect(notes("voice a = c4 + 5\\31")[0].semi).toBeCloseTo(60 + 60 / 31, 9);
    expect(pitches("voice a = c4 * 3/2")[0]).toBeCloseTo(67.0196, 3);
    expect(pitches("voice a = 440hz")).toEqual([69]);
  });
  test("edo and just scales", () => {
    expect(notes("key c edo(31, [0 5 10 13 18 23 28])\nvoice a = ^2")[0].semi).toBeCloseTo(60 + 5 * 12 / 31, 6);
    expect(notes("key c just([1 9/8 5/4 4/3 3/2 5/3 15/8])\nvoice a = ^3")[0].semi).toBeCloseTo(60 + 12 * Math.log2(1.25), 6);
  });
  test("scala import", () => {
    const scl = '"! test\\nquarter\\n2\\n150.0\\n2/1"';
    expect(pitches(`key c scala(${scl})\nvoice a = [^1 ^2 ^3]`)).toEqual([60, 61.5, 72]);
  });
  test("transpose, step, octave", () => {
    expect(pitches("voice a = [c e].transpose(2)")).toEqual([62, 66]);
    expect(pitches("key c major\nvoice a = [^1 ^3].step(1)")).toEqual([62, 65]);
    expect(pitches("voice a = c.octave(-1)")).toEqual([48]);
  });
  test("arpeggio", () => {
    expect(pitches("voice a = c4@maj.arp")).toEqual([60, 64, 67]);
    expect(pitches("voice a = c4@maj.arp(\"down\")")).toEqual([67, 64, 60]);
  });
});

describe("time transforms", () => {
  test("fast/slow", () => {
    expect(starts("voice a = [c e].fast(2)")).toEqual([0, 0.25, 0.5, 0.75]);
    expect(starts("voice a = [c e].slow(2)", 2)).toEqual([0, 1]);
  });
  test("every applies on the last bar of the group", () => {
    const p = pitches("voice a = [c e].every(2, rev)", 2);
    expect(p).toEqual([60, 64, 64, 60]);
  });
  test("euclid", () => { expect(starts("voice a = kick.euclid(3, 8)")).toEqual([0, 0.375, 0.75]); });
  test("polymeter", () => { expect(pitches("voice a = [c d e].poly(4)", 2)).toEqual([60, 62, 64, 60, 62, 64, 60, 62]); });
  test("arithmetic on patterns", () => { expect(pitches("voice a = [c e] + 12")).toEqual([72, 76]); });
  test("patterned parameters", () => {
    const n = notes("voice a = [c c c c].vel([1 0.5])");
    expect(n.map(x => x.vel)).toEqual([1, 1, 0.5, 0.5]);
  });
  test("per_bar", () => {
    expect(pitches("voice a = per_bar(n => c + n)", 3)).toEqual([60, 61, 62]);
  });
  test("arrange", () => { expect(pitches("voice a = arrange(c, 2, e, 1)", 4)).toEqual([60, 60, 64, 60]); });
});

describe("seeded randomness", () => {
  const src = "voice a = [c|d|e|f|g|a|b]*16\nvoice b = dice([c d e], 8)\nvoice c = [hat*16].degrade(0.5)";
  test("same seed replays exactly", () => {
    expect(notes(src, 4, 42)).toEqual(notes(src, 4, 42));
  });
  test("different seed differs", () => {
    expect(JSON.stringify(notes(src, 4, 42))).not.toEqual(JSON.stringify(notes(src, 4, 43)));
  });
  test("seed line overrides the host seed", () => {
    const s = "seed 5\n" + src;
    expect(notes(s, 2, 1)).toEqual(notes(s, 2, 999));
  });
  test("query order does not change results", () => {
    const sc = evaluate("voice a = per_bar(n => [c d e f].transpose(rand_int(0, 11)))", { seed: 3 });
    const forward = liveNotes(sc, 0, 4);
    const sc2 = evaluate("voice a = per_bar(n => [c d e f].transpose(rand_int(0, 11)))", { seed: 3 });
    const backward = [...liveNotes(sc2, 3, 4), ...liveNotes(sc2, 2, 3), ...liveNotes(sc2, 1, 2), ...liveNotes(sc2, 0, 1)].sort((x, y) => x.bar - y.bar);
    expect(backward).toEqual(forward);
  });
  test("small slices equal one big query", () => {
    const sc = evaluate(src, { seed: 9 });
    const whole = liveNotes(sc, 0, 2);
    const parts: any[] = [];
    for (let i = 0; i < 20; i++) parts.push(...liveNotes(sc, i / 10, (i + 1) / 10));
    expect(parts.sort((x, y) => x.bar - y.bar || x.semi - y.semi)).toEqual(whole.sort((x, y) => x.bar - y.bar || x.semi - y.semi));
  });
  test("editing one voice does not reshuffle another", () => {
    const a = liveNotes(evaluate("voice x = dice([c d e f g], 8)\nvoice y = [c|e]*8", { seed: 4 }), 0, 2).filter(n => n.voice === "x");
    const b = liveNotes(evaluate("voice x = dice([c d e f g], 8)\nvoice y = [c|e|g]*4", { seed: 4 }), 0, 2).filter(n => n.voice === "x");
    expect(a).toEqual(b);
  });
});

describe("sections and form", () => {
  const src = `tempo 120
section intro 2
  voice a = [c]
section verse 1
  tempo 60
  voice a = [e e]
form intro verse*2`;
  test("timeline", () => {
    const tl = timeline(evaluate(src));
    expect(tl.bars).toBe(4);
    expect(tl.seconds).toBe(2 + 2 + 4 + 4);
  });
  test("notes follow the form", () => {
    const n = renderNotes(evaluate(src)).notes;
    expect(n.map(x => x.semi)).toEqual([60, 60, 64, 64, 64, 64]);
    expect(n[2].time).toBe(4);
  });
});

describe("language", () => {
  test("functions, blocks, recursion, lambdas", () => {
    const sc = evaluate(`
let fib(n) = if n < 2 then n else fib(n - 1) + fib(n - 2)
let shape(x) =
  let y = x * 2
  y + 1
print(fib(10), shape(3), map([1 2 3], x => x * x))
print((a: 1, b: c4).b, [c e g].len, 0..3)`);
    expect(sc.prints).toEqual(["55 7 [1 4 9]", "c4 3 [0 1 2 3]"]);
  });
  test("UFCS with user functions", () => {
    expect(pitches("let up(p, n) = p.transpose(n)\nvoice a = [c e].up(1)")).toEqual([61, 65]);
  });
  test("method chain continues on the next line", () => {
    expect(starts("voice a = [c e]\n  .fast(2)\n  .rev")).toEqual([0, 0.25, 0.5, 0.75]);
  });
});

describe("errors", () => {
  const err = (src: string) => { try { evaluate(src); } catch (e) { return e as TineError; } throw new Error("expected an error"); };
  test("unknown name suggests a fix", () => {
    const e = err("voice a = [c e].revv");
    expect(e.message).toContain("revv"); expect(e.hint).toContain("rev");
  });
  test("spans point at the problem", () => {
    const src = "voice a = [c e g\n";
    const e = err(src);
    expect(e.kind).toBe("syntax");
    expect(formatError(src, e)).toContain("unclosed");
  });
  test("a bracket left open before the next statement is named as unclosed", () => {
    const e = err("voice tune = [c4 e4 g4 c5\nvoice bass = [c3]");
    expect(e.message).toContain("unclosed '['"); expect(e.span?.start).toBe(13); expect(e.hint).toContain("']'");
  });
  test("note names cannot be variables", () => { expect(err("let a = 1").message).toContain("note name"); });
  test("type errors are readable", () => { expect(err("voice a = c4 + \"x\"").message).toContain("cannot add"); });
  test("keepGoing collects errors per statement", () => {
    const sc = evaluate("voice a = [c]\nvoice b = nope\nvoice c2 = [e]", { keepGoing: true });
    expect(sc.errors.length).toBe(1); expect(sc.voices.size).toBe(2);
  });
});

describe("pattern multiplication", () => {
  test("pattern * n repeats, pitch * r is a ratio", () => {
    expect(starts("voice a = [c e] * 2")).toEqual([0, 0.25, 0.5, 0.75]);
    expect(starts("voice a = [c e] / 2", 2)).toEqual([0, 1]);
  });
});

describe("evolve", () => {
  test("state carries forward from bar 0", () => {
    expect(pitches("voice a = evolve(60, (s, n) => s + 2, (s, n) => pitch(s))", 4)).toEqual([60, 62, 64, 66]);
  });
  test("random walks replay identically in any query order", () => {
    const src = "voice a = evolve(c4, (s, n) => s + pick([-2 -1 1 2]), (s, n) => [s (s + 7)])";
    const sc = evaluate(src, { seed: 11 });
    const fwd = liveNotes(sc, 0, 16);
    const sc2 = evaluate(src, { seed: 11 });
    const back: any[] = [];
    for (let b = 15; b >= 0; b--) back.push(...liveNotes(sc2, b, b + 1));
    expect(back.sort((x, y) => x.bar - y.bar || x.semi - y.semi)).toEqual(fwd.sort((x, y) => x.bar - y.bar || x.semi - y.semi));
    expect(new Set(fwd.map(n => n.semi)).size).toBeGreaterThan(3);
  });
  test("each section restarts its state", () => {
    const n = renderNotes(evaluate("section s 2\n  voice a = evolve(60, (x, n) => x + 1, (x, n) => pitch(x))\nform s s"), undefined).notes;
    expect(n.map(x => x.semi)).toEqual([60, 61, 60, 61]);
  });
});

describe("inexact timing", () => {
  test("rounding past 2^53 is reported per voice", () => {
    const s = evaluate("voice ok = [c e g]\nvoice deep = [c].late(1/999983).late(1/999979).late(1/999961)", { seed: 1 });
    const hit = new Set<string>();
    renderNotes(s, 1, { onInexact: v => hit.add(v) });
    expect([...hit]).toEqual(["deep"]);
  });
});

describe("errors that name the real problem", () => {
  const msg = (src: string) => { try { evaluate(src, { seed: 1 }); return ""; } catch (e: any) { return `${e.message} | ${e.hint ?? ""}`; } };
  test("a note name or keyword as a section or voice name", () => {
    expect(msg("section a 2\n  voice x = [c]\nform a")).toContain("'a' is a note name");
    expect(msg("voice key = [c]")).toContain("'key' is a keyword");
  });
  test("commas in a phrase", () => {
    expect(msg("voice x = [c, e, g]")).toContain("separated by spaces");
  });
  test("delay takes mix by name", () => {
    expect(notes("voice x = [c].delay(mix: .5)")[0].params.delay.valueOf()).toBe(0.5);
  });
});
