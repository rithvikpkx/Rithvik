import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSSEDeltas } from "./openai.ts";

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
