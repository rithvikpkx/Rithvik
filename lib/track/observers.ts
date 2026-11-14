/** DOM observers that turn page behaviour into tracker events: clicks, section views, scroll depth, active time,
 *  design switches, JS errors and web-vitals. Everything is passive and cheap (no per-frame work). */
import type { Engine } from "./engine";

const SECTIONS = ["top", "experience", "work", "about", "play", "questions", "contact"];
const READ_MIN_MS = 2000;  // shorter than this is scrolling past, not reading
const HOVER_MIN_MS = 900;  // shorter than this is the pointer passing over
// what a hover names: a project, a role, a contact node, a link or a button
const HOVERABLE = '[data-case],[id^="project-"],[id^="experience-"],.pt-node,.cl-node,a[href],button';
const HOOKS = ["case", "compose", "resume", "agent", "play", "copy", "theme-go"];
const CLICKABLE = ["a", "button", "[role=button]", ...HOOKS.map((h) => `[data-${h}]`)].join(",");
const ACTIVE_WINDOW_MS = 15_000;

const clip = (s: string | null | undefined, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** Installs every observer and returns one teardown. */
export function observe(eng: Engine): () => void {
  const { emit } = eng;
  const off: (() => void)[] = [];
  const on = <K extends keyof WindowEventMap>(t: K, f: (e: WindowEventMap[K]) => void, o?: AddEventListenerOptions) => {
    window.addEventListener(t, f, o);
    off.push(() => window.removeEventListener(t, f, o));
  };

  // Clicks: links, buttons and every data-* hook; external links also become `outbound`, downloads `resume`.
  const onClick = (e: MouseEvent) => {
    const el = (e.target as Element | null)?.closest?.(CLICKABLE);
    if (!el) return;
    const hook = HOOKS.find((h) => el.hasAttribute(`data-${h}`));
    const data: Record<string, unknown> = { tag: el.tagName.toLowerCase(), text: clip(el.getAttribute("aria-label") || el.textContent, 80) };
    if (hook) { data.hook = hook; data.val = clip(el.getAttribute(`data-${hook}`), 80); }
    if (el instanceof HTMLAnchorElement && el.href) {
      let u: URL | null = null;
      try { u = new URL(el.href); } catch { /* malformed href */ }
      if (u) {
        const web = u.protocol === "http:" || u.protocol === "https:";
        data.href = web ? (u.origin === location.origin ? u.pathname + u.hash : u.origin + u.pathname).slice(0, 200) : u.protocol; // mailto/tel: scheme only
        if (web && u.origin !== location.origin) emit("outbound", { host: u.host, href: data.href });
        if (el.hasAttribute("download") || /\.pdf$/i.test(u.pathname)) emit("resume", { action: "download", href: u.pathname });
      }
    }
    emit("click", data);
  };
  document.addEventListener("click", onClick, { capture: true, passive: true });
  off.push(() => document.removeEventListener("click", onClick, true));

  // Sections: fires once per section when it crosses the middle band of the viewport.
  const seen = new Set<string>();
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const id = en.target.id;
      if (seen.has(id)) continue;
      seen.add(id);
      emit("section", { id });
    }
  }, { rootMargin: "-35% 0px -35% 0px", threshold: 0 });
  const watched = new WeakSet<Element>();
  const scan = () => {
    const els = [...SECTIONS.map((s) => document.getElementById(s)), ...document.querySelectorAll('[id^="project-"]')];
    for (const el of els) if (el && !watched.has(el)) { watched.add(el); io.observe(el); }
  };
  scan();
  const scans = [1500, 4000, 10_000].map((ms) => setTimeout(scan, ms)); // designs mount sections lazily
  off.push(() => { io.disconnect(); scans.forEach(clearTimeout); });

  // Design / palette switches (the engine writes data-design and data-theme on <html>).
  let lastDesign = document.documentElement.dataset.design;
  const mo = new MutationObserver(() => {
    const d = document.documentElement.dataset.design;
    if (d !== lastDesign) { lastDesign = d; emit("design", { design: d, theme: document.documentElement.dataset.theme }); setTimeout(scan, 600); }
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-design"] });
  off.push(() => mo.disconnect());

  // Scroll depth milestones.
  const marks = [25, 50, 75, 100];
  let st: ReturnType<typeof setTimeout> | undefined;
  let lastInput = Date.now();
  const checkScroll = () => {
    st = undefined;
    const d = document.scrollingElement ?? document.documentElement;
    if (d.scrollHeight <= innerHeight + 40) return;
    const pct = ((d.scrollTop + innerHeight) / d.scrollHeight) * 100;
    while (marks.length && pct >= marks[0] - 1) emit("scroll", { pct: marks.shift() });
  };
  on("scroll", () => { lastInput = Date.now(); st ??= setTimeout(checkScroll, 250); }, { passive: true });
  off.push(() => clearTimeout(st));

  // Reading: how long each section, project and role stays in the middle band of the viewport (on leaving it, or
  // when the tab hides), so the dashboard shows what was read, not just what scrolled past.
  const inView = new Map<string, number>();
  const readOut = (id: string, now = Date.now()) => {
    const t0 = inView.get(id);
    inView.delete(id);
    if (t0 !== undefined && now - t0 >= READ_MIN_MS) emit("read", { id, ms: now - t0 });
  };
  const dwell = new IntersectionObserver((entries) => {
    for (const en of entries) {
      const id = en.target.id;
      if (en.isIntersecting) { if (!inView.has(id)) inView.set(id, Date.now()); } else readOut(id);
    }
  }, { rootMargin: "-35% 0px -35% 0px", threshold: 0 });
  const dwellWatched = new WeakSet<Element>();
  const scanDwell = () => {
    const els = [...SECTIONS.map((s) => document.getElementById(s)), ...document.querySelectorAll('[id^="project-"],[id^="experience-"]')];
    for (const el of els) if (el && !dwellWatched.has(el)) { dwellWatched.add(el); dwell.observe(el); }
  };
  scanDwell();
  const dwellScans = [1500, 4000, 10_000].map((ms) => setTimeout(scanDwell, ms));
  const hidden = () => {
    if (document.visibilityState !== "hidden") { for (const id of inView.keys()) inView.set(id, Date.now()); return; } // back: restart the clocks
    const now = Date.now();
    for (const id of [...inView.keys()]) { readOut(id, now); inView.set(id, now); }
  };
  document.addEventListener("visibilitychange", hidden);
  off.push(() => { dwell.disconnect(); dwellScans.forEach(clearTimeout); document.removeEventListener("visibilitychange", hidden); });

  // Hovering: what the pointer rested on, and for how long (mouse only).
  let hov: { el: Element; label: string; t0: number } | null = null;
  const labelOf = (el: Element) => {
    const h = el as HTMLElement;
    return clip(h.dataset.case ? `project:${h.dataset.case}` : el.id || h.getAttribute("aria-label") || h.dataset.tip || h.textContent, 60);
  };
  const endHover = () => {
    if (hov && Date.now() - hov.t0 >= HOVER_MIN_MS && hov.label) emit("hover", { target: hov.label, ms: Date.now() - hov.t0 });
    hov = null;
  };
  const onOver = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const el = (e.target as Element | null)?.closest?.(HOVERABLE);
    if (el === hov?.el) return;
    endHover();
    if (el) hov = { el, label: labelOf(el), t0: Date.now() };
  };
  document.addEventListener("pointerover", onOver, { passive: true });
  off.push(() => document.removeEventListener("pointerover", onOver));

  // Copying: what text they took away (an email address, a project name).
  const onCopy = () => { const t = clip(document.getSelection()?.toString(), 160); if (t) emit("copy", { text: t }); };
  document.addEventListener("copy", onCopy);
  off.push(() => document.removeEventListener("copy", onCopy));

  // Active time: a 1 s tick counts while the tab is visible and the visitor did something in the last 15 s.
  let active = 0;
  for (const t of ["pointerdown", "pointermove", "keydown", "touchstart", "wheel"] as const) on(t, () => { lastInput = Date.now(); }, { passive: true });
  const tick = setInterval(() => { if (document.visibilityState === "visible" && Date.now() - lastInput < ACTIVE_WINDOW_MS) active += 1000; }, 1000);
  off.push(() => clearInterval(tick));
  eng.beforeFlush(() => { if (active > 0) { emit("active", { ms: active }); active = 0; } });

  // JS errors (capped; the ResizeObserver warning and opaque cross-origin errors say nothing).
  let errors = 0;
  const err = (msg: string, extra?: Record<string, unknown>) => {
    if (errors >= 5 || /ResizeObserver loop|^Script error\.?$/.test(msg)) return;
    errors++;
    emit("error", { msg: clip(msg, 200), ...extra });
  };
  on("error", (e) => err(e.message || "error", { src: clip(e.filename?.replace(location.origin, ""), 120), line: e.lineno, col: e.colno }));
  on("unhandledrejection", (e) => err(`rejection: ${(e.reason as Error | undefined)?.message ?? String(e.reason)}`));

  // Web vitals, reported once when the page is first hidden.
  let lcp = 0, inp = 0, cls = 0;
  const po = (type: string, cb: (e: PerformanceEntry & Record<string, number | boolean>) => void, extra?: object) => {
    try {
      const p = new PerformanceObserver((l) => l.getEntries().forEach((e) => cb(e as never)));
      p.observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
      off.push(() => p.disconnect());
    } catch { /* entry type unsupported in this browser */ }
  };
  po("largest-contentful-paint", (e) => { lcp = e.startTime; });
  po("event", (e) => { if (e.interactionId) inp = Math.max(inp, e.duration); }, { durationThreshold: 40 });
  po("layout-shift", (e) => { if (!e.hadRecentInput) cls += e.value as number; });
  let perfSent = false;
  const sendPerf = () => {
    if (perfSent || !lcp) return;
    perfSent = true;
    emit("perf", { lcp: Math.round(lcp), inp: Math.round(inp), cls: Math.round(cls * 1000) / 1000 });
  };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") sendPerf(); });

  return () => off.forEach((f) => f());
}
