import type { StatusData } from "./types";
import { statusFixture, trafficFixture } from "./fixture";
import { getPublicTrafficCached } from "@/lib/analytics/server";
import type { PublicTraffic } from "@/lib/analytics/types";
import { getStatus } from "@/lib/agent/status-server";

/** True when `v` looks like the payload (enough to render without throwing); anything else is treated as unavailable. */
function isStatus(v: unknown): v is StatusData {
  const d = v as StatusData | null;
  return !!d && typeof d === "object" && !!d.windows?.["24h"] && !!d.windows?.["7d"] && !!d.uptime && Array.isArray(d.uptime.recent) && !!d.build;
}

/** The status payload, read directly from the DB (cached 60s in getStatus). Returns null when malformed, so the page
 *  can say so honestly instead of showing zeros. STATUS_FIXTURE=1 serves sample data for design work only. */
export async function loadStatus(): Promise<StatusData | null> {
  if (process.env.STATUS_FIXTURE === "1") return statusFixture(Date.now() - (Date.now() % 3_600_000));
  try {
    const data: unknown = await getStatus();
    return isStatus(data) ? data : null;
  } catch {
    return null;
  }
}

/** Visitor counts for /status (counts and folded country totals only); null per window when unavailable. */
export async function loadTraffic(): Promise<Record<"24h" | "7d", PublicTraffic | null>> {
  if (process.env.STATUS_FIXTURE === "1") return { "24h": trafficFixture("24h"), "7d": trafficFixture("7d") };
  try {
    return await getPublicTrafficCached();
  } catch {
    return { "24h": null, "7d": null };
  }
}
