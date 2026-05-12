"use client";
import { motion } from "motion/react";
import LocalTime from "./LocalTime";

const stack = [
  "Python","TypeScript","JavaScript","React","Next.js","Node.js",
  "Supabase","AWS","Playwright","Vercel","Git","SQL","C","Java",
  "NumPy","Pandas","scikit-learn","OpenAI API",
];

const grid = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const card = {
  hidden: { opacity: 0, filter: "blur(8px)", y: 20 },
  visible: { opacity: 1, filter: "blur(0px)", y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

export default function Bento() {
  return (
    <section className="bento-section">
      <motion.div
        className="bento-grid"
        variants={grid}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
      >

        <motion.div
          className="bento-card bento-location"
          variants={card}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
        >
          <p className="card-eyebrow">Location</p>
          <h3 className="card-title">West Lafayette, IN</h3>
          <p className="card-sub">Purdue University</p>
          <LocalTime />
        </motion.div>

        <motion.div
          className="bento-card bento-building"
          variants={card}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
        >
          <p className="card-eyebrow">Currently Building</p>
          <h3 className="card-title">Rithvik.ai</h3>
          <p className="card-sub">
            A full-stack AI-powered personal platform with a RAG chatbot, live admin UI, and
            project dashboard. Built with Next.js, Supabase, and Claude.
          </p>
          <div className="building-tags">
            {["Next.js", "Supabase", "RAG", "Claude API"].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="bento-card bento-stats"
          variants={card}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
        >
          <p className="card-eyebrow">By the numbers</p>
          <div className="stats-grid">
            {[
              { num: "4+", label: "Projects" },
              { num: "2+", label: "Years coding" },
              { num: "6+", label: "Languages" },
            ].map(({ num, label }) => (
              <div className="stat" key={label}>
                <span className="stat-num">{num}</span>
                <span className="stat-label">{label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="bento-card bento-marquee"
          variants={card}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
        >
          <p className="card-eyebrow">Stack</p>
          <div className="marquee-wrapper">
            <div className="marquee-track">
              {[...stack, ...stack].map((item, i) => (
                <span key={i}>{item}</span>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          className="bento-card bento-interests"
          variants={card}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
        >
          <p className="card-eyebrow">Interests</p>
          <div className="interests-list">
            {[
              "Full-Stack Engineering","AI Systems","Applied ML",
              "Computer Systems","Startups","Research","Open Source",
            ].map((i) => (
              <span key={i}>{i}</span>
            ))}
          </div>
        </motion.div>

      </motion.div>
    </section>
  );
}
