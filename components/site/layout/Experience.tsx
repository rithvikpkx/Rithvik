"use client";
import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import type { Content } from "@/lib/content/types";
import type { SectionProps } from "@/lib/designs/skin";
import EduMeta from "@/components/site/EduMeta";
import { fillFor, orgMark, springStep } from "./xp";
import "./experience.css";

const MAX_POINTS = 2; // low density: the first two bullets; the case for more lives in the resume
const LINE = 0.62; // the reading line, as a share of the viewport height: a connector fills as it passes it

/** Content stores the bare logo file name; resolve it to a URL. */
export const logoSrc = (l: string) => (/^(\/|https?:)/.test(l) ? l : `/images/${l}`);

/** Calm = reduced motion or performance mode; read live so toggling takes effect at once. */
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");

/** The physics shared by every look: stations spring in as they arrive, each connector fills with scroll
 *  (`--fill` 0–1 on `.ly-st-link`, nodes past the line get `data-lit`), and the education object rides a damped
 *  spring toward the pointer (`--px`/`--py` -1–1, `--pv` 0–1 speed). Calm: everything settled, nothing moves. */
function useXpPhysics(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const stations = Array.from(root.querySelectorAll<HTMLElement>(".ly-st"));
    const links = Array.from(root.querySelectorAll<HTMLElement>(".ly-st-link"));
    const edu = root.querySelector<HTMLElement>(".ly-xp-edu"), obj = root.querySelector<HTMLElement>(".ly-edu-obj");
    let raf = 0, live = false;

    const settle = () => {
      root.removeAttribute("data-armed");
      stations.forEach((s) => { s.dataset.in = ""; s.dataset.lit = ""; });
      links.forEach((l) => l.style.removeProperty("--fill"));
    };
    // one batched read pass, then the writes
    const frame = () => {
      raf = 0;
      if (calm()) return settle();
      root.dataset.armed = "";
      const line = innerHeight * LINE;
      const fills = links.map((l) => { const r = l.getBoundingClientRect(); return fillFor(r.top, r.height, line); });
      const lit = stations.map((s) => s.firstElementChild!.getBoundingClientRect().top < line);
      links.forEach((l, i) => l.style.setProperty("--fill", fills[i].toFixed(3)));
      stations.forEach((s, i) => s.toggleAttribute("data-lit", lit[i]));
    };
    const onScroll = () => { if (live && !raf) raf = requestAnimationFrame(frame); };
    if (!calm()) root.dataset.armed = "";

    // stations settle in once, the first time they come into view
    const arrive = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { (e.target as HTMLElement).dataset.in = ""; arrive.unobserve(e.target); }
    }), { threshold: 0.15 });
    stations.forEach((s) => arrive.observe(s));
    // the scroll work (and the looks' idle loops, via data-live) run only while the section is near the screen
    const near = new IntersectionObserver(([e]) => { live = e.isIntersecting; root.toggleAttribute("data-live", live); onScroll(); }, { rootMargin: "120px 0px" });
    near.observe(root);
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll, { passive: true });

    // the education object: a spring toward the pointer, a poke on press
    let px = 0, py = 0, vx = 0, vy = 0, tx = 0, ty = 0, praf = 0, last = 0;
    const tick = (t: number) => {
      const dt = last ? Math.min(1 / 30, (t - last) / 1000) : 1 / 60;
      last = t;
      [px, vx] = springStep(px, vx, tx, dt);
      [py, vy] = springStep(py, vy, ty, dt);
      obj!.style.setProperty("--px", px.toFixed(3));
      obj!.style.setProperty("--py", py.toFixed(3));
      obj!.style.setProperty("--pv", Math.min(1, Math.hypot(vx, vy) / 8).toFixed(3));
      const still = Math.abs(px - tx) + Math.abs(py - ty) < 0.002 && Math.abs(vx) + Math.abs(vy) < 0.002;
      praf = still ? 0 : requestAnimationFrame(tick);
      if (still) last = 0;
    };
    const kick = () => { if (!praf) praf = requestAnimationFrame(tick); };
    const aim = (ev: PointerEvent) => {
      if (calm() || !obj) return;
      const r = obj.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, (ev.clientX - r.left - r.width / 2) / (r.width / 2)));
      ty = Math.max(-1, Math.min(1, (ev.clientY - r.top - r.height / 2) / (r.height / 2)));
      kick();
    };
    const rest = () => { tx = ty = 0; if (obj && !calm()) kick(); };
    const poke = (ev: PointerEvent) => { if (calm() || !obj) return; aim(ev); vx -= tx * 6; vy += 7; kick(); };
    edu?.addEventListener("pointermove", aim);
    edu?.addEventListener("pointerleave", rest);
    obj?.addEventListener("pointerdown", poke);

    return () => {
      cancelAnimationFrame(raf); cancelAnimationFrame(praf);
      arrive.disconnect(); near.disconnect();
      removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll);
      edu?.removeEventListener("pointermove", aim); edu?.removeEventListener("pointerleave", rest);
      obj?.removeEventListener("pointerdown", poke);
    };
  }, [ref]);
}

