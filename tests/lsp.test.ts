import { test, expect } from "bun:test";
import { spawn } from "node:child_process";
import { join } from "node:path";

function client() {
  const p = spawn("bun", [join(import.meta.dir, "../src/cli/main.ts"), "lsp"], { stdio: ["pipe", "pipe", "inherit"] });
  let buf = Buffer.alloc(0);
  const waiters: ((m: any) => boolean)[] = [];
  const msgs: any[] = [];
  p.stdout.on("data", (c: Buffer) => {
    buf = Buffer.concat([buf, c]);
    for (;;) {
      const sep = buf.indexOf("\r\n\r\n"); if (sep < 0) return;
      const len = parseInt(buf.subarray(0, sep).toString().match(/Content-Length: (\d+)/)![1], 10);
      if (buf.length < sep + 4 + len) return;
      const m = JSON.parse(buf.subarray(sep + 4, sep + 4 + len).toString()); buf = buf.subarray(sep + 4 + len);
      msgs.push(m);
      for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i](m)) waiters.splice(i, 1);
    }
  });
  let id = 0;
  const write = (o: any) => { const s = JSON.stringify({ jsonrpc: "2.0", ...o }); p.stdin.write(`Content-Length: ${Buffer.byteLength(s)}\r\n\r\n${s}`); };
  const request = (method: string, params: any) => new Promise<any>(res => { const i = ++id; waiters.push(m => (m.id === i ? (res(m.result), true) : false)); write({ id: i, method, params }); });
  const next = (method: string) => new Promise<any>(res => { const found = msgs.find(m => m.method === method); if (found) { msgs.splice(msgs.indexOf(found), 1); return res(found.params); } waiters.push(m => (m.method === method ? (msgs.splice(msgs.indexOf(m), 1), res(m.params), true) : false)); });
  return { p, write, request, next };
}

test("language server: diagnostics, hover, completion, definition", async () => {
  const c = client();
  const init = await c.request("initialize", { capabilities: {} });
  expect(init.capabilities.hoverProvider).toBe(true);
  const uri = "file:///tmp/x.tine";
  const text = "let riff(n) = [c e g].transpose(n)\nvoice lead = riff(2).fsat(2)\n";
  c.write({ method: "textDocument/didOpen", params: { textDocument: { uri, text, languageId: "tine", version: 1 } } });
  const d = await c.next("textDocument/publishDiagnostics");
  expect(d.diagnostics.length).toBe(1);
  expect(d.diagnostics[0].message).toContain("fast");
  expect(d.diagnostics[0].range.start.line).toBe(1);
  const h = await c.request("textDocument/hover", { textDocument: { uri }, position: { line: 0, character: 16 } });
  expect(h.contents.value).toContain("MIDI 60");
  const comp = await c.request("textDocument/completion", { textDocument: { uri }, position: { line: 1, character: 22 } });
  expect(comp.some((x: any) => x.label === "every")).toBe(true);
  const def = await c.request("textDocument/definition", { textDocument: { uri }, position: { line: 1, character: 15 } });
  expect(def.range.start.line).toBe(0);
  const sig = await c.request("textDocument/signatureHelp", { textDocument: { uri }, position: { line: 1, character: 18 } });
  expect(sig.signatures[0].label).toContain("riff(n)");
  c.p.kill();
});
