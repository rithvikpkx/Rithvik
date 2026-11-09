"use client";
// Tracker: a calm light lab UI watched by a small vision model (port of docs/mockups/v7/themes/tracker.js;
// see designs/PORTING.md). Where each effect lives: the depth/segmentation shader only inside the hero cam0
// feed (the one loud place); DOM bounding boxes that acquire real page elements (the person, the name,
// buttons, project rows, graph nodes, toys) and hand over to whatever the pointer hovers; optical-flow
// arrows only while scrolling fast; a HUD in the nav with real numbers. html.lite and reduced motion stop
// the loop; lite swaps the boxes for a few static CSS annotations (a designed still).
import { useRef } from "react";
import type { DesignProps } from "@/lib/designs/types";
import { designById } from "@/lib/designs/registry";
import { PLAY } from "@/lib/play/games";
import { countWord } from "@/lib/words";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import Portrait from "@/components/site/portrait/Portrait";
import Mark from "@/components/site/mark/Mark";
import KnowledgeGraph from "@/components/site/graph/KnowledgeGraph";
import Clock from "@/components/site/Clock";
import { Icon, Logo } from "@/components/site/Glyph";
import { TOY_LBL, fmap, pad, projLabel } from "./vision";
import { MAX_BOXES, SLICE_COLORS, useTrackerMotion } from "./motion";
import "./tracker.css";

const META = designById("tracker")!;
const PLACE_LABEL: Record<string, string> = { home: "Home", school: "School", now: "Now" };
const logoSrc = (l: string) => (/^(\/|https?:)/.test(l) ? l : `/images/${l}`); // content stores the bare file name

/** A numbered section header; the heading is a "text" target for the tracker. */
function Sh({ n, k, title, sub, id }: { n: number; k: string; title: string; sub?: string; id: string }) {
  return (
    <header className="tk-sh">
      <p className="tk-k"><span>{pad(n)}</span>{k}</p>
      <h2 className="tk-h2" id={id} data-tk="text" data-tk-label="heading">{title}</h2>
      {sub && <p className="tk-sub">{sub}</p>}
    </header>
  );
}

