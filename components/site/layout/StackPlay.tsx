"use client";
import { useEffect, useRef } from "react";
import { Logo } from "@/components/site/Glyph";
import { LOGOS } from "@/lib/assets/icons";
import { rest, settle, sleeper, step, type Body } from "@/lib/physics/toss";

/** Stack name → Simple Icons slug, for the names we have a logo for; anything else gets a monogram tile. */
const SLUG: Record<string, string> = { Python: "python", JavaScript: "javascript", TypeScript: "typescript", "C++": "cplusplus", React: "react", "Next.js": "nextdotjs", "Node.js": "nodedotjs", Express: "express", TensorFlow: "tensorflow", Keras: "keras", "scikit-learn": "scikitlearn", Pandas: "pandas", MongoDB: "mongodb", Supabase: "supabase", Vercel: "vercel", Cloudflare: "cloudflare", "Google Apps Script": "googleappsscript", Arduino: "arduino", Ollama: "ollama", PostgreSQL: "postgresql", GitHub: "github" };
const MAX_TILES = 26;
/** Two or three letters for a tool with no logo: the capitals ("TinyML" is TM), else the first two letters; short names whole ("SQL"). */
const monogram = (n: string) => (n.length <= 3 ? n : (n.match(/[A-Z]/g)?.length ?? 0) >= 2 ? n.match(/[A-Z]/g)!.slice(0, 3).join("") : n.slice(0, 2));
const MAX_SPEED = 2600; // a toss faster than this would tunnel through its neighbours

/** The stack as logo tiles in a small physics box: they drop in when scrolled to, pile up, and can be dragged and
 *  tossed. One rAF loop, only while something moves. Under performance mode / reduced motion they start already
 *  settled (still draggable; the loop is the visitor's, not ambient). */
export default function StackPlay({ stack }: { stack: Record<string, string[]> }) {
  const names = [...new Set(Object.values(stack).flat())].slice(0, MAX_TILES);
  const box = useRef<HTMLDivElement>(null);
  const els = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const host = box.current;
    if (!host) return;
    const calm = document.documentElement.classList.contains("lite") || matchMedia("(prefers-reduced-motion: reduce)").matches;
    const r = host.clientWidth < 520 ? 24 : 29;
    const world = { w: host.clientWidth, h: host.clientHeight };
    const bodies: Body[] = names.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, r }));
    els.current.forEach((el) => { if (el) el.style.width = el.style.height = `${r * 2}px`; });
    const place = () => bodies.forEach((b, i) => { const el = els.current[i]; if (el) el.style.transform = `translate(${b.x - b.r}px, ${b.y - b.r}px)`; });
    // A loose grid at the top (never overlapping), so the first drop has somewhere to fall from.
    const cols = Math.max(1, Math.floor(world.w / (r * 2 + 6)));
    bodies.forEach((b, i) => { b.x = r + 3 + (i % cols) * (r * 2 + 6) + (Math.floor(i / cols) % 2) * 6; b.y = r + 38 + Math.floor(i / cols) * (r * 2 + 6); });

    const sleepy = sleeper();
    let raf = 0, last = 0, running = false, held: { b: Body; dx: number; dy: number; trail: [number, number, number][] } | null = null;
    const frame = (t: number) => {
      const dt = Math.min(1 / 30, last ? (t - last) / 1000 : 1 / 60);
      last = t;
      for (const b of bodies) { const s = Math.hypot(b.vx, b.vy); if (s > MAX_SPEED) { b.vx *= MAX_SPEED / s; b.vy *= MAX_SPEED / s; } }
      step(bodies, world, dt / 2); const speed = step(bodies, world, dt / 2); // two substeps keep fast tosses from tunnelling
      place();
      if (held || !sleepy(speed)) raf = requestAnimationFrame(frame);
      else { running = false; rest(bodies); }
    };
    const wake = () => { if (!running) { running = true; last = 0; sleepy(Infinity); raf = requestAnimationFrame(frame); } };

    if (calm) { settle(bodies, world); place(); } else place();

    // Drop the pile the first time the box is on screen.
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); if (!calm) wake(); } }, { threshold: 0.35 });
    io.observe(host);

    const ro = new ResizeObserver(() => {
      if (host.clientWidth === world.w && host.clientHeight === world.h) return;
      world.w = host.clientWidth; world.h = host.clientHeight;
      for (const b of bodies) { b.x = Math.min(b.x, world.w - b.r); b.y = Math.min(b.y, world.h - b.r); }
      if (calm) { settle(bodies, world); place(); } else wake();
    });
    ro.observe(host);

    // Pointer drag: the held body follows the pointer; on release it keeps the velocity of the last ~90ms.
    const local = (e: PointerEvent) => { const q = host.getBoundingClientRect(); return [e.clientX - q.left, e.clientY - q.top] as const; };
    const down = (e: PointerEvent) => {
      const li = (e.target as Element).closest<HTMLLIElement>("li[data-i]");
      if (!li || (e.pointerType === "mouse" && e.button !== 0)) return;
      const b = bodies[+li.dataset.i!], [px, py] = local(e);
      held = { b, dx: b.x - px, dy: b.y - py, trail: [] };
      b.held = true; b.vx = 0; b.vy = 0;
      li.setPointerCapture(e.pointerId);
      li.dataset.held = "";
      wake();
    };
    const move = (e: PointerEvent) => {
      if (!held) return;
      const [px, py] = local(e), { b } = held;
      b.x = Math.min(Math.max(px + held.dx, b.r), world.w - b.r);
      b.y = Math.min(Math.max(py + held.dy, b.r), world.h - b.r);
      held.trail.push([performance.now(), b.x, b.y]);
      if (held.trail.length > 8) held.trail.shift();
      place();
    };
    const up = (e: PointerEvent) => {
      if (!held) return;
      const { b, trail } = held, now = performance.now();
      const recent = trail.filter(([t]) => now - t < 90), a = recent[0], z = recent[recent.length - 1];
      if (a && z && z[0] > a[0]) { b.vx = ((z[1] - a[1]) / (z[0] - a[0])) * 1000; b.vy = ((z[2] - a[2]) / (z[0] - a[0])) * 1000; }
      b.held = false; held = null;
      (e.target as Element).closest("li")?.removeAttribute("data-held");
      wake();
    };
    host.addEventListener("pointerdown", down);
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerup", up);
    host.addEventListener("pointercancel", up);
    return () => {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
      host.removeEventListener("pointerdown", down); host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerup", up); host.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the tile set is read once per mount; `names` is derived from `stack`
  }, [names.join("|")]);

  return (
    <div className="ab-play" ref={box} aria-label="Tools I use. Drag and toss the tiles.">
      <ul className="ab-chips" role="list">
        {names.map((n, i) => {
          const slug = SLUG[n];
          return (
            <li key={n} className="ab-chip" data-i={i} data-name={n} ref={(el) => { els.current[i] = el; }}>
              {slug && slug in LOGOS ? <Logo slug={slug} /> : <span className="ab-mono" aria-hidden="true">{monogram(n)}</span>}
              <span className="sr-only">{n}</span>
            </li>
          );
        })}
      </ul>
      <span className="ab-play-k" aria-hidden="true">Drag and toss</span>
    </div>
  );
}
