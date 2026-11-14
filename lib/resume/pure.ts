/** Dependency-free resume helpers (validation, redaction, retention), kept apart so node:test can import them. */

export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const KEEP_VERSIONS = 10;

/** Returns why these bytes are not an acceptable resume PDF, or null if they are. contentType is
 *  checked only when the caller has one (a fetched response; an uploaded File's type is client-claimed). */
export function pdfProblem(bytes: Uint8Array, contentType?: string | null): string | null {
  if (bytes.length === 0) return "empty file";
  if (bytes.length > MAX_PDF_BYTES) return "larger than 5 MB";
  // The magic bytes, not the header or extension, are what makes it a PDF.
  if (String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-") return "not a PDF";
  if (contentType != null && !/^application\/pdf\b/i.test(contentType)) return `unexpected content-type ${contentType}`;
  return null;
}

const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|spring|summer|fall|winter)[a-z]*\\.?";
const PHONE = /(?:\+?\d{1,2}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}/g;
// "Expected May 2028", "Graduation: Spring 2028", "Class of 2028". The 25-char cap keeps a stray
// "expected" in a bullet from swallowing the sentence up to the next year.
const GRAD = new RegExp(
  `\\b(?:expected|anticipated|graduating|graduation)\\b[^\\n|,;]{0,25}?\\b(?:${MONTH}\\s*)?(?:19|20)\\d{2}\\b|\\bclass of\\s+(?:19|20)\\d{2}\\b`, "gi");

/** Normalises the Docs export and strips what the owner does not want the agent to share: phone numbers
 *  and the expected graduation date. Everything else (including citizenship) is kept. */
export function redactResume(raw: string): string {
  return raw
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(PHONE, "")
    .replace(GRAD, "")
    .replace(/\(\s*\)/g, "")
    .split("\n")
    // A removed field leaves orphan separators ("a |  | b", "| b"): collapse them.
    .map((l) => l.replace(/(\s*\|\s*){2,}/g, " | ").replace(/^\s*\|\s*|\s*\|\s*$/g, "").trimEnd())
    // Lines emptied by redaction vanish; blank lines the author wrote are only deduplicated.
    .filter((l, i, all) => l.trim() !== "" || (i > 0 && all[i - 1].trim() !== ""))
    .join("\n")
    .trim();
}

/** Versions to delete: everything beyond the newest `keep`, except the current one. */
export function staleVersions<T extends { created_at: string; is_current: boolean }>(rows: T[], keep = KEEP_VERSIONS): T[] {
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(keep).filter((r) => !r.is_current);
}

/** The Google Doc's HTML export made safe and private to show on the site (and visible to session replays, which a
 *  PDF viewer is not): scripts, frames, forms and handlers removed, Google's redirect links unwrapped, phone numbers
 *  and graduation dates scrubbed from the text, and the page widened to fill its window. */
export function cleanResumeHtml(raw: string): string {
  const BAD = "script|iframe|object|embed|form|base|meta|link|noscript";
  let s = raw
    .replace(new RegExp(`<(${BAD})\\b[^>]*>[\\s\\S]*?</\\1\\s*>`, "gi"), "")
    .replace(new RegExp(`</?(${BAD})\\b[^>]*>`, "gi"), "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/href="https:\/\/www\.google\.com\/url\?q=([^"&]+)[^"]*"/gi, (_, u: string) => `href="${decodeURIComponent(u)}"`)
    .replace(/href="\s*(?:javascript|data|vbscript):[^"]*"/gi, 'href="#"')
    .replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ');
  // scrub the body's text only: the head's stylesheet is full of digit runs the phone pattern would mangle
  const at = s.search(/<body\b/i);
  const scrub = (part: string) => part.replace(/>([^<]+)</g, (_, t: string) => `>${t.replace(PHONE, "").replace(GRAD, "").replace(/\|(\s*\|)+/g, "|")}<`); // and the "| |" a removed number leaves
  s = at < 0 ? scrub(s) : s.slice(0, at) + scrub(s.slice(at));
  const fit = "<style>html{background:#fff}body{max-width:none!important;margin:0!important;padding:28px 34px 40px!important}a{color:#1a56db}</style>";
  return /<\/head>/i.test(s) ? s.replace(/<\/head>/i, `${fit}</head>`) : fit + s;
}
