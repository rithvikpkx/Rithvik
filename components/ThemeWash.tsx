"use client";
import type { CSSProperties } from "react";
import type { Theme } from "@/lib/types";

/**
 * Full-viewport liquid-glass wash that plays during a theme change.
 *
 * Two stacked radial gradients (accent core + bg outer) on a backdrop-
 * filtered overlay, clipped by an expanding circle anchored at the
 * dial position. The 750ms keyframes are in globals.css; the colors
 * come from the incoming theme via CSS variables set inline.
 *
 * Remount via React `key` to replay the animation on every selection.
 */
export default function ThemeWash({ theme }: { theme: Theme }) {
  const style = {
    "--wash-accent": theme.tokens.accent,
    "--wash-bg":     theme.tokens.bg,
  } as CSSProperties;

  return <div className="theme-wash" aria-hidden style={style} />;
}
