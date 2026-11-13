import { CHAT_RATE_LIMIT, clientKey, peekRateLimit, rateHeaders } from "@/lib/rate-limit";

/** The visitor's current chat window (per IP key), read without spending a request. Feeds /usage in the agent. */
export async function GET(req: Request) {
  const info = await peekRateLimit("chat", clientKey(req), CHAT_RATE_LIMIT);
  if (!info) return Response.json({ error: "Usage unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return Response.json(info, { headers: { "Cache-Control": "no-store", ...rateHeaders(info) } });
}
