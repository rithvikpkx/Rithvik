"use client";
/* eslint-disable @next/next/no-img-element -- fixed art with a hand-written srcset; logo comes from content */
// Mercury: a graphite studio with one heavy pool of liquid chrome (port of docs/mockups/v7/themes/mercury.js;
// see designs/PORTING.md). The shader moves only in the hero (metaballs) and at Contact (ferrofluid that
// reaches for the pointer); between them its host is hidden so the runtime pauses. Reading sections are
// solid graphite. html.lite / reduced motion: still shader frame, flat dividers, no float or drift.
import { useRef, type FormEvent, type SyntheticEvent } from "react";
import type { DesignProps } from "@/lib/designs/types";
import { designById } from "@/lib/designs/registry";
import { PLAY } from "@/lib/play/games";
import { countWord } from "@/lib/words";
import { useSite } from "@/components/site/SiteProvider";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import Portrait from "@/components/site/portrait/Portrait";
import Mark from "@/components/site/mark/Mark";
import KnowledgeGraph from "@/components/site/graph/KnowledgeGraph";
import Clock from "@/components/site/Clock";
import { Icon, Logo } from "@/components/site/Glyph";
import { useMercuryMotion } from "./motion";
import "./mercury.css";

const META = designById("mercury")!;
const pad = (i: number) => String(i + 1).padStart(2, "0");
const PLACE_LABEL: Record<string, string> = { home: "Home", school: "School", now: "Now" };
const TILT = [-14, 9, -6, 16, -10, 5];
const logoSrc = (l: string) => (/^(\/|https?:)/.test(l) ? l : `/images/${l}`); // content stores the bare file name
const hideFig = (e: SyntheticEvent<HTMLImageElement>) => { (e.currentTarget.parentNode as HTMLElement).hidden = true; };

// a chrome meniscus: convex ends (mercury's meniscus bulges) and a wave that rings once on entry
const WAVE = (() => {
  let d = "";
  for (let x = 70; x <= 1130; x += 5) { const e = Math.exp(-(((x - 600) / 250) ** 2)), y = 20 - 10 * Math.cos((x - 600) / 34) * e; d += (x === 70 ? "M" : "L") + x + " " + y.toFixed(2); }
  return d;
})();

/** Section divider: a chrome meniscus line. */
function Divider() {
  return (
    <div className="mc-div" aria-hidden="true">
      <svg viewBox="0 0 1200 40" preserveAspectRatio="none" focusable="false">
        <path className="mc-men" d="M0 36 C10 26 32 20 70 20 H260" />
        <path className="mc-men" d="M940 20 H1130 C1168 20 1190 26 1200 36" />
        <path className="mc-wave" d={WAVE} />
      </svg>
    </div>
  );
}

