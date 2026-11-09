"use client";
// Prism: light splitting through glass (port of docs/mockups/v7/themes/prism.js; see designs/PORTING.md).
// A quiet white optics catalogue; the trippiness is optical and lives in a few places only: the shader's
// dispersed beam (hero, fading with scroll), faint caustics (behind the Map), RGB splits on the hero name,
// scrolling headings and hovered project titles, one anaglyph heading (Play), and the dark contact room.
// html.lite and reduced motion drop the splits, blend modes and tracking, leaving a designed still.
import { useRef, useState, type SyntheticEvent } from "react";
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
import { usePrismMotion } from "./motion";
import "./prism.css";
import IAmRithvik from "@/components/site/IAmRithvik";
import EduMeta from "@/components/site/EduMeta";

const META = designById("prism")!;
// six projects, six bands of the visible spectrum (red bends least, violet most)
const BANDS = [["#FF2D3D", "650"], ["#FF7A00", "600"], ["#E8B800", "580"], ["#12B76A", "530"], ["#1E6BFF", "470"], ["#7A3CFF", "420"]];
const band = (i: number) => BANDS[i % BANDS.length];
const PLACE: Record<string, string> = { home: "Home", school: "School", now: "Now" };
const pad = (i: number) => String(i + 1).padStart(2, "0");
const logoSrc = (l: string) => (/^(\/|https?:)/.test(l) ? l : `/images/${l}`); // content stores the bare file name
const bandVar = (i: number) => ({ ["--band" as string]: band(i)[0] });

/** Text with two coloured plates behind it (data-text feeds the ::before/::after copies). */
function Ca({ txt, cls = "" }: { txt: string; cls?: string }) {
  return <span className={`pr-ca${cls ? " " + cls : ""}`} data-text={txt}>{txt}</span>;
}

/** The dark room's prism: the photographed render, with a crisp SVG fallback if the file is missing. */
function DarkArt() {
  const [ok, setOk] = useState(true);
  return (
    <div className="pr-dk-art" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative render positioned in panel units */}
      {ok && <img className="pr-dk-img" src="/v7/prism/prism-1376.webp" alt="" width={1376} height={768} loading="lazy" decoding="async" onError={() => setOk(false)} />}
      {!ok && (
        <svg className="pr-dk-svg" viewBox="0 0 600 360" focusable="false">
          <defs>
            <linearGradient id="pr-fan" x1="0" y1="0" x2="0" y2="1">{BANDS.map(([c], i) => <stop key={c} offset={(i / 5).toFixed(2)} stopColor={c} />)}</linearGradient>
            <linearGradient id="pr-fan-fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="1" /><stop offset="1" stopColor="#fff" stopOpacity=".25" /></linearGradient>
            <mask id="pr-fan-m"><rect width="600" height="360" fill="url(#pr-fan-fade)" /></mask>
          </defs>
          <path className="pr-dk-ray" d="M0 214 L246 168" />
          <path className="pr-dk-in" d="M246 168 L330 176" />
          <path className="pr-dk-fan" d="M330 176 L600 118 L600 330 Z" fill="url(#pr-fan)" mask="url(#pr-fan-m)" />
          <path className="pr-dk-glass" d="M300 70 L380 214 L220 214 Z" />
          <path className="pr-dk-hl" d="M300 84 L370 208" />
        </svg>
      )}
    </div>
  );
}

const NAV = [["work", "Work"], ["graph", "Map"], ["experience", "Experience"], ["about", "About"], ["play", "Play"], ["contact", "Contact"]];

