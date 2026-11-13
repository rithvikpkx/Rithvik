"use client";
import { useEffect, useMemo, useState } from "react";
import Mark from "@/components/site/mark/Mark";
import { SPIN_INTERVAL, statusSegments, type StatusState, type Usage } from "@/lib/agent/status";
import { verbAt, verbOrder } from "@/lib/agent/verbs";

/** The panel's bottom line, styled like Claude Code's. Owns its own clock so the spinner never re-renders the transcript. */
export default function StatusLine({ turns, usage, busySince, cooldown, model, actions }: {
  turns: number;
  actions?: boolean;
  usage: Usage;
  busySince: number | null;
  cooldown: { until: number; status: 429 | 503 } | null;
  model?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const limited = cooldown !== null && cooldown.until > now;
  const ticking = busySince !== null || limited;
  useEffect(() => {
    if (!ticking) return;
    // Reduced motion: still tick (the elapsed time is information) but not at spinner speed.
    const slow = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setInterval(() => setNow(Date.now()), slow ? 1000 : SPIN_INTERVAL * 2);
    return () => clearInterval(t);
  }, [ticking]);

  // A fresh verb order per turn (busySince changes on every submit), flavoured by the current look.
  const order = useMemo(() => (busySince === null ? [] : verbOrder(document.documentElement.dataset.design)), [busySince]);

  let state: StatusState = { kind: "idle", turns, usage, actions };
  if (busySince !== null) state = { kind: "busy", elapsedMs: Math.max(0, now - busySince), verb: verbAt(order, now - busySince) };
  else if (limited) state = { kind: "limited", status: cooldown.status, retrySecs: (cooldown.until - now) / 1000 };

  const segs = statusSegments(state);
  // The model sits right after "ready", where Claude Code keeps it.
  if (state.kind === "idle" && model) segs.splice(1, 0, { text: model, cls: "s-model" });
  return (
    <div className="agent-status" role="status">
      {segs.map((s, i) => {
        const cls = [s.tone, s.cls].filter(Boolean).join(" ") || undefined;
        // Busy: the spinner is the ouroboros drawing itself on and swallowing its tail (CSS-driven, no re-render per frame).
        if (state.kind === "busy" && i === 0) return <span key={i} className={cls} aria-hidden="true"><Mark kind="tiny" draw className="spinning ag-ouro" label="" /></span>;
        return <span key={i} className={cls}>{s.text}</span>;
      })}
    </div>
  );
}
