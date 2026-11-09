import { after, NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { enrichVisitor } from "@/lib/track/enrich";
import { isOwner } from "@/lib/track/owner";
import { COOKIE_MAX_AGE, MAX_BATCH_BYTES, RV_COOKIE, pickIp, validateBatch, visitorIdFromCookie } from "@/lib/track/schema";
import { recordBatch } from "@/lib/track/store";

const PER_IP_PER_HOUR = 900;  // ~one batch per 10 s from a few tabs behind one address
const GLOBAL_PER_HOUR = 30_000;

/** POST /api/t: the first-party event collector (sendBeacon-friendly JSON batches, at most 64 KB). Validates and
 *  rate-limits, sets or reads the 1-year `rv_id` cookie, stores visitor, visit and events, and queues the IP
 *  lookup after the response. The owner (cookie or excluded IP) gets an empty 200 and no rows. Always answers fast and small; the browser never waits on it. */
export async function POST(req: Request) {
  if (isOwner(req)) return NextResponse.json({ ok: true, owner: true }); // the owner is never tracked; the client stops on `owner`
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BATCH_BYTES) return NextResponse.json({ ok: false }, { status: 413 });

  const limited = await rateLimit("track", clientKey(req), PER_IP_PER_HOUR, GLOBAL_PER_HOUR);
  if (!limited.ok) return NextResponse.json({ ok: false }, { status: limited.status, headers: { "Retry-After": String(limited.retryAfter) } });

  const text = await req.text(); // sendBeacon sends text/plain, so read text and parse ourselves
  if (text.length > MAX_BATCH_BYTES) return NextResponse.json({ ok: false }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const parsed = validateBatch(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  const existing = visitorIdFromCookie(req.headers.get("cookie"));
  const visitorId = existing ?? crypto.randomUUID();
  let enrichIp: string | null = null;
  try {
    const ip = pickIp(req.headers);
    const r = await recordBatch(req.headers, visitorId, ip, parsed.batch);
    if (r.status === "forbidden") return NextResponse.json({ ok: false }, { status: 403 });
    enrichIp = r.enrichIp;
  } catch (e) {
    console.error("[track] recordBatch failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  if (enrichIp) after(() => enrichVisitor(visitorId, enrichIp));

  const res = NextResponse.json({ ok: true });
  if (!existing) {
    // Not HttpOnly on purpose: the client reads it too. Secure only over https so local http dev still works.
    res.cookies.set(RV_COOKIE, visitorId, { maxAge: COOKIE_MAX_AGE, path: "/", sameSite: "lax", secure: new URL(req.url).protocol === "https:" || process.env.NODE_ENV === "production" });
  }
  return res;
}
