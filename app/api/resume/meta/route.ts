import { currentVersion } from "@/lib/resume/sync";

/** Public, non-sensitive facts about the current resume: lets the window version its /resume.pdf URL and show the sync date. */
export async function GET() {
  const v = await currentVersion();
  return Response.json(
    v ? { sha: v.sha256, syncedAt: v.created_at, source: v.source, pinned: v.pinned } : { sha: null },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
