"use server";
import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/supabase-server";
import { complete, AUX_MODEL } from "@/lib/openai";
import { describeEvent, offset } from "@/lib/track/views";
import { isUuid } from "@/lib/agent/obs";
import { requireAuth } from "./auth-helper";

const PROMPT = `You read the activity log of one visit to Rithvik Praveen Kumar's portfolio website and write a short, factual briefing for Rithvik.
Write two parts:
1. "What they did": 3-6 short sentences in time order, highlighting what they read longest, what they hovered or opened (projects, resume, email, the AI agent), what they asked the agent, what they copied, and how they left.
2. "What they seemed to want": 1-2 sentences inferring their likely intent and level of interest (e.g. a recruiter checking ML experience, a student browsing, a bot). Say how confident you are, and base it only on the log.
Plain text, no markdown headings, no bullet symbols other than the two labels. Never invent events.`;

/** Writes (once, then saved) an AI briefing of one visit: what the visitor did and what they seemed to want, from
 *  its events, who they are, and the questions they asked the agent. Admin only; a regenerate overwrites it. */
export async function explainVisit(visitId: string): Promise<{ story?: string; error?: string }> {
  await requireAuth();
  if (!isUuid(visitId)) return { error: "Bad visit." };
  const db = adminClient();
  const { data: v } = await db.from("visits").select("*").eq("id", visitId).maybeSingle();
  if (!v) return { error: "Visit not found." };
  const [{ data: who }, { data: events }, { data: sessions }] = await Promise.all([
    db.from("visitors").select("name,company,company_given,org,ip_type,city,region,country,device,browser,visits,role,visitor_kind,is_bot").eq("id", v.visitor_id).maybeSingle(),
    db.from("visit_events").select("type,at,data").eq("visit_id", visitId).order("at").limit(400),
    db.from("agent_sessions").select("id").eq("visitor_id", v.visitor_id).gte("created_at", new Date(Date.parse(v.started_at) - 60_000).toISOString()).lte("created_at", v.ended_at),
  ]);
  const ids = (sessions ?? []).map((s) => s.id as string);
  const { data: asked } = ids.length ? await db.from("agent_messages").select("content").in("session_id", ids).eq("role", "user").order("created_at").limit(20) : { data: [] };
  const log = (events ?? []).filter((e) => e.type !== "perf").map((e) => `${offset(v.started_at, e.at)} ${e.type}: ${describeEvent({ type: e.type, data: e.data })}`).join("\n").slice(0, 12_000);
  const profile = who ? Object.entries(who).filter(([, x]) => x !== null && x !== "").map(([k, x]) => `${k}: ${x}`).join(", ") : "unknown";
  const input = `Visitor: ${profile}\nVisit: started ${v.started_at}, entry ${v.entry_url ?? "?"}, from ${v.referrer ?? "direct"}, design ${v.design ?? "?"}, viewport ${v.viewport ?? "?"}\n\nEvents (offset from start):\n${log || "(none)"}\n\nQuestions they asked the agent:\n${(asked ?? []).map((m) => `- ${String(m.content).slice(0, 300)}`).join("\n") || "(none)"}`;
  try {
    const r = await complete({ model: AUX_MODEL, maxTokens: 700, reasoningEffort: "low", messages: [{ role: "system", content: PROMPT }, { role: "user", content: input }] });
    const story = r.content.trim().slice(0, 2000);
    if (!story) return { error: "No summary came back." };
    await db.from("visits").update({ story, story_at: new Date().toISOString() }).eq("id", visitId);
    revalidatePath(`/admin/visitors/${v.visitor_id}`);
    return { story };
  } catch (e) {
    console.error("[visits] explain failed:", e instanceof Error ? e.message : e);
    return { error: "Could not write the summary right now." };
  }
}
