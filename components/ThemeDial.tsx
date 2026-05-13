"use client";
import { useEffect, useRef } from "react";
import { useTheme } from "./ThemeProvider";
import type { CSSProperties } from "react";

/**
 * Radial liquid-glass theme dial — tucked to the left edge.
 *
 * Dormant: tiny half-pill showing three dots that preview the active
 * theme's bg / accent / text colors. On hover (or keyboard focus), the
 * shell expands and the fan of pill-shaped theme options fades in.
 *
 * Interactions:
 *   • Click           — select that theme.
 *   • Mouse wheel     — cycle to next/prev with a small cooldown.
 *   • Drag vertically — each ~38px step moves one theme; clamps at ends.
 *   • Arrow keys      — Up/Left = prev, Down/Right = next; Home/End = ends.
 *
 * The radio-group / radio pattern with roving tabindex (active = 0,
 * others = -1) gives screen readers and keyboard users a coherent
 * single-tab-stop entry point.
 */

const STEP_DEG = 18;             // angle between adjacent pills in the fan
const ITEM_SPACING = 56;         // vertical px between pill centers
const WHEEL_COOLDOWN_MS = 220;   // min interval between wheel-driven steps
const DRAG_STEP_PX = 38;         // px of vertical drag per theme step
const DRAG_THRESHOLD_PX = 8;     // ignore tiny pointer jitter as "drag"

export default function ThemeDial() {
  const { themes, currentSlug, setTheme } = useTheme();
  const sorted = [...themes].sort((a, b) => a.sort_order - b.sort_order);
  const selectedIdx = Math.max(0, sorted.findIndex((t) => t.slug === currentSlug));

  const contentRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // State mirrored into a ref so the once-attached wheel handler can see the
  // latest selection without re-binding the listener every render.
  const stateRef = useRef({ selectedIdx, sorted, setTheme, lastWheel: 0 });
  useEffect(() => {
    stateRef.current.selectedIdx = selectedIdx;
    stateRef.current.sorted = sorted;
    stateRef.current.setTheme = setTheme;
  }, [selectedIdx, sorted, setTheme]);

  // ── Wheel: React's onWheel is passive in React 17+, so attach manually
  //   with { passive: false } to be able to preventDefault on the page scroll.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = stateRef.current;
      const now = Date.now();
      if (now - s.lastWheel < WHEEL_COOLDOWN_MS) return;
      s.lastWheel = now;
      const dir = e.deltaY > 0 ? 1 : -1;
      const next = Math.max(0, Math.min(s.sorted.length - 1, s.selectedIdx + dir));
      if (next !== s.selectedIdx) s.setTheme(s.sorted[next].slug);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── Drag: vertical pointer drag cycles themes in 38px steps. Pointer
  //   capture so the drag continues even if the cursor leaves the dial.
  const dragRef = useRef<{ startY: number; startIdx: number; pointerId: number } | null>(null);
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = { startY: e.clientY, startIdx: selectedIdx, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) < DRAG_THRESHOLD_PX) return;
    const steps = Math.trunc(dy / DRAG_STEP_PX);
    const next = Math.max(0, Math.min(sorted.length - 1, d.startIdx + steps));
    if (next !== selectedIdx) setTheme(sorted[next].slug);
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current && e.pointerId === dragRef.current.pointerId) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
      dragRef.current = null;
    }
  };

  // ── Keyboard: arrow keys + Home/End. Move focus along with selection.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    let next = selectedIdx;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = selectedIdx - 1;
    else if (e.key === "ArrowDown" || e.key === "ArrowRight") next = selectedIdx + 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = sorted.length - 1;
    else return;
    e.preventDefault();
    next = Math.max(0, Math.min(sorted.length - 1, next));
    if (next === selectedIdx) return;
    const targetSlug = sorted[next].slug;
    setTheme(targetSlug);
    requestAnimationFrame(() => {
      buttonRefs.current[targetSlug]?.focus();
    });
  };

  if (sorted.length < 2) return null;

  return (
    <aside
      className="theme-dial-aside"
      role="radiogroup"
      aria-label="Theme selector"
    >
      <div
        ref={contentRef}
        className="theme-dial-content"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
      >
        {/* Dormant indicator — three color dots from the active theme */}
        <div className="theme-dial-dormant" aria-hidden>
          <span className="theme-dial-dot dot-bg" />
          <span className="theme-dial-dot dot-accent" />
          <span className="theme-dial-dot dot-text" />
        </div>

        {/* Fan of theme pills — visible on hover or when a child is keyboard-focused */}
        <div className="theme-dial-fan">
          {sorted.map((t, i) => {
            const active = t.slug === currentSlug;
            const distance = i - selectedIdx;
            const angle = distance * STEP_DEG;
            const yOffset = distance * ITEM_SPACING;

            const optionStyle: CSSProperties = {
              transform: `translate(0, calc(-50% + ${yOffset}px)) rotate(${angle}deg)`,
              background: t.tokens.bg,
              color: t.tokens.text,
              fontFamily: t.tokens.font ?? undefined,
            };

            return (
              <button
                ref={(el) => { buttonRefs.current[t.slug] = el; }}
                key={t.slug}
                type="button"
                className={`theme-strip-option${active ? " is-active" : ""}`}
                role="radio"
                aria-checked={active}
                aria-label={`Switch to ${t.name}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setTheme(t.slug)}
                style={optionStyle}
              >
                <span className="theme-strip-name">{t.name}</span>
                {active && (
                  <span className="theme-strip-dots" aria-hidden>
                    <span style={{ background: t.tokens.bg, boxShadow: `inset 0 0 0 1px ${t.tokens.text}` }} />
                    <span style={{ background: t.tokens.accent }} />
                    <span style={{ background: t.tokens.text }} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
