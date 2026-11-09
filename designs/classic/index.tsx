import Image from "next/image";
import { Newsreader } from "next/font/google";
import type { DesignProps } from "@/lib/designs/types";
import type { Content } from "@/lib/content/types";
import { Icon, Logo } from "@/components/site/Glyph";
import Portrait from "@/components/site/portrait/Portrait";
import KnowledgeGraph from "@/components/site/graph/KnowledgeGraph";
import Mark from "@/components/site/mark/Mark";
import { PLAY } from "@/lib/play/games";
import { CREDITS } from "@/lib/assets/misc";
import Nav from "./Nav";
import Clock from "./Clock";
import "./classic.css";

// Italic serif for the name only (hero + footer signature); loaded with this design's chunk.
const serif = Newsreader({ subsets: ["latin"], style: "italic", weight: "400", variable: "--cl-serif", display: "swap" });

const PLACE_LABEL = { home: "Home", school: "School", now: "Now" } as const;

/** Classic: the calm v7 long page every legacy palette renders with, coloured by the palette's tokens.
 *  Static markup (renders without JS); only the nav, clocks, portrait pulses and graph hydrate. */
export default function Classic({ content: c }: DesignProps) {
  return (
    <div className={`cl ${serif.variable}`}>
      <a className="skip" href="#work">Skip to content</a>
      <Nav />
      <main className="stage">
        <Hero c={c} />
        <Work c={c} />
        <Experience c={c} />
        <About c={c} />
        <Play />
        <Questions c={c} />
        <Contact c={c} />
      </main>
      <Footer c={c} />
    </div>
  );
}

/** First screen: status, name, role, one line, three actions; the portrait beside it. */
function Hero({ c }: { c: Content }) {
  return (
    <section className="cl-hero cl-wrap" id="top" aria-label="Introduction">
      <div className="cl-hero-copy">
        <p className="cl-status"><span className="cl-live" aria-hidden="true" />{c.status}</p>
        <h1 className="cl-name"><span>{c.first}</span> <span>{c.last}</span></h1>
        <p className="cl-role">{c.role}</p>
        <p className="cl-line">{c.line}</p>
        <div className="cl-actions">
          <button type="button" className="cl-btn" data-resume="">Resume</button>
          <a className="cl-btn ghost" href={`mailto:${c.links.email}`} data-compose="">Write to me</a>
          <button type="button" className="cl-btn ghost" data-agent="">Ask<kbd>⌘K</kbd></button>
        </div>
      </div>
      <div className="cl-hero-pt"><Portrait id="classic" /></div>
    </section>
  );
}

