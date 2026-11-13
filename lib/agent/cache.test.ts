import { test } from "node:test";
import assert from "node:assert/strict";
import { asParts, cacheThreshold, cacheable, contentHash, replayChunks, storableParts } from "./cache.ts";
import { formatAge, statusSegments } from "./status.ts";
import { frame, parseFrames, splitStream } from "../suggestion-protocol.ts";

const search = frame({ t: "search", q: "What is BoilerFrame?", n: 2, top: [{ src: "BoilerFrame", score: 0.81 }] });
const sources = frame({ t: "sources", items: [{ n: 1, label: "BoilerFrame", anchor: "project-boilerframe" }] });
const text = "BoilerFrame finds people in video [1].";
const done = frame({ t: "done" });
const trailer = frame({ t: "trailer", suggestions: ["What stack does it use?"], actions: [], usage: { total_tokens: 1234 } });
// A recorded first-turn stream: search -> sources -> text -> done -> trailer (what the route emits).
const recorded = search + sources + text + done + trailer;

test("replay of a stored stream matches the original, led by a cache frame, with zero tokens", () => {
  const parts = storableParts(recorded);
  assert.ok(parts);
  const replay = replayChunks(parts, new Date(Date.now() - 3 * 3600_000).toISOString()).join("");
  const got = parseFrames(replay);
  assert.deepEqual(got[0], { type: "event", event: { t: "cache", age: 10800 } });
  const rest = splitStream(replay);
  assert.equal(rest.answer, text);
  assert.ok(rest.done);
  assert.deepEqual(rest.suggestions, ["What stack does it use?"]);
  const last = got[got.length - 1];
  assert.deepEqual(last.type === "event" && last.event.t === "trailer" && last.event.usage, { total_tokens: 0 });
  assert.deepEqual(got.slice(1).map((p) => (p.type === "text" ? p.text : p.event.t)), ["search", "sources", text, "done", "trailer"]);
});

test("a stored parts array survives the jsonb round trip; junk is a miss", () => {
  const parts = storableParts(recorded)!;
  assert.deepEqual(asParts(JSON.parse(JSON.stringify(parts))), parts);
  assert.equal(asParts([{ type: "nope" }]), null);
  assert.equal(asParts([]), null);
  assert.equal(asParts("x"), null);
});

test("streams with tool frames, no grounding, no trailer or no text are never stored", () => {
  const tool = frame({ t: "tool", id: "1", name: "show_section", args: { id: "about" } });
  assert.equal(storableParts(search + sources + text + tool + done + trailer), null);
  assert.equal(storableParts(recorded.replace('"n":2', '"n":0')), null);
  assert.equal(storableParts(search + sources + text + done), null);
  assert.equal(storableParts(search + done + trailer), null);
  assert.equal(storableParts(frame({ t: "cache", age: 1 }) + recorded), null);
});

const ok = { evalRun: false, evalOptIn: false, owner: false, history: 0, question: "What is BoilerFrame?" };

test("cacheable: first turns only, no selection, no page-relative wording, no owner, evals opt in", () => {
  assert.equal(cacheable(ok), true);
  assert.equal(cacheable({ ...ok, history: 2 }), false);
  assert.equal(cacheable({ ...ok, selection: "quoted text" }), false);
  assert.equal(cacheable({ ...ok, question: "Explain this section" }), false);
  assert.equal(cacheable({ ...ok, owner: true }), false);
  assert.equal(cacheable({ ...ok, evalRun: true }), false);
  assert.equal(cacheable({ ...ok, evalRun: true, evalOptIn: true }), true);
  assert.equal(cacheable({ ...ok, owner: true, evalRun: true, evalOptIn: true }), false);
});

test("contentHash changes with content, resume, docs or model; not with doc order", () => {
  const base = { content: { a: 1 }, resumeSha: "r1", docs: [{ id: "a", at: "t1" }, { id: "b", at: "t2" }], model: "m" };
  const h = contentHash(base);
  assert.equal(h, contentHash({ ...base, docs: [...base.docs].reverse() }));
  for (const change of [{ content: { a: 2 } }, { resumeSha: "r2" }, { docs: [{ id: "a", at: "t9" }] }, { model: "m2" }]) {
    assert.notEqual(h, contentHash({ ...base, ...change }));
  }
});

test("cacheThreshold defaults to 0.95 and clamps typos", () => {
  assert.equal(cacheThreshold(undefined), 0.95);
  assert.equal(cacheThreshold("0.97"), 0.97);
  assert.equal(cacheThreshold("0.5"), 0.9);
  assert.equal(cacheThreshold("5"), 0.999);
  assert.equal(cacheThreshold("abc"), 0.95);
});

test("the status line shows ● cached only for a cached answer; ages are compact", () => {
  assert.ok(!statusSegments({ kind: "idle", turns: 1, usage: { tokens: 0 } }).some((s) => s.text === "● cached"));
  assert.ok(statusSegments({ kind: "idle", turns: 1, usage: { tokens: 0, cached: true } }).some((s) => s.text === "● cached"));
  assert.deepEqual([5, 300, 10800, 172800].map(formatAge), ["5s", "5m", "3h", "2d"]);
});
