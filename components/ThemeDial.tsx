"use client";
import { useTheme } from "./ThemeProvider";
import type { CSSProperties } from "react";

/**
 * Radial liquid-glass theme dial — tucked to the left edge.
 *
 * Items fan around the currently SELECTED item, which sits horizontal at
 * the pivot. Unselected items above tilt up; unselected items below tilt
 * down. Clicking another option re-pivots: it becomes horizontal and the
 * rest fan around it, with a spring-y transition that reads like a dial
 * rotating into a new detent.
 *
 * Swatches are flat rounded squares with a linear gradient through the
 * theme's three major colors (bg → accent → text).
 */

const STEP_DEG = 18; // angle between adjacent items in the fan

export default function ThemeDial() {
  const { themes, currentSlug, setTheme } = useTheme();
  const sorted = [...themes].sort((a, b) => a.sort_order - b.sort_order);
  if (sorted.length < 2) return null;

  // Pivot the fan around the currently-selected item so it stays horizontal.
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
          const angle = (i - selectedIdx) * STEP_DEG;
          const optionStyle: CSSProperties = {
            transform: `rotate(${angle}deg)`,
          };
          const swatchStyle: CSSProperties = {
            background: `linear-gradient(135deg, ${t.tokens.bg} 0%, ${t.tokens.accent} 50%, ${t.tokens.text} 100%)`,
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
              <span className="theme-strip-tick" aria-hidden />
              <span className="theme-strip-swatch" style={swatchStyle} aria-hidden />
              <span className="theme-strip-label">{t.name}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
