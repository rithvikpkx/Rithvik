import { adminClient } from "@/lib/supabase-server";

/** Liveness probe for the uptime pinger and anyone else: one trivial Supabase read, never cached, no auth, no data. */
export async function GET() {
	const t0 = Date.now();
	let db = false;
	try {
		const { error } = await adminClient().from("site_content").select("key", { head: true }).limit(1);
		db = !error;
	} catch {
		// db stays false
	}
	return Response.json(
		{ ok: db, db, ms: Date.now() - t0, commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null, at: new Date().toISOString() },
		{ status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } },
	);
}
