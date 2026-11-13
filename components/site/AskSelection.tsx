"use client";
import { useEffect, useRef, useState } from "react";
import { askQuestion, IGNORE_SELECTOR } from "@/lib/agent/ask";
import { useSite } from "./SiteProvider";
import "./AskSelection.css";

type Chip = { q: string; x: number; y: number; flip: boolean };

/** True when either end of the selection sits inside an input, editor or the site's own overlays. */
function inIgnored(sel: Selection): boolean {
  return [sel.anchorNode, sel.focusNode].some((n) => (n instanceof Element ? n : n?.parentElement)?.closest(IGNORE_SELECTOR));
}

/** A small "Ask" chip next to selected page text; click (or Alt+A) opens the agent with `Explain: "<quote>"`.
 *  Esc dismisses it until the selection changes. Mounted once by SitePage. */
export default function AskSelection() {
  const { openAgent } = useSite();
  const [chip, setChip] = useState<Chip | null>(null);
  const dismissed = useRef("");
  const latest = useRef<Chip | null>(null);
  useEffect(() => { latest.current = chip; });

  useEffect(() => {
    let raf = 0;
    /** Reads the live selection and shows, moves or hides the chip. Coalesced to one run per frame. */
    const update = () => {
      raf = 0;
      const sel = window.getSelection();
      const q = sel && !sel.isCollapsed && sel.rangeCount && !inIgnored(sel) ? askQuestion(sel.toString()) : null;
      if (!sel || !q || q === dismissed.current) { if (!q) dismissed.current = ""; setChip(null); return; }
      const rects = sel.getRangeAt(0).getClientRects();
      const r = rects[rects.length - 1]; // the end of the selection, where the pointer finished
      if (!r) { setChip(null); return; }
      const flip = r.bottom + 56 > window.innerHeight; // no room below: sit above the line
      setChip({ q, x: Math.max(8, Math.min(window.innerWidth - 88, r.right - 24)), y: flip ? r.top - 8 : r.bottom + 8, flip });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    const hide = () => setChip(null);
    const onKey = (e: KeyboardEvent) => {
      const c = latest.current;
      if (!c) return;
      if (e.key === "Escape") { dismissed.current = c.q; setChip(null); }
      else if (e.altKey && e.code === "KeyA") { e.preventDefault(); openAgent(c.q); setChip(null); }
    };
    document.addEventListener("selectionchange", schedule);
    window.addEventListener("scroll", hide, { passive: true }); // a fixed chip would drift off its text
    window.addEventListener("resize", hide);
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("selectionchange", schedule);
      window.removeEventListener("scroll", hide);
      window.removeEventListener("resize", hide);
      document.removeEventListener("keydown", onKey);
    };
  }, [openAgent]);

  if (!chip) return null;
  return (
    <button
      type="button"
      className="ask-sel"
      style={{ left: chip.x, top: chip.y, transform: chip.flip ? "translateY(-100%)" : undefined }}
      aria-keyshortcuts="Alt+A"
      aria-label="Ask the agent about the selected text"
      onMouseDown={(e) => e.preventDefault()} // keep the selection alive through the click
      onClick={() => { openAgent(chip.q); setChip(null); window.getSelection()?.removeAllRanges(); }}
    >
      Ask<kbd aria-hidden="true">Alt A</kbd>
    </button>
  );
}
