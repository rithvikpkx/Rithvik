/** A realistic, deterministic Dashboard for the /lab/dashboard harness (the real page needs a login and live data).
 *  Built through the same shaping helpers as production, so the lab exercises them too. Never served by /admin. */
import { toPoints, countryName } from "./geo.ts";
import { clusterQuestions, fillSeries, headline, periodRange, rankFeatures, rankLeads, shapeKpis } from "./shape.ts";
import type { Dashboard, Period } from "./types";
import type { MessageRow } from "../agent/chats";

/** Small seeded generator so the fixture is identical on every render. */
function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

const CITIES: [string, string, string, number, number, number][] = [
  ["San Francisco", "CA", "US", 37.77, -122.42, 61], ["New York", "NY", "US", 40.71, -74.0, 44], ["Seattle", "WA", "US", 47.61, -122.33, 29],
  ["West Lafayette", "IN", "US", 40.43, -86.91, 38], ["Boston", "MA", "US", 42.36, -71.06, 22], ["Austin", "TX", "US", 30.27, -97.74, 14],
  ["Chicago", "IL", "US", 41.88, -87.63, 12], ["Toronto", "ON", "CA", 43.65, -79.38, 11], ["London", "ENG", "GB", 51.51, -0.13, 17],
  ["Berlin", "BE", "DE", 52.52, 13.4, 9], ["Bengaluru", "KA", "IN", 12.97, 77.59, 26], ["Hyderabad", "TG", "IN", 17.39, 78.49, 13],
  ["Singapore", "", "SG", 1.35, 103.82, 7], ["Tokyo", "13", "JP", 35.68, 139.69, 5], ["Sydney", "NSW", "AU", -33.87, 151.21, 4],
  ["Zurich", "ZH", "CH", 47.37, 8.54, 4], ["Tel Aviv", "TA", "IL", 32.08, 34.78, 3], ["São Paulo", "SP", "BR", -23.55, -46.63, 3],
];

