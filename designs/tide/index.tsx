"use client";
// Tide: the water element of the elemental family (designs/elemental). Clear moving water seen from above: the shared
// layout over a caustic floor (meta.ts) the pointer stirs, letters that ripple, an underwater portrait, a glass
// channel of current between roles and the Purdue P lying under the surface. html.lite = one still frame of light.
import type { ReactNode } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { Skin } from "@/lib/designs/skin";
import ElementalSite, { sigil } from "@/designs/elemental/site";
import { META } from "./meta";
import { XP } from "./experience";
import TideName from "./name-fx";
import TidePortrait from "./portrait-fx";
import "./tide.css";

/** Contact frame: the copy on a still pool, rings spreading out under the buttons. */
function ContactFrame({ children }: { children: ReactNode }) {
  return (
    <div className="td-pool">
      <span className="td-rings" aria-hidden="true"><i /><i /><i /></span>
      {children}
    </div>
  );
}

const WAVE = <><path pathLength={1} d="M9 30c2.6-8.6 8.8-13.4 16.4-13.4 6 0 9.8 3.8 9.8 8 0 3-2.2 5.2-5 5.2-2.2 0-3.8-1.4-3.8-3.4" /><path pathLength={1} d="M8 36.5c4-3 8-3 12 0s8 3 12 0 6-2 8-1" /></>;

export const SKIN: Skin = {
  id: "tide",
  ...XP,
  rootClass: "el td",
  labels: { work: "Currents", play: "Shallows" },
  sectionClass: (id) => (id === "contact" ? "ly-wrap el-contact" : "ly-sec ly-wrap el-sec"),
  titleClass: "el-h2",
  SectionOrnament: sigil(WAVE),
  NameFx: TideName,
  PortraitFx: TidePortrait,
  ContactFrame,
  contactLead: "Drop a line",
  projectArt: { palette: ["#06202E", "#46E3F0", "#E9FDFF", "#1A6FB0"], params: { hole: 0.38, rest: 1, lift: 8 } },
};

/** The whole Tide site: the family frame over the moving water. */
export default function Tide({ content }: DesignProps) {
  return <ElementalSite content={content} skin={SKIN} meta={META} />;
}
