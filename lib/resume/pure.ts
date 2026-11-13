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
