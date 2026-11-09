"use client";
// Foil: a holographic trading card under a desk lamp (port of docs/mockups/v7/themes/foil.js; see
// designs/PORTING.md). The thin-film shader lives only on the hero card face; everything else is
// calm CSS that wakes on hover. html.lite and reduced motion leave a still card, static foil gradients,
// no tilt, no glare and no datamosh.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import type { DesignProps } from "@/lib/designs/types";
import { designById } from "@/lib/designs/registry";
import { PLAY } from "@/lib/play/games";
import { countWord } from "@/lib/words";
import { useSite } from "@/components/site/SiteProvider";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import Clock from "@/components/site/Clock";
import Portrait from "@/components/site/portrait/Portrait";
import Mark from "@/components/site/mark/Mark";
import KnowledgeGraph from "@/components/site/graph/KnowledgeGraph";
import { Icon, Logo } from "@/components/site/Glyph";
import { ouroPath } from "@/components/site/mark/ouro";
import { FOIL, useFoilMotion } from "./motion";
import "./foil.css";

const META = designById("foil")!;
const pad = (n: number) => String(n).padStart(2, "0");
const PLACE_LABEL: Record<string, string> = { home: "Home", school: "School", now: "Now" };
const logoSrc = (l: string) => (/^(\/|https?:)/.test(l) ? l : `/images/${l}`); // content stores the bare file name

// the exact mark silhouette (eye punched out) as a CSS mask over the foil texture
const G = ouroPath();
const MASK_URL = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"><mask id="e"><rect x="-50" y="-50" width="100" height="100" fill="#fff"/><circle cx="${G.eye[0]}" cy="${G.eye[1]}" r="${G.eye[2]}" fill="#000"/></mask><path d="${G.d}" fill="#000" mask="url(#e)"/></svg>`)}")`;

/** Foil-stamped mark: the mark silhouette masking the foil layer, whose sheen slides with the pointer. */
function Fm({ cls = "" }: { cls?: string }) {
  return <span className={`fo-fm${cls ? " " + cls : ""}`} role="img" aria-label="Rithvik Praveen Kumar"><i /></span>;
}

/** Numbered section kicker. */
const Kick = ({ n, label }: { n: string; label: string }) => <p className="fo-kick"><span className="fo-kick-n">{n}</span>{label}</p>;

