// The one model client (AGENTS.md rule 11): timeout, failover Groq → Gemini on 429/503/timeout,
// one retry on Gemini, and a log line per call against a request ID. Endpoints and fields verified
// in docs/CONTEXT.md (E-005).

export const MODELS = {
  groq: "qwen/qwen3.8-27b",
  gemini: "gemini-3.5-flash-lite",
} as const;

export type Provider = keyof typeof MODELS;

export interface Completion {
  text: string;
  provider: Provider;
  model: string;
  ms: number;
}

export class ModelUnavailableError extends Error {
  constructor(public readonly attempts: string[]) {
    super(`no model available: ${attempts.join("; ")}`);
  }
}

const TIMEOUT_MS = 9000;
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

class HttpError extends Error {
  constructor(public readonly status: number, body: string) {
    super(`HTTP ${status}: ${body.slice(0, 160)}`);
  }
}

async function callGroq(system: string, user: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODELS.groq,
      temperature: 0,
      reasoning_effort: "none",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new HttpError(res.status, await res.text());
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

async function callGemini(system: string, user: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new HttpError(res.status, await res.text());
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
}

const isRetryable = (e: unknown) =>
  (e instanceof HttpError && RETRYABLE.has(e.status)) || (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError"));

function log(entry: Record<string, unknown>) {
  console.info(JSON.stringify({ at: new Date().toISOString(), scope: "ai", ...entry }));
}

/** Ask for JSON. Groq first; on a retryable failure, Gemini (with one retry). Throws ModelUnavailableError. */
export async function complete(system: string, user: string, requestId: string): Promise<Completion> {
  const attempts: string[] = [];
  const plan: [Provider, () => Promise<string>][] = [
    ["groq", () => callGroq(system, user)],
    ["gemini", () => callGemini(system, user)],
    ["gemini", () => callGemini(system, user)],
  ];
  for (let i = 0; i < plan.length; i++) {
    const [provider, call] = plan[i];
    const t0 = Date.now();
    try {
      const text = await call();
      const ms = Date.now() - t0;
      log({ requestId, provider, model: MODELS[provider], ms, ok: true, promptChars: user.length, output: text.slice(0, 600) });
      return { text, provider, model: MODELS[provider], ms };
    } catch (e) {
      const ms = Date.now() - t0;
      const msg = e instanceof Error ? e.message : String(e);
      attempts.push(`${provider}: ${msg.slice(0, 120)}`);
      log({ requestId, provider, model: MODELS[provider], ms, ok: false, error: msg.slice(0, 200), prompt: user.slice(0, 600) });
      if (!isRetryable(e) && !(e instanceof Error && e.message.endsWith("not set"))) break;
      if (i === 1) await new Promise((r) => setTimeout(r, 800));
    }
  }
  throw new ModelUnavailableError(attempts);
}

// ——— Multi-turn chat with tool calling (the ledger's Studio agents) ———
// Same client, same policy: Groq first, then Gemini (with one retry) on a retryable failure, a
// timeout, and a log line per call. Both speak OpenAI-style chat completions with function tools
// (Groq natively; Gemini through its OpenAI-compatible endpoint, verified 2026-11-07).
// Gemini 3 requires each tool call's thought signature to be sent back on the next turn (T-23); a
// call made by Groq carries Google's documented placeholder instead.

export interface ChatToolCall {
  id: string;
  name: string;
  arguments: string;
  /** Gemini's thought signature for this call, echoed back on the next turn. */
  signature?: string;
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: ChatToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export interface ChatTool {
  name: string;
  description: string;
  parameters: unknown;
}

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: ChatTool[];
  toolChoice?: "auto" | "none" | "required" | { name: string };
  /** Ask for JSON matching this schema. */
  json?: { name: string; schema: unknown } | null;
}

export interface ChatResult {
  content: string;
  toolCalls: ChatToolCall[];
  provider: Provider;
  model: string;
  ms: number;
  usage?: { inputTokens: number; outputTokens: number };
}

const CHAT_TIMEOUT_MS = 25000;

class EmptyAnswerError extends Error {
  constructor() {
    super("empty answer: no text and no tool call");
  }
}
// Groq's free tier allows ~8,000 input tokens per minute for this model and answers 413 above it
// (T-25). Studio's agent turns carry long prompts and tool schemas (6k–30k tokens, measured), so a
// turn estimated above this goes straight to Gemini; smaller turns keep Groq first (D-018).
export const GROQ_MAX_TURN_TOKENS = 4000;
export const estimateTokens = (req: ChatRequest) => Math.ceil(JSON.stringify(req).length / 4);
const SKIP_SIGNATURE = "skip_thought_signature_validator";

const CHAT_ENDPOINTS: Record<Provider, { url: string; key: () => string | undefined; extra: Record<string, unknown> }> = {
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", key: () => process.env.GROQ_API_KEY, extra: { reasoning_effort: "none" } },
  gemini: { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: () => process.env.GEMINI_API_KEY, extra: {} },
};

/** The provider request body for a chat turn (exported for tests). */
export function toWire(provider: Provider, req: ChatRequest) {
  const messages = req.messages.map((m) => {
    if (m.role === "tool") return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
    if (m.role === "assistant")
      return {
        role: "assistant",
        content: m.content,
        ...(m.toolCalls?.length
          ? {
              tool_calls: m.toolCalls.map((c) => ({
                id: c.id,
                type: "function",
                function: { name: c.name, arguments: c.arguments },
                ...(provider === "gemini" ? { extra_content: { google: { thought_signature: c.signature ?? SKIP_SIGNATURE } } } : {}),
              })),
            }
          : {}),
      };
    return { role: m.role, content: m.content };
  });
  const body: Record<string, unknown> = { model: MODELS[provider], temperature: 0, messages, ...CHAT_ENDPOINTS[provider].extra };
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
    if (req.toolChoice) body.tool_choice = typeof req.toolChoice === "string" ? req.toolChoice : { type: "function", function: { name: req.toolChoice.name } };
  }
  if (req.json) {
    if (provider === "gemini") body.response_format = { type: "json_schema", json_schema: { name: req.json.name, schema: req.json.schema } };
    else {
      body.response_format = { type: "json_object" };
      messages.unshift({ role: "system", content: `Respond with JSON only, matching this JSON Schema: ${JSON.stringify(req.json.schema)}` });
    }
  }
  return body;
}

async function callChat(provider: Provider, req: ChatRequest): Promise<Omit<ChatResult, "provider" | "model" | "ms">> {
  const ep = CHAT_ENDPOINTS[provider];
  const key = ep.key();
  if (!key) throw new Error(`${provider === "groq" ? "GROQ" : "GEMINI"}_API_KEY not set`);
  const res = await fetch(ep.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(toWire(provider, req)),
    signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
  });
  if (!res.ok) throw new HttpError(res.status, await res.text());
  const json = (await res.json()) as {
    choices?: {
      message?: {
        content?: string | null;
        tool_calls?: { id: string; function: { name: string; arguments: string }; extra_content?: { google?: { thought_signature?: string } } }[];
      };
    }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const m = json.choices?.[0]?.message;
  return {
    content: m?.content ?? "",
    toolCalls: (m?.tool_calls ?? []).map((c) => ({
      id: c.id,
      name: c.function.name,
      arguments: c.function.arguments || "{}",
      signature: c.extra_content?.google?.thought_signature,
    })),
    usage: json.usage ? { inputTokens: json.usage.prompt_tokens ?? 0, outputTokens: json.usage.completion_tokens ?? 0 } : undefined,
  };
}

/** One chat turn with tools. Groq first; Gemini on a retryable failure (one retry). Throws ModelUnavailableError. */
export async function chat(req: ChatRequest, requestId: string): Promise<ChatResult> {
  const attempts: string[] = [];
  const estTokens = estimateTokens(req);
  const plan: Provider[] = estTokens > GROQ_MAX_TURN_TOKENS ? ["gemini", "gemini"] : ["groq", "gemini", "gemini"];
  const inputChars = req.messages.reduce((n, m) => n + (m.content?.length ?? 0), 0);
  for (let i = 0; i < plan.length; i++) {
    const provider = plan[i];
    const t0 = Date.now();
    try {
      const r = await callChat(provider, req);
      // A turn with no text and no tool call answers nothing (seen from Gemini on long contexts).
      if (!r.content.trim() && r.toolCalls.length === 0) throw new EmptyAnswerError();
      const ms = Date.now() - t0;
      log({
        requestId,
        provider,
        model: MODELS[provider],
        ms,
        ok: true,
        kind: "chat",
        tools: req.tools?.length ?? 0,
        inputChars,
        estTokens,
        output: r.content.slice(0, 400),
        toolCalls: r.toolCalls.map((c) => c.name),
        usage: r.usage,
      });
      return { ...r, provider, model: MODELS[provider], ms };
    } catch (e) {
      const ms = Date.now() - t0;
      const msg = e instanceof Error ? e.message : String(e);
      attempts.push(`${provider}: ${msg.slice(0, 120)}`);
      log({ requestId, provider, model: MODELS[provider], ms, ok: false, kind: "chat", error: msg.slice(0, 200), inputChars });
      // Groq answers 403 from some networks (T-24) and 413 for a turn over its per-minute token
      // window (T-25); both mean "not Groq, not now", so fail over.
      const groqBlocked = provider === "groq" && e instanceof HttpError && (e.status === 403 || e.status === 413);
      if (!isRetryable(e) && !groqBlocked && !(e instanceof EmptyAnswerError) && !(e instanceof Error && e.message.endsWith("not set"))) break;
      // A per-minute quota needs a real pause before the same provider is asked again.
      if (plan[i + 1] === provider) await new Promise((r) => setTimeout(r, e instanceof HttpError && e.status === 429 ? 6000 : 800));
    }
  }
  throw new ModelUnavailableError(attempts);
}
