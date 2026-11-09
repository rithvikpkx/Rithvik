import { adminClient } from "@/lib/supabase-server";
import { AUX_MODEL, CHAT_MODEL } from "@/lib/openai";
import { fixtureStatus, shapeUptime, shapeWindow, windowStart, type Status } from "@/lib/agent/metrics";

/** Public metrics for the /status page: counts, latencies, tokens, cost and uptime. Never message content or IPs
 *  (agent_requests holds none). Missing tables/RPCs (migration not applied) degrade to empty windows, not a 500. */
export async function GET(req: Request) {
	const now = Date.now();
	const build = { commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null, model: CHAT_MODEL, auxModel: AUX_MODEL };
	const headers = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };

	// Synthetic data so the page can be built before there is traffic; never reachable in production.
	if (process.env.NODE_ENV !== "production" && new URL(req.url).searchParams.get("fixture") === "1") {
		return Response.json(fixtureStatus(now, build), { headers: { "Cache-Control": "no-store" } });
	}

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
	const body: Status = {
		generatedAt: new Date(now).toISOString(),
		windows: { "24h": shapeWindow(d24, "24h", now), "7d": shapeWindow(d7, "7d", now) },
		uptime: shapeUptime(up),
		build,
	};
	return Response.json(body, { headers });
}
