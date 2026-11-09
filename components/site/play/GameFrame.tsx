"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { Game } from "@/lib/play/games";
import { barFractions, beats, isBest } from "@/lib/play/scoring";

const bestKey = (id: string) => `rithvik-play-best-${id}`;

/** Reads a stored best score; null when none or storage is blocked. */
function readBest(id: string): number | null {
  try {
    const v = parseFloat(localStorage.getItem(bestKey(id)) ?? "");
    return Number.isFinite(v) ? v : null;
  } catch { return null; }
}

/** Resolves a CSS custom property on `el` to a canvas-ready colour string. */
export const token = (el: Element, name: string, fallback = "#888") => getComputedStyle(el).getPropertyValue(name).trim() || fallback;

/** Remounts its children (a fresh round of the game) each time `again` is called. */
export function Replay({ children }: { children: (again: () => void) => ReactNode }) {
  const [run, setRun] = useState(0);
  return <div key={run} style={{ display: "contents" }}>{children(() => setRun((r) => r + 1))}</div>;
}

/** Shared game layout: title, help, the stage, and a side panel that shows Rithvik's baseline until `score` arrives, then the result card with your stored best. */
export function GameFrame({ g, help, score, extra, onAgain, children }: { g: Game; help: ReactNode; score: number | null; extra?: string; onAgain: () => void; children: ReactNode }) {
  const [best, setBest] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  // Stores the best score once when the round ends; the bars then grow on the next frame.
  useEffect(() => {
    if (score === null) return;
    const prev = readBest(g.id);
    const better = isBest(g.hi, score, prev);
    if (better) { try { localStorage.setItem(bestKey(g.id), String(score)); } catch {} }
    const raf = requestAnimationFrame(() => { setBest(better ? score : prev); setReady(true); });
    return () => cancelAnimationFrame(raf);
  }, [score, g.id, g.hi]);

  const [you, base] = score === null ? [0, 0] : barFractions(score, g.base);
  return (
    <div className="g-wrap">
      <div className="g-stage">
        <h3 className="g-title">{g.name}</h3>
        <p className="g-help">{help}</p>
        {children}
      </div>
      <div className="g-side">
        {score === null ? (
          <>
            <p className="label">Rithvik&apos;s baseline</p>
            <p className="g-stat">{g.base} <small>{g.unit}</small></p>
          </>
        ) : (
          <div className="result" role="status">
            <p className="rc-verdict">{beats(g, score) ? "You beat Rithvik" : "Rithvik wins this round"}</p>
            <div className="rc-row me"><span>You</span><span className="rc-bar"><i style={{ transform: `scaleX(${ready ? you.toFixed(3) : 0})` }} /></span><b>{score} {g.unit}</b></div>
            <div className="rc-row"><span>Rithvik</span><span className="rc-bar"><i style={{ transform: `scaleX(${ready ? base.toFixed(3) : 0})` }} /></span><b>{g.base} {g.unit}</b></div>
            <p className="note">{[extra, best !== null && `Your best ${best} ${g.unit}`].filter(Boolean).join(" · ")}</p>
            <div className="g-row"><button type="button" className="btn sm" onClick={onAgain}>Play again</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
