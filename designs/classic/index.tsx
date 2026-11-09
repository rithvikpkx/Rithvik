"use client";
import type { DesignProps } from "@/lib/designs/types";
import "./classic.css";

/** Placeholder Classic: the content rendered plainly in the active palette's tokens.
 *  The real Classic layout is built by a later stream. */
export default function Classic({ content: c }: DesignProps) {
  return (
    <main className="stage cl" id="top">
      <h1>{c.name}</h1>
      <p>{c.role}</p>
      <p className="cl-muted">{c.status}</p>
      <section id="work">
        <h2>Work</h2>
        <ul>
          {c.projects.map((p) => (
            <li key={p.slug}><a href={`/work/${p.slug}`} data-case={p.slug}>{p.title}</a> <span className="cl-muted">{p.headline}</span></li>
          ))}
        </ul>
      </section>
      <section id="experience">
        <h2>Experience</h2>
        <ul>
          {c.experience.map((r) => <li key={r.slug}>{r.role}, {r.org} <span className="cl-muted">{r.when}</span></li>)}
        </ul>
      </section>
      <section id="contact">
        <h2>Contact</h2>
        <p><a href={`mailto:${c.links.email}`} data-compose="">Email</a> · <a href={c.links.github}>GitHub</a> · <a href={c.links.linkedin}>LinkedIn</a></p>
      </section>
    </main>
  );
}
