"use client";
// Stipple: a hand-printed pamphlet that breathes (port of docs/mockups/v7/themes/stipple.js; see designs/PORTING.md).
// Where each effect lives: the shader cloud is full on the cover and thins per chapter, knocked out behind every
// reading block by paper plates; the square lens is only on the cover name (idle drift) and dispatch plates (hover);
// SVG stipple filters touch display type only. html.lite and reduced motion switch the lens, drift, seal spin,
// pulse and every filter off, leaving a crisp two-ink letterpress still.
import { Fragment, useRef, type SyntheticEvent } from "react";
import type { DesignProps } from "@/lib/designs/types";
import { designById } from "@/lib/designs/registry";
import { PLAY } from "@/lib/play/games";
import { countWord } from "@/lib/words";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import Clock from "@/components/site/Clock";
import Portrait from "@/components/site/portrait/Portrait";
import Mark from "@/components/site/mark/Mark";
import KnowledgeGraph from "@/components/site/graph/KnowledgeGraph";
import { Icon, Logo } from "@/components/site/Glyph";
import { ART, GOOD, readSecs } from "./art";
import { DEFS } from "./defs";
import { useStippleMotion } from "./motion";
import "./stipple.css";
import IAmRithvik from "@/components/site/IAmRithvik";
import EduMeta from "@/components/site/EduMeta";

const META = designById("stipple")!;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
const TOC = [["Foreword", "about"], ["Dispatches", "work"], ["Errata", "experience"], ["The map", "graph"], ["Correspondence", "questions"], ["Supplement", "play"], ["The seal", "contact"]];
const PLACE_KEY: Record<string, string> = { home: "home", school: "school", now: "here now" };
const pad = (i: number) => String(i + 1).padStart(2, "0");
const logoSrc = (l: string) => (/^(\/|https?:)/.test(l) ? l : `/images/${l}`); // content stores the bare file name

const SCISSORS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.6 7.6 20 18M8.6 16.4 20 6"/></svg>`;

/** A chapter header: stippled roman numeral, title, folio. */
function Chapter({ n, id, title, folio, plate }: { n: number; id: string; title: string; folio: number; plate?: boolean }) {
  return (
    <header className={`st-chh${plate ? "" : " st-plate-sm"}`}>
      <span className="st-rom" aria-hidden="true">{ROMAN[n]}</span><h2 id={id}>{title}</h2><span className="st-folio">— {folio} —</span>
    </header>
  );
}