/** The fixture as of `now` for `period`. */
export function dashboardFixture(period: Period = "7d", now = Date.UTC(2026, 10, 9, 18, 0)): Dashboard {
  const r = rng(42);
  const { since, until, bucket } = periodRange(period, now);
  const scale = period === "24h" ? 0.16 : period === "7d" ? 1 : period === "30d" ? 3.6 : 5.2;
  const series = fillSeries([], since ?? new Date(now - 60 * 86400_000), until, bucket, ["visits", "visitors"]).map((s, i, a) => {
    const h = new Date(s.t).getUTCHours();
    const wave = bucket === "hour" ? 0.3 + 0.7 * Math.max(0, Math.sin(((h - 13) / 24) * Math.PI * 2 + 1.2)) : 0.55 + 0.45 * Math.sin(i / 2.1) + (i === a.length - 3 ? 1.1 : 0);
    const visits = Math.round((bucket === "hour" ? 9 : 52) * wave * (0.75 + r() * 0.5));
    return { ...s, visits, visitors: Math.round(visits * (0.68 + r() * 0.12)) };
  });
  const visits = series.reduce((s, x) => s + x.visits, 0);
  const visitors = series.reduce((s, x) => s + x.visitors, 0);
  const k = shapeKpis({ visits, visitors, returning: Math.round(visitors * 0.27), identified: Math.round(6 * scale), meetings: Math.round(3 * scale), emails: Math.round(5 * scale), chats: Math.round(58 * scale), avgActiveMs: 94_000, bounces: Math.round(visits * 0.31), topSource: { host: "linkedin.com", visits: Math.round(visits * 0.34) } });
  const prev = period === "all" ? null : shapeKpis({ visits: Math.round(visits * 0.78), visitors: Math.round(visitors * 0.81), returning: Math.round(visitors * 0.22), identified: Math.round(4 * scale), meetings: Math.round(2 * scale), emails: Math.round(5 * scale), chats: Math.round(44 * scale), avgActiveMs: 81_000, bounces: Math.round(visits * 0.78 * 0.36) });
  const f = (x: number) => Math.max(1, Math.round(x * scale));
  const cityRows = CITIES.map(([city, region, country, lat, lng, n]) => ({ city, region, country, lat, lng, value: f(n) }));
  const byCountry = new Map<string, number>();
  for (const c of cityRows) byCountry.set(c.country, (byCountry.get(c.country) ?? 0) + c.value);
  const lead = (o: Record<string, unknown>) => ({ last_seen: new Date(now - r() * 5 * 86400_000).toISOString(), ...o });
  const tokens = Math.round(310_000 * scale);
  return {
    period, generatedAt: new Date(now).toISOString(), bucket, kpis: k, prev, headline: headline(k, prev, period),
    series,
    entries: [["/", 0.71], ["/?theme=nimbus", 0.09], ["/work/boiler-frame", 0.07], ["/status", 0.04], ["/c/…", 0.03], ["/privacy", 0.02]].map(([l, s]) => ({ label: l as string, value: Math.round(visits * (s as number)) })),
    sections: [["top", 1, 14], ["work", 0.78, 52], ["experience", 0.61, 33], ["about", 0.48, 21], ["play", 0.36, 46], ["questions", 0.29, 18], ["contact", 0.24, 12]].map(([l, s, dw]) => ({ label: l as string, value: Math.round(visits * 0.92 * (s as number)), dwell: dw as number })),
    scroll: [[25, 0.82], [50, 0.61], [75, 0.42], [100, 0.27]].map(([pct, s]) => ({ pct, visits: Math.round(visits * s) })),
    countries: [...byCountry].sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ label: countryName(c), value: v })),
    points: toPoints(cityRows),
    ipTypes: [["isp", 0.52], ["business", 0.21], ["edu", 0.17], ["hosting", 0.1]].map(([l, s]) => ({ label: l as string, value: Math.round(visitors * (s as number)) })),
    orgs: [["Purdue University", "edu", 31], ["Google", "business", 9], ["Anduril Industries", "business", 6], ["Meta", "business", 5], ["Massachusetts Institute of Technology", "edu", 4], ["Stripe", "business", 3], ["Jane Street", "business", 2], ["Neuralink", "business", 2]].map(([l, t, v]) => ({ label: l as string, sub: t as string, value: f(v as number) })),
    networks: [["Comcast Cable", "isp", 41], ["AT&T Services", "isp", 22], ["Purdue University", "edu", 31], ["Google LLC", "business", 9], ["Amazon.com", "hosting", 8], ["Reliance Jio", "isp", 12]].map(([l, t, v]) => ({ label: l as string, sub: t as string, value: f(v as number) })).sort((a, b) => b.value - a.value),
    devices: [{ label: "desktop", value: Math.round(visitors * 0.64) }, { label: "mobile", value: Math.round(visitors * 0.33) }, { label: "tablet", value: Math.round(visitors * 0.03) }],
    browsers: [["Chrome", 0.58], ["Safari", 0.29], ["Firefox", 0.06], ["Edge", 0.05], ["Arc", 0.02]].map(([l, s]) => ({ label: l as string, value: Math.round(visitors * (s as number)) })),
    os: [["macOS", 0.47], ["iOS", 0.24], ["Windows", 0.17], ["Android", 0.08], ["Linux", 0.04]].map(([l, s]) => ({ label: l as string, value: Math.round(visitors * (s as number)) })),
    referrers: [["linkedin.com", 0.34], ["direct", 0.29], ["google.com", 0.13], ["github.com", 0.09], ["news.ycombinator.com", 0.05], ["t.co", 0.03], ["purdue.edu", 0.02]].map(([l, s]) => ({ label: l as string, value: Math.round(visits * (s as number)) })),
    campaigns: [{ label: "linkedin / profile", value: f(41) }, { label: "resume / pdf", value: f(17) }, { label: "github / readme", value: f(9) }],
    features: rankFeatures([
      ["overlay:agent", 160, 96], ["agent_turn", 410, 81], ["overlay:case", 230, 88], ["design:nimbus", 64, 52], ["design:mercury", 51, 44], ["design:glyph", 38, 31], ["design:thermal", 22, 19],
      ["resume:open", 77, 63], ["resume:download", 29, 26], ["overlay:composer", 33, 28], ["composer_send", 9, 8], ["play:typeracer", 41, 23], ["play:angle", 18, 12], ["play:menu", 30, 27],
      ["palette:dracula", 14, 12], ["palette:tokyo-night", 9, 8], ["copy_email", 15, 14], ["deeplink", 21, 21], ["outbound:github.com", 39, 33], ["outbound:linkedin.com", 25, 22], ["share", 4, 4], ["voice", 6, 5], ["lite", 3, 3], ["ask_this", 7, 6],
    ].map(([key, uses, v]) => ({ key, uses: f(uses as number), visitors: f(v as number) }))),
    rag: {
      conversations: k.chats, chatters: Math.round(k.chats * 0.86), turns: Math.round(k.chats * 3.1), answers: Math.round(k.chats * 3.1), cached: Math.round(k.chats * 0.6), errors: f(2), declines: f(9),
      ttfbP50: 640, ttfbP95: 1490, totalP50: 2400, totalP95: 5300, tokens, costUsd: tokens * 0.000000155,
      models: [{ model: "gpt-6-luna", requests: Math.round(k.chats * 2.8), tokens: Math.round(tokens * 0.94) }, { model: "gpt-5-nano", requests: Math.round(k.chats * 0.3), tokens: Math.round(tokens * 0.06) }],
      tools: [["search", 96], ["open_case", 41], ["calendar", 18], ["open_resume", 15], ["draft_email", 11], ["request_meeting", 4], ["set_theme", 9]].map(([l, v]) => ({ label: l as string, value: f(v as number) })).sort((a, b) => b.value - a.value),
      series: fillSeries([], since ?? new Date(now - 60 * 86400_000), until, bucket, ["turns"]).map((s, i) => ({ ...s, turns: Math.round(series[i]?.visits * 0.42 * (0.6 + r() * 0.8)) || 0 })),
      questions: clusterQuestions([
        ...Array(14).fill({ q: "What has he built?", sid: "123e4567-e89b-12d3-a456-426614174999" }), ...Array(5).fill({ q: "what did he build" }),
        ...Array(11).fill({ q: "Does he have computer vision experience?" }), ...Array(9).fill({ q: "Is he available for a summer 2027 internship?" }),
        ...Array(7).fill({ q: "What's his strongest project?" }), ...Array(6).fill({ q: "Can I book a call with him?" }), ...Array(4).fill({ q: "What is his GPA?", declined: true }),
        ...Array(3).fill({ q: "Tell me about the brain-computer interface work" }), ...Array(2).fill({ q: "Who won the world cup?", declined: true }),
      ]),
    },
    leads: rankLeads([
      lead({ id: "123e4567-e89b-12d3-a456-426614174000", name: "Ada Recruiter", email: "ada@acme.example", company: "Acme Robotics", ip_type: "business", city: "San Francisco", region: "CA", country: "US", meetings: 1, emails: 1, resume_downloads: 1, visits: 3, active_ms: 512_000, cases: 3, turns: 6, sections: 7, last_chat: "123e4567-e89b-12d3-a456-426614174999" }),
      lead({ id: "523e4567-e89b-12d3-a456-426614174000", company: "Anduril Industries", ip_type: "business", city: "Costa Mesa", region: "CA", country: "US", resume_downloads: 1, visits: 4, active_ms: 380_000, cases: 2, sections: 6 }),
      lead({ id: "623e4567-e89b-12d3-a456-426614174000", email: "j.chen@mit.example", name: "Jordan Chen", company: "Massachusetts Institute of Technology", ip_type: "edu", city: "Cambridge", region: "MA", country: "US", emails: 1, visits: 2, active_ms: 240_000, turns: 3 }),
      lead({ id: "723e4567-e89b-12d3-a456-426614174000", company: "Google", ip_type: "business", city: "Mountain View", region: "CA", country: "US", visits: 2, active_ms: 300_000, cases: 4, resume_opens: 1, sections: 5 }),
      lead({ id: "823e4567-e89b-12d3-a456-426614174000", org: "Comcast Cable", ip_type: "isp", city: "Chicago", region: "IL", country: "US", visits: 3, active_ms: 420_000, turns: 5, resume_opens: 1 }),
      lead({ id: "923e4567-e89b-12d3-a456-426614174000", company: "Purdue University", ip_type: "edu", city: "West Lafayette", region: "IN", country: "US", visits: 5, active_ms: 130_000, cases: 1 }),
    ]),
    system: {
      uptime: { "24h": 1, "7d": 0.9993, "30d": 0.9987, recent: Array.from({ length: 288 }, (_, i) => ({ t: new Date(now - (287 - i) * 300_000).toISOString(), ok: i !== 170, ms: 160 + ((i * 37) % 120) })) },
      jsErrors: [{ label: "TypeError: Cannot read properties of null (reading 'getContext')", value: f(3) }, { label: "rejection: The user aborted a request.", value: f(2) }],
      vitals: { lcp: 1180, inp: 96, cls: 0.004, n: Math.round(visits * 0.7) },
      commit: "d8d6137", model: "gpt-6-luna", auxModel: "gpt-5-nano",
    },
  };
}

