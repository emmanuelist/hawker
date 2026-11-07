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
