import React from "react";
import { serverClient } from "@/lib/supabase";
import type { Education as EducationRow } from "@/lib/types";
import FadeIn from "./FadeIn";
import EducationClient from "./EducationClient";

// Used when the education table is empty (migration not yet run)
const FALLBACK: EducationRow = {
  id: "default",
  school: "Purdue University",
  school_url: "https://www.cs.purdue.edu/",
  degree: "B.S. in Computer Science + Mathematics",
  concentrations: ["Software Engineering", "AI / ML"],
  logo_path: "/images/purdue.png",
  sort_order: 0,
  published: true,
  created_at: "",
  updated_at: "",
};

export default async function Education() {
  const { data } = await serverClient().from("education").select("*").order("sort_order");
  const rows = ((data ?? []) as EducationRow[]).filter((e) => e.published);
  const entries = rows.length > 0 ? rows : [FALLBACK];

  return (
    <section className="education-section" id="education">
      <FadeIn>
        <div className="section-header">
          <p className="eyebrow">Education</p>
          <h2 style={{ fontSize: "clamp(2rem, 5vw, 3.6rem)", fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 0.95 }}>
            Academic background.
          </h2>
        </div>
      </FadeIn>
      <EducationClient initialEntries={entries} />
    </section>
  );
}
