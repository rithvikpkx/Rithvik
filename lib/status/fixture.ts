/** A deterministic sample payload in the /api/status shape: used by tests and by STATUS_FIXTURE=1 for design work
 *  before real traffic exists. Never served in production unless that env var is set. */
import type { Bucket, Check, StatusData, StatusWindow } from "./types.ts";

const HOUR = 3_600_000;

/** Small seeded generator so the fixture is identical on every run. */
function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

function windowOf(now: number, buckets: number, stepMs: number, scale: number, seed: number): StatusWindow {
  const r = rng(seed);
  const series: Bucket[] = Array.from({ length: buckets }, (_, i) => {
    const t = now - (buckets - 1 - i) * stepMs;
    const hour = new Date(t).getUTCHours();
    const diurnal = 0.35 + 0.65 * Math.max(0, Math.sin(((hour - 6) / 24) * Math.PI * 2));
    const requests = Math.round(scale * diurnal * (0.6 + r() * 0.8));
    const errors = r() < 0.12 ? 1 : 0;
    return { t, requests, errors: Math.min(errors, requests), cached: Math.round(requests * (0.16 + r() * 0.1)), p50TtfbMs: requests ? Math.round(520 + r() * 330) : null };
  });
  const requests = series.reduce((s, b) => s + b.requests, 0);
  const errors = series.reduce((s, b) => s + b.errors, 0);
  const cacheHits = series.reduce((s, b) => s + b.cached, 0);
  const tokens = requests * 2350;
  return {
    requests, errors, errorRate: requests ? errors / requests : null, cacheHits, cacheHitRate: requests ? cacheHits / requests : null,
    ttfbMs: { p50: 610, p95: 1480 }, totalMs: { p50: 2900, p95: 6120 },
    tokens, estCostUsd: Math.round(tokens * 0.0000012 * 100) / 100,
    models: [
      { model: "gpt-5.4-mini", requests: Math.round(requests * 0.82), tokens: Math.round(tokens * 0.86) },
      { model: "gpt-5.4-nano", requests: Math.round(requests * 0.18), tokens: Math.round(tokens * 0.14) },
    ],
    series,
  };
}

/** Sample data as of `now`: 24h hourly, 7d in 6-hour buckets, 288 five-minute checks with two failures. */
export function statusFixture(now = Date.UTC(2026, 10, 9, 18, 0, 0)): StatusData {
  const recent: Check[] = Array.from({ length: 288 }, (_, i) => ({ t: now - (287 - i) * 300_000, ok: i !== 61 && i !== 62, ms: i === 61 || i === 62 ? null : 90 + ((i * 37) % 140) }));
  return {
    generatedAt: now,
    windows: { "24h": windowOf(now, 24, HOUR, 14, 7), "7d": windowOf(now, 28, 6 * HOUR, 52, 11) },
    uptime: { "24h": 99.31, "7d": 99.88, "30d": 99.96, recent },
    build: { commit: "a2afbc4d3f9e1c0b7a5d", model: "gpt-5.4-mini", auxModel: "gpt-5.4-nano" },
  };
}
