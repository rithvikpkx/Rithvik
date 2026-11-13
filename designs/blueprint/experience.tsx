"use client";
// Blueprint's Experience pieces: a dimension chain between the stations (a ruled line with arrowheads that the plotter
// pen inks as you scroll) and the Purdue P as an exploded isometric assembly drawing that assembles under the pointer.
import type { CSSProperties } from "react";
import type { Skin } from "@/lib/designs/skin";
import { P_FACE, P_RING, P_SIL, P_VB } from "@/components/site/layout/purdue";
import "./experience.css";

/** A dimension chain: a faint ruled line with ticks and arrowheads at both nodes, inked by the pen riding the fill. */
function DimChain() {
  return <><i className="xp-track bx-dim"><b /><b /></i><i className="xp-fill bx-ink" /><i className="xp-head"><b className="bx-pen" /></i></>;
}

// the three parts of the official mark, bottom to top, with the name each balloon calls out
const PARTS = [["body", P_SIL, "evenodd"], ["band", P_RING, "nonzero"], ["face", P_FACE, "nonzero"]] as const;
// projector lines run through the same three points of the mark on every plate (P units -> % of the box)
const PROJ = [[0, 100], [22.8, 0], [98.6, 36]];

/** The Purdue P drawn as an exploded isometric assembly: its body, band and face (the official paths, never redrawn)
 *  float above a dimensioned base plate on dashed projector lines, each called out by a numbered balloon. Hover or
 *  press and the parts slide home into the finished mark, turned square to the viewer. */
function Assembly() {
  return (
    <div className="bx-iso">
      <div className="bx-stage">
        <div className="bx-plate">
          <i className="bx-sh" />
          <span className="bx-dw">65.645</span><span className="bx-dh">35.104</span>
        </div>
        {PROJ.map(([x, y], i) => <i key={i} className="bx-z" style={{ "--zx": `${x}%`, "--zy": `${y}%` } as CSSProperties} />)}
        {PARTS.map(([name, d, rule], i) => (
          <div key={name} className={`bx-l bx-${name}`} style={{ "--n": i + 1 } as CSSProperties}>
            <svg viewBox={P_VB} focusable="false" overflow="visible"><path d={d} fillRule={rule} vectorEffect="non-scaling-stroke" /></svg>
            <span className="bx-bal"><b>{i + 1}</b>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: DimChain, EducationObject: Assembly };
