"use client";
// Lumen: black, white type and soft vivid light, after OpenAI's visual language (never its logos or marks). A skin on
// the shared layout (designs/PORTING.md). The hero holds a mesh gradient of light (the shader, hosted in the hero only
// so it stops once the hero scrolls away) that parts for the pointer and ripples on a press; everything below is black
// with hairline detail, light returning only where something is current. html.lite = one still frame of light.
import { useRef, type ReactNode } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { Skin } from "@/lib/designs/skin";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import { META } from "./meta";
import { useLumenMotion } from "./motion";
import { XP } from "./experience";
import LumenName from "./name-fx";
import LumenPortrait from "./portrait-fx";
import "./lumen.css";

/** Section ornament: one hairline across the column, a short bead of light at its start. */
function Hairline() {
  return <i className="lm-rule" aria-hidden="true" />;
}

/** Contact frame: the shared copy in a black panel with mesh light rising from its foot. */
function ContactFrame({ children }: { children: ReactNode }) {
  return <div className="lm-panel"><i className="lm-panel-light" aria-hidden="true" />{children}</div>;
}

export const SKIN: Skin = {
  id: "lumen",
  ...XP,
  rootClass: "lm",
  labels: { work: "Research", experience: "Timeline", play: "Playground" },
  sectionClass: () => "ly-sec ly-wrap lm-sec",
  titleClass: "lm-h2",
  SectionOrnament: Hairline,
  NameFx: LumenName,
  PortraitFx: LumenPortrait,
  ContactFrame,
  contactLead: "Ask anything",
  projectArt: { palette: ["#0B0B0C", "#E8E8EA", "#6E8BFF", "#FF7A45"], params: { hole: 0.38, stroke: 0.9 } },
};

/** The whole Lumen site: the shared layout under a field of soft light in the hero. */
export default function Lumen({ content }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  useLumenMotion(root);
  return (
    <SiteLayout content={content} skin={SKIN} rootRef={root} hero={<div className="lm-light" id="lm-light" aria-hidden="true" />}>
      <ShaderCanvas spec={META.shader} dark={META.dark} />
    </SiteLayout>
  );
}
