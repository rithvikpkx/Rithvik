"use client";
// Flux: abstract clouds of light you can stir. A skin on the shared layout (designs/PORTING.md). One fixed shader
// host renders the particle world (meta.ts) while the hero or Contact is on screen: a halo of points orbiting the
// portrait and a nebula swept into filaments, which the pointer pushes, drags and stirs, a click bursts, a held press
// gathers into a spinning knot and a drag paints with. Over Contact the same cloud rings the contact buttons. The
// reading sections are solid night, each opened by a dotted seam. html.lite / reduced motion: one composed still.
import { useRef, type ReactNode } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionId, Skin } from "@/lib/designs/skin";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import { META } from "./meta";
import { useFluxMotion } from "./motion";
import { XP } from "./experience";
import FluxName from "./name-fx";
import FluxPortrait from "./portrait-fx";
import "./flux.css";

/** Section ornament: a dotted seam with one particle running along it (Contact sits in the cloud and has none). */
function Seam({ id }: { id: SectionId }) {
  if (id === "contact") return null;
  return <div className="fl-seam" aria-hidden="true"><i /></div>;
}

/** Contact frame: the shared copy and the contact cloud inside a faint orbit; the particle cloud gathers round it. */
function ContactFrame({ children }: { children: ReactNode }) {
  return <div className="fl-mail">{children}</div>;
}

export const SKIN: Skin = {
  id: "flux",
  ...XP,
  rootClass: "fl",
  labels: { experience: "Path", play: "Field" },
  sectionClass: (id) => `ly-sec ly-wrap fl-sec${id === "contact" ? " fl-contact" : ""}`,
  titleClass: "fl-h2",
  SectionOrnament: Seam,
  NameFx: FluxName,
  PortraitFx: FluxPortrait,
  ContactFrame,
  contactLead: "Every cloud starts with one particle",
  projectArt: { palette: ["#080A16", "#8EE6FF", "#FFFFFF", "#A98BFF"], params: { hole: 0.34, density: 1.25, stroke: 0.8 } },
};

/** The whole Flux site: the shared layout over one fixed particle world. */
export default function Flux({ content }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  useFluxMotion(root);
  const hero = <p className="fl-hint" aria-hidden="true"><span className="fl-hint-fine">drag to stir · hold to gather</span><span className="fl-hint-touch">tap to scatter</span></p>;
  return (
    <SiteLayout content={content} skin={SKIN} rootRef={root} hero={hero}>
      <div className="fl-gl" id="fl-gl" aria-hidden="true" />
      <ShaderCanvas spec={META.shader} dark={META.dark} />
    </SiteLayout>
  );
}
