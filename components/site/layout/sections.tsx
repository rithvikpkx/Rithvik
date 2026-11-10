"use client";
import type { ComponentType } from "react";
import type { SectionId, SectionProps } from "@/lib/designs/skin";
import { Icon } from "@/components/site/Glyph";
import Mark from "@/components/site/mark/Mark";
import Experience from "./Experience";
import About from "./About";
import Questions from "./Questions";
import Contact from "./Contact";
import PlayField from "@/components/site/play/PlayField";

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

/** The shared default body for every section. */
export const DEFAULT_SECTIONS: Record<SectionId, ComponentType<SectionProps>> = {
  work: Work, experience: Experience, about: About, play: PlayField, questions: Questions, contact: Contact,
};
