"use client";
// Prism: light splitting through glass. A skin on the shared layout (designs/PORTING.md). A quiet white optics
// catalogue; the trippiness is optical and lives in a few places only: the shader's dispersed beam (hero, fading
// with scroll), RGB splits on the hero name (its NameFx), scrolling headings and hovered project titles, one
// anaglyph heading (Play), and the dark contact room. html.lite and reduced motion drop the splits, blend modes and
// tracking, leaving a designed still.
import { useRef, useState, type ReactNode } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionId, SectionProps, Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import { Icon } from "@/components/site/Glyph";
import { usePrismMotion } from "./motion";
import { XP } from "./experience";
import PrismName from "./name-fx";
import PrismPortrait from "./portrait-fx";
import "./prism.css";

const META = designById("prism")!;
// one band of the visible spectrum per project (red bends least, violet most)
const BANDS = [["#FF2D3D", "650"], ["#FF7A00", "600"], ["#E8B800", "580"], ["#12B76A", "530"], ["#1E6BFF", "470"], ["#7A3CFF", "420"]];
const band = (i: number) => BANDS[i % BANDS.length];
const pad = (i: number) => String(i + 1).padStart(2, "0");
const bandVar = (i: number) => ({ ["--band" as string]: band(i)[0] });
const SEC: Record<SectionId, string> = { work: "pr-work", experience: "pr-exp", about: "pr-about", play: "pr-play", questions: "pr-faq", contact: "pr-contact" };

/** Text with two coloured plates behind it (data-text feeds the ::before/::after copies). */
function Ca({ txt, cls = "" }: { txt: string; cls?: string }) {
  return <span className={`pr-ca${cls ? " " + cls : ""}`} data-text={txt}>{txt}</span>;
}


/** A section heading with its chromatic plates (Play gets the anaglyph). */
function Title({ id, label, hid }: { id: SectionId; label: string; hid: string }) {
  if (id === "play") return <h2 className="pr-ana" id={hid} aria-label={label}><span className="pr-ana-c" aria-hidden="true">{label}</span><span className="pr-ana-r" aria-hidden="true">{label}</span></h2>;
  return <h2 className="pr-h2 ly-title" id={hid}><Ca txt={label} /></h2>;
}

/** The dark room's prism: the photographed render, with a crisp SVG fallback if the file is missing. */
function DarkArt() {
  const [ok, setOk] = useState(true);
  return (
    <div className="pr-dk-art" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative render positioned in panel units */}
      {ok && <img className="pr-dk-img" src="/v7/prism/prism-1376.webp" alt="" width={1376} height={768} loading="lazy" decoding="async" onError={() => setOk(false)} />}
      {!ok && (
        <svg className="pr-dk-svg" viewBox="0 0 600 360" focusable="false">
          <defs>
            <linearGradient id="pr-fan" x1="0" y1="0" x2="0" y2="1">{BANDS.map(([c], i) => <stop key={c} offset={(i / 5).toFixed(2)} stopColor={c} />)}</linearGradient>
            <linearGradient id="pr-fan-fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="1" /><stop offset="1" stopColor="#fff" stopOpacity=".25" /></linearGradient>
            <mask id="pr-fan-m"><rect width="600" height="360" fill="url(#pr-fan-fade)" /></mask>
          </defs>
          <path className="pr-dk-ray" d="M0 214 L246 168" />
          <path className="pr-dk-in" d="M246 168 L330 176" />
          <path className="pr-dk-fan" d="M330 176 L600 118 L600 330 Z" fill="url(#pr-fan)" mask="url(#pr-fan-m)" />
          <path className="pr-dk-glass" d="M300 70 L380 214 L220 214 Z" />
          <path className="pr-dk-hl" d="M300 84 L370 208" />
        </svg>
      )}
    </div>
  );
}

/** Work: one spectral band per project. */
function Work({ content: C }: SectionProps) {
  return (
    <ol className="pr-pjs">
      {C.projects.map((p, i) => (
        <li className="pr-pj-li" key={p.slug}>
          <a className="pr-pj" id={`project-${p.slug}`} href={`/work/${p.slug}`} data-case={p.slug} style={bandVar(i)} aria-label={`${p.title}: ${p.headline}. Open the case`}>
            <span className="pr-pj-band" aria-hidden="true" />
            <span className="pr-pj-n"><b>{pad(i)}</b><span>{band(i)[1]} nm</span></span>
            <span className="pr-pj-main">
              <span className="pr-pj-t"><Ca txt={p.title} /></span>
              <span className="pr-pj-h" data-edit={`project:${p.slug}:headline`}>{p.headline}</span>
            </span>
            <span className="pr-pj-k"><Icon name={p.icon} /><span data-edit={`project:${p.slug}:kind`}>{p.kind}</span></span>
            <span className="pr-pj-go" aria-hidden="true"><Icon name="arrow-up-right" /></span>
          </a>
        </li>
      ))}
    </ol>
  );
}


/** Contact frame: the shared copy inside the dark room, with the prism render behind it. */
function ContactFrame({ children }: { children: ReactNode }) {
  return (
    <div className="pr-dark">
      <DarkArt />
      <div className="pr-dk-in">{children}</div>
    </div>
  );
}

const SKIN: Skin = {
  id: "prism",
  ...XP,
  rootClass: "pr",
  sectionClass: (id) => `pr-sec ${SEC[id]}`,
  Title,
  NameFx: PrismName,
  PortraitFx: PrismPortrait,
  ContactFrame,
  sections: { work: Work },
};

/** The whole Prism site: the shared layout in a white optics catalogue, lit by one dispersed beam. */
export default function Prism({ content }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  usePrismMotion(root);
  return (
    <SiteLayout content={content} skin={SKIN} rootRef={root}>
      <div className="pr-gl" id="pr-gl" aria-hidden="true" />
      <ShaderCanvas spec={META.shader} dark={META.dark} />
    </SiteLayout>
  );
}
