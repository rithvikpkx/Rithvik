"use client";
// Sprawl's Experience pieces: a ribbed data conduit that lights up as a neon tube while you scroll, and the
// Purdue P as a gold neon sign bolted to a wet wall, its light spilling onto the bricks and the puddle below.
import type { Skin } from "@/lib/designs/skin";
import { PurdueP } from "@/components/site/layout/purdue";
import "./experience.css";

/** A dark ribbed conduit; neon gas fills it down to the scroll front, data packets streaming through, a spark leading. */
function Conduit() {
  return <><i className="xp-track sx-conduit" /><i className="xp-fill sx-neon" /><i className="xp-head"><b className="sx-spark" /></i></>;
}

/** The neon P: the official mark's ring band is the glowing tube, its face dim gold glass on a dark backing plate.
 *  Hung on two wires; the pointer tilts it (shared spring) and slides the light it throws; fast moves make it buzz. */
function NeonP() {
  return (
    <div className="sx-sign">
      <i className="sx-wall" />
      <i className="sx-cast" />
      <i className="sx-wire" /><i className="sx-wire sx-wire-r" />
      <PurdueP className="sx-p sx-plate" />
      <PurdueP className="sx-p sx-gas" />
      <PurdueP className="sx-p sx-refl" />
    </div>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: Conduit, EducationObject: NeonP };
