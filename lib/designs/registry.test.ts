import { test } from "node:test";
import assert from "node:assert/strict";
import { BOOT_SCRIPT, DESIGNS, htmlAttrsFor, isDarkColor, resolveLook } from "./registry.ts";
import { MORE_DESIGNS } from "./more.ts";

test("the nine base designs plus the added ones, each with a full swatch and shader", () => {
  assert.equal(DESIGNS.length, 9 + MORE_DESIGNS.length);
  for (const d of DESIGNS) {
    assert.equal(d.swatch.length, 4, d.id);
    assert.equal(d.shader?.colors.length, 4, d.id);
    assert.match(d.shader!.source, /void main\(\)/, d.id);
  }
});

test("resolveLook accepts designs and live palettes only", () => {
  assert.equal(resolveLook("nimbus", []), "nimbus");
  assert.equal(resolveLook("github-light", ["github-light"]), "github-light");
  assert.equal(resolveLook("gone", ["github-light"]), null);
  assert.equal(resolveLook(undefined, ["github-light"]), null);
});

test("palettes render Classic; designs carry their own id", () => {
  assert.deepEqual(htmlAttrsFor("dracula"), { design: "classic", theme: "dracula" });
  assert.deepEqual(htmlAttrsFor("foil"), { design: "foil", theme: "foil" });
});

test("isDarkColor", () => {
  assert.equal(isDarkColor("#08080e"), true);
  assert.equal(isDarkColor("#fff"), false);
  assert.equal(isDarkColor("oklch(0.2 0 0)"), false);
});

test("boot script parses", () => {
  assert.doesNotThrow(() => new Function(BOOT_SCRIPT));
});
