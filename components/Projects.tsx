import { serverClient } from "@/lib/supabase";
import type { Project } from "@/lib/types";
import FadeIn from "./FadeIn";
import ProjectsClient from "./ProjectsClient";

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
      <ProjectsClient initialProjects={projects} />
    </section>
  );
}
