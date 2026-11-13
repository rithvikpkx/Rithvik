"use server";
import { headers } from "next/headers";
import { adminClient } from "@/lib/supabase-server";
import { ipBucket, rateLimit } from "@/lib/rate-limit";
import { isShareLive, isUuid, newShareToken, shareExpiry } from "@/lib/agent/obs";

export type ShareResult = { ok: true; path: string; expiresAt: string } | { ok: false; error: string };

const SHARE_PER_KEY = 5;    // new links per visitor key per hour
const SHARE_GLOBAL = 100;   // all visitors per hour

/** Creates (or returns the live) 30-day read-only link for the caller's own conversation. The session id is a
 *  server-generated random UUID that only this visitor's browser holds, so presenting it is the ownership
 *  proof. The link shows the transcript as it stands whenever it is opened (emails and phones redacted). */
export async function createShareLink(sessionId: string): Promise<ShareResult> {
  if (!isUuid(sessionId)) return { ok: false, error: "No conversation to share." };

  const fwd = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "";
  const limited = await rateLimit("share", ipBucket(fwd) || "unknown", SHARE_PER_KEY, SHARE_GLOBAL);
  if (!limited.ok) return { ok: false, error: limited.status === 429 ? "Too many links. Try again later." : "Could not share right now." };

  try {
    const db = adminClient();
    const { data: s } = await db.from("agent_sessions").select("share_token, share_expires_at").eq("id", sessionId).maybeSingle();
    if (!s) return { ok: false, error: "No conversation to share." };
    if (s.share_token && isShareLive(s.share_expires_at as string | null)) {
      return { ok: true, path: `/c/${s.share_token}`, expiresAt: s.share_expires_at as string };
    }
    const { count } = await db.from("agent_messages").select("id", { count: "exact", head: true }).eq("session_id", sessionId);
    if (!count) return { ok: false, error: "Nothing to share yet." };

    const token = newShareToken();
    const expiresAt = shareExpiry();
    const { error } = await db.from("agent_sessions").update({ share_token: token, share_expires_at: expiresAt }).eq("id", sessionId);
    if (error) throw error;
    return { ok: true, path: `/c/${token}`, expiresAt };
  } catch (e) {
    console.error("[agentlog] createShareLink failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "Could not share right now." };
  }
}
