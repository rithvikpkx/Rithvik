"use client";
import { useSyncExternalStore } from "react";
import { visitorHour } from "./pixel";

const noop = () => () => {};
/** Re-renders subscribers every 15s (the mockup's clock cadence). */
const every15s = (cb: () => void) => { const t = setInterval(cb, 15000); return () => clearInterval(t); };

/** A 15s time bucket on the client, 0 during SSR/hydration so server and client markup agree;
 *  clocks render blank until it is non-zero. */
export function useTick(): number {
  return useSyncExternalStore(every15s, () => Math.floor(Date.now() / 15000), () => 0);
}

let hour: number | undefined; // fixed for the page view, like the mockup's render-time bake
/** The visitor's local hour (or `?hour=`), null during SSR/hydration. */
export function useVisitorHour(): number | null {
  return useSyncExternalStore(noop, () => (hour ??= visitorHour(location.search)), () => null);
}

/** "3:07 PM" in a zone (undefined = the visitor's own). */
export const clock = (tz?: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date());