/** Experience: the roles as stations down one connector (the skin's material), then the education object with its
 *  caption. The layout is identical in every look; only the connector, the object and the CSS change. */
export default function Experience({ content: c, skin }: SectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  useXpPhysics(ref);
  const e = c.education, n = c.experience.length;
  const Link = skin.ExperienceConnector ?? Thread, Edu = skin.EducationObject ?? Seal;
  return (
    <div className="ly-xp" ref={ref}>
      <ol className="ly-xp-roles">
        {c.experience.map((r, i) => (
          <li key={r.slug} id={`experience-${r.slug}`} className="ly-st" style={{ "--i": i } as CSSProperties}>
            <span className="ly-st-node" aria-hidden="true"><span>{orgMark(r.org || r.role)}</span></span>
            <div className="ly-st-body">
              <p className="ly-st-when"><span data-edit={`role:${r.slug}:when`}>{r.when}</span>{r.where && <> · <span data-edit={`role:${r.slug}:where`}>{r.where}</span></>}</p>
              <h3 className="ly-st-role" data-edit={`role:${r.slug}:role`}>{r.role}</h3>
              {r.org && <p className="ly-st-org" data-edit={`role:${r.slug}:org`}>{r.org}</p>}
              {r.desc.length > 0 && <ul className="ly-st-pts">{r.desc.slice(0, MAX_POINTS).map((d, j) => <li key={j} data-edit={`role:${r.slug}:desc.${j}`}>{d}</li>)}</ul>}
            </div>
            {i < n - 1 && <span className="ly-st-link" aria-hidden="true"><Link index={i} count={n} /></span>}
          </li>
        ))}
      </ol>
      {e.school && (
        <aside className="ly-xp-edu" id="education" aria-label="Education">
          <div className="ly-edu-obj" aria-hidden="true"><div className="ly-edu-tilt"><Edu education={e} /></div></div>
          <div className="ly-edu-cap">
            <h3 data-edit="edu:school">{e.school}</h3>
            {e.degree && <p data-edit="edu:degree">{e.degree}</p>}
            {(e.focus || e.grad) && <p className="ly-edu-meta"><EduMeta e={e} /></p>}
          </div>
        </aside>
      )}
    </div>
  );
}

/** The shared connector (Classic's): a clean rounded thread that fills with a bead riding its front. */
function Thread() {
  return <><i className="xp-track xp-thread" /><i className="xp-fill xp-thread xp-thread-on" /><i className="xp-head"><b className="xp-bead" /></i></>;
}

/** The shared education object (Classic's): a refined seal, the school and degree set round its rim, the logo
 *  at its centre. Palette tokens only, so it follows every legacy palette. */
function Seal({ education: e }: { education: Content["education"] }) {
  const rim = `${e.school} · ${e.degree} · `.toUpperCase();
  return (
    <svg className="xp-seal" viewBox="0 0 200 200" focusable="false">
      <defs><path id="xp-seal-rim" d="M100 100 m-74 0 a74 74 0 1 1 148 0 a74 74 0 1 1 -148 0" /></defs>
      <circle className="xp-seal-disc" cx="100" cy="100" r="96" />
      <circle className="xp-seal-ring" cx="100" cy="100" r="88" />
      <circle className="xp-seal-ring" cx="100" cy="100" r="58" />
      <g className="xp-seal-rim"><text><textPath href="#xp-seal-rim" textLength="462" lengthAdjust="spacingAndGlyphs">{rim}</textPath></text></g>
      {e.logo && <image href={logoSrc(e.logo)} x="62" y="72" width="76" height="56" preserveAspectRatio="xMidYMid meet" />}
    </svg>
  );
}
