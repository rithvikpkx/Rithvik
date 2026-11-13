import { getSongs } from "@/lib/songs";

/** GET /api/songs: the Play deck's record crate (titles + public mp3 URLs). */
export async function GET() {
  return Response.json(await getSongs(), { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
