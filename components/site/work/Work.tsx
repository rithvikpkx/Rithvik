"use client";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import type { SectionProps } from "@/lib/designs/skin";
import { Icon } from "@/components/site/Glyph";
import ProjectArt from "./ProjectArt";
import { facetAt, facetDir, rotationFor, wedgeClip } from "./rosette";
import "./work.css";

const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");
const mouse = (e: RPointerEvent) => e.pointerType === "mouse";

/** Work: every project is a facet of one disc of procedural art, beside the list of titles. Hovering or focusing a
 *  title turns the disc on a spring until that facet faces the list and lifts out; the disc itself can be spun
 *  (it coasts and settles on the nearest facet). Every facet and row opens the case sheet. */
export default function Work({ content: c, skin }: SectionProps) {
  // params: the art's density/stroke, plus the disc's hole (0..1 of the radius), rest gap and lift (px)
  const ps = c.projects, n = ps.length, params = skin.projectArt?.params, hole = params?.hole ?? 0.34;
  const [on, setOn] = useState(0);
  const disc = useRef<HTMLDivElement>(null), spin = useRef<HTMLDivElement>(null), list = useRef<HTMLOListElement>(null);
  const go = useRef<(i: number) => void>(() => {});

  // The disc's physics: one rAF loop that runs only while it moves, a drag that spins it, detents on release.
  useEffect(() => {
    const el = disc.current, sp = spin.current;
    if (!el || !sp || !n) return;
    const s = { rot: 0, vel: 0, target: 0, raf: 0, t: 0, dragEnd: 0 };
    const paint = () => { sp.style.transform = `rotate(${s.rot.toFixed(2)}deg)`; };
    const step = (now: number) => {
      const k = Math.min(3, (now - s.t) / 16.7); s.t = now;
      s.vel += ((s.target - s.rot) * 0.06 - s.vel * 0.28) * k; // under-damped: it overshoots a little, like a detent
      s.rot += s.vel * k; paint();
      if (Math.abs(s.target - s.rot) < 0.05 && Math.abs(s.vel) < 0.05) { s.rot = s.target; s.vel = 0; paint(); s.raf = 0; return; }
      s.raf = requestAnimationFrame(step);
    };
    const settle = (i: number, from: number) => {
      s.target = rotationFor(i, n, from);
      if (calm()) { s.rot = s.target; s.vel = 0; paint(); return; }
      if (!s.raf) { s.t = performance.now(); s.raf = requestAnimationFrame(step); }
    };
    go.current = (i) => { setOn(i); settle(i, s.rot); };

    let drag: { a: number; x: number; y: number; px: number; t: number } | null = null;
    const ang = (e: PointerEvent) => { const r = el.getBoundingClientRect(); return (Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2) * 180) / Math.PI; };
    const down = (e: PointerEvent) => { if (e.button) return; drag = { a: ang(e), x: e.clientX, y: e.clientY, px: 0, t: performance.now() }; };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      drag.px = Math.max(drag.px, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
      if (drag.px < 6) return; // a click, so far
      if (!el.hasPointerCapture(e.pointerId)) { el.setPointerCapture(e.pointerId); cancelAnimationFrame(s.raf); s.raf = 0; el.dataset.drag = ""; }
      const a = ang(e), da = ((a - drag.a + 540) % 360) - 180, now = performance.now();
      drag.a = a; s.rot += da; s.vel = da / Math.max(1, (now - drag.t) / 16.7); drag.t = now; paint();
    };
    const up = () => {
      if (!drag) return;
      const spun = drag.px >= 6; drag = null;
      if (!spun) return;
      delete el.dataset.drag; s.dragEnd = performance.now();
      const rest = s.rot + (calm() ? 0 : s.vel * 12); // coast, then the nearest facet catches it
      const i = facetAt(rest, n); setOn(i); settle(i, rest);
    };
    // a spin ends with a click on whatever facet is under the pointer: swallow it before the case sheet sees it
    const click = (e: MouseEvent) => { if (performance.now() - s.dragEnd < 250) { e.preventDefault(); e.stopPropagation(); } };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("click", click, true);
    return () => {
      cancelAnimationFrame(s.raf); go.current = () => {};
      el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); el.removeEventListener("click", click, true);
    };
  }, [n]);

  // Arrow keys walk the list; focus turns the disc.
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    const j = d ? (i + d + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    list.current?.querySelectorAll<HTMLAnchorElement>(".wk-item")[j]?.focus();
  };

  if (!n) return null;
  const cur = ps[on] ?? ps[0];
  return (
    // with five or more facets each is narrow enough to show its art smaller, so more of the picture fits in it
    <div className="wk" style={{ "--wk-hole": hole, "--wk-art": n >= 5 ? 0.72 : 1, "--wk-rest": `${params?.rest ?? 3}px`, "--wk-lift": `${params?.lift ?? 18}px` } as CSSProperties}>
      <div className="wk-disc" ref={disc} aria-hidden="true">
        <div className="wk-spin" ref={spin}>
          {ps.map((p, i) => {
            const [ux, uy] = facetDir(i, n);
            return (
              <a key={p.slug} className="wk-facet" href={`/work/${p.slug}`} data-case={p.slug} tabIndex={-1} data-on={i === on ? "" : undefined}
                style={{ clipPath: wedgeClip(i, n, hole), "--ux": ux, "--uy": uy } as CSSProperties}
                onPointerEnter={(e) => mouse(e) && setOn(i)}>
                <span className="wk-art"><ProjectArt project={p} params={params} rank={n > 1 ? i / (n - 1) : 0} /></span>
              </a>
            );
          })}
        </div>
        {hole > 0 && <span className="wk-hub"><Icon name={cur.icon} /></span>}
        <span className="wk-notch" />
      </div>
      <ol className="wk-list" ref={list}>
        {ps.map((p, i) => (
          <li key={p.slug} id={`project-${p.slug}`}>
            <a className="wk-item" href={`/work/${p.slug}`} data-case={p.slug} aria-current={i === on ? "true" : undefined}
              onPointerEnter={(e) => mouse(e) && go.current(i)} onFocus={() => go.current(i)} onKeyDown={(e) => onKey(e, i)}>
              <span className="wk-t" data-edit={`project:${p.slug}:title`}>{p.title}</span>
              <span className="wk-h" data-edit={`project:${p.slug}:headline`}>{p.headline}</span>
              <span className="wk-kind" data-edit={`project:${p.slug}:kind`}>{p.kind}</span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
