"use client";
// Starlight's Experience pieces: a phosphor fibre strung between stars, and a moon for education whose terminator
// swings with the pointer, as if you were the sun.
import type { Skin } from "@/lib/designs/skin";
import "./experience.css";

const STARS: [number, number, number][] = [[8, 14, 1.6], [88, 9, 1.1], [94, 58, 1.8], [4, 70, 1.2], [76, 92, 1.4], [20, 94, 1], [60, 4, 1]];

/** Faint star dust where the signal has not been; a bright phosphor fibre behind a flaring star where it has. */
function Fibre() {
  return <><i className="xp-track sx-dust" /><i className="xp-fill sx-fibre" /><i className="xp-head"><b className="sx-star" /></i></>;
}

/** The moon through the night-vision tube: craters, scanlines, a terminator that follows the pointer. */
function Moon() {
  return (
    <div className="sx-sky">
      {STARS.map(([x, y, r], i) => <i key={i} className="sx-pt" style={{ left: `${x}%`, top: `${y}%`, width: r * 3, height: r * 3, animationDelay: `${-i * 0.7}s` }} />)}
      <i className="sx-halo" />
      <i className="sx-moon"><i className="sx-shade" /></i>
    </div>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: Fibre, EducationObject: Moon };
