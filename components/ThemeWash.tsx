"use client";
import type { CSSProperties } from "react";
import type { Theme } from "@/lib/types";

/**
 * Full-viewport liquid-glass wave that plays during a theme change.
 *
 * Visual recipe:
 *   • A radial-gradient background sweeping outward from the dial position.
 *     Behind the wave: translucent tint of the incoming theme's bg + a
 *     thin bright rim (accent → white → accent) right at the wave front.
 *     Ahead of the wave: transparent — the OLD theme page shows through.
 *   • A radial-gradient mask in lockstep with the background gradient,
 *     making "behind the wave" opaque and "ahead" transparent.
 *   • backdrop-filter stacks an SVG turbulence + displacement (defined
 *     inline below as `#wash-glass`) for real glass-like warping of the
 *     content beneath, then a CSS blur/saturate/brightness/hue-rotate
 *     chain for the oily, refractive character.
 *
 * The SVG filter def lives inside this component so it's only in the DOM
 * while the wash is mounted. Keyframes + the rest live in globals.css.
 */
export default function ThemeWash({ theme }: { theme: Theme }) {
  const style = {
    "--wash-accent": theme.tokens.accent,
    "--wash-bg":     theme.tokens.bg,
  } as CSSProperties;

  return (
    <>
      {/* SVG filter definitions — referenced by .theme-wash via
          backdrop-filter: url(#wash-glass). The svg itself doesn't paint
          (zero size, hidden) but the filter inside is queryable by ID. */}
      <svg className="theme-wash-defs" aria-hidden focusable="false">
        <defs>
          <filter
            id="wash-glass"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.02"
              numOctaves={2}
              seed={4}
              result="turb"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="turb"
              scale={22}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
      <div className="theme-wash" aria-hidden style={style} />
    </>
  );
}
