"use client";
import { useTheme } from "./ThemeProvider";
import type { CSSProperties } from "react";

/**
 * Half-radial theme selector anchored to the left edge.
 *
 * Layout
 * ──────
 *   • Container is positioned at viewport left:0, vertically centered.
 *     It's translated by -50% on X so its geometric center sits on x = 0.
 *     That means the left half of the dial is off-screen; only the right
 *     half is visible — exactly the half-dial look from the spec.
 *
 *   • The dial face holds N option buttons distributed on the visible
 *     180° arc. Each option's angle is in CSS-rotate convention:
 *       0deg = 3 o'clock (right, the pointer position)
 *      -90deg = 12 o'clock (top)
 *      +90deg = 6 o'clock (bottom)
 *     For N options we spread them at -90 + (i+1)/(N+1) * 180 so they're
 *     inset from the top/bottom edges of the arc.
 *
 *   • The pointer is a fixed marker at the rightmost point of the dial.
 *     To select theme i, the whole dial face rotates by -angleFor(i) so
 *     option i lands at angle 0 (the pointer position).
 */

// Match the CSS clamp values for --dial-radius; the option positioning
// uses var(--dial-radius) so the dial resizes responsively without JS.
const SWATCH_INSET = 32; // px — distance from dial edge to swatch center

function angleFor(i: number, n: number): number {
  return -90 + ((i + 1) / (n + 1)) * 180;
}

export default function ThemeDial() {
  const { themes, currentSlug, setTheme } = useTheme();
  const sorted = [...themes].sort((a, b) => a.sort_order - b.sort_order);
  if (sorted.length < 2) return null; // dial only useful with 2+ themes

  const currentIdx = Math.max(0, sorted.findIndex((t) => t.slug === currentSlug));
  const dialRotation = -angleFor(currentIdx, sorted.length);

  return (
    <div
      className="theme-dial-container"
      role="radiogroup"
      aria-label="Theme selector"
    >
      <div
        className="theme-dial-face"
        style={{ transform: `rotate(${dialRotation}deg)` }}
      >
        {sorted.map((t, i) => {
          const angle = angleFor(i, sorted.length);
          const isActive = t.slug === currentSlug;
          const optionStyle: CSSProperties = {
            transform: `rotate(${angle}deg) translateX(calc(var(--dial-radius) - ${SWATCH_INSET}px))`,
          };
          const swatchStyle: CSSProperties = {
            background: `radial-gradient(circle at 32% 30%, ${t.tokens.bg} 0%, color-mix(in srgb, ${t.tokens.bg} 75%, ${t.tokens.text}) 100%)`,
            // Counter-rotate so the swatch & dot face up regardless of dial rotation
            transform: `rotate(${-angle - dialRotation}deg)`,
          };
          return (
            <button
              key={t.slug}
              type="button"
              className={`theme-option${isActive ? " is-active" : ""}`}
              style={optionStyle}
              onClick={() => setTheme(t.slug)}
              role="radio"
              aria-checked={isActive}
              aria-label={`Switch to ${t.name} theme`}
              title={t.name}
            >
              <span className="theme-swatch" style={swatchStyle}>
                <span
                  className="theme-swatch-dot"
                  style={{ background: t.tokens.accent }}
                />
              </span>
            </button>
          );
        })}
      </div>
      <div className="theme-dial-pointer" aria-hidden />
    </div>
  );
}
