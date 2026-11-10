import { test } from "node:test";
import assert from "node:assert/strict";
import { clusterQuestions, delta, fillSeries, foldCountries, headline, parsePeriod, periodRange, questionKey, rankFeatures, rankLeads, scoreLead, shapeKpis } from "./shape.ts";
import { centroid, countryName, toPoints } from "./geo.ts";
import { lookCss, lookFor } from "./look.ts";
import { rowsToItems } from "./replica.ts";
import { hash32, hourRhythm, sessionStrip, visitorActivity } from "./strips.ts";

const NOW = Date.UTC(2026, 10, 9, 14, 30);

test("periods: parse, align to buckets, previous window of equal length", () => {
  assert.equal(parsePeriod("30d"), "30d");
  assert.equal(parsePeriod("nope"), "7d");
  const d = periodRange("24h", NOW);
  assert.equal(d.bucket, "hour");
  assert.equal(d.since!.toISOString(), "2026-11-08T15:00:00.000Z");
  assert.equal(d.prevSince!.toISOString(), "2026-11-07T15:00:00.000Z");
  const w = periodRange("7d", NOW);
  assert.equal(w.since!.toISOString(), "2026-11-03T00:00:00.000Z");
  assert.equal(periodRange("all", NOW).since, null);
});

test("fillSeries zero-fills every bucket and keeps values", () => {
  const { since, until, bucket } = periodRange("24h", NOW);
  const s = fillSeries([{ t: "2026-11-09T13:00:00+00:00", visits: 4, visitors: "3" }], since, until, bucket, ["visits", "visitors"]);
  assert.equal(s.length, 24);
  assert.deepEqual(s.at(-2), { t: "2026-11-09T13:00:00.000Z", visits: 4, visitors: 3 });
  assert.equal(s[0].visits, 0);
  // "all" starts at the first data point
  const a = fillSeries([{ t: "2026-11-07T00:00:00Z", visits: 1 }], null, new Date(NOW), "day", ["visits"]);
  assert.equal(a.length, 3);
});

test("deltas and the deterministic headline", () => {
  assert.equal(delta(150, 100), 0.5);
  assert.equal(delta(5, 0), null);
  assert.equal(delta(5, null), null);
  const k = shapeKpis({ visits: 150, visitors: 90, meetings: 2, emails: 1, identified: 3, topSource: { host: "linkedin.com", visits: 40 } });
  const prev = shapeKpis({ visits: 100 });
  assert.equal(headline(k, prev, "7d"), "A strong stretch: 150 visits from 90 people in the last 7 days, up 50% on the period before. 2 meeting requests, 1 email, 3 identified. linkedin.com sent the most people.");
  assert.match(headline(shapeKpis({}), null, "24h"), /^No visits in the last 24 hours/);
  assert.match(headline(shapeKpis({ visits: 1, visitors: 1 }), null, "all"), /^1 visit from 1 person so far\./);
});

test("features: catalog zeros included, duplicates dropped, ranked by people", () => {
  const f = rankFeatures([{ key: "agent_turn", uses: 9, visitors: 3 }, { key: "play:snake", uses: 2, visitors: 2 }, { key: "overlay:resume", uses: 5, visitors: 5 }, { key: "design:nimbus", uses: 1, visitors: 1 }]);
  assert.equal(f[0].key, "agent_turn");
  assert.equal(f[1].label, "Play: snake");
  assert.ok(!f.some((x) => x.key === "overlay:resume"));
  assert.equal(f.find((x) => x.key === "design:nimbus")!.label, "Design: Nimbus");
  assert.equal(f.at(-1)!.visitors, 0); // least used: something nobody touched
  assert.ok(f.some((x) => x.key === "design:foil" && x.uses === 0));
});

test("questions cluster across rewordings", () => {
  assert.equal(questionKey("What has he built?"), questionKey("what did he build"));
  const q = clusterQuestions([
    { q: "What has he built?", sid: "a", declined: false },
    { q: "what has he built", sid: "b", declined: false },
    { q: "What did he build?", sid: "c", declined: true },
    { q: "Where does he study?", sid: "d", declined: false },
  ]);
  assert.equal(q.length, 2);
  assert.equal(q[0].count, 3);
  assert.equal(q[0].declined, 1);
  assert.equal(q[0].sid, "a");
});

test("lead scoring is transparent and capped", () => {
  const hot = scoreLead({ id: "1", email: "a@b.co", company: "Acme", ip_type: "business", meetings: 1, emails: 1, resume_downloads: 1, visits: 3, active_ms: 600_000, cases: 2, turns: 4, sections: 6 });
  assert.equal(hot.score, 100);
  assert.equal(hot.tier, "hot");
  assert.equal(hot.signals[0], "Requested a meeting");
  assert.ok(hot.signals.includes("Company network: Acme"));
  const cool = scoreLead({ id: "2", visits: 1, active_ms: 70_000 });
  assert.equal(cool.score, 2);
  assert.equal(cool.tier, "cool");
  assert.deepEqual(rankLeads([{ id: "3", visits: 1 }, { id: "1", emails: 1 }]).map((l) => l.id), ["1"]); // no signal, no row
});

test("public country fold never names a country under the floor", () => {
  const f = foldCountries([{ country: "US", visitors: 12 }, { country: "IN", visitors: 3 }, { country: "NZ", visitors: 1 }, { country: null, visitors: 2 }]);
  assert.deepEqual(f.countries.map((c) => c.code), ["US", "IN"]);
  assert.equal(f.countries[0].name, "United States");
  assert.equal(f.other, 3);
});

