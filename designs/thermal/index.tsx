"use client";
// Thermal: an infrared camera reading the warmth of his work. A skin on the shared layout (designs/PORTING.md).
// The false-colour heat field (shader) is hosted inside the hero only, so it stops rendering once the hero scrolls
// away; the palette switch (iron / rainbow / white hot) re-maps the shader, scale bar, hot-spot frames and accents
// together through the shader's own `u_pv` uniform; the spot meter follows a fine pointer; hot-spot frames and the
// contact strip are tiny BMP heat images that warm on hover. html.lite = one still heat frame, no haze.
import { useMemo, useRef, useState } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionProps, Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import { PLAY } from "@/lib/play/games";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import Clock from "@/components/site/Clock";
import { Icon, Logo } from "@/components/site/Glyph";
import { PALS, T_MAX, T_MIN, bmp, palIndex, stripGrid, type PalId } from "./heat";
import { readPal, usePal, useThermalMotion } from "./motion";
import "./thermal.css";

const META = designById("thermal")!;
const PLACE_LABEL: Record<string, string> = { home: "Home", school: "School", now: "Now" };
const TOOL_LOGO: Record<string, string> = { Python: "python", JavaScript: "javascript", TypeScript: "typescript", "C++": "cplusplus", React: "react", "Next.js": "nextdotjs", "Node.js": "nodedotjs", Express: "express", TensorFlow: "tensorflow", Keras: "keras", "scikit-learn": "scikitlearn", Pandas: "pandas", MongoDB: "mongodb", Supabase: "supabase", Vercel: "vercel", Cloudflare: "cloudflare", "Google Apps Script": "googleappsscript", Arduino: "arduino", Ollama: "ollama" };
const logoSrc = (l: string) => (/^(\/|https?:)/.test(l) ? l : `/images/${l}`); // content stores the bare file name
const strip = stripGrid();

/** A tool chip with its logo when we have one. */
function Chip({ t }: { t: string }) {
  return <span className="chip">{TOOL_LOGO[t] && <Logo slug={TOOL_LOGO[t]} />}{t}</span>;
}

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

/** The record: roles as heat-coded disclosures, warmest (latest) first, then the degree. */
function Experience({ content: C }: SectionProps) {
  const ed = C.education;
  return (
    <>
      <ol className="th-roles">
        {C.experience.map((x, i) => (
          <li className="th-role-i" id={`experience-${x.slug}`} key={x.slug} style={{ ["--heat" as string]: `var(--rh${Math.min(i, 3)})` }}>
            <details open={i === 0}>
              <summary>
                <span className="th-heat" aria-hidden="true" />
                <span className="th-when" data-edit={`role:${x.slug}:when`}>{x.when}</span>
                <span className="th-what"><b data-edit={`role:${x.slug}:role`}>{x.role}</b><span data-edit={`role:${x.slug}:org`}>{x.org}</span></span>
                <span className="th-where" data-edit={`role:${x.slug}:where`}>{x.where}</span>
                <span className="th-plus" aria-hidden="true" />
              </summary>
              <div className="th-role-b"><ul className="th-list">{x.desc.map((d, j) => <li key={j} data-edit={`role:${x.slug}:desc.${j}`}>{d}</li>)}</ul><div className="chips">{x.tags.map((t) => <Chip t={t} key={t} />)}</div></div>
            </details>
          </li>
        ))}
      </ol>
      <div className="th-edu" id="education">
        <span className="th-edu-logo">
          {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size logo from content */}
          <img src={logoSrc(ed.logo)} alt="" width={56} height={56} loading="lazy" decoding="async" />
        </span>
        <div className="th-edu-t"><h3 data-edit="edu:school">{ed.school}</h3><p data-edit="edu:degree">{ed.degree}</p></div>
        <dl className="th-edu-d"><div><dt>Focus</dt><dd data-edit="edu:focus">{ed.focus}</dd></div>{ed.grad && <div><dt>Graduation</dt><dd data-edit="edu:grad">{ed.grad}</dd></div>}</dl>
      </div>
    </>
  );
}

/** The bench: one channel per toy. */
function Play() {
  return (
    <ol className="th-toys">
      {PLAY.map((t, i) => (
        <li key={t.id}><button type="button" className="th-toy" data-play={t.id}>
          <span className="th-toy-n">CH {String(i + 1).padStart(2, "0")}</span>
          <span className="th-toy-i" aria-hidden="true"><Icon name={t.icon} /></span>
          <span className="th-toy-t">{t.name}</span>
          <span className="th-toy-d">{t.desc}</span>
        </button></li>
      ))}
    </ol>
  );
}

/** About text beside an instrument panel (now + places with clocks), then the readings. */
function About({ content: C }: SectionProps) {
  const nowRows: [string, string, string][] = [["Building", C.now.building, "building"], ["Researching", C.now.researching, "researching"], ["Learning", C.now.learning, "learning"]];
  return (
    <>
      <div className="th-about">
        <div className="th-about-t">{C.about.map((a, i) => <p key={i} data-edit={`v7.about.${i}`}>{a}</p>)}</div>
        <aside className="th-now" aria-label="Now">
          <p className="th-panel-k">Now</p>
          <dl>{nowRows.map(([k, v, f]) => <div key={k}><dt>{k}</dt><dd data-edit={`v7.now.${f}`}>{v}</dd></div>)}</dl>
          <p className="th-panel-k">Places</p>
          <ul className="th-places">
            {C.places.map((pl) => <li key={pl.key}><span className="th-pl-k">{PLACE_LABEL[pl.key] ?? pl.key}</span><span className="th-pl-c">{pl.city}</span><Clock tz={pl.tz} className="th-pl-t" /></li>)}
          </ul>
        </aside>
      </div>
      <ul className="th-reads" aria-label="In numbers">{C.numbers.map(([n, l], i) => <li key={l} style={{ ["--heat" as string]: `var(--rh${Math.min(i, 3)})` }}><b data-edit={`numbers.${i}.v`}>{n}</b><span data-edit={`numbers.${i}.l`}>{l}</span></li>)}</ul>
    </>
  );
}

/** Contact: the warmest lead is email; the address over a crisp sensor strip opens the composer. */
function Contact({ content: C }: SectionProps) {
  const pal = usePal();
  const img = useMemo(() => ({ cool: bmp(strip, pal, 0), warm: bmp(strip, pal, 0.2) }), [pal]);
  return (
    <div className="th-mail">
      <button type="button" className="th-mail-b" data-compose="Internship opportunity"><span className="th-mail-k">The warmest lead is email</span><span className="th-mail-a">{C.links.email}</span>
        <span className="th-strip" aria-hidden="true"><Heat f="@strip" cool={img.cool} warm={img.warm} w={64} h={6} /></span>
      </button>
    </div>
  );
}

export const SKIN: Skin = {
  id: "thermal",
  rootClass: "th",
  labels: { experience: "Record", play: "Bench" },
  sectionClass: (id) => (id === "contact" ? "th-sec th-contact" : "th-sec"),
  titleClass: "th-h2",
  projectArt: { palette: ["var(--th-bg3, #0B0F1A)", "var(--rh1, #FC780F)", "var(--rh0, #FFD138)", "var(--rh3, #A0179E)"], params: { hole: 0.3 } },
  sections: { experience: Experience, play: Play, about: About, contact: Contact },
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
