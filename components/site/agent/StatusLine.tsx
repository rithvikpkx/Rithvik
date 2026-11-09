"use client";
import { useEffect, useState } from "react";
import { SPIN_INTERVAL, statusSegments, type StatusState } from "@/lib/agent/status";

/** The panel's bottom line. Owns its own clock so the 80ms spinner never re-renders the transcript. */
export default function StatusLine({ turns, busySince, cooldown }: {
  turns: number;
  busySince: number | null;
  cooldown: { until: number; status: 429 | 503 } | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  const limited = cooldown !== null && cooldown.until > now;
  const ticking = busySince !== null || limited;
  useEffect(() => {
    if (!ticking) return;
    // Reduced motion: still tick (the elapsed time is information) but not at spinner speed.
    const slow = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setInterval(() => setNow(Date.now()), slow ? 1000 : SPIN_INTERVAL);
    return () => clearInterval(t);
  }, [ticking]);

  let state: StatusState = { kind: "idle", turns };
  if (busySince !== null) state = { kind: "busy", elapsedMs: Math.max(0, now - busySince) };
  else if (limited) state = { kind: "limited", status: cooldown.status, retrySecs: (cooldown.until - now) / 1000 };

  return (
    <div className="agent-status" role="status">
      {statusSegments(state).map((s, i) => <span key={i} className={s.tone}>{s.text}</span>)}
    </div>
  );
}
