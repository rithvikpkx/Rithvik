"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../Glyph";
import { useSite } from "../SiteProvider";
import "../case/case.css";

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';
const isHttp = (u: string) => /^https?:\/\//i.test(u);

/** The project case sheet: a modal bottom sheet with the project's story, links and a next-project button. */
export default function CaseSheet({ slug }: { slug: string }) {
  const { content, close, openCase } = useSite();
  const [closing, setClosing] = useState(false);
  const bodyRef = useRef<HTMLElement>(null);
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });

  const i = content.projects.findIndex((p) => p.slug === slug);
  const p = content.projects[i];
  const next = content.projects[(i + 1) % content.projects.length];

  // Slide out (280ms, instant under reduced motion) before unmounting.
  const dismiss = () => {
    if (closing) return;
    setClosing(true);
    const ms = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280;
    setTimeout(() => closeRef.current(), ms);
  };
  const dismissRef = useRef(dismiss);
  useEffect(() => { dismissRef.current = dismiss; });

  // Scroll lock without layout shift (pad for the vanished scrollbar), focus in/out, Esc + Tab trap.
  useEffect(() => {
    const root = document.documentElement, prev = document.activeElement as HTMLElement | null;
    const gap = innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (gap > 0) root.style.paddingRight = gap + "px";
    bodyRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { dismissRef.current(); return; }
      if (e.key !== "Tab" || !bodyRef.current) return;
      const f = [...bodyRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = f[0], last = f[f.length - 1], a = document.activeElement;
      if (!f.length || a === bodyRef.current) { e.preventDefault(); (e.shiftKey ? last : first)?.focus(); }
      else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = ""; root.style.paddingRight = "";
      prev?.focus?.({ preventScroll: true });
    };
  }, []);

  // Next project swaps the content in place, so reset the scroll.
  useEffect(() => { bodyRef.current?.scrollTo(0, 0); }, [slug]);

  if (!p) return null;
  const links = Object.entries(p.links).filter(([, u]) => isHttp(u));

  return (
    <div className={`sheet${closing ? " closing" : ""}`} role="dialog" aria-modal="true" aria-labelledby="case-h">
      <div className="sheet-scrim" onClick={dismiss} />
      <article className="sheet-body" ref={bodyRef} tabIndex={-1}>
        <button type="button" className="ui-ic sheet-close" onClick={dismiss} aria-label="Close"><Icon name="x" /></button>
        <div className="case">
          <p className="case-kind"><Icon name={p.icon} /> <span data-edit={`project:${p.slug}:kind`}>{p.kind}</span></p>
          <h1 id="case-h" data-edit={`project:${p.slug}:headline`}>{p.headline}</h1>
          <p className="case-lede">{p.desc[0]}</p>
          <div className="chips">{p.tags.map((t) => <span className="chip" key={t}>{t}</span>)}</div>
          <dl className="case-meta">
            <div><dt>Project</dt><dd data-edit={`project:${p.slug}:title`}>{p.title}</dd></div>
            <div><dt>Context</dt><dd data-edit={`project:${p.slug}:ctx`}>{p.ctx}</dd></div>
          </dl>
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size static asset; hide the frame if it is missing */}
          <figure className="case-art"><img src={`/v7/projects/${p.slug}.webp`} alt="" width={1280} height={960} decoding="async"
            onError={(e) => e.currentTarget.parentElement?.remove()} /></figure>
          <h2>What it does</h2>
          <ul className="case-bullets">{p.desc.map((d, i) => <li key={d} data-edit={`project:${p.slug}:desc.${i}`}>{d}</li>)}</ul>
          {links.length > 0 && (
            <div className="case-links">
              {links.map(([k, u]) => <a key={k} className="ui-btn" href={u} target="_blank" rel="noopener noreferrer">{k} <Icon name="arrow-up-right" /></a>)}
            </div>
          )}
          <button type="button" className="case-next" onClick={() => openCase(next.slug)}><span>Next</span><b>{next.title}</b></button>
        </div>
      </article>
    </div>
  );
}
