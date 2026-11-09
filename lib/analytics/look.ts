/** The visitor's active look as palette tokens, so pages outside the design engine (/admin, /status) wear it.
 *  Pure (node:test loads it). A palette slug yields that palette's own tokens; a design id yields a token set
 *  derived from its registry swatch [background, ink, accent, second accent] and `dark` flag. */
import { designById, isDarkColor } from "../designs/registry.ts";
import { tokensToCss } from "../themes.ts";
import type { Theme } from "../types";

export type Look = { id: string; name: string; dark: boolean; tokens: Record<string, string> };

/** Resolves a look id (design id or palette slug) to its tokens; unknown ids fall back to the first palette. */
export function lookFor(id: string, palettes: Theme[]): Look {
  const d = designById(id);
  if (d) {
    const [bg, text, accent, accent2] = d.swatch;
    return {
      id, name: d.name, dark: d.dark,
      // muted and the soft surface are mixed in CSS from these, so a swatch never has to supply them
      tokens: { bg, text, accent, "accent-glow": accent2, green: accent2 },
    };
  }
  const p = palettes.find((t) => t.slug === id) ?? palettes[0];
  return { id: p?.slug ?? id, name: p?.name ?? id, dark: isDarkColor(p?.tokens.bg), tokens: p?.tokens ?? {} };
}

/** A CSS rule giving `selector` the look's tokens (values validated by tokensToCss, so nothing escapes the rule). */
export function lookCss(look: Look, selector: string): string {
  return `${selector}{\n${tokensToCss(look.tokens)}\n}`;
}
