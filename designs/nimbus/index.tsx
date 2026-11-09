"use client";
// Nimbus: a bright, airy sky world (port of docs/mockups/v7/themes/nimbus.js; see designs/PORTING.md).
// Where each effect lives: the shader clouds only in the hero, behind a white clearing; pixel clouds
// elsewhere are static and move only on interaction (card hover, band clouds fleeing the pointer, stamp
// hover) or as slow drifts while their section is on screen. html.lite and reduced motion stop the trail,
// drifts, footer turn and drop-shadow filters, leaving a designed still.
import { useMemo, useRef, type FormEvent, type SyntheticEvent } from "react";
import type { DesignProps } from "@/lib/designs/types";
import { designById } from "@/lib/designs/registry";
import { PLAY } from "@/lib/play/games";
import { countWord } from "@/lib/words";
import { useSite } from "@/components/site/SiteProvider";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import Portrait from "@/components/site/portrait/Portrait";
import Mark from "@/components/site/mark/Mark";
import KnowledgeGraph from "@/components/site/graph/KnowledgeGraph";
import { Icon, Logo } from "@/components/site/Glyph";
import { DEFS, ON_PALE, ON_SKY, ON_SUN, SKIES, cloud, edgeSvg, glyph, hourIn, icon16, isDay, skyOf, skyShader, skyTile } from "./pixel";
import { clock, useTick, useVisitorHour } from "./time";
import { useNimbusMotion } from "./motion";
import "./nimbus.css";

const META = designById("nimbus")!;
const pad = (i: number) => String(i + 1).padStart(2, "0");
const PLACE_LABEL: Record<string, string> = { home: "Home", school: "School", now: "Now" };
const STAMP_BG = ["sky", "sun", "pale", "sky", "pale", "sun"] as const;
const TILT = [-2.5, 2, -1.5, 2.5, -2, 1.5];
const BAND_CLOUDS = [[64, 6, 1], [86, 24, 0.65], [1, 50, 0.8], [46, 46, 0.55], [88, 70, 0.85], [22, 90, 0.6]];
const logoSrc = (l: string) => (/^(\/|https?:)/.test(l) ? l : `/images/${l}`); // content stores the bare file name

