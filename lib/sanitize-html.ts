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

// Escape angle brackets in a text segment so a stray or incomplete tag (e.g. an
// unclosed `<img onerror=…`) can't pass through as live markup. We escape only
// < and > (not &), to avoid double-encoding entities the editor already emits.
function escapeText(s: string): string {
  return s.replace(/[<>]/g, (c) => (c === "<" ? "&lt;" : "&gt;"));
}

/** Strip the input to an allowlist of inline/list tags, dropping everything else
 *  (including <script>/<style> and their contents) and escaping all non-tag text
 *  so only reconstructed, attribute-free allowlisted tags reach the output. */
export function sanitizeEmailHtml(input: string): string {
  // Drop script/style blocks wholesale (tags + contents) before tokenizing.
  const withoutBlocks = input.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");

  // Only well-formed tags (an opener letter and a closing `>`) are treated as
  // tags; anything else falls into the text run and gets angle-escaped.
  const tagRe = /<\/?[a-z][^>]*>/gi;
  let suppressedAnchorDepth = 0;   // suppressed <a> openers whose </a> we must eat
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(withoutBlocks)) !== null) {
    out += escapeText(withoutBlocks.slice(last, m.index));  // text before this tag
    last = tagRe.lastIndex;

    const tag = m[0];
    const name = tag.match(/^<\s*\/?\s*([a-z0-9]+)/i)![1].toLowerCase();
    const closing = /^<\s*\//.test(tag);
    if (!ALLOWED_TAGS.has(name)) continue;       // drop the tag (its text already escaped)
    if (closing) {
      // If this </a> matches a suppressed opener, eat it instead of emitting.
      if (name === "a" && suppressedAnchorDepth > 0) { suppressedAnchorDepth--; continue; }
      out += `</${name}>`;
      continue;
    }
    if (name === "br") { out += "<br>"; continue; }
    if (name === "a") {
      const href = safeHref(tag);
      if (!href) { suppressedAnchorDepth++; continue; }  // swallow the matching </a>
      out += `<a href="${href}">`;
      continue;
    }
    out += `<${name}>`;                           // reconstruct with NO attributes
  }
  out += escapeText(withoutBlocks.slice(last));   // trailing text after the last tag
  return out;
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
