"use client";
// Prism: light splitting through glass. A skin on the shared layout (designs/PORTING.md). A quiet white optics
// catalogue; the trippiness is optical and lives in a few places only: the shader's dispersed beam (hero, fading
// with scroll), RGB splits on the hero name (its NameFx), scrolling headings and hovered project titles, one
// anaglyph heading (Play), and the dark contact room. html.lite and reduced motion drop the splits, blend modes and
// tracking, leaving a designed still.
import { useRef, useState, type SyntheticEvent } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionId, SectionProps, Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import Clock from "@/components/site/Clock";
import { Icon } from "@/components/site/Glyph";
import EduMeta from "@/components/site/EduMeta";
import { usePrismMotion } from "./motion";
import "./prism.css";

const META = designById("prism")!;
// one band of the visible spectrum per project (red bends least, violet most)
const BANDS = [["#FF2D3D", "650"], ["#FF7A00", "600"], ["#E8B800", "580"], ["#12B76A", "530"], ["#1E6BFF", "470"], ["#7A3CFF", "420"]];
const band = (i: number) => BANDS[i % BANDS.length];
const PLACE: Record<string, string> = { home: "Home", school: "School", now: "Now" };
const pad = (i: number) => String(i + 1).padStart(2, "0");
const logoSrc = (l: string) => (/^(\/|https?:)/.test(l) ? l : `/images/${l}`); // content stores the bare file name
const bandVar = (i: number) => ({ ["--band" as string]: band(i)[0] });
const SEC: Record<SectionId, string> = { work: "pr-work", experience: "pr-exp", about: "pr-about", play: "pr-play", questions: "pr-faq", contact: "pr-contact" };

/** Text with two coloured plates behind it (data-text feeds the ::before/::after copies). */
function Ca({ txt, cls = "" }: { txt: string; cls?: string }) {
  return <span className={`pr-ca${cls ? " " + cls : ""}`} data-text={txt}>{txt}</span>;
}

/** The hero name, split into red and cyan plates that settle on load. */
function Name({ first, last }: { first: string; last: string }) {
  return (
    <span className="pr-name">
      <span className="pr-ca pr-name-1" data-text={first} data-edit="name.first">{first}</span>
      <span className="pr-ca pr-name-2" data-text={last} data-edit="name.last">{last}</span>
    </span>
  );
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

/** Experience: roles with a date margin, then the degree. */
function Experience({ content: C }: SectionProps) {
  return (
    <>
      <ol className="pr-roles">
        {C.experience.map((x) => (
          <li className="pr-role" id={`experience-${x.slug}`} key={x.slug}>
            <p className="pr-when"><b data-edit={`role:${x.slug}:when`}>{x.when}</b><span data-edit={`role:${x.slug}:where`}>{x.where}</span></p>
            <div className="pr-role-b">
              <h3 data-edit={`role:${x.slug}:role`}>{x.role}</h3>
              <p className="pr-org" data-edit={`role:${x.slug}:org`}>{x.org}</p>
              <ul>{x.desc.map((d, i) => <li key={i} data-edit={`role:${x.slug}:desc.${i}`}>{d}</li>)}</ul>
              <p className="pr-tags">{x.tags.map((t) => <span key={t}>{t}</span>)}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="pr-edu" id="education">
        {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size logo from content */}
        <img src={logoSrc(C.education.logo)} alt={C.education.school} width={72} height={72} loading="lazy" decoding="async" />
        <div>
          <h3 data-edit="edu:school">{C.education.school}</h3>
          <p className="pr-edu-d" data-edit="edu:degree">{C.education.degree}</p>
          <p className="pr-edu-m"><EduMeta e={C.education} /></p>
        </div>
      </div>
    </>
  );
}

/** About: the text and thesis, now + places, then the numbers in spectral colours. */
function About({ content: C }: SectionProps) {
  return (
    <>
      <div className="pr-about-txt">
        {C.about.map((a, i) => <p className="pr-p" key={i} data-edit={`v7.about.${i}`}>{a}</p>)}
        <ul className="pr-thesis">{C.thesis.map((t, i) => <li key={i} style={bandVar(i * 2 + 1)}><span data-edit={`v7.thesis.${i}`}>{t}</span></li>)}</ul>
      </div>
      <div className="pr-now" id="now">
        <div className="pr-now-h"><p className="pr-now-city"><Icon name="map-pin" />{C.now.city} · <Clock tz={C.now.tz} className="pr-clock" /></p></div>
        <dl className="pr-now-list">
          <div><dt>Building</dt><dd data-edit="v7.now.building">{C.now.building}</dd></div>
          <div><dt>Researching</dt><dd data-edit="v7.now.researching">{C.now.researching}</dd></div>
          <div><dt>Learning</dt><dd data-edit="v7.now.learning">{C.now.learning}</dd></div>
        </dl>
        <ol className="pr-places" aria-label="Places">
          {C.places.map((pl) => (
            <li key={pl.key} className={pl.key === "now" ? "is-now" : ""}><span>{PLACE[pl.key] ?? pl.key}</span><b>{pl.city}</b><Clock tz={pl.tz} className="pr-clock" /></li>
          ))}
        </ol>
      </div>
      <div className="pr-nums"><dl>{C.numbers.map(([n, l], i) => <div key={l} style={bandVar([0, 2, 4, 5][i % 4])}><dt data-edit={`numbers.${i}.v`}>{n}</dt><dd data-edit={`numbers.${i}.l`}>{l}</dd></div>)}</dl></div>
    </>
  );
}

/** Questions: short answers, one open at a time, and the hand-off to the agent. */
function Questions({ content: C }: SectionProps) {
  const oneOpen = (e: SyntheticEvent<HTMLDetailsElement>) => {
    const d = e.currentTarget;
    if (d.open) d.parentElement?.querySelectorAll("details").forEach((o) => { if (o !== d) o.open = false; });
  };
  return (
    <div className="pr-faq-grid">
      <div className="pr-faq-l"><div className="pr-acts"><button type="button" className="pr-btn pr-btn-line" data-agent=""><span className="pr-prompt" aria-hidden="true">❯</span>Ask my agent</button></div></div>
      <div className="pr-qs">
        {C.faq.map(([q, a], i) => (
          <details className="pr-q" key={q} onToggle={oneOpen}><summary><span data-edit={`faq.${i}.q`}>{q}</span><span className="pr-plus" aria-hidden="true" /></summary><p data-edit={`faq.${i}.a`}>{a}</p></details>
        ))}
      </div>
    </div>
  );
}

/** Contact: the dark room, one line and the composer. */
function Contact() {
  return (
    <div className="pr-dark">
      <DarkArt />
      <div className="pr-dk-in">
        <p className="pr-dk-h">Write to me.</p>
        <div className="pr-acts"><button type="button" className="pr-btn pr-btn-white" data-compose="Internship opportunity"><Icon name="mail" />Write an email</button></div>
      </div>
    </div>
  );
}

const SKIN: Skin = {
  id: "prism",
  rootClass: "pr",
  sectionClass: (id) => `pr-sec ${SEC[id]}`,
  Title,
  NameFx: Name,
  sections: { work: Work, experience: Experience, about: About, questions: Questions, contact: Contact },
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
