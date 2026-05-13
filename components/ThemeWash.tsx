"use client";
import type { CSSProperties } from "react";
import type { Theme } from "@/lib/types";

/**
 * Full-viewport liquid-glass wave that plays during a theme change.
 *
 * A radial gradient sweeping outward from the dial position: the wave
 * front is the incoming accent color; behind it the incoming bg fills.
 * A backdrop-filter blur + saturate refracts the page beneath. The
 * 500ms keyframes live in globals.css; colors come from the incoming
 * theme via CSS variables set inline.
 *
 * The parent remounts this via React `key` so the animation restarts
 * cleanly on each new selection.
 */
export default function ThemeWash({ theme }: { theme: Theme }) {
  const style = {
    "--wash-accent": theme.tokens.accent,
    "--wash-bg":     theme.tokens.bg,
  } as CSSProperties;

  return <div className="theme-wash" aria-hidden style={style} />;
}
