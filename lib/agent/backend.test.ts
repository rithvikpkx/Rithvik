import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../content/fixture.ts";
import { renderProfile, scrubPrivate } from "./profile.ts";
import { contextPrompt, nearestLandmark, sanitizeContext } from "./context.ts";
import { cleanRewrite, rewriteMessages } from "./rewrite.ts";
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

test("tools: screenCalls caps side effects per step and answers every call", () => {
  const calls = [call("open_project", { slug: "qrify" }, "a"), call("open_resume", {}, "b"), call("start_game", { id: "typeracer" }, "c"), call("local_time", { place: "Boston" }, "d"), call("nope", {}, "e")];
  const { kept, replies } = screenCalls(calls, A);
  assert.deepEqual(kept.map((k) => k.id), ["a", "b", "d"]);
  assert.equal(replies.length, 5);
  assert.match(replies.find((r) => r.id === "e")!.content, /Rejected/);
});

test("tools: definitions carry enums from content", () => {
  const defs = toolDefs(A);
  const op = defs.find((d) => d.function.name === "open_project")!;
  assert.deepEqual((op.function.parameters as { properties: { slug: { enum: string[] } } }).properties.slug.enum, ["boilerframe", "qrify"]);
  assert.equal(defs.length, 7);
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

test("rewrite: cleans labels and quotes, falls back when empty", () => {
  assert.equal(cleanRewrite('Standalone question: "What stack did BoilerFrame use?"\n', "x"), "What stack did BoilerFrame use?");
  assert.equal(cleanRewrite("  \n ", "orig"), "orig");
  const m = rewriteMessages([{ role: "user", content: "tell me about boilerframe" }], "what stack?");
  assert.equal(m.length, 2);
  assert.match((m[1] as { content: string }).content, /Visitor: tell me about boilerframe[\s\S]*Latest message: what stack\?/);
});
