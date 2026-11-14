"use client";
import { useEffect, useRef } from "react";
import { Icon, Logo } from "../Glyph";
import { useSite } from "../SiteProvider";
import ProjectArt from "../work/ProjectArt";
import Window from "../windows/Window";
import { place, windowEl } from "../windows/stack";
import "../case/case.css";

const isHttp = (u: string) => /^https?:\/\//i.test(u);

/** How a source link presents: a video to watch, code on GitHub, or a site, with a clear label and its host. */
function sourceOf(key: string, url: string): { kind: "video" | "github" | "site"; label: string; host: string } {
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  if (/youtube\.com|youtu\.be|vimeo\.com|loom\.com/.test(host) || /demo|video/i.test(key)) return { kind: "video", label: "Watch the demo", host };
  if (host === "github.com") return { kind: "github", label: /\/[^/]+\/[^/]+/.test(new URL(url).pathname) ? "View the code" : "GitHub profile", host };
  return { kind: "site", label: key.charAt(0).toUpperCase() + key.slice(1), host };
}

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
  const order = { video: 0, github: 1, site: 2 } as const;
  const links = Object.entries(p.links).filter(([, u]) => isHttp(u)).sort(([a, u], [b, v]) => order[sourceOf(a, u).kind] - order[sourceOf(b, v).kind]);

  return (
    <Window title={p.title} icon={p.icon} label={`Project: ${p.title}`} name="project" className="case-win" onClose={() => closeLayer("case")}
      actions={<button type="button" className="ui-ic" onClick={toggleMax} aria-label="Maximise or restore"><Icon name="maximize-2" /></button>}>
      <article className="sheet-body case-body" ref={bodyRef} tabIndex={-1} aria-labelledby="case-h">
        <div className="case case-card">
          <p className="case-kind"><Icon name={p.icon} /> <span data-edit={`project:${p.slug}:kind`}>{p.kind}</span><span className="case-ctx" data-edit={`project:${p.slug}:ctx`}>{p.ctx}</span></p>
          <h1 id="case-h" data-edit={`project:${p.slug}:headline`}>{p.headline}</h1>
          {/* the sources first and big: a demo to watch, the code to read */}
          {links.length > 0 && (
            <div className="case-src">
              {links.map(([k, u], j) => {
                const src = sourceOf(k, u);
                return (
                  <a key={k} className={`case-src-b${j === 0 ? " primary" : ""}`} href={u} target="_blank" rel="noopener noreferrer">
                    {src.kind === "github" ? <Logo slug="github" /> : <Icon name={src.kind === "video" ? "play" : "external-link"} />}
                    <span><b>{src.label}</b><small>{src.host}</small></span>
                  </a>
                );
              })}
            </div>
          )}
          <ul className="case-bullets">{p.desc.map((d, i) => <li key={d} data-edit={`project:${p.slug}:desc.${i}`}>{d}</li>)}</ul>
          <div className="chips">{p.tags.map((t) => <span className="chip" key={t}>{t}</span>)}</div>
          <figure className="case-art"><ProjectArt project={p} rank={content.projects.length > 1 ? i / (content.projects.length - 1) : 0} /></figure>
          <button type="button" className="case-next" onClick={() => openCase(next.slug)}><span>Next</span><b>{next.title}</b></button>
        </div>
      </article>
    </Window>
  );
}
