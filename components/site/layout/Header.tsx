"use client";
import { useEffect, useRef, useState } from "react";
import Mark from "@/components/site/mark/Mark";
import IAmRithvik from "@/components/site/IAmRithvik";
import { NAV_SECTIONS, SECTION_LABELS, type Skin } from "@/lib/designs/skin";

/** The sticky header every look shares: mark + full name (back to top), the section nav centred on the page with a
 *  scroll-spy highlight, and only "I am Rithvik" on the right. Turns solid once the page has scrolled. */
export default function Header({ name, skin }: { name: string; skin: Skin }) {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState<string | null>(null);

  // solid bar once scrolled; one rAF per burst of scroll events
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const on = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; el.toggleAttribute("data-past", scrollY > 8); }); };
    on();
    addEventListener("scroll", on, { passive: true });
    return () => { removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, []);

  // scroll-spy: the section crossing the middle band of the viewport is current
  useEffect(() => {
    const els = ["top", ...NAV_SECTIONS].map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver((ens) => {
      for (const en of ens) if (en.isIntersecting) setActive(en.target.id === "top" ? null : en.target.id);
    }, { rootMargin: "-45% 0px -50% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  return (
    <header ref={ref} className="ly-head">
      <a className="ly-brand" href="#top" aria-label={`${name}, back to top`}><span className="ly-mk"><Mark label="" /></span><span className="ly-brand-n">{name}</span></a>
      <nav className="ly-nav" aria-label="Sections">
        {NAV_SECTIONS.map((id) => (
          <a key={id} href={`#${id}`} aria-current={active === id ? "true" : undefined}>{skin.labels?.[id] ?? SECTION_LABELS[id]}</a>
        ))}
      </nav>
      <div className="ly-head-r"><IAmRithvik className="ly-iam" /></div>
    </header>
  );
}