/** The whole Mercury site. */
export default function Mercury({ content: C }: DesignProps) {
  const { openAgent } = useSite();
  const root = useRef<HTMLDivElement>(null);
  useMercuryMotion(root);

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

  return (
    <main className="stage" id="stage" tabIndex={-1}>
      <div className="mc" ref={root}>
        <svg className="mc-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs><linearGradient id="mc-steel" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1200" y2="0"><stop offset="0" stopColor="#4d5058" /><stop offset=".3" stopColor="#b9bcc4" /><stop offset=".5" stopColor="#ffffff" /><stop offset=".7" stopColor="#b9bcc4" /><stop offset="1" stopColor="#4d5058" /></linearGradient></defs></svg>
        <div className="mc-gl" id="mc-gl" aria-hidden="true" />

        <header className="mc-nav" aria-label="Site">
          <a className="mc-logo" href="#top" aria-label={`${C.name}, back to top`}><Mark label="" /><span>{C.name}</span></a>
          <nav className="mc-links" aria-label="Sections"><a href="#work">Work</a><a href="#experience">Experience</a><a href="#graph">Alloy</a><a href="#play">Play</a><a href="#contact">Contact</a></nav>
          <a className="mc-pill" href="#" data-resume="">Resume</a>
        </header>

        <section className="mc-hero" id="top" aria-labelledby="mc-h1">
          <div className="mc-hero-in">
            <p className="mc-eyebrow">{C.role}</p>
            <h1 className="mc-h1" id="mc-h1"><span className="mc-chrome-t">{C.first}</span> <em>{C.last}</em></h1>
            <p className="mc-lede">{C.line}</p>
            <p className="mc-status"><i className="mc-dot" aria-hidden="true" />{C.status}</p>
            <div className="mc-acts">
              <a className="mc-btn mc-solid" href="#" data-resume="">Resume<Icon name="arrow-up-right" /></a>
              <button type="button" className="mc-btn" data-compose="Internship opportunity"><Icon name="mail" />Email me</button>
              <button type="button" className="mc-btn mc-ghost" data-agent=""><span className="mc-prompt" aria-hidden="true">❯</span>Ask my agent</button>
            </div>
          </div>
          <p className="mc-hint" aria-hidden="true"><span />Touch the surface</p>
        </section>

        <section className="mc-sec mc-about" id="about" aria-labelledby="mc-h-about">
          <Divider />
          <div className="mc-about-grid">
            <div className="mc-pt"><i className="mc-bezel" aria-hidden="true" /><Portrait id="mercury" /></div>
            <div className="mc-about-txt">
              <p className="mc-kicker">About</p>
              <h2 className="mc-h2" id="mc-h-about">Hi, I&apos;m {C.first}.</h2>
              {C.about.map((a, i) => <p className="mc-p" key={i}>{a}</p>)}
              <ul className="mc-thesis">{C.thesis.map((t, i) => <li key={i}><span className="mc-bul" aria-hidden="true"><Mark label="" /></span>{t}</li>)}</ul>
            </div>
          </div>
          <dl className="mc-nums">{C.numbers.map(([n, l]) => <div key={l}><dt>{n}</dt><dd>{l}</dd></div>)}</dl>
          <div className="mc-now" id="now">
            <div className="mc-now-a">
              <p className="mc-kicker">Now</p>
              <ul className="mc-now-list">
                <li><span>Building</span><b>{C.now.building}</b></li>
                <li><span>Researching</span><b>{C.now.researching}</b></li>
                <li><span>Learning</span><b>{C.now.learning}</b></li>
              </ul>
            </div>
            <ol className="mc-places" aria-label="Places">
              {C.places.map((pl) => (
                <li key={pl.key} className={pl.key === "now" ? "is-now" : ""}><span className="mc-pk">{PLACE_LABEL[pl.key] ?? pl.key}</span><b>{pl.city}</b><Clock tz={pl.tz} className="mc-pt-clock" /></li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mc-sec" id="work" aria-labelledby="mc-h-work">
          <Divider />
          <header className="mc-head"><p className="mc-kicker">Work</p><h2 className="mc-h2" id="mc-h-work">{countWord(C.projects.length)} things I&apos;ve built.</h2><p className="mc-sub">From headsets to the cloud. Each one opens.</p></header>
          <ol className="mc-work">
            {C.projects.map((p, i) => (
              <li key={p.slug} id={`project-${p.slug}`}>
                <a className="mc-row" href={`/work/${p.slug}`} data-case={p.slug} aria-label={`${p.title}: ${p.headline}. Open the case`}>
                  <span className="mc-n">{pad(i)}</span><span className="mc-t">{p.title}</span><span className="mc-k"><Icon name={p.icon} />{p.kind}</span><span className="mc-hl">{p.headline}</span><span className="mc-go"><Icon name="arrow-up-right" /></span>
                </a>
              </li>
            ))}
          </ol>
        </section>

        <section className="mc-sec" id="experience" aria-labelledby="mc-h-exp">
          <Divider />
          <header className="mc-head"><p className="mc-kicker">Experience</p><h2 className="mc-h2" id="mc-h-exp">Where I&apos;ve worked.</h2></header>
          <ol className="mc-roles">
            {C.experience.map((x) => (
              <li className="mc-role" id={`experience-${x.slug}`} key={x.slug}>
                <p className="mc-when">{x.when}<span>{x.where}</span></p>
                <div className="mc-role-b"><h3>{x.role}</h3><p className="mc-org">{x.org}</p>
                  <ul>{x.desc.map((d, i) => <li key={i}>{d}</li>)}</ul>
                  <p className="mc-tags">{x.tags.map((t) => <span key={t}>{t}</span>)}</p></div>
              </li>
            ))}
          </ol>
          <div className="mc-edu" id="education">
            <img src={logoSrc(C.education.logo)} alt={C.education.school} width={56} height={56} loading="lazy" decoding="async" />
            <div><p className="mc-kicker">Education</p><h3>{C.education.school}</h3><p>{C.education.degree}</p><p className="mc-edu-m">{[C.education.focus, C.education.grad].filter(Boolean).join(" · ")}</p></div>
          </div>
        </section>

        <section className="mc-sec" id="graph" aria-labelledby="mc-h-graph">
          <Divider />
          <header className="mc-head"><p className="mc-kicker">Map</p><h2 className="mc-h2" id="mc-h-graph">Alloy.</h2><p className="mc-sub">Everything on record, melted into one map. Hover to trace a thread, click to open it.</p></header>
          <div className="mc-kg"><KnowledgeGraph id="mercury" /></div>
        </section>

        <section className="mc-sec mc-play" id="play" aria-labelledby="mc-h-play">
          <Divider />
          <figure className="mc-ribbon" aria-hidden="true"><img src="/v7/mercury/chrome-ribbon-1200.webp" srcSet="/v7/mercury/chrome-ribbon-1200.webp 1200w, /v7/mercury/chrome-ribbon-2400.webp 2400w" sizes="(max-width: 700px) 160vw, 100vw" width={2400} height={1340} alt="" loading="lazy" decoding="async" onError={hideFig} /></figure>
          <header className="mc-head mc-c"><p className="mc-kicker">Play</p><h2 className="mc-h2" id="mc-h-play">{countWord(PLAY.length)} small toys.</h2><p className="mc-sub">Scratch a record, draw something, or try to beat my scores.</p></header>
          <ul className="mc-toys">
            {PLAY.map((t, i) => (
              <li key={t.id}>
                <button type="button" className="mc-toy" data-play={t.id} aria-label={`Play ${t.name}: ${t.desc}`} style={{ ["--tilt" as string]: `${TILT[i % 6]}deg` }}>
                  <span className="mc-sphere" aria-hidden="true"><i /></span><span className="mc-toy-n"><Icon name={t.icon} />{t.name}</span><span className="mc-toy-d">{t.desc}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="mc-sec" id="questions" aria-labelledby="mc-h-faq">
          <Divider />
          <div className="mc-faq">
            <div className="mc-faq-l">
              <p className="mc-kicker">Questions</p>
              <h2 className="mc-h2" id="mc-h-faq">Short answers.</h2>
              <p className="mc-sub">Anything else, ask my agent. It answers only from what&apos;s on record.</p>
              <form className="mc-ask" id="mc-ask" autoComplete="off" onSubmit={ask}>
                <label htmlFor="mc-ask-in" className="sr-only">Ask the agent</label>
                <span className="mc-prompt" aria-hidden="true">❯</span>
                <input id="mc-ask-in" name="q" type="text" maxLength={500} placeholder="What stack did BoilerFrame use?" />
                <button type="submit" aria-label="Ask"><Icon name="arrow-up" /></button>
              </form>
            </div>
            <div className="mc-qs">
              {C.faq.map(([q, a]) => (
                <details className="mc-q" key={q} onToggle={oneOpen}><summary>{q}<span className="mc-plus" aria-hidden="true" /></summary><p>{a}</p></details>
              ))}
            </div>
          </div>
        </section>

        <section className="mc-contact" id="contact" aria-labelledby="mc-h-contact">
          <div className="mc-contact-in">
            <div className="mc-contact-txt">
              <p className="mc-kicker">Contact</p>
              <h2 className="mc-big" id="mc-h-contact"><span className="mc-chrome-t">Write</span> <em>to me.</em></h2>
              <p className="mc-sub">Open to SWE and AI internships. It goes straight to my inbox.</p>
              <div className="mc-acts">
                <button type="button" className="mc-btn mc-solid" data-compose="Internship opportunity"><Icon name="mail" />Write an email</button>
                <button type="button" className="mc-btn" data-copy={C.links.email}><Icon name="copy" />{C.links.email}</button>
              </div>
              <ul className="mc-out">
                <li><a href={C.links.github} target="_blank" rel="noopener"><Logo slug="github" />GitHub</a></li>
                <li><a href={C.links.linkedin} target="_blank" rel="noopener"><Logo slug="linkedin" />LinkedIn</a></li>
                <li><a href="#" data-resume=""><Icon name="file-text" />Resume</a></li>
              </ul>
              <p className="mc-colo">The metal is one fragment shader; bring the pointer down and it reaches for you. The photo is never touched. Set in Bodoni Moda and Hanken Grotesk.</p>
            </div>
            <figure className="mc-mark-art" aria-hidden="true"><img src="/v7/mercury/chrome-mark-800.webp" srcSet="/v7/mercury/chrome-mark-800.webp 800w, /v7/mercury/chrome-mark-1600.webp 1600w" sizes="(max-width: 700px) 44vw, 34vw" width={800} height={800} alt="" loading="lazy" decoding="async" onError={hideFig} /></figure>
          </div>
        </section>
      </div>
      <ShaderCanvas spec={META.shader} dark={META.dark} />
    </main>
  );
}
