"use client";
/* eslint-disable @next/next/no-img-element -- fixed art with a hand-written srcset; logo comes from content */
// Mercury: a graphite studio with one heavy pool of liquid chrome. A skin on the shared layout (designs/PORTING.md).
// The shader moves only while the hero or Contact is on screen (metaballs, then ferrofluid that reaches for the
// pointer); between them its host is hidden so the runtime pauses. Reading sections are solid graphite, each opened
// by a chrome meniscus that rings once. html.lite / reduced motion: still shader frame, flat dividers, no drift.
import { useRef, type FormEvent, type SyntheticEvent } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionId, SectionProps, Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import { PLAY } from "@/lib/play/games";
import { useSite } from "@/components/site/SiteProvider";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import Mark from "@/components/site/mark/Mark";
import Clock from "@/components/site/Clock";
import { Icon } from "@/components/site/Glyph";
import { useMercuryMotion } from "./motion";
import { XP } from "./experience";
import "./mercury.css";

const META = designById("mercury")!;
const pad = (i: number) => String(i + 1).padStart(2, "0");
const PLACE_LABEL: Record<string, string> = { home: "Home", school: "School", now: "Now" };
const TILT = [-14, 9, -6, 16, -10, 5];
const hideFig = (e: SyntheticEvent<HTMLImageElement>) => { (e.currentTarget.parentNode as HTMLElement).hidden = true; };

// a chrome meniscus: convex ends (mercury's meniscus bulges) and a wave that rings once on entry
const WAVE = (() => {
  let d = "";
  for (let x = 70; x <= 1130; x += 5) { const e = Math.exp(-(((x - 600) / 250) ** 2)), y = 20 - 10 * Math.cos((x - 600) / 34) * e; d += (x === 70 ? "M" : "L") + x + " " + y.toFixed(2); }
  return d;
})();

