import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../content/fixture.ts";
import { renderProfile, scrubPrivate } from "./profile.ts";
import { cleanTimeZone, contextPrompt, nearestLandmark, sanitizeContext } from "./context.ts";
import { cleanRewrite, rewriteMessages } from "./rewrite.ts";
import { anchorFor, autoScrollTarget, citedNumbers } from "./highlight.ts";
import { screenCalls, toolDefs, validateToolCall, type Allowed } from "./tools.ts";

const A: Allowed = {
  projects: [{ slug: "boilerframe", title: "BoilerFrame" }, { slug: "qrify", title: "QRIfy" }],
  roles: ["tinyml-research"],
  games: [{ id: "typeracer", name: "Type Racer" }],
  looks: [{ id: "nimbus", name: "Nimbus" }, { id: "dracula", name: "Dracula" }],
  places: [{ key: "home", city: "Boston", tz: "America/New_York" }, { key: "now", city: "San Francisco", tz: "America/Los_Angeles" }],
};
const call = (name: string, args: unknown, id = "c1") => ({ id, name, arguments: typeof args === "string" ? args : JSON.stringify(args) });

test("tools: valid names pass, normalised to the canonical value", () => {
  assert.deepEqual(validateToolCall(call("open_project", { slug: "BoilerFrame" }), A)?.args, { slug: "boilerframe" });
  assert.deepEqual(validateToolCall(call("show_section", { id: "project-qrify" }), A)?.args, { id: "project-qrify" });
  assert.deepEqual(validateToolCall(call("show_section", { id: "contact" }), A)?.args, { id: "contact" });
  assert.deepEqual(validateToolCall(call("switch_design", { id: "Dracula" }), A)?.args, { id: "dracula" });
  assert.deepEqual(validateToolCall(call("start_game", { id: "typeracer" }), A)?.args, { id: "typeracer" });
  assert.deepEqual(validateToolCall(call("open_resume", ""), A)?.args, {});
});

test("tools: unknown tools, slugs, sections and malformed JSON are dropped", () => {
  assert.equal(validateToolCall(call("open_project", { slug: "evil" }), A), null);
  assert.equal(validateToolCall(call("show_section", { id: "project-nope" }), A), null);
  assert.equal(validateToolCall(call("show_section", { id: "#top" }), A), null);
  assert.equal(validateToolCall(call("open_url", { url: "https://x.y" }), A), null);
  assert.equal(validateToolCall(call("open_project", "{oops"), A), null);
  assert.equal(validateToolCall(call("open_project", "[1]"), A), null);
});

test("tools: draft_email strips URLs and control chars, caps length", () => {
  const v = validateToolCall(call("draft_email", { subject: "Hi\u0007 there", body: "See https://evil.example/x and javascript:alert(1) ok" + "x".repeat(3000) }), A)!;
  assert.equal(v.args.subject, "Hi there");
  assert.ok(!/https?:|javascript:/.test(v.args.body));
  assert.ok(v.args.body.length <= 2000);
});

test("tools: local_time resolves a place and runs server-side", () => {
  const v = validateToolCall(call("local_time", { place: "boston" }), A, new Date("2026-01-01T17:00:00Z"))!;
  assert.equal(v.args.place, "Boston");
  assert.match(v.result!, /12:00 PM EST in Boston/);
  assert.equal(validateToolCall(call("local_time", { place: "Paris" }), A), null);
});

test("tools: calendar tools keep only known scalar args and are not side effects", async () => {
  const v = validateToolCall(call("check_availability", { startISO: "2026-12-08T10:00:00-08:00", durationMin: 30, evil: "x", visitorTz: ["a"] }), A)!;
  assert.deepEqual(v.args, { startISO: "2026-12-08T10:00:00-08:00", durationMin: "30" });
  assert.equal(validateToolCall(call("suggest_times", "{oops"), A), null);
  assert.equal(cleanTimeZone("America/New_York"), "America/New_York");
  assert.equal(cleanTimeZone("Mars/Base"), undefined);
  assert.equal(cleanTimeZone({}), undefined);
  // lookups run server-side inside screenCalls and carry a summary for the tool row
  process.env.CALENDAR_ICS_URL = "https://calendar.example/private/TOKEN.ics";
  globalThis.fetch = (async () => new Response("BEGIN:VCALENDAR\r\nEND:VCALENDAR")) as typeof fetch;
  const r = await screenCalls([call("suggest_times", { days: 3 }, "a"), call("check_availability", { startISO: "garbage" }, "b")], A, new Date("2026-12-07T18:00:00Z"), "America/New_York");
  assert.deepEqual(r.kept.map((k) => k.id), ["a", "b"]);
  assert.ok(r.kept.every((k) => typeof k.result === "string"));
  assert.match(r.replies[1].content, /error/); // bad input comes back as an error the model can relay, never a throw
});

