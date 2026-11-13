"use client";
import { useEffect, useRef } from "react";
import { useSite } from "../SiteProvider";
import { Icon, Logo } from "../Glyph";
import { home, rest, step, type Body, type Box } from "./cloud";

const ITEMS = [{ k: "github", label: "GitHub" }, { k: "linkedin", label: "LinkedIn" }, { k: "email", label: "Email" }, { k: "resume", label: "Resume" }] as const;
const LINKS: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]]; // the filament: a loop plus one cross-strand
const REF: Box = { w: 1000, h: 320, size: 80 }; // server render: homes as percentages of a typical box, so no-JS shows a cloud too
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");

/** GitHub, LinkedIn, Email and Resume as four big buttons floating in a loose cluster: they orbit one another on a
 *  soft spring, never overlap, and lean away from the pointer; a faint filament joins them. One rAF, only while
 *  the cloud is on screen; `html.lite` / reduced motion draw the neat still arrangement. Restyle with the --pt-node-*
 *  tokens (`--cl-size` sets the button size). The buttons stay real links and buttons in a fixed tab order. */
export default function ContactCloud() {
  const { content } = useSite();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const nodes = Array.from(el.querySelectorAll<HTMLElement>(".cl-node"));
    const lines = Array.from(el.querySelectorAll<SVGLineElement>(".cl-fil line"));
    let b: Box = { ...REF }, bs: Body[] = rest(b);
    let raf = 0, last = 0, t = 0, visible = false;
    let pointer: [number, number] | null = null;

    const measure = () => { b = { w: el.clientWidth, h: el.clientHeight, size: nodes[0].offsetWidth }; };
    const draw = () => {
      const half = b.size / 2;
      // `translate`, not transform: the hover `scale` then grows a button about its own centre
      bs.forEach((p, i) => { nodes[i].style.translate = `${(p.x - half).toFixed(1)}px ${(p.y - half).toFixed(1)}px`; });
      LINKS.forEach(([a, c], i) => {
        const l = lines[i];
        l.setAttribute("x1", bs[a].x.toFixed(1)); l.setAttribute("y1", bs[a].y.toFixed(1));
        l.setAttribute("x2", bs[c].x.toFixed(1)); l.setAttribute("y2", bs[c].y.toFixed(1));
      });
    };
    const still = () => { measure(); bs = rest(b); draw(); };
    const tick = (now: number) => {
      raf = 0;
      if (calm()) { still(); return; }
      const dt = last ? Math.min(0.033, (now - last) / 1000) : 1 / 60;
      last = now; t += dt;
      step(bs, t, dt, b, pointer);
      draw();
      if (visible) raf = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(raf); raf = 0; last = 0;
      if (calm()) { still(); return; }
      if (!t) { t = 0.001; measure(); bs = rest(b); } // start from the neat arrangement
      if (visible) raf = requestAnimationFrame(tick);
    };

    // from here positions come from transforms: drop the server render's percentage anchors
    for (const n of nodes) { n.style.left = "0"; n.style.top = "0"; }
    still();
    const io = new IntersectionObserver(([en]) => { visible = !!en?.isIntersecting; sync(); });
    io.observe(el);
    const ro = new ResizeObserver(() => { measure(); if (calm() || !t) { bs = rest(b); draw(); } else for (const p of bs) { p.x = Math.min(b.w, p.x); p.y = Math.min(b.h, p.y); } });
    ro.observe(el);
    const mo = new MutationObserver(sync); // performance mode toggled
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      pointer = [e.clientX - r.left, e.clientY - r.top];
    };
    const onLeave = () => { pointer = null; };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); mo.disconnect(); el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerleave", onLeave); };
  }, []);

  return (
    <div ref={box} className="cl" role="group" aria-label="Where to reach him">
      <svg className="cl-fil" aria-hidden="true">{LINKS.map(([a, c]) => <line key={`${a}${c}`} />)}</svg>
      {ITEMS.map((n, i) => {
        const [x, y] = home(i, 0, REF);
        const style = { left: `${(x / REF.w) * 100}%`, top: `${(y / REF.h) * 100}%` };
        const inner = <>{n.k === "resume" ? <Icon name="file-text" /> : n.k === "email" ? <Icon name="mail" /> : <Logo slug={n.k} />}<span>{n.label}</span></>;
        const cls = `cl-node cl-${n.k}`;
        if (n.k === "resume") return <button key={n.k} type="button" className={cls} style={style} data-resume="">{inner}</button>;
        if (n.k === "email") return <a key={n.k} className={cls} style={style} href={`mailto:${content.links.email}`} data-compose="Hello">{inner}</a>;
        return <a key={n.k} className={cls} style={style} href={content.links[n.k]} target="_blank" rel="noopener">{inner}</a>;
      })}
    </div>
  );
}
