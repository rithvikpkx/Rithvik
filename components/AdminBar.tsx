"use client";
import "./EditMode.css";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useEditMode } from "./EditModeProvider";

const POS_KEY = "rv-admin-bar"; // localStorage: where the owner parked the bar
type Pos = { x: number; y: number };
const EDGE = 8; // keep this many px between the bar and the viewport edge

/** Lucide paths for the bar's four actions (the shared icon set has none of these). */
const PATHS = {
  pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  dash: <><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></>,
  content: <><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.4 2.6a2.1 2.1 0 1 1 3 3L12 15l-4 1 1-4Z" /></>,
  exit: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
};
/** One 24px stroke icon. */
const Ic = ({ n }: { n: keyof typeof PATHS }) => (
  <svg className="ab-ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PATHS[n]}</svg>
);

/** Keeps a bar of size w×h fully inside the viewport. */
const clamp = (p: Pos, w: number, h: number): Pos => ({
  x: Math.round(Math.min(Math.max(EDGE, p.x), Math.max(EDGE, window.innerWidth - w - EDGE))),
  y: Math.round(Math.min(Math.max(EDGE, p.y), Math.max(EDGE, window.innerHeight - h - EDGE))),
});

/** The owner's floating admin bar: inline editing on/off, Dashboard, Edit content, Exit. Drag it by the grip (or focus the
 *  grip and use the arrow keys; Home resets); the spot is remembered per browser and always kept on screen. */
export default function AdminBar({ onEditContent }: { onEditContent?: () => void }) {
  const { isEditing, barHidden, inlineOn, setInlineOn, logout } = useEditMode();
  const bar = useRef<HTMLDivElement>(null);
  // null = the CSS default (bottom centre, above the agent prompt). Lazy init: this component is client-only (ssr:false).
  const [pos, setPos] = useState<Pos | null>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(POS_KEY) ?? "null") as Pos | null;
      return v && Number.isFinite(v.x) && Number.isFinite(v.y) ? clamp(v, 420, 48) : null;
    } catch { return null; }
  });
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  /** Saves (or clears) the parked position. Storage can be blocked; the bar still works without it. */
  const persist = (p: Pos | null) => { try { if (p) localStorage.setItem(POS_KEY, JSON.stringify(p)); else localStorage.removeItem(POS_KEY); } catch {} };

  // A resized window must not strand the bar off screen.
  useEffect(() => {
    const onResize = () => setPos((p) => { const r = bar.current?.getBoundingClientRect(); return p && r ? clamp(p, r.width, r.height) : p; });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const size = () => { const r = bar.current!.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };

  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !bar.current) return;
    const r = size();
    drag.current = { dx: e.clientX - r.x, dy: e.clientY - r.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !bar.current) return;
    const r = size();
    setPos(clamp({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }, r.w, r.h));
  };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    setPos((p) => { persist(p); return p; });
  };
  // Keyboard: arrows nudge (Shift = bigger steps), Home/Escape put it back.
  const onKey = (e: React.KeyboardEvent) => {
    if (!bar.current) return;
    if (e.key === "Home" || e.key === "Escape") { e.preventDefault(); setPos(null); persist(null); return; }
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const r = size(), step = e.shiftKey ? 48 : 12;
    const next = clamp({ x: r.x + d[0] * step, y: r.y + d[1] * step }, r.w, r.h);
    setPos(next);
    persist(next);
  };

  return (
    <AnimatePresence>
      {isEditing && !barHidden && (
        <motion.div
          ref={bar}
          className={`admin-bar${pos ? " is-placed" : ""}${dragging ? " is-dragging" : ""}`}
          style={pos ? { left: pos.x, top: pos.y } : undefined}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.16 }}
          role="toolbar"
          aria-label="Admin bar"
        >
          <button
            type="button" className="ab-grip" aria-label="Move the admin bar. Arrow keys move it, Home resets." title="Drag to move"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}
          >
            <svg viewBox="0 0 10 16" width="10" height="16" fill="currentColor" aria-hidden="true">{[3, 8, 13].map((y) => <g key={y}><circle cx="2" cy={y} r="1.2" /><circle cx="8" cy={y} r="1.2" /></g>)}</svg>
          </button>
          <span className="ab-live" aria-hidden="true" />
          <span className="ab-name">Admin</span>
          <button
            type="button" className="ab-btn ab-toggle" role="switch" aria-checked={inlineOn} onClick={() => setInlineOn(!inlineOn)}
            title={inlineOn ? "Inline editing is on: click any outlined text to change it" : "Inline editing is off: the page behaves normally"}
          >
            <Ic n="pencil" /><span className="ab-l">Inline editing</span><span className="ab-sw" aria-hidden="true" /><span className="ab-state">{inlineOn ? "On" : "Off"}</span>
          </button>
          <a className="ab-btn" href="/admin" title="Open the analytics dashboard"><Ic n="dash" /><span className="ab-l">Dashboard</span></a>
          {onEditContent && <button type="button" className="ab-btn" onClick={onEditContent} title="Lists, links, places, drafts"><Ic n="content" /><span className="ab-l">Edit content</span></button>}
          <button type="button" className="ab-btn ab-exit" onClick={logout} title="Sign out"><Ic n="exit" /><span className="ab-l">Exit</span></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
