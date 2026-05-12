import FadeIn from "./FadeIn";

export default function Hero() {
  return (
    <section className="hero" id="about">
      <div className="dot-grid" />

      <div className="hero-content">
        <FadeIn delay={0} className="hero-title">
          Rithvik
          <br />
          <span className="gradient-text">Praveen Kumar</span>
        </FadeIn>

        <FadeIn delay={0.15} className="hero-sub">
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
        </FadeIn>

        <FadeIn delay={0.28} className="hero-actions">
          <a href="#projects" className="btn-shimmer">View Projects</a>
          <a href="#contact" className="btn-outline">Get in Touch</a>
        </FadeIn>
      </div>

      <div className="scroll-indicator">
        <span />
      </div>
    </section>
  );
}
