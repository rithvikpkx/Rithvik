import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../content/fixture.ts";
import { buildKG, kgLayout } from "./kg.ts";

const kg = buildKG(fixture);
const count = (t: string) => kg.nodes.filter((n) => n.type === t).length;

test("node counts follow the content", () => {
  assert.equal(count("me"), 1);
  assert.equal(count("project"), fixture.projects.length);
  assert.equal(count("role"), fixture.experience.length);
  assert.equal(count("place"), fixture.places.length);
  assert.equal(count("school"), 1);
  const tags = new Set([...fixture.projects, ...fixture.experience].flatMap((x) => x.tags).map((t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-")));
  assert.equal(count("skill"), tags.size);
  assert.equal(new Set(kg.nodes.map((n) => n.id)).size, kg.nodes.length);
});

test("every edge endpoint exists, no self loops or duplicates, every node is connected", () => {
  const seen = new Set<string>();
  for (const e of kg.edges) {
    assert.ok(kg.byId[e.a] && kg.byId[e.b], `${e.a} -> ${e.b}`);
    assert.notEqual(e.a, e.b);
    const key = [e.a, e.b].sort().join("|");
    assert.ok(!seen.has(key), key);
    seen.add(key);
  }
  assert.ok(kg.nodes.every((n) => n.deg > 0));
});

test("layout is deterministic and keeps every node inside the box", () => {
  for (const [w, h] of [[1100, 700], [390, 720]] as const) {
    const a = kgLayout(kg, w, h), b = kgLayout(kg, w, h);
    assert.deepEqual(a, b);
    assert.equal(Object.keys(a).length, kg.nodes.length);
    for (const [x, y] of Object.values(a)) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
      assert.ok(x >= 0 && x <= w && y >= 0 && y <= h, `${x},${y} outside ${w}x${h}`);
    }
  }
});

test("unknown slugs fall back to the project kind as their field", () => {
  const g = buildKG({ ...fixture, projects: [{ ...fixture.projects[0], slug: "new-thing", kind: "Robotics" }] }, { fields: {}, roleFields: {}, short: {} });
  assert.ok(g.byId["f-robotics"]);
  assert.ok(g.edges.some((e) => e.a === "f-robotics" && e.b === "p-new-thing"));
});
