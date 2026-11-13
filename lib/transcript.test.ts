import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildTranscriptMarkdown,
  transcriptFilename,
  formatTimestamp,
  type TranscriptMessage,
} from "./transcript.ts";

// 2026-08-14 15:32 local time, built from parts so the test doesn't depend on
// the machine's timezone.
const AT = new Date(2026, 7, 14, 15, 32, 0).getTime();

const welcome: TranscriptMessage = { role: "bot", content: "Hey! I'm RAG…" };

test("skips the welcome message", () => {
  const md = buildTranscriptMarkdown([welcome], AT);
  assert.ok(!md.includes("Hey! I'm RAG"));
  assert.ok(md.includes("_No messages in this conversation._"));
});

test("renders a user/bot exchange", () => {
  const md = buildTranscriptMarkdown(
    [welcome, { role: "user", content: "what does he use?" }, { role: "bot", content: "Next.js and Supabase." }],
    AT,
  );
  assert.ok(md.includes("**You:** what does he use?"));
  assert.ok(md.includes("**RAG:** Next.js and Supabase."));
});

test("includes suggestions for a bot turn", () => {
  const md = buildTranscriptMarkdown(
    [
      welcome,
      { role: "user", content: "q" },
      { role: "bot", content: "a", suggestions: ["How did he learn it?", "What's next?"] },
    ],
    AT,
  );
  assert.ok(md.includes('_Suggested follow-ups: "How did he learn it?" · "What\'s next?"_'));
});

test("omits the suggestions line when there are none", () => {
  const md = buildTranscriptMarkdown(
    [welcome, { role: "user", content: "q" }, { role: "bot", content: "a", suggestions: [] }],
    AT,
  );
  assert.ok(!md.includes("Suggested follow-ups"));
});

test("drops blank suggestion entries", () => {
  const md = buildTranscriptMarkdown(
    [welcome, { role: "user", content: "q" }, { role: "bot", content: "a", suggestions: ["  ", "real one"] }],
    AT,
  );
  assert.ok(md.includes('_Suggested follow-ups: "real one"_'));
  assert.ok(!md.includes('"  "'));
});

test("skips empty streaming placeholders", () => {
  const md = buildTranscriptMarkdown(
    [welcome, { role: "user", content: "q" }, { role: "bot", content: "" }],
    AT,
  );
  assert.ok(md.includes("**You:** q"));
  assert.ok(!md.includes("**RAG:**"));
});

test("labels notices so they don't read as answers", () => {
  const md = buildTranscriptMarkdown(
    [welcome, { role: "user", content: "q" }, { role: "bot", content: "Message limit reached.", isNotice: true }],
    AT,
  );
  assert.ok(md.includes("**RAG** _(notice)_**:** Message limit reached."));
});

test("never emits three consecutive newlines", () => {
  const md = buildTranscriptMarkdown(
    [
      welcome,
      { role: "user", content: "q1" },
      { role: "bot", content: "a1", suggestions: ["s1"] },
      { role: "user", content: "q2" },
      { role: "bot", content: "a2" },
    ],
    AT,
  );
  assert.ok(!/\n{3,}/.test(md));
});

test("ends with exactly one trailing newline", () => {
  const md = buildTranscriptMarkdown(
    [welcome, { role: "user", content: "q" }, { role: "bot", content: "a" }],
    AT,
  );
  assert.ok(md.endsWith("\n"));
  assert.ok(!md.endsWith("\n\n"));
});

test("skipFirst:false keeps the first message", () => {
  const md = buildTranscriptMarkdown([{ role: "bot", content: "kept" }], AT, { skipFirst: false });
  assert.ok(md.includes("**RAG:** kept"));
});

test("formatTimestamp handles missing and invalid input", () => {
  assert.equal(formatTimestamp(undefined), "");
  assert.equal(formatTimestamp(Number.NaN), "");
  assert.equal(formatTimestamp(AT), "2026-08-14 15:32");
});

test("transcriptFilename is filename-safe", () => {
  const name = transcriptFilename(AT);
  assert.equal(name, "rag-chat-2026-08-14-1532.md");
  assert.ok(!/[:\s/\\]/.test(name));
});
