/** Tiny public hook for components that own an interaction the tracker cannot see from outside (an agent turn, a
 *  composer send). Safe to call at any time: events queue on `window` until the tracker has started, and vanish
 *  silently when it never does (owner, opt-out, SSR). Payloads are validated server-side (lib/track/schema.ts). */
export type TrackEvent = { t: string; d?: Record<string, unknown>; at: number };

/** Records one event, e.g. `track("agent_turn", { sid })` or `track("composer_send", { subject })`. */
export function track(type: string, data?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __rvq?: TrackEvent[] };
  const q = (w.__rvq ??= []);
  if (q.length < 200) q.push({ t: type, d: data, at: Date.now() });
  window.dispatchEvent(new Event("rv:q"));
}
