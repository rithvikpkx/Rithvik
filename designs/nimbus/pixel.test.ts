import { test } from "node:test";
import assert from "node:assert/strict";
import { skyOf, skyShader, visitorHour } from "./pixel.ts";

const base = { source: "#define SUN vec2(.5, .8)\n#define NIGHT 0.\nvoid main(){}", colors: ["#000", "#000", "#000", "#000"] as [string, string, string, string], scale: 0.35, host: "#nb-sky" };

test("sky bands follow the hour", () => {
  assert.deepEqual([4, 6, 12, 18, 23].map(skyOf), ["night", "dawn", "day", "dusk", "night"]);
});

test("skyShader bakes the sun and night flag and swaps the palette", () => {
  const noon = skyShader(base, 12);
  assert.match(noon.source, /#define SUN vec2\(0\.500, 0\.880\)/);
  assert.match(noon.source, /#define NIGHT 0\./);
  assert.equal(noon.colors[3], "#0A9BFF");
  assert.equal(noon.host, "#nb-sky");
  const night = skyShader(base, 23);
  assert.match(night.source, /#define NIGHT 1\./);
  assert.equal(night.colors[3], "#38479C");
});

test("?hour= overrides and wraps", () => {
  assert.equal(visitorHour("?hour=26"), 2);
  assert.equal(visitorHour("?hour=-1"), 23);
});
