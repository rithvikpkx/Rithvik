"use client";
// Nimbus: a bright, airy sky world. A skin on the shared layout (designs/PORTING.md). The shader clouds live only in
// the hero (the sun rides the visitor's hour); pixel clouds elsewhere are static and move only on interaction (card
// hover, band clouds fleeing the pointer, stamp hover) or as slow drifts while their section is on screen.
// html.lite and reduced motion stop the trail, drifts and drop-shadow filters, leaving a designed still.
import { useMemo, useRef } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import { DEFS, skyShader } from "./pixel";
import { useVisitorHour } from "./time";
import { useNimbusMotion } from "./motion";
import { XP } from "./experience";
import NimbusName from "./name-fx";
import NimbusPortrait from "./portrait-fx";
import "./nimbus.css";

const META = designById("nimbus")!;



export const SKIN: Skin = {
  id: "nimbus",
  ...XP,
  rootClass: "nb",
  labels: { play: "Recess" },
  sectionClass: (id) => `nb-sec nb-${{ work: "work", experience: "exp", about: "about", play: "play", questions: "faq", contact: "contact" }[id]}`,
  titleClass: "nb-h2",
  NameFx: NimbusName,
  PortraitFx: NimbusPortrait,
  projectArt: { palette: ["#F3FAFF", "#0E1B2B", "#0A9BFF", "#FFC93C"], params: { hole: 0.36, rest: 6, lift: 22 } },
};

/** The whole Nimbus site: the shared layout under a pixel sky that follows the visitor's clock. */
export default function Nimbus({ content }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  useNimbusMotion(root);
  const hr = useVisitorHour();
  // the sun rides the visitor's hour, so the shader mounts only once that is known (client)
  const spec = useMemo(() => (hr === null ? undefined : skyShader(META.shader!, hr)), [hr]);
  return (
    <SiteLayout content={content} skin={SKIN} rootRef={root} hero={<div className="nb-sky" id="nb-sky" aria-hidden="true" />}>
      <svg className="nb-defs" width="0" height="0" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: DEFS }} />
      <div className="nb-trail" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} />)}</div>
      <ShaderCanvas spec={spec} dark={false} />
    </SiteLayout>
  );
}
