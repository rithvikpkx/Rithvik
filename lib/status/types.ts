/** The /api/status payload (shape agreed with the cache + metrics stream). Times are epoch ms or ISO strings. */
export type Bucket = { t: number | string; requests: number; errors: number; cached: number; p50TtfbMs: number | null };
export type StatusWindow = {
  requests: number; errors: number; errorRate: number | null; cacheHits: number; cacheHitRate: number | null;
  ttfbMs: { p50: number | null; p95: number | null }; totalMs: { p50: number | null; p95: number | null };
  tokens: number; estCostUsd: number | null;
  models: { model: string; requests: number; tokens: number }[];
  series: Bucket[];
};
export type Check = { t: number | string; ok: boolean; ms: number | null };
export type StatusData = {
  generatedAt: number | string;
  windows: { "24h": StatusWindow; "7d": StatusWindow };
  uptime: { /** fractions 0-1 */ "24h": number | null; "7d": number | null; "30d": number | null; recent: Check[] };
  build: { commit: string | null; model: string; auxModel: string };
};
