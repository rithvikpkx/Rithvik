import "server-only";
import { unstable_cache } from "next/cache";
import { adminClient } from "@/lib/supabase-server";
import { AUX_MODEL, CHAT_MODEL, complete } from "@/lib/openai";
import { DECLINE_MARKERS } from "@/lib/chat-actions";
import { estimateCost } from "@/lib/agent/pricing";
import { getStatus } from "@/lib/agent/status-server";
import { escapeLike } from "@/lib/agent/chats";
import { isUuid } from "@/lib/track/schema";
import type { VisitorRow } from "@/lib/track/views";
import { countryName, toPoints } from "./geo";
import { clusterQuestions, fillSeries, foldCountries, headline, periodRange, rankFeatures, rankLeads, ranked, rows, shapeKpis } from "./shape";
import { hourRhythm, sessionStrip, visitorActivity, type Activity, type Strip, type StripRow } from "./strips";
import type { AnswerSample, Dashboard, Period, PublicTraffic } from "./types";

/* Dashboard reads. Every aggregate runs in SQL (supabase/analytics_migration.sql); this module only calls the RPCs in
 * parallel and shapes them with the pure helpers. A missing RPC (migration not applied) degrades to empty data. */

type Obj = Record<string, unknown>;

/** Calls an RPC, returning null (and a warning) instead of throwing, so one missing piece never blanks the page. */
async function rpc(fn: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    const { data, error } = await adminClient().rpc(fn, args);
    if (error) throw error;
    return data;
  } catch (e) {
    console.warn(`[analytics] ${fn} unavailable:`, e instanceof Error ? e.message : e);
    return null;
  }
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/** Everything /admin shows for one period. Not cached: the owner expects live numbers, and it is a handful of RPCs. */
export async function getDashboard(period: Period, now = Date.now()): Promise<Dashboard> {
  const { since, until, prevSince, bucket } = periodRange(period, now);
  const iso = (d: Date | null) => d?.toISOString() ?? null;
  const [kpis, prev, an, out, status, rhythm, samples] = await Promise.all([
    rpc("admin_kpis", { p_since: iso(since), p_until: until.toISOString() }),
    prevSince ? rpc("admin_kpis", { p_since: iso(prevSince), p_until: iso(since) }) : Promise.resolve(null),
    rpc("admin_analytics", { p_since: iso(since), p_until: until.toISOString(), p_bucket: bucket, p_decline: DECLINE_MARKERS }),
    rpc("admin_outreach", { p_since: iso(since), p_until: until.toISOString(), p_limit: 150 }),
    getStatus().catch(() => null),
    visitRhythm(since, until),
    answerSamples(since, until),
  ]);
  const a = (an && typeof an === "object" ? an : {}) as Obj;
  const r = (a.rag && typeof a.rag === "object" ? a.rag : {}) as Obj;
  const v = (a.vitals && typeof a.vitals === "object" ? a.vitals : {}) as Obj;
  const k = shapeKpis(kpis);
  const p = prevSince ? shapeKpis(prev) : null;
  const models = rows(r.models).map((m) => ({ model: String(m.model ?? "unknown"), requests: n(m.requests) ?? 0, tokens: n(m.tokens) ?? 0 }));
  return {
    period, generatedAt: new Date(now).toISOString(), bucket, kpis: k, prev: p, headline: headline(k, p, period),
    series: fillSeries(a.series, since, until, bucket, ["visits", "visitors"]),
    rhythm,
    entries: ranked(a.entries),
    sections: rows(a.sections).map((s) => ({ label: String(s.label ?? "?"), value: n(s.value) ?? 0, dwell: n(s.dwell) })),
    scroll: [25, 50, 75, 100].map((pct) => ({ pct, visits: n(rows(a.scroll).find((s) => n(s.pct) === pct)?.visits) ?? 0 })),
    countries: ranked(a.countries, countryName),
    points: toPoints(rows(a.cities).map((c) => ({ city: (c.city as string) ?? null, region: (c.region as string) ?? null, country: (c.country as string) ?? null, lat: n(c.lat), lng: n(c.lng), value: n(c.value) ?? 0 }))),
    ipTypes: ranked(a.ipTypes), orgs: ranked(a.orgs), networks: ranked(a.networks),
    devices: ranked(a.devices), browsers: ranked(a.browsers), os: ranked(a.os), referrers: ranked(a.referrers), campaigns: ranked(a.campaigns),
    features: rankFeatures(a.features),
    rag: {
      conversations: n(r.conversations) ?? 0, chatters: n(r.chatters) ?? 0, turns: n(r.turns) ?? 0, answers: n(r.answers) ?? 0,
      cached: n(r.cached) ?? 0, errors: n(r.errors) ?? 0, declines: n(r.declines) ?? 0,
      ttfbP50: n(r.ttfbP50), ttfbP95: n(r.ttfbP95), totalP50: n(r.totalP50), totalP95: n(r.totalP95),
      tokens: models.reduce((s, m) => s + m.tokens, 0),
      costUsd: models.reduce((s, m) => s + estimateCost(m.model, m.tokens), 0),
      models, tools: ranked(r.tools),
      series: fillSeries(r.series, since, until, bucket, ["turns"]),
      questions: clusterQuestions(r.questions),
      samples,
    },
    leads: rankLeads(out),
    system: {
      uptime: status?.uptime ?? { "24h": null, "7d": null, "30d": null, recent: [] },
      jsErrors: ranked(a.jsErrors),
      vitals: { lcp: n(v.lcp), inp: n(v.inp), cls: n(v.cls), n: n(v.n) ?? 0 },
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null, model: CHAT_MODEL, auxModel: AUX_MODEL,
    },
  };
}

