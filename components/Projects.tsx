import React from "react";

const projects = [
  {
    badge: "In Progress",
    title: "Rithvik.ai Portfolio",
    desc: "Personal portfolio website being built from the ground up — starting with static HTML/CSS and evolving into a full-stack AI-powered platform with a RAG chatbot and live admin UI.",
    tags: ["HTML", "CSS", "Next.js", "Supabase", "RAG"],
    delay: "0.05s",
  },
  {
    badge: "Browser Monitor",
    title: "WatchDawg",
    desc: "Cloud-running browser monitor that checks dynamic webpages, compares values against a baseline, and sends notifications when changes are detected.",
    tags: ["TypeScript", "Playwright", "Automation"],
    delay: "0.15s",
  },
  {
    badge: "Full Stack",
    title: "BoilerFrame",
    desc: "Web app that uses AWS Rekognition to identify where a target person appears in uploaded video content.",
    tags: ["JavaScript", "AWS", "Computer Vision"],
    delay: "0.25s",
  },
  {
    badge: "AI Education",
    title: "Pratigya Learning Platform",
    desc: "AI-powered learning platform for rural learners, including lessons, quizzes, assignments, and a context-aware chatbot grounded in course content.",
    tags: ["RAG", "Full Stack", "Education"],
    delay: "0.35s",
  },
];

export default function Projects() {
  return (
    <section className="projects-section" id="projects">
      <div className="section-header blur-fade">
        <p className="eyebrow">Projects</p>
        <h2>Selected work.</h2>
      </div>
      <div className="projects-grid">
        {projects.map(({ badge, title, desc, tags, delay }) => (
          <article
            key={title}
            className="project-card blur-fade"
            style={{ "--delay": delay } as React.CSSProperties}
          >
            <div className="project-header">
              <span className="project-badge">{badge}</span>
            </div>
            <h3>{title}</h3>
            <p>{desc}</p>
            <div className="project-tags">
              {tags.map((t) => <span key={t}>{t}</span>)}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
