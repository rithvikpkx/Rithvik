"use client";
// Foil: a holographic trading card under a desk lamp. A skin on the shared layout (designs/PORTING.md). The
// thin-film shader lives only on the holo card behind the hero portrait (its portrait backdrop), which tilts toward
// the pointer; everything else is calm CSS that wakes on hover. html.lite and reduced motion leave a still card,
// static foil gradients, no tilt, no glare and no datamosh.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import { useSite } from "@/components/site/SiteProvider";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import { ouroPath } from "@/components/site/mark/ouro";
import { FOIL, useFoilMotion } from "./motion";
import { XP } from "./experience";
import FoilName from "./name-fx";
import FoilPortrait from "./portrait-fx";
import "./foil.css";

const META = designById("foil")!;

// the exact mark silhouette (eye punched out) as a CSS mask over the foil texture
const G = ouroPath();
const MASK_URL = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"><mask id="e"><rect x="-50" y="-50" width="100" height="100" fill="#fff"/><circle cx="${G.eye[0]}" cy="${G.eye[1]}" r="${G.eye[2]}" fill="#000"/></mask><path d="${G.d}" fill="#000" mask="url(#e)"/></svg>`)}")`;

/** Foil-stamped mark: the mark silhouette masking the foil layer, whose sheen slides with the pointer. */
function Fm({ cls = "" }: { cls?: string }) {
  return <span className={`fo-fm${cls ? " " + cls : ""}`} role="img" aria-label="Rithvik Praveen Kumar"><i /></span>;
}


/** Contact frame: the foil seal above the shared copy, centred. */
function ContactFrame({ children }: { children: ReactNode }) {
  return (
    <div className="fo-contact">
      <span className="fo-seal" aria-hidden="true"><Fm cls="fo-fm-l" /></span>
      {children}
    </div>
  );
}

export const SKIN: Skin = {
  id: "foil",
  ...XP,
  rootClass: "fo",
  labels: { work: "The set", experience: "Path", play: "Stickers" },
  sectionClass: (id) => `fo-sec fo-${{ work: "work", experience: "exp", about: "about", play: "play", questions: "faq", contact: "contact" }[id]}`,
  titleClass: "fo-h2",
  NameFx: FoilName,
  PortraitFx: FoilPortrait,
  ContactFrame,
  projectArt: { palette: ["#121220", "#EEEAF6", "#B9A8FF", "#8BF0D3"], params: { hole: 0.36, rest: 4 } },
};

/** The whole Foil site: the shared layout as a set of holo cards, the portrait mounted on the lead card. */
export default function Foil({ content: C }: DesignProps) {
  const { openCase } = useSite();
  const root = useRef<HTMLDivElement>(null);
  const [hasFoil, setHasFoil] = useState(false);
  useFoilMotion(root, openCase);

  // the foil texture loads after first paint; until then the foil areas use a gradient
  useEffect(() => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => setHasFoil(true);
    const idle = window.requestIdleCallback || ((f: () => void) => setTimeout(f, 300) as unknown as number);
    const cancel = window.cancelIdleCallback || clearTimeout;
    const id = idle(() => { img.src = "/v7/foil/foil-1024.webp"; });
    return () => { img.onload = null; cancel(id as number); };
  }, []);
  // the shared root takes no per-design props: the mark mask and the texture flag are set on it here
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    el.style.setProperty("--fo-mk", MASK_URL);
    el.classList.toggle("has-foil", hasFoil);
  }, [hasFoil]);

  // the shader spec is fixed (no per-visitor baking), so it can mount straight away
  const spec = useMemo(() => META.shader, []);
  const card = (
    <div className="fo-hero-card" aria-hidden="true">
      <div className="fo-tilt" id="fo-tilt">
        <article className="fo-card">
          <div className="fo-card-gl" id="fo-gl" />
          <div className="fo-card-top"><span className="fo-card-mk"><Fm /></span><b>{C.initials}</b><span>Holo · 1 of 1</span></div>
          <i className="fo-card-glare" />
        </article>
      </div>
    </div>
  );
  return (
    <SiteLayout content={C} skin={SKIN} rootRef={root} portraitBackdrop={card}>
      <ShaderCanvas spec={spec} dark={META.dark} />
      <svg className="fo-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
        <linearGradient id="fo-foil" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(0 .5 .5)">
          {FOIL.concat(FOIL[0]).map((c, i, a) => <stop key={i} offset={(i / (a.length - 1)).toFixed(2)} stopColor={c} />)}
        </linearGradient>
      </defs></svg>
      <div className="fo-mosh" aria-hidden="true" hidden />
    </SiteLayout>
  );
}
