import type { StatusData } from "./types";
import { statusFixture } from "./fixture";

/** Where this deployment can reach itself: an explicit override, the production domain, the deployment URL, or localhost. */
function selfBase(): string {
  const e = process.env;
  if (e.STATUS_BASE_URL) return e.STATUS_BASE_URL.replace(/\/$/, "");
  if (e.VERCEL_ENV === "production" && e.VERCEL_PROJECT_PRODUCTION_URL) return `https://${e.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (e.VERCEL_URL) return `https://${e.VERCEL_URL}`;
  return `http://localhost:${e.PORT ?? 3000}`;
}

/** True when `v` looks like the payload (enough to render without throwing); anything else is treated as unavailable. */
function isStatus(v: unknown): v is StatusData {
  const d = v as StatusData | null;
  return !!d && typeof d === "object" && !!d.windows?.["24h"] && !!d.windows?.["7d"] && !!d.uptime && Array.isArray(d.uptime.recent) && !!d.build;
}

/** Fetches /api/status server-side (cached 60s). Returns null when it is unreachable or malformed, so the page can say
 *  so honestly instead of showing zeros. STATUS_FIXTURE=1 serves sample data for design work only. */
export async function loadStatus(): Promise<StatusData | null> {
  if (process.env.STATUS_FIXTURE === "1") return statusFixture(Date.now() - (Date.now() % 3_600_000));
  try {
    const res = await fetch(`${selfBase()}/api/status`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return isStatus(json) ? json : null;
  } catch {
    return null;
  }
}
