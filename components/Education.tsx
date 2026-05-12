import React from "react";
import EduLogo from "./EduLogo";

export default function Education() {
  return (
    <section className="education-section" id="education">
      <div className="section-header blur-fade">
        <p className="eyebrow">Education</p>
        <h2 style={{ fontSize: "clamp(2rem, 5vw, 3.6rem)", fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 0.95 }}>
          Academic background.
        </h2>
      </div>

      <div className="edu-card blur-fade" style={{ "--delay": "0.1s" } as React.CSSProperties}>
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
      </div>
    </section>
  );
}
