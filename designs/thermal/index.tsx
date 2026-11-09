"use client";
// Thermal: an infrared camera reading the warmth of his work (port of docs/mockups/v7/themes/thermal.js; see
// designs/PORTING.md). A cool, dark instrument where heat is the only colour event.
// Where each effect lives: the false-colour heat field (shader) is hosted inside #top only, so it stops rendering
// once the hero scrolls away; the palette switch (iron / rainbow / white hot) re-maps the shader, scale bar,
// hot-spot frames and accents together, driving the shader's own `u_pv` uniform through the runtime; the spot
// meter follows a fine pointer; hot-spot frames and the contact strip are tiny BMP heat images that warm on hover.
// The portrait is never filtered. html.lite = one still heat frame, no haze, no trail.
import { useMemo, useRef, useState, type MouseEvent } from "react";
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
import { PALS, T_MAX, T_MIN, W, HH, bmp, heatGrid, palIndex, rankByTools, stripGrid, type PalId } from "./heat";
import { readPal, useThermalMotion } from "./motion";
import "./thermal.css";

const META = designById("thermal")!;
const PLACE_LABEL: Record<string, string> = { home: "Home", school: "School", now: "Now" };
const NAV: [string, string][] = [["work", "Work"], ["experience", "Record"], ["graph", "Map"], ["play", "Bench"], ["about", "About"], ["contact", "Contact"]];
const TOOL_LOGO: Record<string, string> = { Python: "python", JavaScript: "javascript", TypeScript: "typescript", "C++": "cplusplus", React: "react", "Next.js": "nextdotjs", "Node.js": "nodedotjs", Express: "express", TensorFlow: "tensorflow", Keras: "keras", "scikit-learn": "scikitlearn", Pandas: "pandas", MongoDB: "mongodb", Supabase: "supabase", Vercel: "vercel", Cloudflare: "cloudflare", "Google Apps Script": "googleappsscript", Arduino: "arduino", Ollama: "ollama" };
const logoSrc = (l: string) => (/^(\/|https?:)/.test(l) ? l : `/images/${l}`); // content stores the bare file name
const grids = new Map<string, ReturnType<typeof heatGrid>>(); // frames are deterministic per project: build once
const gridOf = (slug: string, tools: number) => { let g = grids.get(slug); if (!g) grids.set(slug, (g = heatGrid(slug, tools))); return g; };
const strip = stripGrid();
const goTo = (id: string) => (e: MouseEvent) => {
  const el = document.getElementById(id); if (!el) return;
  e.preventDefault();
  const lite = matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");
  el.scrollIntoView({ behavior: lite ? "auto" : "smooth", block: "start" });
};

/** A tool chip with its logo when we have one. */
function Chip({ t }: { t: string }) {
  return <span className="chip">{TOOL_LOGO[t] && <Logo slug={TOOL_LOGO[t]} />}{t}</span>;
}

/** Section index line ("01 Hot spots"). */
function Idx({ n, label }: { n: string; label: string }) {
  return <p className="th-idx"><span className="th-idx-n">{n}</span><span>{label}</span></p>;
}

/** A cool and a warm heat image stacked inside the haze wrapper (the warm one fades in on hover). */
function Heat({ f, cool, warm, w, h }: { f: string; cool: string; warm: string; w: number; h: number }) {
  return (
    <span className="th-haze"><span className="th-haze-in">
      {/* eslint-disable @next/next/no-img-element -- tiny generated data-URI frames */}
      <img className="th-f th-f-cool" data-f={f} src={cool} alt="" width={w} height={h} decoding="async" />
      <img className="th-f th-f-warm" data-f={f} src={warm} alt="" width={w} height={h} decoding="async" />
      {/* eslint-enable @next/next/no-img-element */}
    </span></span>
  );
}

