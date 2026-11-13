/** Pure shaping for the admin dashboard: periods, gap-free series, deltas, the headline sentence, the feature
 *  ranking, question clustering, follow-up scoring and the public country fold. No server imports (node:test). */
import { DESIGNS, designById } from "../designs/registry.ts";
import { countryName } from "./geo.ts";
import type { Bucket, Feature, Kpis, Lead, Period, PublicTraffic, Question, Ranked } from "./types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const PERIODS: Period[] = ["24h", "7d", "30d", "all"];
export const PERIOD_LABEL: Record<Period, string> = { "24h": "24 hours", "7d": "7 days", "30d": "30 days", all: "All time" };

type Obj = Record<string, unknown>;
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : 0);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
export const rows = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter((x): x is Obj => !!x && typeof x === "object") : []);

/** A period from the query string; anything else is 7 days. */
export function parsePeriod(v: unknown): Period {
  return PERIODS.includes(v as Period) ? (v as Period) : "7d";
}

/** The window for a period, aligned to bucket boundaries, plus the equal-length window before it (null for "all"). */
export function periodRange(p: Period, now: number): { since: Date | null; until: Date; prevSince: Date | null; bucket: Bucket } {
  const until = new Date(now);
  if (p === "all") return { since: null, until, prevSince: null, bucket: "day" };
  const bucket: Bucket = p === "24h" ? "hour" : "day";
  const unit = bucket === "hour" ? HOUR : DAY;
  const n = p === "24h" ? 24 : p === "7d" ? 7 : 30;
  const since = Math.floor(now / unit) * unit - (n - 1) * unit;
  return { since: new Date(since), until, prevSince: new Date(since - n * unit), bucket };
}

/** Every bucket from `since` (or the first data point) to `until`, zero-filled, so charts keep a stable x-axis. */
export function fillSeries<K extends string>(raw: unknown, since: Date | null, until: Date, bucket: Bucket, keys: K[]): ({ t: string } & Record<K, number>)[] {
  const unit = bucket === "hour" ? HOUR : DAY;
  const by = new Map<number, Obj>();
  for (const r of rows(raw)) { const t = Date.parse(str(r.t)); if (Number.isFinite(t)) by.set(Math.floor(t / unit) * unit, r); }
  const first = since ? since.getTime() : by.size ? Math.min(...by.keys()) : Math.floor(until.getTime() / unit) * unit;
  const last = Math.floor((until.getTime() - 1) / unit) * unit;
  const out: ({ t: string } & Record<K, number>)[] = [];
  for (let t = Math.floor(first / unit) * unit, i = 0; t <= last && i < 800; t += unit, i++) {
    const r = by.get(t);
    out.push({ t: new Date(t).toISOString(), ...Object.fromEntries(keys.map((k) => [k, num(r?.[k])])) } as { t: string } & Record<K, number>);
  }
  return out;
}

/** The admin_kpis RPC result, with every field defaulted. */
export function shapeKpis(raw: unknown): Kpis {
  const r = (raw && typeof raw === "object" ? raw : {}) as Obj;
  const ts = r.topSource && typeof r.topSource === "object" ? (r.topSource as Obj) : null;
  return {
    visits: num(r.visits), visitors: num(r.visitors), returning: num(r.returning), identified: num(r.identified),
    meetings: num(r.meetings), emails: num(r.emails), chats: num(r.chats), avgActiveMs: numOrNull(r.avgActiveMs),
    bounces: num(r.bounces), topSource: ts ? { host: str(ts.host), visits: num(ts.visits) } : null,
  };
}

/** Relative change cur vs prev (0.25 = +25%); null when there is no previous period or it was zero. */
export function delta(cur: number, prev: number | null | undefined): number | null {
  return typeof prev === "number" && prev > 0 ? (cur - prev) / prev : null;
}

