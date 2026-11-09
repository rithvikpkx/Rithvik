import "server-only";
import { adminClient } from "@/lib/supabase-server";
import { dayAfter, escapeLike } from "@/lib/agent/chats";
import { isUuid } from "./schema";
import type { ChatLink, EventRow, VisitorFilters, VisitorRow, VisitRow } from "./views";

export const LIST_LIMIT = 200;
const EVENT_LIMIT = 5000;

/** Visitors matching the filters, most recently seen first (bots hidden unless asked for). Capped at LIST_LIMIT. */
export async function listVisitors(f: VisitorFilters): Promise<VisitorRow[]> {
  let qb = adminClient().from("visitors").select("*").order("last_seen", { ascending: false }).limit(LIST_LIMIT);
  if (!f.bots) qb = qb.eq("is_bot", false);
  if (f.identified) qb = qb.not("email", "is", null);
  if (f.country) qb = qb.eq("country", f.country);
  if (f.company) {
    const like = `%${escapeLike(f.company).replace(/[,()]/g, " ")}%`; // commas and parens would break the or() filter syntax
    qb = qb.or(`company.ilike.${like},org.ilike.${like},company_given.ilike.${like}`);
  }
  if (f.from) qb = qb.gte("last_seen", `${f.from}T00:00:00Z`);
  if (f.to) qb = qb.lt("last_seen", dayAfter(f.to));
  const { data, error } = await qb;
  if (error) throw error;
  return (data ?? []) as VisitorRow[];
}

export type VisitorDetail = {
  visitor: VisitorRow;
  visits: (VisitRow & { events: EventRow[]; replaySeqs: number[] })[];
  chats: ChatLink[];
};

/** One visitor with every visit (newest first), each visit's events in order and replay chunk list, and linked agent chats. */
export async function getVisitor(id: string): Promise<VisitorDetail | null> {
  if (!isUuid(id)) return null;
  const db = adminClient();
  const { data: visitor } = await db.from("visitors").select("*").eq("id", id).maybeSingle();
  if (!visitor) return null;
  const { data: visits, error } = await db.from("visits").select("*").eq("visitor_id", id).order("started_at", { ascending: false }).limit(50);
  if (error) throw error;
  const ids = (visits ?? []).map((v) => v.id as string);

  const [ev, rp, ss] = await Promise.all([
    ids.length ? db.from("visit_events").select("*").in("visit_id", ids).order("at").order("id").limit(EVENT_LIMIT) : Promise.resolve({ data: [], error: null }),
    ids.length ? db.from("replays").select("visit_id,seq").in("visit_id", ids).order("seq") : Promise.resolve({ data: [], error: null }),
    db.from("agent_sessions").select("id,created_at").eq("visitor_id", id).order("created_at", { ascending: false }),
  ]);
  if (ev.error) throw ev.error;
  if (rp.error) throw rp.error;
  if (ss.error) throw ss.error;

  const events = new Map<string, EventRow[]>();
  for (const e of (ev.data ?? []) as EventRow[]) events.set(e.visit_id, [...(events.get(e.visit_id) ?? []), e]);
  const seqs = new Map<string, number[]>();
  for (const r of rp.data ?? []) seqs.set(r.visit_id as string, [...(seqs.get(r.visit_id as string) ?? []), r.seq as number]);

  const sessions = ss.data ?? [];
  const turns = new Map<string, { n: number; first: string }>();
  if (sessions.length) {
    const { data: users } = await db.from("agent_messages").select("session_id,content").eq("role", "user").in("session_id", sessions.map((s) => s.id)).order("created_at");
    for (const m of users ?? []) {
      const t = turns.get(m.session_id) ?? { n: 0, first: m.content as string };
      t.n += 1;
      turns.set(m.session_id, t);
    }
  }
  return {
    visitor: visitor as VisitorRow,
    visits: ((visits ?? []) as VisitRow[]).map((v) => ({ ...v, events: events.get(v.id) ?? [], replaySeqs: seqs.get(v.id) ?? [] })),
    chats: sessions.map((s) => ({ id: s.id as string, created_at: s.created_at as string, visit_turns: turns.get(s.id)?.n ?? 0, preview: turns.get(s.id)?.first ?? "" })),
  };
}
