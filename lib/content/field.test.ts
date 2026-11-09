import { test } from "node:test";
import assert from "node:assert/strict";
import { applyField, parseFieldKey, type FieldSource } from "./field.ts";
import { fixture as fx } from "./fixture.ts";

const src: FieldSource = {
  content: fx,
  projects: fx.projects.map((p, i) => ({ ...p, id: `p${i}`, links: Object.entries(p.links).map(([label, url]) => ({ label, url })), published: true })),
  experience: fx.experience.map((e, i) => ({ ...e, id: `e${i}`, published: true })),
  education: { id: "edu", school: fx.education.school, degree: fx.education.degree, focus: fx.education.focus, grad: fx.education.grad },
};
const apply = (key: string, v: unknown) => applyField(src, parseFieldKey(key)!, v);

test("parser accepts every documented key shape", () => {
  const slug = fx.projects[0].slug;
  const keys = ["v7.role", "v7.status", "v7.line", "v7.thesis.0", "v7.about.1", "v7.now.building", "faq.2.a", "faq.0.q", "numbers.1.v", "numbers.1.l",
    "name.first", "name.last", `project:${slug}:headline`, `project:${slug}:desc.0`, "role:a-b:org", "role:a-b:desc.3", "edu:grad"];
  for (const k of keys) assert.ok(parseFieldKey(k), k);
});

test("parser rejects unknown, malformed and hostile keys", () => {
  for (const k of ["", "v7.nope", "v7.about", "v7.about.01", "v7.about.-1", "v7.thesis.1.x", "faq.1", "faq.x.a", "project:Bad Slug:title", "project:a:desc", "project:a:title.0",
    "role:a:links", "edu:id", "v7.role\n", "../v7.role", "__proto__", "project:a:title:extra"]) assert.equal(parseFieldKey(k), null, k);
  assert.equal(parseFieldKey(42), null);
  assert.equal(parseFieldKey("v7.about." + "9".repeat(200)), null);
});

test("a profile field patches only itself and trims / flattens newlines", () => {
  const r = apply("v7.line", "  New line\n here  ");
  assert.ok(r.ok && r.op === "section" && r.section === "profile");
  if (r.ok && r.op === "section" && r.section === "profile") {
    assert.equal(r.input.line, "New line here");
    assert.deepEqual(r.input.about, fx.about);
    assert.equal(r.input.role, fx.role);
  }
});

test("list items replace by index and reject out-of-range", () => {
  const r = apply("v7.about.1", "Second paragraph");
  assert.ok(r.ok && r.op === "section" && r.section === "profile" && r.input.about[1] === "Second paragraph" && r.input.about[0] === fx.about[0]);
  assert.ok(!apply("v7.about.99", "x").ok);
  assert.ok(!apply("faq.99.a", "x").ok);
});

test("validators run: empty or over-long values fail with a message", () => {
  assert.deepEqual(apply("v7.role", "   "), { ok: false, error: "Required" });
  const long = apply("v7.status", "x".repeat(400));
  assert.ok(!long.ok && /Max 160/.test(long.error));
  assert.ok(!apply("v7.thesis.0", "x".repeat(61)).ok);
  assert.ok(!apply("v7.about.0", 5).ok);
});

test("pair lists patch the right half", () => {
  const q = apply("faq.0.q", "New question?");
  assert.ok(q.ok && q.op === "section" && q.section === "faq" && q.input[0][0] === "New question?" && q.input[0][1] === fx.faq[0][1]);
  const n = apply("numbers.0.l", "label");
  assert.ok(n.ok && n.op === "section" && n.section === "numbers" && n.input[0][0] === fx.numbers[0][0] && n.input[0][1] === "label");
});

test("project and role fields keep the rest of the record; unknown slug fails", () => {
  const slug = fx.projects[0].slug;
  const p = apply(`project:${slug}:headline`, "Fresh headline");
  assert.ok(p.ok && p.op === "project" && p.id === "p0" && p.input.headline === "Fresh headline" && p.input.slug === slug && p.input.desc.length === fx.projects[0].desc.length);
  const d = apply(`project:${slug}:desc.0`, "Bullet");
  assert.ok(d.ok && d.op === "project" && d.input.desc[0] === "Bullet");
  assert.ok(!apply(`project:${slug}:desc.50`, "x").ok);
  assert.ok(!apply(`project:${slug}:desc.0`, "").ok); // empty bullet is rejected, not dropped
  assert.ok(!apply("project:no-such:title", "x").ok);
  const r = apply(`role:${fx.experience[0].slug}:org`, "Acme");
  assert.ok(r.ok && r.op === "role" && r.input.org === "Acme" && r.input.role === fx.experience[0].role);
});

test("name and education", () => {
  assert.deepEqual(apply("name.first", " Ri "), { ok: true, op: "name", key: "hero.name.line1", value: "Ri" });
  assert.ok(!apply("name.last", "").ok && !apply("name.last", "x".repeat(41)).ok);
  const e = apply("edu:focus", "Math");
  assert.ok(e.ok && e.op === "edu" && e.id === "edu" && e.input.focus === "Math" && e.input.school === fx.education.school);
  assert.ok(apply("edu:grad", "").ok); // optional
});
