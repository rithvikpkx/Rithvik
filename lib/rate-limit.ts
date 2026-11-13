/** One visitor key's window: `used` of `limit` hits, `reset` = epoch seconds when the oldest hit ages out
 *  (null while the window is empty). */
export type RateInfo = { limit: number; used: number; remaining: number; reset: number | null };
export type RateLimitResult = { ok: true; info: RateInfo | null } | { ok: false; status: 429 | 503; retryAfter: number; info: RateInfo | null };

/** Chat turns allowed per visitor key per hour (shared by /api/chat and /api/chat/usage). */
export const CHAT_RATE_LIMIT = 60;

/** Builds a RateInfo from a count and the oldest hit in the window. Pure, so the arithmetic is testable. */
export function windowInfo(limit: number, used: number, oldestMs: number | null, windowSeconds = 3600): RateInfo {
  return { limit, used, remaining: Math.max(0, limit - used), reset: used > 0 && oldestMs !== null ? Math.ceil(oldestMs / 1000) + windowSeconds : null };
}

/** The X-RateLimit-* headers for a window (reset is epoch seconds); empty when the window is unknown. */
export function rateHeaders(info: RateInfo | null): Record<string, string> {
  if (!info) return {};
  return {
    "X-RateLimit-Limit": String(info.limit),
    "X-RateLimit-Remaining": String(info.remaining),
    ...(info.reset ? { "X-RateLimit-Reset": String(info.reset) } : {}),
  };
}

/** Reads (never records) a key's current window: one count query. Best effort: null when it can't be read. */
export async function peekRateLimit(bucket: string, key: string, limit: number, windowSeconds = 3600): Promise<RateInfo | null> {
  try {
    const { adminClient } = await import("@/lib/supabase-server");
    const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
    const { count, data, error } = await adminClient()
      .from("rate_limit_hits")
      .select("created_at", { count: "exact" })
      .eq("bucket", bucket).eq("key", key).gte("created_at", since)
      .order("created_at", { ascending: true }).limit(1);
    if (error || count === null) return null;
    return windowInfo(limit, count, data?.[0]?.created_at ? Date.parse(data[0].created_at) : null, windowSeconds);
  } catch {
    return null;
  }
}

/** Normalises a client IP into a rate-limit key: IPv4 as is, IPv6 truncated to
 *  its /64 (one subscriber's allocation, which they can rotate through freely),
 *  IPv4-mapped IPv6 back to IPv4. Unparseable input is returned lowercased. */
export function ipBucket(raw: string): string {
  const ip = raw.trim().toLowerCase().replace(/^\[|\](:\d+)?$/g, "").replace(/%.*$/, "");
  if (!ip.includes(":")) return ip;

  // A trailing dotted quad (::ffff:1.2.3.4) becomes two hex groups so one parser handles both forms.
  const dotted = ip.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  const q = dotted?.[2].split(".").map(Number) ?? [];
  const hex = dotted ? `${dotted[1]}${((q[0] << 8) | q[1]).toString(16)}:${((q[2] << 8) | q[3]).toString(16)}` : ip;

  const halves = hex.split("::");
  if (halves.length > 2) return ip;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  const groups = [...head, ...Array(fill).fill("0"), ...tail];
  if (groups.length !== 8 || fill < 0 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return ip;
  const n = groups.map((g) => parseInt(g, 16));

  if (n.slice(0, 5).every((x) => x === 0) && n[5] === 0xffff) {
    return [n[6] >> 8, n[6] & 255, n[7] >> 8, n[7] & 255].join(".");
  }
  return `${n.slice(0, 4).map((x) => x.toString(16)).join(":")}::/64`;
}

/** Best-effort client IP from Vercel's forwarding header, bucketed for limiting. */
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return ipBucket(fwd?.split(",")[0] ?? "") || "unknown";
}

/** Records one hit against `bucket` atomically (DB-side, see
 *  supabase/rate_limit_rpc_migration.sql). Fails CLOSED: if the limiter can't be
 *  reached the request is denied, since these routes spend money or send mail. */
export async function rateLimit(
  bucket: string,
  key: string,
  limit: number,
  globalLimit: number,
  windowSeconds = 3600,
): Promise<RateLimitResult> {
  // Lazy import keeps ipBucket testable under plain node (no Supabase env or "@/" alias).
  const { adminClient } = await import("@/lib/supabase-server");
  const { data, error } = await adminClient().rpc("rate_limit_hit", {
    p_bucket: bucket,
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
    p_global_limit: globalLimit,
  });
  const row = (data as { allowed: boolean; retry_after: number }[] | null)?.[0];
  if (error || !row) {
    console.error(`[ratelimit] ${bucket} rpc failed, denying:`, error?.message ?? "no row");
    return { ok: false, status: 503, retryAfter: 60, info: null };
  }
  if (!row.allowed) {
    const reset = Math.ceil(Date.now() / 1000) + row.retry_after;
    return { ok: false, status: 429, retryAfter: row.retry_after, info: { limit, used: limit, remaining: 0, reset } };
  }
  return { ok: true, info: await peekRateLimit(bucket, key, limit, windowSeconds) };
}
