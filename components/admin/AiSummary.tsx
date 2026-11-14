"use client";
import { useState, useTransition } from "react";

/** The AUX model's plain-English read of the period, as an agent turn: `✻ read` with a run button. It sees aggregate
 *  numbers only (cached per period server-side). `write` is a server action; without one (the lab) the button is off. */
export default function AiSummary({ write, sample }: { write?: () => Promise<{ text?: string; error?: string }>; sample?: string }) {
  const [text, setText] = useState<string | null>(sample ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const run = () => start(async () => {
    setError(null);
    const r: { text?: string; error?: string } = await write!().catch(() => ({ error: "The read could not be written. Try again in a moment." }));
    if (r.text) setText(r.text); else setError(r.error ?? "Nothing came back.");
  });
  return (
    <section className={`d-read${busy ? " busy" : ""}`} aria-live="polite" aria-label="AI read of the period">
      <header>
        <span className="d-read-mark" aria-hidden="true">✻</span>
        <span className="d-read-t">read</span>
        <button type="button" onClick={run} disabled={busy || !write} title="Sees aggregate numbers only: never names, emails or questions">
          {busy ? "summarizing…" : text ? "summarize again" : "summarize"}
        </button>
      </header>
      {text && <p>{text}</p>}
      {error && <p className="err">{error}</p>}
    </section>
  );
}
