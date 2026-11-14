"use client";
import { useState, useTransition } from "react";
import { explainVisit } from "@/app/admin/visit-actions";

/** The AI briefing for one visit. Nothing is requested until the button is clicked; a saved briefing just shows. */
export default function VisitStory({ visitId, story: saved }: { visitId: string; story: string | null }) {
  const [story, setStory] = useState(saved);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const run = () => start(async () => { const r = await explainVisit(visitId); if (r.story) { setStory(r.story); setError(""); } else setError(r.error ?? "Failed."); });
  return (
    <div className="d-story">
      {story ? <p>{story}</p> : null}
      <button type="button" onClick={run} disabled={pending}>{pending ? "Summarizing…" : story ? "Summarize again" : "Summarize this visit"}</button>
      {error && <span className="d-story-err">{error}</span>}
    </div>
  );
}
