"use client";
/* eslint-disable @next/next/no-img-element -- fixed art with a hand-written srcset; logo comes from content */
// Mercury: a graphite studio with one heavy pool of liquid chrome. A skin on the shared layout (designs/PORTING.md).
// The shader moves only while the hero or Contact is on screen (metaballs, then ferrofluid that reaches for the
// pointer); between them its host is hidden so the runtime pauses. Reading sections are solid graphite, each opened
// by a chrome meniscus that rings once. html.lite / reduced motion: still shader frame, flat dividers, no drift.
import { useRef, type ReactNode, type SyntheticEvent } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionId, Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import { useMercuryMotion } from "./motion";
import { XP } from "./experience";
import MercuryName from "./name-fx";
import MercuryPortrait from "./portrait-fx";
import "./mercury.css";

const META = designById("mercury")!;
const hideFig = (e: SyntheticEvent<HTMLImageElement>) => { (e.currentTarget.parentNode as HTMLElement).hidden = true; };

// a chrome meniscus: convex ends (mercury's meniscus bulges) and a wave that rings once on entry
const WAVE = (() => {
  let d = "";
  for (let x = 70; x <= 1130; x += 5) { const e = Math.exp(-(((x - 600) / 250) ** 2)), y = 20 - 10 * Math.cos((x - 600) / 34) * e; d += (x === 70 ? "M" : "L") + x + " " + y.toFixed(2); }
  return d;
})();

/** Section ornament: a chrome meniscus line (Contact sits over the pool and has none). */
function Divider({ id }: { id: SectionId }) {
  if (id === "contact") return null;
  return (
    <div className="mc-div" aria-hidden="true">
      <svg viewBox="0 0 1200 40" preserveAspectRatio="none" focusable="false">
        <path className="mc-men" d="M0 36 C10 26 32 20 70 20 H260" />
        <path className="mc-men" d="M940 20 H1130 C1168 20 1190 26 1200 36" />
        <path className="mc-wave" d={WAVE} />
      </svg>
    </div>
  );
}


/** Contact frame: the shared copy beside the chrome mark, over the ferrofluid pool. */
function ContactFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mc-contact-in">
      <div className="mc-contact-txt">{children}</div>
      <figure className="mc-mark-art" aria-hidden="true"><img src="/v7/mercury/chrome-mark-800.webp" srcSet="/v7/mercury/chrome-mark-800.webp 800w, /v7/mercury/chrome-mark-1600.webp 1600w" sizes="(max-width: 700px) 44vw, 34vw" width={800} height={800} alt="" loading="lazy" decoding="async" onError={hideFig} /></figure>
    </div>
  );
}

export const SKIN: Skin = {
  id: "mercury",
  ...XP,
  rootClass: "mc",
  sectionClass: (id) => (id === "contact" ? "mc-contact" : id === "play" ? "mc-sec mc-play" : "mc-sec"),
  titleClass: "mc-h2",
  SectionOrnament: Divider,
  NameFx: MercuryName,
  PortraitFx: MercuryPortrait,
  ContactFrame,
  projectArt: { palette: ["#0E0E10", "#C9CCD3", "#FFFFFF", "#7F8BB8"], params: { hole: 0.4, rest: 1, lift: 12, stroke: 0.9 } },
};

/** The whole Mercury site: the shared layout over one fixed chrome pool. */
export default function Mercury({ content }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  useMercuryMotion(root);
  return (
    <SiteLayout content={content} skin={SKIN} rootRef={root}>
      <svg className="mc-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs><linearGradient id="mc-steel" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1200" y2="0"><stop offset="0" stopColor="#4d5058" /><stop offset=".3" stopColor="#b9bcc4" /><stop offset=".5" stopColor="#ffffff" /><stop offset=".7" stopColor="#b9bcc4" /><stop offset="1" stopColor="#4d5058" /></linearGradient></defs></svg>
      <div className="mc-gl" id="mc-gl" aria-hidden="true" />
      <ShaderCanvas spec={META.shader} dark={META.dark} />
    </SiteLayout>
  );
}
