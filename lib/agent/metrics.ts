/** Shapes the metrics RPC output into the public /api/status JSON (pure, so node:test can load it).
 *  Metrics only: nothing here ever carries message content or an IP. Rates and uptime are fractions 0-1. */
import { estimateCost } from "./pricing.ts";

export type Point = { t: string; requests: number; errors: number; cached: number; p50TtfbMs: number | null };
export type Pct = { p50: number | null; p95: number | null };
export type Window = {
	requests: number; errors: number; errorRate: number; cacheHits: number; cacheHitRate: number;
	ttfbMs: Pct; totalMs: Pct; tokens: number; estCostUsd: number;
	models: { model: string; requests: number; tokens: number }[];
	series: Point[];
};
export type Uptime = { "24h": number | null; "7d": number | null; "30d": number | null; recent: { t: string; ok: boolean; ms: number }[] };
export type Status = {
	generatedAt: string;
	windows: { "24h": Window; "7d": Window };
	uptime: Uptime;
	build: { commit: string | null; model: string; auxModel: string };
};

type Obj = Record<string, unknown>;
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const pct = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 10_000) / 10_000 : 0);
const rows = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter((x): x is Obj => !!x && typeof x === "object") : []);

/** The window's first bucket: 24 hourly buckets or 7 daily ones, ending with the current one. Also the RPC's `p_since`. */
export function windowStart(kind: "24h" | "7d", now: number): Date {
	const unit = kind === "24h" ? HOUR : DAY;
	return new Date(Math.floor(now / unit) * unit - (kind === "24h" ? 23 : 6) * unit);
}

/** Maps the RPC result to a window with every bucket present, so a chart has a stable x-axis before any traffic. */
export function shapeWindow(raw: unknown, kind: "24h" | "7d", now: number): Window {
	const r: Obj = raw && typeof raw === "object" ? (raw as Obj) : {};
	const unit = kind === "24h" ? HOUR : DAY;
	const start = windowStart(kind, now).getTime();
	const byBucket = new Map<number, Obj>();
	for (const s of rows(r.series)) if (typeof s.t === "string") byBucket.set(Date.parse(s.t), s);
	const series: Point[] = Array.from({ length: kind === "24h" ? 24 : 7 }, (_, i) => {
		const t = start + i * unit;
		const s = byBucket.get(t);
		return { t: new Date(t).toISOString(), requests: num(s?.requests), errors: num(s?.errors), cached: num(s?.cached), p50TtfbMs: pct(s?.p50TtfbMs) };
	});
	const models = rows(r.models).map((m) => ({ model: String(m.model ?? "unknown"), requests: num(m.requests), tokens: num(m.tokens) }));
	const requests = num(r.requests), errors = num(r.errors), cacheHits = num(r.cacheHits);
	return {
		requests, errors, errorRate: rate(errors, requests), cacheHits, cacheHitRate: rate(cacheHits, requests),
		ttfbMs: { p50: pct(r.ttfbP50), p95: pct(r.ttfbP95) },
		totalMs: { p50: pct(r.totalP50), p95: pct(r.totalP95) },
		tokens: num(r.tokens),
		estCostUsd: Math.round(models.reduce((sum, m) => sum + estimateCost(m.model, m.tokens), 0) * 10_000) / 10_000,
		models, series,
	};
}

/** Uptime as fractions 0-1 (null with no checks yet) plus the recent checks, oldest first. */
export function shapeUptime(raw: unknown): Uptime {
	const r: Obj = raw && typeof raw === "object" ? (raw as Obj) : {};
	const frac = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10_000) / 10_000 : null);
	const recent = rows(r.recent).slice(-288).map((c) => ({ t: String(c.t), ok: c.ok === true, ms: num(c.ms) }));
	return { "24h": frac(r.d1), "7d": frac(r.d7), "30d": frac(r.d30), recent };
}

/** Deterministic synthetic data for building the /status page without a database (dev only). */
export function fixtureStatus(now: number, build: Status["build"]): Status {
	// Small seeded generator so the fixture is stable across reloads but looks organic.
	let seed = 7;
	const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
	const window = (kind: "24h" | "7d", perBucket: number): Window => {
		const unit = kind === "24h" ? HOUR : DAY;
		const start = windowStart(kind, now).getTime();
		const n = kind === "24h" ? 24 : 7;
		const series = Array.from({ length: n }, (_, i) => {
			const bell = 0.4 + 0.6 * Math.sin(((i + 0.5) / n) * Math.PI); // quiet at the edges, busy mid-window
			const requests = Math.round(perBucket * bell * (0.7 + rnd() * 0.6));
			return { t: new Date(start + i * unit).toISOString(), requests, errors: rnd() < 0.15 ? 1 : 0, cached: Math.round(requests * (0.2 + rnd() * 0.15)), p50TtfbMs: Math.round(520 + rnd() * 380) };
		});
		const requests = series.reduce((s, p) => s + p.requests, 0);
		const errors = series.reduce((s, p) => s + p.errors, 0);
		const cacheHits = series.reduce((s, p) => s + p.cached, 0);
		const llm = requests - cacheHits;
		const models = [
			{ model: build.model, requests: Math.round(llm * 0.93), tokens: Math.round(llm * 0.93 * 2300) },
			{ model: "gpt-5.5", requests: Math.round(llm * 0.07), tokens: Math.round(llm * 0.07 * 3100) },
		];
		return {
			requests, errors, errorRate: rate(errors, requests), cacheHits, cacheHitRate: rate(cacheHits, requests),
			ttfbMs: { p50: 610, p95: 1480 }, totalMs: { p50: 2350, p95: 5100 },
			tokens: models.reduce((s, m) => s + m.tokens, 0),
			estCostUsd: Math.round(models.reduce((s, m) => s + estimateCost(m.model, m.tokens), 0) * 10_000) / 10_000,
			models, series,
		};
	};
	const recent = Array.from({ length: 288 }, (_, i) => {
		const bad = i === 120 || i === 121;
		return { t: new Date(now - (287 - i) * 300_000).toISOString(), ok: !bad, ms: bad ? 0 : Math.round(180 + rnd() * 140) };
	});
	return {
		generatedAt: new Date(now).toISOString(),
		windows: { "24h": window("24h", 14), "7d": window("7d", 120) },
		uptime: { "24h": 0.9931, "7d": 0.9987, "30d": 0.9994, recent },
		build,
	};
}
