import type { Theme } from "./types";

/**
 * The full set of CSS variables that are theme-controlled.
 * Every other --var in globals.css (radii, fonts, max-width) stays static across themes.
 */
export const THEMABLE_TOKENS = [
  "bg",
  "bg-soft",
  "card",
  "card-hover",
  "border",
  "border-hover",
  "text",
  "muted",
  "accent",
  "accent-glow",
  "green",
  "fg-rgb",      // RGB triple ("R,G,B") for translucent foreground overlays — white on dark, near-black on light
  "nav-glass",   // background fill for the floating nav pill
] as const;

export type ThemeTokenKey = (typeof THEMABLE_TOKENS)[number];
export type ThemeTokens = Record<ThemeTokenKey, string>;

/** Slug used when no theme is saved in localStorage. */
export const DEFAULT_THEME_SLUG = "rithvik-dark";

/** localStorage key for the user's persisted choice. */
export const THEME_STORAGE_KEY = "rithvik-theme";

/** Rithvik Dark — exactly the current production values from globals.css. */
export const DEFAULT_DARK_TOKENS: ThemeTokens = {
  bg:             "#08080e",
  "bg-soft":      "#0d0d16",
  card:           "rgba(255,255,255,0.034)",
  "card-hover":   "rgba(255,255,255,0.056)",
  border:         "rgba(255,255,255,0.07)",
  "border-hover": "rgba(255,255,255,0.14)",
  text:           "#eeeef6",
  muted:          "#82829a",
  accent:         "#c2305e",
  "accent-glow":  "rgba(194,48,94,0.22)",
  green:          "#4ade80",
  "fg-rgb":       "255,255,255",
  "nav-glass":    "rgba(11,11,20,0.68)",
};

/** Rithvik Light — proposal values; tuned during Stage 4. */
export const DEFAULT_LIGHT_TOKENS: ThemeTokens = {
  bg:             "#fafaf7",
  "bg-soft":      "#f3f1ed",
  card:           "#ffffff",
  "card-hover":   "#f7f4ee",
  border:         "rgba(14,11,10,0.08)",
  "border-hover": "rgba(14,11,10,0.16)",
  text:           "#0e0b0a",
  muted:          "#6a655f",
  accent:         "#c2305e",
  "accent-glow":  "rgba(194,48,94,0.12)",
  green:          "#16a34a",
  "fg-rgb":       "14,11,10",
  "nav-glass":    "rgba(252,250,245,0.72)",
};

/** Fallback theme list used if the themes table is empty (migration not run). */
export const FALLBACK_THEMES: Theme[] = [
  {
    id: "fallback-dark",
    slug: "rithvik-dark",
    name: "Rithvik Dark",
    tokens: DEFAULT_DARK_TOKENS,
    sort_order: 0,
    published: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "fallback-light",
    slug: "rithvik-light",
    name: "Rithvik Light",
    tokens: DEFAULT_LIGHT_TOKENS,
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
