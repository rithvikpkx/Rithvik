/** Shapes of the admin dashboard and the public /status traffic block (pure types). */

export type Period = "24h" | "7d" | "30d" | "all";
export type Bucket = "hour" | "day";
export type Ranked = { label: string; value: number; sub?: string; href?: string };

export type Kpis = {
  visits: number; visitors: number; returning: number; identified: number; meetings: number; emails: number; chats: number;
  avgActiveMs: number | null; bounces: number; topSource: { host: string; visits: number } | null;
};

export type Feature = { key: string; label: string; group: string; uses: number; visitors: number };
export type Question = { text: string; count: number; declined: number; sid: string | null };
export type GeoPoint = { lat: number; lng: number; value: number; label: string };

export type Lead = {
  id: string; who: string; email: string | null; company: string | null; place: string; ipType: string | null; lastSeen: string;
  score: number; tier: "hot" | "warm" | "cool"; signals: string[]; lastChat: string | null;
};

export type Rag = {
  conversations: number; chatters: number; turns: number; answers: number; cached: number; errors: number; declines: number;
  ttfbP50: number | null; ttfbP95: number | null; totalP50: number | null; totalP95: number | null;
  tokens: number; costUsd: number; models: { model: string; requests: number; tokens: number }[];
  tools: Ranked[]; series: { t: string; turns: number }[]; questions: Question[];
  /** One dot per answer in the period (newest 1500, owner excluded): the latency strip plot. */
  samples: AnswerSample[];
};
export type AnswerSample = { t: string; ttfb: number | null; total: number | null; cached: boolean; err: boolean };

export type Dashboard = {
  period: Period; generatedAt: string; bucket: Bucket;
  kpis: Kpis; prev: Kpis | null; headline: string;
  series: { t: string; visits: number; visitors: number }[];
  /** Visits by UTC hour of day (24 values) over the period: the day ring. */
  rhythm: number[];
  entries: Ranked[]; sections: (Ranked & { dwell: number | null })[]; scroll: { pct: number; visits: number }[];
  countries: Ranked[]; points: GeoPoint[]; ipTypes: Ranked[]; orgs: Ranked[]; networks: Ranked[];
  devices: Ranked[]; browsers: Ranked[]; os: Ranked[]; referrers: Ranked[]; campaigns: Ranked[];
  features: Feature[]; rag: Rag; leads: Lead[];
  system: {
    uptime: { "24h": number | null; "7d": number | null; "30d": number | null; recent: { t: string; ok: boolean; ms: number }[] };
    jsErrors: Ranked[]; vitals: { lcp: number | null; inp: number | null; cls: number | null; n: number };
    commit: string | null; model: string; auxModel: string;
  };
};

/** /status traffic: counts and country totals only, already folded for privacy. */
export type PublicTraffic = {
  visits: number; visitors: number; series: { t: string; visits: number }[];
  countries: { code: string; name: string; visitors: number }[]; other: number;
};
