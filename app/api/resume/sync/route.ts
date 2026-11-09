import { requireAuth } from "@/app/admin/auth-helper";
import { syncResume } from "@/lib/resume/sync";

/** Admin-only manual sync. Body `{ "force": true }` also replaces a pinned upload. */
export async function POST(req: Request) {
  // requireAuth redirects (it throws) when the caller is not the admin; an API wants a 401 instead.
  try { await requireAuth(); } catch { return Response.json({ error: "unauthorized" }, { status: 401 }); }
  const { force } = (await req.json().catch(() => ({}))) as { force?: boolean };
  try {
    return Response.json(await syncResume({ force: force === true }));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "sync failed" }, { status: 502 });
  }
}
