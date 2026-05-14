"use client";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "./ThemeProvider";
import { THEME_STORAGE_KEY } from "@/lib/themes";
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
const DRAG_STEP_PX = 38;         // px of vertical drag per theme step;
                                 //   also the minimum movement before we
                                 //   commit to "this is a drag, not a click"

// First-visit auto-demo: gently introduces the theme picker by expanding
// the dial and rotating it to SynthWave '84 on its own. Runs once per browser.
const DEMO_SHOWN_KEY        = "rithvik-theme-demo-shown";
const DEMO_TARGET_SLUG      = "synthwave-84";
const DEMO_DEFAULT_DELAY_MS = 10000; // fallback if no DB setting provided
const DEMO_STEP_MS          = 260;   // ms per theme step (overlaps the 0.42s CSS transition)
const DEMO_SETTLE_MS        = 1400;  // how long to linger on the target before collapsing

export default function ThemeDial({ demoDelayMs }: { demoDelayMs?: number } = {}) {
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

  // ── First-visit auto-demo ────────────────────────────────────────────────
  // Three conditions to play: (1) we're in the browser, (2) the user has
  // never stored a theme preference, (3) the demo hasn't already run.
  //
  // Cancellation is intentionally narrow: only an actual theme switch by
  // the user aborts the demo (not arbitrary clicks). We detect this by
  // comparing currentSlug to the slug we last set ourselves — if they
  // diverge, the change came from somewhere else.
  const [isDemoing, setIsDemoing] = useState(false);
  const demoExpectedSlugRef = useRef<string>(currentSlug);
  const demoAbortRef = useRef<(() => void) | null>(null);
  // A delay of 0 explicitly disables the demo (escape hatch from the edit UI).
  const effectiveDelayMs = demoDelayMs ?? DEMO_DEFAULT_DELAY_MS;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (effectiveDelayMs <= 0) return;
    try {
      if (localStorage.getItem(THEME_STORAGE_KEY)) return;
      if (localStorage.getItem(DEMO_SHOWN_KEY)) return;
    } catch {
      return;
    }

    // Snapshot the theme list at mount; refetches during demo would be racy.
    const snapshot = stateRef.current.sorted;
    const targetIdx = snapshot.findIndex((t) => t.slug === DEMO_TARGET_SLUG);
    const startIdx  = stateRef.current.selectedIdx;
    if (targetIdx < 0 || targetIdx === startIdx) return; // nothing to demo

    let aborted = false;
    let stepTimer: ReturnType<typeof setTimeout> | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const abort = () => {
      if (aborted) return;
      aborted = true;
      if (stepTimer) clearTimeout(stepTimer);
      if (settleTimer) clearTimeout(settleTimer);
      setIsDemoing(false);
    };
    demoAbortRef.current = abort;

    const kickoffTimer = setTimeout(() => {
      if (aborted) return;
      // Mark as shown up-front so even a refresh mid-demo doesn't replay it.
      try { localStorage.setItem(DEMO_SHOWN_KEY, "1"); } catch {}

      setIsDemoing(true);

      // Step toward the target one theme at a time. Each setTheme call lets
      // the existing CSS transition (0.42s) carry the rotation; spacing the
      // steps at 260ms gives a fluid, continuous rotation rather than a hop.
      let i = startIdx;
      const step = () => {
        if (aborted) return;
        if (i === targetIdx) {
          settleTimer = setTimeout(() => {
            if (!aborted) setIsDemoing(false);
          }, DEMO_SETTLE_MS);
          return;
        }
        i += i < targetIdx ? 1 : -1;
        const nextSlug = snapshot[i].slug;
        demoExpectedSlugRef.current = nextSlug;
        stateRef.current.setTheme(nextSlug);
        stepTimer = setTimeout(step, DEMO_STEP_MS);
      };
      step();
    }, effectiveDelayMs);

    return () => {
      clearTimeout(kickoffTimer);
      if (stepTimer) clearTimeout(stepTimer);
      if (settleTimer) clearTimeout(settleTimer);
      demoAbortRef.current = null;
    };
  }, [effectiveDelayMs]);

  // Cancel the demo (or its waiting window) the moment currentSlug diverges
  // from what we last set ourselves — that means the user actively switched
  // themes. Arbitrary clicks elsewhere on the page don't trigger this.
  useEffect(() => {
    if (currentSlug !== demoExpectedSlugRef.current) {
      demoAbortRef.current?.();
      // Also mark the demo as "shown" so a manual switch during the wait
      // window doesn't leave the flag unset for the next page load.
      try { localStorage.setItem(DEMO_SHOWN_KEY, "1"); } catch {}
    }
  }, [currentSlug]);

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

  // ── Drag: vertical pointer drag cycles themes in DRAG_STEP_PX steps.
  //   IMPORTANT: don't capture the pointer on pointerdown — that would
  //   redirect the eventual click away from the pill button to this
  //   container, breaking simple click-to-select. We only capture once
  //   the user has actually dragged past DRAG_STEP_PX (a full step), at
  //   which point we KNOW it's a drag, not a click.
  const dragRef = useRef<{
    startY: number;
    startIdx: number;
    pointerId: number;
    isDragging: boolean;
  } | null>(null);
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = {
      startY: e.clientY,
      startIdx: selectedIdx,
      pointerId: e.pointerId,
      isDragging: false,
    };
    // intentionally no setPointerCapture here
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dy = e.clientY - d.startY;
    // Below a full step's worth of movement, this is still ambiguous —
    // could be a click with a slight wobble. Don't capture, don't change.
    if (Math.abs(dy) < DRAG_STEP_PX) return;
    if (!d.isDragging) {
      d.isDragging = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    }
    const steps = Math.trunc(dy / DRAG_STEP_PX);
    const next = Math.max(0, Math.min(sorted.length - 1, d.startIdx + steps));
    if (next !== selectedIdx) setTheme(sorted[next].slug);
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (d.isDragging) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    }
    dragRef.current = null;
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
      className={`theme-dial-aside${isDemoing ? " is-demoing" : ""}`}
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