/** Section ornament: a chrome meniscus line (Contact sits over the pool and has none). */
function Divider({ id }: { id: SectionId }) {
  if (id === "contact") return null;
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

/** Work: a calm index; titles take a chrome sheen on hover. */
function Work({ content: C }: SectionProps) {
  return (
    <ol className="mc-work">
      {C.projects.map((p, i) => (
        <li key={p.slug} id={`project-${p.slug}`}>
          <a className="mc-row" href={`/work/${p.slug}`} data-case={p.slug} aria-label={`${p.title}: ${p.headline}. Open the case`}>
            <span className="mc-n">{pad(i)}</span><span className="mc-t" data-edit={`project:${p.slug}:title`}>{p.title}</span><span className="mc-k"><Icon name={p.icon} /><span data-edit={`project:${p.slug}:kind`}>{p.kind}</span></span><span className="mc-hl" data-edit={`project:${p.slug}:headline`}>{p.headline}</span><span className="mc-go"><Icon name="arrow-up-right" /></span>
          </a>
        </li>
      ))}
    </ol>
  );
}


/** About: the text and thesis, the numbers in chrome, then now + places. */
function About({ content: C }: SectionProps) {
  return (
    <>
      <div className="mc-about-txt">
        {C.about.map((a, i) => <p className="mc-p" key={i} data-edit={`v7.about.${i}`}>{a}</p>)}
        <ul className="mc-thesis">{C.thesis.map((t, i) => <li key={i}><span className="mc-bul" aria-hidden="true"><Mark label="" /></span><span data-edit={`v7.thesis.${i}`}>{t}</span></li>)}</ul>
      </div>
      <dl className="mc-nums">{C.numbers.map(([n, l], i) => <div key={l}><dt data-edit={`numbers.${i}.v`}>{n}</dt><dd data-edit={`numbers.${i}.l`}>{l}</dd></div>)}</dl>
      <div className="mc-now" id="now">
        <ul className="mc-now-list">
          <li><span>Building</span><b data-edit="v7.now.building">{C.now.building}</b></li>
          <li><span>Researching</span><b data-edit="v7.now.researching">{C.now.researching}</b></li>
          <li><span>Learning</span><b data-edit="v7.now.learning">{C.now.learning}</b></li>
        </ul>
        <ol className="mc-places" aria-label="Places">
          {C.places.map((pl) => (
            <li key={pl.key} className={pl.key === "now" ? "is-now" : ""}><span className="mc-pk">{PLACE_LABEL[pl.key] ?? pl.key}</span><b>{pl.city}</b><Clock tz={pl.tz} className="mc-pt-clock" /></li>
          ))}
        </ol>
      </div>
    </>
  );
}

/** Play: the chrome ribbon, then one sphere per toy. */
function Play() {
  return (
    <>
      <figure className="mc-ribbon" aria-hidden="true"><img src="/v7/mercury/chrome-ribbon-1200.webp" srcSet="/v7/mercury/chrome-ribbon-1200.webp 1200w, /v7/mercury/chrome-ribbon-2400.webp 2400w" sizes="(max-width: 700px) 160vw, 100vw" width={2400} height={1340} alt="" loading="lazy" decoding="async" onError={hideFig} /></figure>
      <ul className="mc-toys">
        {PLAY.map((t, i) => (
          <li key={t.id}>
            <button type="button" className="mc-toy" data-play={t.id} aria-label={`Play ${t.name}: ${t.desc}`} style={{ ["--tilt" as string]: `${TILT[i % 6]}deg` }}>
              <span className="mc-sphere" aria-hidden="true"><i /></span><span className="mc-toy-n"><Icon name={t.icon} />{t.name}</span><span className="mc-toy-d">{t.desc}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Questions: the ask box (hands off to the agent) beside short answers, one open at a time. */
function Questions({ content: C }: SectionProps) {
  const { openAgent } = useSite();
  const ask = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const inp = e.currentTarget.elements.namedItem("q") as HTMLInputElement, q = inp.value.trim();
    openAgent(q || undefined); inp.value = "";
  };
  const oneOpen = (e: SyntheticEvent<HTMLDetailsElement>) => {
    const d = e.currentTarget;
    if (d.open) d.parentElement?.querySelectorAll("details").forEach((o) => { if (o !== d) o.open = false; });
  };
  return (
    <div className="mc-faq">
      <div className="mc-faq-l">
        <form className="mc-ask" autoComplete="off" onSubmit={ask}>
          <label htmlFor="mc-ask-in" className="sr-only">Ask the agent</label>
          <span className="mc-prompt" aria-hidden="true">❯</span>
          <input id="mc-ask-in" name="q" type="text" maxLength={500} placeholder="What stack did BoilerFrame use?" />
          <button type="submit" aria-label="Ask"><Icon name="arrow-up" /></button>
        </form>
      </div>
      <div className="mc-qs">
        {C.faq.map(([q, a], i) => (
          <details className="mc-q" key={q} onToggle={oneOpen}><summary><span data-edit={`faq.${i}.q`}>{q}</span><span className="mc-plus" aria-hidden="true" /></summary><p data-edit={`faq.${i}.a`}>{a}</p></details>
        ))}
      </div>
    </div>
  );
}

/** Contact: over the ferrofluid pool, one line and the composer. */
function Contact() {
  return (
    <div className="mc-contact-in">
      <div className="mc-contact-txt">
        <p className="mc-big"><span className="mc-chrome-t">Write</span> <em>to me.</em></p>
        <div className="mc-acts"><button type="button" className="mc-btn mc-solid" data-compose="Internship opportunity"><Icon name="mail" />Write an email</button></div>
      </div>
      <figure className="mc-mark-art" aria-hidden="true"><img src="/v7/mercury/chrome-mark-800.webp" srcSet="/v7/mercury/chrome-mark-800.webp 800w, /v7/mercury/chrome-mark-1600.webp 1600w" sizes="(max-width: 700px) 44vw, 34vw" width={800} height={800} alt="" loading="lazy" decoding="async" onError={hideFig} /></figure>
    </div>
  );
}

const SKIN: Skin = {
  id: "mercury",
  ...XP,
  rootClass: "mc",
  sectionClass: (id) => (id === "contact" ? "mc-contact" : id === "play" ? "mc-sec mc-play" : "mc-sec"),
  titleClass: "mc-h2",
  SectionOrnament: Divider,
  sections: { work: Work, about: About, play: Play, questions: Questions, contact: Contact },
};

/** The whole Mercury site: the shared layout over one fixed chrome pool. */
export default function Mercury({ content }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  useMercuryMotion(root);
  return (
    <SiteLayout content={content} skin={SKIN} rootRef={root}>
      <svg className="mc-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs><linearGradient id="mc-steel" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1200" y2="0"><stop offset="0" stopColor="#4d5058" /><stop offset=".3" stopColor="#b9bcc4" /><stop offset=".5" stopColor="#ffffff" /><stop offset=".7" stopColor="#b9bcc4" /><stop offset="1" stopColor="#4d5058" /></linearGradient></defs></svg>
      <div className="mc-gl" id="mc-gl" aria-hidden="true" />
      <ShaderCanvas spec={META.shader} dark={META.dark} />
    </SiteLayout>
  );
}
