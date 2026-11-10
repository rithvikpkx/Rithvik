import { createElement, useMemo } from "react";
import { projectArt, type ArtParams, type ArtProject, type Palette } from "@/lib/art/art";

/** The look's art colours, published as CSS tokens by SiteLayout, so the case sheet and the Work body agree. */
export const ART_VARS: Palette = ["var(--art-0)", "var(--art-1)", "var(--art-2)", "var(--art-3)"];

/** A project's procedural art as inline SVG. Colours go through `style` so `var(--x)` palettes resolve. */
export default function ProjectArt({ project, palette = ART_VARS, params, rank = 0, className = "art" }: { project: ArtProject; palette?: Palette; params?: ArtParams; rank?: number; className?: string }) {
  const art = useMemo(() => projectArt(project, palette, params, rank), [project, palette, params, rank]);
  return (
    <svg className={className} viewBox={`0 0 ${art.w} ${art.h}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" data-grammar={art.grammar}>
      {art.nodes.map(([tag, { fill, stroke, ...at }], i) => createElement(tag, { key: i, ...at, style: { fill, stroke } }))}
    </svg>
  );
}
