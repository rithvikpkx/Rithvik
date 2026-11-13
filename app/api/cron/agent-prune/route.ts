import { adminClient } from "@/lib/supabase-server";

/** Vercel Cron target (daily): runs agent_prune() so conversations older than 180 days and metrics older than 400 days are deleted. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { error } = await adminClient().rpc("agent_prune");
  if (error) {
    console.error("[agentlog] prune failed:", error.message);
    return Response.json({ error: "prune failed" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
