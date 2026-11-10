// Glyph's fixed copy and pure helpers (port of the constants at the top of docs/mockups/v7/themes/glyph.js).

/** [anchor id, tmux window name, section hue] */
export const SECTIONS = [["top", "top", "amber"], ["work", "work", "amber"], ["experience", "log", "blue"], ["about", "man", "blue"], ["play", "bin", "red"], ["questions", "faq", "red"], ["contact", "mail", "red"]] as const;
export const GLY = "#%@*+=-:/\\|<>[]{}_$&?~^";
export const KEYS = [["j / k", "next / previous pane"], ["g / G", "top / end"], ["1-7", "jump to a window"], [":", "ask the agent"], ["r", "resume"], ["m", "mail"], ["p", "play"], ["t", "another design"]];
/** Shown when an unmapped key is pressed: a small vim joke in the status bar. */
export const QUIPS = ["E492: not an editor command", "E37: no write since last hire", "E21: cannot make changes, modifiable is off", "E348: no string under cursor", "E163: there is only one file to edit"];

/** Deterministic 7-char hex "commit hash" for a string, so the git log reads like a real one. */
export function hash7(s: string): string {
  let h = 2166136261;
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 7);
}
