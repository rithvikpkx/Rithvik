"use client";
// Volt's Experience pieces: an insulated conduit that a plasma current runs down as you scroll, and the Purdue P as a
// charged plate in a dark room, arcs leaping off it toward the pointer.
import type { Skin } from "@/lib/designs/skin";

/** A dark conduit; a crackling cyan current runs down it with the scroll, a spark ball at its front. */
function Conduit() {
  return <><i className="xp-track vx-cond" /><i className="xp-fill vx-amp" /><i className="xp-head"><b className="vx-spark" /></i></>;
}

// three arcs, drawn once; CSS turns the group toward the pointer and flickers each one
const ARCS = ["M0 0l14-5 9 7 15-9 12 6 16-4", "M0 0l12 6 10-6 13 9 14-5 18 3", "M0 0l9-9 15 4 8-10 16 3"];

/** The charged plate: the P in dark steel, its bevel ring a glowing filament, plasma swirling on the face, and arcs
 *  jumping from its centre in the direction of the pointer (atan2 of the sprung --px / --py). */
function Plate() {
  return (
    <div className="vx-plate">
      <i className="vx-halo" />
      <i className="vx-sil" />
      <i className="vx-face" />
      <i className="vx-ring" />
      <svg className="vx-arcs" viewBox="-4 -40 88 80" focusable="false">
        {ARCS.map((d, i) => <path key={i} d={d} pathLength={1} />)}
      </svg>
    </div>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: Conduit, EducationObject: Plate };
