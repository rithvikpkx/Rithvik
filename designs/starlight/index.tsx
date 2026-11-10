"use client";
// Starlight: the whole site seen through a night-vision tube. A skin on the shared layout (designs/PORTING.md).
// The shader draws the night scene (stars, treeline, field), tube vignette and grain; the pointer is an IR light in
// the shader and, in the DOM, reveals small annotations (motion.ts). The hero carries the tube's HUD and the
// phosphor switch (P43 green / P45 white), the look's one themed control. Halation is text-shadow on headings only.
// Performance mode (html.lite) and reduced motion stop the flare, ring, gain jitter and IR loop.
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import { deg } from "./geo";
import { useStarlightMotion, type Flare } from "./motion";
import { XP } from "./experience";
import StarlightName from "./name-fx";
import StarlightPortrait from "./portrait-fx";
import "./starlight.css";

const META = designById("starlight")!;
const PH_KEY = "rithvik-sl-ph";
const PLACE: Record<string, string> = { home: "Home", school: "School", now: "Now" };
const WP_LEFT = [13, 33, 52];

/** Notifies useSyncExternalStore when the phosphor attribute on <html> changes. */
function subPh(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-sl-ph"] });
  return () => mo.disconnect();
}


export const SKIN: Skin = {
  id: "starlight",
  ...XP,
  rootClass: "sl",
  labels: { work: "Sightings", experience: "Log", about: "Notes", contact: "Signal" },
  sectionClass: (id) => `sl-sec sl-${{ work: "work", experience: "exp", about: "about", play: "play", questions: "faq", contact: "contact" }[id]}`,
  titleClass: "sl-h2",
  NameFx: StarlightName,
  PortraitFx: StarlightPortrait,
  projectArt: { palette: ["#030803", "#A8FF7A", "#EAFFDC", "#5FD43A"], params: { hole: 0.34, stroke: 0.9 } },
};

/** The whole Starlight site: the shared layout seen through an image-intensifier tube. */
export default function Starlight({ content: C }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  const flare = useRef<Flare>(() => {});
  useStarlightMotion(root, flare);

  // phosphor: P43 green or P45 white; <html data-sl-ph> is the source of truth (the canvas is recoloured by a
  // CSS colour matrix, the DOM by tokens), restored from localStorage after hydration
  const white = useSyncExternalStore(subPh, () => document.documentElement.dataset.slPh === "white", () => false);
  useEffect(() => {
    const html = document.documentElement;
    try { html.dataset.slPh = localStorage.getItem(PH_KEY) === "white" ? "white" : "green"; } catch { html.dataset.slPh = "green"; }
    return () => { delete html.dataset.slPh; };
  }, []);
  const togglePh = () => {
    const w = !white;
    document.documentElement.dataset.slPh = w ? "white" : "green";
    try { localStorage.setItem(PH_KEY, w ? "white" : "green"); } catch {}
    flare.current(innerWidth - 120, 120, 0.5);
  };

  const hero = (
    <div className="sl-hud">
      <p className="sl-read" aria-hidden="true"><span>GAIN <b data-sl-gain="">0.82</b></span><span className="sl-bat">BAT <i className="sl-cells" data-sl-cells="" data-lv="4"><i /><i /><i /><i /></i><b data-sl-bat="">EXT</b></span><span><b data-sl-ts="">--:--:--</b></span></p>
      <button type="button" className="sl-phos" aria-pressed={white} title="Switch phosphor" onClick={togglePh}><i aria-hidden="true" /><span>{white ? "P45 White" : "P43 Green"}</span></button>
    </div>
  );
  return (
    <SiteLayout content={C} skin={SKIN} rootRef={root} hero={hero}>
      <ShaderCanvas spec={META.shader} dark={META.dark} />
      <div className="sl-flare" aria-hidden="true" />
      <div className="sl-wps" aria-hidden="true">
        {C.places.map((pl, i) => (
          <span className="sl-wp sl-ir" data-ir="" style={{ left: `${WP_LEFT[i] ?? 20 + i * 15}%` }} key={pl.key}>
            <b>{pl.city}</b><span>{deg(pl.lat, "N", "S")} {deg(pl.lng, "E", "W")} · {PLACE[pl.key] ?? pl.key}</span><i />
          </span>
        ))}
      </div>
      <aside className="sl-ruler" aria-hidden="true"><i className="sl-ruler-s" /><span className="sl-ruler-m" data-sl-el="">EL +09°</span></aside>
      <div className="sl-ring" aria-hidden="true"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="92" /><path d="M100 2v12M100 186v12M2 100h12M186 100h12" /><path className="sl-ring-arc" d="M30 54A92 92 0 0 1 54 30" /></svg><span data-sl-ring="">IR · AZ 270° · EL +09°</span></div>
    </SiteLayout>
  );
}
