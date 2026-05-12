import { serverClient } from "@/lib/supabase";
import type { Project } from "@/lib/types";
import FadeIn from "./FadeIn";

export default async function Projects() {
  const { data } = await serverClient()
    .from("projects")
    .select("*")
    .order("sort_order");
  const projects = (data ?? []) as Project[];

  if (!projects.length) return null;

  return (
    <section className="projects-section" id="projects">
      <FadeIn>
        <div className="section-header">
          <p className="eyebrow">Projects</p>
          <h2>Selected work.</h2>
        </div>
      </FadeIn>
      <div className="projects-grid">
        {projects.map(({ slug, badge, title, description, tags }, i) => (
          <FadeIn key={slug} delay={i * 0.1} className="project-card">
            <div className="project-header">
              <span className="project-badge">{badge}</span>
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
            <div className="project-tags">
              {tags.map((t) => <span key={t}>{t}</span>)}
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
