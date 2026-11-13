import { test } from "node:test";
import assert from "node:assert/strict";
import {
  splitStream,
  parseFrames,
  frame,
  FRAME,
  normalizeSuggestions,
  containsGrounding,
  normalizeForMatch,
  isRedundant,
  questionSimilarity,
  MAX_SUGGESTION_CHARS,
} from "./suggestion-protocol.ts";

const CONTEXT =
  "Rithvik Praveen Kumar volunteered with Habitat for Humanity developing software " +
  "to streamline their e-commerce operations. He studies at Purdue University, where " +
  "he is pursuing a B.S. in Computer Science and Mathematics.";

test("grounding accepts a verbatim quote", () => {
  assert.ok(containsGrounding(CONTEXT, "volunteered with Habitat for Humanity developing software to streamline"));
});

test("grounding survives punctuation and case drift", () => {
  assert.ok(containsGrounding(CONTEXT, "Volunteered with HABITAT for Humanity, developing software!"));
});

test("grounding survives the model trimming a clause", () => {
  // Only the tail of the real sentence — still a 6-word run present in context.
  assert.ok(containsGrounding(CONTEXT, "software to streamline their e-commerce operations"));
});

test("grounding survives collapsed whitespace and newlines", () => {
  assert.ok(containsGrounding(CONTEXT, "he   is\n\npursuing a B.S. in Computer  Science"));
});

test("grounding REJECTS a plausible-adjacent invention", () => {
  // The real failure from production: studies and projects both appear, but
  // nothing states how he balances them.
  assert.ok(!containsGrounding(CONTEXT, "He balances his studies and his projects carefully each week"));
});

test("grounding rejects evidence from a different subject entirely", () => {
  assert.ok(!containsGrounding(CONTEXT, "He measures the impact of his community work with surveys"));
});

test("grounding rejects empty evidence and empty haystack", () => {
  assert.ok(!containsGrounding(CONTEXT, ""));
  assert.ok(!containsGrounding("", "anything at all here"));
});

test("short evidence must match in full", () => {
  assert.ok(containsGrounding(CONTEXT, "Purdue University"));
  assert.ok(!containsGrounding(CONTEXT, "Stanford University"));
});

test("normalizeForMatch strips punctuation and collapses space", () => {
  assert.equal(normalizeForMatch("  He's  built —  a LOT!  "), "he s built a lot");
});

// ── redundancy against what has already been asked ──────────────────────────

const SHIPPING = "What does Rithvik think about shipping fast vs building properly?";

test("rejects the exact question just asked (production regression)", () => {
  // The ghost text suggested this back verbatim right after it was answered.
  assert.ok(isRedundant(SHIPPING, [SHIPPING]));
});

test("rejects a reworded version of an asked question", () => {
  assert.ok(isRedundant("How does Rithvik weigh shipping fast against building properly?", [SHIPPING]));
});

test("rejects regardless of punctuation and casing drift", () => {
  assert.ok(isRedundant("what does rithvik think about SHIPPING FAST vs BUILDING PROPERLY", [SHIPPING]));
});

test("keeps a genuinely different question about a shared topic", () => {
  assert.ok(!isRedundant("What does Rithvik believe are key goals in software design?", [SHIPPING]));
});

test("keeps related-but-distinct questions", () => {
  const asked = ["What projects has Rithvik worked on?"];
  assert.ok(!isRedundant("What technologies does Rithvik use in his projects?", asked));
});

test("checks against every earlier turn, not just the last", () => {
  const asked = ["What does Rithvik study?", SHIPPING, "What is Rithvik's GPA?"];
  assert.ok(isRedundant(SHIPPING, asked));
});

test("name and question scaffolding alone never make two questions redundant", () => {
  // Both are "What does Rithvik ..." about him — only stopwords in common.
  assert.ok(!isRedundant("What does Rithvik study?", ["What does Rithvik build?"]));
});

test("empty candidate is treated as redundant", () => {
  assert.ok(isRedundant("   ", ["anything"]));
});

test("nothing asked yet means nothing is redundant", () => {
  assert.ok(!isRedundant(SHIPPING, []));
});

test("questionSimilarity is 1 for identical and 0 for disjoint", () => {
  assert.equal(questionSimilarity(SHIPPING, SHIPPING), 1);
  assert.equal(questionSimilarity("What is his GPA?", "Which languages does he write?"), 0);
});

const payload = (arr: string[]) => frame({ t: "done" }) + frame({ t: "trailer", suggestions: arr, actions: [] });

test("plain answer with no frames passes through untouched", () => {
  const r = splitStream("Rithvik studies at Purdue.");
  assert.equal(r.answer, "Rithvik studies at Purdue.");
  assert.equal(r.suggestions, null);
  assert.equal(r.done, false);
});

test("splits answer from a complete trailer", () => {
  const r = splitStream("The answer." + payload(["One?", "Two?"]));
  assert.equal(r.answer, "The answer.");
  assert.deepEqual(r.suggestions, ["One?", "Two?"]);
  assert.equal(r.done, true);
});

test("withholds a partially-arrived frame so it never flashes", () => {
  const f = frame({ t: "search", q: "x", n: 3, top: [] });
  for (let i = 1; i < f.length; i++) {
    const r = splitStream("Answer" + f.slice(0, i));
    assert.equal(r.answer, "Answer", `leaked partial frame at ${i} chars`);
  }
});

test("malformed frame never corrupts the answer", () => {
  assert.equal(splitStream("Ans" + FRAME + "not json" + FRAME + "wer").answer, "Answer");
});

test("parseFrames keeps text runs and events in order (multi-step)", () => {
  const acc = frame({ t: "rewrite", q: "Q" }) + "Step one." + frame({ t: "tool", id: "1", name: "open_project", args: { slug: "boilerframe" } }) + "Step two.";
  const parts = parseFrames(acc);
  assert.deepEqual(parts.map((p) => (p.type === "text" ? p.text : p.event.t)), ["rewrite", "Step one.", "tool", "Step two."]);
});

test("chunk-by-chunk accumulation converges and parts stay index-stable", () => {
  const full = frame({ t: "sources", items: [{ n: 1, label: "BoilerFrame" }] }) + "Hello there." + payload(["A?", "B?", "C?"]);
  let acc = "";
  let prev: ReturnType<typeof parseFrames> = [];
  for (const ch of full) {
    acc += ch;
    const parts = parseFrames(acc);
    // Every earlier part except a growing text tail is unchanged.
    prev.slice(0, -1).forEach((p, i) => assert.deepEqual(parts[i], p));
    assert.ok("Hello there.".startsWith(splitStream(acc).answer));
    prev = parts;
  }
  assert.equal(splitStream(acc).answer, "Hello there.");
  assert.deepEqual(splitStream(acc).suggestions, ["A?", "B?", "C?"]);
});

test("empty suggestions array yields an empty list, not null", () => {
  assert.deepEqual(splitStream("Answer" + payload([])).suggestions, []);
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
