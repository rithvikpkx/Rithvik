"use client";
// Volt: the lightning element of the elemental family (designs/elemental). A storm that answers: the shared layout
// over storm clouds and bolts (meta.ts), the portrait a charged node throwing arcs at the pointer, letters that
// crackle, an electric-edge portrait, a plasma conduit between roles and the Purdue P as a charged plate.
// html.lite = one still frame of the storm, no flicker.
import type { ReactNode } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { Skin } from "@/lib/designs/skin";
import ElementalSite, { sigil } from "@/designs/elemental/site";
import { META } from "./meta";
import { XP } from "./experience";
import VoltName from "./name-fx";
import VoltPortrait from "./portrait-fx";
import "./volt.css";

/** Contact frame: the copy inside a charged frame, arcs crawling along its corners. */
function ContactFrame({ children }: { children: ReactNode }) {
  return (
    <div className="vt-cell">
      <span className="vt-corners" aria-hidden="true"><i /><i /><i /><i /></span>
      {children}
    </div>
  );
}

const BOLT = <path pathLength={1} d="M27 7 15 26h9l-4 15 13-20h-9l3-14Z" />;

export const SKIN: Skin = {
  id: "volt",
  ...XP,
  rootClass: "el vt",
  labels: { experience: "Circuit", play: "Sparks" },
  sectionClass: (id) => (id === "contact" ? "ly-wrap el-contact" : "ly-sec ly-wrap el-sec"),
  titleClass: "el-h2",
  SectionOrnament: sigil(BOLT),
  NameFx: VoltName,
  PortraitFx: VoltPortrait,
  ContactFrame,
  contactLead: "Send a signal",
  projectArt: { palette: ["#0B0D24", "#7DF9FF", "#FFFFFF", "#A98BFF"], params: { hole: 0.36, lift: 14, stroke: 0.8 } },
};

/** The whole Volt site: the family frame in the storm. */
export default function Volt({ content }: DesignProps) {
  return <ElementalSite content={content} skin={SKIN} meta={META} />;
}
