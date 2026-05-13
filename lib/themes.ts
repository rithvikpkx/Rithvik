import type { Theme } from "./types";

/**
 * Theme token model
 * -----------------
 * Themes only NEED to define a small primary palette: bg, text, accent, etc.
 * Surface tokens (--card, --border, --nav-glass, --panel-glass) are derived in
 * globals.css via color-mix() so they auto-adapt to any theme's primary values.
 *
 * Themes MAY still override any derived token by including it in their tokens map;
 * the per-theme value wins over the derived default. The set below documents which
 * keys we recognize, but missing keys are fine — color-mix fills in.
 */
export const THEMABLE_TOKENS = [
  // Primary (recommended for every theme)
  "bg",
  "bg-soft",
  "text",
  "muted",
  "accent",
  "accent-glow",
  "green",
  // Optional explicit overrides for surfaces (otherwise derived)
  "card",
  "card-hover",
  "border",
  "border-hover",
  "nav-glass",
  "panel-glass",
] as const;

export type ThemeTokenKey = (typeof THEMABLE_TOKENS)[number];
export type ThemeTokens = Partial<Record<ThemeTokenKey, string>>;

/** Slug used when no theme is saved in localStorage. */
export const DEFAULT_THEME_SLUG = "rithvik-dark";

/** localStorage key for the user's persisted choice. */
export const THEME_STORAGE_KEY = "rithvik-theme";

/** Rithvik Dark — primary palette only; surfaces derive in CSS. */
export const DEFAULT_DARK_TOKENS: ThemeTokens = {
  bg:            "#08080e",
  "bg-soft":     "#0d0d16",
  text:          "#eeeef6",
  muted:         "#82829a",
  accent:        "#c2305e",
  "accent-glow": "rgba(194,48,94,0.22)",
  green:         "#4ade80",
};

/** Rithvik Light — primary palette only; surfaces derive in CSS. */
export const DEFAULT_LIGHT_TOKENS: ThemeTokens = {
  bg:            "#fafaf7",
  "bg-soft":     "#f3f1ed",
  text:          "#0e0b0a",
  muted:         "#6a655f",
  accent:        "#c2305e",
  "accent-glow": "rgba(194,48,94,0.14)",
  green:         "#16a34a",
};

/** Fallback theme list used if the themes table is empty (migration not run). */
export const FALLBACK_THEMES: Theme[] = [
  {
    id: "fallback-dark",
    slug: "rithvik-dark",
    name: "Rithvik Dark",
    tokens: DEFAULT_DARK_TOKENS as Record<string, string>,
    sort_order: 0,
    published: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "fallback-light",
    slug: "rithvik-light",
    name: "Rithvik Light",
    tokens: DEFAULT_LIGHT_TOKENS as Record<string, string>,
    sort_order: 1,
    published: true,
    created_at: "",
    updated_at: "",
  },
];

/** Converts a tokens map to a CSS rule body: "--bg: ...; --text: ...;". */
export function tokensToCss(tokens: Record<string, string>): string {
  return Object.entries(tokens)
    .map(([key, value]) => `  --${key}: ${value};`)
    .join("\n");
}

/** Builds the full <style> body for every theme as data-theme selectors. */
export function buildThemeStyleSheet(themes: Theme[]): string {
  return themes
    .map((t) => `:root[data-theme="${t.slug}"] {\n${tokensToCss(t.tokens)}\n}`)
    .join("\n\n");
}
