import { serverClient } from "@/lib/supabase";
import type { Experience as ExperienceRow } from "@/lib/types";
import FadeIn from "./FadeIn";
import TimelineBeam from "./TimelineBeam";

export default async function Experience() {
  const { data } = await serverClient()
    .from("experience")
    .select("*")
    .order("sort_order");
  const entries = (data ?? []) as ExperienceRow[];

  if (!entries.length) return null;

  return (
    <section className="experience-section" id="experience">
      <FadeIn>
        <div className="section-header">
          <p className="eyebrow">Experience</p>
          <h2>Where I&apos;ve been.</h2>
        </div>
      </FadeIn>

      <div className="timeline">
        <div className="timeline-beam">
          <TimelineBeam />
        </div>
        {entries.map(({ slug, org, date_range, role, description, tags }, i) => (
          <FadeIn key={slug} delay={i * 0.1} className="timeline-entry">
            <div className="timeline-dot" />
            <div className="timeline-content">
              <div className="timeline-header">
                <h3>{org}</h3>
                <span className="timeline-date">{date_range}</span>
              </div>
              <p className="timeline-role">{role}</p>
              <p className="timeline-desc">{description}</p>
              <div className="timeline-tags">
                {tags.map((t) => <span key={t}>{t}</span>)}
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
