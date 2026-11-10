"use client";
import Image from "next/image";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { useSite } from "../SiteProvider";
import { Icon, Logo } from "../Glyph";
import { NODE_X, NODE_Y, PHOTO, VIEW, createWorld, drop, hold, pathOf, release, step, tug } from "./sim";
import "./tether.css";

type NodeKey = "github" | "linkedin" | "email" | "resume";
const NODES: { k: NodeKey; label: string }[] = [
  { k: "github", label: "GitHub" }, { k: "linkedin", label: "LinkedIn" }, { k: "email", label: "Email" }, { k: "resume", label: "Resume" },
];
const REST = createWorld(); // the settled strings: the server renders these, so no-JS and first paint match
const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;

/** Calm = reduced motion or performance mode (`html.lite`), read live so toggling takes effect at once. */
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");

/** The portrait with its four contact nodes (GitHub, LinkedIn, Email, Resume) hanging on physical strings.
 *  When it first scrolls into view the nodes drop from the photo and bounce; hover tugs a string, a mouse can
 *  drag a node and let it spring home. One rAF loop that stops once everything is still and never runs off-screen.
 *  Under `html.lite` / reduced motion it is a still. Restyle with --pt-* tokens and .pt-* rules; the photo is never
 *  filtered unless the skin's `fx` is switched on by a click. */
