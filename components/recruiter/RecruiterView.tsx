"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- "/" is another root layout: a full page load, on purpose */
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSite } from "@/components/site/SiteProvider";
import { Icon, Logo } from "@/components/site/Glyph";
import { ComposerForm } from "@/components/site/overlays/ComposerWindow";
import { ResumeSkeleton, useResumeMeta } from "@/components/site/overlays/ResumeWindow";

const WIDE = "(min-width: 1180px)"; // wide enough for the agent to sit open beside the content
const noop = () => () => {};
/** True on a phone-sized screen (read once on the client; false while server-rendering). */
const usePhone = () => useSyncExternalStore(noop, () => matchMedia("(max-width: 640px)").matches, () => false);

/** Light/dark for recruiter mode: flips <html data-rt> (set pre-paint by the layout) and remembers the pick. */
function ThemeToggle() {
  const boot = useSyncExternalStore(noop, () => document.documentElement.dataset.rt === "dark", () => false);
  const [picked, setPicked] = useState<boolean | null>(null);
  const dark = picked ?? boot;
  const flip = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.rt = next;
    try { localStorage.setItem("rithvik-rt", next); } catch { /* not remembered */ }
    setPicked(!dark);
  };
  return (
    <button type="button" className="rt-icon" onClick={flip} aria-label={dark ? "Light mode" : "Dark mode"} title={dark ? "Light mode" : "Dark mode"}>
      <Icon name={dark ? "sun" : "moon"} />
    </button>
  );
}

/** The resume, rendered on the page; a wireframe until the real PDF has painted (phones get a link: framed PDFs fail there). */
function ResumeInline() {
  const [meta] = useResumeMeta();
  const [ready, setReady] = useState(false);
  const phone = usePhone();
  const pdf = meta?.sha ? `/resume.pdf?v=${meta.sha.slice(0, 12)}` : null;
  const [docFailed, setDocFailed] = useState(false);
  const doc = meta?.source !== "upload" && meta?.sha && !docFailed ? `/resume.html?v=${meta.sha.slice(0, 12)}` : null;
  useEffect(() => { if (!pdf) return; const t = setTimeout(() => setReady(true), 8000); return () => clearTimeout(t); }, [pdf]);
  if (!meta) return <div className="rt-resume"><ResumeSkeleton /></div>;
  if (!pdf) return <p className="rt-muted">The resume is being refreshed; everything on it is in the sections above.</p>;
  return (
    <>
      <div className="rt-resume-actions">
        <a className="ui-btn" href={pdf} target="_blank" rel="noopener"><Icon name="external-link" /> Open PDF</a>
        <a className="ui-btn" href={pdf} download="Rithvik-Praveen-Kumar-Resume.pdf"><Icon name="download" /> Download</a>
      </div>
      {/* the synced doc as real page content (works on phones, shows in replays); an upload or a failed export uses the PDF */}
      {(doc || !phone) && (
        <div className="rt-resume">
          {!ready && <ResumeSkeleton />}
          {doc
            ? <iframe src={doc} title="Resume" data-loading={!ready || undefined} sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                onLoad={(e) => { const t = e.currentTarget.contentDocument?.body?.innerText ?? ""; if (t.length < 80) setDocFailed(true); else setReady(true); }} />
            : <iframe src={`${pdf}#view=FitH`} title="Resume" data-loading={!ready || undefined} onLoad={() => setReady(true)} />}
        </div>
      )}
    </>
  );
}

/** Recruiter mode: everything that matters, expanded on one quiet page (photo and links, about, experience, projects,
 *  education, skills, the resume, an open email form, FAQ), with the agent open beside it on wide screens. */
