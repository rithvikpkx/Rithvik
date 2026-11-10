"use client";
// Nimbus's Experience pieces: a pixel paper plane trailing a contrail between stations, and a pixel cloud (with
// the sun behind it) for education.
import type { Skin } from "@/lib/designs/skin";
import "./experience.css";

const W = 30, H = 16;
const PUFFS: [number, number, number][] = [[8, 10, 5], [14.5, 7.5, 6.5], [21.5, 9.5, 5], [11, 12, 4], [18, 12, 4.5], [25, 12, 3]];
const inCloud = (x: number, y: number) => y <= 14 && PUFFS.some(([cx, cy, r]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r);

/** The cloud as pixel rects, shaded like the hero sky: white body, pale underside, a mid outline below. */
const CLOUD = (() => {
  const px: [number, number, string][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inCloud(x, y)) continue;
    const edge = !inCloud(x, y - 1) || !inCloud(x - 1, y) || !inCloud(x + 1, y) || !inCloud(x, y + 1);
    const low = y >= 12 || (!inCloud(x, y + 1) && y >= 9);
    px.push([x, y, low ? (edge ? "var(--nb-mid)" : "var(--nb-pale)") : edge && !inCloud(x, y - 1) ? "#fff" : (x + y) % 7 === 0 && y > 9 ? "var(--nb-mist)" : "#fff"]);
  }
  return px;
})();
const SUN = (() => {
  const px: [number, number][] = [];
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if ((x - 5.5) ** 2 + (y - 5.5) ** 2 <= 30) px.push([x, y]);
  return px;
})();

/** A contrail: stepped sky pixels behind a little paper plane that rides the scroll front. */
function Contrail() {
  return (
    <>
      <i className="xp-track nx-dots" />
      <i className="xp-fill nx-trail" />
      <i className="xp-head">
        <svg className="nx-plane" viewBox="0 0 9 9" shapeRendering="crispEdges" focusable="false">
          <path fill="var(--nb-skyink)" d="M4 8h1V0H4zM3 6h1V1H3zM5 6h1V1H5zM2 4h1V2H2zM6 4h1V2H6z" />
          <path fill="var(--nb-sun)" d="M4 8h1v1H4zM2 4h1v1H2zM6 4h1v1H6z" />
        </svg>
      </i>
    </>
  );
}

/** The cloud: pixel rects that drift toward the pointer, the sun parallaxing behind, a cloudlet passing. */
function Cloud() {
  return (
    <div className="nx-sky">
      <svg className="nx-sun" viewBox="0 0 12 12" shapeRendering="crispEdges" focusable="false">
        {SUN.map(([x, y]) => <rect key={`${x}.${y}`} x={x} y={y} width="1" height="1" fill={(x + y) % 5 === 0 ? "#FFE48A" : "var(--nb-sun)"} />)}
      </svg>
      <svg className="nx-cloud" viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges" focusable="false">
        {CLOUD.map(([x, y, f]) => <rect key={`${x}.${y}`} x={x} y={y} width="1.02" height="1.02" fill={f} />)}
      </svg>
      <svg className="nx-cloudlet" viewBox="0 0 8 3" shapeRendering="crispEdges" focusable="false">
        <path fill="#fff" d="M2 0h3v1h2v1h1v1H0V2h1V1h1z" /><path fill="var(--nb-pale)" d="M0 2h8v1H0z" />
      </svg>
    </div>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: Contrail, EducationObject: Cloud };
