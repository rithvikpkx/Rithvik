"use client";
/* eslint-disable @next/next/no-img-element -- a pre-rendered still of the car with a hand-written srcset */
// Corsa: a night garage, the SP3 in Rosso Corsa on a turntable. A skin on the shared layout (designs/PORTING.md).
// The hero is a three.js scene (scene.ts, lazy, this look only) the visitor can spin; the spin revs the instruments:
// rev lights and a dash under the car, a tachometer bezel around the portrait. Sections open with a sector marker
// and a livery stripe; tiles are carbon. html.lite / reduced motion: no three.js at all, a pre-rendered still.
import { useRef, type CSSProperties, type ReactNode } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionId, Skin } from "@/lib/designs/skin";
import SiteLayout from "@/components/site/layout/SiteLayout";
import { REDLINE, MAX_RPM } from "./telemetry";
import { useCorsaMotion } from "./motion";
import { XP } from "./experience";
import CorsaName from "./name-fx";
import CorsaPortrait from "./portrait-fx";
import "./corsa.css";

const LEDS = 15;
const MODEL = { title: "Daytona SP3", by: "supercarmodels", src: "https://sketchfab.com/3d-models/daytona-sp3-29ba4beba44f461a8234143fd092d24a", lic: "https://creativecommons.org/licenses/by/4.0/" };

/** Section ornament: a sector marker (S1, S2...) on a three-band livery stripe that draws in. */
function Sector({ id, index }: { id: SectionId; index: number }) {
  return (
    <div className="co-sector" aria-hidden="true" data-s={id}>
      <b>S{index + 1}</b><i className="co-livery" />
    </div>
  );
}

/** Contact frame: a carbon pit board with a row of rev lights that run up while the pointer is on it. */
function ContactFrame({ children }: { children: ReactNode }) {
  return (
    <div className="co-board">
      <span className="co-board-revs" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ "--i": i } as CSSProperties} />)}</span>
      {children}
    </div>
  );
}

/** A point on the tach's 240° sweep (0 at lower left, 1 at lower right), around the photo's centre; the open bottom
 *  leaves room for the contact nodes. */
const at = (u: number, r: number) => {
  const a = ((150 + 240 * u) * Math.PI) / 180;
  return [200 + r * Math.cos(a), 150 + r * Math.sin(a)] as const;
};
const arc = (u0: number, u1: number, r: number) => {
  const [x0, y0] = at(u0, r), [x1, y1] = at(u1, r);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${(u1 - u0) * 240 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};
const R = 146; // the bezel just outside the 130-unit photo (the portrait box is 400 x 500, photo centred at 200,150)

/** The portrait's bezel: a tachometer around the photo, ticks to 9,500 with the redline arc, and a needle riding the
 *  rim with the turntable's revs. */
function Tach() {
  const ticks = Array.from({ length: 20 }, (_, i) => i * 500).map((rpm) => {
    const u = rpm / MAX_RPM, major = rpm % 1000 === 0, [x0, y0] = at(u, R + 4), [x1, y1] = at(u, R + (major ? 15 : 10));
    return <line key={rpm} x1={x0} y1={y0} x2={x1} y2={y1} className={major ? "co-tk co-tk-m" : "co-tk"} data-red={rpm >= REDLINE ? "" : undefined} />;
  });
  const nums = Array.from({ length: 10 }, (_, k) => { const [x, y] = at((k * 1000) / MAX_RPM, R + 28); return <text key={k} x={x} y={y} className="co-tn" data-red={k * 1000 >= REDLINE ? "" : undefined}>{k}</text>; });
  return (
    <svg className="co-tach" viewBox="0 0 400 500" aria-hidden="true" focusable="false">
      <circle className="co-bezel" cx="200" cy="150" r={R - 4} />
      <path className="co-arc" d={arc(0, 1, R + 4)} />
      <path className="co-arc co-arc-red" d={arc(REDLINE / MAX_RPM, 1, R + 6)} />
      {ticks}{nums}
      <g className="co-needle"><path d={`M${200 + R + 1} 150l18 -6v12z`} /></g>
    </svg>
  );
}

export const SKIN: Skin = {
  id: "corsa",
  ...XP,
  rootClass: "co",
  labels: { experience: "Stints", play: "Pit", questions: "Briefing", contact: "Radio" },
  sectionClass: (id) => `co-sec co-sec-${id}`,
  titleClass: "co-h2",
  SectionOrnament: Sector,
  NameFx: CorsaName,
  PortraitFx: CorsaPortrait,
  ContactFrame,
  contactLead: "The fastest line is email",
  projectArt: { palette: ["#121215", "#D40000", "#F4F1EA", "#F6C400"], params: { hole: 0.34, lift: 10, stroke: 1 } },
};

/** The whole Corsa site: the shared layout with the garage, the dash and the model credit in the hero. */
export default function Corsa({ content }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  useCorsaMotion(root);
  const hero = (
    <>
      <div className="co-stage" id="co-stage" aria-hidden="true">
        <img className="co-still" src="/v7/corsa/sp3-still-1600.webp" srcSet="/v7/corsa/sp3-still-900.webp 900w, /v7/corsa/sp3-still-1600.webp 1600w" sizes="(max-width: 860px) 100vw, 64vw" width={1600} height={720} alt="" decoding="async" fetchPriority="high" />
        <div className="co-load"><span>Warming tyres</span><i /></div>
      </div>
      <div className="co-hud" aria-hidden="true">
        <span className="co-revs">{Array.from({ length: LEDS }, (_, i) => <i key={i} style={{ "--i": i } as CSSProperties} />)}</span>
        <span className="co-dash">
          <span className="co-gear"><small>Gear</small><b id="co-gear">1</b></span>
          <span><small>Lap <em id="co-lapn">01</em></small><b id="co-lap">0:00.000</b></span>
          <span><small>Δ best</small><b id="co-delta">-:--.---</b></span>
        </span>
        <span className="co-hint">Drag to turn</span>
      </div>
      <p className="co-credit">
        <a href={MODEL.src} target="_blank" rel="noopener">“{MODEL.title}” by {MODEL.by}</a>, <a href={MODEL.lic} target="_blank" rel="noopener">CC BY 4.0</a>, badges removed. Not affiliated with Ferrari.
      </p>
    </>
  );
  return <SiteLayout content={content} skin={SKIN} rootRef={root} hero={hero} portraitBackdrop={<Tach />} />;
}
