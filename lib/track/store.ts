import "server-only";
import { cookies } from "next/headers";
import { adminClient } from "@/lib/supabase-server";
import { geoFromHeaders } from "@/lib/agent/obs";
import { RV_COOKIE, cleanEmail, clip, isBotSignal, parseUa, visitorIdFromCookie, type Batch } from "./schema";

/* Tracking writes. recordBatch is called by /api/t; identifyVisitor / identifyFromRequest are the
 * stitching hooks other routes call when a visitor gives an email. All use the service-role client. */

const TOUCH_MS = 30_000; // don't rewrite the visitor row more often than this unless the IP changed
const MAX_IPS = 20;

export type RecordResult = { status: "ok" | "forbidden"; enrichIp: string | null };

/** Stores one validated batch: upserts the visitor and visit, then appends the events. Returns "forbidden" when the
 *  visit id already belongs to another visitor (so nobody can inject events into someone else's visit) and the IP
 *  to enrich when it is new for this visitor. Bots get a flagged visit but no events. Throws on a database error. */
export async function recordBatch(h: Headers, visitorId: string, ip: string | null, batch: Batch): Promise<RecordResult> {
  const db = adminClient();
  const now = new Date();
  const ua = clip(h.get("user-agent"), 300);
  const bot = isBotSignal(ua, batch.ctx.webdriver);
  const geo = geoFromHeaders(h);
  const { data: v, error: ve } = await db.from("visitors").select("last_seen,last_ip,ips,visits").eq("id", visitorId).maybeSingle();
  if (ve) throw ve;

  let enrichIp: string | null = null;
  const visits = (v?.visits as number | undefined) ?? 0;
  if (!v) {
    const { browser, os, device } = parseUa(ua);
    const { error } = await db.from("visitors").insert({
      id: visitorId, first_ip: ip, last_ip: ip, ips: ip ? [ip] : [], ...geo, timezone: batch.ctx.tz, languages: batch.ctx.languages,
      user_agent: ua, browser, os, device, screen: batch.ctx.screen, first_referrer: batch.ctx.referrer, first_utm: batch.ctx.utm, is_bot: bot,
    });
    if (error && error.code !== "23505") throw error; // 23505: a parallel first batch created it
    enrichIp = ip;
  } else if (v.last_ip !== ip || now.getTime() - Date.parse(v.last_seen as string) > TOUCH_MS) {
    const ips = (v.ips as string[] | null) ?? [];
    const isNew = !!ip && !ips.includes(ip);
    const { error } = await db.from("visitors").update({
      last_seen: now.toISOString(), last_ip: ip, ...(isNew ? { ips: [...ips, ip].slice(-MAX_IPS) } : {}), ...geo,
    }).eq("id", visitorId);
    if (error) throw error;
    if (isNew) enrichIp = ip;
  }

  const { data: visit, error: vi } = await db.from("visits").select("visitor_id").eq("id", batch.visitId).maybeSingle();
  if (vi) throw vi;
  if (visit && visit.visitor_id !== visitorId) return { status: "forbidden", enrichIp: null };
  const last = new Date(Math.max(...batch.events.map((e) => e.at))).toISOString();
  if (!visit) {
    const c = batch.ctx;
    const { error } = await db.from("visits").insert({
      id: batch.visitId, visitor_id: visitorId, started_at: new Date(Math.min(...batch.events.map((e) => e.at))).toISOString(), ended_at: last,
      ip, entry_url: c.entry, referrer: c.referrer, utm: c.utm, design: c.design, viewport: c.viewport, tz: c.tz, lang: c.lang, is_bot: bot,
    });
    if (error && error.code !== "23505") throw error;
    if (!error) await db.from("visitors").update({ visits: visits + 1 }).eq("id", visitorId); // shortcut: read-modify-write, a rare parallel first visit may undercount
  } else {
    const { error } = await db.from("visits").update({ ended_at: last }).eq("id", batch.visitId);
    if (error) throw error;
  }

  if (!bot) {
    const { error } = await db.from("visit_events").insert(batch.events.map((e) => ({ visit_id: batch.visitId, at: new Date(e.at).toISOString(), type: e.type, data: e.data })));
    if (error) throw error;
  }
  return { status: "ok", enrichIp: bot ? null : enrichIp };
}

/** Attaches an email (and optionally name and company) to a visitor, stitching their browsing to who they are.
 *  Fire-and-forget safe: catches everything, returns whether a visitor row was updated. */
export async function identifyVisitor(visitorId: string | null, info: { email: string; name?: string; company?: string }): Promise<boolean> {
  const email = cleanEmail(info.email);
  if (!visitorId || !email) return false;
  try {
    const db = adminClient();
    const { data: v } = await db.from("visitors").select("identified_at").eq("id", visitorId).maybeSingle();
    if (!v) return false;
    const { error } = await db.from("visitors").update({
      email,
      ...(clip(info.name, 120) ? { name: clip(info.name, 120) } : {}),
      ...(clip(info.company, 120) ? { company_given: clip(info.company, 120) } : {}),
      identified_at: (v.identified_at as string | null) ?? new Date().toISOString(),
    }).eq("id", visitorId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("[track] identifyVisitor failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** identifyVisitor for whoever sent this request: reads the `rv_id` cookie from its headers. Wrap in `after()`. */
export function identifyFromRequest(req: Request, info: { email: string; name?: string; company?: string }): Promise<boolean> {
  return identifyVisitor(visitorIdFromCookie(req.headers.get("cookie")), info);
}

/** identifyVisitor from a server action or server component (no Request in hand): reads `rv_id` via next/headers cookies(). */
export async function identifyFromCookies(info: { email: string; name?: string; company?: string }): Promise<boolean> {
  return identifyVisitor(visitorIdFromCookie(`${RV_COOKIE}=${(await cookies()).get(RV_COOKIE)?.value ?? ""}`), info);
}

/** Deletes a visitor and everything under it (visits, events and replay rows cascade; replay files are removed first).
 *  Used when the owner marks a browser as his own, so earlier anonymous browsing from it leaves no trace. */
export async function purgeVisitor(visitorId: string): Promise<void> {
  try {
    const db = adminClient();
    const { data: visits } = await db.from("visits").select("id").eq("visitor_id", visitorId);
    const ids = (visits ?? []).map((v) => v.id as string);
    if (ids.length) {
      const { data: reps } = await db.from("replays").select("storage_path").in("visit_id", ids);
      const paths = (reps ?? []).map((r) => r.storage_path as string);
      if (paths.length) await db.storage.from("replays").remove(paths);
    }
    await db.from("visitors").delete().eq("id", visitorId);
  } catch (e) {
    console.error("[track] purgeVisitor failed:", e instanceof Error ? e.message : e);
  }
}
