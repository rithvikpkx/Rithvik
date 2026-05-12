import React from "react";
import EduLogo from "./EduLogo";
import FadeIn from "./FadeIn";

export default function Education() {
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

      <FadeIn delay={0.1} className="edu-card">
        <EduLogo />

        <div className="edu-body">
          <div>
            <a href="https://www.cs.purdue.edu/" target="_blank" rel="noreferrer" className="edu-school">
              Purdue University
            </a>
          </div>
          <p className="edu-description">
            B.S. in{" "}
            <span className="edu-highlight" style={{ "--gd": "0s" } as React.CSSProperties}>
              Computer Science
            </span>
            {" "}+{" "}
            <span className="edu-highlight" style={{ "--gd": "1.4s" } as React.CSSProperties}>
              Mathematics
            </span>
            {" "}with concentrations in{" "}
            <span className="edu-highlight" style={{ "--gd": "2.8s" } as React.CSSProperties}>
              Software Engineering
            </span>
            {" "}and{" "}
            <span className="edu-highlight" style={{ "--gd": "4.2s" } as React.CSSProperties}>
              AI / ML
            </span>
          </p>
        </div>
      </FadeIn>
    </section>
  );
}
