"use client";
// Tracker: a calm light lab UI watched by a small vision model. A skin on the shared layout (designs/PORTING.md).
// The depth/segmentation shader runs only inside the hero's cam0 feed (the one loud place, behind the portrait);
// DOM bounding boxes acquire real page elements (the person, the name, headings, project rows, toys) and hand over
// to whatever the pointer hovers; optical-flow arrows only while scrolling fast; a HUD with real numbers. html.lite
// and reduced motion stop the loop; lite swaps the boxes for a few static CSS annotations (a designed still).
import { useRef } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionProps, Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import { Icon } from "@/components/site/Glyph";
import EduMeta from "@/components/site/EduMeta";
import { fmap, pad, projLabel } from "./vision";
import { MAX_BOXES, SLICE_COLORS, useTrackerMotion } from "./motion";
import "./tracker.css";

const META = designById("tracker")!;
const logoSrc = (l: string) => (/^(\/|https?:)/.test(l) ? l : `/images/${l}`); // content stores the bare file name

/** The name, a "text" target the tracker boxes. */
function Name({ first, last }: { first: string; last: string }) {
  return <span className="tk-name" data-tk="text" data-tk-label="name" data-tk-static="name 0.99"><span data-edit="name.first">{first}</span> <span data-edit="name.last">{last}</span></span>;
}

/** A section heading; also a "text" target. */
function Title({ label, hid }: { label: string; hid: string }) {
  return <h2 className="tk-h2 ly-title" id={hid} data-tk="text" data-tk-label="heading">{label}</h2>;
}

/** Work: project rows, each with a little feature map. */
function Work({ content: C }: SectionProps) {
  return (
    <ol className="tk-projects">
      {C.projects.map((p, i) => (
        <li key={p.slug}>
          <a className="tk-proj" id={`project-${p.slug}`} href={`/work/${p.slug}`} data-case={p.slug} data-tk="project" data-tk-static={projLabel(p.slug)} aria-label={`${p.title}: ${p.headline}. Open the case`}>
            <span className="tk-pn">{pad(i + 1)}</span>
            <span className="tk-pb"><b className="tk-pt-t" data-edit={`project:${p.slug}:title`}>{p.title}</b><span className="tk-ph" data-edit={`project:${p.slug}:headline`}>{p.headline}</span><span className="tk-ptags">{p.tags.slice(0, 4).map((t) => <span key={t}>{t}</span>)}</span></span>
            <span className="tk-pk"><Icon name={p.icon} /><span data-edit={`project:${p.slug}:kind`}>{p.kind}</span></span>
            <svg className="tk-fm" viewBox="0 0 8 5" shapeRendering="crispEdges" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: fmap(p.slug) }} />
            <span className="tk-go" aria-hidden="true"><Icon name="arrow-up-right" /></span>
          </a>
        </li>
      ))}
    </ol>
  );
}

/** Experience: roles with a date column, then the degree. */
function Experience({ content: C }: SectionProps) {
  return (
    <>
      <ol className="tk-roles">
        {C.experience.map((x) => (
          <li className="tk-role" id={`experience-${x.slug}`} key={x.slug} data-tk="role">
            <p className="tk-when"><b data-edit={`role:${x.slug}:when`}>{x.when}</b><span data-edit={`role:${x.slug}:where`}>{x.where}</span></p>
            <div className="tk-rb"><h3 data-edit={`role:${x.slug}:role`}>{x.role}</h3><p className="tk-org" data-edit={`role:${x.slug}:org`}>{x.org}</p>
              <ul>{x.desc.map((d, i) => <li key={i} data-edit={`role:${x.slug}:desc.${i}`}>{d}</li>)}</ul>
              <p className="tk-tags">{x.tags.map((t) => <span key={t}>{t}</span>)}</p></div>
          </li>
        ))}
      </ol>
      <div className="tk-edu" id="education" data-tk="school">
        {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size logo from content */}
        <img src={logoSrc(C.education.logo)} alt={C.education.school} width={56} height={56} loading="lazy" decoding="async" />
        <div><h3 data-edit="edu:school">{C.education.school}</h3><p data-edit="edu:degree">{C.education.degree}</p><p className="tk-edu-m"><EduMeta e={C.education} /></p></div>
      </div>
    </>
  );
}

const SKIN: Skin = {
  id: "tracker",
  rootClass: "tk",
  labels: { play: "Test set" },
  sectionClass: (id) => (id === "contact" ? "tk-sec tk-contact" : "tk-sec"),
  Title,
  NameFx: Name,
  sections: { work: Work, experience: Experience },
};

/** The whole Tracker site: the shared layout watched by a small vision model. */
export default function Tracker({ content }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  useTrackerMotion(root);
  const hero = (
    <>
      <div className="tk-hud" aria-hidden="true">
        <span className="tk-hud-st"><i /><b data-tk-state="">tracking</b></span>
        <span className="tk-hud-x"><b data-tk-fps="">60.0</b> fps</span>
        <span className="tk-hud-x">f <b data-tk-frame="">000000</b></span>
        <span>obj <b data-tk-obj="">0</b></span>
      </div>
      <figure className="tk-feed" aria-hidden="true">
        <figcaption className="tk-feed-bar"><span><i className="tk-rec" />cam0</span><span>depth + segmentation</span><span className="tk-feed-r">subjects 1</span></figcaption>
        <div className="tk-view">
          <div className="tk-gl" id="tk-gl" />
          <span className="tk-tick tl" /><span className="tk-tick tr" /><span className="tk-tick bl" /><span className="tk-tick br" />
        </div>
        <div className="tk-feed-foot"><span>near</span><i className="tk-ramp" /><span>far</span></div>
      </figure>
    </>
  );
  return (
    <SiteLayout content={content} skin={SKIN} rootRef={root} hero={hero}>
      <ShaderCanvas spec={META.shader} dark={META.dark} />
      {/* the vision layer: a fixed pool of boxes and glitch slices, positioned by transforms only */}
      <div className="tk-ov" aria-hidden="true">
        {Array.from({ length: MAX_BOXES }, (_, i) => (
          <div className="tk-box" key={i}>
            <i className="tk-e" /><i className="tk-e" /><i className="tk-e tk-ev" /><i className="tk-e tk-ev" />
            <i className="tk-c tk-c1" /><i className="tk-c tk-c2" /><i className="tk-c tk-c3" /><i className="tk-c tk-c4" />
            <span className="tk-lbl"><b /><span /></span>
          </div>
        ))}
        {SLICE_COLORS.map((k) => <i className="tk-slice" key={k} style={{ ["--k" as string]: k }} />)}
      </div>
      <svg className="tk-flow" aria-hidden="true" focusable="false"><path /></svg>
    </SiteLayout>
  );
}
