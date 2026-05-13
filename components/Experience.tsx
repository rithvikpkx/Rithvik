import { serverClient } from "@/lib/supabase";
import type { Experience as ExperienceRow } from "@/lib/types";
import FadeIn from "./FadeIn";
import ExperienceClient from "./ExperienceClient";

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
      <ExperienceClient initialEntries={entries} />
    </section>
  );
}
