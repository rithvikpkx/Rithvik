import { test } from "node:test";
import assert from "node:assert/strict";
import { checkProject, checkLinks, checkPlaces, checkFaq, checkNow, isHttpUrl } from "./validate.ts";

const proj = { slug: "a-b", title: "T", headline: "H", kind: "K", icon: "cpu", ctx: "", desc: ["x"], tags: [], links: [{ label: "GitHub", url: "https://x.dev" }], published: true };

test("valid project passes and is trimmed", () => {
  const r = checkProject({ ...proj, title: "  T  " });
  assert.ok(r.ok && r.value.title === "T");
});
test("project rejects bad slug, unknown icon, javascript: links, empty desc", () => {
  const r = checkProject({ ...proj, slug: "Bad Slug", icon: "nope", desc: [], links: [{ label: "x", url: "javascript:alert(1)" }] });
  assert.ok(!r.ok);
  if (!r.ok) assert.deepEqual(Object.keys(r.errors).sort(), ["desc", "icon", "links.0.url", "slug"]);
});
test("urls: http(s) only", () => {
  assert.ok(isHttpUrl("https://a.b") && !isHttpUrl("data:text/html,x") && !isHttpUrl("nope"));
  assert.ok(!checkLinks({ email: "a@b.co", github: "ftp://x", linkedin: "https://l.in" }).ok);
});
test("places/now validate IANA tz and coordinates", () => {
  assert.ok(!checkNow({ city: "X", tz: "Mars/Base", building: "", researching: "", learning: "" }).ok);
  assert.ok(!checkPlaces([{ key: "home", city: "B", tz: "America/New_York", lat: 91, lng: 0 }]).ok);
  assert.ok(checkPlaces([{ key: "home", city: "B", tz: "America/New_York", lat: 42, lng: -71 }]).ok);
});
test("non-array / wrong shapes fail without throwing", () => {
  assert.ok(!checkFaq("x").ok && !checkFaq([["only one"]]).ok && !checkProject(null).ok);
});
