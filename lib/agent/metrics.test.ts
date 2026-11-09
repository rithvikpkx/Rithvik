import { test } from "node:test";
import assert from "node:assert/strict";
import { fixtureStatus, shapeUptime, shapeWindow, windowStart } from "./metrics.ts";
import { estimateCost } from "./pricing.ts";

const now = Date.UTC(2026, 10, 9, 15, 42);

test("windows align to bucket boundaries", () => {
	assert.equal(windowStart("24h", now).toISOString(), "2026-11-08T16:00:00.000Z");
	assert.equal(windowStart("7d", now).toISOString(), "2026-11-03T00:00:00.000Z");
});

test("shapeWindow zero-fills the series, computes rates and prices the model mix", () => {
	const w = shapeWindow({
		requests: 10, errors: 1, cacheHits: 4, tokens: 20_000, ttfbP50: 612.4, ttfbP95: 1480.6, totalP50: null, totalP95: null,
		models: [{ model: "gpt-6-luna", requests: 6, tokens: 20_000 }],
		series: [{ t: "2026-11-09T15:00:00+00:00", requests: 10, errors: 1, cached: 4, p50TtfbMs: 600.2 }],
	}, "24h", now);
	assert.equal(w.series.length, 24);
	assert.equal(w.series[23].t, "2026-11-09T15:00:00.000Z");
	assert.deepEqual([w.series[23].requests, w.series[23].p50TtfbMs, w.series[0].requests, w.series[0].p50TtfbMs], [10, 600, 0, null]);
	assert.deepEqual([w.errorRate, w.cacheHitRate], [0.1, 0.4]);
	assert.deepEqual(w.ttfbMs, { p50: 612, p95: 1481 });
	assert.deepEqual(w.totalMs, { p50: null, p95: null });
	// 20k tokens at 85% x $0.10 + 15% x $0.50 per 1M = $0.0032
	assert.equal(w.estCostUsd, 0.0032);
});

test("an empty or malformed RPC result still yields a full window", () => {
	for (const raw of [null, {}, "x", { series: 5, models: "no" }]) {
		const w = shapeWindow(raw, "7d", now);
		assert.equal(w.series.length, 7);
		assert.deepEqual([w.requests, w.errorRate, w.estCostUsd, w.models.length], [0, 0, 0, 0]);
	}
});

test("pricing: unpriced model costs 0, priced model is blended 85/15", () => {
	assert.equal(estimateCost("mystery", 1e6), 0);
	assert.ok(Math.abs(estimateCost("gpt-5.5", 1e6) - (0.85 * 5 + 0.15 * 30)) < 1e-9);
});

test("shapeUptime returns fractions, null without checks, and at most 288 recent", () => {
	assert.deepEqual(shapeUptime(null), { "24h": null, "7d": null, "30d": null, recent: [] });
	const u = shapeUptime({ d1: 0.99312, d7: 1, d30: null, recent: Array.from({ length: 300 }, (_, i) => ({ t: String(i), ok: i % 2 === 0, ms: 5 })) });
	assert.deepEqual([u["24h"], u["7d"], u["30d"], u.recent.length], [0.9931, 1, null, 288]);
});

test("fixture has the exact contract shape", () => {
	const s = fixtureStatus(now, { commit: "abc1234", model: "gpt-6-luna", auxModel: "gpt-5-nano" });
	assert.deepEqual(Object.keys(s).sort(), ["build", "generatedAt", "uptime", "windows"]);
	assert.deepEqual(Object.keys(s.windows["24h"]).sort(), ["cacheHitRate", "cacheHits", "errorRate", "errors", "estCostUsd", "models", "requests", "series", "tokens", "totalMs", "ttfbMs"]);
	assert.equal(s.windows["24h"].series.length, 24);
	assert.equal(s.windows["7d"].series.length, 7);
	assert.equal(s.uptime.recent.length, 288);
});
