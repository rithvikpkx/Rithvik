"use client";
import { useTheme } from "./ThemeProvider";
import type { CSSProperties } from "react";

/**
 * Radial liquid-glass theme dial — tucked to the left edge.
 *
 * Items are stacked vertically inside a frosted-glass strip, but each is
 * rotated around its left edge so they fan out radially. The top item
 * tilts upward, the bottom tilts downward, and any items in between
 * spread between — together forming a half-circle dial the user picks
 * from. Hovering the strip slides labels in beside each swatch.
 *
 * Swatches are flat rounded squares with a linear gradient through the
 * theme's three major colors (bg → accent → text) so each preview is
 * recognizable at a glance.
 */

const STEP_DEG = 18; // angle between adjacent items in the fan

function angleFor(i: number, n: number): number {
  return (i - (n - 1) / 2) * STEP_DEG;
}

export default function ThemeDial() {
  const { themes, currentSlug, setTheme } = useTheme();
  const sorted = [...themes].sort((a, b) => a.sort_order - b.sort_order);
  if (sorted.length < 2) return null;

  return (
    <aside
      className="theme-dial-aside"
      role="radiogroup"
      aria-label="Theme selector"
    >
      <div className="theme-dial-content">
        {sorted.map((t, i) => {
          const active = t.slug === currentSlug;
          const angle = angleFor(i, sorted.length);
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