/** The whole Thermal site. */
export default function Thermal({ content: C }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  const { pal, nuc, choose } = useThermalMotion(root);
  // the shader's first palette is the stored one at rest; later changes go through useShaderUniforms (the sweep)
  const [uniforms] = useState(() => { const i = palIndex(readPal()); return { u_pv: [i, i, 0] as [number, number, number] }; });
  const now = C.places.find((p) => p.key === "now");
  const ranked = useMemo(() => rankByTools(C.projects), [C.projects]);
  // frames re-colour only when the palette changes (14 tiny BMPs)
  const frames = useMemo(() => ranked.map((p) => {
    const g = gridOf(p.slug, p.tags.length);
    return { p, g, cool: bmp(g, pal, 0), warm: bmp(g, pal, 0.2) };
  }), [ranked, pal]);
  const stripImg = useMemo(() => ({ cool: bmp(strip, pal, 0), warm: bmp(strip, pal, 0.2) }), [pal]);
  const ed = C.education, em = C.links.email;
  const nowRows: [string, string][] = [["Building", C.now.building], ["Researching", C.now.researching], ["Learning", C.now.learning]];

  return (
    <main className="stage" id="stage" tabIndex={-1}>
      <div className="th" id="th" ref={root}>
        <svg className="th-defs" width="0" height="0" aria-hidden="true" focusable="false"><filter id="th-haze-f" x="-4%" y="-4%" width="108%" height="108%"><feTurbulence type="fractalNoise" baseFrequency=".014 .07" numOctaves="2" seed="7" /><feDisplacementMap in="SourceGraphic" scale="10" xChannelSelector="R" yChannelSelector="G" /></filter></svg>

        <nav className="th-nav" aria-label="Sections">
          <a className="th-brand" href="#top" onClick={goTo("top")}><span className="th-brand-mk" aria-hidden="true"><Mark label="" /></span><span>{C.name}</span></a>
          <ol className="th-navl">{NAV.map(([id, l], i) => <li key={id}><a href={`#${id}`} data-th-go={id} onClick={goTo(id)}><span>0{i + 1}</span>{l}</a></li>)}</ol>
          <div className="th-nav-r"><button type="button" className="th-nb" data-resume="">Resume</button><button type="button" className="th-nb th-nb-hot" data-compose="Internship opportunity"><Icon name="mail" /><span>Email</span></button></div>
        </nav>

        <section id="top" className="th-hero" aria-labelledby="th-name">
          <div className="th-ir" id="th-ir" aria-hidden="true" />
          <div className="th-vf" aria-hidden="true"><i /><i /><i /><i />
            <span className="th-vf-tl"><b className="th-rec" />IR · live</span>
            <span className="th-vf-tr"><Clock tz={C.now.tz} className="th-clk" /> {now ? now.city : C.now.city}</span>
            <span className={`th-vf-bl${nuc ? " on" : ""}`} id="th-nuc">{nuc ? "NUC · calibrating" : "e 0.95 · 9 Hz"}</span>
          </div>
          <div className="th-copy">
            <p className="th-status"><span className="th-dot" aria-hidden="true" />{C.status}</p>
            <h1 className="th-name" id="th-name"><span>{C.first}</span> <span>{C.last}</span></h1>
            <p className="th-role">{C.role}</p>
            <p className="th-line">{C.line}</p>
            <div className="th-acts">
              <button type="button" className="th-btn th-btn-hot" data-compose="Internship opportunity"><Icon name="mail" />Email me</button>
              <button type="button" className="th-btn" data-resume=""><Icon name="file-text" />Resume</button>
              <button type="button" className="th-btn th-btn-q" data-agent=""><Icon name="terminal" />Ask the agent</button>
            </div>
            <div className="th-pal" role="group" aria-label="Thermal palette">
              <span className="th-pal-l" aria-hidden="true">Palette</span>
              {PALS.map(([id, nm]) => (
                <button type="button" key={id} className="th-pal-b" aria-pressed={id === pal} onClick={() => choose(id as PalId)}><i className="th-ramp" data-ramp={id} aria-hidden="true" />{nm}</button>
              ))}
            </div>
          </div>
          <div className="th-ptw">
            <div className="th-pt-frame" aria-hidden="true"><i /><i /><i /><i /><span className="th-pt-l">Visible light · unfiltered</span></div>
            <Portrait id="thermal" />
          </div>
          <div className="th-scale" aria-hidden="true">
            <span className="th-scale-v">{T_MAX.toFixed(1)}</span>
            <div className="th-scale-bar"><i className="th-ramp th-ramp-v" data-ramp="live" /><b className="th-scale-mk" id="th-mk" /></div>
            <span className="th-scale-v">{T_MIN.toFixed(1)}</span>
            <span className="th-scale-u">°C · visual scale</span>
          </div>
          <div className="th-meter" id="th-meter" aria-hidden="true"><i className="th-cross" /><span className="th-meter-r"><b id="th-mv">31.4</b><span id="th-mu">°C</span></span></div>
        </section>

        <section id="work" className="th-sec" aria-labelledby="th-work-h">
          <header className="th-head"><Idx n="01" label="Hot spots" /><h2 className="th-h2" id="th-work-h">{countWord(C.projects.length)} builds, warmest first.</h2>
            <p className="th-sub">Each frame is drawn from a project&apos;s toolchain: more tools, more heat. A visual scale, not a measurement.</p></header>
          <ol className="th-spots">
            {frames.map(({ p, g, cool, warm }, i) => (
              <li className="th-spot" key={p.slug} id={`project-${p.slug}`}>
                <a className="th-spot-b" href={`/work/${p.slug}`} data-case={p.slug} aria-label={`${p.title}: ${p.headline}. Open the case`}>
                  <span className="th-frame">
                    <Heat f={p.slug} cool={cool} warm={warm} w={W} h={HH} />
                    <span className="th-f-tl">SP{i + 1}</span>
                    <span className="th-f-tr">{p.tags.length} tools</span>
                    <i className="th-max" style={{ left: `${(g.at[0] * 100).toFixed(1)}%`, top: `${(g.at[1] * 100).toFixed(1)}%` }} />
                    <span className="th-pip">
                      {/* eslint-disable-next-line @next/next/no-img-element -- small lazy thumbnail; hidden if the file is missing */}
                      <img src={`/v7/projects/${p.slug}.webp`} alt="" width={1280} height={960} loading="lazy" decoding="async" onError={(e) => { e.currentTarget.parentElement!.hidden = true; }} /><b>VIS</b>
                    </span>
                  </span>
                  <span className="th-spot-m">
                    <span className="th-spot-k"><Icon name={p.icon} />{p.kind}</span>
                    <span className="th-spot-t">{p.title}</span>
                    <span className="th-spot-h">{p.headline}</span>
                    <span className="th-spot-go">Open the case <Icon name="arrow-up-right" /></span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </section>

        <section id="experience" className="th-sec" aria-labelledby="th-exp-h">
          <header className="th-head"><Idx n="02" label="Record" /><h2 className="th-h2" id="th-exp-h">Where the work happened.</h2>
            <p className="th-sub">{countWord(C.experience.length)} roles and a degree. Warmer is more recent.</p></header>
          <ol className="th-roles">
            {C.experience.map((x, i) => (
              <li className="th-role-i" id={`experience-${x.slug}`} key={x.slug} style={{ ["--heat" as string]: `var(--rh${i})` }}>
                <details open={i === 0}>
                  <summary>
                    <span className="th-heat" aria-hidden="true" />
                    <span className="th-when">{x.when}</span>
                    <span className="th-what"><b>{x.role}</b><span>{x.org}</span></span>
                    <span className="th-where">{x.where}</span>
                    <span className="th-plus" aria-hidden="true" />
                  </summary>
                  <div className="th-role-b"><ul className="th-list">{x.desc.map((d, j) => <li key={j}>{d}</li>)}</ul><div className="chips">{x.tags.map((t) => <Chip t={t} key={t} />)}</div></div>
                </details>
              </li>
            ))}
          </ol>
          <div className="th-edu" id="education">
            <span className="th-edu-logo">
              {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size logo from content */}
              <img src={logoSrc(ed.logo)} alt="" width={56} height={56} loading="lazy" decoding="async" />
            </span>
            <div className="th-edu-t"><p className="th-edu-k">Education</p><h3>{ed.school}</h3><p>{ed.degree}</p></div>
            <dl className="th-edu-d"><div><dt>Focus</dt><dd>{ed.focus}</dd></div>{ed.grad && <div><dt>Graduation</dt><dd>{ed.grad}</dd></div>}</dl>
          </div>
        </section>

        <section id="graph" className="th-sec" aria-labelledby="th-map-h">
          <header className="th-head"><Idx n="03" label="Map" /><h2 className="th-h2" id="th-map-h">Everything on record, connected.</h2>
            <p className="th-sub">Hover a node to trace what it touches. Click for the details.</p></header>
          <div className="th-kgw"><i className="th-kgw-c" aria-hidden="true" /><KnowledgeGraph id="thermal" /></div>
        </section>

        <section id="play" className="th-sec" aria-labelledby="th-play-h">
          <header className="th-head"><Idx n="04" label="Bench" /><h2 className="th-h2" id="th-play-h">Things to touch.</h2>
            <p className="th-sub">A record to scratch, a board to draw on, {countWord(PLAY.length - 2).toLowerCase()} quick games.</p></header>
          <ol className="th-toys">
            {PLAY.map((t, i) => (
              <li key={t.id}><button type="button" className="th-toy" data-play={t.id}>
                <span className="th-toy-n">CH {String(i + 1).padStart(2, "0")}</span>
                <span className="th-toy-i" aria-hidden="true"><Icon name={t.icon} /></span>
                <span className="th-toy-t">{t.name}</span>
                <span className="th-toy-d">{t.desc}</span>
                <span className="th-toy-go">Run <Icon name="arrow-right" /></span>
              </button></li>
            ))}
          </ol>
        </section>

        <section id="about" className="th-sec" aria-labelledby="th-about-h">
          <header className="th-head"><Idx n="05" label="About" /><h2 className="th-h2" id="th-about-h">Close to the hardware.</h2></header>
          <div className="th-about">
            <div className="th-about-t">{C.about.map((a, i) => <p key={i}>{a}</p>)}</div>
            <aside className="th-now" aria-label="Now">
              <p className="th-panel-k">Now</p>
              <dl>{nowRows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
              <p className="th-panel-k">Places</p>
              <ul className="th-places">
                {C.places.map((pl) => <li key={pl.key}><span className="th-pl-k">{PLACE_LABEL[pl.key] ?? pl.key}</span><span className="th-pl-c">{pl.city}</span><Clock tz={pl.tz} className="th-pl-t" /></li>)}
              </ul>
            </aside>
          </div>
          <ul className="th-reads" aria-label="In numbers">{C.numbers.map(([n, l], i) => <li key={l} style={{ ["--heat" as string]: `var(--rh${i})` }}><b>{n}</b><span>{l}</span></li>)}</ul>
        </section>

        <section id="contact" className="th-sec th-contact" aria-labelledby="th-contact-h">
          <header className="th-head"><Idx n="06" label="Contact" /><h2 className="th-h2" id="th-contact-h">The warmest lead is email.</h2>
            <p className="th-sub">Open to SWE and AI internships. Write, and it goes straight to my inbox.</p></header>
          <div className="th-mail">
            <button type="button" className="th-mail-b" data-compose="Internship opportunity"><span className="th-mail-k">Compose</span><span className="th-mail-a">{em}</span>
              <span className="th-strip" aria-hidden="true"><Heat f="@strip" cool={stripImg.cool} warm={stripImg.warm} w={64} h={6} /></span>
              <span className="th-strip-l" aria-hidden="true"><span>SP0 · warmest point on the page</span><span>visual scale</span></span>
            </button>
          </div>
          <ul className="th-links">
            <li><a className="th-btn" href={C.links.github} target="_blank" rel="noopener"><Logo slug="github" />GitHub</a></li>
            <li><a className="th-btn" href={C.links.linkedin} target="_blank" rel="noopener"><Logo slug="linkedin" />LinkedIn</a></li>
            <li><button type="button" className="th-btn" data-resume=""><Icon name="file-text" />Resume</button></li>
            <li><button type="button" className="th-btn" data-copy={em}><Icon name="copy" />Copy address</button></li>
          </ul>
          <footer className="th-foot">
            <span className="th-foot-mk" aria-hidden="true"><Mark label="" /></span>
            <p>{C.name} · <Clock tz={C.now.tz} className="th-clk" /> in {C.now.city}</p>
            <p className="th-foot-s">Set in Space Grotesk and JetBrains Mono. The heat is one fragment shader; the photograph is never mapped.</p>
          </footer>
        </section>
      </div>
      <ShaderCanvas spec={META.shader} dark uniforms={uniforms} />
    </main>
  );
}
