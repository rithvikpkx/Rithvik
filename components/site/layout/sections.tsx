"use client";
import { Fragment, type ComponentType } from "react";
import Image from "next/image";
import type { SectionId, SectionProps } from "@/lib/designs/skin";
import { Icon } from "@/components/site/Glyph";
import Mark from "@/components/site/mark/Mark";
import About from "./About";
import Questions from "./Questions";
import Contact from "./Contact";
import { PLAY } from "@/lib/play/games";

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

/** Roles as hairline rows (native disclosure, works without JS), joined by the skin's connector, then education
 *  (the skin's education object when it has one). */
function Experience({ content: c, skin }: SectionProps) {
  const e = c.education, Link = skin.ExperienceConnector, Edu = skin.EducationObject;
  return (
    <>
      <ul className="ly-ledger">
        {c.experience.map((r, i) => (
          <Fragment key={r.slug}>
            <li id={`experience-${r.slug}`}>
              <details className="ly-row">
                <summary>
                  <span className="ly-when" data-edit={`role:${r.slug}:when`}>{r.when}</span>
                  <span className="ly-what"><b data-edit={`role:${r.slug}:role`}>{r.role}</b>{r.org && <span data-edit={`role:${r.slug}:org`}>{r.org}</span>}</span>
                  {r.where && <span className="ly-where" data-edit={`role:${r.slug}:where`}>{r.where}</span>}
                  <span className="ly-plus" aria-hidden="true" />
                </summary>
                {(r.desc.length > 0 || r.tags.length > 0) && (
                  <div className="ly-row-body">
                    {r.desc.length > 0 && <ul className="ly-bullets">{r.desc.map((d, j) => <li key={d} data-edit={`role:${r.slug}:desc.${j}`}>{d}</li>)}</ul>}
                    {r.tags.length > 0 && <span className="chips">{r.tags.map((t) => <span key={t} className="chip">{t}</span>)}</span>}
                  </div>
                )}
              </details>
            </li>
            {Link && i < c.experience.length - 1 && <li className="ly-link" aria-hidden="true"><Link index={i} count={c.experience.length} /></li>}
          </Fragment>
        ))}
      </ul>
      {e.school && (Edu ? <div id="education"><Edu education={e} /></div> : (
        <div className="ly-edu" id="education">
          {e.logo && <Image src={/^(\/|https?:)/.test(e.logo) ? e.logo : `/images/${e.logo}`} alt="" width={36} height={36} />}
          <span className="ly-what"><b data-edit="edu:school">{e.school}</b>{e.degree && <span data-edit="edu:degree">{e.degree}</span>}</span>
          {(e.focus || e.grad) && <span className="ly-where">{e.focus && <span data-edit="edu:focus">{e.focus}</span>}{e.focus && e.grad && <br />}{e.grad && <span data-edit="edu:grad">{e.grad}</span>}</span>}
        </div>
      ))}
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

/** The shared default body for every section. */
export const DEFAULT_SECTIONS: Record<SectionId, ComponentType<SectionProps>> = {
  work: Work, experience: Experience, about: About, play: Play, questions: Questions, contact: Contact,
};
