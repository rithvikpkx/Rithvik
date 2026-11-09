import "server-only";
import { adminClient } from "@/lib/supabase-server";
import { normalizeIpinfo, type Enriched } from "./ipinfo";
import { isPublicIp } from "./schema";

const CACHE_MS = 30 * 86_400_000;
const MIN_GAP_MS = 1100;          // unauthenticated ipinfo is rate-limited; never burst
const BACKOFF_MS = 10 * 60_000;   // after a 429, stop asking for a while
let lastCall = 0;
let blockedUntil = 0;

/** Looks the IP up on ipinfo.io (Bearer `IPINFO_TOKEN` when set, else the free unauthenticated endpoint, throttled
 *  per instance), returning the raw JSON or null on any failure. Never throws. */
async function fetchIpinfo(ip: string): Promise<unknown | null> {
  const token = process.env.IPINFO_TOKEN;
  const now = Date.now();
  if (!token) {
    if (now < blockedUntil) return null;
    if (now - lastCall < MIN_GAP_MS) return null; // shortcut: skip rather than queue; the visitor is retried on their next new IP or visit
    lastCall = now;
  }
  try {
    const r = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(4000),
    });
    if (r.status === 429) { blockedUntil = now + BACKOFF_MS; return null; }
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Fills the visitor's company / org / asn / ip_type from their IP, using the 30-day `ip_enrichment` cache.
 *  Runs in `after()`, never on the request hot path; catches everything. */
export async function enrichVisitor(visitorId: string, ip: string | null): Promise<void> {
  if (!ip || !isPublicIp(ip)) return;
  try {
    const db = adminClient();
    const { data: cached } = await db.from("ip_enrichment").select("data,fetched_at").eq("ip", ip).maybeSingle();
    let e: Enriched;
    if (cached && Date.now() - Date.parse(cached.fetched_at as string) < CACHE_MS) {
      e = cached.data as Enriched;
    } else {
      const raw = await fetchIpinfo(ip);
      if (!raw) return;
      e = normalizeIpinfo(raw);
      await db.from("ip_enrichment").upsert({ ip, data: e, fetched_at: new Date().toISOString() });
    }
    const { error } = await db.from("visitors").update({ company: e.company, org: e.org, asn: e.asn, ip_type: e.ip_type }).eq("id", visitorId);
    if (error) throw error;
  } catch (err) {
    console.error("[track] enrich failed:", err instanceof Error ? err.message : err);
  }
}
