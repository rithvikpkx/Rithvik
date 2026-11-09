import { AUX_MODEL, CHAT_MODEL } from "@/lib/openai";
import { fixtureStatus } from "@/lib/agent/metrics";
import { getStatus } from "@/lib/agent/status-server";

/** Public metrics for the /status page: counts, latencies, tokens, cost and uptime. Never message content or IPs
 *  (agent_requests holds none). */
export async function GET(req: Request) {
	// Synthetic data so the page can be built before there is traffic; never reachable in production.
	if (process.env.NODE_ENV !== "production" && new URL(req.url).searchParams.get("fixture") === "1") {
		const build = { commit: null, model: CHAT_MODEL, auxModel: AUX_MODEL };
		return Response.json(fixtureStatus(Date.now(), build), { headers: { "Cache-Control": "no-store" } });
	}
	return Response.json(await getStatus(), { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
