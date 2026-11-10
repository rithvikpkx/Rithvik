"use client";
// Nimbus: a bright, airy sky world. A skin on the shared layout (designs/PORTING.md). The shader clouds live only in
// the hero (the sun rides the visitor's hour); pixel clouds elsewhere are static and move only on interaction (card
// hover, band clouds fleeing the pointer, stamp hover) or as slow drifts while their section is on screen.
// html.lite and reduced motion stop the trail, drifts and drop-shadow filters, leaving a designed still.
import { useMemo, useRef } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionProps, Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import Mark from "@/components/site/mark/Mark";
import { Icon } from "@/components/site/Glyph";
import EduMeta from "@/components/site/EduMeta";
import { DEFS, ON_SKY, icon16, skyShader, skyTile } from "./pixel";
import { useVisitorHour } from "./time";
import { useNimbusMotion } from "./motion";
import "./nimbus.css";

const META = designById("nimbus")!;
const pad = (i: number) => String(i + 1).padStart(2, "0");
const logoSrc = (l: string) => (/^(\/|https?:)/.test(l) ? l : `/images/${l}`); // content stores the bare file name
const bullet = <span className="nb-bullet" aria-hidden="true"><Mark label="" /></span>;

/** Raw pixel-art SVG inside a wrapper span (our own generated markup, never user input). */
function Px({ className, html }: { className?: string; html: string }) {
  return <span className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Work: sky tiles, one per project. */
function Work({ content: C }: SectionProps) {
  return (
    <div className="nb-cards">
      {C.projects.map((p, i) => (
        <a key={p.slug} id={`project-${p.slug}`} className="nb-card" href={`/work/${p.slug}`} data-case={p.slug} aria-label={`${p.title}: ${p.headline}. Open the case`}>
          <span className="nb-card-sky">
            <Px className="nb-drift" html={skyTile(11 + i * 17, 64, 20, 32, -0.34 - (i % 3) * 0.04, 0.55, "nb-tile")} />
            <Px className="nb-card-ic" html={icon16(p.slug, ON_SKY)} />
            <span className="nb-card-n">{pad(i)}</span>
            <span className="nb-card-kind"><Icon name={p.icon} /><span data-edit={`project:${p.slug}:kind`}>{p.kind}</span></span>
            <span className="nb-card-go" aria-hidden="true"><Icon name="arrow-up-right" /></span>
          </span>
          <span className="nb-card-tags">{p.tags.slice(0, 3).map((t) => <span key={t}>{t}</span>)}</span>
          <span className="nb-card-t" data-edit={`project:${p.slug}:title`}>{p.title}</span>
          <span className="nb-card-h" data-edit={`project:${p.slug}:headline`}>{p.headline}</span>
        </a>
      ))}
    </div>
  );
}

/** Experience: roles with a date margin, then the degree on a pixel-sky card. */
function Experience({ content: C }: SectionProps) {
  return (
    <>
      <ol className="nb-roles">
        {C.experience.map((x) => (
          <li className="nb-role" id={`experience-${x.slug}`} key={x.slug}>
            <p className="nb-when"><span className="nb-when-v" data-edit={`role:${x.slug}:when`}>{x.when}</span><span data-edit={`role:${x.slug}:where`}>{x.where}</span></p>
            <div className="nb-role-b">
              <h3 data-edit={`role:${x.slug}:role`}>{x.role}</h3>
              <p className="nb-org" data-edit={`role:${x.slug}:org`}>{x.org}</p>
              <ul>{x.desc.map((d, i) => <li key={i}>{bullet}<span data-edit={`role:${x.slug}:desc.${i}`}>{d}</span></li>)}</ul>
              <p className="nb-tags">{x.tags.map((t) => <span key={t}>{t}</span>)}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="nb-edu" id="education">
        <Px className="nb-edu-sky" html={skyTile(41, 48, 12, 24, 0.15, 0.7)} />
        {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size logo from content */}
        <img src={logoSrc(C.education.logo)} alt={C.education.school} width={64} height={64} loading="lazy" />
        <div>
          <h3 data-edit="edu:school">{C.education.school}</h3>
          <p data-edit="edu:degree">{C.education.degree}</p>
          <p className="nb-edu-m"><EduMeta e={C.education} /></p>
        </div>
      </div>
    </>
  );
}

const SKIN: Skin = {
  id: "nimbus",
  rootClass: "nb",
  labels: { play: "Recess" },
  sectionClass: (id) => `nb-sec nb-${{ work: "work", experience: "exp", about: "about", play: "play", questions: "faq", contact: "contact" }[id]}`,
  titleClass: "nb-h2",
  sections: { work: Work, experience: Experience },
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
