"use client";
import { useEffect, useRef } from "react";
import { Icon } from "../Glyph";
import { useSite } from "../SiteProvider";
import ProjectArt from "../work/ProjectArt";
import Window from "../windows/Window";
import { place, windowEl } from "../windows/stack";
import "../case/case.css";

const isHttp = (u: string) => /^https?:\/\//i.test(u);

/** The project case window: a large floating window (movable, resizable, maximisable) with the project's story, links
 *  and a next-project button. Non-modal, so the page, the chat and other windows stay usable around it. */
export default function CaseSheet({ slug }: { slug: string }) {
  const { content, close: closeLayer, openCase } = useSite();
  const bodyRef = useRef<HTMLElement>(null);
  const prev = useRef<{ l: string; t: string; w: string; h: string } | null>(null); // size and spot before maximising

  const i = content.projects.findIndex((p) => p.slug === slug);
  const p = content.projects[i];
  const next = content.projects[(i + 1) % content.projects.length];

  // Next project swaps the content in place, so reset the scroll.
  useEffect(() => { bodyRef.current?.scrollTo(0, 0); }, [slug]);

  /** Fills the screen, or goes back to where it was. */
  const toggleMax = () => {
    const w = windowEl("project");
    if (!w) return;
    if (prev.current) { const r = prev.current; Object.assign(w.style, { left: r.l, top: r.t, width: r.w, height: r.h }); prev.current = null; return; }
    prev.current = { l: w.style.left, t: w.style.top, w: w.style.width, h: w.style.height };
    place(w, "center", "full");
  };

  if (!p) return null;
  const links = Object.entries(p.links).filter(([, u]) => isHttp(u));

  return (
    <Window title={p.title} icon={p.icon} label={`Project: ${p.title}`} name="project" className="case-win" onClose={() => closeLayer("case")}
      actions={<button type="button" className="ui-ic" onClick={toggleMax} aria-label="Maximise or restore"><Icon name="maximize-2" /></button>}>
      <article className="sheet-body case-body" ref={bodyRef} tabIndex={-1} aria-labelledby="case-h">
        <div className="case">
          <p className="case-kind"><Icon name={p.icon} /> <span data-edit={`project:${p.slug}:kind`}>{p.kind}</span></p>
          <h1 id="case-h" data-edit={`project:${p.slug}:headline`}>{p.headline}</h1>
          <p className="case-lede">{p.desc[0]}</p>
          <div className="chips">{p.tags.map((t) => <span className="chip" key={t}>{t}</span>)}</div>
          <dl className="case-meta">
            <div><dt>Project</dt><dd data-edit={`project:${p.slug}:title`}>{p.title}</dd></div>
            <div><dt>Context</dt><dd data-edit={`project:${p.slug}:ctx`}>{p.ctx}</dd></div>
          </dl>
          <figure className="case-art"><ProjectArt project={p} rank={content.projects.length > 1 ? i / (content.projects.length - 1) : 0} /></figure>
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
    </Window>
  );
}
