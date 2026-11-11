"use client";
// Sprawl: a neon-noir megacity at three in the morning, seen through a rain-streaked window. A skin on the shared
// layout (designs/PORTING.md). The city shader is hosted in the hero only, so it stops once the hero scrolls away;
// the pointer wipes the fogged glass and a click tears it (motion.ts). Below the hero, a faint rain keeps falling
// past the reading sections, each opened by a neon tube that ignites once. html.lite = one still frame, no rain.
import { useRef, type ReactNode } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { Skin } from "@/lib/designs/skin";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import Clock from "@/components/site/Clock";
import { META } from "./meta";
import { useSprawlMotion } from "./motion";
import { XP } from "./experience";
import SprawlName from "./name-fx";
import SprawlPortrait from "./portrait-fx";
import "./sprawl.css";

/** Section ornament: one neon tube that flickers on the first time it scrolls into view. */
function Tube() {
  return <div className="sp-tube" aria-hidden="true"><i /></div>;
}

/** Contact frame: a neon sign around the copy and the cloud. It ignites on arrival and throws its light into the
 *  wet ground below. */
function ContactFrame({ children }: { children: ReactNode }) {
  return (
    <div className="sp-sign">
      <i className="sp-sign-tube" aria-hidden="true" />
      <div className="sp-sign-in">{children}</div>
    </div>
  );
}

export const SKIN: Skin = {
  id: "sprawl",
  ...XP,
  rootClass: "sp",
  labels: { about: "Dossier", play: "Arcade", questions: "Queries", contact: "Uplink" },
  sectionClass: (id) => `ly-sec ly-wrap sp-sec sp-${id}`,
  titleClass: "sp-h2",
  SectionOrnament: Tube,
  NameFx: SprawlName,
  PortraitFx: SprawlPortrait,
  ContactFrame,
  contactLead: "Open channel. No static.",
  projectArt: { palette: ["#0B0A16", "#05D9E8", "#FF2A6D", "#FFB547"], params: { hole: 0.34 } },
};

/** The whole Sprawl site: the shared layout behind a rain-streaked window, with an AR readout in its corners. */
export default function Sprawl({ content: C }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  useSprawlMotion(root);
  const now = C.places.find((p) => p.key === "now");
  const hero = (
    <>
      <div className="sp-city" id="sp-city" aria-hidden="true" />
      <div className="sp-hud" aria-hidden="true">
        <span className="sp-hud-tl"><b className="sp-rec" />{now ? now.city : C.now.city} · <Clock tz={C.now.tz} className="sp-clk" /></span>
        <span className="sp-hud-tr">Rain 4.1 mm/h · Vis 600 m</span>
        <span className="sp-hud-bl">Wipe the glass</span>
      </div>
    </>
  );
  return (
    <SiteLayout content={C} skin={SKIN} rootRef={root} hero={hero}>
      <div className="sp-rain" aria-hidden="true"><i /><i /></div>
      <ShaderCanvas spec={META.shader} dark />
    </SiteLayout>
  );
}
