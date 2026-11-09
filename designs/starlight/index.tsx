"use client";
// Starlight: the whole site seen through a night-vision tube (port of docs/mockups/v7/themes/starlight.js;
// see designs/PORTING.md). Where each effect lives: the shader draws the night scene (stars, treeline, field),
// tube vignette and grain; the pointer is an IR light in the shader and, in the DOM, reveals small annotations
// and graph edges (motion.ts). Halation is text-shadow on headings only. Performance mode (html.lite) and
// reduced motion stop the flare, ring, gain jitter and IR loop and show the annotations plainly.
import { useEffect, useRef, useSyncExternalStore } from "react";
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
import { deg } from "./geo";
import { useStarlightMotion, type Flare } from "./motion";
import "./starlight.css";
import IAmRithvik from "@/components/site/IAmRithvik";

const META = designById("starlight")!;
const PH_KEY = "rithvik-sl-ph";
const pad = (i: number) => String(i + 1).padStart(2, "0");
const PLACE: Record<string, string> = { home: "Home", school: "School", now: "Now" };
const ABBR: Record<string, string> = { home: "BOS", school: "LAF", now: "SFO" };
const WP_LEFT = [13, 33, 52];
const logoSrc = (l: string) => (/^(\/|https?:)/.test(l) ? l : `/images/${l}`); // content stores the bare file name

/** Notifies useSyncExternalStore when the phosphor attribute on <html> changes. */
function subPh(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-sl-ph"] });
  return () => mo.disconnect();
}

