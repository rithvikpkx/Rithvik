"use client";
// Tide's Experience pieces: a glass channel that the current fills as you scroll, and the Purdue P lying a few feet
// under clear water, caustics sliding over it and the surface rippling where the pointer touches.
import type { Skin } from "@/lib/designs/skin";

/** A glass channel; water runs down it with the scroll, bubbles riding the current, a drop at its front. */
function Channel() {
  return <><i className="xp-track tx-glass" /><i className="xp-fill tx-water" /><i className="xp-head"><b className="tx-drop" /></i></>;
}

/** The P under water: its true layers in sea colours, a caustic net moving over the face, the surface's highlight
 *  sliding against the pointer, and rings spreading where the pointer rests. */
function Submerged() {
  return (
    <div className="tx-sub">
      <i className="tx-floor" />
      <i className="tx-shadow" />
      <div className="tx-p">
        <i className="tx-sil" />
        <i className="tx-ring" />
        <i className="tx-face" />
        <i className="tx-caus" />
      </div>
      <i className="tx-surf" />
      <span className="tx-ripples"><b /><b /><b /></span>
    </div>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: Channel, EducationObject: Submerged };
