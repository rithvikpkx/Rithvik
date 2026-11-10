"use client";
import { useEffect, useRef, useState } from "react";
import { Icon, Logo } from "@/components/site/Glyph";
import { LOGOS } from "@/lib/assets/icons";
import { bodyFor, halfW, offsetOf, rest, settle, sleeper, step, type Body } from "@/lib/physics/toss";

/** Stack name → Simple Icons slug, for the names we have a logo for; anything else gets a monogram tile. */
const SLUG: Record<string, string> = { Python: "python", JavaScript: "javascript", TypeScript: "typescript", "C++": "cplusplus", React: "react", "Next.js": "nextdotjs", "Node.js": "nodedotjs", Express: "express", TensorFlow: "tensorflow", Keras: "keras", "scikit-learn": "scikitlearn", Pandas: "pandas", MongoDB: "mongodb", Supabase: "supabase", Vercel: "vercel", Cloudflare: "cloudflare", "Google Apps Script": "googleappsscript", Arduino: "arduino", Ollama: "ollama", PostgreSQL: "postgresql", GitHub: "github" };
const MAX_TILES = 32;
const MODE_KEY = "rithvik-stack-mode";
type Mode = "logos" | "text";
/** Two or three letters for a tool with no logo: the capitals ("TinyML" is TM), else the first two letters; short names whole ("SQL"). */
const monogram = (n: string) => (n.length <= 3 ? n : (n.match(/[A-Z]/g)?.length ?? 0) >= 2 ? n.match(/[A-Z]/g)!.slice(0, 3).join("") : n.slice(0, 2));
const MAX_SPEED = 2600; // a toss faster than this would tunnel through its neighbours
const ROOM = 90; // how much taller the box gets while the tiles are loose, so there is somewhere to fall

/** The stack as logo tiles (or plain name chips), frozen in tidy labelled rows so every technology is readable at once.
 *  "Let them loose" turns on a small physics world: the tiles drop from where they sit, pile up, and can be dragged and
 *  tossed; "Tidy up" glides them home. The tiles never leave the normal layout (physics only adds a translate), so the
 *  frozen arrangement is always the target. One rAF loop, only while something moves. */
export default function StackPlay({ stack }: { stack: Record<string, string[]> }) {
  const seen = new Set<string>();
  const groups = Object.entries(stack)
    .map(([g, list]) => [g, list.filter((n) => n && !seen.has(n) && seen.size < MAX_TILES && seen.add(n))] as const)
    .filter(([, list]) => list.length);
  const names = groups.flatMap(([, list]) => list);
  const [mode, setMode] = useState<Mode>("logos");
  const [loose, setLoose] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const els = useRef<(HTMLLIElement | null)[]>([]);

  // The remembered Logos / Text choice (storage can be blocked, so it is only ever a convenience).
  // eslint-disable-next-line react-hooks/set-state-in-effect -- read after mount so server and first client render match
  useEffect(() => { try { if (localStorage.getItem(MODE_KEY) === "text") setMode("text"); } catch {} }, []);
  const choose = (m: Mode) => { setMode(m); try { localStorage.setItem(MODE_KEY, m); } catch {} };

  useEffect(() => {
    const host = box.current;
    if (!host || !loose) return;
    const calm = document.documentElement.classList.contains("lite") || matchMedia("(prefers-reduced-motion: reduce)").matches;
    const chips = els.current.slice(0, names.length) as HTMLLIElement[];
    chips.forEach((el) => { el.style.transform = ""; }); // measure the frozen layout, not the last pile
    const hq = host.getBoundingClientRect();
    const rects = chips.map((el) => { const q = el.getBoundingClientRect(); return { x: q.left - hq.left, y: q.top - hq.top, w: q.width, h: q.height }; });
    const bodies: Body[] = rects.map(bodyFor);
    const tall = Math.max(host.offsetHeight + ROOM, 280);
    const world = { w: host.clientWidth, h: calm ? tall : host.clientHeight };
    host.style.minHeight = `${tall}px`;
    const place = () => bodies.forEach((b, i) => { const [dx, dy] = offsetOf(b, rects[i]); chips[i].style.transform = `translate(${dx}px, ${dy}px)`; });

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

    if (calm) { settle(bodies, world); place(); } else wake();

    const ro = new ResizeObserver(() => {
      if (host.clientWidth === world.w && host.clientHeight === world.h) return;
      world.w = host.clientWidth; world.h = host.clientHeight;
      for (const b of bodies) { b.x = Math.min(b.x, world.w - halfW(b)); b.y = Math.min(b.y, world.h - b.r); }
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
      b.x = Math.min(Math.max(px + held.dx, halfW(b)), world.w - halfW(b));
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
      cancelAnimationFrame(raf); ro.disconnect();
      host.removeEventListener("pointerdown", down); host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerup", up); host.removeEventListener("pointercancel", up);
      // Tidy up: clearing the translate lets the CSS transition glide every tile back to its place in the frozen rows.
      host.style.minHeight = "";
      chips.forEach((el) => { el.style.transform = ""; el.removeAttribute("data-held"); });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-measure when the tile set or the chip style changes; `names` is derived from `stack`
  }, [loose, mode, names.join("|")]);

  let i = 0;
  return (
    <div className="ab-play" ref={box} data-mode={mode} data-loose={loose || undefined}>
      <div className="ab-bar">
        <div className="ab-seg" role="group" aria-label="Show technologies as">
          {(["logos", "text"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => choose(m)}>{m === "logos" ? "Logos" : "Text"}</button>
          ))}
        </div>
        <button type="button" className="ab-go" aria-pressed={loose} onClick={() => setLoose((v) => !v)}>
          <Icon name={loose ? "rotate-ccw" : "shuffle"} />{loose ? "Tidy up" : "Let them loose"}
        </button>
      </div>
      <div className="ab-groups">
        {groups.map(([g, list]) => (
          <section key={g} className="ab-group" aria-label={g}>
            <h3 className="ab-gk">{g}</h3>
            <ul className="ab-chips" role="list">
              {list.map((n) => {
                const k = i++, slug = SLUG[n], logo = slug && slug in LOGOS;
                return (
                  <li key={n} className="ab-chip" data-i={k} data-name={n} tabIndex={mode === "logos" ? 0 : undefined} ref={(el) => { els.current[k] = el; }}>
                    {mode === "text" ? n : (
                      <>
                        {logo ? <Logo slug={slug} /> : <span className="ab-mono" aria-hidden="true">{monogram(n)}</span>}
                        <span className="sr-only">{n}</span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {loose && <span className="ab-play-k" aria-hidden="true">Drag and toss</span>}
    </div>
  );
}