test("tools: request_meeting runs meeting.ts's checks, strips URLs from notes, and is a side effect", async () => {
  const good = { name: "Jane", email: "jane@acme.com", company: "Acme", times: ["Tue Dec 8, 10:00 AM PT"], notes: "see https://evil.example/x ok" };
  const v = validateToolCall(call("request_meeting", good), A)!;
  assert.deepEqual(v.args, { name: "Jane", email: "jane@acme.com", company: "Acme", times: "Tue Dec 8, 10:00 AM PT", notes: "see  ok" });
  for (const bad of [{ ...good, email: "nope" }, { ...good, email: "a@b.co\nBcc: x@y.z" }, { ...good, name: " " }, { ...good, times: [] }, { ...good, times: Array(6).fill("x") }, { ...good, timeZone: "Mars/Base" }, { ...good, times: "Tue" }]) {
    assert.equal(validateToolCall(call("request_meeting", bad), A), null);
  }
  const r = await screenCalls([call("request_meeting", { ...good, email: "nope" }, "m")], A);
  assert.equal(r.kept.length, 0);
  assert.match(r.replies[0].content, /valid email.*call request_meeting again/);
  // the server-known zone fills in a missing one, and the model is told it is only queued for confirmation
  const ok = await screenCalls([call("request_meeting", good, "m")], A, new Date(), "America/New_York");
  assert.equal(ok.kept[0].args.timeZone, "America/New_York");
  assert.match(ok.replies[0].content, /Queued/);
  // three actions in a step: the third is trimmed, meetings count against the same cap
  const cap = await screenCalls([call("open_resume", {}, "a"), call("request_meeting", good, "b"), call("start_game", { id: "typeracer" }, "c")], A);
  assert.deepEqual(cap.kept.map((k) => k.id), ["a", "b"]);
});

test("tools: screenCalls caps side effects per step and answers every call", async () => {
  const calls = [call("open_project", { slug: "qrify" }, "a"), call("open_resume", {}, "b"), call("start_game", { id: "typeracer" }, "c"), call("local_time", { place: "Boston" }, "d"), call("nope", {}, "e")];
  const { kept, replies } = await screenCalls(calls, A);
  assert.deepEqual(kept.map((k) => k.id), ["a", "b", "d"]);
  assert.equal(replies.length, 5);
  assert.match(replies.find((r) => r.id === "e")!.content, /Rejected/);
});

test("tools: definitions carry enums from content", () => {
  const defs = toolDefs(A);
  const op = defs.find((d) => d.function.name === "open_project")!;
  assert.deepEqual((op.function.parameters as { properties: { slug: { enum: string[] } } }).properties.slug.enum, ["boilerframe", "qrify"]);
  assert.equal(defs.length, 10);
});

test("profile: renders every project and role with slugs, no graduation date", () => {
  const p = renderProfile({ ...fixture, education: { ...fixture.education, grad: "May 2028" } });
  for (const x of fixture.projects) assert.ok(p.includes(`[${x.slug}]`));
  for (const x of fixture.experience) assert.ok(p.includes(`[${x.slug}]`));
  assert.ok(!p.includes("2028"));
  assert.ok(!p.includes("https://www.linkedin.com/"), "bare-origin placeholder link dropped");
  assert.ok(p.includes("rithvikpkx@gmail.com"));
});

