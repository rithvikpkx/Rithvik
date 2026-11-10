import { useId } from "react";
import { CHAIN, SMALL, ouroPath } from "./ouro";
import "./mark.css";

/** solid/inverse/accent: plain fill (colour comes from currentColor, the kind only adds a hook class);
 *  hatch/plate/card/giant: hatched fill (giant finer); spinner: the three-link chain, rotating; tiny: the 16px optical size. */
export type MarkKind = "solid" | "inverse" | "accent" | "hatch" | "hatched" | "plate" | "card" | "giant" | "spinner" | "tiny";

// outlines shared by every render
const G = ouroPath(), G_SMALL = ouroPath(SMALL), G_CHAIN = ouroPath(CHAIN);

type Props = {
  kind?: MarkKind;
  className?: string;
  /** Draws the band on once at mount, head first, tail last. */
  draw?: boolean;
  /** Turns slowly and breathes, a seamless loop. */
  idle?: boolean;
  /** Kept for old callers; the mark has no eye now, so it does nothing. */
  blink?: boolean;
  /** Accessible name; pass "" to hide the mark from assistive tech when it is decorative. */
  label?: string;
};

/** The logo as inline SVG in currentColor. Size it with a width on the wrapper or className; animations are CSS and reduced-motion aware. */
export default function Mark({ kind = "solid", className = "", draw = false, idle = false, label = "Rithvik Praveen Kumar" }: Props) {
  const id = useId().replace(/:/g, "");
  const hatch = kind === "hatch" || kind === "hatched" || kind === "plate" || kind === "card" || kind === "giant";
  const g = kind === "spinner" ? G_CHAIN : kind === "tiny" ? G_SMALL : G;
  const cls = ["mark", `mk-${kind}`, draw && "draw", idle && "idle", kind === "spinner" && "spinning", className].filter(Boolean).join(" ");
  const giant = kind === "giant";
  return (
    <svg className={cls} viewBox="-50 -50 100 100" role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true} focusable="false">
      {(draw || hatch) && (
        <defs>
          {draw && (
            <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="-60" y="-60" width="120" height="120">
              <path className="mk-reveal" d={revealPath(g.R, g.head)} pathLength={1} strokeWidth={g.W + 16} />
            </mask>
          )}
          {hatch && (
            <pattern id={`${id}h`} width={giant ? 0.62 : 1.6} height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
              <rect width={giant ? 0.24 : 0.6} height="4" fill="currentColor" />
            </pattern>
          )}
        </defs>
      )}
      <g className="mk-spin">
        <path className="mk-body" d={g.d} fill={hatch ? `url(#${id}h)` : "currentColor"} mask={draw ? `url(#${id}m)` : undefined} />
      </g>
    </svg>
  );
}

/** A stroke that follows the band from the head round to the tail (anticlockwise, a little over one turn), for the draw-on mask. */
export function revealPath(R: number, head: number): string {
  const p = (deg: number) => `${(R * Math.cos((deg * Math.PI) / 180)).toFixed(2)} ${(R * Math.sin((deg * Math.PI) / 180)).toFixed(2)}`;
  // three arcs (a single SVG arc cannot exceed 360deg), each sweep-flag 0 = anticlockwise on screen
  return `M${p(head + 8)} A${R} ${R} 0 0 0 ${p(head - 130)} A${R} ${R} 0 0 0 ${p(head - 260)} A${R} ${R} 0 0 0 ${p(head - 380)}`;
}

/** The mark as a data: URL for <link rel="icon"> in the given colour (the 16px optical size). */
export function markFaviconHref(color = "#1f2328"): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"><path d="${G_SMALL.d}" fill="${color}"/></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}