/** Visits per UTC hour of day in the window (bots excluded): the day ring. Capped rows, so "all" stays cheap. */
async function visitRhythm(since: Date | null, until: Date): Promise<number[]> {
  try {
    let qb = adminClient().from("visits").select("started_at").eq("is_bot", false).lt("started_at", until.toISOString())
      .order("started_at", { ascending: false }).limit(10_000);
    if (since) qb = qb.gte("started_at", since.toISOString());
    const { data, error } = await qb;
    if (error) throw error;
    return hourRhythm((data ?? []).map((v) => v.started_at as string));
  } catch (e) {
    console.warn("[analytics] rhythm unavailable:", e instanceof Error ? e.message : e);
    return Array<number>(24).fill(0);
  }
}

/** The newest 1500 answers in the window with their timings (owner sessions excluded): the latency strip plot. */
async function answerSamples(since: Date | null, until: Date): Promise<AnswerSample[]> {
  try {
    let qb = adminClient().from("agent_messages").select("created_at,ttfb_ms,total_ms,cached,status,error,agent_sessions!inner(is_owner)")
      .eq("role", "assistant").eq("agent_sessions.is_owner", false).lt("created_at", until.toISOString())
      .order("created_at", { ascending: false }).limit(1500);
    if (since) qb = qb.gte("created_at", since.toISOString());
    const { data, error } = await qb;
    if (error) throw error;
    return (data ?? []).map((m) => ({
      t: m.created_at as string, ttfb: n(m.ttfb_ms), total: n(m.total_ms), cached: m.cached === true,
      err: !!m.error || (n(m.status) ?? 0) >= 400,
    }));
  } catch (e) {
    console.warn("[analytics] answer samples unavailable:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** The numbers-only digest the AI summary sees: no names, emails, companies, cities or questions. */
export function summaryInput(d: Dashboard): Obj {
  return {
    period: d.period, kpis: { ...d.kpis, topSource: d.kpis.topSource?.host ?? null }, previous: d.prev && { ...d.prev, topSource: undefined },
    countries: d.countries.slice(0, 5).map((c) => [c.label, c.value]), referrers: d.referrers.slice(0, 5).map((c) => [c.label, c.value]),
    devices: d.devices.map((c) => [c.label, c.value]), topFeatures: d.features.slice(0, 6).map((f) => [f.label, f.visitors]),
    unusedFeatures: d.features.filter((f) => f.visitors === 0).length,
    scrollDepth: d.scroll.map((s) => [s.pct, s.visits]),
    agent: { conversations: d.rag.conversations, turns: d.rag.turns, cacheHits: d.rag.cached, errors: d.rag.errors, declines: d.rag.declines, p50FirstByteMs: d.rag.ttfbP50, costUsd: Math.round(d.rag.costUsd * 100) / 100 },
    followUps: { hot: d.leads.filter((l) => l.tier === "hot").length, warm: d.leads.filter((l) => l.tier === "warm").length },
  };
}

/** A 4-6 sentence plain-English read of the period from the AUX model. Cached per period and per set of numbers
 *  (the key is the digest itself), so re-opening the dashboard costs nothing until the numbers move. */
export const writeSummaryCached = unstable_cache(
  async (_period: Period, digest: string): Promise<string> => {
    const { content } = await complete({
      model: AUX_MODEL, maxTokens: 700, reasoningEffort: "minimal",
      messages: [
        { role: "system", content: "You write a short, plain-English status read for the owner of a personal portfolio site (rithvik.ai) from aggregate analytics JSON. 4 to 6 sentences, no lists, no headings. Say how things are going, what changed versus the previous period, what stands out, and one concrete thing worth doing next. Use only the numbers given; never invent people, companies or causes. If numbers are tiny, say so plainly." },
        { role: "user", content: digest },
      ],
    });
    return content.trim();
  },
  ["admin-summary"],
  { revalidate: 6 * 3600 },
);

/** /status traffic for one window: counts and country totals, countries under the floor folded into "other". */
export async function getPublicTraffic(kind: "24h" | "7d", now = Date.now()): Promise<PublicTraffic | null> {
  const { since, bucket } = periodRange(kind, now);
  const raw = await rpc("public_traffic", { p_since: since!.toISOString(), p_bucket: bucket });
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Obj;
  return {
    visits: n(r.visits) ?? 0, visitors: n(r.visitors) ?? 0,
    series: fillSeries(r.series, since, new Date(now), bucket, ["visits"]),
    ...foldCountries(r.countries),
  };
}

/** Both /status windows, cached 60s like the metrics payload (and shared by every visitor). */
export const getPublicTrafficCached = unstable_cache(
  async () => ({ "24h": await getPublicTraffic("24h"), "7d": await getPublicTraffic("7d") }),
  ["public-traffic"],
  { revalidate: 60 },
);

export const PAGE_SIZE = 40;
export type VisitorQuery = { q: string; country: string; type: string; identified: boolean; page: number };

/** One page of visitors, most recently seen first, with free-text search over who/where/network. Bots are hidden
 *  unless the type filter is "bot", which shows only them. */
export async function listVisitorsPage(f: VisitorQuery): Promise<{ rows: VisitorRow[]; total: number; activity: Record<string, Activity> }> {
  let qb = adminClient().from("visitors").select("*", { count: "estimated" }).eq("is_bot", f.type === "bot")
    .order("last_seen", { ascending: false }).range(f.page * PAGE_SIZE, f.page * PAGE_SIZE + PAGE_SIZE - 1);
  if (f.identified) qb = qb.not("email", "is", null);
  if (/^[A-Z]{2}$/.test(f.country)) qb = qb.eq("country", f.country);
  if (["business", "isp", "hosting", "edu"].includes(f.type)) qb = qb.eq("ip_type", f.type);
  if (f.q) {
    const like = `%${escapeLike(f.q).replace(/[,()]/g, " ")}%`; // commas and parens would break the or() filter syntax
    qb = qb.or(["name", "email", "company", "company_given", "org", "city"].map((c) => `${c}.ilike.${like}`).join(","));
  }
  const { data, error, count } = await qb;
  if (error) throw error;
  const rows = (data ?? []) as VisitorRow[];
  return { rows, total: count ?? 0, activity: await activityFor(rows.map((r) => r.id)) };
}

const KEY_EVENTS = ["agent_turn", "composer_send", "resume", "identify", "outbound", "overlay", "design"];

/** Each listed visitor's last 30 days of visits and key-event counts, for the list's activity strips. Best effort:
 *  a failure leaves the strips empty, never the list. */
async function activityFor(ids: string[]): Promise<Record<string, Activity>> {
  if (!ids.length) return {};
  try {
    const db = adminClient();
    const { data: visits, error } = await db.from("visits").select("id,visitor_id,started_at").in("visitor_id", ids)
      .gte("started_at", new Date(Date.now() - 30 * 86_400_000).toISOString()).limit(3000);
    if (error) throw error;
    const vids = (visits ?? []).map((v) => v.id as string).slice(0, 600); // keeps the in() list inside URL limits
    const ev = vids.length
      ? await db.from("visit_events").select("visit_id,type").in("visit_id", vids).in("type", KEY_EVENTS).limit(5000)
      : { data: [], error: null };
    if (ev.error) throw ev.error;
    return visitorActivity((visits ?? []) as { id: string; visitor_id: string; started_at: string }[], (ev.data ?? []) as { visit_id: string; type: string }[], Date.now());
  } catch (e) {
    console.warn("[analytics] visitor activity unavailable:", e instanceof Error ? e.message : e);
    return {};
  }
}

/** Glyph strips (question / tool / answer / error over the conversation's duration) for listed chats. Metrics columns
 *  only, never message text. Best effort, like activityFor. */
export async function sessionStrips(ids: string[]): Promise<Record<string, Strip>> {
  const ok = ids.filter((s) => isUuid(s));
  if (!ok.length) return {};
  try {
    const { data, error } = await adminClient().from("agent_messages")
      .select("session_id,created_at,role,status,error,cached,tokens_in,tokens_out").in("session_id", ok).order("created_at").order("id").limit(6000);
    if (error) throw error;
    const by = new Map<string, StripRow[]>();
    for (const m of data ?? []) by.set(m.session_id as string, [...(by.get(m.session_id as string) ?? []), m as StripRow]);
    return Object.fromEntries([...by].map(([id, r]) => [id, sessionStrip(r)]));
  } catch (e) {
    console.warn("[analytics] session strips unavailable:", e instanceof Error ? e.message : e);
    return {};
  }
}

/** The agent_messages rows of the given sessions, grouped by session (for rendering chat replicas). */
export async function messagesFor(sessionIds: string[]) {
  const ids = sessionIds.filter((s) => isUuid(s));
  if (!ids.length) return new Map<string, Obj[]>();
  const { data, error } = await adminClient().from("agent_messages").select("*").in("session_id", ids).order("created_at").order("id");
  if (error) throw error;
  const by = new Map<string, Obj[]>();
  for (const m of data ?? []) by.set(m.session_id as string, [...(by.get(m.session_id as string) ?? []), m]);
  return by;
}

/** The request's clock for relative times ("3h ago"): read once per page on the server so every row agrees. */
export async function serverNow(): Promise<number> {
  return Date.now();
}
