// One model turn for the ledger's Studio agents. The browser adapter sends a provider-neutral chat
// request; the one model client (rule 11) answers with Groq → Gemini failover. A public route that
// spends free quotas, so it is size-checked and rate-limited per visitor and per day.
import { z } from "zod";
import { chat, ModelUnavailableError } from "@/lib/ai/client";
import { allow, clientKey } from "@/lib/service/limit";

const ToolCall = z.object({ id: z.string().max(200), name: z.string().max(100), arguments: z.string().max(20000), signature: z.string().max(10000).optional() });
const Message = z.discriminatedUnion("role", [
  z.object({ role: z.enum(["system", "user"]), content: z.string().max(60000) }),
  z.object({ role: z.literal("assistant"), content: z.string().max(20000).nullable(), toolCalls: z.array(ToolCall).max(20).optional() }),
  z.object({ role: z.literal("tool"), toolCallId: z.string().max(200), content: z.string().max(60000) }),
]);
const Body = z.object({
  requestId: z.string().max(80),
  messages: z.array(Message).min(1).max(80),
  tools: z.array(z.object({ name: z.string().max(100), description: z.string().max(4000), parameters: z.unknown() })).max(40).optional(),
  toolChoice: z.union([z.enum(["auto", "none", "required"]), z.object({ name: z.string().max(100) })]).optional(),
  json: z.object({ name: z.string().max(100), schema: z.unknown() }).nullable().optional(),
});

export async function POST(req: Request) {
  const who = clientKey(req);
  if (!allow(`ai:${who}`, 40, 10 * 60_000) || !allow("ai:all", 600, 24 * 60 * 60_000)) {
    return Response.json({ error: "The ledger assistant is busy. Try again in a few minutes." }, { status: 429 });
  }
  const raw = await req.text();
  if (raw.length > 400_000) return Response.json({ error: "Request too large." }, { status: 413 });
  const parsed = Body.safeParse(JSON.parse(raw || "{}"));
  if (!parsed.success) return Response.json({ error: "Malformed turn." }, { status: 400 });
  const { requestId, ...request } = parsed.data;
  try {
    const r = await chat(request, `ledger-${requestId}`);
    return Response.json({ content: r.content, toolCalls: r.toolCalls, provider: r.provider, model: r.model, ms: r.ms, usage: r.usage });
  } catch (e) {
    if (e instanceof ModelUnavailableError) return Response.json({ error: "Both models are unavailable right now.", attempts: e.attempts }, { status: 503 });
    console.error(JSON.stringify({ scope: "ai-turn", error: (e as Error).message.slice(0, 200) }));
    return Response.json({ error: "The turn failed." }, { status: 500 });
  }
}
