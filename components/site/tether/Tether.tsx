"use client";
import Image from "next/image";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { useSite } from "../SiteProvider";
import { Icon, Logo } from "../Glyph";
import { NODE_R, NODE_X, NODE_Y, PHOTO, VIEW, createWorld, drop, hold, pathOf, release, step, tug } from "./sim";
import { LAUNCH, beat } from "./pulse";
import "./tether.css";

type NodeKey = "github" | "linkedin" | "email" | "resume";
const NODES: { k: NodeKey; label: string }[] = [
  { k: "github", label: "GitHub" }, { k: "linkedin", label: "LinkedIn" }, { k: "email", label: "Email" }, { k: "resume", label: "Resume" },
];
const REST = createWorld(); // the settled strings: the server renders these, so no-JS and first paint match
const TRAIL = 6; // soft circles behind the pulse head, shrinking and fading: the comet tail
const TAIL = 0.2; // tail length as a share of the cable
const RING_R = PHOTO.r + 2; // the landing arc rides just outside the photo, on its ring
const DEG = 180 / Math.PI;
const angleOf = (s: { ax: number; ay: number }) => Math.atan2(s.ay - PHOTO.cy, s.ax - PHOTO.cx) * DEG;

const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;

/** Calm = reduced motion or performance mode (`html.lite`), read live so toggling takes effect at once. */
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");
const attrs = (el: Element, a: Record<string, string | number>) => { for (const k in a) el.setAttribute(k, String(a[k])); };

