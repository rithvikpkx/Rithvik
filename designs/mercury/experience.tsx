"use client";
// Mercury's Experience pieces: a glass tube that fills with liquid metal, and a chrome blob for education.
import type { Skin } from "@/lib/designs/skin";
import "./experience.css";

/** A dark glass tube; liquid mercury runs down it as you scroll, a trembling bead leading the flow. */
function Pipe() {
  return <><i className="xp-track mx-tube" /><i className="xp-fill mx-metal" /><i className="xp-head"><b className="mx-bead" /></i></>;
}

/** A pool of liquid chrome (metaballs through one goo filter): droplets break off and fall back in, and a
 *  lobe reaches toward the pointer. The highlight slides against the pointer like a reflection. */
function Blob() {
  return (
    <svg className="mx-blob" viewBox="0 0 200 200" focusable="false">
      <defs>
        <filter id="mx-goo" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
          <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10" />
        </filter>
        {/* one environment for every lobe, so merged metal reflects one room */}
        <linearGradient id="mx-env" gradientUnits="userSpaceOnUse" x1="0" y1="30" x2="0" y2="170">
          <stop offset="0" stopColor="#F6F7F9" /><stop offset=".26" stopColor="#C4C7CE" /><stop offset=".46" stopColor="#6E727B" />
          <stop offset=".52" stopColor="#1E1F23" /><stop offset=".62" stopColor="#34363C" /><stop offset=".84" stopColor="#9EA2AA" /><stop offset="1" stopColor="#E3E5E9" />
        </linearGradient>
        <radialGradient id="mx-shadow"><stop offset="0" stopColor="#000" stopOpacity=".75" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse className="mx-shadow" cx="100" cy="178" rx="70" ry="9" fill="url(#mx-shadow)" />
      <g filter="url(#mx-goo)" fill="url(#mx-env)">
        <g className="mx-body">
          <circle className="mx-core" cx="100" cy="100" r="58" />
          <circle className="mx-reach" cx="100" cy="100" r="22" />
          <circle className="mx-drop" cx="100" cy="100" r="15" />
          <circle className="mx-drop mx-drop2" cx="100" cy="100" r="9" />
        </g>
      </g>
      <ellipse className="mx-spec" cx="80" cy="66" rx="17" ry="8" />
    </svg>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: Pipe, EducationObject: Blob };
