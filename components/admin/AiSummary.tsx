"use client";
import { useState, useTransition } from "react";

/** "Write a summary": asks the server for the AUX model's plain-English read of the period (numbers only, cached per
 *  period server-side). `write` is a server action; without one (the lab) the button is shown disabled. */
export default function AiSummary({ write, sample }: { write?: () => Promise<{ text?: string; error?: string }>; sample?: string }) {
  const [text, setText] = useState<string | null>(sample ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const run = () => start(async () => {
    setError(null);
    const r: { text?: string; error?: string } = await write!().catch(() => ({ error: "The summary could not be written. Try again in a moment." }));
    if (r.text) setText(r.text); else setError(r.error ?? "No summary came back.");
  });
  return (
    <div className="adm-ai" aria-live="polite">
      <div className="adm-ai-h">
        <span className="adm-eyebrow">AI read</span>
        <button type="button" className="adm-btn sm" onClick={run} disabled={busy || !write}>
          <span aria-hidden="true">✦</span>{busy ? "Writing…" : text ? "Rewrite" : "Write a summary"}
        </button>
        <span className="adm-muted" style={{ fontSize: 12 }}>Sees aggregate numbers only, never names, emails or questions.</span>
      </div>
      {text && <p>{text}</p>}
      {error && <p className="adm-muted">{error}</p>}
    </div>
  );
}
