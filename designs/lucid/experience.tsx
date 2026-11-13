"use client";
// Lucid's Experience pieces: a clear glass tube that fills with coloured liquid as you scroll (a trembling drop
// rides the meniscus), and a thick glass Purdue P that bends a little world of light sitting behind it.
import type { Skin } from "@/lib/designs/skin";
import { P_FACE, P_RING, P_SIL, PurdueP } from "@/components/site/layout/purdue";
import "./experience.css";

/** A glass tube; liquid rises down it with the scroll, a drop of it leading the flow. */
function Tube() {
  return <><i className="xp-track lx-tube" /><i className="xp-fill lx-liquid" /><i className="xp-head"><b className="lx-drop" /></i></>;
}

// the P box inside the 200x200 object, and the same box as a transform for the clip (P units -> object units)
const PX = 14.6, PY = 54.4, PW = 170.8, PH = 91.3, K = PW / 65.645;

/** The light behind the glass: four soft colour forms drifting slowly. `lens` copies sit inside the P, magnified and
 *  shifted the other way (a thick slab bends the view), one per colour channel so the edges split. */
function World({ lens }: { lens?: "r" | "g" | "b" }) {
  return (
    <g className={lens ? `lx-w lx-w-${lens}` : "lx-w"}>
      <circle className="lx-o lx-o1" cx="58" cy="74" r="58" fill="url(#lx-f1)" />
      <circle className="lx-o lx-o2" cx="146" cy="88" r="62" fill="url(#lx-f2)" />
      <circle className="lx-o lx-o3" cx="104" cy="148" r="54" fill="url(#lx-f3)" />
      <circle className="lx-o lx-o4" cx="120" cy="40" r="34" fill="url(#lx-f4)" />
    </g>
  );
}

/** The glass P: the official shape as clear glass (a bright rim, smoky ring, near-clear face) with the world behind
 *  it seen magnified and colour-split through it. Pointer tilt shifts the world against the glass and slides the
 *  specular streak; at rest it is one still, readable P. */
function GlassP() {
  const stop = (c: string) => <><stop offset="0" stopColor={c} stopOpacity=".95" /><stop offset=".55" stopColor={c} stopOpacity=".35" /><stop offset="1" stopColor={c} stopOpacity="0" /></>;
  return (
    <svg className="lx-p" viewBox="0 0 200 200" focusable="false">
      <defs>
        <radialGradient id="lx-f1">{stop("#FF6B4A")}</radialGradient>
        <radialGradient id="lx-f2">{stop("#2EC8FF")}</radialGradient>
        <radialGradient id="lx-f3">{stop("#9A5BFF")}</radialGradient>
        <radialGradient id="lx-f4">{stop("#FFC857")}</radialGradient>
        <clipPath id="lx-pclip"><path d={P_SIL} clipRule="evenodd" transform={`translate(${PX} ${PY}) scale(${K})`} /></clipPath>
        {/* one channel per lens copy, screened back together inside the P: the dispersion */}
        <filter id="lx-cr"><feColorMatrix values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" /></filter>
        <filter id="lx-cg"><feColorMatrix values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" /></filter>
        <filter id="lx-cb"><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" /></filter>
        <radialGradient id="lx-shadow"><stop offset="0" stopColor="#02030A" stopOpacity=".7" /><stop offset="1" stopColor="#02030A" stopOpacity="0" /></radialGradient>
      </defs>
      <World />
      <ellipse className="lx-p-shadow" cx="100" cy="166" rx="74" ry="8" fill="url(#lx-shadow)" />
      <g className="lx-p-lens" clipPath="url(#lx-pclip)">
        <rect x="0" y="0" width="200" height="200" fill="#070818" />
        <World lens="r" /><World lens="g" /><World lens="b" />
      </g>
      <PurdueP className="lx-pp" x={PX} y={PY} width={PW} height={PH}
        defs={<><linearGradient id="lx-pface" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".42" /><stop offset=".45" stopColor="#fff" stopOpacity=".06" /><stop offset="1" stopColor="#CFE8FF" stopOpacity=".2" />
        </linearGradient><clipPath id="lx-pf"><path d={P_FACE} /></clipPath>
          {/* the ring band without the face, so the face stays clear glass over the world */}
          <clipPath id="lx-ringcut"><path d={P_RING + P_FACE} clipRule="evenodd" /></clipPath></>}>
        <path className="lx-fr lx-fr-r" d={P_FACE} />
        <path className="lx-fr lx-fr-b" d={P_FACE} />
        <g clipPath="url(#lx-pf)"><rect className="lx-streak" x="-14" y="-6" width="7" height="48" /></g>
      </PurdueP>
    </svg>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: Tube, EducationObject: GlassP };
