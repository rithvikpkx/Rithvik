"use client";
// Stipple: a hand-printed pamphlet that breathes. A skin on the shared layout (designs/PORTING.md). The shader cloud
// sits behind the page, knocked out behind every reading block by paper plates; the square lens is on the hero name
// (idle drift; its NameFx) and the dispatch plates (hover); SVG stipple filters touch display type only. Section
// titles are chapters: a stippled roman numeral, the chapter name, a folio. html.lite and reduced motion switch the
// lens, drift, seal spin and every filter off, leaving a crisp two-ink letterpress still.
import { Fragment, useRef, type ReactNode } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionId, SectionProps, Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import SiteLayout from "@/components/site/layout/SiteLayout";
import Mark from "@/components/site/mark/Mark";
import { Icon } from "@/components/site/Glyph";
import EduMeta from "@/components/site/EduMeta";
import { ART, readSecs } from "./art";
import { DEFS } from "./defs";
import { useStippleMotion } from "./motion";
import "./stipple.css";

const META = designById("stipple")!;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
const CHAPTER: Record<SectionId, string> = { work: "Dispatches", experience: "Errata", about: "Foreword", play: "Supplement", questions: "Correspondence", contact: "The seal" };
const pad = (i: number) => String(i + 1).padStart(2, "0");
const logoSrc = (l: string) => (/^(\/|https?:)/.test(l) ? l : `/images/${l}`); // content stores the bare file name

/** The hero name under the square lens: a stippled base and a crisp vermilion copy revealed through the lens. */
function Name({ first, last }: { first: string; last: string }) {
  return (
    <span className="st-name" data-lens data-lens-idle>
      <span className="st-name-base"><span className="st-n1" data-edit="name.first">{first}</span> <span className="st-n2" data-edit="name.last">{last}</span></span>
      <span className="st-name-crisp" aria-hidden="true"><span className="st-n1">{first}</span> <span className="st-n2">{last}</span></span>
      <span className="st-lens-frame" aria-hidden="true"><i /><b className="st-lens-xy">x 000 · y 000</b></span>
    </span>
  );
}

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

/** Contact frame: the shared copy, then the seal; pressing it opens the message window too. */
function ContactFrame({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <button type="button" className="st-seal" data-compose="Internship opportunity" aria-label="Write a message">
        <svg viewBox="0 0 300 300" aria-hidden="true">
          <defs><path id="st-ring" d="M150 150 m-104 0 a104 104 0 1 1 208 0 a104 104 0 1 1 -208 0" /></defs>
          <g filter="url(#st-seal)"><circle cx="150" cy="150" r="138" fill="#FF3B1F" /></g>
          <circle cx="150" cy="150" r="122" fill="none" stroke="#F9CDB0" strokeWidth="1.5" strokeDasharray="1 5" strokeLinecap="round" />
          <circle cx="150" cy="150" r="84" fill="none" stroke="#F9CDB0" strokeWidth="1.2" />
          <g className="st-seal-spin"><text fontSize="14" fill="#F9CDB0"><textPath href="#st-ring" textLength="646" lengthAdjust="spacing">WRITE TO RITHVIK · OPEN TO NEW OPPORTUNITIES ·</textPath></text></g>
          <foreignObject x="104" y="104" width="92" height="92"><div style={{ width: 92, height: 92, color: "#F9CDB0" }}><Mark label="" /></div></foreignObject>
        </svg>
      </button>
    </>
  );
}

const SKIN: Skin = {
  id: "stipple",
  rootClass: "st",
  sectionClass: (id) => ({ work: "st-ch st-wide", play: "st-ch st-wide", about: "st-ch st-wide", questions: "st-ch st-wide", contact: "st-ch st-seal-sec", experience: "st-ch" })[id],
  Title: Chapter,
  NameFx: Name,
  ContactFrame,
  sections: { work: Work, experience: Experience },
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
