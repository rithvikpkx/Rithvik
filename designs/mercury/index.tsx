"use client";
/* eslint-disable @next/next/no-img-element -- fixed art with a hand-written srcset; logo comes from content */
// Mercury: a graphite studio with one heavy pool of liquid chrome. A skin on the shared layout (designs/PORTING.md).
// The shader moves only while the hero or Contact is on screen (metaballs, then ferrofluid that reaches for the
// pointer); between them its host is hidden so the runtime pauses. Reading sections are solid graphite, each opened
// by a chrome meniscus that rings once. html.lite / reduced motion: still shader frame, flat dividers, no drift.
import { useRef, type ReactNode, type SyntheticEvent } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionId, SectionProps, Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import { Icon } from "@/components/site/Glyph";
import EduMeta from "@/components/site/EduMeta";
import { useMercuryMotion } from "./motion";
import "./mercury.css";

const META = designById("mercury")!;
const pad = (i: number) => String(i + 1).padStart(2, "0");
const logoSrc = (l: string) => (/^(\/|https?:)/.test(l) ? l : `/images/${l}`); // content stores the bare file name
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

/** Work: a calm index; titles take a chrome sheen on hover. */
function Work({ content: C }: SectionProps) {
  return (
    <ol className="mc-work">
      {C.projects.map((p, i) => (
        <li key={p.slug} id={`project-${p.slug}`}>
          <a className="mc-row" href={`/work/${p.slug}`} data-case={p.slug} aria-label={`${p.title}: ${p.headline}. Open the case`}>
            <span className="mc-n">{pad(i)}</span><span className="mc-t" data-edit={`project:${p.slug}:title`}>{p.title}</span><span className="mc-k"><Icon name={p.icon} /><span data-edit={`project:${p.slug}:kind`}>{p.kind}</span></span><span className="mc-hl" data-edit={`project:${p.slug}:headline`}>{p.headline}</span><span className="mc-go"><Icon name="arrow-up-right" /></span>
          </a>
        </li>
      ))}
    </ol>
  );
}

/** Experience: roles with their dates in a margin column, then the degree. */
function Experience({ content: C }: SectionProps) {
  return (
    <>
      <ol className="mc-roles">
        {C.experience.map((x) => (
          <li className="mc-role" id={`experience-${x.slug}`} key={x.slug}>
            <p className="mc-when"><span className="mc-when-v" data-edit={`role:${x.slug}:when`}>{x.when}</span><span data-edit={`role:${x.slug}:where`}>{x.where}</span></p>
            <div className="mc-role-b"><h3 data-edit={`role:${x.slug}:role`}>{x.role}</h3><p className="mc-org" data-edit={`role:${x.slug}:org`}>{x.org}</p>
              <ul>{x.desc.map((d, i) => <li key={i} data-edit={`role:${x.slug}:desc.${i}`}>{d}</li>)}</ul>
              <p className="mc-tags">{x.tags.map((t) => <span key={t}>{t}</span>)}</p></div>
          </li>
        ))}
      </ol>
      <div className="mc-edu" id="education">
        <img src={logoSrc(C.education.logo)} alt={C.education.school} width={56} height={56} loading="lazy" decoding="async" />
        <div><h3 data-edit="edu:school">{C.education.school}</h3><p data-edit="edu:degree">{C.education.degree}</p><p className="mc-edu-m"><EduMeta e={C.education} /></p></div>
      </div>
    </>
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

const SKIN: Skin = {
  id: "mercury",
  rootClass: "mc",
  sectionClass: (id) => (id === "contact" ? "mc-contact" : id === "play" ? "mc-sec mc-play" : "mc-sec"),
  titleClass: "mc-h2",
  SectionOrnament: Divider,
  ContactFrame,
  sections: { work: Work, experience: Experience },
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
