import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMeetingEmail, esc, validateMeeting } from "./meeting.ts";

const ok = { name: "Ada", email: "ada@acme.example", times: ["Tue 3pm"], sessionId: "123e4567-e89b-12d3-a456-426614174000" };

test("valid input passes and optional fields become null", () => {
  const r = validateMeeting(ok);
  assert.ok(r.ok);
  assert.equal(r.ok && r.value.company, null);
  assert.equal(r.ok && r.value.timeZone, null);
});

test("rejects bad email, empty name, bad times, bad zone, bad session", () => {
  assert.equal(validateMeeting({ ...ok, email: "nope" }).ok, false);
  assert.equal(validateMeeting({ ...ok, email: "a@b.co\nBcc: x@y.z" }).ok, false);
  assert.equal(validateMeeting({ ...ok, name: "  " }).ok, false);
  assert.equal(validateMeeting({ ...ok, times: [] }).ok, false);
  assert.equal(validateMeeting({ ...ok, times: Array(6).fill("x") }).ok, false);
  assert.equal(validateMeeting({ ...ok, times: [" "] }).ok, false);
  assert.equal(validateMeeting({ ...ok, timeZone: "Mars/Base" }).ok, false);
  assert.equal(validateMeeting({ ...ok, timeZone: "America/New_York" }).ok, true);
  assert.equal(validateMeeting({ ...ok, sessionId: "x" }).ok, false);
});

test("newlines in name and company cannot reach the subject", () => {
  const r = validateMeeting({ ...ok, name: "Ada\r\nBcc: evil@x.y", company: "Ac\nme" });
  assert.ok(r.ok);
  const { subject } = buildMeetingEmail(r.value, "https://x/y");
  assert.ok(!/[\r\n]/.test(subject));
  assert.equal(subject, "Interview request: Ada Bcc: evil@x.y (Ac me)");
});

test("email html escapes every visitor value", () => {
  const r = validateMeeting({ ...ok, name: "<b>A</b>", company: "A&B", times: ["<script>x</script>"], timeZone: "UTC", notes: "a\n<img src=x onerror=1>" });
  assert.ok(r.ok);
  const { html, text } = buildMeetingEmail(r.value, "https://rithvik.ai/admin/chats/1");
  assert.ok(!html.includes("<script>") && !html.includes("<img") && !html.includes("<b>A"));
  assert.ok(html.includes("&lt;script&gt;") && html.includes("A&amp;B") && html.includes("<br>"));
  assert.ok(html.includes("Proposed times (UTC)"));
  assert.ok(text.includes("/admin/chats/1"));
});

test("esc handles all five characters", () => {
  assert.equal(esc(`<>"'&`), "&lt;&gt;&quot;&#39;&amp;");
});