export default function Tether({ id, className = "", fx: Fx }: { id: string; className?: string; fx?: ComponentType<{ on: boolean }> }) {
  const { content } = useSite();
  const ref = useRef<HTMLElement>(null);
  const [fxOn, setFxOn] = useState(false);

  useEffect(() => {
    const fig = ref.current;
    if (!fig) return;
    const nodes = Array.from(fig.querySelectorAll<HTMLElement>(".pt-node"));
    const beams = Array.from(fig.querySelectorAll<SVGPathElement>(".pt-beam"));
    const pulses = Array.from(fig.querySelectorAll<SVGPathElement>(".pt-pulse"));
    const w = createWorld();
    let raf = 0, last = 0, visible = false, started = false, scale = fig.clientWidth / VIEW.w || 1;
    let drag: { i: number; x: number; y: number; moved: boolean; id: number } | null = null;

    const draw = () => {
      w.nodes.forEach((n, i) => { nodes[i].style.transform = n.ox || n.oy ? `translate(${(n.ox * scale).toFixed(2)}px, ${(n.oy * scale).toFixed(2)}px)` : ""; });
      w.strings.forEach((s, i) => { const d = pathOf(s); beams[i].setAttribute("d", d); pulses[i].setAttribute("d", d); });
    };
    const tick = (t: number) => {
      raf = 0;
      const moving = step(w, last ? (t - last) / 1000 : 1 / 60);
      last = t;
      draw();
      if (moving && visible) raf = requestAnimationFrame(tick);
      else last = 0;
    };
    const wake = () => { if (!raf && visible) raf = requestAnimationFrame(tick); };

    // first time on screen: the opening drop (or straight to rest when calm); off-screen it never ticks
    const io = new IntersectionObserver(([en]) => {
      visible = !!en?.isIntersecting;
      fig.toggleAttribute("data-paused", !visible);
      if (visible && !started) {
        started = true;
        if (!calm()) { drop(w); fig.dataset.live = "drop"; } else fig.dataset.live = "";
        draw();
      }
      if (visible && !calm()) wake();
    });
    io.observe(fig);
    const ro = new ResizeObserver(() => { scale = fig.clientWidth / VIEW.w || 1; draw(); });
    ro.observe(fig);

    const nodeAt = (e: Event) => nodes.indexOf((e.target as Element).closest?.(".pt-node") as HTMLElement);
    const onEnter = (e: PointerEvent) => {
      const i = nodeAt(e);
      if (i < 0 || drag || e.pointerType === "touch" || calm()) return;
      if ((e.relatedTarget as Element | null)?.closest?.(".pt-node") === nodes[i]) return; // moved onto its own icon
      tug(w, i, Math.sign(e.movementX || 0)); wake();
    };
    const onDown = (e: PointerEvent) => {
      const i = nodeAt(e);
      if (i < 0 || e.button !== 0 || e.pointerType === "touch" || calm()) return; // touch keeps native scroll and taps
      drag = { i, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return; // below this it is a click, not a drag
      if (!drag.moved) { drag.moved = true; nodes[drag.i].setPointerCapture(e.pointerId); fig.dataset.drag = ""; }
      hold(w, drag.i, dx / scale, dy / scale); wake();
    };
    const onUp = () => {
      if (!drag) return;
      const d = drag;
      drag = null; delete fig.dataset.drag;
      if (!d.moved) return;
      release(w, d.i); wake();
      // a drag must not also follow the link / open the composer
      nodes[d.i].addEventListener("click", (c) => { c.preventDefault(); c.stopImmediatePropagation(); }, { capture: true, once: true });
    };
    fig.addEventListener("pointerover", onEnter);
    fig.addEventListener("pointerdown", onDown);
    fig.addEventListener("pointermove", onMove);
    fig.addEventListener("pointerup", onUp);
    fig.addEventListener("pointercancel", onUp);
    return () => {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
      fig.removeEventListener("pointerover", onEnter); fig.removeEventListener("pointerdown", onDown);
      fig.removeEventListener("pointermove", onMove); fig.removeEventListener("pointerup", onUp); fig.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const grad = `pt-grad-${id}`;
  const photo = { left: pct(PHOTO.cx - PHOTO.r, VIEW.w), top: pct(PHOTO.cy - PHOTO.r, VIEW.h), width: pct(PHOTO.r * 2, VIEW.w) };
  const img = <Image src="/images/rithvik.jpeg" alt={content.name} fill priority={id === "hero"} sizes="(max-width: 640px) 70vw, 340px" />;
  return (
    <figure ref={ref} className={`pt${className ? " " + className : ""}`} aria-label={`${content.name} and where to reach him`}>
      <svg className="pt-beams" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} aria-hidden="true">
        <defs>
          <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--pt-pulse-b, #ffd166)" />
            <stop offset="1" stopColor="var(--pt-pulse-a, #ff4d8d)" />
          </linearGradient>
        </defs>
        {REST.strings.map((s, i) => (
          <g key={i}>
            <path className="pt-beam" d={pathOf(s)} />
            <path className="pt-pulse" d={pathOf(s)} pathLength={1} stroke={`url(#${grad})`} style={{ animationDelay: `${(-i * 0.37).toFixed(2)}s` }} />
          </g>
        ))}
      </svg>
      {Fx ? (
        <button type="button" className="pt-photo" style={photo} aria-pressed={fxOn} aria-label="Photo effect" onClick={() => setFxOn((v) => !v)}>
          {img}<Fx on={fxOn} />
        </button>
      ) : (
        <div className="pt-photo" style={photo}>{img}</div>
      )}
      {NODES.map((n, i) => {
        const style = { left: pct(NODE_X[i], VIEW.w), top: pct(NODE_Y, VIEW.h) };
        const cls = `pt-node pt-${n.k}`;
        // draggable={false}: a mouse drag is ours (the string), not the browser's link drag-and-drop
        if (n.k === "resume") return <button key={n.k} type="button" className={cls} style={style} data-resume="" aria-label={n.label} data-tip={n.label}><Icon name="file-text" /></button>;
        if (n.k === "email") return <a key={n.k} className={cls} style={style} href={`mailto:${content.links.email}`} data-compose="" draggable={false} aria-label={n.label} data-tip={n.label}><Icon name="mail" /></a>;
        return <a key={n.k} className={cls} style={style} href={content.links[n.k]} target="_blank" rel="noopener" draggable={false} aria-label={n.label} data-tip={n.label}><Logo slug={n.k} /></a>;
      })}
    </figure>
  );
}
