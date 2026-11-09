import "server-only";
import { adminClient } from "@/lib/supabase-server";
import { headers } from "next/headers";
import { ipBucket } from "@/lib/rate-limit";
import { isOwner, isOwnerHeaders } from "@/lib/track/owner";
import { visitorIdFromCookie } from "@/lib/track/schema";
import { clip, geoFromHeaders, hashIp, isUuid, safeInt, toMessageRow, type TurnRow } from "./obs";

/* Agent observability writes. Every export is fire-and-forget safe: it catches everything, logs
 * `[agentlog]` and returns, so a logging problem can never reach the chat path. On Vercel wrap calls in
 * `after(() => ...)` from "next/server" so the write finishes after the response is sent. */

/** Returns the visitor's session id: the one they sent if it exists, else a fresh server-generated row
 *  (a client-chosen id is never adopted, so ids stay unguessable). Null when logging is unavailable. */
export async function startSession(
  req: Request,
  sessionId?: string | null,
  opts: { firstDesign?: string; referrer?: string } = {},
): Promise<string | null> {
  // The owner's chats are logged (so Share works) but flagged `is_owner`, and skip visitor linking below.
  const owner = isOwner(req);
  try {
    const db = adminClient();
    if (isUuid(sessionId)) {
      const { data } = await db.from("agent_sessions").select("id").eq("id", sessionId).maybeSingle();
      if (data) return data.id as string;
    }
    const fwd = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
    if (!process.env.IP_HASH_SALT) console.warn("[agentlog] IP_HASH_SALT unset: storing no ip_hash");
    const { data, error } = await db
      .from("agent_sessions")
      .insert({
        ip_hash: hashIp(ipBucket(fwd), process.env.IP_HASH_SALT),
        ...geoFromHeaders(req.headers),
        user_agent: clip(req.headers.get("user-agent"), 300),
        referrer: clip(opts.referrer ?? req.headers.get("referer"), 300),
        first_design: clip(opts.firstDesign, 40),
        ...(owner ? { is_owner: true } : {}), // only sent for the owner, so the insert works before the migration is applied
      })
      .select("id")
      .single();
    if (error) throw error;
    // Link the conversation to the tracked visitor. A separate best-effort update so a missing column or an
    // unknown visitor id (FK) can never cost the session row itself.
    const visitorId = owner ? null : visitorIdFromCookie(req.headers.get("cookie"));
    if (visitorId) await db.from("agent_sessions").update({ visitor_id: visitorId }).eq("id", data.id);
    return data.id as string;
  } catch (e) {
    console.error("[agentlog] startSession failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Appends one turn's rows (user message, tool steps, assistant answer with telemetry) and bumps `last_at`. */
export async function logTurn(sessionId: string | null, rows: TurnRow[]): Promise<void> {
  if (!isUuid(sessionId) || rows.length === 0) return;
  try {
    const db = adminClient();
    const { error } = await db.from("agent_messages").insert(rows.map((r) => toMessageRow(sessionId, r)));
    if (error) throw error;
    await db.from("agent_sessions").update({ last_at: new Date().toISOString() }).eq("id", sessionId);
  } catch (e) {
    console.error("[agentlog] logTurn failed:", e instanceof Error ? e.message : e);
  }
}

/** Records one metrics-only row for the public status dashboard. Never pass message content here. */
export async function logRequest(m: {
  model?: string; tokensIn?: number; tokensOut?: number; ttfbMs?: number; totalMs?: number;
  status?: number; errorKind?: string; cached?: boolean; toolCount?: number;
}): Promise<void> {
  try {
    // No request is passed in, so read it from the ambient context; outside one it throws and we log.
    if (isOwnerHeaders(await headers())) return;
  } catch { /* no request context */ }
  try {
    const { error } = await adminClient().from("agent_requests").insert({
      model: clip(m.model, 80),
      tokens_in: safeInt(m.tokensIn),
      tokens_out: safeInt(m.tokensOut),
      ttfb_ms: safeInt(m.ttfbMs),
      total_ms: safeInt(m.totalMs),
      status: safeInt(m.status),
      error_kind: clip(m.errorKind, 60),
      cached: m.cached === true,
      tool_count: safeInt(m.toolCount) ?? 0,
    });
    if (error) throw error;
  } catch (e) {
    console.error("[agentlog] logRequest failed:", e instanceof Error ? e.message : e);
  }
}
