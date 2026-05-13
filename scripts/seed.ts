import { createClient } from "@supabase/supabase-js";

const url = "https://djxiyvczcvgfelhwrlkf.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

async function seed() {
  // Clear existing rows before re-seeding
  await db.from("projects").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await db.from("experience").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const { error: pe } = await db.from("projects").insert([
    {
      slug: "rithvik-ai",
      title: "Rithvik.ai Portfolio",
      badge: "In Progress",
      description: "Personal portfolio website being built from the ground up — starting with static HTML/CSS and evolving into a full-stack AI-powered platform with a RAG chatbot and live admin UI.",
      tags: ["Next.js", "Supabase", "RAG", "Claude API"],
      links: { github: "https://github.com/rithvikpkx/Rithvik" },
      featured: true,
      published: true,
      sort_order: 0,
    },
    {
      slug: "watchdawg",
      title: "WatchDawg",
      badge: "Browser Monitor",
      description: "Cloud-running browser monitor that checks dynamic webpages, compares values against a baseline, and sends notifications when changes are detected.",
      tags: ["TypeScript", "Playwright", "Automation"],
      links: {},
      featured: false,
      published: true,
      sort_order: 1,
    },
    {
      slug: "boilerframe",
      title: "BoilerFrame",
      badge: "Full Stack",
      description: "Web app that uses AWS Rekognition to identify where a target person appears in uploaded video content.",
      tags: ["JavaScript", "AWS", "Computer Vision"],
      links: {},
      featured: false,
      published: true,
      sort_order: 2,
    },
    {
      slug: "pratigya",
      title: "Pratigya Learning Platform",
      badge: "AI Education",
      description: "AI-powered learning platform for rural learners, including lessons, quizzes, assignments, and a context-aware chatbot grounded in course content.",
      tags: ["RAG", "Full Stack", "Education"],
      links: {},
      featured: false,
      published: true,
      sort_order: 3,
    },
  ]);
  if (pe) { console.error("Projects error:", pe.message); process.exit(1); }
  console.log("✓ Projects seeded");

  const { error: ee } = await db.from("experience").insert([
    {
      slug: "purdue",
      org: "Purdue University",
      org_url: "https://www.cs.purdue.edu/",
      role: "B.S. Computer Science + Mathematics",
      type: "education",
      date_range: "Aug 2023 — Present",
      start_date: "2023-08-01",
      end_date: null,
      description: "Studying CS and Math with a focus on software engineering, AI systems, and applied mathematics. Building end-to-end projects alongside coursework.",
      tags: ["CS", "Mathematics", "AI"],
      location: "West Lafayette, IN",
      featured: true,
      published: true,
      sort_order: 0,
    },
    {
      slug: "independent-projects",
      org: "Independent Projects",
      org_url: null,
      role: "Builder",
      type: "project",
      date_range: "2023 — Present",
      start_date: "2023-01-01",
      end_date: null,
      description: "Shipping full-stack and AI projects across web development, computer vision, browser automation, and education technology.",
      tags: ["Full Stack", "AI", "Open Source"],
      location: null,
      featured: false,
      published: true,
      sort_order: 1,
    },
  ]);
  if (ee) { console.error("Experience error:", ee.message); process.exit(1); }
  console.log("✓ Experience seeded");

  console.log("Seed complete.");
}

seed();
