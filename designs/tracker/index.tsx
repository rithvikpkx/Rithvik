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
import Clock from "@/components/site/Clock";
import { Icon } from "@/components/site/Glyph";
import { fmap, pad, projLabel } from "./vision";
import { MAX_BOXES, SLICE_COLORS, useTrackerMotion } from "./motion";
import { XP } from "./experience";
import "./tracker.css";

const META = designById("tracker")!;
const PLACE_LABEL: Record<string, string> = { home: "Home", school: "School", now: "Now" };

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


/** About: the text and thesis beside a "now" pane, then the numbers and the stack. */
function About({ content: C }: SectionProps) {
  return (
    <>
      <div className="tk-about">
        <div className="tk-about-txt">{C.about.map((a, i) => <p key={i} data-edit={`v7.about.${i}`}>{a}</p>)}
          <ul className="tk-thesis">{C.thesis.map((t, i) => <li key={i}><span>{pad(i + 1)}</span><span data-edit={`v7.thesis.${i}`}>{t}</span></li>)}</ul>
        </div>
        <aside className="tk-pane tk-now" id="now" aria-label="Right now">
          <p className="tk-pane-h"><span>now</span><span><Clock tz={C.now.tz} className="tk-clock" /></span></p>
          <dl className="tk-kv">
            <div><dt>Building</dt><dd data-edit="v7.now.building">{C.now.building}</dd></div>
            <div><dt>Researching</dt><dd data-edit="v7.now.researching">{C.now.researching}</dd></div>
            <div><dt>Learning</dt><dd data-edit="v7.now.learning">{C.now.learning}</dd></div>
          </dl>
          <p className="tk-pane-h tk-pane-h2"><span>places</span></p>
          <ol className="tk-places">{C.places.map((pl) => <li key={pl.key} className={pl.key === "now" ? "is-now" : ""}><span className="tk-pl-k">{PLACE_LABEL[pl.key] ?? pl.key}</span><b>{pl.city}</b><span><Clock tz={pl.tz} className="tk-clock" /></span></li>)}</ol>
        </aside>
      </div>
      <dl className="tk-nums">{C.numbers.map(([n, l], i) => <div key={l} data-tk="metric"><dt data-edit={`numbers.${i}.v`}>{n}</dt><dd data-edit={`numbers.${i}.l`}>{l}</dd></div>)}</dl>
      <div className="tk-stack" aria-label="Stack">
        {Object.entries(C.stack).map(([k, v]) => <div className="tk-stack-row" key={k}><p>{k}</p><p className="tk-tags">{v.map((t) => <span key={t}>{t}</span>)}</p></div>)}
      </div>
    </>
  );
}

/** Questions: short answers. */
function Questions({ content: C }: SectionProps) {
  return <div className="tk-qs">{C.faq.map(([q, a], i) => <details className="tk-q" key={q}><summary><span data-edit={`faq.${i}.q`}>{q}</span><i aria-hidden="true" /></summary><p data-edit={`faq.${i}.a`}>{a}</p></details>)}</div>;
}

/** Contact: one line and the composer. */
function Contact() {
  return (
    <>
      <p className="tk-big" data-tk="text" data-tk-label="greeting">Say hello.</p>
      <div className="tk-acts"><button type="button" className="tk-btn tk-btn-ink tk-btn-lg" data-compose="Internship opportunity" data-tk="cta"><Icon name="mail" />Write an email</button></div>
    </>
  );
}

const SKIN: Skin = {
  id: "tracker",
  ...XP,
  rootClass: "tk",
  labels: { play: "Test set" },
  sectionClass: (id) => (id === "contact" ? "tk-sec tk-contact" : "tk-sec"),
  Title,
  NameFx: Name,
  sections: { work: Work, about: About, questions: Questions, contact: Contact },
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
