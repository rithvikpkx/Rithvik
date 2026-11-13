import "server-only";
import { adminClient } from "@/lib/supabase-server";
import { dayAfter, escapeLike, type Filters, type MessageRow, type SessionRow } from "./chats";
import { isShareLive, isShareToken, isUuid } from "./obs";

export const LIST_LIMIT = 200;

export type SessionSummary = SessionRow & { turns: number; preview: string };

/** Sessions matching the filters, newest first, each with its visitor-turn count and first question.
 *  Text search finds sessions through their messages (ilike, wildcards escaped). Capped at LIST_LIMIT. */
export async function listSessions(f: Filters): Promise<SessionSummary[]> {
  const db = adminClient();
  let ids: string[] | null = null;
  if (f.q) {
    const { data, error } = await db
      .from("agent_messages").select("session_id").ilike("content", `%${escapeLike(f.q)}%`).limit(1000);
    if (error) throw error;
    ids = [...new Set((data ?? []).map((r) => r.session_id as string))];
    if (ids.length === 0) return [];
  }
  let qb = db.from("agent_sessions").select("*").order("created_at", { ascending: false }).limit(LIST_LIMIT);
  if (ids) qb = qb.in("id", ids);
  if (f.email) qb = qb.not("visitor_email", "is", null);
  if (f.followUp) qb = qb.eq("follow_up", true);
  if (f.from) qb = qb.gte("created_at", `${f.from}T00:00:00Z`);
  if (f.to) qb = qb.lt("created_at", dayAfter(f.to));
  const { data: sessions, error } = await qb;
  if (error) throw error;
  if (!sessions?.length) return [];

  const { data: users, error: e2 } = await db
    .from("agent_messages").select("session_id, content")
    .eq("role", "user").in("session_id", sessions.map((s) => s.id)).order("created_at");
  if (e2) throw e2;
  const turns = new Map<string, { n: number; first: string }>();
  for (const m of users ?? []) {
    const t = turns.get(m.session_id) ?? { n: 0, first: m.content as string };
    t.n += 1;
    turns.set(m.session_id, t);
  }
  return (sessions as SessionRow[]).map((s) => ({ ...s, turns: turns.get(s.id)?.n ?? 0, preview: turns.get(s.id)?.first ?? "" }));
}

/** One session and its full transcript, or null for an unknown or malformed id. */
export async function getSession(id: string): Promise<{ session: SessionRow; messages: MessageRow[] } | null> {
  if (!isUuid(id)) return null;
  const db = adminClient();
  const { data: session } = await db.from("agent_sessions").select("*").eq("id", id).maybeSingle();
  if (!session) return null;
  const { data: messages, error } = await db
    .from("agent_messages").select("*").eq("session_id", id).order("created_at").order("id");
  if (error) throw error;
  return { session: session as SessionRow, messages: (messages ?? []) as MessageRow[] };
}

/** The transcript behind a share token, or null when the token is malformed, unknown or expired.
 *  Only user and assistant rows, only the columns the public view renders. */
export async function getSharedTranscript(token: string): Promise<{ role: "user" | "assistant"; content: string; model: string | null }[] | null> {
  if (!isShareToken(token)) return null;
  const db = adminClient();
  const { data: s } = await db.from("agent_sessions").select("id, share_expires_at").eq("share_token", token).maybeSingle();
  if (!s || !isShareLive(s.share_expires_at as string | null)) return null;
  const { data, error } = await db
    .from("agent_messages").select("role, content, model").eq("session_id", s.id).in("role", ["user", "assistant"]).order("created_at").order("id");
  if (error) throw error;
  return (data ?? []) as { role: "user" | "assistant"; content: string; model: string | null }[];
}
