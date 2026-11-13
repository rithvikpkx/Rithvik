"use client";
// Corsa's Experience pieces: a strip of track between stations (asphalt, red-and-white kerbs) whose racing line is
// laid down as you scroll, led by the car seen from above; and the education object, a door panel in Rosso Corsa
// carrying the Purdue P as its race-number roundel, its clearcoat reflection sliding with the pointer.
import type { Skin } from "@/lib/designs/skin";
import { P_ASPECT, PurdueP } from "@/components/site/layout/purdue";
import "./experience.css";

/** Track between two stations: kerbs either side, a telemetry-trace racing line that fills with scroll, the car on it. */
function Track() {
  return (
    <>
      <i className="xp-track cx-road" />
      <i className="xp-fill cx-line" />
      <i className="xp-head">
        <svg className="cx-car" viewBox="0 0 20 40" focusable="false" aria-hidden="true">
          {/* the SP3 from above: long tail, cab forward, the targa roof and two side intakes */}
          <path className="cx-body" d="M10 1C5 1 3 4 3 9v6c-1 3-1.5 6-1.5 10 0 7 2 13 8.5 14 6.5-1 8.5-7 8.5-14 0-4-.5-7-1.5-10V9c0-5-2-8-7-8Z" />
          <path className="cx-glass" d="M5.5 12c1-2 7.5-2 9 0l-.8 7H6.3Z" />
          <path className="cx-roof" d="M6.3 19h7.4l-.4 5H6.7Z" />
          <path className="cx-int" d="M2.6 24c1.4.5 2 2.5 2 5M17.4 24c-1.4.5-2 2.5-2 5" />
        </svg>
      </i>
    </>
  );
}

const PW = 104; // the P's width in the roundel (viewBox units)

/** The door panel: Rosso Corsa with a clearcoat reflection that follows the pointer, a two-stripe livery, and the
 *  white race roundel holding the official Purdue P (shape and colours untouched). */
function DoorPanel() {
  return (
    <svg className="cx-door" viewBox="0 0 200 200" focusable="false" aria-hidden="true">
      <defs>
        <linearGradient id="cx-paint" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E10A08" /><stop offset=".45" stopColor="#B80000" /><stop offset=".55" stopColor="#8E0000" /><stop offset="1" stopColor="#5A0000" />
        </linearGradient>
        <linearGradient id="cx-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".55" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        {/* the panel: the SP3 door's sweep, a deep scoop cut into its trailing edge */}
        <clipPath id="cx-shape"><path d="M18 30Q20 14 38 14H170Q186 14 186 30V128Q186 150 168 158C140 170 112 168 96 182H34Q18 182 18 166Z" /></clipPath>
      </defs>
      <ellipse className="cx-shadow" cx="102" cy="192" rx="80" ry="6" />
      <g clipPath="url(#cx-shape)">
        <rect className="cx-paint" width="200" height="200" fill="url(#cx-paint)" />
        <path className="cx-stripe" d="M-10 152L210 40v14L-10 166Z" />
        <path className="cx-stripe cx-stripe2" d="M-10 172L210 60v6L-10 178Z" />
        <rect className="cx-sheen" x="-60" y="-20" width="70" height="240" fill="url(#cx-sheen)" />
        <path className="cx-shut" d="M18 30Q20 14 38 14H170Q186 14 186 30V128Q186 150 168 158C140 170 112 168 96 182H34Q18 182 18 166Z" />
      </g>
      <g className="cx-roundel">
        <circle cx="100" cy="92" r="58" className="cx-disc" />
        <circle cx="100" cy="92" r="52" className="cx-ring" />
        <PurdueP x={100 - PW / 2} y={92 - PW / P_ASPECT / 2} width={PW} height={PW / P_ASPECT} className="cx-p" />
      </g>
    </svg>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: Track, EducationObject: DoorPanel };
