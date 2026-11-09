"use client";
import { useEffect, useState } from "react";
import Mark from "@/components/site/mark/Mark";
import IAmRithvik from "@/components/site/IAmRithvik";

const LINKS = [["work", "Work"], ["about", "About"], ["play", "Play"], ["contact", "Contact"]] as const;

/** Pill nav: mark + four scroll-only anchors with a scroll-spy highlight; slides away while scrolling down. */
export default function Nav() {
  const [active, setActive] = useState<string | null>(null);
  const [away, setAway] = useState(false);

  // Hide on scroll down, show on scroll up; one rAF per burst of scroll events.
  useEffect(() => {
    let last = scrollY, raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = scrollY;
        if (Math.abs(y - last) < 6) return;
        setAway(y > last && y > 160);
        last = y;
      });
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => { removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  // Scroll-spy: the section crossing the middle band of the viewport is current.
  useEffect(() => {
    const els = ["top", ...LINKS.map(([id]) => id)].map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver((ens) => {
      for (const en of ens) if (en.isIntersecting) setActive(en.target.id === "top" ? null : en.target.id);
    }, { rootMargin: "-45% 0px -50% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  return (
    <header className={`cl-nav${away ? " away" : ""}`}>
      <nav className="cl-pill" aria-label="Sections">
        <a className="cl-brand" href="#top" aria-label="Back to top"><Mark label="" /></a>
        {LINKS.map(([id, label]) => (
          <a key={id} href={`#${id}`} aria-current={active === id ? "true" : undefined}>{label}</a>
        ))}
      </nav>
      <div className="cl-nav-r">
        <IAmRithvik className="cl-btn sm ghost cl-nav-iam" />
        <button type="button" className="cl-btn sm cl-nav-resume" data-resume="">Resume</button>
      </div>
    </header>
  );
}
