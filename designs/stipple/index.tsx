"use client";
// Stipple: a hand-printed pamphlet that breathes. A skin on the shared layout (designs/PORTING.md). The shader cloud
// sits behind the page, knocked out behind every reading block by paper plates; the square lens is on the hero name
// (idle drift; its NameFx) and the dispatch plates (hover); SVG stipple filters touch display type only. Section
// titles are chapters: a stippled roman numeral, the chapter name, a folio. html.lite and reduced motion switch the
// lens, drift, seal spin and every filter off, leaving a crisp two-ink letterpress still.
import { Fragment, useRef, type SyntheticEvent } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionId, SectionProps, Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import Clock from "@/components/site/Clock";
import SiteLayout from "@/components/site/layout/SiteLayout";
import Mark from "@/components/site/mark/Mark";
import { Icon } from "@/components/site/Glyph";
import EduMeta from "@/components/site/EduMeta";
import { ART, readSecs } from "./art";
import { DEFS } from "./defs";
import { useStippleMotion } from "./motion";
import StippleName from "./name-fx";
import StipplePortrait from "./portrait-fx";
import "./stipple.css";

const META = designById("stipple")!;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
const CHAPTER: Record<SectionId, string> = { work: "Dispatches", experience: "Errata", about: "Foreword", play: "Supplement", questions: "Correspondence", contact: "The seal" };
const PLACE_KEY: Record<string, string> = { home: "home", school: "school", now: "here now" };
const pad = (i: number) => String(i + 1).padStart(2, "0");
const logoSrc = (l: string) => (/^(\/|https?:)/.test(l) ? l : `/images/${l}`); // content stores the bare file name


/** A chapter heading: stippled roman numeral, chapter name, folio. */
function Chapter({ id, index, hid }: { id: SectionId; index: number; label: string; hid: string }) {
  const plate = id === "about" || id === "questions";
  return (
    <header className={`st-chh${plate ? "" : " st-plate-sm"}`}>
      <span className="st-rom" aria-hidden="true">{ROMAN[index]}</span><h2 id={hid}>{CHAPTER[id]}</h2><span className="st-folio">— {index + 2} —</span>
    </header>
  );
}

/** Dispatches: one printed plate per project (the lead runs long). */
function Work({ content: C }: SectionProps) {
  return (
    <div className="st-issue">
      {C.projects.map((p, i) => (
        <a key={p.slug} id={`project-${p.slug}`} className={`st-dsp st-dsp-${i + 1}`} href={`/work/${p.slug}`} data-case={p.slug} aria-label={`Dispatch No. ${pad(i)}: ${p.title}. Read the dispatch`}>
          <span className="st-stamp"><span>No. {pad(i)}</span><span>{readSecs(p)} sec read</span></span>
          <span className="st-art" data-lens aria-hidden="true">
            <svg className="st-art-base" viewBox="0 0 320 200"><g filter="url(#st-fz-art)" fill="#17110E" stroke="#17110E" dangerouslySetInnerHTML={{ __html: ART[p.slug] ?? "" }} /></svg>
            <svg className="st-art-crisp" viewBox="0 0 320 200"><g fill="#FF3B1F" stroke="#FF3B1F" dangerouslySetInnerHTML={{ __html: ART[p.slug] ?? "" }} /></svg>
            <span className="st-lens-frame"><i /></span>
          </span>
          <span className="st-kind"><Icon name={p.icon} /><span data-edit={`project:${p.slug}:kind`}>{p.kind}</span></span>
          <span className="st-dsp-t" data-edit={`project:${p.slug}:title`}>{p.title}</span>
          <span className="st-dsp-h" data-edit={`project:${p.slug}:headline`}>{p.headline}</span>
          {i === 0 && <><span className="st-dsp-c" data-edit={`project:${p.slug}:ctx`}>{p.ctx}</span><span className="st-dsp-d">{p.desc.map((d, k) => <Fragment key={k}>{k > 0 && " "}<span data-edit={`project:${p.slug}:desc.${k}`}>{d}</span></Fragment>)}</span><span className="st-dsp-tags">{p.tags.join(" · ")}</span></>}
          <span className="st-more"><span>Read the dispatch</span> <span aria-hidden="true">→</span></span>
        </a>
      ))}
    </div>
  );
}

/** Errata: the roles as a printed insert slip, then schooling. */
function Experience({ content: C }: SectionProps) {
  return (
    <div className="st-slip">
      <ol className="st-errata">
        {C.experience.map((x) => (
          <li id={`experience-${x.slug}`} key={x.slug}>
            <p className="st-er-top"><span data-edit={`role:${x.slug}:when`}>{x.when}</span><span className="st-lead" aria-hidden="true" /><span data-edit={`role:${x.slug}:where`}>{x.where}</span></p>
            <h3 data-edit={`role:${x.slug}:role`}>{x.role}</h3>
            <p className="st-er-org" data-edit={`role:${x.slug}:org`}>{x.org}</p>
            <ul>{x.desc.map((d, i) => <li key={i} data-edit={`role:${x.slug}:desc.${i}`}>{d}</li>)}</ul>
          </li>
        ))}
      </ol>
      <div className="st-edu" id="education">
        {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size logo from content */}
        <img src={logoSrc(C.education.logo)} alt={C.education.school} width={56} height={56} loading="lazy" />
        <div>
          <h3 data-edit="edu:school">{C.education.school}</h3>
          <p data-edit="edu:degree">{C.education.degree}</p>
          <p className="st-er-tags"><EduMeta e={C.education} /></p>
        </div>
      </div>
    </div>
  );
}

