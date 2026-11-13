"use client";
// Mercury's Experience pieces: a glass tube that fills with liquid metal, and a chrome blob for education with the Purdue P cast in chrome rising out of it.
import type { Skin } from "@/lib/designs/skin";
import { P_FACE, PurdueP } from "@/components/site/layout/purdue";
import "./experience.css";

/** A dark glass tube; liquid mercury runs down it as you scroll, a trembling bead leading the flow. */
function Pipe() {
  return <><i className="xp-track mx-tube" /><i className="xp-fill mx-metal" /><i className="xp-head"><b className="mx-bead" /></i></>;
}

/** A pool of liquid chrome (metaballs through one goo filter): droplets break off and fall back in, and a
 *  lobe reaches toward the pointer. The highlight slides against the pointer like a reflection.
 *  The Purdue P is polished chrome sitting in the pool, reflecting the same room, a sheen sliding across its face. */
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
        {/* a loose droplet carries its own reflection until it rejoins the pool */}
        <linearGradient id="mx-bead" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" /><stop offset=".4" stopColor="#B8BBC3" /><stop offset=".52" stopColor="#2A2C31" /><stop offset=".8" stopColor="#9EA2AA" /><stop offset="1" stopColor="#EDEEF1" />
        </linearGradient>
        <radialGradient id="mx-shadow"><stop offset="0" stopColor="#000" stopOpacity=".75" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse className="mx-shadow" cx="100" cy="178" rx="70" ry="9" fill="url(#mx-shadow)" />
      <g filter="url(#mx-goo)" fill="url(#mx-env)">
        <g className="mx-body">
          <circle className="mx-core" cx="100" cy="100" r="58" />
          <circle className="mx-reach" cx="100" cy="100" r="22" />
          <circle className="mx-drop" cx="100" cy="100" r="15" fill="url(#mx-bead)" />
          <circle className="mx-drop mx-drop2" cx="100" cy="100" r="9" fill="url(#mx-bead)" />
        </g>
      </g>
      <PurdueP className="mx-p" x="14.6" y="54.4" width="170.8" height="91.3"
        defs={<><clipPath id="mx-pf"><path d={P_FACE} /></clipPath>
          {/* the pool's room, in P units, so the letter and the metal around it reflect alike */}
          <linearGradient id="mx-penv" gradientUnits="userSpaceOnUse" x1="0" y1="3" x2="0" y2="32">
            <stop offset="0" stopColor="#FAFBFC" /><stop offset=".26" stopColor="#C4C7CE" /><stop offset=".46" stopColor="#6E727B" />
            <stop offset=".52" stopColor="#1E1F23" /><stop offset=".62" stopColor="#3A3C42" /><stop offset=".84" stopColor="#A4A8B0" /><stop offset="1" stopColor="#E9EBEF" />
          </linearGradient></>}>
        <g clipPath="url(#mx-pf)"><rect className="mx-sheen" x="-14" y="-4" width="9" height="46" /></g>
      </PurdueP>
      <ellipse className="mx-spec" cx="80" cy="66" rx="17" ry="8" />
    </svg>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: Pipe, EducationObject: Blob };
