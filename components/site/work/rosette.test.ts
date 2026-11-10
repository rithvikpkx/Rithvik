import { test } from "node:test";
import assert from "node:assert/strict";
import { facetAt, rotationFor, wedgeClip } from "./rosette.ts";

test("rotationFor takes the short way round and lands on the facet", () => {
  assert.equal(rotationFor(1, 6, 0), -60);
  assert.equal(rotationFor(5, 6, 0), 60); // facet 5 sits at 300°, so +60 is shorter than -300
  assert.equal(rotationFor(0, 6, 350), 360);
  for (let i = 0; i < 7; i++) assert.equal(facetAt(rotationFor(i, 7, 1234), 7), i);
});

test("facetAt snaps to the nearest detent", () => {
  assert.equal(facetAt(-29, 6), 0);
  assert.equal(facetAt(-31, 6), 1);
  assert.equal(facetAt(31, 6), 5);
});

test("wedgeClip is a closed polygon in percent", () => {
  const c = wedgeClip(0, 6, 0.3);
  assert.match(c, /^polygon\(/);
  assert.doesNotMatch(c, /NaN/);
  assert.match(wedgeClip(2, 4, 0), /50% 50%\)$/);
});
