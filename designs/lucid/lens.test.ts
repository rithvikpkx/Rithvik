import { test } from "node:test";
import assert from "node:assert/strict";
import { bezel, lensFilter, lensKey, lensMap, lensPrimitives, radiusPx, strength } from "./lens.ts";

test("same-sized elements share one lens; different sizes do not", () => {
  const a = lensKey({ w: 84, h: 84, r: 42, scale: -40 }), b = lensKey({ w: 85.4, h: 83.2, r: 42, scale: -40 });
  assert.equal(a, b);
  assert.notEqual(a, lensKey({ w: 120, h: 84, r: 42, scale: -40 }));
  assert.notEqual(a, lensKey({ w: 84, h: 84, r: 42, scale: -60 }));
});

test("the map is a data URI sized to the element with a neutral grey core", () => {
  const svg = decodeURIComponent(lensMap(200, 60, 999).slice("data:image/svg+xml,".length));
  assert.match(svg, /width="200" height="60"/);
  assert.match(svg, /rx="30"/); // radius clamped to a pill
  assert.match(svg, /fill="#808080"/);
  assert.ok(!svg.includes("NaN"));
});

test("dispersion reads the map once per colour channel and screens them back", () => {
  const p = lensPrimitives({ w: 100, h: 40, r: 20, scale: -30, split: 4 });
  assert.equal(p.match(/feDisplacementMap/g)?.length, 3);
  assert.match(p, /scale="-30"/);
  assert.match(p, /scale="-38"/); // strength grows away from zero
  assert.equal(lensPrimitives({ w: 100, h: 40, r: 20, scale: -30 }).match(/feDisplacementMap/g)?.length, 1);
});

test("the filter is in user space, sized to the box", () => {
  const f = lensFilter("lg-1", { w: 300.4, h: 64, r: 32, scale: -30, frost: 1 });
  assert.match(f, /^<filter id="lg-1" x="0" y="0" width="300" height="64" filterUnits="userSpaceOnUse"/);
  assert.match(f, /feGaussianBlur in="SourceGraphic"/);
});

test("bezel, strength and radius stay in range", () => {
  assert.equal(bezel(10, 10), 4);
  assert.equal(bezel(1000, 400), 28);
  assert.ok(strength(84, 84) < 0 && strength(2000, 2000) === -70 && strength(10, 10) === -14);
  assert.equal(radiusPx("50%", 80, 60), 30);
  assert.equal(radiusPx("999px", 300, 64), 32);
  assert.equal(radiusPx("12px 4px", 300, 64), 12);
  assert.equal(radiusPx("", 30, 30), 0);
});
