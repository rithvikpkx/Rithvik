import { test } from "node:test";
import assert from "node:assert/strict";
import { extractTokens, extractTools, hasTool, isDecline, parseFrames, scoreCase, splitStream, summarize } from "./lib.mjs";

const v1 = (obj) => `Hello answer.\u0000RAG_SUGGESTIONS\u0000${JSON.stringify(obj)}`;

test("splitStream treats everything after the first NUL as structured, with or without a trailer", () => {
  assert.deepEqual(splitStream("plain"), { answer: "plain", tail: "" });
  const s = splitStream(v1({ suggestions: ["a"], actions: [] }));
  assert.equal(s.answer, "Hello answer.");
  assert.deepEqual(parseFrames(s.tail), [{ suggestions: ["a"], actions: [] }]);
});

test("splitStream reads v2: text runs are the answer, frames are structured", () => {
  const f = (o) => `\u0000${JSON.stringify(o)}\u0000`;
  const raw = f({ t: "search", q: "x", n: 1, top: [] }) + "Step one." + f({ t: "tool", id: "1", name: "open_project", args: { slug: "boilerframe" } }) + " Two." + f({ t: "done" }) + f({ t: "trailer", suggestions: [], actions: [], usage: { total_tokens: 42 } });
  const s = splitStream(raw);
  assert.equal(s.answer, "Step one. Two.");
  const frames = parseFrames(s.tail);
  assert.deepEqual(extractTools(frames), [{ name: "open_project", target: "boilerframe" }]);
  assert.equal(extractTokens(frames), 42);
});

test("parseFrames tolerates labels, partial JSON and several NUL-separated frames", () => {
  const frames = parseFrames('LABEL\u0000{"a":1}\u0000{"b":\u0000[{"tool":"x"}]');
  assert.deepEqual(frames, [{ a: 1 }, [{ tool: "x" }]]);
});

test("extractTools reads v1 actions and generic tool shapes", () => {
  const t1 = extractTools([{ suggestions: [], actions: [{ type: "scroll_to", label: "Show", target: "project-boilerframe" }, { type: "open_composer", label: "Email" }] }]);
  assert.deepEqual(t1, [{ name: "scroll_to", target: "project-boilerframe" }, { name: "open_composer", target: "" }]);
  const t2 = extractTools([{ tool_calls: [{ name: "switch_style", args: { target: "glyph" } }] }]);
  assert.deepEqual(t2, [{ name: "switch_style", target: "glyph" }]);
});

test("hasTool matches exact names and v1 aliases only", () => {
  const tools = [{ name: "scroll_to", target: "project-boilerframe" }, { name: "open_composer", target: "" }];
  assert.ok(hasTool("open_project", tools));
  assert.ok(hasTool("draft_email", tools));
  assert.ok(hasTool("scroll_to", tools));
  assert.equal(hasTool("switch_style", tools), false);
  assert.equal(hasTool("open_project", [{ name: "scroll_to", target: "about" }]), false);
});

test("extractTokens finds usage in any frame", () => {
  assert.equal(extractTokens([{ a: 1 }, { usage: { total_tokens: 812 } }]), 812);
  assert.equal(extractTokens([{ a: 1 }]), null);
});

test("isDecline spots the site's refusal and redirect wording", () => {
  assert.ok(isDecline("I don't have that specific detail, but you're welcome to reach out to Rithvik directly at x@y.z."));
  assert.ok(isDecline("I'm here specifically to answer questions about Rithvik."));
  assert.ok(isDecline("I'm only set up to discuss Rithvik and his portfolio."));
  assert.equal(isDecline("BoilerFrame finds every frame a person appears in."), false);
});

test("scoreCase: include any-of, exclude, decline and tool checks", () => {
  const ok = { answer: "He built BoilerFrame on MongoDB with AWS.", tools: [] };
  assert.equal(scoreCase({ include: [["mongodb", "mern"], "aws"] }, ok).pass, true);
  assert.equal(scoreCase({ include: ["Rekognition"] }, ok).pass, false);
  assert.equal(scoreCase({ include: ["AWS"], exclude: ["Azure"] }, ok).pass, true);
  assert.equal(scoreCase({ include: ["AWS"], exclude: ["MongoDB"] }, ok).pass, false);
  assert.equal(scoreCase({ decline: true }, ok).pass, false);
  assert.equal(scoreCase({ decline: true, excludeRe: ["\\d{3}-\\d{4}"] }, { answer: "I don't have that specific detail.", tools: [] }).pass, true);
  assert.equal(scoreCase({}, { answer: "I don't have that specific detail.", tools: [] }).pass, false);
  assert.equal(scoreCase({ tool: "open_project" }, { answer: "", tools: [{ name: "scroll_to", target: "project-qrify" }] }).pass, true);
  assert.equal(scoreCase({ tool: "switch_style" }, { answer: "", tools: [] }).pass, false);
});

test("artifact frames count as render_artifact calls, scored by form; noTool forbids a call", () => {
  const f = { t: "artifact", id: "1", spec: { type: "timeline", title: "Roles", data: { items: [] } } };
  assert.deepEqual(extractTools([f]), [{ name: "render_artifact", target: "timeline" }]);
  const r = { answer: "Here you go.", tools: extractTools([f]) };
  assert.equal(scoreCase({ tool: "render_artifact", artifact: ["timeline"] }, r).pass, true);
  assert.equal(scoreCase({ tool: "render_artifact", artifact: ["bar", "table"] }, r).pass, false);
  assert.equal(scoreCase({ noTool: "render_artifact" }, r).pass, false);
  assert.equal(scoreCase({ noTool: "render_artifact" }, { answer: "4", tools: [] }).pass, true);
});

test("summarize counts per category and medians latency", () => {
  const s = summarize([
    { category: "a", pass: true, ttfbMs: 100, totalMs: 1000 },
    { category: "a", pass: false, ttfbMs: 300, totalMs: 3000 },
    { category: "b", pass: true, error: "x", ttfbMs: 0, totalMs: 0 },
  ]);
  assert.deepEqual(s.categories, { a: { pass: 1, total: 2 }, b: { pass: 1, total: 1 } });
  assert.equal(s.pass, 2);
  assert.equal(s.totalMedianMs, 1000);
});
