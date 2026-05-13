"use client";
import { useTheme } from "./ThemeProvider";
import type { CSSProperties } from "react";

/**
 * Radial liquid-glass theme dial — tucked to the left edge.
 *
 * Dormant: a tiny half-pill showing three dots that preview the active
 * theme's bg / accent / text colors. No theme name, no fan.
 *
 * On hover: the shell expands smoothly into the half-pill dial and the
 * fan of pill-shaped theme options fades in. The selected pill sits
 * horizontal at the vertical center; the rest fan radially above/below
 * with a stepped rotation + offset. Mouse-out collapses it again.
 */

const STEP_DEG = 18;     // angle between adjacent pills in the fan
const ITEM_SPACING = 56; // vertical px between pill centers

export default function ThemeDial() {
  const { themes, currentSlug, setTheme } = useTheme();
  const sorted = [...themes].sort((a, b) => a.sort_order - b.sort_order);
  if (sorted.length < 2) return null;

  const selectedIdx = Math.max(0, sorted.findIndex((t) => t.slug === currentSlug));

  return (
    <aside
      className="theme-dial-aside"
      role="radiogroup"
      aria-label="Theme selector"
    >
      <div className="theme-dial-content">
        {/* Dormant indicator — three color dots from the active theme */}
        <div className="theme-dial-dormant" aria-hidden>
          <span className="theme-dial-dot dot-bg" />
          <span className="theme-dial-dot dot-accent" />
          <span className="theme-dial-dot dot-text" />
        </div>

        {/* Fan of theme pills — only visible on hover */}
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
                key={t.slug}
                type="button"
                className={`theme-strip-option${active ? " is-active" : ""}`}
                role="radio"
                aria-checked={active}
                aria-label={`Switch to ${t.name}`}
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