/** Raw pixel-art SVG inside a wrapper span (our own generated markup, never user input). */
function Px({ className, html }: { className?: string; html: string }) {
  return <span className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Live local time in a zone (blank until hydrated, then every 15s). */
function Clock({ tz }: { tz?: string }) {
  return <>{useTick() ? clock(tz) : ""}</>;
}

/** Sun or moon for a zone's current hour. */
function Orb({ tz, className }: { tz: string; className?: string }) {
  const day = !useTick() || isDay(hourIn(tz));
  return <Px className={className} html={glyph(day ? "sun" : "moon")} />;
}

/** The forecast card's top: flips between day and night with the "now" city's hour. */
function WxTop({ city, tz }: { city: string; tz: string }) {
  const day = !useTick() || isDay(hourIn(tz));
  return (
    <div className={`nb-wx-top nb-wx-${day ? "day" : "night"}`}>
      <Px className="nb-wx-bg" html={skyTile(77, 48, 14, 48, day ? -0.25 : -0.4, 1.1)} />
      <span className="nb-wx-city"><Icon name="map-pin" />{city}</span>
      <span className="nb-wx-time"><Clock tz={tz} /></span>
      <span className="nb-wx-cond">{day ? "Daylight" : "After dark"}</span>
      <Px className="nb-wx-orb" html={glyph(day ? "sun" : "moon")} />
    </div>
  );
}

/** The whole Nimbus site. */
export default function Nimbus({ content: C }: DesignProps) {
  const { openAgent } = useSite();
  const root = useRef<HTMLDivElement>(null);
  useNimbusMotion(root);
  const hr = useVisitorHour();
  const sky = hr === null ? "day" : skyOf(hr), night = sky === "night";
  // the sun rides the visitor's hour, so the shader mounts only once that is known (client)
  const spec = useMemo(() => (hr === null ? undefined : skyShader(META.shader!, hr)), [hr]);

  const ask = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const inp = e.currentTarget.elements.namedItem("q") as HTMLInputElement, q = inp.value.trim();
    openAgent(q || undefined); inp.value = "";
  };
  // one answer open at a time
  const oneOpen = (e: SyntheticEvent<HTMLDetailsElement>) => {
    const d = e.currentTarget;
    if (d.open) d.parentElement?.querySelectorAll("details").forEach((o) => { if (o !== d) o.open = false; });
  };
  const bullet = <span className="nb-bullet" aria-hidden="true"><Mark label="" /></span>;

  return (
    <main className="stage" id="stage" tabIndex={-1}>
      <div className="nb" data-sky={sky} ref={root}>
        <svg className="nb-defs" width="0" height="0" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: DEFS }} />
        <header className="nb-nav" aria-label="Site">
          <nav className="nb-pill">
            <a className="nb-logo" href="#top" aria-label={`${C.name}, back to top`}><Mark label="" /></a>
            <a href="#work">Work</a><a href="#about">About</a><a href="#play">Play</a>
          </nav>
          <div className="nb-nav-r">
            <a className="nb-btn nb-ink nb-px-c" href="#" data-resume="">Resume</a>
            <button type="button" className="nb-round nb-ink" data-compose="Internship opportunity" aria-label={`Email ${C.first}`}><Icon name="mail" /></button>
          </div>
        </header>

        <section className="nb-hero" id="top" aria-labelledby="nb-h1">
          <div className="nb-sky" id="nb-sky" aria-hidden="true" />
          <div className="nb-hero-in">
            <p className="nb-eyebrow"><span className="nb-eyebrow-m"><Mark label="" /></span>{C.name}</p>
            <h1 id="nb-h1" className="nb-h1">
              <span className="nb-l1">Head in the clouds,<span className="nb-tile" aria-hidden="true"><Px className="nb-tile-sky" html={skyTile(5, 32, 8, 16, -0.05, 0.4)} /><span className="nb-tile-m"><Mark label="" /></span></span></span>{" "}
              <span className="nb-l2">hands on the hardware.</span>
            </h1>
            <p className="nb-lede"><b>{C.role}.</b> {C.line}</p>
            <p className="nb-status"><span className="nb-sun-dot" aria-hidden="true" />{C.status}</p>
            <div className="nb-acts">
              <a className="nb-btn nb-ink nb-px-c" href="#" data-resume="">Resume<span className="nb-btn-ar"><Icon name="arrow-up-right" /></span></a>
              <button type="button" className="nb-btn nb-white nb-px-c" data-compose="Internship opportunity"><Icon name="mail" />Email me</button>
              <button type="button" className="nb-btn nb-ghost nb-px-c" data-agent=""><span className="nb-prompt" aria-hidden="true">❯</span>Ask my agent</button>
            </div>
          </div>
          <p className="nb-yoursky"><Px className="nb-yoursky-g" html={glyph(night ? "moon" : sky === "day" ? "sun" : "part")} /><span>Your sky · {SKIES[sky].label} · <Clock /></span></p>
        </section>

        <section className="nb-sec nb-about" id="about" aria-labelledby="nb-h-about">
          <div className="nb-about-grid">
            <div className="nb-pt-wrap">
              <Px className="nb-pt-cloud nb-pt-c1" html={cloud(9, 26, 10, { w: "p2", p: "p1" })} />
              <Px className="nb-pt-cloud nb-pt-c2" html={cloud(23, 18, 8, { w: "p2", p: "p1" })} />
              <Portrait id="nimbus" className="nb-pt" />
            </div>
            <div className="nb-about-txt">
              <p className="nb-kicker">About</p>
              <h2 id="nb-h-about" className="nb-h2">Hi, I&apos;m {C.first}.</h2>
              {C.about.map((a, i) => <p className="nb-p" key={i}>{a}</p>)}
              <ul className="nb-thesis">{C.thesis.map((t, i) => <li key={i}>{bullet}{t}</li>)}</ul>
            </div>
          </div>

          <div className="nb-now" id="now">
            <p className="nb-kicker">Now</p>
            <h2 className="nb-h2 nb-c">Today&apos;s forecast</h2>
            <article className="nb-wx" aria-label={`${C.first} right now`}>
              <WxTop city={C.now.city} tz={C.now.tz} />
              <ul className="nb-wx-rows">
                <li><Px html={glyph("sun")} /><span>Building</span><b>{C.now.building}</b></li>
                <li><Px html={glyph("part")} /><span>Researching</span><b>{C.now.researching}</b></li>
                <li><Px html={glyph("bolt")} /><span>Learning</span><b>{C.now.learning}</b></li>
              </ul>
              <ol className="nb-wx-places" aria-label="Places">
                {C.places.map((pl) => (
                  <li key={pl.key} className={pl.key === "now" ? "is-now" : ""}>
                    <span className="nb-wx-k">{PLACE_LABEL[pl.key] ?? pl.key}</span><b>{pl.city}</b>
                    <span className="nb-wx-c"><Orb tz={pl.tz} /><span><Clock tz={pl.tz} /></span></span>
                  </li>
                ))}
              </ol>
            </article>
            <dl className="nb-nums">{C.numbers.map(([n, l]) => <div key={l}><dt>{n}</dt><dd>{l}</dd></div>)}</dl>
          </div>
        </section>

        <section className="nb-sec nb-work" id="work" aria-labelledby="nb-h-work">
          <header className="nb-sec-h"><p className="nb-kicker">Work</p><h2 id="nb-h-work" className="nb-h2">Things I&apos;ve built</h2><p className="nb-sub">{countWord(C.projects.length)} projects, from headsets to the cloud. Each one opens.</p></header>
          <div className="nb-cards">
            {C.projects.map((p, i) => (
              <a key={p.slug} id={`project-${p.slug}`} className="nb-card" href={`/work/${p.slug}`} data-case={p.slug} aria-label={`${p.title}: ${p.headline}. Open the case`}>
                <span className="nb-card-sky">
                  <Px className="nb-drift" html={skyTile(11 + i * 17, 64, 20, 32, -0.34 - (i % 3) * 0.04, 0.55, "nb-tile")} />
                  <Px className="nb-card-ic" html={icon16(p.slug, ON_SKY)} />
                  <span className="nb-card-n">{pad(i)}</span>
                  <span className="nb-card-kind"><Icon name={p.icon} />{p.kind}</span>
                  <span className="nb-card-go" aria-hidden="true"><Icon name="arrow-up-right" /></span>
                </span>
                <span className="nb-card-tags">{p.tags.slice(0, 3).map((t) => <span key={t}>{t}</span>)}</span>
                <span className="nb-card-t">{p.title}</span>
                <span className="nb-card-h">{p.headline}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="nb-sec nb-exp" id="experience" aria-labelledby="nb-h-exp">
          <header className="nb-sec-h"><p className="nb-kicker">Experience</p><h2 id="nb-h-exp" className="nb-h2">Where I&apos;ve been</h2></header>
          <ol className="nb-roles">
            {C.experience.map((x) => (
              <li className="nb-role" id={`experience-${x.slug}`} key={x.slug}>
                <p className="nb-when">{x.when}<span>{x.where}</span></p>
                <div className="nb-role-b">
                  <h3>{x.role}</h3>
                  <p className="nb-org">{x.org}</p>
                  <ul>{x.desc.map((d, i) => <li key={i}>{bullet}{d}</li>)}</ul>
                  <p className="nb-tags">{x.tags.map((t) => <span key={t}>{t}</span>)}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="nb-edu" id="education">
            <Px className="nb-edu-sky" html={skyTile(41, 48, 12, 24, 0.15, 0.7)} />
            {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size logo from content */}
            <img src={logoSrc(C.education.logo)} alt={C.education.school} width={64} height={64} loading="lazy" />
            <div>
              <p className="nb-kicker">Education</p>
              <h3>{C.education.school}</h3>
              <p>{C.education.degree}</p>
              <p className="nb-edu-m">{[C.education.focus, C.education.grad].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
        </section>

        <section className="nb-sec nb-graph" id="graph" aria-labelledby="nb-h-graph">
          <header className="nb-sec-h"><p className="nb-kicker">Map</p><h2 id="nb-h-graph" className="nb-h2">Constellations</h2><p className="nb-sub">Everything on record, as one sky. Hover a point to trace it; click to open.</p></header>
          <div className="nb-graph-sky"><KnowledgeGraph id="nimbus" /></div>
        </section>

        <section className="nb-band" id="play" aria-labelledby="nb-h-play">
          <div className="nb-edge" aria-hidden="true" dangerouslySetInnerHTML={{ __html: edgeSvg(3, false) }} />
          <div className="nb-band-in">
            <div className="nb-bcs" aria-hidden="true">
              {BAND_CLOUDS.map(([x, y, s], i) => (
                <span key={i} className="nb-bc" style={{ left: `${x}%`, top: `${y}%`, ["--s" as string]: s, ["--d" as string]: `${18 + i * 5}s` }}>
                  <Px className="nb-bc-in" html={cloud(101 + i * 3)} />
                </span>
              ))}
            </div>
            <header className="nb-sec-h nb-band-h"><p className="nb-kicker">Play</p><h2 id="nb-h-play" className="nb-h2">Recess</h2><p className="nb-sub">{countWord(PLAY.length)} small toys for a slow afternoon. The games keep my score next to yours.</p></header>
            <ul className="nb-stamps">
              {PLAY.map((t, i) => {
                const bg = STAMP_BG[i % STAMP_BG.length], map = bg === "sky" ? ON_SKY : bg === "sun" ? ON_SUN : ON_PALE;
                return (
                  <li key={t.id} className="nb-stamp-li" style={{ ["--tilt" as string]: `${TILT[i % 6]}deg` }}>
                    <button type="button" className="nb-stamp" data-play={t.id} aria-label={`Play ${t.name}: ${t.desc}`}>
                      <span className="nb-stamp-in">
                        <span className={`nb-stamp-art nb-bg-${bg}`}>
                          <Px className="nb-stamp-cloud" html={cloud(31 + i * 5, 14, 6, { w: "p3", p: bg === "sun" ? "p3" : "p2" })} />
                          <Px className="nb-stamp-ic" html={icon16(t.id, map)} />
                          {i % 3 === 1 && <span className="nb-postmark" aria-hidden="true"><Mark label="" /></span>}
                        </span>
                        <span className="nb-stamp-meta"><span className="nb-stamp-n">{pad(i)}</span><span className="nb-stamp-v">{t.desc}</span></span>
                        <span className="nb-stamp-t">{t.name}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="nb-edge nb-edge-b" aria-hidden="true" dangerouslySetInnerHTML={{ __html: edgeSvg(8, true) }} />
        </section>

        <section className="nb-sec nb-faq" id="faq" aria-labelledby="nb-h-faq">
          <div className="nb-faq-l">
            <p className="nb-kicker">Questions</p>
            <h2 id="nb-h-faq" className="nb-h2">Short answers</h2>
            <p className="nb-sub">Anything else, ask my agent. It only answers from what&apos;s on record.</p>
            <form className="nb-ask" autoComplete="off" onSubmit={ask}>
              <label htmlFor="nb-ask-in" className="sr-only">Ask the agent</label>
              <span className="nb-prompt" aria-hidden="true">❯</span>
              <input id="nb-ask-in" name="q" type="text" maxLength={500} placeholder="What stack did BoilerFrame use?" />
              <button type="submit" className="nb-round nb-ink" aria-label="Ask"><Icon name="arrow-up" /></button>
            </form>
          </div>
          <div className="nb-qs">
            {C.faq.map(([q, a]) => (
              <details className="nb-q" key={q} onToggle={oneOpen}><summary>{q}<span className="nb-plus" aria-hidden="true" /></summary><p>{a}</p></details>
            ))}
          </div>
        </section>

        <section className="nb-sec nb-contact" id="contact" aria-labelledby="nb-h-contact">
          <p className="nb-kicker">Contact</p>
          <h2 id="nb-h-contact" className="nb-h-big">Write to me.</h2>
          <p className="nb-sub nb-c">Open to SWE and AI internships. The message goes straight to my inbox.</p>
          <div className="nb-acts nb-c">
            <button type="button" className="nb-btn nb-ink nb-px-c nb-btn-lg" data-compose="Internship opportunity"><Icon name="mail" />Write an email</button>
            <button type="button" className="nb-btn nb-white nb-px-c" data-copy={C.links.email}><Icon name="copy" />{C.links.email}</button>
          </div>
          <ul className="nb-links">
            <li><a href={C.links.github} target="_blank" rel="noopener"><Logo slug="github" />GitHub</a></li>
            <li><a href={C.links.linkedin} target="_blank" rel="noopener"><Logo slug="linkedin" />LinkedIn</a></li>
            <li><a href="#" data-resume=""><Icon name="file-text" />Resume</a></li>
            <li><a href="#" data-agent=""><Icon name="terminal" />Agent</a></li>
          </ul>
        </section>

        <footer className="nb-foot" id="colophon">
          <div className="nb-foot-top">
            <p className="nb-foot-name">{C.first}<br />{C.last}</p>
            <nav className="nb-foot-nav" aria-label="Footer"><a href="#work">Work</a><a href="#about">About</a><a href="#experience">Experience</a><a href="#graph">Map</a><a href="#play">Play</a><a href="#contact">Contact</a></nav>
            <p className="nb-colo">Clouds are one fragment shader, quantised to pixels and dithered by hand. The sky follows your clock. The photo is never touched. Set in Fraunces and Geist.</p>
          </div>
          <button type="button" className="nb-giant" aria-label="Spin the mark"><span className="nb-giant-a"><Mark label="" /></span><span className="nb-giant-b"><Mark label="" /></span></button>
        </footer>
        <div className="nb-trail" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} />)}</div>
      </div>
      <ShaderCanvas spec={spec} dark={false} />
    </main>
  );
}
