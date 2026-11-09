/** Ask-about-this: turns a text selection into the agent question. Pure, so it is tested. */

export const QUOTE_MAX = 300;
/** Selections shorter than this are accidents (a double-clicked word is still allowed, one letter is not). */
export const QUOTE_MIN = 3;

/** Collapses whitespace so a multi-line selection is one clean quote. */
export function cleanQuote(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** `Explain: "<quote>"` with the quote clipped to QUOTE_MAX characters (ellipsis counted in the cap), or null when too short. */
export function askQuestion(raw: string): string | null {
  const q = cleanQuote(raw);
  if (q.length < QUOTE_MIN) return null;
  const clipped = q.length > QUOTE_MAX ? `${q.slice(0, QUOTE_MAX - 1).trimEnd()}…` : q;
  return `Explain: "${clipped.replace(/"/g, "'")}"`;
}

/** Where selections must not offer the chip: form fields, editors, and the site's own overlays. */
export const IGNORE_SELECTOR = "input,textarea,select,[contenteditable],[contenteditable] *,.agent,.win,.sheet,.toast,.ask-sel,[role=dialog]";
