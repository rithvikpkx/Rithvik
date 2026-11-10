"use client";
import type { ComponentType } from "react";
import type { SectionId, SectionProps } from "@/lib/designs/skin";
import { Icon } from "@/components/site/Glyph";
import Mark from "@/components/site/mark/Mark";
import Clock from "@/components/site/Clock";
import { PLAY } from "@/lib/play/games";
import Experience from "./Experience";

const PLACE_LABEL = { home: "Home", school: "School", now: "Now" } as const;

/** Projects as type-led cards; each opens the case sheet (the href is the no-JS fallback). */
function Work({ content: c }: SectionProps) {
  return (
    <ul className="ly-grid">
      {c.projects.map((p, i) => (
        <li key={p.slug} id={`project-${p.slug}`} className={i === 0 ? "feat" : i < 3 ? "side" : undefined}>
          <a className="ly-card" href={`/work/${p.slug}`} data-case={p.slug}>
            <div className="ly-card-top">
              <span className="ly-ic"><Icon name={p.icon} /></span>
              <span className="ly-kind" data-edit={`project:${p.slug}:kind`}>{p.kind}</span>
            </div>
            <div>
              <h3 className="ly-card-title" data-edit={`project:${p.slug}:headline`}>{p.headline}</h3>
              <span className="ly-card-ctx"><span data-edit={`project:${p.slug}:title`}>{p.title}</span>{p.ctx && <> · <span data-edit={`project:${p.slug}:ctx`}>{p.ctx}</span></>}</span>
              {p.tags.length > 0 && <span className="chips">{p.tags.map((t) => <span key={t} className="chip">{t}</span>)}</span>}
            </div>
            <Mark kind="hatch" label="" className="ly-card-mark" />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** About text beside where he is now (live clock) and what he is on, then the numbers. */
function About({ content: c }: SectionProps) {
  const rows: [string, React.ReactNode][] = [
    ...c.places.map((p): [string, React.ReactNode] => [PLACE_LABEL[p.key], p.key === "now" ? <>{p.city} · <Clock tz={p.tz} className="clock" /></> : p.city]),
    ["Building", c.now.building && <span data-edit="v7.now.building">{c.now.building}</span>],
    ["Researching", c.now.researching && <span data-edit="v7.now.researching">{c.now.researching}</span>],
    ["Learning", c.now.learning && <span data-edit="v7.now.learning">{c.now.learning}</span>],
  ];
  return (
    <>
      <div className="ly-about">
        <div className="ly-about-copy">{c.about.map((p, i) => <p key={p} data-edit={`v7.about.${i}`}>{p}</p>)}</div>
        <dl className="ly-kv">{rows.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </div>
      {c.numbers.length > 0 && (
        <ul className="ly-numbers">{c.numbers.map(([v, l], i) => <li key={l}><b data-edit={`numbers.${i}.v`}>{v}</b><span data-edit={`numbers.${i}.l`}>{l}</span></li>)}</ul>
      )}
    </>
  );
}

/** One calm row of entries into the Play window. */
function Play() {
  return (
    <ul className="ly-toys">
      {PLAY.map((p) => (
        <li key={p.id}>
          <button type="button" className="ly-toy" data-play={p.id}>
            <span className="ly-ic"><Icon name={p.icon} /></span>
            <span><b>{p.name}</b><span>{p.desc}</span></span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Recruiter questions as native disclosures, plus a hand-off to the agent. */
function Questions({ content: c }: SectionProps) {
  return (
    <div className="ly-faq">
      <div><button type="button" className="ly-btn" data-agent="">Ask something else<kbd>⌘K</kbd></button></div>
      <div className="ly-faq-list">
        {c.faq.map(([q, a], i) => (
          <details key={q}>
            <summary><span data-edit={`faq.${i}.q`}>{q}</span><span className="ly-plus" aria-hidden="true" /></summary>
            <p data-edit={`faq.${i}.a`}>{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

/** The address itself; it opens the composer (mailto is the no-JS fallback). */
function Contact({ content: c }: SectionProps) {
  return <p className="ly-email"><a href={`mailto:${c.links.email}`} data-compose="">{c.links.email}</a></p>;
}

/** The shared default body for every section. */
export const DEFAULT_SECTIONS: Record<SectionId, ComponentType<SectionProps>> = {
  work: Work, experience: Experience, about: About, play: Play, questions: Questions, contact: Contact,
};