/** The whole Starlight site. */
export default function Starlight({ content: C }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  const flare = useRef<Flare>(() => {});
  useStarlightMotion(root, flare);

  // phosphor: P43 green or P45 white; <html data-sl-ph> is the source of truth (the canvas is recoloured by a
  // CSS colour matrix, the DOM by tokens), restored from localStorage after hydration
  const white = useSyncExternalStore(subPh, () => document.documentElement.dataset.slPh === "white", () => false);
  useEffect(() => {
    const html = document.documentElement;
    try { html.dataset.slPh = localStorage.getItem(PH_KEY) === "white" ? "white" : "green"; } catch { html.dataset.slPh = "green"; }
    return () => { delete html.dataset.slPh; };
  }, []);
  const togglePh = () => {
    const w = !white;
    document.documentElement.dataset.slPh = w ? "white" : "green";
    try { localStorage.setItem(PH_KEY, w ? "white" : "green"); } catch {}
    flare.current(innerWidth - 120, 30, 0.5);
  };

  return (
    <main className="stage" id="stage" tabIndex={-1}>
      <div className="sl" ref={root}>
        <div className="sl-flare" aria-hidden="true" />
        <div className="sl-wps" aria-hidden="true">
          {C.places.map((pl, i) => (
            <span className="sl-wp sl-ir" data-ir="" style={{ left: `${WP_LEFT[i] ?? 20 + i * 15}%` }} key={pl.key}>
              <b>{pl.city}</b><span>{deg(pl.lat, "N", "S")} {deg(pl.lng, "E", "W")} · {PLACE[pl.key] ?? pl.key}</span><i />
            </span>
          ))}
        </div>

        <header className="sl-top" aria-label="Site">
          <a className="sl-logo" href="#top" aria-label={`${C.name}, back to top`}><Mark label="" /><span>RPK</span></a>
          <nav className="sl-nav" aria-label="Sections"><a href="#work">Work</a><a href="#graph">Chart</a><a href="#experience">Log</a><a href="#about">Notes</a><a href="#play">Play</a><a href="#contact">Contact</a></nav>
          <p className="sl-read" aria-hidden="true"><span>GAIN <b data-sl-gain="">0.82</b></span><span className="sl-bat">BAT <i className="sl-cells" data-sl-cells="" data-lv="4"><i /><i /><i /><i /></i><b data-sl-bat="">EXT</b></span><span><b data-sl-ts="">--:--:--</b></span></p>
          <button type="button" className="sl-phos" aria-pressed={white} title="Switch phosphor" onClick={togglePh}><i aria-hidden="true" /><span>{white ? "P45 White" : "P43 Green"}</span></button>
          <IAmRithvik className="sl-btn sl-iam" />
          <a className="sl-btn sl-top-cv" href="#" data-resume=""><Icon name="file-text" /><span>Resume</span></a>
        </header>

        <aside className="sl-coords" aria-hidden="true">
          {C.places.map((pl) => (
            <p key={pl.key}><b>{ABBR[pl.key] ?? ""}</b><span>{deg(pl.lat, "N", "S")}</span><span>{deg(pl.lng, "E", "W")}</span><Clock tz={pl.tz} className="" /></p>
          ))}
        </aside>
        <aside className="sl-ruler" aria-hidden="true"><i className="sl-ruler-s" /><span className="sl-ruler-m" data-sl-el="">EL +09°</span></aside>
        <div className="sl-ring" aria-hidden="true"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="92" /><path d="M100 2v12M100 186v12M2 100h12M186 100h12" /><path className="sl-ring-arc" d="M30 54A92 92 0 0 1 54 30" /></svg><span data-sl-ring="">IR · AZ 270° · EL +09°</span></div>

        <section className="sl-hero" id="top" aria-labelledby="sl-h1">
          <div className="sl-hero-txt">
            <p className="sl-k"><i className="sl-dot" aria-hidden="true" />CH 1 · Night vision<span className="sl-k-x"> · Starlight only</span></p>
            <h1 id="sl-h1" className="sl-h1"><span>{C.first}</span><span>{C.last}</span></h1>
            <p className="sl-role-l">{C.role}</p>
            <p className="sl-lede">{C.line}</p>
            <p className="sl-status">{C.status}</p>
            <div className="sl-acts">
              <a className="sl-btn sl-hot sl-cta" href="#" data-resume=""><Icon name="file-text" />Resume</a>
              <button type="button" className="sl-btn sl-cta" data-compose="Internship opportunity"><Icon name="mail" />Email me</button>
              <button type="button" className="sl-btn sl-ghost" data-agent=""><span className="sl-pr" aria-hidden="true">❯</span>Ask my agent</button>
            </div>
            <p className="sl-hint">Your pointer is an IR light. Sweep it across the treeline.</p>
          </div>
          <div className="sl-disp">
            <p className="sl-disp-bar" aria-hidden="true"><span><i />CH 2 · Colour</span><span>Visible light</span></p>
            <div className="sl-disp-in"><Portrait id="starlight" className="sl-pt" /></div>
            <p className="sl-disp-foot" aria-hidden="true"><span>GitHub</span><span>LinkedIn</span><span>Email</span></p>
          </div>
        </section>

        <section className="sl-sec sl-work" id="work" aria-labelledby="sl-h-work">
          <header className="sl-sh"><p className="sl-k">02 · Sightings</p><h2 id="sl-h-work" className="sl-h2">{countWord(C.projects.length)} things I built</h2><p className="sl-sub">From EEG headsets to the cloud. Each one opens.</p></header>
          <ol className="sl-targets">
            {C.projects.map((p, i) => (
              <li key={p.slug} id={`project-${p.slug}`}>
                <a className="sl-tg" href={`/work/${p.slug}`} data-case={p.slug} aria-label={`${p.title}: ${p.headline}. Open the case`}>
                  <span className="sl-tg-n">T-{pad(i)}</span>
                  <span className="sl-tg-b">
                    <span className="sl-tg-t">{p.title}</span>
                    <span className="sl-tg-h">{p.headline}</span>
                    <span className="sl-tg-ir sl-ir" data-ir=""><Icon name="crosshair" />{p.ctx}</span>
                  </span>
                  <span className="sl-tg-k">{p.kind}</span>
                  <span className="sl-tg-go" aria-hidden="true"><Icon name="arrow-up-right" /></span>
                  <i className="sl-lock" aria-hidden="true"><i /><i /><i /><i /></i>
                </a>
              </li>
            ))}
          </ol>
        </section>

        <section className="sl-sec sl-chart" id="graph" aria-labelledby="sl-h-graph">
          <header className="sl-sh"><p className="sl-k">03 · Sky chart</p><h2 id="sl-h-graph" className="sl-h2">Everything, connected</h2><p className="sl-sub">Me at the centre, then fields, work, skills and places. The light traces the faint lines; any star opens.</p></header>
          <KnowledgeGraph id="starlight" />
        </section>

        <section className="sl-sec sl-exp" id="experience" aria-labelledby="sl-h-exp">
          <header className="sl-sh"><p className="sl-k">04 · Log</p><h2 id="sl-h-exp" className="sl-h2">Where I&apos;ve worked</h2></header>
          <ol className="sl-log">
            {C.experience.map((x) => (
              <li className="sl-role" id={`experience-${x.slug}`} key={x.slug}>
                <p className="sl-when"><time>{x.when}</time><span>{x.where}</span></p>
                <div className="sl-role-b">
                  <h3>{x.role}</h3>
                  <p className="sl-org">{x.org}</p>
                  <ul>{x.desc.map((d, i) => <li key={i}>{d}</li>)}</ul>
                  <p className="sl-tags">{x.tags.map((t) => <span key={t}>{t}</span>)}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="sl-edu" id="education">
            <span className="sl-edu-plate">
              {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size logo from content */}
              <img src={logoSrc(C.education.logo)} alt={C.education.school} width={56} height={56} loading="lazy" decoding="async" />
            </span>
            <div>
              <p className="sl-k">Education</p>
              <h3>{C.education.school}</h3>
              <p>{C.education.degree}</p>
              <p className="sl-edu-m">{[C.education.focus, C.education.grad].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
        </section>

        <section className="sl-sec sl-about" id="about" aria-labelledby="sl-h-about">
          <div className="sl-about-g">
            <header className="sl-sh"><p className="sl-k">05 · Field notes</p><h2 id="sl-h-about" className="sl-h2">Hi, I&apos;m {C.first}.</h2></header>
            <div className="sl-about-t">{C.about.map((a, i) => <p key={i}>{a}</p>)}</div>
          </div>
          <div className="sl-now" id="now">
            <dl className="sl-now-l">
              <div><dt>Building</dt><dd>{C.now.building}</dd></div>
              <div><dt>Researching</dt><dd>{C.now.researching}</dd></div>
              <div><dt>Learning</dt><dd>{C.now.learning}</dd></div>
            </dl>
            <ol className="sl-places" aria-label="Places">
              {C.places.map((pl) => (
                <li className={pl.key === "now" ? "is-now" : ""} key={pl.key}>
                  <span className="sl-pk">{PLACE[pl.key] ?? pl.key}</span><b>{pl.city}</b>
                  <span className="sl-pc">{deg(pl.lat, "N", "S")} · {deg(pl.lng, "E", "W")}</span>
                  <Clock tz={pl.tz} className="sl-pt-t" />
                </li>
              ))}
            </ol>
          </div>
          <dl className="sl-nums">{C.numbers.map(([n, l]) => <div key={l}><dt>{n}</dt><dd>{l}</dd></div>)}</dl>
        </section>

        <section className="sl-sec sl-play" id="play" aria-labelledby="sl-h-play">
          <header className="sl-sh"><p className="sl-k">06 · Night games</p><h2 id="sl-h-play" className="sl-h2">{countWord(PLAY.length)} small toys</h2><p className="sl-sub">Scratch a 1927 record, draw with a mirror, or test your eye in the dark.</p></header>
          <ul className="sl-toys">
            {PLAY.map((t, i) => (
              <li key={t.id}>
                <button type="button" className="sl-toy" data-play={t.id} aria-label={`Play ${t.name}: ${t.desc}`}>
                  <span className="sl-toy-ch">CH {pad(i)}</span>
                  <span className="sl-toy-ic"><Icon name={t.icon} /></span>
                  <span className="sl-toy-t">{t.name}</span>
                  <span className="sl-toy-d">{t.desc}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="sl-sec sl-contact" id="contact" aria-labelledby="sl-h-contact">
          <p className="sl-k">07 · Signal</p>
          <h2 id="sl-h-contact" className="sl-h-big">Send a signal.</h2>
          <p className="sl-sub">Open to SWE and AI internships. Messages go straight to my inbox.</p>
          <div className="sl-acts">
            <button type="button" className="sl-btn sl-hot sl-cta sl-btn-lg" data-compose="Internship opportunity"><Icon name="mail" />Write an email</button>
            <button type="button" className="sl-btn sl-ghost" data-copy={C.links.email}><Icon name="copy" />{C.links.email}</button>
          </div>
          <ul className="sl-links">
            <li><a href={C.links.github} target="_blank" rel="noopener"><Logo slug="github" />GitHub</a></li>
            <li><a href={C.links.linkedin} target="_blank" rel="noopener"><Logo slug="linkedin" />LinkedIn</a></li>
            <li><a href="#" data-resume=""><Icon name="file-text" />Resume</a></li>
            <li><a href="#" data-agent=""><Icon name="terminal" />Agent</a></li>
          </ul>
          <footer className="sl-foot" id="colophon">
            <span className="sl-foot-m" aria-hidden="true"><Mark label="" /></span>
            <p>One fragment shader: starlight, a treeline, an intensifier tube. The photo on channel two is never touched. Set in Saira and IBM Plex Mono. <a className="foot-status" href="/status">Status</a></p>
          </footer>
        </section>
      </div>
      <ShaderCanvas spec={META.shader} dark={META.dark} />
    </main>
  );
}
