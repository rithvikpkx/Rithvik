import { test } from "node:test";
import assert from "node:assert/strict";
import { buildThemeStyleSheet, FALLBACK_THEMES } from "./themes.ts";
import type { Theme } from "./types.ts";

const theme = (slug: string, tokens: Record<string, string>) =>
  ({ ...FALLBACK_THEMES[0], slug, tokens }) as Theme;

test("fallback themes pass through intact", () => {
  const css = buildThemeStyleSheet(FALLBACK_THEMES);
  assert.match(css, /--accent-glow: rgba\(9,105,218,0\.18\);/);
  assert.match(css, /--font: var\(--mono\);/);
});

test("themes with a hostile slug are skipped", () => {
  const css = buildThemeStyleSheet([theme('x"] {}</style><script>', { bg: "#fff" }), theme("ok-1", { bg: "#fff" })]);
  assert.ok(!css.includes("script"));
  assert.match(css, /data-theme="ok-1"/);
});

test("hostile token values and keys are dropped", () => {
  const css = buildThemeStyleSheet([
    theme("t", {
      bg: "#fff",
      text: "red;} body{display:none",
      accent: "</style><script>alert(1)</script>",
      muted: "url(https://evil/x)",
      green: "\\41",
      "bg-soft": "@import 'x'",
      "x: y;": "#000",
    }),
  ]);
  assert.equal(css, ':root[data-theme="t"] {\n  --bg: #fff;\n}');
});
