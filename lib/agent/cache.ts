/** Pure rules for the semantic response cache (no server-only imports, so node:test can load them).
 *  The DB side lives in cache-db.ts. A hit replays the stored v2 stream instead of calling the model. */
import { createHash } from "node:crypto";
import { frame, normalizeForMatch, parseFrames, type Part } from "../suggestion-protocol.ts";

export const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;
/** Cosine floor for "same question" (text-embedding-3-small, normalized text). Measured by scripts/calibrate-cache.mjs:
 *  one-fact-changed questions reach 0.915 ("research" vs "study" at Purdue) and 0.866 (strengths vs weaknesses), 903
 *  unrelated eval pairs peak at 0.843, while real paraphrases span 0.63-0.96 (4 of 14 clear 0.95). A wrong answer is
 *  worse than a miss, so this sits 0.035 above the worst look-alike; exact repeats (starter chips) score 1.0. */
export const DEFAULT_THRESHOLD = 0.95;

/** The env-tunable threshold, clamped so a typo (0.5, 9) can never make the cache serve unrelated answers. */
export function cacheThreshold(env: string | undefined = process.env.AGENT_CACHE_THRESHOLD): number {
	const n = Number(env);
	return env && Number.isFinite(n) ? Math.min(0.999, Math.max(0.9, n)) : DEFAULT_THRESHOLD;
}

/** The text that is embedded and stored: case, punctuation and spacing differences must not matter. */
export const normalizeQuestion = normalizeForMatch;

/** Words that make an answer depend on what the visitor is looking at ("explain this"), which the key cannot see. */
const DEICTIC = /\b(this|these|here|above|below)\b/i;

/** Whether this request may read or write the cache: a visitor's first turn, no quoted selection and no
 *  page-relative wording, never the owner, and never an eval run unless it opted in (x-eval-cache: on). */
export function cacheable(o: { evalRun: boolean; evalOptIn: boolean; owner: boolean; history: number; selection?: string; question: string }): boolean {
	if (o.owner || (o.evalRun && !o.evalOptIn)) return false;
	return o.history === 0 && !o.selection && !DEICTIC.test(o.question);
}

/** sha256 over everything the answer is derived from: site content, resume version, uploaded docs and the answer model.
 *  Any edit changes it, which strands every older entry. */
export function contentHash(o: { content: unknown; resumeSha: string | null; docs: { id: string; at: string }[]; model: string }): string {
	const docs = [...o.docs].sort((a, b) => a.id.localeCompare(b.id));
	return createHash("sha256").update(JSON.stringify([o.content, o.resumeSha, docs, o.model])).digest("hex");
}

/** The parts worth storing from a finished turn's raw stream, or null when it must not be cached: any tool frame,
 *  no grounding (empty retrieval, e.g. degraded), no completed trailer, or an empty answer. Token usage is zeroed
 *  because a replay costs nothing. */
export function storableParts(raw: string): Part[] | null {
	const parts = parseFrames(raw);
	let text = "", searched = false, trailer = false;
	for (const p of parts) {
		if (p.type === "text") { text += p.text; continue; }
		const t = p.event.t;
		if (t === "tool" || t === "cache") return null;
		if (t === "search" && p.event.n > 0) searched = true;
		if (t === "trailer") trailer = true;
	}
	if (!searched || !trailer || !text.trim()) return null;
	return parts.map((p) => (p.type === "event" && p.event.t === "trailer" ? { ...p, event: { ...p.event, usage: { total_tokens: 0 } } } : p));
}

/** The stream to send for a hit: a `cache` frame first, then the stored parts in order. */
export function replayChunks(parts: Part[], createdAt: string, now = Date.now()): string[] {
	const age = Math.max(0, Math.round((now - Date.parse(createdAt)) / 1000));
	return [frame({ t: "cache", age }), ...parts.map((p) => (p.type === "text" ? p.text : frame(p.event)))];
}

/** Narrows a jsonb value read back from the table to well-formed parts; anything else is a miss. */
export function asParts(v: unknown): Part[] | null {
	if (!Array.isArray(v) || v.length === 0) return null;
	const ok = v.every((p) => p && typeof p === "object" && ((p.type === "text" && typeof p.text === "string") || (p.type === "event" && typeof p.event?.t === "string")));
	return ok ? (v as Part[]) : null;
}
