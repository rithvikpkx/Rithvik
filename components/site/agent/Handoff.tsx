"use client";
import { useEffect, useRef } from "react";

/** A ghost of the question flying from the card it was asked on into the dock's prompt, on a lifted arc.
 *  It is laid out at the end point and animated from the start (FLIP), so only transform and opacity move.
 *  `onLand` fires on arrival (the prompt shows the text), `onDone` after the ghost has faded out. */
export default function Handoff({ question, from, target, onLand, onDone }: {
  question: string;
  from: DOMRect;
  target: () => HTMLElement | null;
  onLand: () => void;
  onDone: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The callbacks change identity every render; the effect must run once per flight, so it reads them from here.
  const cb = useRef({ onLand, onDone });
  useEffect(() => { cb.current = { onLand, onDone }; });

  useEffect(() => {
    const el = ref.current, to = target()?.getBoundingClientRect();
    const calm = document.documentElement.classList.contains("lite") || matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!el || !to || calm) { cb.current.onLand(); cb.current.onDone(); return; }
    el.style.left = `${to.left}px`; el.style.top = `${to.top}px`;
    el.style.width = `${Math.min(from.width, to.width)}px`; el.style.minHeight = `${Math.min(from.height, 56)}px`;
    let live = true;
    const dx = from.left - to.left, dy = from.top - to.top;
    const lift = Math.min(70, 24 + Math.abs(dy) * 0.12); // an arc that rises first reads as "picked up"
    const fly = el.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(1)`, opacity: 1 },
      { transform: `translate(${dx * 0.42}px, ${dy * 0.42 - lift}px) scale(1.035)`, opacity: 1, offset: 0.42 },
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
    ], { duration: 560, easing: "cubic-bezier(.3, .7, .2, 1)", fill: "forwards" });
    let fade: Animation | undefined;
    fly.finished.then(() => {
      if (!live) return;
      cb.current.onLand();
      el.dataset.landed = "true"; // CSS drops the card chrome, leaving only the text the prompt now shows
      fade = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease-out", fill: "forwards" });
      return fade.finished.then(() => { if (live) cb.current.onDone(); });
    }).catch(() => {}); // cancel() rejects `finished`: that is the cleanup below, not an error
    return () => { live = false; fly.cancel(); fade?.cancel(); };
  }, [from, target]);

  // Position is set in the effect: the dock is still opening at first render, so the prompt has not reached its final place yet.
  return <div ref={ref} className="agent-ghost" aria-hidden="true" style={{ opacity: 0 }}>{question}</div>;
}
