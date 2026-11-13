import { adminClient } from "@/lib/supabase-server";
import { currentVersion, RESUME_BUCKET } from "@/lib/resume/sync";

/** Streams the current resume PDF from the private bucket, same-origin so it can be framed and cached.
 *  Callers bust the CDN copy with `?v=<sha>` (see /api/resume/meta); the strong ETag keeps revalidation cheap. */
export async function GET(req: Request) {
  const db = adminClient();
  const v = await currentVersion(db);
  if (!v) return new Response("No resume yet", { status: 404, headers: { "Cache-Control": "no-store" } });

  const headers = {
    ETag: `"${v.sha256}"`,
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  };
  if (req.headers.get("if-none-match") === headers.ETag) return new Response(null, { status: 304, headers });

  const { data, error } = await db.storage.from(RESUME_BUCKET).download(v.storage_path);
  if (error || !data) return new Response("Resume file missing", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(data, {
    headers: {
      ...headers,
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="Rithvik-Praveen-Kumar-Resume.pdf"',
    },
  });
}
