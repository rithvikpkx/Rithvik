import { test } from "node:test";
import assert from "node:assert/strict";
import { toContent } from "./map.ts";
import { fixture } from "./fixture.ts";

const empty = { projects: [], experience: [], education: [], site: {} };

test("empty DB falls back to the fixture field by field", () => {
  const c = toContent(empty);
  assert.deepEqual(c.projects, fixture.projects);
  assert.deepEqual(c.faq, fixture.faq);
  assert.equal(c.name, fixture.name);
  assert.equal(c.initials, "RPK");
});

test("old-schema rows (no v7 columns) map with fixture fallback and label links", () => {
  const c = toContent({ ...empty, projects: [
    { slug: "qrify", title: "QRIfy", badge: "WebApp", description: "a\n\nb ", tags: ["Python"], links: { github: "https://g" } },
    { slug: "newone", title: "New", badge: "ML", description: "x", tags: [], links: {} },
  ] });
  const q = c.projects.find((p) => p.slug === "qrify")!;
  assert.deepEqual(q.desc, ["a", "b"]);
  assert.deepEqual(q.links, { GitHub: "https://g" });
  assert.equal(q.headline, fixture.projects.find((p) => p.slug === "qrify")!.headline);
  assert.equal(c.projects.find((p) => p.slug === "newone")!.kind, "ML"); // badge as last resort
});

test("site_content JSON, mailto strip, and bad JSON fallback", () => {
  const c = toContent({ ...empty, site: { "v7.thesis": '["a","b"]', "v7.faq": "not json", "v7.now": '{"city":"X"}', "contact.link.email": "mailto:a@b.c" } });
  assert.deepEqual(c.thesis, ["a", "b"]);
  assert.deepEqual(c.faq, fixture.faq);
  assert.equal(c.now.city, "X");
  assert.equal(c.now.building, fixture.now.building);
  assert.equal(c.links.email, "a@b.c");
});

test("projects order by v7_order; education logo basename", () => {
  const c = toContent({ ...empty, projects: [{ slug: "b", v7_order: 1 }, { slug: "a", v7_order: 0 }], education: [{ logo_path: "/images/purdue.png", concentrations: ["X", "Y"] }] });
  assert.deepEqual(c.projects.map((p) => p.slug), ["a", "b"]);
  assert.equal(c.education.logo, "purdue.png");
  assert.equal(c.education.focus, "X · Y");
});
