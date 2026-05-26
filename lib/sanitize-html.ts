// Allowlist HTML sanitizer for the contact composer body. The editor produces
// HTML via execCommand; this neutralizes everything outside a safe allowlist by
// RECONSTRUCTING each kept tag from scratch — raw attributes are never echoed
// back, so onclick / style / javascript: payloads can't survive. Used both
// client-side (preview) and server-side (the route never trusts the client).

const ALLOWED_TAGS = new Set([
  "b", "strong", "i", "em", "u", "s", "strike", "ul", "ol", "li", "p", "br", "a",
]);

// Pull a safe href out of an <a> opening tag, or null if absent/unsafe.
function safeHref(tag: string): string | null {
  const m = tag.match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!m) return null;
  const raw = (m[2] ?? m[3] ?? m[4] ?? "").trim();
  // Only web + mail links; blocks javascript:, data:, etc.
  if (!/^(https?:\/\/|mailto:)/i.test(raw)) return null;
  return raw.replace(/[<>"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** Strip the input to an allowlist of inline/list tags, dropping everything else
 *  (including <script>/<style> and their contents) while keeping text. */
export function sanitizeEmailHtml(input: string): string {
  // Drop script/style blocks wholesale (tags + contents) before tokenizing.
  const withoutBlocks = input.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");

  // Track suppressed <a> openers so their matching </a> closers are also dropped.
  let suppressedAnchorDepth = 0;

  // Walk tag-by-tag; reconstruct kept tags clean, drop the rest, leave text as-is.
  return withoutBlocks.replace(/<\/?[^>]+>/g, (tag) => {
    const m = tag.match(/^<\s*(\/?)\s*([a-z0-9]+)/i);
    if (!m) return "";                          // malformed → drop
    const closing = m[1] === "/";
    const name = m[2].toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return "";     // not allowlisted → drop tag, keep text
    if (closing) {
      // If this </a> matches a suppressed opener, eat it instead of emitting.
      if (name === "a" && suppressedAnchorDepth > 0) {
        suppressedAnchorDepth--;
        return "";
      }
      return `</${name}>`;
    }
    if (name === "br") return "<br>";
    if (name === "a") {
      const href = safeHref(tag);
      if (!href) {
        suppressedAnchorDepth++;               // remember to swallow the matching </a>
        return "";
      }
      return `<a href="${href}">`;
    }
    return `<${name}>`;                          // reconstruct with NO attributes
  });
}

/** Cheap plaintext fallback for the email's text part: block/break tags become
 *  newlines, remaining tags are stripped, and the few entities we emit decoded. */
export function htmlToText(input: string): string {
  return input
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|li|ul|ol)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
