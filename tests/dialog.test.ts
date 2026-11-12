import { test, expect, describe, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { dialogCommands, chooseFile, NoDialog, pushRecent, readRecent, sameOrigin } from "../src/cli/dialog";

const tmp = mkdtempSync(join(tmpdir(), "tine-dialog-"));

describe("dialogs", () => {
  test("each platform has a command, and macOS brings its dialog to the front", () => {
    const mac = dialogCommands("open", "darwin", "/Users/r/My \"music\"");
    expect(mac[0][0]).toBe("osascript");
    expect(mac[0].join(" ")).toContain("tell me to activate");
    expect(mac[0].join(" ")).toContain('POSIX file "/Users/r/My \\"music\\""');
    expect(dialogCommands("save", "darwin")[0].join(" ")).toContain('default name "untitled.tine"');
    expect(dialogCommands("open", "win32", "C:\\it's")[0].join(" ")).toContain("'C:\\it''s'");
    expect(dialogCommands("open", "linux").map(c => c[0])).toEqual(["zenity", "kdialog"]);
  });
  test("cancel is null, a missing tool falls through, none at all throws", async () => {
    expect(await chooseFile("open", undefined, async () => ({ code: 1, out: "" }))).toBeNull();
    const tried: string[] = [];
    const p = await chooseFile("save", undefined, async c => { tried.push(c[0]); return c[0] === "osascript" || c[0] === "powershell" || c[0] === "kdialog" ? { code: 0, out: "/x/song" } : null; });
    expect(p).toBe("/x/song.tine"); // .tine is added to a new piece
    await expect(chooseFile("open", undefined, async () => null)).rejects.toBeInstanceOf(NoDialog);
  });
  test("recent keeps ten, newest first, no repeats", () => {
    const f = join(tmp, "recent.json");
    for (let i = 0; i < 12; i++) pushRecent(`/p/${i}.tine`, f);
    pushRecent("/p/5.tine", f);
    const r = readRecent(f);
    expect(r.length).toBe(10);
    expect(r[0]).toBe("/p/5.tine");
    expect(r.filter(p => p === "/p/5.tine").length).toBe(1);
    expect(readRecent(join(tmp, "missing.json"))).toEqual([]);
  });
  test("only the DAW's own page may call", () => {
    const req = (h: Record<string, string>) => new Request("http://127.0.0.1:7357/api/open", { method: "POST", headers: h });
    expect(sameOrigin(req({ host: "127.0.0.1:7357", origin: "http://127.0.0.1:7357", "sec-fetch-site": "same-origin" }), 7357)).toBe(true);
    expect(sameOrigin(req({ host: "localhost:7357" }), 7357)).toBe(true);
    expect(sameOrigin(req({ host: "127.0.0.1:7357", origin: "https://evil.example" }), 7357)).toBe(false);
    expect(sameOrigin(req({ host: "127.0.0.1:7357", "sec-fetch-site": "cross-site" }), 7357)).toBe(false);
    expect(sameOrigin(req({ host: "rebind.evil.example:7357" }), 7357)).toBe(false);
  });
});

// The real server, with a fake zenity that "chooses" whatever file next.txt names.
describe("tine daw open and new", () => {
  const bin = join(tmp, "bin"); require("node:fs").mkdirSync(bin);
  const pick = join(tmp, "next.txt");
  writeFileSync(join(bin, "zenity"), `#!/bin/sh\nf=$(cat ${pick})\n[ -z "$f" ] && exit 1\necho "$f"\n`); chmodSync(join(bin, "zenity"), 0o755);
  const a = join(tmp, "a.tine"), b = join(tmp, "b.tine");
  writeFileSync(a, "voice x = [c]\n"); writeFileSync(b, "voice y = [e]\n");
  const port = 17000 + Math.floor(Math.random() * 2000);
  const proc = Bun.spawn(["bun", join(import.meta.dir, "../src/cli/main.ts"), "daw", a, "--no-open", "--port", String(port)], {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, HOME: tmp }, stdout: "pipe", stderr: "pipe",
  });
  afterAll(() => proc.kill());
  const base = `http://127.0.0.1:${port}`;
  const ready = (async () => { for (let i = 0; i < 100; i++) { try { await fetch(base + "/api/file"); return; } catch { await Bun.sleep(100); } } })();
  const post = (p: string, body = "", h: Record<string, string> = {}) => fetch(base + p, { method: "POST", body, headers: { origin: base, ...h } });

  test("open shows the dialog and switches the file; cancel changes nothing", async () => {
    await ready;
    writeFileSync(pick, "");
    expect((await post("/api/open")).status).toBe(204);
    writeFileSync(pick, b);
    const j = await (await post("/api/open")).json();
    expect([j.name, j.content]).toEqual(["b.tine", "voice y = [e]\n"]);
    expect((await (await fetch(base + "/api/file")).json()).path).toBe(b);
  });
  test("a tab still on the old piece cannot save over the new one", async () => {
    expect((await post("/api/file", "oops", { "x-tine-path": a })).status).toBe(409);
    expect(readFileSync(b, "utf8")).toBe("voice y = [e]\n");
    expect((await post("/api/file", "voice y = [g]\n", { "x-tine-path": b })).status).toBe(200);
    expect(readFileSync(b, "utf8")).toBe("voice y = [g]\n");
  });
  test("recent lists both, and reopens only what is on it", async () => {
    expect(await (await fetch(base + "/api/recent")).json()).toEqual([b, a]);
    expect((await post("/api/open", JSON.stringify({ path: a }))).status).toBe(200);
    expect((await post("/api/open", JSON.stringify({ path: "/etc/passwd" }))).status).toBe(403);
  });
  test("new writes a fresh piece, and never replaces an existing one", async () => {
    const c = join(tmp, "c");
    writeFileSync(pick, c);
    const j = await (await post("/api/new")).json();
    expect(j.path).toBe(c + ".tine");
    expect(j.content).toContain("-- a new piece");
    writeFileSync(pick, a);
    expect((await (await post("/api/new")).json()).content).toBe("voice x = [c]\n");
  });
  test("other sites are refused", async () => {
    expect((await post("/api/open", "", { origin: "https://evil.example" })).status).toBe(403);
    expect((await post("/api/file", "x", { origin: "https://evil.example" })).status).toBe(403);
    expect(existsSync(a) && readFileSync(a, "utf8")).toBe("voice x = [c]\n");
  });
});
