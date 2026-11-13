import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase-server";
import { isOwner } from "@/lib/track/owner";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { MAX_REPLAY_CHUNK, MAX_REPLAY_TOTAL, isGzip, isUuid, parseSeq, visitorIdFromCookie } from "@/lib/track/schema";

const PER_IP_PER_HOUR = 600;
const GLOBAL_PER_HOUR = 20_000;

/** POST /api/t/replay: one gzip'd rrweb chunk (at most 512 KB) for a visit, stored as sent in the private `replays`
 *  bucket. The visit id (`x-rv-visit`) must belong to the cookie's visitor, a visit may hold at most 8 MB, and the
 *  bytes must start with the gzip magic number (they are decompressed only in the admin's browser, never here). */
export async function POST(req: Request) {
  if (isOwner(req)) return NextResponse.json({ ok: true, owner: true });
  const visitId = req.headers.get("x-rv-visit");
  const seq = parseSeq(req.headers.get("x-rv-seq"));
  const visitorId = visitorIdFromCookie(req.headers.get("cookie"));
  if (!isUuid(visitId) || seq === null || !visitorId) return NextResponse.json({ ok: false }, { status: 400 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_REPLAY_CHUNK) return NextResponse.json({ ok: false }, { status: 413 });

  const limited = await rateLimit("replay", clientKey(req), PER_IP_PER_HOUR, GLOBAL_PER_HOUR);
  if (!limited.ok) return NextResponse.json({ ok: false }, { status: limited.status, headers: { "Retry-After": String(limited.retryAfter) } });

  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.length > MAX_REPLAY_CHUNK) return NextResponse.json({ ok: false }, { status: 413 });
  if (!isGzip(buf)) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const db = adminClient();
    const { data: visit } = await db.from("visits").select("visitor_id,is_bot").eq("id", visitId.toLowerCase()).maybeSingle();
    if (!visit || visit.visitor_id !== visitorId) return NextResponse.json({ ok: false }, { status: 404 }); // the batch that creates the visit comes first
    if (visit.is_bot) return NextResponse.json({ ok: true });

    const { data: rows, error: re } = await db.from("replays").select("seq,bytes").eq("visit_id", visitId.toLowerCase());
    if (re) throw re;
    const others = (rows ?? []).filter((r) => r.seq !== seq).reduce((n, r) => n + (r.bytes as number), 0);
    if (others + buf.length > MAX_REPLAY_TOTAL) return NextResponse.json({ ok: false }, { status: 413 });

    const path = `${visitId.toLowerCase()}/${seq}.json.gz`;
    const up = await db.storage.from("replays").upload(path, buf, { contentType: "application/gzip", upsert: true });
    if (up.error) throw up.error;
    const { error } = await db.from("replays").upsert({ visit_id: visitId.toLowerCase(), seq, bytes: buf.length, storage_path: path, created_at: new Date().toISOString() });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[track] replay failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
