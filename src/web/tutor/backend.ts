// Where the tutor's questions go. Three ways, tried in this order:
//   artifact  the page is a published Claude artifact: the host lends the
//             viewer's own Claude account (window.claude "sample"). No key.
//   local     the page is served by `tine daw|learn|theory` and that process
//             has ANTHROPIC_API_KEY: requests go through it, and the key never
//             reaches the browser.
//   key       the learner pasted an API key into this browser. Works anywhere,
//             including the phone app; the key stays in this browser's storage.
// The model sees the same instructions, tools and page context either way.
import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam, BetaToolUnion, BetaContentBlock } from "@anthropic-ai/sdk/resources/beta/messages/messages";

export interface Tool {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, any>; required: string[] };
  // returns the result for the model; throws to report an error to it
  run(input: Record<string, unknown>): string | Promise<string>;
  status?: string; // shown while it runs
}

export interface SendOpts { onText: (sofar: string) => void; onStatus: (s: string) => void; signal: AbortSignal }
export interface Session { send(question: string, o: SendOpts): Promise<{ text: string; note?: string }> }
export interface Backend { kind: "artifact" | "local" | "key"; label: string; open(system: string, tools: Tool[]): Session }

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string | null) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
  { id: "claude-fable-5-2", label: "Claude Fable 5.2" },
];
export const EFFORTS = ["low", "medium", "high"] as const;
export const settings = {
  get model() { return store.get("tine.tutor.model") ?? MODELS[0].id; },
  set model(v: string) { store.set("tine.tutor.model", v); },
  get effort() { return (store.get("tine.tutor.effort") ?? "low") as typeof EFFORTS[number]; },
  set effort(v: string) { store.set("tine.tutor.effort", v); },
  get key() { return store.get("tine.tutor.key"); },
  set key(v: string | null) { store.set("tine.tutor.key", v); },
};

// ---------- artifact: the host runs the loop ----------

type Turn = { role: "user" | "assistant"; content: string };
type Sample = ((input: string | Turn[], opts?: any) => Promise<{ text: string; truncated: boolean }>) & { limits?: () => Promise<any> };

const SAMPLE_ERRORS: Record<string, string> = {
  rate_limited: "Too many questions at once, or your Claude usage limit was reached. Try again in a little while.",
  session_expired: "Sign in to Claude again, then ask.",
  refused: "Claude could not answer that one. Try rewording the question.",
  empty_completion: "No answer came back. Try asking more simply.",
  prompt_too_large: "There is too much on the page to send. Ask about one part of it.",
};
const SAMPLE_OFF = ["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"];

function artifactBackend(sample: Sample): Backend {
  return {
    kind: "artifact", label: "your Claude account",
    open(system, tools) {
      const turns: Turn[] = [];
      return {
        async send(q, o) {
          turns.push({ role: "user", content: q });
          const limits = await sample.limits?.().catch(() => null);
          const hostTools = limits?.tools ? tools.map(t => ({
            name: t.name, description: t.description, inputSchema: t.input_schema,
            execute: async (input: any) => { o.onStatus(t.status ?? ""); try { return await t.run(input ?? {}); } catch (e) { return "Error: " + (e as Error).message; } },
          })) : undefined;
          // the host has no system prompt: the instructions lead the first turn
          const recent = turns.slice(-9); while (recent[0]?.role === "assistant") recent.shift();
          try {
            const { text, truncated } = await sample([{ role: "user", content: system }, ...recent], { cache: hostTools ? undefined : false, tools: hostTools, signal: o.signal, onText: ({ text }: { text: string }) => o.onText(text) });
            turns.push({ role: "assistant", content: text });
            return { text, note: truncated ? "The answer was cut short. Ask for one part at a time." : undefined };
          } catch (e: any) {
            turns.pop();
            if (e?.code === "cancelled") return { text: e?.text ?? "" };
            if (SAMPLE_OFF.includes(e?.code)) throw new Error("Asking Claude is turned off for this page. You can allow it from the page's Permissions menu.");
            throw new Error(SAMPLE_ERRORS[e?.code] ?? "The answer was interrupted. Try again.");
          }
        },
      };
    },
  };
}

// ---------- local and key: this page runs the loop over the Messages API ----------

// Opus, Sonnet and Fable can hand a declined request to another model on the server.
const HAS_FALLBACK = new Set(["claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-2"]);
const MAX_STEPS = 12; // tool calls per question, so a confused loop cannot run up a bill