test("geo: centroids, names, points merge per spot", () => {
  assert.deepEqual(centroid("us"), [39.8, -98.6]);
  assert.equal(centroid("XX"), null);
  assert.equal(countryName("DE"), "Germany");
  const p = toPoints([
    { city: "San Francisco", region: "CA", country: "US", lat: 37.77, lng: -122.4, value: 3 },
    { city: null, region: null, country: "IN", lat: null, lng: null, value: 2 },
    { city: "Pune", region: null, country: "IN", lat: null, lng: null, value: 1 },
    { city: "Nowhere", region: null, country: "XX", lat: null, lng: null, value: 9 },
  ]);
  assert.equal(p.length, 2);
  assert.deepEqual(p.map((x) => [x.label, x.value]), [["San Francisco, CA, US", 3], ["India", 3]]);
});

test("looks: palettes keep their tokens, designs derive from the swatch", () => {
  const pal = [{ id: "x", slug: "dracula", name: "Dracula", tokens: { bg: "#282a36", text: "#f8f8f2", accent: "#bd93f9" }, sort_order: 1, published: true, created_at: "", updated_at: "" }];
  const d = lookFor("dracula", pal);
  assert.equal(d.dark, true);
  assert.equal(d.tokens.accent, "#bd93f9");
  const n = lookFor("nimbus", pal);
  assert.equal(n.dark, false);
  assert.deepEqual([n.tokens.bg, n.tokens.text, n.tokens.accent], ["#E6F4FF", "#0E1B2B", "#0A9BFF"]);
  assert.equal(lookFor("mercury", pal).dark, true);
  assert.equal(lookFor("unknown", pal).id, "dracula");
  assert.equal(lookCss({ id: "e", name: "e", dark: false, tokens: { bg: "red;}body{x:y", text: "#000" } }, ".adm"), ".adm{\n  --text: #000;\n}");
});

test("stored rows become transcript items with telemetry", () => {
  const base = { tools: null, sources: null, model: null, tokens_in: null, tokens_out: null, ttfb_ms: null, total_ms: null, status: null, error: null, cached: false, created_at: "2026-11-09T14:00:00Z" };
  const items = rowsToItems([
    { ...base, role: "user", content: "What has he built?" },
    { ...base, role: "tool", content: "search", tools: { name: "search", args: { q: "projects" }, result: "3 hits" } },
    { ...base, role: "assistant", content: "He built **X** [1].", sources: [{ n: 1, label: "Boiler Frame", anchor: "project-boiler" }, { bad: 1 }], model: "gpt-6-luna", tokens_out: 2300, ttfb_ms: 610, total_ms: 2400, status: 200 },
  ]);
  assert.deepEqual(items.map((i) => i.kind), ["user", "tool", "answer", "sources", "note"]);
  assert.equal((items[1] as { args: string }).args, '{"q":"projects"}');
  assert.equal((items[3] as { items: unknown[] }).items.length, 1);
  assert.equal((items[4] as { text: string }).text, "gpt-6-luna · 2,300 tokens · first byte 610 ms · total 2.4 s");
  assert.equal(new Set(items.map((i) => i.id)).size, items.length);
});

test("strips: hour rhythm, conversation glyphs, visitor activity", () => {
  const r = hourRhythm(["2026-11-09T14:05:00Z", "2026-11-08T14:59:00Z", "2026-11-09T03:00:00Z", "nope"]);
  assert.equal(r.length, 24);
  assert.equal(r[14], 2);
  assert.equal(r[3], 1);
  const row = (at: string, role: string, extra: Record<string, unknown> = {}) => ({ created_at: at, role, status: null, error: null, cached: false, tokens_in: null, tokens_out: null, ...extra });
  const s = sessionStrip([row("2026-11-09T14:00:00Z", "user"), row("2026-11-09T14:00:30Z", "tool"), row("2026-11-09T14:01:00Z", "assistant", { tokens_out: 40, cached: true }), row("2026-11-09T14:02:00Z", "assistant", { status: 502 })]);
  assert.equal(s.marks.map((m) => m.k).join(""), "utae");
  assert.equal(s.marks[1].o, 0.25);
  assert.equal(s.marks[2].c, true);
  assert.equal(s.ms, 120_000);
  assert.equal(s.tokens, 40);
  const now = Date.UTC(2026, 10, 9, 18);
  const a = visitorActivity([
    { id: "v1", visitor_id: "a", started_at: "2026-11-09T10:00:00Z" }, { id: "v2", visitor_id: "a", started_at: "2026-11-07T10:00:00Z" },
    { id: "v3", visitor_id: "a", started_at: "2025-01-01T00:00:00Z" },
  ], [{ visit_id: "v1", type: "agent_turn" }, { visit_id: "v1", type: "agent_turn" }, { visit_id: "zz", type: "resume" }], now);
  assert.equal(a.a.days[29], 1);
  assert.equal(a.a.days[27], 1);
  assert.equal(a.a.days.reduce((x, y) => x + y, 0), 2);
  assert.deepEqual(a.a.keys, { agent_turn: 2 });
  assert.equal(hash32("x"), hash32("x"));
  assert.notEqual(hash32("x"), hash32("y"));
});