export default function RecruiterView() {
  const { content: c, openAgent } = useSite();
  const opened = useRef(false); // once per visit: closing the agent must stick
  useEffect(() => { if (!opened.current && matchMedia(WIDE).matches) { opened.current = true; openAgent(); } }, [openAgent]);

  return (
    <div className="rt">
      <header className="rt-top">
        <a className="rt-brand" href="/">{c.name}</a>
        <span className="rt-tag">Recruiter view</span>
        <span className="rt-top-r">
          <button type="button" className="rt-ask" onClick={() => openAgent()}><Icon name="terminal" /> Ask RAG</button>
          <ThemeToggle />
        </span>
      </header>

      <main className="rt-main">
        <section className="rt-hero" aria-labelledby="rt-name">
          <div className="rt-photo"><Image src="/images/rithvik.jpeg" alt={c.name} fill priority sizes="140px" /></div>
          <div>
            <h1 id="rt-name">{c.name}</h1>
            <p className="rt-role">{c.status}</p>
            <p className="rt-line">{c.line}</p>
            <nav className="rt-links" aria-label="Contact">
              <a className="ui-btn" href={c.links.github} target="_blank" rel="noopener"><Logo slug="github" /> GitHub</a>
              <a className="ui-btn" href={c.links.linkedin} target="_blank" rel="noopener"><Logo slug="linkedin" /> LinkedIn</a>
              <a className="ui-btn" href="#contact"><Icon name="mail" /> Email</a>
              <a className="ui-btn primary" href="#resume"><Icon name="file-text" /> Resume</a>
            </nav>
          </div>
        </section>
        <p className="rt-note">This is the minimal, content-first version of the site: no effects, everything expanded. <a href="/">The full site</a> has the designs and interactive pieces.</p>

        <section aria-labelledby="rt-about"><h2 id="rt-about">About</h2>{c.about.map((p) => <p key={p}>{p}</p>)}</section>

        <section aria-labelledby="rt-exp">
          <h2 id="rt-exp">Experience</h2>
          {c.experience.map((r) => (
            <article key={r.slug} className="rt-item" id={`experience-${r.slug}`}>
              <header><h3>{r.role} · {r.org}</h3><span className="rt-muted">{[r.when, r.where].filter(Boolean).join(" · ")}</span></header>
              <ul>{r.desc.map((d) => <li key={d}>{d}</li>)}</ul>
              {r.tags.length > 0 && <p className="rt-tags">{r.tags.map((t) => <span key={t}>{t}</span>)}</p>}
            </article>
          ))}
        </section>

        <section aria-labelledby="rt-work">
          <h2 id="rt-work">Projects</h2>
          {c.projects.map((p) => (
            <article key={p.slug} className="rt-item" id={`project-${p.slug}`}>
              <header><h3>{p.title}</h3><span className="rt-muted">{[p.kind, p.ctx].filter(Boolean).join(" · ")}</span></header>
              {p.headline && <p className="rt-lead">{p.headline}</p>}
              <ul>{p.desc.map((d) => <li key={d}>{d}</li>)}</ul>
              {p.tags.length > 0 && <p className="rt-tags">{p.tags.map((t) => <span key={t}>{t}</span>)}</p>}
              {Object.keys(p.links).length > 0 && (
                <p className="rt-plinks">{Object.entries(p.links).map(([label, url]) => <a key={label} href={url} target="_blank" rel="noopener">{label} ↗</a>)}</p>
              )}
            </article>
          ))}
        </section>

        <section aria-labelledby="rt-edu">
          <h2 id="rt-edu">Education</h2>
          <article className="rt-item">
            <header><h3>{c.education.school}</h3>{c.education.grad && <span className="rt-muted">{c.education.grad}</span>}</header>
            <p>{[c.education.degree, c.education.focus].filter(Boolean).join(" · ")}</p>
          </article>
        </section>

        <section aria-labelledby="rt-skills">
          <h2 id="rt-skills">Skills</h2>
          <dl className="rt-skills">{Object.entries(c.stack).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v.join(", ")}</dd></div>)}</dl>
        </section>

        <section id="resume" aria-labelledby="rt-resume"><h2 id="rt-resume">Resume</h2><ResumeInline /></section>

        <section id="contact" aria-labelledby="rt-contact">
          <h2 id="rt-contact">Get in touch</h2>
          <p className="rt-muted">Write here and it lands in my inbox; I reply from {c.links.email}.</p>
          <div className="rt-compose"><ComposerForm subject="" idPrefix="rc" /></div>
        </section>

        {c.faq.length > 0 && (
          <section aria-labelledby="rt-faq">
            <h2 id="rt-faq">Quick answers</h2>
            <dl className="rt-faq">{c.faq.map(([q, a]) => <div key={q}><dt>{q}</dt><dd>{a}</dd></div>)}</dl>
          </section>
        )}
      </main>

      <footer className="rt-foot">
        <a className="rt-full" href="/">
          <span>Check out all of the cool UI elements and designs on the full site</span>
          <Icon name="arrow-right" />
        </a>
      </footer>
    </div>
  );
}
