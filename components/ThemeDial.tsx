"use client";
import { useTheme } from "./ThemeProvider";
import type { CSSProperties } from "react";

/**
 * Radial liquid-glass theme dial.
 *
 * Each item is a rounded-rectangle pill whose own background is the
 * theme's bg color and whose text is the theme's text color — so the
 * pill IS the swatch. The currently selected pill sits horizontal at
 * the vertical center of the dial; other pills fan above and below
 * with a stepped rotation and matching vertical offset.
 *
 * Hovering the dial fades in the non-selected pills (in the collapsed
 * state only the selected pill is shown, centered).
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
    </aside>
  );
}
