"use client";
// Grove: the nature element of the elemental family (designs/elemental). Under a canopy in the wind: the shared layout
// over swaying leaves and sun shafts (meta.ts), the name grown from living moss (fur-like strands and small flowers
// that open under the pointer), a botanical-print portrait, a vine climbing between roles and the Purdue P as moss
// topiary. html.lite = one still frame of the canopy; the moss stays, the wind stops.
import type { ReactNode } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { Skin } from "@/lib/designs/skin";
import ElementalSite, { sigil } from "@/designs/elemental/site";
import { META } from "./meta";
import { XP } from "./experience";
import { MossDefs } from "./moss";
import GroveName from "./name-fx";
import GrovePortrait from "./portrait-fx";
import "./grove.css";

const SPRIG = "M4 96C18 70 26 48 52 30S88 8 96 4";
const LEAVES = [[20, 66, -40], [34, 44, 20], [52, 30, -30], [70, 18, 30], [86, 9, -20]];

/** A sprig of vine: a stem and alternating leaves, swaying from its base. */
function Sprig({ className }: { className: string }) {
  return (
    <svg className={`gv-sprig ${className}`} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path className="gv-stem" d={SPRIG} />
      {LEAVES.map(([x, y, a], i) => <path key={i} className="gv-leaf" d="M0 0c4-6 12-7 18-2-6 5-14 6-18 2Z" transform={`translate(${x} ${y}) rotate(${a})`} />)}
    </svg>
  );
}

/** Contact frame: the copy in a clearing, vines reaching in from two corners. */
function ContactFrame({ children }: { children: ReactNode }) {
  return <div className="gv-clearing"><Sprig className="gv-sprig-a" /><Sprig className="gv-sprig-b" />{children}</div>;
}

const LEAF = <><path pathLength={1} d="M10 38C10 22 22 10 39 9c1 17-11 29-29 29Z" /><path pathLength={1} d="M10 38 30 18" /></>;

export const SKIN: Skin = {
  id: "grove",
  ...XP,
  rootClass: "el gv",
  labels: { work: "Harvest", experience: "Roots", play: "Meadow" },
  sectionClass: (id) => (id === "contact" ? "ly-wrap el-contact" : "ly-sec ly-wrap el-sec"),
  titleClass: "el-h2",
  SectionOrnament: sigil(LEAF),
  NameFx: GroveName,
  PortraitFx: GrovePortrait,
  ContactFrame,
  contactLead: "Plant a seed",
  projectArt: { palette: ["#11201A", "#8FD16A", "#F4F0B8", "#F2B6C6"], params: { hole: 0.32, rest: 1, lift: 9 } },
};

/** The whole Grove site: the family frame under the canopy, plus the moss filters the name and the P grow from. */
export default function Grove({ content }: DesignProps) {
  return <ElementalSite content={content} skin={SKIN} meta={META}><MossDefs /></ElementalSite>;
}
