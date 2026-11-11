"use client";
// Stone: the earth element of the elemental family (designs/elemental). A strata cliff lit by the visitor's lantern:
// the shared layout over the rock face (meta.ts), chiselled letters that crumble when touched, a relief portrait, a
// core sample with an ore vein between roles and the Purdue P cut into a granite slab. html.lite = one still frame.
import type { ReactNode } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { Skin } from "@/lib/designs/skin";
import ElementalSite, { sigil } from "@/designs/elemental/site";
import { META } from "./meta";
import { XP } from "./experience";
import StoneName from "./name-fx";
import StonePortrait from "./portrait-fx";
import "./stone.css";

/** Contact frame: the copy cut into a stone tablet, chisel marks along its edge. */
function ContactFrame({ children }: { children: ReactNode }) {
  return <div className="sn-tablet">{children}</div>;
}

const PEAK = <><path pathLength={1} d="M7 36 19 15l6 9 4-6 12 18Z" /><path pathLength={1} d="M15.5 21.5 19 24l2.6-2.4" /></>;

export const SKIN: Skin = {
  id: "stone",
  ...XP,
  rootClass: "el sn",
  labels: { experience: "Strata", about: "Bedrock" },
  sectionClass: (id) => (id === "contact" ? "ly-wrap el-contact" : "ly-sec ly-wrap el-sec"),
  titleClass: "el-h2",
  SectionOrnament: sigil(PEAK),
  NameFx: StoneName,
  PortraitFx: StonePortrait,
  ContactFrame,
  contactLead: "Leave your mark",
  projectArt: { palette: ["#1B1510", "#D9A55B", "#F1D8A6", "#7C8A5E"], params: { hole: 0.3, rest: 0, lift: 6, stroke: 1.2 } },
};

/** The whole Stone site: the family frame in front of the lantern-lit rock. */
export default function Stone({ content }: DesignProps) {
  return <ElementalSite content={content} skin={SKIN} meta={META} />;
}
