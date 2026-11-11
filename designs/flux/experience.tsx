"use client";
// Flux's Experience pieces: a stream of particles flowing from one station to the next, and the Purdue P condensed
// out of points of light (one point per cell of the sampled official mark), which swarms apart when you move at it.
import type { Skin } from "@/lib/designs/skin";
import { PIXEL } from "@/components/site/layout/purdue-grid";
import { PurdueP } from "@/components/site/layout/purdue";
import "./experience.css";

/** A faint dotted path; scrolling pours a bright stream of particles down it, a spinning knot leading. */
function Stream() {
  return <><i className="xp-track fx-path" /><i className="xp-fill fx-stream" /><i className="xp-head"><b className="fx-knot" /></i></>;
}

const LAYERS = { o: "fx-o", r: "fx-r", f: "fx-f" } as const;
const DEPTHS = 4;
// every filled cell of the sampled P, bucketed by layer (outline / ring / face) and a stable pseudo-random depth
const CELLS = PIXEL.flatMap((row, y) => [...row].flatMap((ch, x) => (ch in LAYERS ? [{ x, y, ch: ch as keyof typeof LAYERS, d: (x * 7 + y * 13 + ((x * y) % 5)) % DEPTHS }] : [])));
const GROUPS = (Object.keys(LAYERS) as (keyof typeof LAYERS)[]).flatMap((ch) => Array.from({ length: DEPTHS }, (_, d) => ({ ch, d, cells: CELLS.filter((c) => c.ch === ch && c.d === d) })));
const COLS = PIXEL[0].length, ROWS = PIXEL.length;

/** The P as a cloud: dots on the official mark's sampled grid (shape untouched), its true outline glowing faintly
 *  behind them. Each depth layer parallaxes with the pointer spring and scatters with its speed, then re-forms. */
function ParticleP() {
  return (
    <svg className="fx-p" viewBox={`-6 ${ROWS / 2 - (COLS + 12) / 2} ${COLS + 12} ${COLS + 12}`} focusable="false">
      <defs><filter id="fx-p-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6" /></filter></defs>
      <PurdueP className="fx-p-ghost" x="0" y="0" width={COLS} height={ROWS} filter="url(#fx-p-glow)" />
      {GROUPS.map(({ ch, d, cells }) => (
        <g key={`${ch}${d}`} className={`fx-dots ${LAYERS[ch]} fx-d${d}`}>
          {cells.map((c) => <circle key={`${c.x}.${c.y}`} cx={c.x + 0.5} cy={c.y + 0.5} r={ch === "f" ? 0.42 : 0.36} />)}
        </g>
      ))}
    </svg>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: Stream, EducationObject: ParticleP };
