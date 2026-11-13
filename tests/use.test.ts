import { test, expect, describe } from "bun:test";
import { evaluate, renderNotes } from "../src/core";

// A tiny in-memory file system. Paths arrive relative to the main file.
const files: Record<string, string> = {
  "parts/drums.tine": [
    "tempo 90", "key d minor", "seed 7",
    "let hits = [kick snare]", "let fill(n) = [kick kick].fast(n)",
    "voice beat = hits",
    "section verse 2", "  voice hats = [hat hat]",
    "use \"fills.tine\" as fills",
    "form verse",
  ].join("\n"),
  "parts/fills.tine": "let roll = [snare snare snare snare]\nvoice snare = roll",
  "shared.tine": "let riff = [c e g]\nvoice pad = [c@maj7]",
  "bad.tine": "let x = 1\nvoice y = nope",
  "self.tine": "use \"self.tine\"",
};
const readFile = (p: string) => { if (!(p in files)) throw new Error(`no such file ${p}`); return files[p]; };
const run = (src: string, keepGoing = false) => evaluate(src, { seed: 1, readFile, keepGoing });
const err = (src: string) => { try { const s = run(src, true); return s.errors.map(e => e.message).join("; "); } catch (e: any) { return `${e.message} | ${e.hint ?? ""}`; } };

describe("use ... as name", () => {
  const s = run("tempo 120\nuse \"parts/drums.tine\" as drums\nvoice f = drums.fill(3)\nvoice r = drums.fills.roll\nsection intro 1\n  voice a = [c e]\nform intro drums.verse*2");

  test("lets are read and called through the name", () => {
    expect(s.voices.has("f")).toBe(true);
    expect(s.voices.has("r")).toBe(true);
  });
  test("voices and sections are prefixed, nested names too", () => {
    expect([...s.voices.keys()].sort()).toEqual(["drums.beat", "drums.fills.snare", "f", "r"]);
    expect(s.sections.has("drums.verse")).toBe(true);
    expect([...s.sections.get("drums.verse")!.voices.keys()]).toEqual(["drums.hats"]);
  });
  test("form can name a used section", () => {
    expect(s.form).toEqual([{ name: "intro", times: 1 }, { name: "drums.verse", times: 2 }]);
  });
  test("the used file's top-level tempo, key, seed and form do not apply", () => {
    expect(s.tempo).toBe(120);
    expect(String(s.key)).toBe(String(run("").key));
    expect(s.seedExplicit).toBe(false);
  });
  test("a used voice remembers its file and the use line", () => {
    const v = s.voices.get("drums.fills.snare")!;
    expect(v.file).toBe("parts/fills.tine");
    expect(v.at).toEqual({ start: 10, end: 41 });
  });
  test("used voices play", () => {
    const voices = new Set(renderNotes({ ...s, form: null } as any, 1).notes.map((n: any) => n.voice));
    expect(voices.has("drums.beat")).toBe(true);
    expect(voices.has("drums.fills.snare")).toBe(true);
  });
  test("a used file does not see the user's names", () => {
    expect(err("let hits = [c]\nuse \"bad.tine\" as broken")).toContain("in bad.tine line 2: 'nope' is not defined");
  });
  test("plain use still shares names", () => {
    const p = run("use \"shared.tine\"\nvoice lead = riff");
    expect([...p.voices.keys()].sort()).toEqual(["lead", "pad"]);
  });
});

describe("use errors", () => {
  test("unknown member suggests a close name", () => {
    expect(err("use \"parts/drums.tine\" as drums\nvoice q = drums.fil")).toContain("has no 'fil'");
    expect(err("use \"parts/drums.tine\" as drums\nvoice q = drums.fil")).not.toContain("not defined");
  });
  test("a note cannot be the name", () => {
    expect(err("use \"shared.tine\" as e")).toContain("'e' is a note name");
  });
  test("a missing file", () => {
    expect(err("use \"nope.tine\" as n")).toContain("cannot read 'nope.tine'");
  });
  test("a file that uses itself", () => {
    expect(err("use \"self.tine\"")).toContain("would use itself");
  });
  test("errors in a used file point at the use line", () => {
    const s = run("voice a = [c]\nuse \"bad.tine\" as broken", true);
    expect(s.errors[0].span).toEqual({ start: 14, end: 38 });
  });
  test("a namespace is not playable", () => {
    expect(err("use \"shared.tine\" as sh\nvoice x = sh")).toContain("namespace");
  });
});