/** The whole Foil site. */
export default function Foil({ content: C }: DesignProps) {
  const { openCase } = useSite();
  const root = useRef<HTMLDivElement>(null);
  const [hasFoil, setHasFoil] = useState(false);
  useFoilMotion(root, openCase);

  // the foil texture loads after first paint; until then the foil areas use a gradient
  useEffect(() => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => setHasFoil(true);
    const idle = window.requestIdleCallback || ((f: () => void) => setTimeout(f, 300) as unknown as number);
    const cancel = window.cancelIdleCallback || clearTimeout;
    const id = idle(() => { img.src = "/v7/foil/foil-1024.webp"; });
    return () => { img.onload = null; cancel(id as number); };
  }, []);

  // the shader spec is fixed (no per-visitor baking), so it can mount straight away
  const spec = useMemo(() => META.shader, []);
  // one answer open at a time
  const oneOpen = (e: SyntheticEvent<HTMLDetailsElement>) => {
    const d = e.currentTarget;
    if (d.open) d.parentElement?.querySelectorAll("details").forEach((o) => { if (o !== d) o.open = false; });
  };
  const hide = (e: SyntheticEvent<HTMLImageElement>) => e.currentTarget.remove();
  const total = pad(C.projects.length);

  return (
    <main className="stage" id="stage" tabIndex={-1}>
      <div className={`fo${hasFoil ? " has-foil" : ""}`} style={{ "--fo-mk": MASK_URL } as CSSProperties} ref={root}>
        <svg className="fo-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
          <linearGradient id="fo-foil" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(0 .5 .5)">
            {FOIL.concat(FOIL[0]).map((c, i, a) => <stop key={i} offset={(i / (a.length - 1)).toFixed(2)} stopColor={c} />)}
          </linearGradient>
        </defs></svg>

        <header className="fo-nav" aria-label="Site">
          <a className="fo-logo" href="#top" aria-label={`${C.name}, back to top`}><Fm /><span aria-hidden="true">RPK</span></a>
          <nav className="fo-links" aria-label="Sections"><a href="#work">Work</a><a href="#experience">Path</a><a href="#graph">Map</a><a href="#play">Play</a><a href="#contact">Contact</a></nav>
          <div className="fo-nav-r">
            <a className="fo-btn fo-btn-s" href="#" data-resume="">Resume</a>
            <button type="button" className="fo-ic" data-compose="Internship opportunity" aria-label={`Email ${C.first}`}><Icon name="mail" /></button>
          </div>
        </header>

        <section className="fo-hero" id="top" aria-labelledby="fo-h1">
          <div className="fo-hero-in">
            <div className="fo-hero-txt">
              <p className="fo-eyebrow"><span className="fo-dot" aria-hidden="true" />{C.role}</p>
              <h1 id="fo-h1" className="fo-h1"><span>{C.first}</span><span>{C.last}</span></h1>
              <p className="fo-lede">{C.line}</p>
              <p className="fo-status"><span className="fo-pulse" aria-hidden="true" />{C.status}</p>
              <div className="fo-acts">
                <a className="fo-btn fo-btn-foil" href="#" data-resume="">Resume <Icon name="arrow-up-right" /></a>
                <button type="button" className="fo-btn" data-compose="Internship opportunity"><Icon name="mail" />Email me</button>
                <button type="button" className="fo-btn fo-btn-ghost" data-agent=""><span className="fo-prompt" aria-hidden="true">❯</span>Ask my agent</button>
              </div>
            </div>
            <div className="fo-hero-card">
              <div className="fo-tilt" id="fo-tilt">
                <article className="fo-card" aria-label={`${C.first}'s card`}>
                  <div className="fo-card-gl" id="fo-gl" aria-hidden="true" />
                  <div className="fo-card-top"><span className="fo-card-mk" aria-hidden="true"><Fm /></span><b>{C.initials}</b><span>Holo · 1 of 1</span></div>
                  <button type="button" className="fo-card-art" aria-label="Spin the mark"><span className="fo-deboss"><span className="fo-deboss-hi"><Mark label="" /></span><span className="fo-deboss-ink"><Mark label="" /></span></span></button>
                  <div className="fo-card-plate">
                    <p className="fo-lent" id="fo-lent"><span className="fo-lent-a">{C.name}</span><span className="fo-lent-b" aria-hidden="true">{C.role}</span><i className="fo-lent-r" aria-hidden="true" /></p>
                    <dl className="fo-stats">{C.numbers.slice(0, 3).map(([n, l]) => <div key={l}><dt>{n}</dt><dd>{l}</dd></div>)}</dl>
                  </div>
                  <i className="fo-card-glare" aria-hidden="true" />
                </article>
              </div>
              <p className="fo-hint" aria-hidden="true"><span className="fo-hint-f">Move to tilt the card</span><span className="fo-hint-c">Drag across the card to tilt it</span></p>
            </div>
          </div>
        </section>

        <section className="fo-sec fo-about" id="about" aria-labelledby="fo-h-about">
          <div className="fo-about-grid">
            <div className="fo-sleeve"><Portrait id="foil" className="fo-pt" /></div>
            <div className="fo-about-txt">
              <Kick n="01" label="About" />
              <h2 id="fo-h-about" className="fo-h2">Hi, I&apos;m {C.first}.</h2>
              {C.about.map((a, i) => <p key={i} className="fo-p">{a}</p>)}
              <ul className="fo-thesis">{C.thesis.map((t) => <li key={t}><i aria-hidden="true" />{t}</li>)}</ul>
            </div>
          </div>
          <div className="fo-now" id="now" aria-label="Right now">
            <dl className="fo-now-l">
              <div><dt>Building</dt><dd>{C.now.building}</dd></div>
              <div><dt>Researching</dt><dd>{C.now.researching}</dd></div>
              <div><dt>Learning</dt><dd>{C.now.learning}</dd></div>
            </dl>
            <ul className="fo-places" aria-label="Places">{C.places.map((pl) => <li key={pl.key} className={pl.key === "now" ? "is-now" : ""}><span>{PLACE_LABEL[pl.key] || pl.key}</span><b>{pl.city}</b><Clock tz={pl.tz} className="" /></li>)}</ul>
          </div>
        </section>

        <section className="fo-sec fo-work" id="work" aria-labelledby="fo-h-work">
          <header className="fo-sec-h"><Kick n="02" label="Work" /><h2 id="fo-h-work" className="fo-h2">The set</h2><p className="fo-sub">{countWord(C.projects.length)} projects, from headsets to the cloud. Every card opens.</p></header>
          <ul className="fo-set" id="fo-set">{C.projects.map((p, i) => (
            <li key={p.slug} className="fo-pc-li">
              <a className="fo-pc" id={`project-${p.slug}`} href={`/work/${p.slug}`} data-fo-case={p.slug} style={{ "--h": `${(i * 57) % 360}deg`, "--hp": `${((i * 57) % 360) / 3.6}%` } as CSSProperties} aria-label={`${p.title}: ${p.headline}. Open the case`}>
                <span className="fo-pc-top"><span className="fo-pc-n">No. {pad(i + 1)}<i>/{total}</i></span><span className="fo-pc-kind">{p.kind}</span></span>
                <span className="fo-pc-art" aria-hidden="true">
                  <span className="fo-pc-holo"><i /></span>
                  <span className="fo-pc-glit"><i /></span>
                  <span className="fo-pc-ic"><span className="fo-pc-ic-hi"><Icon name={p.icon} /></span><span className="fo-pc-ic-ink"><Icon name={p.icon} /></span></span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="fo-pc-img" src={`/v7/projects/${p.slug}.webp`} alt="" width={1280} height={960} loading="lazy" decoding="async" onError={hide} />
                  <span className="fo-pc-wm"><Mark label="" /></span>
                </span>
                <span className="fo-pc-t">{p.title}</span>
                <span className="fo-pc-h">{p.headline}</span>
                <span className="fo-pc-stats">
                  <span><b>Stack</b>{p.tags.join(" · ")}</span>
                  <span><b>Context</b>{p.ctx}</span>
                </span>
                <span className="fo-pc-go">Open the case <Icon name="arrow-up-right" /></span>
              </a>
            </li>
          ))}</ul>
        </section>

        <section className="fo-sec fo-exp" id="experience" aria-labelledby="fo-h-exp">
          <header className="fo-sec-h"><Kick n="03" label="Path" /><h2 id="fo-h-exp" className="fo-h2">Where I&apos;ve worked</h2></header>
          <ol className="fo-roles">
            {C.experience.map((x) => (
              <li key={x.slug} className="fo-role" id={`experience-${x.slug}`}>
                <p className="fo-when">{x.when}<span>{x.where}</span></p>
                <div className="fo-role-h"><h3>{x.role}</h3><p>{x.org}</p></div>
                <div className="fo-role-b"><ul>{x.desc.map((d, i) => <li key={i}>{d}</li>)}</ul><p className="fo-tags">{x.tags.map((t) => <span key={t}>{t}</span>)}</p></div>
              </li>
            ))}
          </ol>
          <article className="fo-edu" id="education" aria-label="Education">
            <span className="fo-edu-badge">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc(C.education.logo)} alt={C.education.school} width={56} height={56} loading="lazy" decoding="async" />
            </span>
            <div><p className="fo-edu-k">Education</p><h3>{C.education.school}</h3><p>{C.education.degree}</p></div>
            <p className="fo-edu-m">{C.education.focus}{C.education.grad && <><br />{C.education.grad}</>}</p>
          </article>
        </section>

        <section className="fo-sec fo-map" id="graph" aria-labelledby="fo-h-map">
          <header className="fo-sec-h"><Kick n="04" label="Map" /><h2 id="fo-h-map" className="fo-h2">Everything, connected</h2><p className="fo-sub">Fields, projects, roles and skills on one map. Hover to trace a thread; click to open it.</p></header>
          <KnowledgeGraph id="foil" />
        </section>

        <section className="fo-sec fo-play" id="play" aria-labelledby="fo-h-play">
          <header className="fo-sec-h"><Kick n="05" label="Play" /><h2 id="fo-h-play" className="fo-h2">Stickers</h2><p className="fo-sub">{countWord(PLAY.length)} small toys. The games keep my score next to yours.</p></header>
          <ul className="fo-stickers">{PLAY.map((t, i) => (
            <li key={t.id}><button type="button" className="fo-st" data-play={t.id} style={{ "--h": `${(i * 61) % 360}deg` } as CSSProperties} aria-label={`Play ${t.name}: ${t.desc}`}>
              <span className="fo-st-disc" aria-hidden="true"><i className="fo-st-foil" /><i className="fo-st-glit" /><span className="fo-st-ic"><Icon name={t.icon} /></span></span>
              <span className="fo-st-t">{t.name}</span><span className="fo-st-d">{t.desc}</span>
            </button></li>
          ))}</ul>
        </section>

        <section className="fo-sec fo-faq" id="faq" aria-labelledby="fo-h-faq">
          <div className="fo-faq-l"><Kick n="06" label="Questions" /><h2 id="fo-h-faq" className="fo-h2">Short answers</h2><p className="fo-sub">Anything else, <button type="button" className="fo-inl" data-agent="">ask my agent</button>. It only answers from what&apos;s on record.</p></div>
          <div className="fo-qs">{C.faq.map(([q, a]) => <details key={q} className="fo-q" onToggle={oneOpen}><summary>{q}<i aria-hidden="true" /></summary><p>{a}</p></details>)}</div>
        </section>

        <section className="fo-sec fo-contact" id="contact" aria-labelledby="fo-h-contact">
          <Kick n="07" label="Contact" />
          <span className="fo-seal" aria-hidden="true"><Fm cls="fo-fm-l" /></span>
          <h2 id="fo-h-contact" className="fo-big">Write to me.</h2>
          <p className="fo-sub fo-c">Open to SWE and AI internships. The message goes straight to my inbox.</p>
          <div className="fo-acts fo-c">
            <button type="button" className="fo-btn fo-btn-foil fo-btn-l" data-compose="Internship opportunity"><Icon name="mail" />Write an email</button>
            <button type="button" className="fo-btn" data-copy={C.links.email}><Icon name="copy" />{C.links.email}</button>
          </div>
          <ul className="fo-out">
            <li><a href={C.links.github} target="_blank" rel="noopener"><Logo slug="github" />GitHub</a></li>
            <li><a href={C.links.linkedin} target="_blank" rel="noopener"><Logo slug="linkedin" />LinkedIn</a></li>
            <li><a href="#" data-resume=""><Icon name="file-text" />Resume</a></li>
            <li><a href="#" data-agent=""><Icon name="terminal" />Agent</a></li>
          </ul>
        </section>

        <footer className="fo-foot" id="colophon">
          <span className="fo-foot-mk" aria-hidden="true"><Fm /></span>
          <p>{C.name} · {C.status}</p>
          <p className="fo-colo">The card is one fragment shader: thin-film interference over a noise height map, lit by your pointer. The photo is never touched. Set in Unbounded and Geist.</p>
        </footer>
        <div className="fo-mosh" aria-hidden="true" hidden />
      </div>
      <ShaderCanvas spec={spec} dark={META.dark} />
    </main>
  );
}
