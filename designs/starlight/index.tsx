"use client";
// Starlight: the whole site seen through a night-vision tube. A skin on the shared layout (designs/PORTING.md).
// The shader draws the night scene (stars, treeline, field), tube vignette and grain; the pointer is an IR light in
// the shader and, in the DOM, reveals small annotations (motion.ts). The hero carries the tube's HUD and the
// phosphor switch (P43 green / P45 white), the look's one themed control. Halation is text-shadow on headings only.
// Performance mode (html.lite) and reduced motion stop the flare, ring, gain jitter and IR loop.
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionProps, Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import { PLAY } from "@/lib/play/games";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import Clock from "@/components/site/Clock";
import { Icon } from "@/components/site/Glyph";
import EduMeta from "@/components/site/EduMeta";
import { deg } from "./geo";
import { useStarlightMotion, type Flare } from "./motion";
import "./starlight.css";

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

/** Sightings: one locked-on target per project; the IR light reveals its context line. */
function Work({ content: C }: SectionProps) {
  return (
    <ol className="sl-targets">
      {C.projects.map((p, i) => (
        <li key={p.slug} id={`project-${p.slug}`}>
          <a className="sl-tg" href={`/work/${p.slug}`} data-case={p.slug} aria-label={`${p.title}: ${p.headline}. Open the case`}>
            <span className="sl-tg-n">T-{pad(i)}</span>
            <span className="sl-tg-b">
              <span className="sl-tg-t" data-edit={`project:${p.slug}:title`}>{p.title}</span>
              <span className="sl-tg-h" data-edit={`project:${p.slug}:headline`}>{p.headline}</span>
              <span className="sl-tg-ir sl-ir" data-ir=""><Icon name="crosshair" /><span data-edit={`project:${p.slug}:ctx`}>{p.ctx}</span></span>
            </span>
            <span className="sl-tg-k" data-edit={`project:${p.slug}:kind`}>{p.kind}</span>
            <span className="sl-tg-go" aria-hidden="true"><Icon name="arrow-up-right" /></span>
            <i className="sl-lock" aria-hidden="true"><i /><i /><i /><i /></i>
          </a>
        </li>
      ))}
    </ol>
  );
}

/** The log: roles with a time column, then the degree. */
function Experience({ content: C }: SectionProps) {
  return (
    <>
      <ol className="sl-log">
        {C.experience.map((x) => (
          <li className="sl-role" id={`experience-${x.slug}`} key={x.slug}>
            <p className="sl-when"><time data-edit={`role:${x.slug}:when`}>{x.when}</time><span data-edit={`role:${x.slug}:where`}>{x.where}</span></p>
            <div className="sl-role-b">
              <h3 data-edit={`role:${x.slug}:role`}>{x.role}</h3>
              <p className="sl-org" data-edit={`role:${x.slug}:org`}>{x.org}</p>
              <ul>{x.desc.map((d, i) => <li key={i} data-edit={`role:${x.slug}:desc.${i}`}>{d}</li>)}</ul>
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
          <h3 data-edit="edu:school">{C.education.school}</h3>
          <p data-edit="edu:degree">{C.education.degree}</p>
          <p className="sl-edu-m"><EduMeta e={C.education} /></p>
        </div>
      </div>
    </>
  );
}

/** Field notes: the text, now + places with coordinates, then the numbers. */
function About({ content: C }: SectionProps) {
  return (
    <>
      <div className="sl-about-t">{C.about.map((a, i) => <p key={i} data-edit={`v7.about.${i}`}>{a}</p>)}</div>
      <div className="sl-now" id="now">
        <dl className="sl-now-l">
          <div><dt>Building</dt><dd data-edit="v7.now.building">{C.now.building}</dd></div>
          <div><dt>Researching</dt><dd data-edit="v7.now.researching">{C.now.researching}</dd></div>
          <div><dt>Learning</dt><dd data-edit="v7.now.learning">{C.now.learning}</dd></div>
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
      <dl className="sl-nums">{C.numbers.map(([n, l], i) => <div key={l}><dt data-edit={`numbers.${i}.v`}>{n}</dt><dd data-edit={`numbers.${i}.l`}>{l}</dd></div>)}</dl>
    </>
  );
}

/** Night games: one channel per toy. */
function Play() {
  return (
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
  );
}

/** Signal: one line and the composer. */
function Contact() {
  return (
    <>
      <p className="sl-h-big">Send a signal.</p>
      <div className="sl-acts"><button type="button" className="sl-btn sl-hot sl-cta sl-btn-lg" data-compose="Internship opportunity"><Icon name="mail" />Write an email</button></div>
    </>
  );
}

const SKIN: Skin = {
  id: "starlight",
  rootClass: "sl",
  labels: { work: "Sightings", experience: "Log", about: "Notes", contact: "Signal" },
  sectionClass: (id) => `sl-sec sl-${{ work: "work", experience: "exp", about: "about", play: "play", questions: "faq", contact: "contact" }[id]}`,
  titleClass: "sl-h2",
  sections: { work: Work, experience: Experience, about: About, play: Play, contact: Contact },
};

/** The whole Starlight site: the shared layout seen through an image-intensifier tube. */
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
    flare.current(innerWidth - 120, 120, 0.5);
  };

  const hero = (
    <div className="sl-hud">
      <p className="sl-read" aria-hidden="true"><span>GAIN <b data-sl-gain="">0.82</b></span><span className="sl-bat">BAT <i className="sl-cells" data-sl-cells="" data-lv="4"><i /><i /><i /><i /></i><b data-sl-bat="">EXT</b></span><span><b data-sl-ts="">--:--:--</b></span></p>
      <button type="button" className="sl-phos" aria-pressed={white} title="Switch phosphor" onClick={togglePh}><i aria-hidden="true" /><span>{white ? "P45 White" : "P43 Green"}</span></button>
    </div>
  );
  return (
    <SiteLayout content={C} skin={SKIN} rootRef={root} hero={hero}>
      <ShaderCanvas spec={META.shader} dark={META.dark} />
      <div className="sl-flare" aria-hidden="true" />
      <div className="sl-wps" aria-hidden="true">
        {C.places.map((pl, i) => (
          <span className="sl-wp sl-ir" data-ir="" style={{ left: `${WP_LEFT[i] ?? 20 + i * 15}%` }} key={pl.key}>
            <b>{pl.city}</b><span>{deg(pl.lat, "N", "S")} {deg(pl.lng, "E", "W")} · {PLACE[pl.key] ?? pl.key}</span><i />
          </span>
        ))}
      </div>
      <aside className="sl-coords" aria-hidden="true">
        {C.places.map((pl) => (
          <p key={pl.key}><b>{ABBR[pl.key] ?? ""}</b><span>{deg(pl.lat, "N", "S")}</span><span>{deg(pl.lng, "E", "W")}</span><Clock tz={pl.tz} className="" /></p>
        ))}
      </aside>
      <aside className="sl-ruler" aria-hidden="true"><i className="sl-ruler-s" /><span className="sl-ruler-m" data-sl-el="">EL +09°</span></aside>
      <div className="sl-ring" aria-hidden="true"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="92" /><path d="M100 2v12M100 186v12M2 100h12M186 100h12" /><path className="sl-ring-arc" d="M30 54A92 92 0 0 1 54 30" /></svg><span data-sl-ring="">IR · AZ 270° · EL +09°</span></div>
    </SiteLayout>
  );
}
