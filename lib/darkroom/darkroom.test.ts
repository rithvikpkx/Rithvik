import test from "node:test";
import assert from "node:assert/strict";
import { makeAtlas } from "./atlas.ts";
import { Cache, runStack } from "./engine.ts";
import { type Frame, newFrame } from "./frame.ts";
import { POSITIONS, neighbours, search } from "./layout.ts";
import { BY_ID, EFFECTS, defaults, randomParams, stepFor } from "./registry.ts";

/** A synthetic portrait: a shaded disc with a coloured ramp behind it, enough tone and colour for every effect to act on. */
function sample(n = 160): Frame {
  const f = newFrame(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const o = (y * n + x) * 4, d = Math.hypot(x - n / 2, y - n / 2) / (n / 2), disc = d < 0.7 ? 1 - d * 0.8 : 0;
    f.data[o] = 40 + (x / n) * 160 + disc * 60; f.data[o + 1] = 60 + (y / n) * 120 + disc * 90; f.data[o + 2] = 200 - (x / n) * 120 + disc * 30; f.data[o + 3] = 255;
  }
  return f;
}
const SRC = sample();
const diff = (a: Frame, b: Frame) => { let s = 0; for (let i = 0; i < a.data.length; i++) s += Math.abs(a.data[i] - b.data[i]); return s / a.data.length; };

test("catalogue: enough effects, unique ids, sane metadata", () => {
  assert.ok(EFFECTS.length >= 25 && EFFECTS.length <= 32, `${EFFECTS.length} effects`);
  assert.equal(new Set(EFFECTS.map((e) => e.id)).size, EFFECTS.length);
  for (const e of EFFECTS) {
    assert.ok(e.name && e.desc.length > 20 && e.tags.length >= 3, e.id);
    assert.ok(e.params.length >= 1 && e.params.length <= 3, e.id);
    for (const p of e.params) {
      assert.ok(p.def >= p.min && p.def <= p.max, `${e.id}.${p.key} default in range`);
      if (p.options) assert.equal(p.options.length, p.max - p.min + 1, `${e.id}.${p.key} options`);
    }
  }
});

for (const e of EFFECTS) {
  test(`effect ${e.id}: same size, opaque, changes the picture, deterministic`, () => {
    const a = e.apply(SRC, defaults(e), { k: SRC.w / 512, t: 0.5, atlas: makeAtlas });
    assert.equal(a.w, SRC.w); assert.equal(a.h, SRC.h);
    for (let i = 3; i < a.data.length; i += 4) assert.equal(a.data[i], 255);
    assert.ok(diff(a, SRC) > 0.3, `${e.id} left the picture alone (${diff(a, SRC)})`);
    const b = e.apply(SRC, defaults(e), { k: SRC.w / 512, t: 0.5, atlas: makeAtlas });
    assert.equal(diff(a, b), 0);
    if (e.animated) assert.ok(diff(a, e.apply(SRC, defaults(e), { k: SRC.w / 512, t: 3.1, atlas: makeAtlas })) > 0.01, `${e.id} should animate`);
  });
}

test("random params stay inside every range and snap options to integers", () => {
  let s = 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (const e of EFFECTS) for (let i = 0; i < 20; i++) {
    const p = randomParams(e, rnd);
    for (const q of e.params) { assert.ok(p[q.key] >= q.min && p[q.key] <= q.max, `${e.id}.${q.key}`); if (q.options) assert.equal(p[q.key] % 1, 0); }
  }
});

test("stack: order matters, intensity 0 is a no-op, repeats hit the cache", () => {
  const cache = new Cache(40), o = { t: 0, atlas: makeAtlas, cache };
  const a = [stepFor("threshold"), stepFor("posterize")], b = [stepFor("posterize"), stepFor("threshold")];
  assert.ok(diff(runStack(SRC, a, o), runStack(SRC, b, o)) > 0.5);
  const one = runStack(SRC, [stepFor("emboss")], o), two = runStack(SRC, [stepFor("emboss")], o);
  assert.equal(one, two, "second run is the cached frame");
  const zero = runStack(SRC, [{ ...stepFor("blockify"), intensity: 0 }], o);
  assert.equal(diff(zero, SRC), 0);
  const half = runStack(SRC, [{ ...stepFor("blockify"), intensity: 0.5 }], o), full = runStack(SRC, [stepFor("blockify")], o);
  assert.ok(diff(half, SRC) > 0 && diff(half, SRC) < diff(full, SRC));
  assert.equal(runStack(SRC, [{ id: "nope", intensity: 1, params: {} }], o), SRC, "unknown ids are skipped");
});

test("stack: cache is bounded and animated steps are not cached", () => {
  const cache = new Cache(4);
  for (let i = 0; i < 10; i++) runStack(SRC, [{ ...stepFor("posterize"), params: { levels: 2 + (i % 7), sat: 1 + i / 20 } }], { t: 0, atlas: makeAtlas, cache });
  assert.ok(cache.size <= 4);
  const c2 = new Cache(10);
  runStack(SRC, [stepFor("vhs"), stepFor("posterize")], { t: 1, atlas: makeAtlas, cache: c2 });
  assert.equal(c2.size, 0);
});

test("constellation: deterministic, inside the frame, no two dots touching, clusters by family", () => {
  assert.equal(POSITIONS.length, EFFECTS.length);
  for (const p of POSITIONS) assert.ok(p.x >= 0.05 && p.x <= 0.95 && p.y >= 0.05 && p.y <= 0.95, p.id);
  let min = Infinity;
  for (let i = 0; i < POSITIONS.length; i++) for (let j = i + 1; j < POSITIONS.length; j++) min = Math.min(min, Math.hypot(POSITIONS[i].x - POSITIONS[j].x, POSITIONS[i].y - POSITIONS[j].y));
  assert.ok(min > 0.05, `closest pair ${min}`);
  // a dot sits closer, on average, to its own family than to the others
  const fam = (id: string) => BY_ID.get(id)!.family;
  const d = (a: typeof POSITIONS[0], b: typeof POSITIONS[0]) => Math.hypot(a.x - b.x, a.y - b.y);
  let own = 0, other = 0, no = 0, nx = 0;
  for (const a of POSITIONS) for (const b of POSITIONS) if (a !== b) { if (fam(a.id) === fam(b.id)) { own += d(a, b); no++; } else { other += d(a, b); nx++; } }
  assert.ok(own / no < other / nx * 0.85, "families cluster");
});

test("neighbours are alike (same family wins) and search ranks name over tags over descriptions", () => {
  const n = neighbours("floyd", 3).map((e) => e.id);
  assert.ok(n.includes("atkinson") && !n.includes("floyd"));
  assert.equal(neighbours("halftone", 4).length, 4);
  const r = search("dither");
  assert.ok(!r.has("kuwahara"));
  assert.equal([...search("halftone")].sort((a, b) => b[1] - a[1])[0][0], "halftone");
  assert.ok(search("retro terminal").has("ascii"));
  assert.equal(search("").size, EFFECTS.length);
  assert.equal(search("zzzzqqq").size, 0);
});
