/**
 * Wire format shared by the chat route and the chat panel.
 *
 * Deliberately separate from lib/suggestions.ts: that module holds the OpenAI
 * call and its prompt, and the client only needs the framing. Importing this
 * from a client component pulls in nothing server-side.
 *
 * Pure and dependency-free, so it's unit-tested with node:test.
 */

/** Maximum characters per suggestion — longer is unreadable as an input
 *  placeholder in a ~380px panel. Requested in the prompt, enforced here. */
export const MAX_SUGGESTION_CHARS = 70;

/** How many follow-ups a turn should produce: one becomes ghost text, the
 *  rest become chips. */
export const WANTED_SUGGESTIONS = 3;

/**
 * Separates the answer from the trailing suggestions payload on the
 * `text/plain` stream. The NUL bytes cannot occur in model prose, and the route
 * (not the model) emits it, so it can neither be forgotten nor malformed.
 */
export const SUGGESTIONS_SENTINEL = "\u0000RAG_SUGGESTIONS\u0000";

/** Coerces whatever came back into at most WANTED_SUGGESTIONS clean, unique,
 *  length-capped strings. Applied on both ends: the server trusts no model
 *  output, the client trusts no payload. */
export function normalizeSuggestions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const s = item.trim().replace(/\s+/g, " ").slice(0, MAX_SUGGESTION_CHARS).trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length === WANTED_SUGGESTIONS) break;
  }
  return out;
}

/** Lowercase, strip punctuation, collapse whitespace — so a grounding check
 *  isn't defeated by a stray comma or a line break inside a chunk. */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words in a shingle. Long enough that a match means real overlap, short
 *  enough to survive the model trimming a clause off its quoted evidence. */
const SHINGLE = 6;

/**
 * True when `evidence` is genuinely supported by `haystack`.
 *
 * Exact substring matching is too strict — models paraphrase even when told to
 * quote verbatim — so this slides a SHINGLE-word window over the evidence and
 * passes if any window appears in the haystack. Evidence shorter than a full
 * window must appear in its entirety.
 *
 * Deliberately conservative: a false negative costs one suggestion, a false
 * positive costs the visitor a dead-end question.
 */
export function containsGrounding(haystack: string, evidence: string): boolean {
  const hay = normalizeForMatch(haystack);
  const words = normalizeForMatch(evidence).split(" ").filter(Boolean);
  if (words.length === 0 || hay.length === 0) return false;
  if (words.length <= SHINGLE) return hay.includes(words.join(" "));
  for (let i = 0; i + SHINGLE <= words.length; i++) {
    if (hay.includes(words.slice(i, i + SHINGLE).join(" "))) return true;
  }
  return false;
}

/**
 * Splits an accumulated stream into the visible answer and the suggestions.
 *
 * Handles the partially-arrived case: if the tail of `acc` is a prefix of the
 * sentinel, that fragment is withheld from `answer` so a half-delivered marker
 * never flashes on screen mid-stream.
 *
 * `suggestions` is null until the payload has fully arrived and parsed; the
 * answer is always correct regardless.
 */
export function splitStream(acc: string): { answer: string; suggestions: string[] | null } {
  const idx = acc.indexOf(SUGGESTIONS_SENTINEL);
  if (idx !== -1) {
    const answer = acc.slice(0, idx);
    const raw = acc.slice(idx + SUGGESTIONS_SENTINEL.length);
    try {
      const parsed = JSON.parse(raw) as { suggestions?: unknown };
      return { answer, suggestions: normalizeSuggestions(parsed.suggestions) };
    } catch {
      return { answer, suggestions: null };   // payload still arriving, or malformed
    }
  }

  // No sentinel yet — hold back any trailing prefix of it.
  const maxKeep = Math.min(SUGGESTIONS_SENTINEL.length - 1, acc.length);
  for (let keep = maxKeep; keep > 0; keep--) {
    if (acc.endsWith(SUGGESTIONS_SENTINEL.slice(0, keep))) {
      return { answer: acc.slice(0, acc.length - keep), suggestions: null };
    }
  }
  return { answer: acc, suggestions: null };
}