/** The whole Tracker site. */
export default function Tracker({ content: C }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  useTrackerMotion(root);

  return (
    <main className="stage" id="stage" tabIndex={-1}>
      <div className="tk" ref={root}>
        <header className="tk-nav">
          <a className="tk-logo" href="#top" aria-label={`${C.name}, back to top`}><Mark label="" /><span>rithvik.ai</span></a>
          <nav className="tk-links" aria-label="Sections">
            <a href="#work"><i>02</i>Work</a><a href="#graph"><i>03</i>Graph</a><a href="#experience"><i>04</i>Experience</a><a href="#about"><i>05</i>About</a><a href="#play"><i>06</i>Play</a><a href="#contact"><i>08</i>Contact</a>
          </nav>
          <div className="tk-hud" aria-hidden="true">
            <span className="tk-hud-st"><i /><b data-tk-state="">tracking</b></span>
            <span className="tk-hud-x"><b data-tk-fps="">60.0</b> fps</span>
            <span className="tk-hud-x">f <b data-tk-frame="">000000</b></span>
            <span>obj <b data-tk-obj="">0</b></span>
            <span className="tk-hud-m">rvk-track v0.7</span>
          </div>
          <a className="tk-btn tk-btn-ink tk-nav-cta" href="#" data-resume=""><Icon name="file-text" />Resume</a>
        </header>

        <section className="tk-hero" id="top" aria-labelledby="tk-h1">
          <div className="tk-hero-txt">
            <p className="tk-k"><span>01</span>{C.role}</p>
            <h1 className="tk-name" id="tk-h1" data-tk="text" data-tk-label="name" data-tk-static="name 0.99">{C.first}<br /><span>{C.last}</span></h1>
            <p className="tk-lede">{C.line}</p>
            <p className="tk-status"><i className="tk-dot" aria-hidden="true" />{C.status}</p>
            <div className="tk-acts">
              <a className="tk-btn tk-btn-ink" href="#" data-resume="" data-tk="cta" data-tk-static="cta 0.94"><Icon name="file-text" />Resume</a>
              <button type="button" className="tk-btn" data-compose="Internship opportunity" data-tk="cta"><Icon name="mail" />Email me</button>
              <button type="button" className="tk-btn tk-btn-ghost" data-agent="" data-tk="cta"><span className="tk-prompt" aria-hidden="true">❯</span>Ask my agent</button>
            </div>
          </div>
          <figure className="tk-feed">
            <figcaption className="tk-feed-bar"><span><i className="tk-rec" aria-hidden="true" />cam0</span><span>depth + segmentation</span><span className="tk-feed-r">subjects 1</span></figcaption>
            <div className="tk-view">
              <div className="tk-gl" id="tk-gl" aria-hidden="true" />
              <span className="tk-tick tl" aria-hidden="true" /><span className="tk-tick tr" aria-hidden="true" /><span className="tk-tick bl" aria-hidden="true" /><span className="tk-tick br" aria-hidden="true" />
              <span className="tk-cross" aria-hidden="true" />
              <div className="tk-subject">
                <Portrait id="tracker" className="tk-pt" />
                <i className="tk-face" data-tk-static="person 0.97" aria-hidden="true" />
              </div>
            </div>
            <div className="tk-feed-foot" aria-hidden="true"><span>near</span><i className="tk-ramp" /><span>far</span></div>
          </figure>
        </section>

        <section className="tk-readout" aria-label="In numbers">
          <dl className="tk-nums">{C.numbers.map(([n, l]) => <div key={l} data-tk="metric"><dt>{n}</dt><dd>{l}</dd></div>)}</dl>
        </section>

        <section className="tk-sec" id="work" aria-labelledby="tk-h-work">
          <Sh n={2} k="Work" title={`${countWord(C.projects.length)} things I've built`} sub="From EEG headsets to the cloud. Each one opens." id="tk-h-work" />
          <ol className="tk-projects">
            {C.projects.map((p, i) => (
              <li key={p.slug}>
                <a className="tk-proj" id={`project-${p.slug}`} href={`/work/${p.slug}`} data-case={p.slug} data-tk="project" data-tk-static={projLabel(p.slug)} aria-label={`${p.title}: ${p.headline}. Open the case`}>
                  <span className="tk-pn">{pad(i + 1)}</span>
                  <span className="tk-pb"><b className="tk-pt-t">{p.title}</b><span className="tk-ph">{p.headline}</span><span className="tk-ptags">{p.tags.slice(0, 4).map((t) => <span key={t}>{t}</span>)}</span></span>
                  <span className="tk-pk"><Icon name={p.icon} />{p.kind}</span>
                  <svg className="tk-fm" viewBox="0 0 8 5" shapeRendering="crispEdges" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: fmap(p.slug) }} />
                  <span className="tk-go" aria-hidden="true"><Icon name="arrow-up-right" /></span>
                </a>
              </li>
            ))}
          </ol>
        </section>

        <section className="tk-sec" id="graph" aria-labelledby="tk-h-graph">
          <Sh n={3} k="Scene graph" title="Everything on record, connected" sub="Projects, roles, skills and places as one graph. Hover a node to trace it; click to open it." id="tk-h-graph" />
          <div className="tk-pane tk-graph"><KnowledgeGraph id="tracker" /></div>
        </section>

        <section className="tk-sec" id="experience" aria-labelledby="tk-h-exp">
          <Sh n={4} k="Experience" title="Where I've worked" id="tk-h-exp" />
          <ol className="tk-roles">
            {C.experience.map((x) => (
              <li className="tk-role" id={`experience-${x.slug}`} key={x.slug} data-tk="role">
                <p className="tk-when"><b>{x.when}</b><span>{x.where}</span></p>
                <div className="tk-rb"><h3>{x.role}</h3><p className="tk-org">{x.org}</p>
                  <ul>{x.desc.map((d, i) => <li key={i}>{d}</li>)}</ul>
                  <p className="tk-tags">{x.tags.map((t) => <span key={t}>{t}</span>)}</p></div>
              </li>
            ))}
          </ol>
          <div className="tk-edu" id="education" data-tk="school">
            {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size logo from content */}
            <img src={logoSrc(C.education.logo)} alt={C.education.school} width={56} height={56} loading="lazy" decoding="async" />
            <div><p className="tk-k tk-k-s">Education</p><h3>{C.education.school}</h3><p>{C.education.degree}</p><p className="tk-edu-m">{[C.education.focus, C.education.grad].filter(Boolean).join(" · ")}</p></div>
          </div>
        </section>

        <section className="tk-sec" id="about" aria-labelledby="tk-h-about">
          <Sh n={5} k="About" title={`Hi, I'm ${C.first}.`} id="tk-h-about" />
          <div className="tk-about">
            <div className="tk-about-txt">{C.about.map((a, i) => <p key={i}>{a}</p>)}
              <ul className="tk-thesis">{C.thesis.map((t, i) => <li key={i}><span>{pad(i + 1)}</span>{t}</li>)}</ul>
            </div>
            <aside className="tk-pane tk-now" id="now" aria-label="Right now">
              <p className="tk-pane-h"><span>now</span><span><Clock tz={C.now.tz} className="tk-clock" /></span></p>
              <dl className="tk-kv">
                <div><dt>Building</dt><dd>{C.now.building}</dd></div>
                <div><dt>Researching</dt><dd>{C.now.researching}</dd></div>
                <div><dt>Learning</dt><dd>{C.now.learning}</dd></div>
              </dl>
              <p className="tk-pane-h tk-pane-h2"><span>places</span></p>
              <ol className="tk-places">{C.places.map((pl) => <li key={pl.key} className={pl.key === "now" ? "is-now" : ""}><span className="tk-pl-k">{PLACE_LABEL[pl.key] ?? pl.key}</span><b>{pl.city}</b><span><Clock tz={pl.tz} className="tk-clock" /></span></li>)}</ol>
            </aside>
          </div>
          <div className="tk-stack" aria-label="Stack">
            {Object.entries(C.stack).map(([k, v]) => <div className="tk-stack-row" key={k}><p>{k}</p><p className="tk-tags">{v.map((t) => <span key={t}>{t}</span>)}</p></div>)}
          </div>
        </section>

        <section className="tk-sec" id="play" aria-labelledby="tk-h-play">
          <Sh n={6} k="Play" title="The test set" sub={`${countWord(PLAY.length)} small toys. The games keep my score next to yours. The model has opinions about each one.`} id="tk-h-play" />
          <ul className="tk-toys">
            {PLAY.map((t, i) => (
              <li key={t.id}>
                <button type="button" className="tk-toy" data-play={t.id} data-tk="toy" data-tk-label={TOY_LBL[t.id] ?? "toy"} aria-label={`Play ${t.name}: ${t.desc}`}>
                  <span className="tk-toy-img" aria-hidden="true"><span className="tk-toy-ic"><Icon name={t.icon} /></span><span className="tk-toy-f">sample_{pad(i + 1, 3)}.png</span></span>
                  <span className="tk-toy-t"><b>{t.name}</b><span>{t.desc}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {C.faq.length > 0 && (
          <section className="tk-sec" id="questions" aria-labelledby="tk-h-faq">
            <Sh n={7} k="Questions" title="Short answers" sub="Anything else, ask my agent. It only answers from what's on record." id="tk-h-faq" />
            <div className="tk-qs">
              {C.faq.map(([q, a]) => <details className="tk-q" key={q}><summary>{q}<i aria-hidden="true" /></summary><p>{a}</p></details>)}
            </div>
          </section>
        )}

        <section className="tk-sec tk-contact" id="contact" aria-labelledby="tk-h-contact">
          <p className="tk-k"><span>08</span>Contact</p>
          <h2 className="tk-big" id="tk-h-contact" data-tk="text" data-tk-label="greeting">Say hello.</h2>
          <p className="tk-sub">Open to SWE and AI internships. The message goes straight to my inbox.</p>
          <div className="tk-acts">
            <button type="button" className="tk-btn tk-btn-ink tk-btn-lg" data-compose="Internship opportunity" data-tk="cta"><Icon name="mail" />Write an email</button>
            <button type="button" className="tk-btn" data-copy={C.links.email} data-tk="cta" data-tk-label="address"><Icon name="copy" />{C.links.email}</button>
          </div>
          <ul className="tk-links2">
            <li><a href={C.links.github} target="_blank" rel="noopener"><Logo slug="github" />GitHub</a></li>
            <li><a href={C.links.linkedin} target="_blank" rel="noopener"><Logo slug="linkedin" />LinkedIn</a></li>
            <li><a href="#" data-resume=""><Icon name="file-text" />Resume</a></li>
            <li><a href="#" data-agent=""><Icon name="terminal" />Agent</a></li>
          </ul>
        </section>

        <footer className="tk-foot" id="colophon">
          <span className="tk-foot-mark" data-tk="ouroboros" data-tk-label="ouroboros"><Mark label="" /></span>
          <p className="tk-foot-n">{C.name}</p>
          <p className="tk-colo">The depth map is one fragment shader. The boxes are plain DOM, eased with a little lag like a real tracker. The photo is never touched. Set in Inter Tight and JetBrains Mono.</p>
        </footer>

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
      </div>
      <ShaderCanvas spec={META.shader} dark={META.dark} />
    </main>
  );
}
