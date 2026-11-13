import "server-only";
import { adminClient } from "@/lib/supabase-server";
import type { Part } from "@/lib/suggestion-protocol";
import { CACHE_TTL_MS, asParts, cacheThreshold, contentHash } from "./cache";

/* Supabase side of the response cache. Every export swallows its errors and reports a miss, so a missing table or
 * RPC (migration not applied yet) or an outage costs only the saving, never the answer. */

let warned = false;
/** Logs the first failure only: an unapplied migration would otherwise warn on every request. */
function degrade(what: string, e: unknown) {
	if (warned) return;
	warned = true;
	console.warn(`[cache] ${what} unavailable, answering uncached:`, e instanceof Error ? e.message : e);
}

/** The content hash for this moment: site content + current resume sha + uploaded-doc set + model. Null on failure. */
export async function currentHash(content: unknown, model: string): Promise<string | null> {
	try {
		const db = adminClient();
		const [resume, docs] = await Promise.all([
			db.from("resume_versions").select("sha256").eq("is_current", true).limit(1),
			db.from("secondary_documents").select("id, uploaded_at"),
		]);
		if (resume.error || docs.error) throw resume.error ?? docs.error;
		const docRows = (docs.data ?? []) as { id: string; uploaded_at: string }[];
		return contentHash({ content, resumeSha: (resume.data?.[0] as { sha256?: string } | undefined)?.sha256 ?? null, docs: docRows.map((d) => ({ id: d.id, at: d.uploaded_at })), model });
	} catch (e) {
		degrade("content hash", e);
		return null;
	}
}

export type CacheHit = { id: string; parts: Part[]; createdAt: string; similarity: number };

/** The nearest live entry for this content version at or above the threshold, or null. */
export async function lookupCache(embedding: number[], hash: string): Promise<CacheHit | null> {
	try {
		const { data, error } = await adminClient().rpc("match_agent_cache", { query_embedding: embedding, p_content_hash: hash, threshold: cacheThreshold(), match_count: 1 });
		if (error) throw error;
		const row = (data as { id: string; frames: unknown; created_at: string; similarity: number }[] | null)?.[0];
		const parts = row ? asParts(row.frames) : null;
		return row && parts ? { id: row.id, parts, createdAt: row.created_at, similarity: row.similarity } : null;
	} catch (e) {
		degrade("lookup", e);
		return null;
	}
}

/** Bumps the hit counter. Fire-and-forget safe. */
export async function recordHit(id: string): Promise<void> {
	try {
		const { error } = await adminClient().rpc("agent_cache_hit", { p_id: id });
		if (error) throw error;
	} catch (e) {
		degrade("hit counter", e);
	}
}

/** Stores a finished answer for 7 days. Fire-and-forget safe. */
export async function storeCache(e: { question: string; embedding: number[]; hash: string; model: string; parts: Part[] }): Promise<void> {
	try {
		const { error } = await adminClient().from("agent_cache").insert({
			question: e.question.slice(0, 500),
			embedding: e.embedding,
			content_hash: e.hash,
			model: e.model,
			frames: e.parts,
			expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
		});
		if (error) throw error;
	} catch (err) {
		degrade("store", err);
	}
}
