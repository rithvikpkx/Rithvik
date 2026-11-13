import { clientKey, peekRateLimit, rateHeaders } from "@/lib/rate-limit";
import { CHAT_PER_KEY, LIVE_PER_KEY, adminRequest } from "@/lib/agent-limit";

/** The visitor's current windows (per IP key), read without spending a request: typed chat and voice mode. Feeds
 *  /usage and the status bar. The signed-in admin has no limits (`admin: true`, no windows). */
export async function GET(req: Request) {
  if (await adminRequest(req)) return Response.json({ admin: true }, { headers: { "Cache-Control": "no-store" } });
  const key = clientKey(req);
  const [info, voice] = await Promise.all([peekRateLimit("chat", key, CHAT_PER_KEY), peekRateLimit("live", key, LIVE_PER_KEY)]);
  if (!info) return Response.json({ error: "Usage unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return Response.json({ ...info, voice }, { headers: { "Cache-Control": "no-store", ...rateHeaders(info) } });
}