/** The whole Prism site. */
export default function Prism({ content: C }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  usePrismMotion(root);
  // one answer open at a time
  const oneOpen = (e: SyntheticEvent<HTMLDetailsElement>) => {
    const d = e.currentTarget;
    if (d.open) d.parentElement?.querySelectorAll("details").forEach((o) => { if (o !== d) o.open = false; });
  };

  return (
    <main className="stage" id="stage" tabIndex={-1}>
      <div className="pr" id="pr" ref={root}>
        <div className="pr-gl" id="pr-gl" aria-hidden="true" />

        <header className="pr-nav" id="pr-nav">
          <a className="pr-logo" href="#top" aria-label={`${C.name}, back to top`}><span className="pr-logo-m"><Mark label="" /></span><span className="pr-logo-t">{C.name}</span></a>
          <nav className="pr-links" aria-label="Sections">{NAV.map(([h, l]) => <a key={h} href={`#${h}`}>{l}</a>)}</nav>
          <div className="pr-nav-r">
            <IAmRithvik className="pr-btn pr-btn-sm pr-iam" />
            <a className="pr-btn pr-btn-ink pr-btn-sm" href="#" data-resume="">Resume</a>
          </div>
        </header>

        <section className="pr-hero pr-lit" id="top" aria-labelledby="pr-h1">
          <div className="pr-hero-in">
            <p className="pr-kicker"><i className="pr-spec-dot" aria-hidden="true" /><span data-edit="v7.role">{C.role}</span></p>
            <h1 className="pr-name" id="pr-h1"><Ca txt={C.first} cls="pr-name-1" /><Ca txt={C.last} cls="pr-name-2" /></h1>
            <p className="pr-lede" data-edit="v7.line">{C.line}</p>
            <p className="pr-status"><i className="pr-led" aria-hidden="true" /><span data-edit="v7.status">{C.status}</span></p>
            <div className="pr-acts">
              <a className="pr-btn pr-btn-ink" href="#" data-resume=""><Icon name="file-text" />Resume</a>
              <button type="button" className="pr-btn pr-btn-line" data-compose="Internship opportunity"><Icon name="mail" />Email me</button>
              <button type="button" className="pr-btn pr-btn-ghost" data-agent=""><span className="pr-prompt" aria-hidden="true">❯</span>Ask my agent</button>
            </div>
          </div>
          <p className="pr-fig" aria-hidden="true"><span>Fig. 1</span>White light, split<span className="pr-fig-hint"> · move the pointer to steer it</span></p>
        </section>

        <section className="pr-sec pr-about" id="about" aria-labelledby="pr-h-about">
          <div className="pr-about-grid">
            <div className="pr-pt"><Portrait id="prism" className="pr-portrait" /></div>
            <div className="pr-about-txt">
              <p className="pr-kicker"><span className="pr-k-n">01</span>About</p>
              <h2 className="pr-h2" id="pr-h-about"><Ca txt={`Hi, I'm ${C.first}.`} /></h2>
              {C.about.map((a, i) => <p className="pr-p" key={i} data-edit={`v7.about.${i}`}>{a}</p>)}
              <ul className="pr-thesis">{C.thesis.map((t, i) => <li key={i} style={bandVar(i * 2 + 1)}><span data-edit={`v7.thesis.${i}`}>{t}</span></li>)}</ul>
            </div>
          </div>
          <div className="pr-now" id="now">
            <div className="pr-now-h"><p className="pr-kicker"><span className="pr-k-n">01.1</span>Now</p><p className="pr-now-city"><Icon name="map-pin" />{C.now.city} · <Clock tz={C.now.tz} className="pr-clock" /></p></div>
            <dl className="pr-now-list">
              <div><dt>Building</dt><dd data-edit="v7.now.building">{C.now.building}</dd></div>
              <div><dt>Researching</dt><dd data-edit="v7.now.researching">{C.now.researching}</dd></div>
              <div><dt>Learning</dt><dd data-edit="v7.now.learning">{C.now.learning}</dd></div>
            </dl>
            <ol className="pr-places" aria-label="Places">
              {C.places.map((pl) => (
                <li key={pl.key} className={pl.key === "now" ? "is-now" : ""}><span>{PLACE[pl.key] ?? pl.key}</span><b>{pl.city}</b><Clock tz={pl.tz} className="pr-clock" /></li>
              ))}
            </ol>
          </div>
        </section>

        <section className="pr-sec pr-nums" aria-label="In numbers">
          <dl>{C.numbers.map(([n, l], i) => <div key={l} style={bandVar([0, 2, 4, 5][i % 4])}><dt data-edit={`numbers.${i}.v`}>{n}</dt><dd data-edit={`numbers.${i}.l`}>{l}</dd></div>)}</dl>
        </section>

        <section className="pr-sec pr-work" id="work" aria-labelledby="pr-h-work">
          <header className="pr-sec-h">
            <p className="pr-kicker"><span className="pr-k-n">02</span>Work</p>
            <h2 className="pr-h2" id="pr-h-work"><Ca txt={`${countWord(C.projects.length)} projects, one spectrum.`} /></h2>
            <p className="pr-sub">From EEG headsets to the cloud. Each one opens.</p>
          </header>
          <ol className="pr-pjs">
            {C.projects.map((p, i) => (
              <li className="pr-pj-li" key={p.slug}>
                <a className="pr-pj" id={`project-${p.slug}`} href={`/work/${p.slug}`} data-case={p.slug} style={bandVar(i)} aria-label={`${p.title}: ${p.headline}. Open the case`}>
                  <span className="pr-pj-band" aria-hidden="true" />
                  <span className="pr-pj-n"><b>{pad(i)}</b><span>{band(i)[1]} nm</span></span>
                  <span className="pr-pj-main">
                    <span className="pr-pj-t"><Ca txt={p.title} /></span>
                    <span className="pr-pj-h" data-edit={`project:${p.slug}:headline`}>{p.headline}</span>
                  </span>
                  <span className="pr-pj-k"><Icon name={p.icon} /><span data-edit={`project:${p.slug}:kind`}>{p.kind}</span></span>
                  <span className="pr-pj-go" aria-hidden="true"><Icon name="arrow-up-right" /></span>
                </a>
              </li>
            ))}
          </ol>
        </section>

        <section className="pr-sec pr-graph pr-lit" id="graph" aria-labelledby="pr-h-graph">
          <header className="pr-sec-h">
            <p className="pr-kicker"><span className="pr-k-n">03</span>Map</p>
            <h2 className="pr-h2" id="pr-h-graph"><Ca txt="How it all connects." /></h2>
            <p className="pr-sub">Fields, projects, roles, places and the skills between them. Hover to trace a path, click for the details.</p>
          </header>
          <div className="pr-kg"><KnowledgeGraph id="prism" /></div>
        </section>

        <section className="pr-sec pr-exp" id="experience" aria-labelledby="pr-h-exp">
          <header className="pr-sec-h">
            <p className="pr-kicker"><span className="pr-k-n">04</span>Experience</p>
            <h2 className="pr-h2" id="pr-h-exp"><Ca txt="Where I've worked." /></h2>
          </header>
          <ol className="pr-roles">
            {C.experience.map((x) => (
              <li className="pr-role" id={`experience-${x.slug}`} key={x.slug}>
                <p className="pr-when"><b data-edit={`role:${x.slug}:when`}>{x.when}</b><span data-edit={`role:${x.slug}:where`}>{x.where}</span></p>
                <div className="pr-role-b">
                  <h3 data-edit={`role:${x.slug}:role`}>{x.role}</h3>
                  <p className="pr-org" data-edit={`role:${x.slug}:org`}>{x.org}</p>
                  <ul>{x.desc.map((d, i) => <li key={i} data-edit={`role:${x.slug}:desc.${i}`}>{d}</li>)}</ul>
                  <p className="pr-tags">{x.tags.map((t) => <span key={t}>{t}</span>)}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="pr-edu" id="education">
            {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size logo from content */}
            <img src={logoSrc(C.education.logo)} alt={C.education.school} width={72} height={72} loading="lazy" decoding="async" />
            <div>
              <p className="pr-kicker">Education</p>
              <h3 data-edit="edu:school">{C.education.school}</h3>
              <p className="pr-edu-d" data-edit="edu:degree">{C.education.degree}</p>
              <p className="pr-edu-m"><EduMeta e={C.education} /></p>
            </div>
          </div>
        </section>

        <section className="pr-sec pr-play" id="play" aria-labelledby="pr-h-play">
          <header className="pr-play-h">
            <p className="pr-kicker"><span className="pr-k-n">05</span>Play</p>
            <h2 className="pr-ana" id="pr-h-play" aria-label="Play"><span className="pr-ana-c" aria-hidden="true">Play</span><span className="pr-ana-r" aria-hidden="true">Play</span></h2>
            <p className="pr-sub">{countWord(PLAY.length)} small toys. Red-cyan glasses optional.</p>
          </header>
          <ul className="pr-toys">
            {PLAY.map((t, i) => (
              <li key={t.id}>
                <button type="button" className="pr-toy" data-play={t.id} style={bandVar(i)} aria-label={`Play ${t.name}: ${t.desc}`}>
                  <span className="pr-toy-n">{pad(i)}</span>
                  <span className="pr-toy-ic" aria-hidden="true"><Icon name={t.icon} /></span>
                  <span className="pr-toy-t">{t.name}</span>
                  <span className="pr-toy-d">{t.desc}</span>
                  <span className="pr-toy-bar" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="pr-sec pr-faq" id="questions" aria-labelledby="pr-h-faq">
          <div className="pr-faq-grid">
            <div className="pr-faq-l">
              <p className="pr-kicker"><span className="pr-k-n">06</span>Questions</p>
              <h2 className="pr-h2" id="pr-h-faq"><Ca txt="Short answers." /></h2>
              <p className="pr-sub">Anything else, ask my agent. It only answers from what&apos;s on record.</p>
              <div className="pr-acts"><button type="button" className="pr-btn pr-btn-line" data-agent=""><span className="pr-prompt" aria-hidden="true">❯</span>Ask my agent</button></div>
            </div>
            <div className="pr-qs">
              {C.faq.map(([q, a], i) => (
                <details className="pr-q" key={q} onToggle={oneOpen}><summary><span data-edit={`faq.${i}.q`}>{q}</span><span className="pr-plus" aria-hidden="true" /></summary><p data-edit={`faq.${i}.a`}>{a}</p></details>
              ))}
            </div>
          </div>
        </section>

        <section className="pr-sec pr-contact" id="contact" aria-labelledby="pr-h-contact">
          <div className="pr-dark">
            <DarkArt />
            <div className="pr-dk-in">
              <p className="pr-kicker"><span className="pr-k-n">07</span>Contact</p>
              <h2 className="pr-dk-h" id="pr-h-contact">Write to me.</h2>
              <p className="pr-dk-p">Open to SWE and AI internships. The message goes straight to my inbox.</p>
              <div className="pr-acts">
                <button type="button" className="pr-btn pr-btn-white" data-compose="Internship opportunity"><Icon name="mail" />Write an email</button>
                <button type="button" className="pr-btn pr-btn-dkline" data-copy={C.links.email}><Icon name="copy" />{C.links.email}</button>
              </div>
              <ul className="pr-dk-links">
                <li><a href={C.links.github} target="_blank" rel="noopener"><Logo slug="github" />GitHub</a></li>
                <li><a href={C.links.linkedin} target="_blank" rel="noopener"><Logo slug="linkedin" />LinkedIn</a></li>
                <li><a href="#" data-resume=""><Icon name="file-text" />Resume</a></li>
                <li><a href="#" data-agent=""><Icon name="terminal" />Agent</a></li>
              </ul>
            </div>
          </div>
        </section>

        <footer className="pr-foot">
          <a className="pr-foot-m" href="#top" aria-label="Back to top"><Mark label="" /></a>
          <nav className="pr-foot-nav" aria-label="Footer">{NAV.map(([h, l]) => <a key={h} href={`#${h}`}>{l}</a>)}</nav>
          <p className="pr-colo">The light is one fragment shader: a glass prism, its spectrum, and the caustics it throws on the Map. The photo is never touched. Set in Instrument Sans and IBM Plex Mono. <a className="foot-status" href="/status">Status</a></p>
        </footer>
      </div>
      <ShaderCanvas spec={META.shader} dark={META.dark} />
    </main>
  );
}
