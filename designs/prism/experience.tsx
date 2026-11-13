"use client";
// Prism's Experience pieces: a light beam that disperses into a spectrum band as it passes, a small glass prism
// riding its front, and a glass Purdue P for education that splits a white beam into a fan that tracks the pointer.
import type { Skin } from "@/lib/designs/skin";
import { P_FACE, PurdueP } from "@/components/site/layout/purdue";
import "./experience.css";

const SPEC = ["#FF2D3D", "#FF7A00", "#F5C400", "#12B76A", "#00B4FF", "#1E6BFF", "#7A3CFF"];
// cut-glass facets laid over the P's face (P units, clipped to the face): light bands and a shadowed one
const FACETS: [string, string][] = [
  ["M6 36 18 -2 25 -2 13 36Z", "rgba(255,255,255,.6)"],
  ["M32 36 44 -2 49 -2 37 36Z", "rgba(255,255,255,.4)"],
  ["M52 36 66 -2 70 -2 56 36Z", "rgba(120,130,170,.22)"],
];

/** A hairline until the light reaches it; then a spectrum band with a glass prism at its front. */
function Beam() {
  return (
    <>
      <i className="xp-track px-hair" />
      <i className="xp-fill px-band" />
      <i className="xp-head"><svg className="px-prism" viewBox="0 0 24 22" focusable="false"><path d="M12 1 23 21H1Z" /></svg></i>
    </>
  );
}

/** The crystal: a white beam enters, the glass Purdue P refracts it, a seven-colour fan leaves and swings. */
function Crystal() {
  return (
    <svg className="px-cry" viewBox="0 0 200 200" focusable="false">
      <defs>
        <linearGradient id="px-in" x1="0" x2="1"><stop offset="0" stopColor="#0B0B0F" stopOpacity="0" /><stop offset="1" stopColor="#0B0B0F" stopOpacity=".7" /></linearGradient>
        <filter id="px-soft"><feGaussianBlur stdDeviation="1.4" /></filter>
      </defs>
      <ellipse cx="100" cy="162" rx="58" ry="5" fill="rgba(22,24,44,.14)" filter="url(#px-soft)" />
      <path className="px-in" d="M-30 94 56 100 56 102 -30 97Z" fill="url(#px-in)" />
      <g className="px-fan" filter="url(#px-soft)">
        {SPEC.map((c, i) => <path key={c} d={`M158 100 L240 ${68 + i * 13} L240 ${80 + i * 13}Z`} fill={c} opacity=".78" />)}
      </g>
      <g className="px-gem">
        <PurdueP className="px-glass" x="25" y="60" width="150" height="80.2"
          defs={<><clipPath id="px-pf"><path d={P_FACE} /></clipPath>
            <linearGradient id="px-gl" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".98" /><stop offset=".55" stopColor="#DCE3F5" stopOpacity=".85" /><stop offset="1" stopColor="#AEB9DC" stopOpacity=".8" /></linearGradient></>}>
          <g clipPath="url(#px-pf)">{FACETS.map(([d, f]) => <path key={d} d={d} fill={f} />)}</g>
          <path className="px-glint" d="M20.5 4.5H31L28.5 6.9H18Z" />
        </PurdueP>
      </g>
    </svg>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: Beam, EducationObject: Crystal };
