// AG Studio's AgLlmAdapter for Hawker (types verified in node_modules/ag-studio/dist/types/api/ai/).
// Studio owns the agent loop in the browser; each turn comes here, is turned into a provider-neutral
// chat request, and is answered by /api/ai/turn through the one model client (Groq → Gemini).
// The answer goes back as Studio's content events plus the final AgLlmResponse. Gemini's thought
// signatures are kept per tool call and sent back on later turns (T-23).
import type { AgAiEvent, AgAiOutputItem, AgLlmAdapter, AgLlmRequest, AgLlmResponse } from "ag-studio";

export interface WireToolCall {
  id: string;
  name: string;
  arguments: string;
  signature?: string;
}
export type WireMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: WireToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };
interface TurnAnswer {
  content: string;
  toolCalls: WireToolCall[];
  provider: string;
  model: string;
}

/** Studio's conversation → our chat request. Consecutive tool calls join the assistant turn they belong to. */
export function toChat(req: AgLlmRequest, signatures: ReadonlyMap<string, string>) {
  const messages: WireMessage[] = [];
  if (req.instructions) messages.push({ role: "system", content: req.instructions });
  for (const item of req.input) {
    if (item.type === "message" && item.kind === "input") {
      messages.push({ role: item.role, content: item.content.map((c) => (c.type === "text" ? c.text : "")).join("\n") });
    } else if (item.type === "message") {
      const text = item.content.map((c) => (c.type === "text" ? c.text : c.refusal)).join("");
      messages.push({ role: "assistant", content: text || null });
    } else if (item.type === "function_call") {
      const call: WireToolCall = { id: item.callId, name: item.name, arguments: item.arguments || "{}", signature: signatures.get(item.callId) };
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") last.toolCalls = [...(last.toolCalls ?? []), call];
      else messages.push({ role: "assistant", content: null, toolCalls: [call] });
    } else if (item.type === "function_call_output") {
      messages.push({ role: "tool", toolCallId: item.callId, content: item.output });
    }
    // Reasoning items carry nothing the next turn needs.
  }
  const tools = (req.tools ?? []).filter((t) => (t.kind ?? "client") !== "provided").map((t) => ({ name: t.name, description: t.description, parameters: t.parameters }));
  return {
    messages,
    tools: tools.length ? tools : undefined,
    toolChoice: tools.length && req.toolChoice ? (typeof req.toolChoice === "string" ? req.toolChoice : { name: req.toolChoice.name }) : undefined,
    json: req.responseFormat.type === "json" ? { name: req.responseFormat.name, schema: req.responseFormat.schema } : null,
  };
}

export function toOutput(id: string, a: TurnAnswer): AgAiOutputItem[] {
  const out: AgAiOutputItem[] = [];
  if (a.content) out.push({ id: `${id}-msg`, kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text: a.content, annotations: [] }] });
  for (const c of a.toolCalls) out.push({ id: `${id}-${c.id}`, kind: "output", type: "function_call", callId: c.id, name: c.name, arguments: c.arguments, status: "completed" });
  return out;
}

export function* toEvents(id: string, a: TurnAnswer): Generator<AgAiEvent> {
  if (a.content) {
    const messageId = `${id}-msg`;
    yield { type: "TEXT_MESSAGE_START", messageId, role: "assistant" };
    yield { type: "TEXT_MESSAGE_CONTENT", messageId, delta: a.content };
    yield { type: "TEXT_MESSAGE_END", messageId };
  }
  for (const c of a.toolCalls) {
    yield { type: "TOOL_CALL_START", toolCallId: c.id, toolCallName: c.name };
    yield { type: "TOOL_CALL_ARGS", toolCallId: c.id, delta: c.arguments };
    yield { type: "TOOL_CALL_END", toolCallId: c.id };
  }
}

export function hawkerAdapter(endpoint = "/api/ai/turn"): AgLlmAdapter {
  const signatures = new Map<string, string>();
  let n = 0;
  return {
    executeTurn(request, options) {
      const id = `t${Date.now().toString(36)}${(n++).toString(36)}`;
      const createdAt = Date.now();
      const answer = (async (): Promise<TurnAnswer> => {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: id, ...toChat(request, signatures) }),
          signal: options?.signal,
        });
        const json = (await res.json()) as Partial<TurnAnswer> & { error?: string };
        if (!res.ok) throw new Error(json.error ?? `The model turn failed (${res.status}).`);
        const a = { content: json.content ?? "", toolCalls: json.toolCalls ?? [], provider: json.provider ?? "", model: json.model ?? "" };
        for (const c of a.toolCalls) if (c.signature) signatures.set(c.id, c.signature);
        return a;
      })();
      const complete: Promise<AgLlmResponse> = answer.then(
        (a) => ({ id, createdAt, status: "completed", output: toOutput(id, a), model: a.model }),
        (e: unknown) => ({
          id,
          createdAt,
          status: options?.signal?.aborted ? "cancelled" : "failed",
          error: { code: "turn_failed", message: e instanceof Error ? e.message : String(e) },
          output: [],
        }),
      );
      const stream = {
        async *[Symbol.asyncIterator]() {
          let a: TurnAnswer;
          try {
            a = await answer;
          } catch {
            return; // a failed turn is reported on `complete`, not as a stream event
          }
          yield* toEvents(id, a);
        },
      };
      return { stream, complete };
    },
  };
}
