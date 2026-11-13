"use client";
// Ember: the fire element of the elemental family (designs/elemental). A forge at night: the shared layout over a
// living flame field (meta.ts) with heat haze and rising embers, letters that ignite and char, a heat-forged
// portrait print, a molten rod between roles and the Purdue P glowing on the anvil. html.lite = one still fire frame.
import type { ReactNode } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { Skin } from "@/lib/designs/skin";
import ElementalSite, { sigil } from "@/designs/elemental/site";
import { META } from "./meta";
import { XP } from "./experience";
import EmberName from "./name-fx";
import EmberPortrait from "./portrait-fx";
import "./ember.css";

/** Contact frame: the copy at the mouth of the forge, a bed of coals glowing under it. */
function ContactFrame({ children }: { children: ReactNode }) {
  return (
    <div className="em-mouth">
      {children}
      <span className="em-coals" aria-hidden="true"><i /><i /><i /></span>
    </div>
  );
}

const FLAME = <path pathLength={1} d="M24 9c4.6 6 9 10.4 9 17.4A9 9 0 0 1 15 26.6c0-3.7 1.8-6.6 4-8.6.1 3 1.3 5.1 3.3 6.1-.5-5.8.2-10.4 1.7-15.1Z" />;

export const SKIN: Skin = {
  id: "ember",
  ...XP,
  rootClass: "el em",
  labels: { work: "Forge", play: "Hearth" },
  sectionClass: (id) => (id === "contact" ? "ly-wrap el-contact" : "ly-sec ly-wrap el-sec"),
  titleClass: "el-h2",
  SectionOrnament: sigil(FLAME),
  NameFx: EmberName,
  PortraitFx: EmberPortrait,
  ContactFrame,
  contactLead: "Strike while it's hot",
  projectArt: { palette: ["#160C09", "#FF6A1A", "#FFC447", "#9A1C0A"], params: { hole: 0.34, lift: 10 } },
};

/** The whole Ember site: the family frame with the forge's fire behind it. */
export default function Ember({ content }: DesignProps) {
  return <ElementalSite content={content} skin={SKIN} meta={META} />;
}
