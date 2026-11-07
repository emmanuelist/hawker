import { describe, expect, test } from "vitest";
import { toWire, type ChatRequest } from "./client";

const req: ChatRequest = {
  messages: [
    { role: "system", content: "You read a ledger." },
    { role: "user", content: "Who still owes?" },
    { role: "assistant", content: null, toolCalls: [{ id: "c1", name: "who_owes_now", arguments: "{}", signature: "SIG-1" }, { id: "c2", name: "view_schema", arguments: "{}" }] },
    { role: "tool", toolCallId: "c1", content: "[]" },
    { role: "tool", toolCallId: "c2", content: "{}" },
  ],
  tools: [{ name: "who_owes_now", description: "Open unpaid holds", parameters: { type: "object", properties: {} } }],
  toolChoice: "auto",
};

type Wire = { messages: { role: string; content?: unknown; tool_calls?: { id: string; extra_content?: { google: { thought_signature: string } } }[]; tool_call_id?: string }[]; tools?: unknown[]; tool_choice?: unknown; response_format?: { type: string }; reasoning_effort?: string };

describe("chat wire body", () => {
  test("Gemini gets each call's thought signature back, and a placeholder for a call it didn't make (T-23)", () => {
    const w = toWire("gemini", req) as Wire;
    const calls = w.messages[2].tool_calls!;
    expect(calls[0].extra_content?.google.thought_signature).toBe("SIG-1");
    expect(calls[1].extra_content?.google.thought_signature).toBe("skip_thought_signature_validator");
    expect(w.messages[3]).toEqual({ role: "tool", tool_call_id: "c1", content: "[]" });
  });
  test("Groq never receives Gemini's extra_content, and runs without reasoning", () => {
    const w = toWire("groq", req) as Wire;
    expect(w.messages[2].tool_calls!.every((c) => c.extra_content === undefined)).toBe(true);
    expect(w.reasoning_effort).toBe("none");
  });
  test("tools and a named tool choice map to function tools", () => {
    const w = toWire("groq", { ...req, toolChoice: { name: "who_owes_now" } }) as Wire;
    expect(w.tools).toEqual([{ type: "function", function: { name: "who_owes_now", description: "Open unpaid holds", parameters: { type: "object", properties: {} } } }]);
    expect(w.tool_choice).toEqual({ type: "function", function: { name: "who_owes_now" } });
  });
  test("a JSON request uses a schema on Gemini and json_object plus the schema in the prompt on Groq", () => {
    const json = { name: "plan", schema: { type: "object" } };
    expect((toWire("gemini", { ...req, json }) as Wire).response_format?.type).toBe("json_schema");
    const g = toWire("groq", { ...req, json }) as Wire;
    expect(g.response_format?.type).toBe("json_object");
    expect(String(g.messages[0].content)).toContain("JSON Schema");
  });
});

describe("turn routing (D-018)", () => {
  test("a small turn fits Groq's per-minute window; a Studio-sized turn does not", async () => {
    const { estimateTokens, GROQ_MAX_TURN_TOKENS } = await import("./client");
    expect(estimateTokens(req)).toBeLessThan(GROQ_MAX_TURN_TOKENS);
    const big = { ...req, messages: [{ role: "system" as const, content: "x".repeat(40_000) }, ...req.messages] };
    expect(estimateTokens(big)).toBeGreaterThan(GROQ_MAX_TURN_TOKENS);
  });
});
