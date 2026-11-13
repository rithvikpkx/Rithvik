"use client";
// Stone's Experience pieces: a drilled core sample of strata whose ore vein lights as you scroll down it, and the
// Purdue P cut into a granite slab, its chiselled walls catching the pointer's lantern.
import type { Skin } from "@/lib/designs/skin";

/** A core sample: banded rock, an amber vein glowing down its centre with the scroll, a crystal at the vein's tip. */
function Core() {
  return <><i className="xp-track sx-core" /><i className="xp-fill sx-vein" /><i className="xp-head"><b className="sx-gem" /></i></>;
}

/** The slab: granite (noise-grain), the P sunk into it. The cut's lit and shadowed walls are two offset copies of
 *  the silhouette that swap sides as the lantern (pointer) moves; a press knocks dust off the top edge. */
function Slab() {
  return (
    <div className="sx-slab">
      <i className="sx-block" />
      <div className="sx-cut">
        <i className="sx-hi" />
        <i className="sx-lo" />
        <i className="sx-floor" />
        <i className="sx-ring" />
        <i className="sx-face" />
      </div>
      <i className="sx-lamp" />
      <span className="sx-dust"><b /><b /><b /><b /><b /><b /></span>
    </div>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: Core, EducationObject: Slab };
