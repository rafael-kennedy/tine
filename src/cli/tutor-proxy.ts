// The tutor in the DAW, tutorial and course asks Claude through this process
// when it was started with ANTHROPIC_API_KEY, so the key never reaches the
// browser. Only the Messages endpoint is passed on, only from the page tine
// served (main.ts checks the origin first), and only these headers.
const UPSTREAM = "https://api.anthropic.com";
const PASS = ["content-type", "accept", "anthropic-version", "anthropic-beta"];
const BACK = ["content-type", "request-id", "retry-after", "anthropic-ratelimit-requests-remaining", "anthropic-ratelimit-tokens-remaining"];

export function tutorReady(env: Record<string, string | undefined> = process.env) {
  return !!env.ANTHROPIC_API_KEY;
}

export async function proxyAnthropic(req: Request, url: URL, env: Record<string, string | undefined> = process.env, send: typeof fetch = fetch): Promise<Response> {
  const key = env.ANTHROPIC_API_KEY;
  if (!key) return new Response("tine was started without ANTHROPIC_API_KEY", { status: 503 });
  const path = url.pathname.slice("/api/anthropic".length);
  if (path !== "/v1/messages" || req.method !== "POST") return new Response("only POST /v1/messages is passed on", { status: 404 });
  const headers = new Headers({ "x-api-key": key });
  for (const h of PASS) { const v = req.headers.get(h); if (v) headers.set(h, v); }
  const up = await send(UPSTREAM + path + url.search, { method: "POST", headers, body: await req.text(), signal: req.signal });
  const out = new Headers();
  for (const h of BACK) { const v = up.headers.get(h); if (v) out.set(h, v); }
  return new Response(up.body, { status: up.status, headers: out });
}
