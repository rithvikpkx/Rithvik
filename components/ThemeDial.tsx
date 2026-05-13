"use client";
import { useTheme } from "./ThemeProvider";

/**
 * Apple liquid-glass theme dial — tucked to the left edge as a thin vertical
 * strip. Tick marks + tiny color swatches are always visible. On hover (or
 * keyboard focus), the strip expands to reveal each theme's name.
 *
 * Each swatch is a small target: theme's bg as the outer ring fill, text as
 * the ring stroke, accent as a dot in the center — a 3-color preview at a
 * glance. Active option has a colored tick + accent glow on the swatch.
 */
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
        {sorted.map((t) => {
          const active = t.slug === currentSlug;
          return (
            <button
              key={t.slug}
              type="button"
              className={`theme-strip-option${active ? " is-active" : ""}`}
              role="radio"
              aria-checked={active}
              aria-label={`Switch to ${t.name}`}
              onClick={() => setTheme(t.slug)}
            >
              <span className="theme-strip-tick" aria-hidden />
              <span
                className="theme-strip-swatch"
                style={{ background: t.tokens.bg, borderColor: t.tokens.text }}
                aria-hidden
              >
                <span style={{ background: t.tokens.accent }} />
              </span>
              <span className="theme-strip-label">{t.name}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
