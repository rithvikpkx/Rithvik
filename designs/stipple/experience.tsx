"use client";
// Stipple's Experience pieces: an ink line drawn down the page behind a falling drop, and an engraved, stippled
// medallion for education, its vermilion plate printed slightly out of register (and sliding with the pointer).
import type { Content } from "@/lib/content/types";
import type { Skin } from "@/lib/designs/skin";
import "./experience.css";

/** Stippled dots ahead of the pen; a drawn ink line with a misregistered vermilion pass behind it. */
function InkLine() {
  return (
    <>
      <i className="xp-track sx-dots" />
      <i className="xp-fill sx-ink" />
      <i className="xp-head"><svg className="sx-drop" viewBox="0 0 16 22" focusable="false"><path d="M8 0C8 0 1 9 1 14a7 7 0 0 0 14 0C15 9 8 0 8 0Z" /></svg></i>
    </>
  );
}

/** The medallion: a vermilion plate, a stipple-shaded disc, double engraved rings, the school round the rim and
 *  its initial set large in the serif. */
function Medallion({ education: e }: { education: Content["education"] }) {
  return (
    <div className="sx-med">
      <i className="sx-plate" />
      <i className="sx-disc" />
      <svg className="sx-eng" viewBox="0 0 200 200" focusable="false">
        <defs><path id="sx-rim" d="M100 100 m-70 0 a70 70 0 1 1 140 0 a70 70 0 1 1 -140 0" /></defs>
        <circle cx="100" cy="100" r="92" className="sx-r1" />
        <circle cx="100" cy="100" r="86" className="sx-r2" />
        <circle cx="100" cy="100" r="54" className="sx-r2" />
        <text className="sx-rimt"><textPath href="#sx-rim" startOffset="0" textLength="434" lengthAdjust="spacingAndGlyphs">{`${e.school} · ${e.school} · `.toUpperCase()}</textPath></text>
        <text className="sx-init" x="100" y="100" textAnchor="middle" dominantBaseline="central">{e.school.trim().charAt(0)}</text>
      </svg>
    </div>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: InkLine, EducationObject: Medallion };
