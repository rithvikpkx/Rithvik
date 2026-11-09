"use client";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { useSite } from "../SiteProvider";
import { Icon, Logo } from "../Glyph";
import "./portrait.css";

// Geometry lives in a 400x470 box: photo centre (200,200) r=150; nodes on r=228 at 126/90/54 degrees.
type NodeSpec = { k: "github" | "linkedin" | "email"; a: number; label: string };
const NODES: NodeSpec[] = [
  { k: "github", a: 126, label: "GitHub" },
  { k: "linkedin", a: 90, label: "LinkedIn" },
  { k: "email", a: 54, label: "Email" },
];
const d2r = (d: number) => (d * Math.PI) / 180;

/** Quadratic beam from each node's rim into the photo's lower edge (same maths as the mockup). */
const BEAMS = NODES.map((n) => {
  const s = d2r(n.a), e = d2r(90 + (n.a - 90) * 0.42), c = d2r(90 + (n.a - 90) * 0.1);
  const x0 = 200 + 202 * Math.cos(s), y0 = 200 + 202 * Math.sin(s), x1 = 200 + 150 * Math.cos(e), y1 = 200 + 150 * Math.sin(e);
  const cx = 200 + 188 * Math.cos(c), cy = 200 + 188 * Math.sin(c);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
});

/** The portrait: the plain photo (never filtered), three contact nodes beneath it and beams with travelling
 *  pulses curving into it. Size it with the width of a wrapper; restyle through --pt-* tokens and .pt-* rules.
 *  Call it once per page; `id` namespaces the pulse gradient. Positions are percentages of a fixed viewBox,
 *  so it scales with no JS measuring. */
export default function Portrait({ id, className = "" }: { id: string; className?: string }) {
  const { content } = useSite();
  const ref = useRef<HTMLElement>(null);

  // Pause the pulses while off-screen (CSS keys off data-paused) so a scrolled-past portrait costs nothing.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([en]) => { if (en) el.toggleAttribute("data-paused", !en.isIntersecting); });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const hrefs = { github: content.links.github, linkedin: content.links.linkedin, email: null };
  const grad = `pt-grad-${id}`;
  return (
    <figure ref={ref} className={`pt${className ? " " + className : ""}`} aria-label={`${content.name} and where to reach him`}>
      <svg className="pt-beams" viewBox="0 0 400 470" aria-hidden="true">
        <defs>
          <linearGradient id={grad} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="var(--pt-pulse-a, #ff4d8d)" stopOpacity="0" />
            <stop offset=".45" stopColor="var(--pt-pulse-a, #ff4d8d)" />
            <stop offset="1" stopColor="var(--pt-pulse-b, #ffd166)" />
          </linearGradient>
        </defs>
        {BEAMS.map((d, i) => (
          <g key={i}>
            <path className="pt-beam" d={d} />
            <path className="pt-pulse" d={d} pathLength={1} stroke={`url(#${grad})`} style={{ animationDelay: `${(i * 0.14).toFixed(2)}s` }} />
          </g>
        ))}
      </svg>
      <div className="pt-photo">
        <Image src="/images/rithvik.jpeg" alt={content.name} fill priority sizes="(max-width: 640px) 80vw, 540px" />
      </div>
      {NODES.map((n) => {
        const href = hrefs[n.k];
        const pos = { left: `${((200 + 228 * Math.cos(d2r(n.a))) / 4).toFixed(2)}%`, top: `${(((200 + 228 * Math.sin(d2r(n.a))) / 470) * 100).toFixed(2)}%` };
        const inner = n.k === "email" ? <Icon name="mail" /> : <Logo slug={n.k} />;
        // Email opens the composer via SiteProvider's [data-compose] hook; mailto is the no-JS fallback.
        return href ? (
          <a key={n.k} className={`pt-node pt-${n.k}`} href={href} target="_blank" rel="noopener" style={pos} aria-label={n.label} data-tip={n.label}>{inner}</a>
        ) : (
          <a key={n.k} className={`pt-node pt-${n.k}`} href={`mailto:${content.links.email}`} data-compose="" style={pos} aria-label={n.label} data-tip={n.label}>{inner}</a>
        );
      })}
    </figure>
  );
}
