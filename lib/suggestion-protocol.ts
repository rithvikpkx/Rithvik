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

/** Question scaffolding that appears in nearly every suggestion and would
 *  otherwise inflate every similarity score. "rithvik" and "he" are in here for
 *  the same reason: every question is about him, so they carry no signal. */
const STOPWORDS = new Set([
  "what", "which", "who", "whom", "whose", "when", "where", "why", "how",
  "is", "are", "was", "were", "be", "been", "being", "do", "does", "did",
  "has", "have", "had", "can", "could", "will", "would", "should", "may",
  "the", "a", "an", "and", "or", "but", "if", "of", "to", "in", "on", "at",
  "for", "from", "with", "about", "into", "over", "after", "before",
  "he", "him", "his", "she", "her", "they", "them", "their", "it", "its",
  "rithvik", "praveen", "kumar", "that", "this", "these", "those", "as", "by",
  // Opinion verbs and comparators. "What does he THINK about X vs Y" and "how
  // does he WEIGH X AGAINST Y" are the same question; without these the shared
  // topic (X, Y) gets diluted by framing words and the reword slips through.
  "think", "thinks", "believe", "believes", "feel", "feels", "consider",
  "considers", "weigh", "weighs", "view", "views", "opinion", "approach",
  "vs", "versus", "against", "between", "toward", "towards", "prefer", "prefers",
]);

/** Content words only — the tokens that actually distinguish one question
 *  from another. */
function contentTokens(s: string): Set<string> {
  return new Set(
    normalizeForMatch(s)
      .split(" ")
      .filter((w) => w.length > 1 && !STOPWORDS.has(w)),
  );
}

/** Jaccard overlap of content words, 0–1. Cheap, deterministic, and good
 *  enough to catch "the same question reworded" without an embedding call. */
export function questionSimilarity(a: string, b: string): number {
  const A = contentTokens(a);
  const B = contentTokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;
  return shared / (A.size + B.size - shared);
}

/** Above this, two questions are treated as the same question. Tuned so
 *  "what projects has he worked on" and "what technologies does he use in his
 *  projects" stay distinct (0.4) while a reword of the same question does not. */
export const REDUNDANT_THRESHOLD = 0.55;

/**
 * Cosine cutoff for "the same question, different words".
 *
 * Calibrated against real embeddings of repeats and non-repeats pulled from a
 * production transcript. Word overlap misses semantic rewordings ("use AI in
 * his workflow" vs "view AI tools in his workflow" scores 0.50 lexically but
 * 0.925 semantically), so the two signals are unioned.
 *
 * The bands genuinely overlap — the loosest repeat measured 0.772 while the
 * closest distinct pair measured 0.809 — so this sits above BOTH at 0.86.
 * Deliberately conservative: it will let an occasional loose reword through
 * rather than suppress a legitimately different question.
 */
export const REDUNDANT_COSINE = 0.86;

/** Cosine similarity of two equal-length vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * True when a candidate repeats something already asked this conversation.
 *
 * The prompt asks the model not to restate the current question; it does anyway
 * — a visitor asked "what does Rithvik think about shipping fast vs building
 * properly?" and got that exact question back as the ghost suggestion. So this
 * is enforced rather than requested.
 */
export function isRedundant(
  candidate: string,
  asked: string[],
  threshold: number = REDUNDANT_THRESHOLD,
): boolean {
  const c = normalizeForMatch(candidate);
  if (!c) return true;
  return asked.some(
    (q) => normalizeForMatch(q) === c || questionSimilarity(candidate, q) >= threshold,
  );
}

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
