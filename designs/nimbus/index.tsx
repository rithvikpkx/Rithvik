"use client";
// Nimbus: a bright, airy sky world. A skin on the shared layout (designs/PORTING.md). The shader clouds live only in
// the hero (the sun rides the visitor's hour); pixel clouds elsewhere are static and move only on interaction (card
// hover, band clouds fleeing the pointer, stamp hover) or as slow drifts while their section is on screen.
// html.lite and reduced motion stop the trail, drifts and drop-shadow filters, leaving a designed still.
import { useMemo, useRef, type FormEvent, type SyntheticEvent } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionProps, Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import { useSite } from "@/components/site/SiteProvider";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import Mark from "@/components/site/mark/Mark";
import { Icon } from "@/components/site/Glyph";
import { DEFS, ON_SKY, glyph, hourIn, icon16, isDay, skyShader, skyTile } from "./pixel";
import { clock, useTick, useVisitorHour } from "./time";
import { useNimbusMotion } from "./motion";
import { XP } from "./experience";
import NimbusName from "./name-fx";
import NimbusPortrait from "./portrait-fx";
import "./nimbus.css";

const META = designById("nimbus")!;
const pad = (i: number) => String(i + 1).padStart(2, "0");
const PLACE_LABEL: Record<string, string> = { home: "Home", school: "School", now: "Now" };
const bullet = <span className="nb-bullet" aria-hidden="true"><Mark label="" /></span>;

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

/** Work: sky tiles, one per project. */
function Work({ content: C }: SectionProps) {
  return (
    <div className="nb-cards">
      {C.projects.map((p, i) => (
        <a key={p.slug} id={`project-${p.slug}`} className="nb-card" href={`/work/${p.slug}`} data-case={p.slug} aria-label={`${p.title}: ${p.headline}. Open the case`}>
          <span className="nb-card-sky">
            <Px className="nb-drift" html={skyTile(11 + i * 17, 64, 20, 32, -0.34 - (i % 3) * 0.04, 0.55, "nb-tile")} />
            <Px className="nb-card-ic" html={icon16(p.slug, ON_SKY)} />
            <span className="nb-card-n">{pad(i)}</span>
            <span className="nb-card-kind"><Icon name={p.icon} /><span data-edit={`project:${p.slug}:kind`}>{p.kind}</span></span>
            <span className="nb-card-go" aria-hidden="true"><Icon name="arrow-up-right" /></span>
          </span>
          <span className="nb-card-tags">{p.tags.slice(0, 3).map((t) => <span key={t}>{t}</span>)}</span>
          <span className="nb-card-t" data-edit={`project:${p.slug}:title`}>{p.title}</span>
          <span className="nb-card-h" data-edit={`project:${p.slug}:headline`}>{p.headline}</span>
        </a>
      ))}
    </div>
  );
}


/** About: the text and thesis chips, then today's forecast card and the numbers. */
function About({ content: C }: SectionProps) {
  return (
    <>
      <div className="nb-about-txt">
        {C.about.map((a, i) => <p className="nb-p" key={i} data-edit={`v7.about.${i}`}>{a}</p>)}
        <ul className="nb-thesis">{C.thesis.map((t, i) => <li key={i}>{bullet}<span data-edit={`v7.thesis.${i}`}>{t}</span></li>)}</ul>
      </div>
      <div className="nb-now" id="now">
        <article className="nb-wx" aria-label={`${C.first} right now`}>
          <WxTop city={C.now.city} tz={C.now.tz} />
          <ul className="nb-wx-rows">
            <li><Px html={glyph("sun")} /><span>Building</span><b data-edit="v7.now.building">{C.now.building}</b></li>
            <li><Px html={glyph("part")} /><span>Researching</span><b data-edit="v7.now.researching">{C.now.researching}</b></li>
            <li><Px html={glyph("bolt")} /><span>Learning</span><b data-edit="v7.now.learning">{C.now.learning}</b></li>
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
        <dl className="nb-nums">{C.numbers.map(([n, l], i) => <div key={l}><dt data-edit={`numbers.${i}.v`}>{n}</dt><dd data-edit={`numbers.${i}.l`}>{l}</dd></div>)}</dl>
      </div>
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
    <div className="nb-faq">
      <div className="nb-faq-l">
        <form className="nb-ask" autoComplete="off" onSubmit={ask}>
          <label htmlFor="nb-ask-in" className="sr-only">Ask the agent</label>
          <span className="nb-prompt" aria-hidden="true">❯</span>
          <input id="nb-ask-in" name="q" type="text" maxLength={500} placeholder="What stack did BoilerFrame use?" />
          <button type="submit" className="nb-round nb-ink" aria-label="Ask"><Icon name="arrow-up" /></button>
        </form>
      </div>
      <div className="nb-qs">
        {C.faq.map(([q, a], i) => (
          <details className="nb-q" key={q} onToggle={oneOpen}><summary><span data-edit={`faq.${i}.q`}>{q}</span><span className="nb-plus" aria-hidden="true" /></summary><p data-edit={`faq.${i}.a`}>{a}</p></details>
        ))}
      </div>
    </div>
  );
}

/** Contact: one big line and the composer. */
function Contact() {
  return (
    <>
      <p className="nb-h-big">Write to me.</p>
      <div className="nb-acts nb-c">
        <button type="button" className="nb-btn nb-ink nb-px-c nb-btn-lg" data-compose="Internship opportunity"><Icon name="mail" />Write an email</button>
      </div>
    </>
  );
}

const SKIN: Skin = {
  id: "nimbus",
  ...XP,
  rootClass: "nb",
  labels: { play: "Recess" },
  sectionClass: (id) => `nb-sec nb-${{ work: "work", experience: "exp", about: "about", play: "play", questions: "faq", contact: "contact" }[id]}`,
  titleClass: "nb-h2",
  sections: { work: Work, about: About, questions: Questions, contact: Contact },
  NameFx: NimbusName,
  PortraitFx: NimbusPortrait,
};

/** The whole Nimbus site: the shared layout under a pixel sky that follows the visitor's clock. */
export default function Nimbus({ content }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  useNimbusMotion(root);
  const hr = useVisitorHour();
  // the sun rides the visitor's hour, so the shader mounts only once that is known (client)
  const spec = useMemo(() => (hr === null ? undefined : skyShader(META.shader!, hr)), [hr]);
  return (
    <SiteLayout content={content} skin={SKIN} rootRef={root} hero={<div className="nb-sky" id="nb-sky" aria-hidden="true" />}>
      <svg className="nb-defs" width="0" height="0" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: DEFS }} />
      <div className="nb-trail" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} />)}</div>
      <ShaderCanvas spec={spec} dark={false} />
    </SiteLayout>
  );
}
