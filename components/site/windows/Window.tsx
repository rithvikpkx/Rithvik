"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import Icon from "./Icon";
import "./windows.css";

type Props = {
  title: React.ReactNode;
  icon: string;
  label: string; // aria-label
  className?: string; // e.g. "resume-win" | "composer-win"
  place?: "center" | "corner"; // first-open position (mockup: resume centred, composer bottom-right)
  actions?: React.ReactNode; // extra header buttons, left of the close button
  onClose: () => void;
  initialFocus?: string; // CSS selector inside the window to focus on open
  children: React.ReactNode;
};

/** The shared draggable, non-modal floating window: drag by header, Esc closes, focus moves in on
 *  open and returns on close. ≤640px it becomes a bottom sheet via CSS (no drag). */
export default function Window({ title, icon, label, className = "", place = "center", actions, onClose, initialFocus, children }: Props) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose); // useSite().close changes identity per render; keep the effect stable
  useEffect(() => { closeRef.current = onClose; });

  // Place using the real rendered size (the opening scale animation doesn't affect offset sizes).
  useLayoutEffect(() => {
    const w = ref.current;
    if (!w || innerWidth <= 640) return;
    const ww = w.offsetWidth, wh = w.offsetHeight;
    const x = place === "center" ? (innerWidth - ww) / 2 : innerWidth - ww - 32;
    const y = place === "center" ? (innerHeight - wh) / 2 : innerHeight - wh - 104;
    w.style.left = Math.max(8, Math.min(innerWidth - ww - 8, x)) + "px";
    w.style.top = Math.max(76, Math.min(innerHeight - wh - 8, y)) + "px";
  }, [place]);

  // Focus in on open, restore on close; Esc closes (non-modal, so listen on document).
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const w = ref.current;
    ((initialFocus && w?.querySelector<HTMLElement>(initialFocus)) || w)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.({ preventScroll: true }); };
  }, [initialFocus]);

  // Drag straight on the DOM (no React state per move); header buttons stay clickable.
  const startDrag = (e: React.PointerEvent<HTMLElement>) => {
    const w = ref.current;
    if (!w || innerWidth <= 640 || (e.target as Element).closest("button")) return;
    const dx = e.clientX - w.offsetLeft, dy = e.clientY - w.offsetTop;
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      w.style.left = Math.max(80 - w.offsetWidth, Math.min(innerWidth - 80, ev.clientX - dx)) + "px";
      w.style.top = Math.max(8, Math.min(innerHeight - 48, ev.clientY - dy)) + "px";
    };
    const bar = e.currentTarget;
    const up = () => { bar.removeEventListener("pointermove", move); bar.removeEventListener("pointerup", up); bar.removeEventListener("pointercancel", up); };
    bar.addEventListener("pointermove", move); bar.addEventListener("pointerup", up); bar.addEventListener("pointercancel", up);
  };

  return (
    <section ref={ref} className={`win front ${className}`} aria-label={label} tabIndex={-1} style={{ outline: "none" }}>
      <header className="win-bar" onPointerDown={startDrag}>
        <span className="win-title"><Icon name={icon} />{title}</span>
        <span className="win-actions">
          {actions}
          <button type="button" className="ui-ic" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </span>
      </header>
      {children}
    </section>
  );
}
