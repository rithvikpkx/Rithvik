import { test } from "node:test";
import assert from "node:assert/strict";
import {
  splitStream,
  normalizeSuggestions,
  SUGGESTIONS_SENTINEL as S,
  MAX_SUGGESTION_CHARS,
} from "./suggestion-protocol.ts";

const payload = (arr: string[]) => S + JSON.stringify({ suggestions: arr });

test("plain answer with no sentinel passes through untouched", () => {
  const r = splitStream("Rithvik studies at Purdue.");
  assert.equal(r.answer, "Rithvik studies at Purdue.");
  assert.equal(r.suggestions, null);
});

test("splits answer from a complete payload", () => {
  const r = splitStream("The answer." + payload(["One?", "Two?"]));
  assert.equal(r.answer, "The answer.");
  assert.deepEqual(r.suggestions, ["One?", "Two?"]);
});

test("withholds a partially-arrived sentinel so it never flashes", () => {
  // Simulate the stream cutting mid-sentinel.
  for (let i = 1; i < S.length; i++) {
    const r = splitStream("Answer" + S.slice(0, i));
    assert.equal(r.answer, "Answer", `leaked partial sentinel at ${i} chars`);
    assert.equal(r.suggestions, null);
  }
});

test("sentinel present but JSON not yet complete → answer correct, suggestions null", () => {
  const r = splitStream("Answer" + S + '{"sugg');
  assert.equal(r.answer, "Answer");
  assert.equal(r.suggestions, null);
});

test("malformed JSON payload never corrupts the answer", () => {
  const r = splitStream("Answer" + S + "not json at all");
  assert.equal(r.answer, "Answer");
  assert.equal(r.suggestions, null);
});

test("chunk-by-chunk accumulation converges correctly", () => {
  const full = "Hello there." + payload(["A?", "B?", "C?"]);
  let acc = "";
  let last = splitStream("");
  for (const ch of full) {
    acc += ch;
    last = splitStream(acc);
    // The visible answer must never exceed the true answer at any point.
    assert.ok("Hello there.".startsWith(last.answer) || last.answer === "Hello there.");
  }
  assert.equal(last.answer, "Hello there.");
  assert.deepEqual(last.suggestions, ["A?", "B?", "C?"]);
});

test("answer containing the word RAG_SUGGESTIONS without NULs is not split", () => {
  const r = splitStream("He named the constant RAG_SUGGESTIONS in the code.");
  assert.equal(r.answer, "He named the constant RAG_SUGGESTIONS in the code.");
  assert.equal(r.suggestions, null);
});

test("empty suggestions array yields an empty list, not null", () => {
  const r = splitStream("Answer" + payload([]));
  assert.deepEqual(r.suggestions, []);
});

test("normalizeSuggestions rejects non-arrays and non-strings", () => {
  assert.deepEqual(normalizeSuggestions(null), []);
  assert.deepEqual(normalizeSuggestions("nope"), []);
  assert.deepEqual(normalizeSuggestions([1, {}, null, "ok?"]), ["ok?"]);
});

test("normalizeSuggestions caps at 3 and dedupes case-insensitively", () => {
  const r = normalizeSuggestions(["A?", "a?", "B?", "C?", "D?"]);
  assert.deepEqual(r, ["A?", "B?", "C?"]);
});

test("normalizeSuggestions truncates over-long entries", () => {
  const long = "x".repeat(200);
  const r = normalizeSuggestions([long]);
  assert.equal(r[0].length, MAX_SUGGESTION_CHARS);
});

test("normalizeSuggestions collapses whitespace and drops blanks", () => {
  assert.deepEqual(normalizeSuggestions(["  spaced   out  ", "   ", "\n\t"]), ["spaced out"]);
});
