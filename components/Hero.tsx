import React from "react";

export default function Hero() {
  return (
    <section className="hero" id="about">
      <div className="dot-grid" />

      <div className="hero-content">
        <h1 className="hero-title blur-fade" style={{ "--delay": "0s" } as React.CSSProperties}>
          Rithvik
          <br />
          <span className="gradient-text">Praveen Kumar</span>
        </h1>

        <div className="hero-sub blur-fade" style={{ "--delay": "0.15s" } as React.CSSProperties}>
          <p className="hero-tagline">
            CS + Math @{" "}
            <a
              href="https://www.cs.purdue.edu/"
              target="_blank"
              rel="noreferrer"
              className="purdue-link"
            >
              Purdue
            </a>
          </p>
          <p className="hero-sub-line">
            Building at the intersection of AI, systems, and real-world problems.
          </p>
        </div>

        <div
          className="hero-actions blur-fade"
          style={{ "--delay": "0.28s" } as React.CSSProperties}
        >
          <a href="#projects" className="btn-shimmer">View Projects</a>
          <a href="#contact" className="btn-outline">Get in Touch</a>
        </div>
      </div>

      <div className="scroll-indicator">
        <span />
      </div>
    </section>
  );
}