/** The portrait with its four contact nodes (GitHub, LinkedIn, Email, Resume) hanging on physical cables (a shaded
 *  sheath carrying pulses of light from the photo to each node, which glows when one arrives).
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
    const cables = Array.from(fig.querySelectorAll<SVGGElement>(".pt-cable")).map((g) => Array.from(g.querySelectorAll<SVGPathElement>("path")));
    // per cable: the light group and its parts; per node: the landing flash on the portrait ring
    const lights = Array.from(fig.querySelectorAll<SVGGElement>(".pt-light")).map((g) => ({
      g, wide: g.querySelector(".pt-lit-w")!, core: g.querySelector(".pt-lit-c")!, tail: g.querySelector(".pt-lit-t")!, trail: Array.from(g.querySelectorAll(".pt-tr")),
      bloom: g.querySelector(".pt-bloom")!, hot: g.querySelector(".pt-hot")!, head: g.querySelector(".pt-head")!,
    }));
    const lands = Array.from(fig.querySelectorAll<SVGGElement>(".pt-land")).map((g) => ({ g, blob: g.querySelector(".pt-blob")!, arc: g.querySelector(".pt-arc")! }));
    const w = createWorld();
    const ang = w.strings.map(angleOf);
    const tau = [0, 0, 0, 0], glow = [-1, -1, -1, -1];
    let raf = 0, last = 0, clock = 0, settling = false, shown = false, visible = false, started = false, scale = fig.clientWidth / VIEW.w || 1;
    let drag: { i: number; x: number; y: number; moved: boolean; id: number } | null = null;

    const draw = () => {
      w.nodes.forEach((n, i) => { nodes[i].style.transform = n.ox || n.oy ? `translate(${(n.ox * scale).toFixed(2)}px, ${(n.oy * scale).toFixed(2)}px)` : ""; });
      w.strings.forEach((s, i) => { const d = pathOf(s); for (const p of cables[i]) p.setAttribute("d", d); });
    };
    /** Puts the light back to rest (calm / performance mode): no pulses, no per-frame glow. */
    const rest = () => {
      if (!shown) return;
      shown = false;
      lights.forEach((l) => l.g.setAttribute("visibility", "hidden"));
      lands.forEach((l) => l.g.setAttribute("visibility", "hidden"));
      nodes.forEach((n, i) => { n.style.removeProperty("--g"); glow[i] = -1; });
    };
    /** One frame of the light: each node's glow, its pulse on the live cable path (head, bloom, tail, lit glass), the landing flash. */
    const pulses = (dt: number) => {
      shown = true;
      clock += dt;
      cables.forEach((paths, i) => {
        const b = beat(clock, i), sheath = paths[2], L = sheath.getTotalLength(), l = lights[i], ld = lands[i];
        if (Math.abs(b.glow - glow[i]) > 0.004) { glow[i] = b.glow; nodes[i].style.setProperty("--g", b.glow.toFixed(3)); }
        // the instant the glow is gone the pulse leaves: the node recoils a touch, and the string tugs with it
        if (tau[i] < LAUNCH && b.tau >= LAUNCH && b.tau - tau[i] < 0.5 && !w.nodes[i].held) w.nodes[i].vy += 55;
        tau[i] = b.tau;
        if (b.run < 0) l.g.setAttribute("visibility", "hidden");
        else {
          // the path runs portrait -> node, the pulse runs the other way, so its distance from the portrait shrinks
          const s = L * (1 - b.run), at = (d: number) => sheath.getPointAtLength(Math.min(L, d)), h = at(s), len = L * TAIL, a = Math.min(L, s);
          attrs(l.g, { visibility: "visible", opacity: Math.min(1, b.run * 14 + 0.15).toFixed(2) }); // leaves the node as a spark, then is full strength
          const run = Math.min(L, s + len) - a;
          attrs(l.tail, { "stroke-dasharray": `${run.toFixed(1)} ${L.toFixed(1)}`, "stroke-dashoffset": (-a).toFixed(1) });
          attrs(l.core, { "stroke-dasharray": `${(run * 0.4).toFixed(1)} ${L.toFixed(1)}`, "stroke-dashoffset": (-a).toFixed(1) });
          attrs(l.wide, { "stroke-dasharray": `${(run * 0.7).toFixed(1)} ${L.toFixed(1)}`, "stroke-dashoffset": (-a).toFixed(1) });
          l.trail.forEach((c, k) => {
            const d = s + ((k + 1) / TRAIL) * len, p = at(d);
            attrs(c, { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: d > L ? 0 : (5.4 * (1 - k / TRAIL)).toFixed(2) });
          });
          for (const c of [l.bloom, l.hot, l.head]) attrs(c, { cx: h.x.toFixed(1), cy: h.y.toFixed(1) });
        }
        // the flash where the pulse lands on the portrait ring: a soft blob plus an arc that spreads along the rim
        if (b.land < 0) ld.g.setAttribute("visibility", "hidden");
        else {
          const k = 1 - b.land, st = w.strings[i], arc = 16 + 60 * (1 - k * k), c = (2 * Math.PI * RING_R * arc) / 360;
          attrs(ld.g, { visibility: "visible", opacity: (k * k).toFixed(2) });
          attrs(ld.blob, { cx: st.ax.toFixed(1), cy: st.ay.toFixed(1), r: (10 + 26 * (1 - k * k)).toFixed(1) });
          attrs(ld.arc, { "stroke-dasharray": `${c.toFixed(1)} 9999`, transform: `rotate(${(ang[i] - arc / 2).toFixed(1)} ${PHOTO.cx} ${PHOTO.cy})` });
        }
      });
    };
    const tick = (t: number) => {
      raf = 0;
      const dt = last ? (t - last) / 1000 : 1 / 60;
      const moving = step(w, dt);
      last = t;
      if (moving || settling) draw(); // the cables only need rewriting while the physics moves (plus the frame it stops on)
      settling = moving;
      const lively = !calm();
      if (lively) pulses(Math.min(dt, 0.05)); else rest(); // a long frame never makes the clock jump
      if ((moving || lively) && visible) raf = requestAnimationFrame(tick);
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
    const mo = new MutationObserver(() => { if (!calm()) wake(); }); // leaving performance mode restarts the light
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
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
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); mo.disconnect();
      fig.removeEventListener("pointerover", onEnter); fig.removeEventListener("pointerdown", onDown);
      fig.removeEventListener("pointermove", onMove); fig.removeEventListener("pointerup", onUp); fig.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const rim = (i: number) => `pt-rim-${id}-${i}`;
  const grad = `pt-grad-${id}`, glowId = `pt-blob-${id}`;
  const photo = { left: pct(PHOTO.cx - PHOTO.r, VIEW.w), top: pct(PHOTO.cy - PHOTO.r, VIEW.h), width: pct(PHOTO.r * 2, VIEW.w) };
  const img = <Image src="/images/rithvik.jpeg" alt={content.name} fill priority={id === "hero"} sizes="(max-width: 640px) 70vw, 340px" />;
  const hidden = "hidden" as const; // the light is shown by script only; no JS or calm = clear glass
  return (
    <figure ref={ref} className={`pt${className ? " " + className : ""}`} aria-label={`${content.name} and where to reach him`}>
      <svg className="pt-beams" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} aria-hidden="true">
        <defs>
          {/* userSpaceOnUse: a perfectly vertical cable has a zero-width bounding box, which would draw nothing */}
          <linearGradient id={grad} gradientUnits="userSpaceOnUse" x1="0" y1={PHOTO.cy + PHOTO.r} x2="0" y2={NODE_Y - NODE_R}>
            <stop offset="0" style={{ stopColor: "var(--pt-pulse-a, #ff4d8d)" }} />
            <stop offset=".5" style={{ stopColor: "var(--pt-pulse-m, var(--pt-pulse-a, #ffffff))" }} />
            <stop offset="1" style={{ stopColor: "var(--pt-pulse-b, #ffd166)" }} />
          </linearGradient>
        </defs>
        {/* a cable = a glass tube (halo, rim, translucent body, inner highlight, fibre) plus the light that script runs along it */}
        {REST.strings.map((s, i) => {
          const d = pathOf(s);
          return (
            <g key={i} className="pt-cable">
              {["pt-halo", "pt-edge", "pt-sheath", "pt-sheen", "pt-core"].map((c) => <path key={c} className={c} d={d} mask={c === "pt-edge" ? `url(#${rim(i)})` : undefined} />)}
              <g className="pt-light" visibility={hidden}>
                <path className="pt-lit pt-lit-w" d={d} />
                <path className="pt-lit pt-lit-t" d={d} stroke={`url(#${grad})`} />
                <path className="pt-lit pt-lit-c" d={d} />
                {Array.from({ length: TRAIL }, (_, k) => <circle key={k} className="pt-tr" fill={`url(#${grad})`} opacity={(0.8 * (1 - k / TRAIL)).toFixed(2)} r={0} />)}
                <circle className="pt-bloom" r={24} fill={`url(#${glowId})`} />
                <circle className="pt-hot" r={8} />
                <circle className="pt-head" r={3.8} />
              </g>
              {/* the rim mask: a wide white stroke minus a narrower black one = just the glass edge. Last, so the sheath stays path #2. */}
              <mask id={rim(i)} className="pt-mk" maskUnits="userSpaceOnUse" x="-50" y="-50" width={VIEW.w + 100} height={VIEW.h + 100}>
                <path className="pt-mk-o" d={d} />
                <path className="pt-mk-i" d={d} />
              </mask>
            </g>
          );
        })}
      </svg>
      {Fx ? (
        <button type="button" className="pt-photo" style={photo} aria-pressed={fxOn} aria-label="Photo effect" onClick={() => setFxOn((v) => !v)}>
          {img}<Fx on={fxOn} />
        </button>
      ) : (
        <div className="pt-photo" style={photo}>{img}</div>
      )}
      {/* above the photo: where each pulse lands on the portrait's ring */}
      <svg className="pt-fx" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} aria-hidden="true">
        <defs>
          <radialGradient id={glowId}>
            <stop offset="0" style={{ stopColor: "var(--pt-head, #fff)", stopOpacity: 0.9 }} />
            <stop offset=".35" style={{ stopColor: "var(--pt-glow, #fff)", stopOpacity: 0.45 }} />
            <stop offset="1" style={{ stopColor: "var(--pt-glow, #fff)", stopOpacity: 0 }} />
          </radialGradient>
        </defs>
        {NODES.map((n) => (
          <g key={n.k} className="pt-land" visibility={hidden}>
            <circle className="pt-blob" r={10} fill={`url(#${glowId})`} />
            <circle className="pt-arc" cx={PHOTO.cx} cy={PHOTO.cy} r={RING_R} />
          </g>
        ))}
      </svg>
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
