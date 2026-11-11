import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTranscriptMarkdown, transcriptFilename, formatTimestamp, type TranscriptItem } from "./transcript.ts";

// 2026-08-14 15:32:07 local time, built from parts so the test doesn't depend on the machine's timezone.
const AT = new Date(2026, 7, 14, 15, 32, 7).getTime();
const banner: TranscriptItem = { kind: "banner" };

const full: TranscriptItem[] = [
  banner,
  { kind: "user", text: "what has he built?\nand where?", at: AT },
  { kind: "tool", name: "Rewrite", args: '"What has Rithvik built, and where?"', at: AT },
  { kind: "tool", name: "Search", args: 'site, "what has he built"', result: "3 records · BoilerFrame 0.81, Purdue 0.64", at: AT },
  { kind: "answer", text: "He built BoilerFrame [1].", at: AT },
  { kind: "sources", items: [{ n: 1, label: "BoilerFrame", anchor: "project-boilerframe" }], at: AT },
  { kind: "actions", buttons: [{ label: "↗ Open BoilerFrame", clicked: true }, { label: "Draft email", clicked: false }, { label: "Send meeting request", clicked: true }], detail: ["Name: Ada", "Times: Tue 10:00"], at: AT },
  { kind: "tool", name: "Calendar", args: "check_availability, 2026-08-18", result: "Free 10:00-11:00", at: AT },
  { kind: "suggest", chips: ["How did he learn it?", "  ", "What's next?"], at: AT },
  { kind: "note", text: "Interrupted", at: AT },
  { kind: "note", text: "Rate limited", tone: "warn", at: AT },
];
const md = buildTranscriptMarkdown(full, AT, { session: "abc-123", model: "gpt-x", design: "nimbus", tokens: 1234 });

test("header carries site, date, session, model, design, tokens", () => {
  for (const s of ["# Chat with RAG — rithvik.ai", "**Exported:** 2026-08-14 15:32", "**Session:** abc-123", "**Model:** gpt-x", "**Design:** nimbus", "**Tokens:** 1234", "**Prompts:** 1"]) assert.ok(md.includes(s), s);
});

test("includes the user message (line breaks kept), rewrite row and search row with scores", () => {
  assert.ok(md.includes("### You · 15:32:07"));
  assert.ok(md.includes("what has he built?  \nand where?"));
  assert.ok(md.includes('- **Rewrite**("What has Rithvik built, and where?")'));
  assert.ok(md.includes('- **Search**(site, "what has he built") — 3 records · BoilerFrame 0.81, Purdue 0.64'));
});

test("one RAG heading per reply, with answer and footnote sources", () => {
  assert.equal(md.match(/### RAG/g)?.length, 1);
  assert.ok(md.includes("He built BoilerFrame [1]."));
  assert.ok(md.includes("_Sources_\n\n- [1] BoilerFrame"));
});

test("offered actions list each button and whether it was clicked, with the send details", () => {
  assert.ok(md.includes("_Offered actions_\n\n- ↗ Open BoilerFrame — **clicked**\n- Draft email — not clicked\n- Send meeting request — **clicked**\n  - Name: Ada\n  - Times: Tue 10:00"));
});

test("calendar tool result, suggestions (blanks dropped) and notes", () => {
  assert.ok(md.includes("- **Calendar**(check_availability, 2026-08-18) — Free 10:00-11:00"));
  assert.ok(md.includes('_Suggested follow-ups: "How did he learn it?" · "What\'s next?"_'));
  assert.ok(md.includes("> **Note:** Interrupted"));
  assert.ok(md.includes("> **Notice:** Rate limited"));
});

test("chrome and empty placeholders are skipped; an empty chat says so", () => {
  const m = buildTranscriptMarkdown([banner, { kind: "help" }, { kind: "user", text: "q" }, { kind: "answer", text: "" }], AT);
  assert.ok(m.includes("### You") && !m.includes("### RAG"));
  const e = buildTranscriptMarkdown([banner], AT);
  assert.ok(e.includes("_No messages in this conversation._") && !e.includes("**Prompts:**"));
});

test("a second question starts a second RAG block; no triple newlines; one trailing newline", () => {
  const m = buildTranscriptMarkdown([{ kind: "user", text: "a" }, { kind: "answer", text: "x" }, { kind: "user", text: "b" }, { kind: "answer", text: "y" }], AT);
  assert.equal(m.match(/### RAG/g)?.length, 2);
  assert.ok(!/\n{3,}/.test(m) && m.endsWith("\n") && !m.endsWith("\n\n"));
});

test("unknown header facts are omitted and rows without a time have no stamp", () => {
  const m = buildTranscriptMarkdown([{ kind: "user", text: "q" }], AT);
  assert.ok(!m.includes("**Session:**") && !m.includes("**Model:**") && !m.includes("**Tokens:**"));
  assert.ok(m.includes("### You\n"));
});

test("a tool row's detail lines (the /usage row) become sub-bullets", () => {
  const m = buildTranscriptMarkdown([{ kind: "user", text: "/usage" }, { kind: "tool", name: "Usage", args: "", result: "This visitor", lines: [["Rate limit", "19/60 used"], ["Model", "gpt-x"]] }], AT);
  assert.ok(m.includes("- **Usage**() — This visitor\n  - Rate limit: 19/60 used\n  - Model: gpt-x"));
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
