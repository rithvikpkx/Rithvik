import { adminClient } from "@/lib/supabase-server";

const BATCH = 500;

/** Vercel Cron target (daily): removes replay files older than 90 days from Storage (the Storage API is the only
 *  clean way to delete the blobs), then runs tracking_prune() for the rows (visits/events 400 days, replays 90). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = adminClient();
  const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();
  for (;;) {
    const { data, error } = await db.from("replays").select("storage_path").lt("created_at", cutoff).limit(BATCH);
    if (error) { console.error("[track] prune list failed:", error.message); return Response.json({ error: "prune failed" }, { status: 500 }); }
    if (!data?.length) break;
    const paths = data.map((r) => r.storage_path as string);
    const rm = await db.storage.from("replays").remove(paths);
    if (rm.error) { console.error("[track] prune remove failed:", rm.error.message); return Response.json({ error: "prune failed" }, { status: 500 }); }
    const del = await db.from("replays").delete().in("storage_path", paths);
    if (del.error) { console.error("[track] prune delete failed:", del.error.message); return Response.json({ error: "prune failed" }, { status: 500 }); }
    if (data.length < BATCH) break;
  }
  const { error } = await db.rpc("tracking_prune");
  if (error) { console.error("[track] prune failed:", error.message); return Response.json({ error: "prune failed" }, { status: 500 }); }
  return Response.json({ ok: true });
}
