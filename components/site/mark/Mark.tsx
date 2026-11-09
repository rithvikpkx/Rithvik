import { useId } from "react";
import { ouroPath } from "./ouro";
import "./mark.css";

/** solid/inverse/accent: plain fill (colour comes from currentColor, the kind only adds a hook class);
 *  hatch/plate/card/giant: hatched fill (giant also gets a pupil); spinner: rotates; tiny: favicon-scale. */
export type MarkKind = "solid" | "inverse" | "accent" | "hatch" | "hatched" | "plate" | "card" | "giant" | "spinner" | "tiny";

const G = ouroPath(); // one outline shared by every render

type Props = {
  kind?: MarkKind;
  className?: string;
  /** Draws the ring on once at mount (snout first, tail last). */
  draw?: boolean;
  /** Blinks the eye every few seconds. */
  blink?: boolean;
  /** Accessible name; pass "" to hide the mark from assistive tech when it is decorative. */
  label?: string;
};

/** The logo as inline SVG in currentColor. Size it with a width on the wrapper or className; animations are CSS and reduced-motion aware. */
export default function Mark({ kind = "solid", className = "", draw = false, blink = false, label = "Rithvik Praveen Kumar" }: Props) {
  const id = useId().replace(/:/g, "");
  const [ex, ey, er] = G.eye;
  const hatch = kind === "hatch" || kind === "hatched" || kind === "plate" || kind === "card" || kind === "giant";
  const R = G.R, a0 = ((G.head + 18) * Math.PI) / 180;
  const sx = (R * Math.cos(a0)).toFixed(2), sy = (R * Math.sin(a0)).toFixed(2), ex2 = (-R * Math.cos(a0)).toFixed(2), ey2 = (-R * Math.sin(a0)).toFixed(2);
  // counter-clockwise full loop starting just behind the snout, so it draws snout first, tail last
  const rev = `M${sx} ${sy} A${R} ${R} 0 1 0 ${ex2} ${ey2} A${R} ${R} 0 1 0 ${sx} ${sy}`;
  const cls = ["mark", `mk-${kind}`, draw && "draw", blink && "blinks", kind === "spinner" && "spinning", className].filter(Boolean).join(" ");
  const giant = kind === "giant";
  return (
    <svg className={cls} viewBox="-50 -50 100 100" role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true} focusable="false">
      <defs>
        <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="-60" y="-60" width="120" height="120">
          {draw ? <path className="mk-reveal" d={rev} pathLength={1} strokeWidth={G.W + 14} /> : <rect x="-60" y="-60" width="120" height="120" fill="#fff" />}
          <circle className="mk-eye" cx={ex} cy={ey} r={er} fill="#000" />
        </mask>
        {hatch && (
          <pattern id={`${id}h`} width={giant ? 0.62 : 1.6} height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <rect width={giant ? 0.24 : 0.6} height="4" fill="currentColor" />
          </pattern>
        )}
      </defs>
      <g className="mk-spin">
        <path className="mk-body" d={G.d} fill={hatch ? `url(#${id}h)` : "currentColor"} mask={`url(#${id}m)`} />
        {giant && <circle className="mk-pupil" cx={ex} cy={ey} r={+(er * 0.5).toFixed(2)} fill="currentColor" />}
      </g>
    </svg>
  );
}

/** The mark as a data: URL for <link rel="icon"> in the given colour (eye punched out). */
export function markFaviconHref(color = "#1f2328"): string {
  const [cx, cy, er] = G.eye;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"><mask id="e"><rect x="-50" y="-50" width="100" height="100" fill="#fff"/><circle cx="${cx}" cy="${cy}" r="${er}"/></mask><path d="${G.d}" fill="${color}" mask="url(#e)"/></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}
