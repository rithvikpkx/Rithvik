"use client";
// Thermal: an infrared camera reading the warmth of his work. A skin on the shared layout (designs/PORTING.md).
// The false-colour heat field (shader) is hosted inside the hero only, so it stops rendering once the hero scrolls
// away; the palette switch (iron / rainbow / white hot) re-maps the shader, scale bar, hot-spot frames and accents
// together through the shader's own `u_pv` uniform; the spot meter follows a fine pointer; hot-spot frames and the
// contact strip are tiny BMP heat images that warm on hover. html.lite = one still heat frame, no haze.
import { useMemo, useRef, useState, type ReactNode } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionProps, Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import Clock from "@/components/site/Clock";
import { Icon } from "@/components/site/Glyph";
import { PALS, T_MAX, T_MIN, W, HH, bmp, heatGrid, palIndex, rankByTools, stripGrid, type PalId } from "./heat";
import { readPal, usePal, useThermalMotion } from "./motion";
import { XP } from "./experience";
import ThermalName from "./name-fx";
import ThermalPortrait from "./portrait-fx";
import "./thermal.css";

const META = designById("thermal")!;
const grids = new Map<string, ReturnType<typeof heatGrid>>(); // frames are deterministic per project: build once
const gridOf = (slug: string, tools: number) => { let g = grids.get(slug); if (!g) grids.set(slug, (g = heatGrid(slug, tools))); return g; };
const strip = stripGrid();

/** A cool and a warm heat image stacked inside the haze wrapper (the warm one fades in on hover). */
function Heat({ f, cool, warm, w, h }: { f: string; cool: string; warm: string; w: number; h: number }) {
  return (
    <span className="th-haze"><span className="th-haze-in">
      {/* eslint-disable @next/next/no-img-element -- tiny generated data-URI frames */}
      <img className="th-f th-f-cool" data-f={f} src={cool} alt="" width={w} height={h} decoding="async" />
      <img className="th-f th-f-warm" data-f={f} src={warm} alt="" width={w} height={h} decoding="async" />
      {/* eslint-enable @next/next/no-img-element */}
    </span></span>
  );
}

/** Hot spots: one sensor frame per project, warmest (most tools) first. */
function Work({ content: C }: SectionProps) {
  const pal = usePal();
  const ranked = useMemo(() => rankByTools(C.projects), [C.projects]);
  // frames re-colour only when the palette changes (tiny BMPs)
  const frames = useMemo(() => ranked.map((p) => {
    const g = gridOf(p.slug, p.tags.length);
    return { p, g, cool: bmp(g, pal, 0), warm: bmp(g, pal, 0.2) };
  }), [ranked, pal]);
  return (
    <ol className="th-spots">
      {frames.map(({ p, g, cool, warm }, i) => (
        <li className="th-spot" key={p.slug} id={`project-${p.slug}`}>
          <a className="th-spot-b" href={`/work/${p.slug}`} data-case={p.slug} aria-label={`${p.title}: ${p.headline}. Open the case`}>
            <span className="th-frame">
              <Heat f={p.slug} cool={cool} warm={warm} w={W} h={HH} />
              <span className="th-f-tl">SP{i + 1}</span>
              <span className="th-f-tr">{p.tags.length} tools</span>
              <i className="th-max" style={{ left: `${(g.at[0] * 100).toFixed(1)}%`, top: `${(g.at[1] * 100).toFixed(1)}%` }} />
            </span>
            <span className="th-spot-m">
              <span className="th-spot-k"><Icon name={p.icon} /><span data-edit={`project:${p.slug}:kind`}>{p.kind}</span></span>
              <span className="th-spot-t" data-edit={`project:${p.slug}:title`}>{p.title}</span>
              <span className="th-spot-h" data-edit={`project:${p.slug}:headline`}>{p.headline}</span>
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
}


/** Contact frame: the shared copy over a crisp sensor strip that warms while the pointer is on it. */
function ContactFrame({ children }: { children: ReactNode }) {
  const pal = usePal();
  const img = useMemo(() => ({ cool: bmp(strip, pal, 0), warm: bmp(strip, pal, 0.2) }), [pal]);
  return (
    <div className="th-mail">
      {children}
      <span className="th-strip" aria-hidden="true"><Heat f="@strip" cool={img.cool} warm={img.warm} w={64} h={6} /></span>
    </div>
  );
}

const SKIN: Skin = {
  id: "thermal",
  ...XP,
  rootClass: "th",
  labels: { experience: "Record", play: "Bench" },
  sectionClass: (id) => (id === "contact" ? "th-sec th-contact" : "th-sec"),
  titleClass: "th-h2",
  NameFx: ThermalName,
  PortraitFx: ThermalPortrait,
  ContactFrame,
  contactLead: "The warmest lead is email",
  sections: { work: Work },
};

/** The whole Thermal site: the shared layout plus the viewfinder, heat field and palette in the hero. */
export default function Thermal({ content: C }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  const { pal, nuc, choose } = useThermalMotion(root);
  // the shader's first palette is the stored one at rest; later changes go through useShaderUniforms (the sweep)
  const [uniforms] = useState(() => { const i = palIndex(readPal()); return { u_pv: [i, i, 0] as [number, number, number] }; });
  const now = C.places.find((p) => p.key === "now");
  const hero = (
    <>
      <div className="th-ir" id="th-ir" aria-hidden="true" />
      <div className="th-vf" aria-hidden="true"><i /><i /><i /><i />
        <span className="th-vf-tl"><b className="th-rec" />IR · live</span>
        <span className="th-vf-tr"><Clock tz={C.now.tz} className="th-clk" /> {now ? now.city : C.now.city}</span>
        <span className={`th-vf-bl${nuc ? " on" : ""}`}>{nuc ? "NUC · calibrating" : "e 0.95 · 9 Hz"}</span>
      </div>
      <div className="th-scale" aria-hidden="true">
        <span className="th-scale-v">{T_MAX.toFixed(1)}</span>
        <div className="th-scale-bar"><i className="th-ramp th-ramp-v" data-ramp="live" /><b className="th-scale-mk" id="th-mk" /></div>
        <span className="th-scale-v">{T_MIN.toFixed(1)}</span>
      </div>
      <div className="th-meter" id="th-meter" aria-hidden="true"><i className="th-cross" /><span className="th-meter-r"><b id="th-mv">31.4</b><span>°C</span></span></div>
      <div className="th-pal" role="group" aria-label="Thermal palette">
        {PALS.map(([id, nm]) => (
          <button type="button" key={id} className="th-pal-b" aria-pressed={id === pal} onClick={() => choose(id as PalId)}><i className="th-ramp" data-ramp={id} aria-hidden="true" />{nm}</button>
        ))}
      </div>
    </>
  );
  return (
    <SiteLayout content={C} skin={SKIN} rootRef={root} hero={hero}>
      <svg className="th-defs" width="0" height="0" aria-hidden="true" focusable="false"><filter id="th-haze-f" x="-4%" y="-4%" width="108%" height="108%"><feTurbulence type="fractalNoise" baseFrequency=".014 .07" numOctaves="2" seed="7" /><feDisplacementMap in="SourceGraphic" scale="10" xChannelSelector="R" yChannelSelector="G" /></filter></svg>
      <ShaderCanvas spec={META.shader} dark uniforms={uniforms} />
    </SiteLayout>
  );
}
