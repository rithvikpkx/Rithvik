"use client";
// Prism's Experience pieces: a light beam that disperses into a spectrum band as it passes, a small glass prism
// riding its front, and a cut crystal for education that splits a white beam into a fan that tracks the pointer.
import type { Skin } from "@/lib/designs/skin";
import "./experience.css";

const SPEC = ["#FF2D3D", "#FF7A00", "#F5C400", "#12B76A", "#00B4FF", "#1E6BFF", "#7A3CFF"];
// the crystal's facets (viewBox 0 0 200 200): a brilliant seen from the side, light upper facets, dark lower
const FACETS: [string, string][] = [
  ["M60 70 100 52 140 70 100 82Z", "rgba(255,255,255,.85)"],
  ["M60 70 100 82 92 150Z", "rgba(214,220,236,.75)"],
  ["M140 70 100 82 108 150Z", "rgba(176,184,206,.7)"],
  ["M100 82 92 150 100 162 108 150Z", "rgba(236,240,250,.8)"],
  ["M60 70 42 84 92 150Z", "rgba(150,158,184,.55)"],
  ["M140 70 158 84 108 150Z", "rgba(120,128,156,.6)"],
  ["M42 84 60 70 100 52 70 56Z", "rgba(255,255,255,.6)"],
  ["M158 84 140 70 100 52 130 56Z", "rgba(226,230,244,.7)"],
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

/** The crystal: a white beam enters, the faceted stone refracts it, a seven-colour fan leaves and swings. */
function Crystal() {
  return (
    <svg className="px-cry" viewBox="0 0 200 200" focusable="false">
      <defs>
        <linearGradient id="px-in" x1="0" x2="1"><stop offset="0" stopColor="#0B0B0F" stopOpacity="0" /><stop offset="1" stopColor="#0B0B0F" stopOpacity=".7" /></linearGradient>
        <filter id="px-soft"><feGaussianBlur stdDeviation="1.4" /></filter>
      </defs>
      <ellipse cx="100" cy="176" rx="46" ry="5" fill="rgba(22,24,44,.14)" filter="url(#px-soft)" />
      <path className="px-in" d="M-30 94 84 105 84 107 -30 97Z" fill="url(#px-in)" />
      <g className="px-fan" filter="url(#px-soft)">
        {SPEC.map((c, i) => <path key={c} d={`M112 108 L236 ${70 + i * 13} L236 ${82 + i * 13}Z`} fill={c} opacity=".78" />)}
      </g>
      <g className="px-gem">
        {FACETS.map(([d, f]) => <path key={d} d={d} fill={f} />)}
        <path className="px-edge" d="M42 84 70 56 100 52 130 56 158 84 100 162Z M60 70 100 82 140 70 M100 52 100 82 M42 84 60 70 M158 84 140 70 M60 70 92 150 M140 70 108 150 M100 82 92 150 M100 82 108 150" />
        <path className="px-glint" d="M70 60 92 56 78 66Z" />
      </g>
    </svg>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: Beam, EducationObject: Crystal };
