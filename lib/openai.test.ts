import { test } from "node:test";
import assert from "node:assert/strict";
import { chatBody, isReasoningModel, mergeToolDeltas, parseSSEDeltas } from "./openai.ts";

test("reasoning models get max_completion_tokens + effort and never temperature", () => {
  const b = chatBody({ model: "gpt-5-nano", messages: [], maxTokens: 50, temperature: 0.7, reasoningEffort: "minimal" }, true);
  assert.equal(b.max_completion_tokens, 50);
  assert.equal(b.reasoning_effort, "minimal");
  assert.equal("temperature" in b, false);
  assert.equal("max_tokens" in b, false);
  assert.equal(b.stream, true);
  assert.ok(isReasoningModel("o4-mini") && !isReasoningModel("gpt-4o-mini"));
});

test("classic models get max_tokens + temperature and never reasoning_effort", () => {
  const b = chatBody({ model: "gpt-4o-mini", messages: [], maxTokens: 50, temperature: 0.3, reasoningEffort: "low", json: true }, false);
  assert.equal(b.max_tokens, 50);
  assert.equal(b.temperature, 0.3);
  assert.equal("reasoning_effort" in b, false);
  assert.deepEqual(b.response_format, { type: "json_object" });
  assert.equal("stream" in b, false);
});

test("streaming asks for usage and the final usage chunk is read", () => {
  assert.deepEqual(chatBody({ model: "gpt-4o-mini", messages: [], maxTokens: 5 }, true).stream_options, { include_usage: true });
  const { usage, deltas } = parseSSEDeltas(`data: ${JSON.stringify({ choices: [], usage: { total_tokens: 123 } })}\n\n`);
  assert.equal(usage, 123);
  assert.deepEqual(deltas, []);
});

test("streamed tool-call fragments merge into whole calls by index", () => {
  const tc = (index: number, f: Record<string, string>, id?: string) =>
    `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index, ...(id ? { id } : {}), function: f }] } }] })}\n\n`;
  const { tools, deltas } = parseSSEDeltas(
    tc(0, { name: "open_project", arguments: "" }, "a") + tc(0, { arguments: '{"slug":' }) + tc(1, { name: "draft_email", arguments: "{}" }, "b") + tc(0, { arguments: '"x"}' }),
  );
  assert.deepEqual(deltas, []);
  assert.deepEqual(mergeToolDeltas([], tools), [
    { id: "a", name: "open_project", arguments: '{"slug":"x"}' },
    { id: "b", name: "draft_email", arguments: "{}" },
  ]);
});

const ev = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

test("extracts deltas from complete events and skips [DONE]", () => {
  const { deltas, rest } = parseSSEDeltas(ev("Hel") + ev("lo") + "data: [DONE]\n\n");
  assert.deepEqual(deltas, ["Hel", "lo"]);
  assert.equal(rest, "");
});

test("keeps a partial event as the tail until it completes", () => {
  const full = ev("Hi");
  const a = parseSSEDeltas(full.slice(0, 20));
  assert.deepEqual(a.deltas, []);
  const b = parseSSEDeltas(a.rest + full.slice(20));
  assert.deepEqual(b.deltas, ["Hi"]);
});

test("ignores role-only deltas, malformed JSON and CRLF framing", () => {
  const role = `data: ${JSON.stringify({ choices: [{ delta: { role: "assistant" } }] })}\n\n`;
  const crlf = ev("ok").replace(/\n/g, "\r\n");
  const { deltas } = parseSSEDeltas(role + "data: {oops\n\n" + crlf);
  assert.deepEqual(deltas, ["ok"]);
});
