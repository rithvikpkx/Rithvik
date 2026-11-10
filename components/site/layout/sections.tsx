"use client";
import { Fragment, type ComponentType } from "react";
import Image from "next/image";
import type { SectionId, SectionProps } from "@/lib/designs/skin";
import { Icon } from "@/components/site/Glyph";
import Clock from "@/components/site/Clock";
import { PLAY } from "@/lib/play/games";
import Work from "@/components/site/work/Work";

const PLACE_LABEL = { home: "Home", school: "School", now: "Now" } as const;

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
