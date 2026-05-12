import React from "react";

const entries = [
  {
    org: "Purdue University",
    date: "Aug 2023 — Present",
    role: "B.S. Computer Science + Mathematics",
    desc: "Studying CS and Math with a focus on software engineering, AI systems, and applied mathematics. Building end-to-end projects alongside coursework.",
    tags: ["CS", "Mathematics", "AI"],
    delay: "0.1s",
  },
  {
    org: "Independent Projects",
    date: "2023 — Present",
    role: "Builder",
    desc: "Shipping full-stack and AI projects across web development, computer vision, browser automation, and education technology.",
    tags: ["Full Stack", "AI", "Open Source"],
    delay: "0.2s",
  },
];

export default function Experience() {
  return (
    <section className="experience-section" id="experience">
      <div className="section-header blur-fade">
        <p className="eyebrow">Experience</p>
        <h2>Where I&apos;ve been.</h2>
      </div>

      <div className="timeline">
        <div className="timeline-beam" />
        {entries.map(({ org, date, role, desc, tags, delay }) => (
          <div
            key={org}
            className="timeline-entry blur-fade"
            style={{ "--delay": delay } as React.CSSProperties}
          >
            <div className="timeline-dot" />
            <div className="timeline-content">
              <div className="timeline-header">
                <h3>{org}</h3>
                <span className="timeline-date">{date}</span>
              </div>
              <p className="timeline-role">{role}</p>
              <p className="timeline-desc">{desc}</p>
              <div className="timeline-tags">
                {tags.map((t) => <span key={t}>{t}</span>)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
