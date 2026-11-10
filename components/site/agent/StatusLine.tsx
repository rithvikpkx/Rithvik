"use client";
import { useEffect, useState } from "react";
import { SPIN_INTERVAL, STAR_FRAMES, statusSegments, type StatusState, type Usage } from "@/lib/agent/status";

/** The panel's bottom line, styled like Claude Code's. Owns its own clock so the spinner never re-renders the transcript. */
export default function StatusLine({ turns, usage, busySince, cooldown, model }: {
  turns: number;
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

  let state: StatusState = { kind: "idle", turns, usage };
  if (busySince !== null) state = { kind: "busy", elapsedMs: Math.max(0, now - busySince) };
  else if (limited) state = { kind: "limited", status: cooldown.status, retrySecs: (cooldown.until - now) / 1000 };

  const segs = statusSegments(state);
  // The model sits right after "ready", where Claude Code keeps it.
  if (state.kind === "idle" && model) segs.splice(1, 0, { text: model, cls: "s-model" });
  return (
    <div className="agent-status" role="status">
      {segs.map((s, i) => {
        // Busy: the braille dots become Claude Code's star cycle.
        const text = state.kind === "busy" && i === 0 ? STAR_FRAMES[Math.floor(state.elapsedMs / 160) % STAR_FRAMES.length] : s.text;
        return <span key={i} className={[s.tone, s.cls].filter(Boolean).join(" ") || undefined}>{text}</span>;
      })}
    </div>
  );
}