/** Ranked rows ({label, value, ...}) from an RPC array; non-string labels become "unknown". */
export function ranked(raw: unknown, label = (s: string) => s): Ranked[] {
  return rows(raw).map((r) => ({ label: label(str(r.label) || "unknown"), value: num(r.value), ...(r.type ? { sub: str(r.type) } : {}) }));
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** One deterministic "how things are going" sentence pair for the period. */
export function headline(k: Kpis, prev: Kpis | null, p: Period): string {
  const span = p === "all" ? "so far" : p === "24h" ? "in the last 24 hours" : `in the last ${p === "7d" ? "7" : "30"} days`;
  if (k.visits === 0) return `No visits ${span} yet. Numbers appear here as soon as someone opens the site.`;
  const d = delta(k.visits, prev?.visits);
  const mood = d === null ? "" : d >= 0.25 ? "A strong stretch: " : d <= -0.25 ? "A quieter stretch: " : "Steady: ";
  const trend = d === null ? "" : `, ${d >= 0 ? "up" : "down"} ${pct(Math.abs(d))} on the period before`;
  const parts = [`${mood}${plural(k.visits, "visit")} from ${plural(k.visitors, "person", "people")} ${span}${trend}.`];
  const asks = [k.meetings ? plural(k.meetings, "meeting request") : "", k.emails ? plural(k.emails, "email") : "", k.identified ? `${k.identified} identified` : ""].filter(Boolean);
  if (asks.length) parts.push(`${asks.join(", ")}.`);
  if (k.topSource && k.topSource.host !== "direct") parts.push(`${k.topSource.host} sent the most people.`);
  else if (k.topSource) parts.push("Most people came direct.");
  return parts.join(" ");
}

/* ── features ─────────────────────────────────────────────────────────────────────────────────────────────── */

/** Everything a visitor can do that the tracker sees, so a feature nobody used still shows up as "least used". */
const CATALOG: [key: string, label: string, group: string][] = [
  ["overlay:agent", "Opened the agent", "Agent"], ["agent_turn", "Asked the agent", "Agent"], ["voice", "Push-to-talk voice", "Agent"],
  ["speak", "Spoken replies", "Agent"], ["share", "Shared a conversation", "Agent"], ["chat_export", "Exported a chat", "Agent"],
  ["ask_this", "Ask about this (selection)", "Agent"], ["overlay:composer", "Opened the composer", "Contact"], ["composer_send", "Sent an email", "Contact"],
  ["copy_email", "Copied the email address", "Contact"], ["resume:open", "Opened the resume", "Resume"], ["resume:download", "Downloaded the resume", "Resume"],
  ["overlay:case", "Opened a case study", "Work"], ["play:menu", "Opened Play", "Play"], ["lite", "Performance mode", "Site"], ["deeplink", "Arrived by deep link", "Site"],
  ...DESIGNS.map((d): [string, string, string] => [`design:${d.id}`, `Design: ${d.name}`, "Looks"]),
];
const KNOWN = new Map(CATALOG.map(([k, l, g]) => [k, { label: l, group: g }]));

/** Label + group for a feature key, including the open-ended families (play:<game>, palette:<slug>, outbound:<host>). */
export function featureLabel(key: string): { label: string; group: string } {
  const k = KNOWN.get(key);
  if (k) return k;
  const [fam, rest = ""] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  if (fam === "play") return { label: `Play: ${rest}`, group: "Play" };
  if (fam === "palette") return { label: `Palette: ${rest.replace(/-/g, " ")}`, group: "Looks" };
  if (fam === "design") return { label: `Design: ${designById(rest)?.name ?? rest}`, group: "Looks" };
  if (fam === "outbound") return { label: `Link out: ${rest}`, group: "Links" };
  if (fam === "overlay") return { label: `Opened ${rest}`, group: "Site" };
  return { label: key, group: "Other" };
}

/** Observed features merged into the catalog (zeros kept), ranked by people then uses. overlay:resume and overlay:play
 *  duplicate resume:open / play:<game>, so they are dropped. */
export function rankFeatures(raw: unknown): Feature[] {
  const by = new Map<string, Feature>();
  for (const [key, { label, group }] of KNOWN) by.set(key, { key, label, group, uses: 0, visitors: 0 });
  for (const r of rows(raw)) {
    const key = str(r.key);
    if (!key || key === "overlay:resume" || key === "overlay:play") continue;
    by.set(key, { key, ...featureLabel(key), uses: num(r.uses), visitors: num(r.visitors) });
  }
  return [...by.values()].sort((a, b) => b.visitors - a.visitors || b.uses - a.uses || a.label.localeCompare(b.label));
}

/* ── questions ────────────────────────────────────────────────────────────────────────────────────────────── */

const STOP = new Set("a an the is are was were be been do does did doing has have had he his him rithvik rithviks rithvik's praveen kumar what whats what's which who whom how why when where can could would will you your me my i about tell of in on at to for with and or any some there this that it its please give list show".split(" "));

const IRREGULAR: Record<string, string> = { built: "build", made: "make", went: "go", taught: "teach", won: "win", led: "lead" };

/** A clustering key: lower-case content words, light stemming, sorted, so rewordings of one question collide. */
export function questionKey(q: string): string {
  const words = q.toLowerCase().replace(/[^a-z0-9\s'+#.]/g, " ").split(/\s+/)
    .map((w) => w.replace(/^'+|'+$|\.+$/g, "")).filter((w) => w && !STOP.has(w))
    .map((w) => IRREGULAR[w] ?? w.replace(/(ing|ed|es|s)$/, "").replace(/(.)\1$/, "$1"));
  return [...new Set(words)].sort().join(" ");
}

/** Top question clusters: count, how many were declined, the most common wording and one conversation to open. */
export function clusterQuestions(raw: unknown, top = 12): Question[] {
  const groups = new Map<string, { texts: Map<string, number>; count: number; declined: number; sid: string | null }>();
  for (const r of rows(raw)) {
    const text = str(r.q).trim().replace(/\s+/g, " ").slice(0, 200);
    if (!text) continue;
    const key = questionKey(text) || text.toLowerCase();
    const g = groups.get(key) ?? { texts: new Map(), count: 0, declined: 0, sid: null };
    g.count += 1;
    if (r.declined === true) g.declined += 1;
    g.sid ??= typeof r.sid === "string" ? r.sid : null;
    g.texts.set(text, (g.texts.get(text) ?? 0) + 1);
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => ({ text: [...g.texts].sort((a, b) => b[1] - a[1])[0][0], count: g.count, declined: g.declined, sid: g.sid }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, top);
}

/* ── follow-ups ───────────────────────────────────────────────────────────────────────────────────────────── */

/** Scores one admin_outreach row with transparent signals (each signal names what it saw). Max 100. */
export function scoreLead(r: Obj): Lead {
  const s: [number, string][] = [];
  const n = (k: string) => num(r[k]);
  const company = str(r.company) || null;
  const type = str(r.ip_type) || null;
  if (n("meetings") > 0) s.push([40, "Requested a meeting"]);
  if (n("emails") > 0) s.push([30, n("emails") > 1 ? `Sent ${n("emails")} emails` : "Sent an email"]);
  if (r.email) s.push([12, "Left an email"]);
  if (n("resume_downloads") > 0) s.push([15, "Downloaded the resume"]);
  else if (n("resume_opens") > 0) s.push([6, "Opened the resume"]);
  const visits = Math.max(n("visits"), n("total_visits"));
  if (visits > 1) s.push([Math.min(visits - 1, 4) * 6, `${visits} visits`]);
  const mins = n("active_ms") / 60_000;
  if (mins >= 1) s.push([Math.round(Math.min(mins, 10) * 2), `${Math.round(mins)} min active`]);
  if (company && type === "business") s.push([8, `Company network: ${company}`]);
  else if (company && type === "edu") s.push([5, `University network: ${company}`]);
  if (n("cases") > 0) s.push([Math.min(n("cases"), 4) * 3, `${plural(n("cases"), "case study", "case studies")} opened`]);
  if (n("turns") > 0) s.push([Math.min(n("turns"), 5) * 2, `${plural(n("turns"), "question")} to the agent`]);
  if (n("sections") >= 5) s.push([4, `Read ${n("sections")} sections`]);
  const score = Math.min(100, s.reduce((a, [w]) => a + w, 0));
  const place = [str(r.city), str(r.region), str(r.country)].filter(Boolean).join(", ") || "Unknown place";
  return {
    id: str(r.id), who: str(r.name) || str(r.email) || company || str(r.org) || "Anonymous visitor", email: str(r.email) || null, company, place,
    ipType: type, lastSeen: str(r.last_seen), score, tier: score >= 50 ? "hot" : score >= 25 ? "warm" : "cool",
    signals: s.sort((a, b) => b[0] - a[0]).map(([, t]) => t), lastChat: str(r.last_chat) || null,
  };
}

/** Leads worth a look, best first; visitors with no signal at all are left out. */
export function rankLeads(raw: unknown, top = 25): Lead[] {
  return rows(raw).map(scoreLead).filter((l) => l.score > 0).sort((a, b) => b.score - a.score || b.lastSeen.localeCompare(a.lastSeen)).slice(0, top);
}

/* ── public /status ───────────────────────────────────────────────────────────────────────────────────────── */

/** Countries with at least `min` visitors are named; the rest fold into `other`, so a lone visitor's country is
 *  never published. Labels are full country names. */
export function foldCountries(raw: unknown, min = 3): { countries: PublicTraffic["countries"]; other: number } {
  const named: PublicTraffic["countries"] = [];
  let other = 0;
  for (const r of rows(raw)) {
    const code = str(r.country).toUpperCase();
    const v = num(r.visitors);
    if (/^[A-Z]{2}$/.test(code) && v >= min) named.push({ code, name: countryName(code), visitors: v });
    else other += v;
  }
  return { countries: named.sort((a, b) => b.visitors - a.visitors), other };
}
