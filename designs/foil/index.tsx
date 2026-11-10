"use client";
// Foil: a holographic trading card under a desk lamp. A skin on the shared layout (designs/PORTING.md). The
// thin-film shader lives only on the holo card behind the hero portrait (its portrait backdrop), which tilts toward
// the pointer; everything else is calm CSS that wakes on hover. html.lite and reduced motion leave a still card,
// static foil gradients, no tilt, no glare and no datamosh.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionProps, Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import { PLAY } from "@/lib/play/games";
import { useSite } from "@/components/site/SiteProvider";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import Clock from "@/components/site/Clock";
import Mark from "@/components/site/mark/Mark";
import { Icon } from "@/components/site/Glyph";
import { ouroPath } from "@/components/site/mark/ouro";
import { FOIL, useFoilMotion } from "./motion";
import FoilName from "./name-fx";
import FoilPortrait from "./portrait-fx";
import "./foil.css";

const META = designById("foil")!;
const pad = (n: number) => String(n).padStart(2, "0");
const PLACE_LABEL: Record<string, string> = { home: "Home", school: "School", now: "Now" };
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

/** About: the text and thesis, now + places, then the numbers. */
function About({ content: C }: SectionProps) {
  return (
    <>
      <div className="fo-about-txt">
        {C.about.map((a, i) => <p key={i} className="fo-p" data-edit={`v7.about.${i}`}>{a}</p>)}
        <ul className="fo-thesis">{C.thesis.map((t, i) => <li key={t}><i aria-hidden="true" /><span data-edit={`v7.thesis.${i}`}>{t}</span></li>)}</ul>
      </div>
      <div className="fo-now" id="now" aria-label="Right now">
        <dl className="fo-now-l">
          <div><dt>Building</dt><dd data-edit="v7.now.building">{C.now.building}</dd></div>
          <div><dt>Researching</dt><dd data-edit="v7.now.researching">{C.now.researching}</dd></div>
          <div><dt>Learning</dt><dd data-edit="v7.now.learning">{C.now.learning}</dd></div>
        </dl>
        <ul className="fo-places" aria-label="Places">{C.places.map((pl) => <li key={pl.key} className={pl.key === "now" ? "is-now" : ""}><span>{PLACE_LABEL[pl.key] || pl.key}</span><b>{pl.city}</b><Clock tz={pl.tz} className="" /></li>)}</ul>
      </div>
      <dl className="fo-nums">{C.numbers.map(([n, l], i) => <div key={l}><dt data-edit={`numbers.${i}.v`}>{n}</dt><dd data-edit={`numbers.${i}.l`}>{l}</dd></div>)}</dl>
    </>
  );
}

/** Play: stickers, one holo disc per toy. */
function Play() {
  return (
    <ul className="fo-stickers">{PLAY.map((t, i) => (
      <li key={t.id}><button type="button" className="fo-st" data-play={t.id} style={{ "--h": `${(i * 61) % 360}deg` } as CSSProperties} aria-label={`Play ${t.name}: ${t.desc}`}>
        <span className="fo-st-disc" aria-hidden="true"><i className="fo-st-foil" /><i className="fo-st-glit" /><span className="fo-st-ic"><Icon name={t.icon} /></span></span>
        <span className="fo-st-t">{t.name}</span><span className="fo-st-d">{t.desc}</span>
      </button></li>
    ))}</ul>
  );
}

/** Questions: short answers, one open at a time, and the hand-off to the agent. */
function Questions({ content: C }: SectionProps) {
  const oneOpen = (e: SyntheticEvent<HTMLDetailsElement>) => {
    const d = e.currentTarget;
    if (d.open) d.parentElement?.querySelectorAll("details").forEach((o) => { if (o !== d) o.open = false; });
  };
  return (
    <div className="fo-faq-b">
      <div className="fo-qs">{C.faq.map(([q, a], i) => <details key={q} className="fo-q" onToggle={oneOpen}><summary><span data-edit={`faq.${i}.q`}>{q}</span><i aria-hidden="true" /></summary><p data-edit={`faq.${i}.a`}>{a}</p></details>)}</div>
      <p className="fo-sub"><button type="button" className="fo-inl" data-agent="">Ask my agent</button></p>
    </div>
  );
}

/** Contact: the foil seal, one line and the composer. */
function Contact() {
  return (
    <>
      <span className="fo-seal" aria-hidden="true"><Fm cls="fo-fm-l" /></span>
      <p className="fo-big">Write to me.</p>
      <div className="fo-acts fo-c"><button type="button" className="fo-btn fo-btn-foil fo-btn-l" data-compose="Internship opportunity"><Icon name="mail" />Write an email</button></div>
    </>
  );
}

const SKIN: Skin = {
  id: "foil",
  rootClass: "fo",
  labels: { work: "The set", experience: "Path", play: "Stickers" },
  sectionClass: (id) => `fo-sec fo-${{ work: "work", experience: "exp", about: "about", play: "play", questions: "faq", contact: "contact" }[id]}`,
  titleClass: "fo-h2",
  sections: { work: Work, experience: Experience, about: About, play: Play, questions: Questions, contact: Contact },
  NameFx: FoilName,
  PortraitFx: FoilPortrait,
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
