import React from "react";
import LocalTime from "./LocalTime";

const stack = [
  "Python","TypeScript","JavaScript","React","Next.js","Node.js",
  "Supabase","AWS","Playwright","Vercel","Git","SQL","C","Java",
  "NumPy","Pandas","scikit-learn","OpenAI API",
];

export default function Bento() {
  return (
    <section className="bento-section">
      <div className="bento-grid">

        {/* Location */}
        <div
          className="bento-card bento-location blur-fade"
          style={{ "--delay": "0.05s" } as React.CSSProperties}
        >
          <p className="card-eyebrow">Location</p>
          <h3 className="card-title">West Lafayette, IN</h3>
          <p className="card-sub">Purdue University</p>
          <LocalTime />
        </div>

        {/* Currently Building */}
        <div
          className="bento-card bento-building blur-fade"
          style={{ "--delay": "0.15s" } as React.CSSProperties}
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
        </div>

        {/* Stats */}
        <div
          className="bento-card bento-stats blur-fade"
          style={{ "--delay": "0.25s" } as React.CSSProperties}
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
        </div>

        {/* Marquee */}
        <div
          className="bento-card bento-marquee blur-fade"
          style={{ "--delay": "0.35s" } as React.CSSProperties}
        >
          <p className="card-eyebrow">Stack</p>
          <div className="marquee-wrapper">
            <div className="marquee-track">
              {[...stack, ...stack].map((item, i) => (
                <span key={i}>{item}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Interests */}
        <div
          className="bento-card bento-interests blur-fade"
          style={{ "--delay": "0.45s" } as React.CSSProperties}
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
        </div>

      </div>
    </section>
  );
}