const m = (i: number, role: "user" | "assistant" | "tool", content: string, extra: Record<string, unknown> = {}): MessageRow => ({
  id: i, created_at: new Date(Date.UTC(2026, 10, 9, 14, 3, 20) + i * 9000).toISOString(), role, content, tools: null, sources: null, model: null,
  tokens_in: null, tokens_out: null, ttfb_ms: null, total_ms: null, status: null, error: null, cached: false, ...extra,
});
/** A stored conversation (agent_messages rows) for the replica in the lab. */
export const fixtureMessages: MessageRow[] = [
  m(1, "user", "Does he have computer vision experience?"),
  m(2, "tool", "search", { tools: { name: "search", args: { q: "computer vision projects" }, result: "4 records" } }),
  m(3, "assistant", "Yes. His strongest computer vision work is **Boiler Frame** [1], a real-time pose-tracking rig built at Purdue, and the perception stack for the **Tracker** demo [2].\n\n- Boiler Frame: multi-camera pose estimation at 60 fps on a Jetson\n- Tracker: blob tracking and ID assignment over live video", { sources: [{ n: 1, label: "Boiler Frame", anchor: "project-boiler-frame" }, { n: 2, label: "Tracker", anchor: "project-tracker" }], model: "gpt-6-luna", tokens_out: 2410, ttfb_ms: 612, total_ms: 2380, status: 200 }),
  m(4, "user", "Can I book a call with him next week?"),
  m(5, "tool", "calendar", { tools: { name: "calendar", args: { days: 7 }, result: "Tue 10:00–12:00, Thu 14:00–17:00 free" } }),
  m(6, "assistant", "He has free time on **Tuesday 10:00–12:00** and **Thursday 14:00–17:00** (his time, ET). Want me to send a meeting request? I'll need your name and email.", { model: "gpt-6-luna", tokens_out: 1980, ttfb_ms: 701, total_ms: 1940, status: 200 }),
  m(7, "user", "Yes: Ada Recruiter, ada@acme.example, Thursday 3pm"),
  m(8, "tool", "request_meeting", { tools: { name: "request_meeting", args: { when: "Thu 15:00" }, result: "sent to Rithvik" } }),
  m(9, "assistant", "Done. Rithvik has your request for **Thursday at 3pm ET** and will confirm by email.", { model: "gpt-6-luna", tokens_out: 1630, ttfb_ms: 540, total_ms: 1310, status: 200 }),
];

export const SAMPLE_SUMMARY = "A good week: visits rose about a quarter on the week before, and people stayed longer, with average active time up to a minute and a half. LinkedIn is doing the heavy lifting as a source, and most visitors read past the work section. The agent handled 58 conversations with a healthy cache hit rate and only a couple of errors; a handful of questions about GPA were declined, which is worth an FAQ line. Three visitors stand out for follow-up, led by one who requested a meeting and downloaded the resume.";
