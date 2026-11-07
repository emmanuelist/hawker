import type { AgLlmRequest } from "ag-studio";
import { describe, expect, test } from "vitest";
import { toChat, toEvents, toOutput } from "./adapter";

const request: AgLlmRequest = {
  instructions: "You are Hawker's ledger assistant.",
  responseFormat: { type: "text" },
  toolChoice: "auto",
  tools: [
    { name: "who_owes_now", description: "Open holds, read from PayPal.", parameters: { type: "object", properties: {} } },
    { name: "web_search", description: "hosted", parameters: { type: "object" }, kind: "provided" },
  ],
  input: [
    { id: "u1", kind: "input", type: "message", role: "user", status: "completed", content: [{ type: "text", text: "Who still owes?" }] },
    { id: "a1", kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text: "Checking PayPal.", annotations: [] }] },
    { id: "f1", kind: "output", type: "function_call", callId: "c1", name: "who_owes_now", arguments: "{}" },
    { id: "f2", kind: "output", type: "function_call", callId: "c2", name: "view_schema", arguments: "" },
    { type: "function_call_output", callId: "c1", output: "[]", status: "completed" },
    { type: "function_call_output", callId: "c2", output: "{}", status: "completed" },
  ],
};

describe("Studio conversation → chat request", () => {
  const chat = toChat(request, new Map([["c1", "SIG"]]));
  test("instructions lead, and tool calls join the assistant turn they follow", () => {
    expect(chat.messages[0]).toEqual({ role: "system", content: "You are Hawker's ledger assistant." });
    expect(chat.messages[2]).toEqual({
      role: "assistant",
      content: "Checking PayPal.",
      toolCalls: [
        { id: "c1", name: "who_owes_now", arguments: "{}", signature: "SIG" },
        { id: "c2", name: "view_schema", arguments: "{}", signature: undefined },
      ],
    });
    expect(chat.messages.slice(3)).toEqual([
      { role: "tool", toolCallId: "c1", content: "[]" },
      { role: "tool", toolCallId: "c2", content: "{}" },
    ]);
  });
  test("provider-hosted tools are not forwarded; tool choice and text format pass through", () => {
    expect(chat.tools?.map((t) => t.name)).toEqual(["who_owes_now"]);
    expect(chat.toolChoice).toBe("auto");
    expect(chat.json).toBeNull();
  });
  test("a JSON response format becomes a schema request", () => {
    const j = toChat({ ...request, responseFormat: { type: "json", name: "plan", schema: { type: "object" } } }, new Map());
    expect(j.json).toEqual({ name: "plan", schema: { type: "object" } });
  });
});

describe("chat answer → Studio output and events", () => {
  const answer = { content: "Nobody owes right now.", toolCalls: [{ id: "c9", name: "execute_query", arguments: '{"q":1}' }], provider: "groq", model: "qwen/qwen3.8-27b" };
  test("output carries the message and each call by its call id", () => {
    const out = toOutput("t1", answer);
    expect(out.map((o) => o.type)).toEqual(["message", "function_call"]);
    expect(out[1]).toMatchObject({ callId: "c9", name: "execute_query", arguments: '{"q":1}' });
  });
  test("events are a bracketed message, then a bracketed call", () => {
    expect([...toEvents("t1", answer)].map((e) => e.type)).toEqual([
      "TEXT_MESSAGE_START", "TEXT_MESSAGE_CONTENT", "TEXT_MESSAGE_END", "TOOL_CALL_START", "TOOL_CALL_ARGS", "TOOL_CALL_END",
    ]);
  });
});
