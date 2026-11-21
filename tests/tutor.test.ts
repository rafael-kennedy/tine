import { test, expect } from "bun:test";
import { runTine, errorsIn, describeEditor, applyEdits, diffLines, trimDiff } from "../src/web/tutor/tools";
import { proxyAnthropic, tutorReady } from "../src/cli/tutor-proxy";

test("run_tine lists the notes a piece plays", () => {
  const out = runTine("voice a = [c e g]", 1, 1);
  expect(out).toContain("3 notes.");
  expect(out).toMatch(/a: bar 1 beat 1 c4/);
});

test("run_tine and errorsIn report errors with their line", () => {
  expect(runTine("voice a = [c e g", 1, 1)).toMatch(/error/i);
  expect(errorsIn("voice a = [c e g", 1)).toMatch(/error/i);
  expect(errorsIn("voice a = [c e g]", 1)).toBeNull();
});

test("an editor snapshot has line numbers and its status", () => {
  const ok = describeEditor({ label: "box 1", code: "tempo 90\nvoice a = [c e]" }, 1);
  expect(ok).toContain("[box 1]");
  expect(ok).toContain("  2| voice a = [c e]");
  expect(ok).toContain("Voices: a");
  expect(describeEditor({ label: "e", code: "voice a = nosuch(1)" }, 1)).toContain("Errors:");
});

test("edits replace exact, unique text", () => {
  expect(applyEdits("a b c", [{ find: "b", replace: "x" }])).toEqual({ code: "a x c" });
  expect(applyEdits("a b b", [{ find: "b", replace: "x" }])).toHaveProperty("error");
  expect(applyEdits("a b c", [{ find: "z", replace: "x" }])).toHaveProperty("error");
  expect(applyEdits("", [{ find: "", replace: "voice a = [c]" }])).toEqual({ code: "voice a = [c]" });
  expect(applyEdits("x", [{ find: "", replace: "y" }])).toHaveProperty("error");
});

test("a line diff keeps context and marks changes", () => {
  const a = "1\n2\n3\n4\n5\n6\n7\n8", b = "1\n2\n3\n4\nfive\n6\n7\n8";
  const d = diffLines(a, b);
  expect(d.filter(l => l.op === "-")).toEqual([{ op: "-", text: "5" }]);
  expect(d.filter(l => l.op === "+")).toEqual([{ op: "+", text: "five" }]);
  const t = trimDiff(d);
  expect(t[0]).toBeNull(); // lines 1 and 2 are folded away
  expect(t.filter(Boolean).map(l => l!.text)).toEqual(["3", "4", "5", "five", "6", "7"]);
});

test("the proxy passes on only the Messages endpoint, with the key added", async () => {
  const env = { ANTHROPIC_API_KEY: "sk-test" };
  expect(tutorReady(env)).toBe(true);
  expect(tutorReady({})).toBe(false);
  let seen: { url: string; headers: Headers } | null = null;
  const send = (async (u: string, init: any) => { seen = { url: u, headers: init.headers }; return new Response("{}", { status: 200, headers: { "content-type": "application/json", "set-cookie": "x=1" } }); }) as any;
  const req = (path: string, method = "POST") => {
    const url = new URL("http://127.0.0.1:7357" + path);
    return [new Request(url, { method, body: method === "POST" ? "{}" : undefined, headers: { "x-api-key": "from-page", "anthropic-version": "2023-06-01", cookie: "c" } }), url] as const;
  };
  const r = await proxyAnthropic(...req("/api/anthropic/v1/messages?beta=true"), env, send);
  expect(r.status).toBe(200);
  expect(r.headers.get("set-cookie")).toBeNull();
  expect(seen!.url).toBe("https://api.anthropic.com/v1/messages?beta=true");
  expect(seen!.headers.get("x-api-key")).toBe("sk-test");
  expect(seen!.headers.get("anthropic-version")).toBe("2023-06-01");
  expect(seen!.headers.get("cookie")).toBeNull();
  expect((await proxyAnthropic(...req("/api/anthropic/v1/models", "GET"), env, send)).status).toBe(404);
  expect((await proxyAnthropic(...req("/api/anthropic/v1/files"), env, send)).status).toBe(404);
  expect((await proxyAnthropic(...req("/api/anthropic/v1/messages"), {}, send)).status).toBe(503);
});
