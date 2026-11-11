/** Which action buttons an answer shows: tool-proposed ones first, then fallback ones, one per target, capped. Pure. */

/** Most buttons under one answer; more than this stops reading as suggestions. */
export const MAX_OFFERS = 4;

/** Drops repeats of the same `key` (first wins, so a tool's draft beats the fallback one) and keeps the first `max`. */
export function capOffers<T extends { key: string }>(offers: T[], max = MAX_OFFERS): T[] {
  const seen = new Set<string>();
  return offers.filter((o) => (seen.has(o.key) ? false : (seen.add(o.key), true))).slice(0, max);
}