/** Foreword: the prose with a drop cap, what is on the press, places, then the figures. */
function About({ content: C }: SectionProps) {
  return (
    <>
      <div className="st-prose">
        {C.about.map((a, i) => <p key={i} className={i === 0 ? "st-drop" : undefined}><span data-edit={`v7.about.${i}`}>{a}</span>{i === C.about.length - 1 && <span className="st-endmark" aria-hidden="true"><Mark label="" /></span>}</p>)}
      </div>
      <div className="st-now" id="now">
        <dl>
          <div><dt>Building</dt><dd data-edit="v7.now.building">{C.now.building}</dd></div>
          <div><dt>Researching</dt><dd data-edit="v7.now.researching">{C.now.researching}</dd></div>
          <div><dt>Learning</dt><dd data-edit="v7.now.learning">{C.now.learning}</dd></div>
        </dl>
        <ul className="st-places" aria-label="Places">
          {C.places.map((p) => <li key={p.key} className={`st-place st-place-${p.key}`}><span className="st-pk">{PLACE_KEY[p.key] ?? p.key}</span><b>{p.city}</b><Clock tz={p.tz} className="st-clk" /></li>)}
        </ul>
      </div>
      <ol className="st-figs">{C.numbers.map(([v, l], i) => <li className="st-plate-sm" key={l}><span className="st-fig-n">Fig. {i + 1}</span><b data-edit={`numbers.${i}.v`}>{v}</b><span data-edit={`numbers.${i}.l`}>{l}</span></li>)}</ol>
    </>
  );
}

/** Correspondence: the questions as letters, one open at a time. */
function Questions({ content: C }: SectionProps) {
  const oneOpen = (e: SyntheticEvent<HTMLDetailsElement>) => {
    const d = e.currentTarget;
    if (d.open) d.parentElement?.querySelectorAll("details").forEach((o) => { if (o !== d) o.open = false; });
  };
  return (
    <div className="st-letters">
      {C.faq.map(([q, a], i) => (
        <details className="st-letter" key={q} onToggle={oneOpen}><summary><span className="st-q" data-edit={`faq.${i}.q`}>{q}</span><span className="st-plus" aria-hidden="true" /></summary><p data-edit={`faq.${i}.a`}>{a}</p></details>
      ))}
    </div>
  );
}

/** The seal: press it to write (opens the composer). */
function Contact({ content: C }: SectionProps) {
  return (
    <>
      <p className="st-write st-plate-sm">Write back.</p>
      <button type="button" className="st-seal" data-compose="Internship opportunity" aria-label={`Write to ${C.first}`}>
        <svg viewBox="0 0 300 300" aria-hidden="true">
          <defs><path id="st-ring" d="M150 150 m-104 0 a104 104 0 1 1 208 0 a104 104 0 1 1 -208 0" /></defs>
          <g filter="url(#st-seal)"><circle cx="150" cy="150" r="138" fill="#FF3B1F" /></g>
          <circle cx="150" cy="150" r="122" fill="none" stroke="#F9CDB0" strokeWidth="1.5" strokeDasharray="1 5" strokeLinecap="round" />
          <circle cx="150" cy="150" r="84" fill="none" stroke="#F9CDB0" strokeWidth="1.2" />
          <g className="st-seal-spin"><text fontSize="14" fill="#F9CDB0"><textPath href="#st-ring" textLength="646" lengthAdjust="spacing">{`WRITE TO RITHVIK · ${C.links.email.toUpperCase()} · SEALED BY HAND ·`}</textPath></text></g>
          <foreignObject x="104" y="104" width="92" height="92"><div style={{ width: 92, height: 92, color: "#F9CDB0" }}><Mark label="" /></div></foreignObject>
        </svg>
      </button>
    </>
  );
}

const SKIN: Skin = {
  id: "stipple",
  rootClass: "st",
  sectionClass: (id) => ({ work: "st-ch st-wide", play: "st-ch st-wide", about: "st-ch st-plate", questions: "st-ch st-plate", contact: "st-ch st-seal-sec", experience: "st-ch" })[id],
  Title: Chapter,
  sections: { work: Work, experience: Experience, about: About, questions: Questions, contact: Contact },
  NameFx: StippleName,
  PortraitFx: StipplePortrait,
};

/** The whole Stipple site: the shared layout printed on peach stock over a breathing stipple cloud. */
export default function Stipple({ content }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  useStippleMotion(root);
  const hero = <><span className="st-reg st-reg-tl" aria-hidden="true" /><span className="st-reg st-reg-tr" aria-hidden="true" /><span className="st-reg st-reg-bl" aria-hidden="true" /><span className="st-reg st-reg-br" aria-hidden="true" /></>;
  return (
    <SiteLayout content={content} skin={SKIN} rootRef={root} hero={hero}>
      <ShaderCanvas spec={META.shader} dark={META.dark} />
      <svg className="st-defs" width="0" height="0" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: DEFS }} />
    </SiteLayout>
  );
}
