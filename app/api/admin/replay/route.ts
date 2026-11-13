import { isAdmin } from "@/app/admin/auth-helper";
import { adminClient } from "@/lib/supabase-server";
import { isUuid, parseSeq } from "@/lib/track/schema";

/** GET /api/admin/replay?visit=<uuid>&seq=<n>: one stored replay chunk, admin only. The object is gzip'd JSON, served
 *  as plain bytes and inflated by the admin's browser (DecompressionStream). Not `Content-Encoding: gzip`: the hosting
 *  layer may re-encode or strip that, which broke every replay. Path is built from the
 *  validated uuid and seq, never from user text. */
export async function GET(req: Request) {
  if (!(await isAdmin())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const visit = q.get("visit");
  const seq = parseSeq(q.get("seq"));
  if (!isUuid(visit) || seq === null) return Response.json({ error: "bad request" }, { status: 400 });
  const { data, error } = await adminClient().storage.from("replays").download(`${visit.toLowerCase()}/${seq}.json.gz`);
  if (error || !data) return Response.json({ error: "not found" }, { status: 404 });
  return new Response(data.stream(), {
    headers: { "Content-Type": "application/gzip", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" },
  });
}
