"use client";
// Foil: a holographic trading card under a desk lamp. A skin on the shared layout (designs/PORTING.md). The
// thin-film shader lives only on the holo card behind the hero portrait (its portrait backdrop), which tilts toward
// the pointer; everything else is calm CSS that wakes on hover. html.lite and reduced motion leave a still card,
// static foil gradients, no tilt, no glare and no datamosh.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionProps, Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import { useSite } from "@/components/site/SiteProvider";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import Mark from "@/components/site/mark/Mark";
import { Icon } from "@/components/site/Glyph";
import { ouroPath } from "@/components/site/mark/ouro";
import { FOIL, useFoilMotion } from "./motion";
import "./foil.css";

const META = designById("foil")!;
const pad = (n: number) => String(n).padStart(2, "0");
const logoSrc = (l: string) => (/^(\/|https?:)/.test(l) ? l : `/images/${l}`); // content stores the bare file name

// the exact mark silhouette (eye punched out) as a CSS mask over the foil texture
const G = ouroPath();
const MASK_URL = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"><mask id="e"><rect x="-50" y="-50" width="100" height="100" fill="#fff"/><circle cx="${G.eye[0]}" cy="${G.eye[1]}" r="${G.eye[2]}" fill="#000"/></mask><path d="${G.d}" fill="#000" mask="url(#e)"/></svg>`)}")`;

/** Foil-stamped mark: the mark silhouette masking the foil layer, whose sheen slides with the pointer. */
function Fm({ cls = "" }: { cls?: string }) {
  return <span className={`fo-fm${cls ? " " + cls : ""}`} role="img" aria-label="Rithvik Praveen Kumar"><i /></span>;
}

/** Work: the set, one holo trading card per project. */
function Work({ content: C }: SectionProps) {
  const total = pad(C.projects.length);
  return (
    <ul className="fo-set" id="fo-set">{C.projects.map((p, i) => (
      <li key={p.slug} className="fo-pc-li">
        <a className="fo-pc" id={`project-${p.slug}`} href={`/work/${p.slug}`} data-fo-case={p.slug} style={{ "--h": `${(i * 57) % 360}deg`, "--hp": `${((i * 57) % 360) / 3.6}%` } as CSSProperties} aria-label={`${p.title}: ${p.headline}. Open the case`}>
          <span className="fo-pc-top"><span className="fo-pc-n">No. {pad(i + 1)}<i>/{total}</i></span><span className="fo-pc-kind" data-edit={`project:${p.slug}:kind`}>{p.kind}</span></span>
          <span className="fo-pc-art" aria-hidden="true">
            <span className="fo-pc-holo"><i /></span>
            <span className="fo-pc-glit"><i /></span>
            <span className="fo-pc-ic"><span className="fo-pc-ic-hi"><Icon name={p.icon} /></span><span className="fo-pc-ic-ink"><Icon name={p.icon} /></span></span>
            <span className="fo-pc-wm"><Mark label="" /></span>
          </span>
          <span className="fo-pc-t" data-edit={`project:${p.slug}:title`}>{p.title}</span>
          <span className="fo-pc-h" data-edit={`project:${p.slug}:headline`}>{p.headline}</span>
          <span className="fo-pc-stats">
            <span><b>Stack</b>{p.tags.join(" · ")}</span>
            <span><b>Context</b><span data-edit={`project:${p.slug}:ctx`}>{p.ctx}</span></span>
          </span>
        </a>
      </li>
    ))}</ul>
  );
}

/** Path: roles with a date column, then the degree as a badge card. */
function Experience({ content: C }: SectionProps) {
  return (
    <>
      <ol className="fo-roles">
        {C.experience.map((x) => (
          <li key={x.slug} className="fo-role" id={`experience-${x.slug}`}>
            <p className="fo-when"><span className="fo-when-v" data-edit={`role:${x.slug}:when`}>{x.when}</span><span data-edit={`role:${x.slug}:where`}>{x.where}</span></p>
            <div className="fo-role-h"><h3 data-edit={`role:${x.slug}:role`}>{x.role}</h3><p data-edit={`role:${x.slug}:org`}>{x.org}</p></div>
            <div className="fo-role-b"><ul>{x.desc.map((d, i) => <li key={i} data-edit={`role:${x.slug}:desc.${i}`}>{d}</li>)}</ul><p className="fo-tags">{x.tags.map((t) => <span key={t}>{t}</span>)}</p></div>
          </li>
        ))}
      </ol>
      <article className="fo-edu" id="education" aria-label="Education">
        <span className="fo-edu-badge">
          {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size logo from content */}
          <img src={logoSrc(C.education.logo)} alt={C.education.school} width={56} height={56} loading="lazy" decoding="async" />
        </span>
        <div><h3 data-edit="edu:school">{C.education.school}</h3><p data-edit="edu:degree">{C.education.degree}</p></div>
        <p className="fo-edu-m"><span data-edit="edu:focus">{C.education.focus}</span>{C.education.grad && <><br /><span data-edit="edu:grad">{C.education.grad}</span></>}</p>
      </article>
    </>
  );
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

const SKIN: Skin = {
  id: "foil",
  rootClass: "fo",
  labels: { work: "The set", experience: "Path", play: "Stickers" },
  sectionClass: (id) => `fo-sec fo-${{ work: "work", experience: "exp", about: "about", play: "play", questions: "faq", contact: "contact" }[id]}`,
  titleClass: "fo-h2",
  ContactFrame,
  sections: { work: Work, experience: Experience },
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
