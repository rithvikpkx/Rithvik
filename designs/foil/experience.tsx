"use client";
// Foil's Experience pieces: a holographic ribbon threaded between stations, and a foil rosette medal for education
// whose colours turn with the pointer while its tails swing.
import type { CSSProperties } from "react";
import type { Skin } from "@/lib/designs/skin";
import "./experience.css";

/** A scalloped rosette outline (viewBox 0 0 200 200) as a CSS mask. */
const ROSETTE = (() => {
  const n = 30, R = 92, cx = 100, cy = 100, pt = (i: number) => [cx + R * Math.cos((i / n) * 2 * Math.PI), cy + R * Math.sin((i / n) * 2 * Math.PI)].map((v) => v.toFixed(2));
  let d = `M${pt(0).join(" ")}`;
  for (let i = 1; i <= n; i++) d += `A10 10 0 0 1 ${pt(i).join(" ")}`;
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><path d='${d}Z'/></svg>`)}")`;
})();

/** A dark thread until the scroll reaches it; then a foil ribbon, its sheen running, a foil star at the front. */
function Ribbon() {
  return (
    <>
      <i className="xp-track fx-thread" />
      <i className="xp-fill fx-ribbon" />
      <i className="xp-head"><svg className="fx-star" viewBox="0 0 20 20" focusable="false"><path d="M10 0 12.6 7.4 20 10 12.6 12.6 10 20 7.4 12.6 0 10 7.4 7.4Z" /></svg></i>
    </>
  );
}

/** The medal: two V-cut ribbon tails, a scalloped foil rosette, a dark centre with the Purdue P stamped in holographic foil. */
function Medal() {
  const mask = { WebkitMaskImage: ROSETTE, maskImage: ROSETTE } as CSSProperties;
  return (
    <div className="fx-medal">
      <i className="fx-tail fx-tail-l" /><i className="fx-tail fx-tail-r" />
      <i className="fx-rosette" style={mask} />
      <i className="fx-glare" style={mask} />
      <span className="fx-core"><span className="fx-p"><i className="fx-p-o" /><i className="fx-p-r" /><i className="fx-p-f" /><i className="fx-p-g" /></span></span>
    </div>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: Ribbon, EducationObject: Medal };