/** One-word section heading. */
function Title({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 className="cl-title" id={`${id}-h`}>{children}</h2>;
}

/** All projects as type-led cards; each opens the case sheet (the href is the no-JS fallback). */
function Work({ c }: { c: Content }) {
  return (
    <section className="cl-sec cl-wrap" id="work" aria-labelledby="work-h">
      <Title id="work">Work</Title>
      <ul className="cl-grid">
        {c.projects.map((p, i) => (
          <li key={p.slug} className={i === 0 ? "feat" : i < 3 ? "side" : undefined}>
            <a className="cl-card" href={`/work/${p.slug}`} data-case={p.slug}>
              <div className="cl-card-top">
                <span className="cl-card-ic"><Icon name={p.icon} /></span>
                <span className="cl-kind">{p.kind}</span>
                <span className="cl-view" aria-hidden="true">View<Icon name="arrow-up-right" /></span>
              </div>
              <div className="cl-card-body">
                <h3 className="cl-card-title">{p.headline}</h3>
                <span className="cl-card-ctx">{p.title}{p.ctx && ` · ${p.ctx}`}</span>
                {p.tags.length > 0 && <span className="chips">{p.tags.map((t) => <span key={t} className="chip">{t}</span>)}</span>}
              </div>
              <Mark kind="hatch" label="" className="cl-card-mark" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Roles as hairline ledger rows (native disclosure, so it works without JS), then the education row. */
function Experience({ c }: { c: Content }) {
  const e = c.education;
  return (
    <section className="cl-sec cl-wrap" id="experience" aria-labelledby="experience-h">
      <Title id="experience">Experience</Title>
      <ul className="cl-ledger">
        {c.experience.map((r) => (
          <li key={r.slug}>
            <details className="cl-row">
              <summary>
                <span className="cl-when">{r.when}</span>
                <span className="cl-what"><b>{r.role}</b>{r.org && <span>{r.org}</span>}</span>
                {r.where && <span className="cl-where">{r.where}</span>}
                <span className="cl-plus" aria-hidden="true" />
              </summary>
              {(r.desc.length > 0 || r.tags.length > 0) && (
                <div className="cl-row-body">
                  {r.desc.length > 0 && <ul className="cl-bullets">{r.desc.map((d) => <li key={d}>{d}</li>)}</ul>}
                  {r.tags.length > 0 && <span className="chips">{r.tags.map((t) => <span key={t} className="chip">{t}</span>)}</span>}
                </div>
              )}
            </details>
          </li>
        ))}
      </ul>
      {e.school && (
        <div className="cl-edu" id="education">
          {e.logo && <Image src={`/images/${e.logo}`} alt="" width={36} height={36} />}
          <span className="cl-what"><b>{e.school}</b>{e.degree && <span>{e.degree}</span>}</span>
          {(e.focus || e.grad) && <span className="cl-where">{e.focus}{e.focus && e.grad && <br />}{e.grad}</span>}
        </div>
      )}
    </section>
  );
}

/** About text, where he is now (with a live clock), the true numbers, and the knowledge graph. */
function About({ c }: { c: Content }) {
  const rows: [string, React.ReactNode][] = [
    ...c.places.map((p): [string, React.ReactNode] => [PLACE_LABEL[p.key], p.key === "now" ? <>{p.city} <Clock tz={p.tz} /></> : p.city]),
    ["Building", c.now.building],
    ["Researching", c.now.researching],
    ["Learning", c.now.learning],
  ];
  return (
    <section className="cl-sec cl-wrap" id="about" aria-labelledby="about-h">
      <div className="cl-about">
        <div className="cl-about-copy">
          <Title id="about">About</Title>
          {c.about.map((p) => <p key={p}>{p}</p>)}
        </div>
        <dl className="cl-kv">
          {rows.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </div>
      {c.numbers.length > 0 && (
        <ul className="cl-numbers">
          {c.numbers.map(([v, l]) => <li key={l}><b>{v}</b><span>{l}</span></li>)}
        </ul>
      )}
      <div className="cl-graph"><KnowledgeGraph id="classic" /></div>
    </section>
  );
}

/** One calm row of entries into the Play window. */
function Play() {
  return (
    <section className="cl-sec cl-wrap" id="play" aria-labelledby="play-h">
      <Title id="play">Play</Title>
      <ul className="cl-toys">
        {PLAY.map((p) => (
          <li key={p.id}>
            <button type="button" className="cl-toy" data-play={p.id}>
              <span className="cl-card-ic"><Icon name={p.icon} /></span>
              <span><b>{p.name}</b><span>{p.desc}</span></span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Recruiter questions as native disclosures, plus a hand-off to the agent. */
function Questions({ c }: { c: Content }) {
  if (c.faq.length === 0) return null;
  return (
    <section className="cl-sec cl-wrap cl-faq" id="questions" aria-labelledby="questions-h">
      <div className="cl-faq-head">
        <Title id="questions">Questions</Title>
        <button type="button" className="cl-btn ghost" data-agent="">Ask something else<kbd>⌘K</kbd></button>
      </div>
      <div className="cl-faq-list">
        {c.faq.map(([q, a]) => (
          <details key={q}>
            <summary>{q}<span className="cl-plus" aria-hidden="true" /></summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** The final call to action: the address itself, copy, and the same actions as the hero. */
function Contact({ c }: { c: Content }) {
  return (
    <section className="cl-sec cl-wrap" id="contact" aria-labelledby="contact-h">
      <Title id="contact">Contact</Title>
      <p className="cl-email">
        <a href={`mailto:${c.links.email}`} data-compose="">{c.links.email}</a>
        <button type="button" className="cl-icon" data-copy={c.links.email} aria-label="Copy email address"><Icon name="copy" /></button>
      </p>
      <div className="cl-actions">
        <a className="cl-btn" href={`mailto:${c.links.email}`} data-compose="">Write to me</a>
        <button type="button" className="cl-btn ghost" data-resume="">Resume</button>
        <a className="cl-btn ghost" href={c.links.github} target="_blank" rel="noopener"><Logo slug="github" />GitHub</a>
        <a className="cl-btn ghost" href={c.links.linkedin} target="_blank" rel="noopener"><Logo slug="linkedin" />LinkedIn</a>
      </div>
    </section>
  );
}

/** Signature, sitemap, local clocks, then credits and the Buffett line. */
function Footer({ c }: { c: Content }) {
  return (
    <footer className="cl-foot cl-wrap">
      <div className="cl-foot-grid">
        <div className="cl-sign">
          <Mark label="" className="cl-foot-mark" />
          <p>{c.first}<br />{c.last}</p>
        </div>
        <nav aria-label="Sitemap">
          <ul className="cl-sitemap">
            {[["work", "Work"], ["experience", "Experience"], ["about", "About"], ["play", "Play"], ["contact", "Contact"]].map(([id, l]) => (
              <li key={id}><a href={`#${id}`}>{l}</a></li>
            ))}
          </ul>
        </nav>
        <ul className="cl-clocks" aria-label="Local times">
          {c.places.map((p) => <li key={p.key}><span>{p.city}</span><Clock tz={p.tz} /></li>)}
        </ul>
      </div>
      <p className="cl-fine">
        <span>Photos: {Object.values(CREDITS).join("; ")}.</span>
        <a href="/buffett">For Warren Buffett</a>
      </p>
    </footer>
  );
}
