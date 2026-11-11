"use client";
// Clay's Experience pieces: a pencilled guide that is inked over as you scroll (a clay drop at the nib), and a cut-paper
// collage for education: the official Purdue P cut from clay and ivory paper, an offset ink outline drawn over it,
// scraps of sky and olive paper behind, each layer sliding at its own depth under the pointer.
import type { Skin } from "@/lib/designs/skin";
import { P_SIL, PurdueP } from "@/components/site/layout/purdue";
import "./experience.css";

/** A faint pencil guide; ink follows it down with the scroll, a drop of clay ink hanging at the nib. */
function InkThread() {
  return <><i className="xp-track cx-pencil" /><i className="xp-fill cx-ink" /><i className="xp-head"><b className="cx-nib" /></i></>;
}

/** The collage: paper scraps, an ivory card, the P in cut paper with its ink line out of register. */
function Collage() {
  return (
    <div className="cx-obj">
      <i className="cx-scrap cx-sky" />
      <i className="cx-scrap cx-olive" />
      <i className="cx-card" />
      <PurdueP className="cx-p cx-p-shadow" />
      <PurdueP className="cx-p cx-p-paper" />
      <svg className="cx-p cx-p-line" viewBox="0 0 65.645 35.104" overflow="visible" focusable="false">
        <path d={P_SIL} fillRule="evenodd" pathLength={1} />
      </svg>
    </div>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: InkThread, EducationObject: Collage };
