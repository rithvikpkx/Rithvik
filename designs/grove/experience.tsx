"use client";
// Grove's Experience pieces: a vine that climbs down from role to role as you scroll, and the Purdue P grown as moss
// topiary, flowers opening in it while the pointer is near.
import type { CSSProperties } from "react";
import type { Skin } from "@/lib/designs/skin";
import { PurdueP } from "@/components/site/layout/purdue";

/** A bark-thin guide line; a leafy vine grows down it with the scroll, a bud unfurling at its tip. */
function Vine() {
  return <><i className="xp-track gx-twig" /><i className="xp-fill gx-vine" /><i className="xp-head"><b className="gx-bud" /></i></>;
}

// where the flowers sit on the P, in P units (on the face and ring), and their size
const FLOWERS: [number, number, number][] = [[20, 7, 1], [44, 6, .8], [57, 12, 1.1], [12, 29, .9], [30, 24, .7], [52, 21, .8]];

/** The topiary: the official P's four layers, each in moss (the ring lighter, the face a deeper pile) over a bark
 *  outline, swaying from its base toward the pointer, with small flowers that open while it is touched. */
function Topiary() {
  return (
    <div className="gx-top">
      <i className="gx-shadow" />
      <PurdueP className="gx-p">
        {FLOWERS.map(([x, y, s], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
            {/* the inner group blooms (CSS scale about its own centre) inside the placed one */}
            <g className="gx-fl" style={{ "--d": `${i * 70}ms` } as CSSProperties}>
              {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} rx=".9" ry="1.6" cy="-1.5" transform={`rotate(${a})`} />)}
              <circle r=".75" />
            </g>
          </g>
        ))}
      </PurdueP>
    </div>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: Vine, EducationObject: Topiary };
