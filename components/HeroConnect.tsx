"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { AnimatedBeam } from "./ui/animated-beam";
import { GithubIcon, LinkedinIcon, EmailIcon } from "./SocialIcons";

interface Props {
  githubUrl: string;
  linkedinUrl: string;
  emailUrl: string;
}

// The hero "node graph": the profile photo on top, three social buttons in a
// row beneath it, with animated beams pulsing upward from each button into the
// photo — a visual cue that those links all connect to Rithvik.
export default function HeroConnect({ githubUrl, linkedinUrl, emailUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const githubRef = useRef<HTMLAnchorElement>(null);
  const linkedinRef = useRef<HTMLAnchorElement>(null);
  const emailRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Copies the bare email (mailto: prefix stripped) and flashes a confirmation
  // — mirrors the Contact section's email button.
  const copyEmail = async () => {
    const address = emailUrl.replace(/^mailto:/i, "").trim();
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      return; // clipboard unavailable (insecure context / denied) — fail silently
    }
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  // Shared beam config — identical delay/duration on all three so they pulse
  // in unison. Gradient start tracks the active theme accent.
  const beam = {
    containerRef,
    toRef: profileRef,
    className: "hero-beam",
    vertical: true,
    pathColor: "var(--text)",
    pathOpacity: 0.1,
    pathWidth: 4,
    gradientStartColor: "var(--accent)",
    gradientStopColor: "#d9c2ff",
    duration: 6,
    repeatDelay: 1.2,
    delay: 0,
  };

  return (
    <div className="hero-connect" ref={containerRef}>
      <div className="hero-connect-photo" ref={profileRef}>
        <div className="hero-connect-photo-img">
          <Image
            src="/images/rithvik.jpeg"
            alt="Rithvik Praveen Kumar"
            fill
            sizes="180px"
            priority
            style={{ objectFit: "cover" }}
          />
        </div>
        <span className="hero-photo-tip">Rithvik Praveen Kumar. As of 05/15/2026</span>
      </div>

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
        <button
          ref={emailRef}
          type="button"
          onClick={copyEmail}
          className="hero-connect-btn"
          aria-label="Copy email address"
        >
          <EmailIcon size={22} />
        </button>
      </div>

      {copied && (
        <span className="hero-connect-copied" role="status">
          Email copied to clipboard
        </span>
      )}

      {/* Beams render after the nodes; the nodes carry z-index to sit on top. */}
      <AnimatedBeam {...beam} fromRef={githubRef} curvature={22} />
      <AnimatedBeam {...beam} fromRef={linkedinRef} curvature={0} />
      <AnimatedBeam {...beam} fromRef={emailRef} curvature={22} />
    </div>
  );
}