function apiBackend(kind: "local" | "key", client: Anthropic, label: string): Backend {
  return {
    kind, label,
    open(system, tools) {
      const messages: BetaMessageParam[] = [];
      const defs: BetaToolUnion[] = tools.map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema, eager_input_streaming: true }));
      return {
        async send(q, o) {
          const start = messages.length;
          messages.push({ role: "user", content: q });
          let shown = "", retries = 0;
          const model = settings.model;
          try {
            for (let step = 0; step < MAX_STEPS; step++) {
              const base = shown ? shown + "\n\n" : "";
              let sofar = "";
              const stream = client.beta.messages.stream({
                model, max_tokens: 16000,
                system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
                cache_control: { type: "ephemeral" },
                tools: defs, messages,
                output_config: { effort: settings.effort as typeof EFFORTS[number] },
                ...(HAS_FALLBACK.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
              }, { signal: o.signal });
              stream.on("text", d => { sofar += d; o.onText(base + sofar); });
              let msg;
              try { msg = await stream.finalMessage(); retries = 0; }
              catch (e) {
                // an unparseable tool input or a dropped connection: ask again, a couple of times
                if (e instanceof Anthropic.APIError || o.signal.aborted || retries++ >= 2) throw e;
                continue;
              }
              const said = textOf(msg.content);
              if (said) shown = base + said;
              messages.push({ role: "assistant", content: msg.content });
              if (msg.stop_reason === "refusal") return { text: shown, note: "Claude declined to answer that. Try rewording the question." };
              if (msg.stop_reason === "pause_turn") continue;
              const uses = msg.content.filter((b): b is Extract<BetaContentBlock, { type: "tool_use" }> => b.type === "tool_use");
              if (!uses.length) return { text: shown, note: msg.stop_reason === "max_tokens" ? "The answer was cut short. Ask for one part at a time." : undefined };
              if (msg.stop_reason === "max_tokens") { messages.splice(messages.length - 1); return { text: shown, note: "The answer was cut short. Ask for one part at a time." }; }
              const results = [];
              for (const u of uses) {
                const tool = tools.find(t => t.name === u.name);
                o.onStatus(tool?.status ?? "");
                try {
                  if (!tool) throw new Error(`no tool named ${u.name}`);
                  results.push({ type: "tool_result" as const, tool_use_id: u.id, content: await tool.run((u.input ?? {}) as Record<string, unknown>) });
                } catch (e) {
                  results.push({ type: "tool_result" as const, tool_use_id: u.id, is_error: true, content: (e as Error).message });
                }
              }
              o.onStatus("");
              messages.push({ role: "user", content: results });
            }
            return { text: shown, note: "The tutor took too many steps on that one. Ask a narrower question." };
          } catch (e) {
            // an unanswered question is dropped, so the next one starts clean
            if (messages.length === start + 1) messages.pop();
            if (o.signal.aborted) return { text: shown };
            throw new Error(apiError(e, kind));
          }
        },
      };
    },
  };
}

function textOf(content: BetaContentBlock[]) {
  return content.filter((b): b is Extract<BetaContentBlock, { type: "text" }> => b.type === "text").map(b => b.text).join("");
}

function apiError(e: unknown, kind: "local" | "key"): string {
  if (e instanceof Anthropic.AuthenticationError) return kind === "key" ? "That API key was not accepted. Check it in the tutor's settings." : "The API key in tine's ANTHROPIC_API_KEY was not accepted.";
  if (e instanceof Anthropic.PermissionDeniedError) return "That API key cannot use this model. Pick another in the tutor's settings.";
  if (e instanceof Anthropic.NotFoundError) return "That model is not available to this API key. Pick another in the tutor's settings.";
  if (e instanceof Anthropic.RateLimitError) return "Too many requests for this API key just now. Try again in a minute.";
  if (e instanceof Anthropic.BadRequestError) return "The request was refused: " + (e as Error).message;
  if (e instanceof Anthropic.APIError) return `The API had a problem (${(e as any).status ?? "no status"}). Try again.`;
  if (e instanceof Anthropic.APIConnectionError) return kind === "local" ? "Could not reach tine. Is it still running?" : "Could not reach the Claude API. Check the connection.";
  return (e as Error)?.message ?? String(e);
}

// ---------- choosing one ----------

export async function connect(): Promise<Backend | null> {
  const c = (window as any).claude;
  if (c?.use) {
    const sample = await Promise.resolve(c.use("sample")).catch(() => null);
    if (sample) return artifactBackend(sample);
  }
  if (location.protocol.startsWith("http")) {
    try {
      const r = await fetch("/api/tutor");
      if (r.ok && (await r.json()).ready) return apiBackend("local", new Anthropic({ apiKey: "held-by-tine", baseURL: location.origin + "/api/anthropic", dangerouslyAllowBrowser: true, maxRetries: 1 }), "the API key tine was started with");
    } catch { /* not served by tine */ }
  }
  const key = settings.key;
  if (key) return apiBackend("key", new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1 }), "the API key saved in this browser");
  return null;
}