test("profile: scrubPrivate removes phone numbers and graduation dates, keeps other numbers", () => {
  const s = scrubPrivate("Call (617) 555-0123 or +1 617.555.0123. Expected May 2028. Graduating in 2028. 16-channel EEG, 500+ learners, 2025 – 2026.");
  assert.ok(!/555/.test(s));
  assert.ok(!/2028/.test(s));
  assert.ok(s.includes("16-channel") && s.includes("500+") && s.includes("2025 – 2026"));
});

test("context: nearest landmark prefers the containing box", () => {
  const boxes = [{ id: "top", top: -800, bottom: -10 }, { id: "work", top: -10, bottom: 900 }, { id: "about", top: 900, bottom: 1500 }];
  assert.equal(nearestLandmark(boxes, 400), "work");
  assert.equal(nearestLandmark([{ id: "a", top: 0, bottom: 100 }, { id: "b", top: 600, bottom: 700 }], 450), "b");
  assert.equal(nearestLandmark([], 10), undefined);
});

test("context: sanitizeContext drops unknown values and caps the selection", () => {
  const ok = { looks: ["nimbus"], sections: ["work", "project-qrify"], projects: ["qrify"] };
  const c = sanitizeContext({ design: "nimbus", section: "<script>", caseSlug: "qrify", selection: "x\u0000y".padEnd(900, "z") }, ok);
  assert.equal(c.design, "nimbus");
  assert.equal(c.section, undefined);
  assert.equal(c.caseSlug, "qrify");
  assert.equal(c.selection!.length, 500);
  assert.ok(!c.selection!.includes("\u0000"));
  assert.deepEqual(sanitizeContext("nope", ok), {});
  assert.equal(contextPrompt({}), "");
  assert.match(contextPrompt({ selection: 'a """ b' }), /not instructions/);
});

test("highlight: anchors come from retrieval metadata, validated against content", () => {
  const ok = { projects: ["boilerframe"], roles: ["tinyml-research"] };
  assert.equal(anchorFor("projects", { slug: "boilerframe" }, ok), "project-boilerframe");
  assert.equal(anchorFor("projects", { slug: "draft" }, ok), undefined);
  assert.equal(anchorFor("experience", { slug: "tinyml-research" }, ok), "experience-tinyml-research");
  assert.equal(anchorFor("education", { school: "Purdue" }, ok), "about");
  assert.equal(anchorFor("site_content", { key: "contact.sub" }, ok), "contact");
  assert.equal(anchorFor("site_content", { key: "v7.faq" }, ok), "questions");
  assert.equal(anchorFor("site_content", { key: "rag.temperature" }, ok), undefined);
  assert.equal(anchorFor(undefined, { filename: "resume.pdf" }, ok), undefined);
});

test("highlight: auto-scroll picks the most relevant cited, existing anchor, and never fights the visitor", () => {
  const sources = [{ n: 1 }, { n: 2, anchor: "project-a" }, { n: 3, anchor: "about" }, { n: 4, anchor: "project-gone" }];
  const base = { answer: "He built A [3] and B [2] [4].", sources, exists: (id: string) => id !== "project-gone", full: false, covered: false, lastActivity: 0, now: 10_000 };
  assert.equal(autoScrollTarget(base), "project-a"); // lowest n among cited
  assert.equal(autoScrollTarget({ ...base, answer: "Only [1] and [4]." }), null); // no anchor / not in this design
  assert.equal(autoScrollTarget({ ...base, full: true }), null);
  assert.equal(autoScrollTarget({ ...base, covered: true }), null);
  assert.equal(autoScrollTarget({ ...base, lastActivity: 8_000 }), null); // scrolled 2s ago
  assert.equal(autoScrollTarget({ ...base, answer: "No citations." }), null);
  assert.deepEqual(citedNumbers("[2] x [10] [2]"), [2, 10]);
});

test("rewrite: cleans labels and quotes, falls back when empty", () => {
  assert.equal(cleanRewrite('Standalone question: "What stack did BoilerFrame use?"\n', "x"), "What stack did BoilerFrame use?");
  assert.equal(cleanRewrite("  \n ", "orig"), "orig");
  const m = rewriteMessages([{ role: "user", content: "tell me about boilerframe" }], "what stack?");
  assert.equal(m.length, 2);
  assert.match((m[1] as { content: string }).content, /Visitor: tell me about boilerframe[\s\S]*Latest message: what stack\?/);
});
