"use client";
// Clay: warm paper, clay and ink, after Claude's visual language (never its logos or marks). A skin on the shared
// layout (designs/PORTING.md). The hero is a sheet of cream paper with watercolour blooms (the shader, hosted in the
// hero only so it stops once the hero scrolls away); every section opens with a hand-drawn ink rule that draws
// itself in; objects are cut paper with an offset ink shadow. html.lite = one still sheet, every rule fully drawn.
import { useRef, type ReactNode } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionId, Skin } from "@/lib/designs/skin";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import { META } from "./meta";
import { useClayMotion } from "./motion";
import { scribble } from "./scribble";
import { XP } from "./experience";
import ClayName from "./name-fx";
import ClayPortrait from "./portrait-fx";
import "./clay.css";

/** Section ornament: a hand-drawn ink rule (its own wobble per section) with a clay blot where the pen came down. */
function InkRule({ index }: { id: SectionId; index: number }) {
  return (
    <svg className="cy-rule" viewBox="0 0 240 24" aria-hidden="true" focusable="false">
      <path d={scribble(index + 2)} pathLength={1} />
      <circle className="cy-blot" cx="6" cy="13" r="3.4" />
    </svg>
  );
}

/** Contact frame: the shared copy on a sheet of ruled letter paper, laid slightly askew on the page. */
function ContactFrame({ children }: { children: ReactNode }) {
  return <div className="cy-letter">{children}</div>;
}

export const SKIN: Skin = {
  id: "clay",
  ...XP,
  rootClass: "cy",
  labels: { work: "Artifacts", experience: "Chapters", play: "Sketches", contact: "Letters" },
  sectionClass: () => "ly-sec ly-wrap cy-sec",
  titleClass: "cy-h2",
  SectionOrnament: InkRule,
  NameFx: ClayName,
  PortraitFx: ClayPortrait,
  ContactFrame,
  contactLead: "Start a conversation",
  projectArt: { palette: ["#F0EEE6", "#3D3929", "#D97757", "#788C5D"], params: { hole: 0.34, stroke: 1.1 } },
};

/** The whole Clay site: the shared layout over a sheet of paper with watercolour blooms in the hero. */
export default function Clay({ content }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  useClayMotion(root);
  return (
    <SiteLayout content={content} skin={SKIN} rootRef={root} hero={<div className="cy-paper" id="cy-paper" aria-hidden="true" />}>
      <ShaderCanvas spec={META.shader} dark={META.dark} />
    </SiteLayout>
  );
}
