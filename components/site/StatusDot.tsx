"use client";
import { useEffect, useState } from "react";

type State = "unknown" | "ok" | "down";
const KEY = "rv-health"; // sessionStorage: { at, ok } so navigating around never re-probes within 5 minutes
const TTL = 5 * 60_000;
const LABEL: Record<State, string> = { unknown: "Status", ok: "Status: all systems operational", down: "Status: something is degraded" };

/** A discreet lamp (on the look switcher) that links to /status. It probes /api/health once, a few seconds after the
 *  page settles (no polling), and remembers the answer for the tab session. Green = ok, red = degraded, grey = not checked. */
export default function StatusDot() {
  const [state, setState] = useState<State>("unknown");

  useEffect(() => {
    let cancelled = false;
    const set = (ok: boolean) => { if (!cancelled) setState(ok ? "ok" : "down"); };
    try {
      const c = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as { at: number; ok: boolean } | null;
      if (c && Date.now() - c.at < TTL) { const t = setTimeout(() => set(c.ok), 0); return () => { cancelled = true; clearTimeout(t); }; }
    } catch { /* storage blocked: just probe */ }
    const t = setTimeout(() => {
      fetch("/api/health", { cache: "no-store" })
        .then((r) => r.json().then((j: { ok?: boolean }) => r.ok && j.ok === true, () => false))
        .catch(() => false)
        .then((ok) => { try { sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), ok })); } catch {} set(ok); });
    }, 4000);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  return (
    // a full navigation: /status is a different page tree
    <a className="sw-lamp" href="/status" data-state={state} aria-label={LABEL[state]} title={LABEL[state]}>
      <i aria-hidden="true" />
    </a>
  );
}