/** The whole Stipple site. */
export default function Stipple({ content: C }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  useStippleMotion(root);
  const nameInner = <><span className="st-n1">{C.first}</span><span className="st-n2"><i>Praveen</i> Kumar</span></>;
  // one letter open at a time, like turning one envelope at a time
  const oneOpen = (e: SyntheticEvent<HTMLDetailsElement>) => {
    const d = e.currentTarget;
    if (d.open) d.parentElement?.querySelectorAll("details").forEach((o) => { if (o !== d) o.open = false; });
  };
  const n = countWord(C.projects.length);

  return (
    <main className="stage" id="stage" tabIndex={-1}>
      {/* before the page so its fixed layer paints beneath the type (same z-index, tree order wins) */}
      <ShaderCanvas spec={META.shader} dark={META.dark} />
      <div className="st" ref={root}>
        <svg className="st-defs" width="0" height="0" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: DEFS }} />

        <header className="st-mast" aria-label="Masthead">
          <span className="st-mast-l">Issue No. 06 <span className="st-sep">·</span> price: one email</span>
          <a className="st-mast-c" href="#top" aria-label="rithvik.ai, back to the cover"><span className="st-mark" aria-hidden="true"><Mark kind="hatch" label="" /></span><span>rithvik.ai</span></a>
          <span className="st-mast-r"><Clock tz={C.now.tz} className="" /> <span className="st-sep">·</span> {C.now.city}</span>
          <IAmRithvik className="st-iam" />
        </header>

        <section id="top" className="st-cover" aria-labelledby="st-name-h">
          <span className="st-reg st-reg-tl" aria-hidden="true" /><span className="st-reg st-reg-tr" aria-hidden="true" />
          <p className="st-kick">A pamphlet in {n.toLowerCase()} dispatches</p>
          <div className="st-head">
            <div className="st-name" data-lens data-lens-idle>
              <h1 className="st-name-base" id="st-name-h" aria-label={C.name}>{nameInner}</h1>
              <div className="st-name-crisp" aria-hidden="true">{nameInner}</div>
              <span className="st-lens-frame" aria-hidden="true"><i /><b className="st-lens-xy">x 000 · y 000</b></span>
            </div>
            <p className="st-status"><span className="st-pulse" aria-hidden="true" /><span data-edit="v7.status">{C.status}</span></p>
          </div>
          <p className="st-thesis">{C.thesis.map((t, i) => <Fragment key={i}>{i > 0 && <span aria-hidden="true"> ⁂ </span>}<span data-edit={`v7.thesis.${i}`}>{t}</span></Fragment>)}</p>

          <div className="st-cover-row">
            <div className="st-cover-l">
              <p className="st-role"><i data-edit="v7.role">{C.role}</i></p>
              <p className="st-line" data-edit="v7.line">{C.line}</p>
              <nav className="st-acts" aria-label="Act">
                <a href="#" className="st-a st-a-solid" data-resume=""><Icon name="file-text" /><span>Read the resume</span></a>
                <span className="st-acts-2">
                  <a href="#" className="st-a" data-compose=""><Icon name="mail" /><span>Write to me</span></a>
                  <a href="#" className="st-a" data-agent=""><Icon name="terminal" /><span>Ask the agent</span></a>
                </span>
              </nav>
            </div>
            <div className="st-front">
              <div className="st-pt"><Portrait id="stipple" /></div>
              <p className="st-cap"><span>Plate I</span> A photograph, left unstippled</p>
            </div>
          </div>
          <span className="st-reg st-reg-bl" aria-hidden="true" /><span className="st-reg st-reg-br" aria-hidden="true" />
        </section>

        <nav className="st-contents st-plate" aria-label="Contents">
          <span className="st-device" aria-hidden="true"><Mark label="" /></span>
          <p className="st-toc-h">In this issue</p>
          <ol className="st-toc">{TOC.map(([l, id], i) => <li key={id}><a href={`#${id}`}><span className="st-dl">{l}</span><span className="st-lead" aria-hidden="true" /><span className="st-rn">{ROMAN[i]}</span></a></li>)}</ol>
          <p className="st-toc-note">Press <kbd>T</kbd> for a different pamphlet entirely.</p>
        </nav>

        <section id="about" className="st-ch st-plate" aria-labelledby="st-h-about">
          <Chapter n={0} id="st-h-about" title="Foreword" folio={2} plate />
          <div className="st-prose">
            <p className="st-drop" data-edit="v7.about.0">{C.about[0]}</p>
            <p><span data-edit="v7.about.1">{C.about[1]}</span><span className="st-endmark" aria-hidden="true"><Mark label="" /></span></p>
          </div>
          <div className="st-now" id="now">
            <p className="st-label">On the press this season</p>
            <dl>
              <div><dt>Building</dt><dd data-edit="v7.now.building">{C.now.building}</dd></div>
              <div><dt>Researching</dt><dd data-edit="v7.now.researching">{C.now.researching}</dd></div>
              <div><dt>Learning</dt><dd data-edit="v7.now.learning">{C.now.learning}</dd></div>
            </dl>
            <ul className="st-places" aria-label="Places">
              {C.places.map((p) => <li key={p.key} className={`st-place st-place-${p.key}`}><span className="st-pk">{PLACE_KEY[p.key] ?? p.key}</span><b>{p.city}</b><Clock tz={p.tz} className="st-clk" /></li>)}
            </ul>
          </div>
        </section>

        <section className="st-ch st-figs-sec" aria-label="Figures">
          <ol className="st-figs">{C.numbers.map(([v, l], i) => <li className="st-plate-sm" key={l}><span className="st-fig-n">Fig. {i + 1}</span><b data-edit={`numbers.${i}.v`}>{v}</b><span data-edit={`numbers.${i}.l`}>{l}</span></li>)}</ol>
        </section>

        <section id="work" className="st-ch st-wide" aria-labelledby="st-h-work">
          <Chapter n={1} id="st-h-work" title="Dispatches" folio={3} />
          <p className="st-dek st-plate-sm">{n} reports from the bench, from headsets to the cloud.</p>
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
        </section>

        <section id="experience" className="st-ch" aria-labelledby="st-h-exp">
          <Chapter n={2} id="st-h-exp" title="Errata" folio={4} />
          <div className="st-slip">
            <p className="st-slip-h"><span>Errata and appointments</span><span>insert, p. 4</span></p>
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
                <p className="st-label">Schooling</p>
                <h3 data-edit="edu:school">{C.education.school}</h3>
                <p data-edit="edu:degree">{C.education.degree}</p>
                <p className="st-er-tags"><EduMeta e={C.education} /></p>
              </div>
            </div>
          </div>
        </section>

        <section id="graph" className="st-ch st-wide st-map-sec" aria-labelledby="st-h-map">
          <Chapter n={3} id="st-h-map" title="The map" folio={5} />
          <p className="st-dek st-plate-sm">Everything above, folded into one sheet. Press a point to read it.</p>
          <div className="st-foldout">
            <p className="st-fold-h"><span>Fold-out map</span><span>not to scale</span></p>
            <KnowledgeGraph id="stipple" />
          </div>
        </section>

        <section id="questions" className="st-ch st-plate" aria-labelledby="st-h-faq">
          <Chapter n={4} id="st-h-faq" title="Correspondence" folio={6} plate />
          <div className="st-letters">
            {C.faq.map(([q, a], i) => (
              <details className="st-letter" key={q} onToggle={oneOpen}><summary><span className="st-q" data-edit={`faq.${i}.q`}>{q}</span><span className="st-plus" aria-hidden="true" /></summary><p data-edit={`faq.${i}.a`}>{a}</p></details>
            ))}
          </div>
        </section>

        <section id="play" className="st-ch st-wide" aria-labelledby="st-h-play">
          <Chapter n={5} id="st-h-play" title="Supplement" folio={7} />
          <p className="st-dek st-plate-sm">Cut along the dotted line. Every coupon is redeemable.</p>
          <div className="st-coupons">
            {PLAY.map((p, i) => (
              <button type="button" className="st-cp" key={p.id} data-play={p.id} aria-label={`${p.name}: ${p.desc}`}>
                <span className="st-cp-track" aria-hidden="true"><span className="st-cp-scis" dangerouslySetInnerHTML={{ __html: SCISSORS }} /></span>
                <span className="st-cp-main">
                  <span className="st-cp-top"><b>Coupon {pad(i)}</b><span>{GOOD[p.id] ?? "Good for one go"}</span></span>
                  <span className="st-cp-t">{p.name}</span>
                  <span className="st-cp-d">{p.desc}</span>
                </span>
                <span className="st-cp-stub"><span className="st-cp-ic"><Icon name={p.icon} /></span><span>Redeem</span></span>
              </button>
            ))}
          </div>
          <p className="st-fine st-plate-sm">No cash value. Void where boring. One per visitor, or as many as you like.</p>
        </section>

        <section id="contact" className="st-ch st-seal-sec" aria-labelledby="st-h-contact">
          <Chapter n={6} id="st-h-contact" title="The seal" folio={8} />
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
          <p className="st-seal-note st-plate-sm">Press the seal. It goes straight to my inbox.</p>
          <ul className="st-links st-plate-sm">
            <li><a href="#" data-copy={C.links.email}><Icon name="mail" /><span>{C.links.email}</span></a></li>
            <li><a href={C.links.github} target="_blank" rel="noopener"><Logo slug="github" /><span>GitHub</span></a></li>
            <li><a href={C.links.linkedin} target="_blank" rel="noopener"><Logo slug="linkedin" /><span>LinkedIn</span></a></li>
            <li><a href="#" data-resume=""><Icon name="file-text" /><span>Resume</span></a></li>
          </ul>
        </section>

        <footer className="st-colo st-plate" id="colophon" aria-labelledby="st-h-colo">
          <span className="st-colo-mark" aria-hidden="true"><Mark label="" /></span>
          <h2 id="st-h-colo">Colophon</h2>
          <p>Set in Instrument Serif and Martian Mono. Two inks on peach stock, with a trace of blue where your pointer breathes. The cloud is one fragment shader stippling noise in real time; the photograph is never touched.</p>
          <div className="st-bars" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <p className="st-label">Printing history</p>
          <ol className="st-log">{C.log.map(([d, k, m]) => <li key={d + k + m}><span>{d}</span><span className="st-log-k">{k}</span><span>{m}</span></li>)}</ol>
          <p className="st-imprint">{C.name} <span className="st-sep">·</span> the ink may still be wet <span className="st-sep">·</span> <a href="#top">back to the cover</a> <span className="st-sep">·</span><a className="foot-status" href="/status">Status</a></p>
        </footer>
      </div>
    </main>
  );
}
