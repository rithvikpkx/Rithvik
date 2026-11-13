import "server-only";
import { unstable_cache } from "next/cache";
import { adminClient } from "@/lib/supabase-server";
import { AUX_MODEL, CHAT_MODEL } from "@/lib/openai";
import { shapeUptime, shapeWindow, windowStart, type Status } from "@/lib/agent/metrics";

/** Builds the public metrics payload from the DB. Missing tables/RPCs degrade to empty windows, never a throw. */
async function buildStatus(): Promise<Status> {
	const now = Date.now();
	const db = adminClient();
	const rpc = async (fn: string, args?: Record<string, unknown>) => {
		try {
			const { data, error } = await db.rpc(fn, args);
			if (error) throw error;
			return data;
		} catch (e) {
			console.warn(`[status] ${fn} unavailable:`, e instanceof Error ? e.message : e);
			return null;
		}
	};
	const [d24, d7, up] = await Promise.all([
		rpc("agent_metrics", { p_since: windowStart("24h", now).toISOString(), p_bucket: "hour" }),
		rpc("agent_metrics", { p_since: windowStart("7d", now).toISOString(), p_bucket: "day" }),
		rpc("uptime_summary"),
	]);
	return {
		generatedAt: new Date(now).toISOString(),
		windows: { "24h": shapeWindow(d24, "24h", now), "7d": shapeWindow(d7, "7d", now) },
		uptime: shapeUptime(up),
		build: { commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null, model: CHAT_MODEL, auxModel: AUX_MODEL },
	};
}

/** The /status payload, cached 60s. Shared by /api/status and the /status page, so the page never fetches itself
 *  over HTTP (a self-fetch is refused by Vercel deployment protection on previews). */
export const getStatus = unstable_cache(buildStatus, ["agent-status"], { revalidate: 60 });
