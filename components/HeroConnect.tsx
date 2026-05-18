"use client";
import { useRef } from "react";
import Image from "next/image";
import { AnimatedBeam } from "./ui/animated-beam";
import { GithubIcon, LinkedinIcon, EmailIcon } from "./SocialIcons";

interface Props {
  githubUrl: string;
  linkedinUrl: string;
  emailUrl: string;
}

// The hero "node graph": three circular social buttons on the left, the
// profile photo on the right, with animated beams flowing from each button
// into the photo — a visual cue that those links all connect to Rithvik.
export default function HeroConnect({ githubUrl, linkedinUrl, emailUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const githubRef = useRef<HTMLAnchorElement>(null);
  const linkedinRef = useRef<HTMLAnchorElement>(null);
  const emailRef = useRef<HTMLAnchorElement>(null);

  // Shared beam styling — gradient mirrors the hero's .gradient-text ramp so
  // the start color tracks the active theme accent.
  const beam = {
    containerRef,
    toRef: profileRef,
    pathColor: "var(--text)",
    pathOpacity: 0.12,
    pathWidth: 2,
    gradientStartColor: "var(--accent)",
    gradientStopColor: "#9b5fe0",
    duration: 4,
  };

  return (
    <div className="hero-connect" ref={containerRef}>
      <div className="hero-connect-buttons">
        <a
          ref={githubRef}
          href={githubUrl}
          target="_blank"
          rel="noreferrer"
          className="hero-connect-btn"
          aria-label="GitHub"
        >
          <GithubIcon size={22} />
        </a>
        <a
          ref={linkedinRef}
          href={linkedinUrl}
          target="_blank"
          rel="noreferrer"
          className="hero-connect-btn"
          aria-label="LinkedIn"
        >
          <LinkedinIcon size={22} />
        </a>
        <a ref={emailRef} href={emailUrl} className="hero-connect-btn" aria-label="Email">
          <EmailIcon size={22} />
        </a>
      </div>

      <div className="hero-connect-photo" ref={profileRef}>
        <Image
          src="/images/rithvik.jpeg"
          alt="Rithvik Praveen Kumar"
          fill
          sizes="160px"
          priority
          style={{ objectFit: "cover" }}
        />
      </div>

      {/* Beams render after the nodes; the nodes carry z-index to sit on top. */}
      <AnimatedBeam {...beam} fromRef={githubRef} curvature={55} delay={0} />
      <AnimatedBeam {...beam} fromRef={linkedinRef} curvature={0} delay={0.45} />
      <AnimatedBeam {...beam} fromRef={emailRef} curvature={-55} delay={0.9} />
    </div>
  );
}
