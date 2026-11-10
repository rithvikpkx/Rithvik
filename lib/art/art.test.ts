import { test } from "node:test";
import assert from "node:assert/strict";
import { artToSvg, projectArt, traits, type Palette } from "./art.ts";
import { fixture as FIXTURE } from "../content/fixture.ts";

const PAL: Palette = ["#000", "#fff", "#f60", "#08f"];

test("each fixture project reads as what it is", () => {
  const g = Object.fromEntries(FIXTURE.projects.map((p) => [p.slug, projectArt(p, PAL).grammar]));
  assert.equal(g["mind-controlled-arm"], "circuit");
  assert.equal(g["eeg-thought-prediction"], "signal");
  assert.equal(g["boilerframe"], "cells");
  assert.equal(g["qrify"], "blocks");
  assert.equal(g["citizen-happiness"], "strata");
  assert.equal(g["habitat-humanity-ecomm"], "orbit");
});

test("deterministic per slug, and the slug changes the picture", () => {
  const p = FIXTURE.projects[0];
  assert.equal(artToSvg(projectArt(p, PAL)), artToSvg(projectArt(p, PAL)));
  assert.notEqual(artToSvg(projectArt(p, PAL)), artToSvg(projectArt({ ...p, slug: "other" }, PAL)));
});

test("stays cheap and well-formed for every project and density", () => {
  for (const p of FIXTURE.projects) for (const density of [0.5, 1, 1.6]) {
    const a = projectArt(p, PAL, { density }, 0.5);
    assert.ok(a.nodes.length < 420, `${p.slug} @${density}: ${a.nodes.length} nodes`);
    assert.doesNotMatch(artToSvg(a), /NaN|undefined|Infinity/);
  }
});

test("an unknown project still gets art, and links shape the frame", () => {
  const bare = { slug: "x", title: "Zzz", headline: "", kind: "", tags: [], links: {} };
  const a = projectArt(bare, PAL);
  assert.ok(a.nodes.length > 5);
  assert.equal(a.traits.primary, null);
  const t = traits({ ...bare, links: { GitHub: "https://github.com/a/b", Demo: "https://youtu.be/x" } });
  assert.equal(t.code && t.demo, true);
});
