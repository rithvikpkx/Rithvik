"use client";
import { motion } from "motion/react";
import FadeIn from "./FadeIn";

const entries = [
  {
    org: "Purdue University",
    date: "Aug 2023 — Present",
    role: "B.S. Computer Science + Mathematics",
    desc: "Studying CS and Math with a focus on software engineering, AI systems, and applied mathematics. Building end-to-end projects alongside coursework.",
    tags: ["CS", "Mathematics", "AI"],
    delay: 0.1,
  },
  {
    org: "Independent Projects",
    date: "2023 — Present",
    role: "Builder",
    desc: "Shipping full-stack and AI projects across web development, computer vision, browser automation, and education technology.",
    tags: ["Full Stack", "AI", "Open Source"],
    delay: 0.2,
  },
];

export default function Experience() {
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
          <motion.div
            className="timeline-beam-glow"
            animate={{ top: ["-50%", "120%"] }}
            transition={{ duration: 3.2, ease: "easeInOut", repeat: Infinity }}
          />
        </div>
        {entries.map(({ org, date, role, desc, tags, delay }) => (
          <FadeIn key={org} delay={delay} className="timeline-entry">
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
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
