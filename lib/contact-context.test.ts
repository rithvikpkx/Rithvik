import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContextFooter, escapeHtml } from "./contact-context.ts";

const SID = "56c24cc2-a7cc-42fe-83fc-2199a6378ff0";
const base = { origin: "https://rithvik.ai/", geo: { city: "Boston", region: "MA", country: "US" }, at: new Date(Date.UTC(2026, 10, 9, 12, 0, 0)) };

test("an agent draft carries the transcript link (request origin, no double slash) and every fact", () => {
  const { html, text } = buildContextFooter({ ...base, agentSessionId: SID, pageUrl: "https://rithvik.ai/?theme=nimbus", design: "nimbus", userAgent: "Mozilla/5.0", referrer: "https://news.example/" });
  assert.ok(html.includes(`<a href="https://rithvik.ai/admin/chats/${SID}">`));
  assert.ok(text.includes(`Agent transcript: https://rithvik.ai/admin/chats/${SID}`));
  for (const s of ["RAG agent draft", "https://rithvik.ai/?theme=nimbus · design: nimbus", "Boston, MA, US", "Mozilla/5.0", "https://news.example/", "2026-11-09T12:00:00.000Z"]) assert.ok(text.includes(s), s);
});

test("a plain composer send has the same block minus the transcript link", () => {
  const { html, text } = buildContextFooter({ ...base, agentSessionId: null, pageUrl: "https://rithvik.ai/" });
  assert.ok(text.includes("Source: Contact composer"));
  assert.ok(!html.includes("/admin/chats/") && !text.includes("Agent transcript"));
});

test("a non-uuid session id is treated as no session (no link to a made-up path)", () => {
  const { text } = buildContextFooter({ ...base, agentSessionId: "../../etc/passwd" });
  assert.ok(!text.includes("Agent transcript") && !text.includes("passwd"));
});

test("everything visitor-controlled is escaped, never linked, and stripped of control characters", () => {
  const evil = `<script>alert(1)</script>"&'`;
  const { html } = buildContextFooter({ ...base, pageUrl: `javascript:${evil}`, design: evil, userAgent: evil + "\r\nBcc: x@y.z", referrer: evil, geo: { city: evil } });
  assert.ok(!html.includes("<script>") && !html.includes("\r") && !html.includes("\nBcc"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;&quot;&amp;&#39;"));
  assert.equal((html.match(/<a /g) ?? []).length, 0);
});

test("unknown facts are omitted; long strings are capped", () => {
  const { text } = buildContextFooter({ origin: "https://rithvik.ai", geo: {}, at: new Date(0), userAgent: "x".repeat(1000) });
  assert.ok(!text.includes("Visitor location") && !text.includes("Page:") && !text.includes("Referrer"));
  assert.ok(text.includes("Browser: " + "x".repeat(300)) && !text.includes("x".repeat(301)));
});

test("escapeHtml covers the five significant characters", () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
});
