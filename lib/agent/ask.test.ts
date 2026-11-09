import { test } from "node:test";
import assert from "node:assert/strict";
import { askQuestion, cleanQuote, QUOTE_MAX } from "./ask.ts";

test("askQuestion wraps a clean quote", () => {
  assert.equal(askQuestion("  TinyML\n on   Edge Impulse "), 'Explain: "TinyML on Edge Impulse"');
  assert.equal(cleanQuote("a\n\nb"), "a b");
});

test("askQuestion ignores accidental selections", () => {
  assert.equal(askQuestion(""), null);
  assert.equal(askQuestion("  a "), null);
  assert.equal(askQuestion("\n\n"), null);
});

test("askQuestion caps the quote at 300 characters and swaps inner double quotes", () => {
  const q = askQuestion("x".repeat(500))!;
  const quote = q.slice('Explain: "'.length, -1);
  assert.equal(quote.length, QUOTE_MAX);
  assert.ok(quote.endsWith("…"));
  assert.equal(askQuestion('say "hi" there'), "Explain: \"say 'hi' there\"");
});
