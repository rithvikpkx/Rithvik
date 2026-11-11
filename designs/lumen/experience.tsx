"use client";
// Lumen's Experience pieces: a hairline that a beam of light travels down with the scroll, and the official Purdue P
// as a slab of dark glass with the mesh light behind and inside it, its brightest point following the pointer.
import type { Skin } from "@/lib/designs/skin";
import "./experience.css";

/** A hairline; a beam of mesh light runs down it with scroll, a bright bead leading. */
function Beam() {
  return <><i className="xp-track lx-hair" /><i className="xp-fill lx-beam" /><i className="xp-head"><b className="lx-bead" /></i></>;
}

/** The P in glass: a blurred bloom behind, the dark silhouette, a silver ring and a luminous face, all through the
 *  official masks (purdue.css), so the letter's shape never changes. */
function GlassP() {
  return (
    <div className="lx-obj">
      <i className="lx-bloom" />
      <i className="lx-sil" />
      <i className="lx-ring" />
      <i className="lx-face" />
      <i className="lx-spec" />
    </div>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: Beam, EducationObject: GlassP };
