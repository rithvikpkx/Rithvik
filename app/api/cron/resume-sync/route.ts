import { syncResume } from "@/lib/resume/sync";

/** Vercel Cron target (daily). Vercel sends `Authorization: Bearer $CRON_SECRET`; with no secret set it refuses everything. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return Response.json(await syncResume());
  } catch (e) {
    console.error("[resume] cron sync failed:", e);
    return Response.json({ error: e instanceof Error ? e.message : "sync failed" }, { status: 502 });
  }
}
