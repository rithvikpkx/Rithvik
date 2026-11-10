"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import { flushSync } from "react-dom";
import type { DesignMeta, DesignProps } from "@/lib/designs/types";
import type { Theme } from "@/lib/types";
import { DEFAULT_THEME_SLUG, THEME_STORAGE_KEY } from "@/lib/themes";
import { DESIGNS, DESIGN_KEY, designById, fontsHref, htmlAttrsFor, isDarkColor, loadClassic } from "@/lib/designs/registry";
import { useSite } from "./SiteProvider";

/** A dial entry: one of the nine designs, or a legacy palette rendered by Classic. */
export type DialEntry =
  | { kind: "design"; id: string; meta: DesignMeta }
  | { kind: "palette"; id: string; name: string; dark: boolean; swatch: [bg: string, text: string, accent: string] };

type DesignCtx = {
  entries: DialEntry[];
  current: string; // design id, or palette slug (→ Classic)
  setDesign: (id: string, from?: [x: number, y: number]) => void; // `from` = reveal origin
  cycle: (dir?: 1 | -1) => void; // `T`
};

export const DesignContext = createContext<DesignCtx | null>(null);

/** Current design/palette and the switch API. */
export function useDesign(): DesignCtx {
  const c = useContext(DesignContext);
  if (!c) throw new Error("useDesign outside DesignContext provider");
  return c;
}

// Resolved design modules, keyed by layout id ("classic" for every palette). ActiveDesign renders
// from here synchronously, so a switch never suspends mid view-transition.
const loaded = new Map<string, ComponentType<DesignProps>>();

/** The already-loaded component for a layout id, if any. */
export function loadedDesign(layoutId: string): ComponentType<DesignProps> | undefined {
  return loaded.get(layoutId);
}

/** Loads (once) the layout module for a look. */
async function ensureLoaded(look: string) {
  const layoutId = htmlAttrsFor(look).design;
  if (loaded.has(layoutId)) return;
  const mod = await (designById(look)?.load() ?? loadClassic());
  loaded.set(layoutId, mod.default);
}

/** Adds the design's Google Fonts stylesheet once. */
function ensureFonts(meta: DesignMeta | undefined) {
  const href = fontsHref(meta);
  if (!href || document.head.querySelector(`link[data-font="${meta!.id}"]`)) return;
  const l = Object.assign(document.createElement("link"), { rel: "stylesheet", href });
  l.dataset.font = meta!.id;
  document.head.appendChild(l);
}

/** Saves the look for the next SSR (cookie) and the client (localStorage); palettes also keep the
 *  old site's key so both sites agree. */
function persist(look: string) {
  document.cookie = `${DESIGN_KEY}=${look}; path=/; max-age=31536000; samesite=lax`;
  try {
    localStorage.setItem(DESIGN_KEY, look);
    if (!designById(look)) localStorage.setItem(THEME_STORAGE_KEY, look);
  } catch {}
}

type Opts = { from?: [number, number]; silent?: boolean; instant?: boolean };
type Live = { current: string; entries: DialEntry[]; setCurrent: (id: string) => void; toast: (m: string, undo?: () => void) => void };

// The newest switch wins: an older one still loading bails, and only the newest clears the sweep class.
let switchSeq = 0;
let running: ViewTransition | null = null;
let wanted: string | null = null; // the look a still-loading switch is heading to, so `T` steps from it

/** Switches to a look: load its module + fonts, then swap inside a view transition (circular reveal
 *  from the switcher knob, a crossfade under reduced motion, instant without the API). Never locks:
 *  a newer switch skips the running sweep and starts its own. Reads `live` fresh so the toast's Undo
 *  still sees the real current look later. */
async function switchLook(live: { current: Live }, id: string, opts: Opts = {}) {
  const seq = ++switchSeq; // bumped first so going back to the current look also cancels a pending load
  const prev = live.current.current;
  const entry = live.current.entries.find((e) => e.id === id);
  wanted = null;
  if (!entry || id === prev) return;
  wanted = id;
  const meta = designById(id);
  ensureFonts(meta);
  // Load before swapping so the reveal uncovers the new site, not an empty frame.
  try { await ensureLoaded(id); } catch (e) { console.error(e); if (seq === switchSeq) wanted = null; return; }
  if (seq !== switchSeq) return; // superseded while loading

  const html = document.documentElement;
  const go = () => {
    flushSync(() => live.current.setCurrent(id));
    live.current.current = id;
    if (seq === switchSeq) wanted = null; // only now: the view transition calls this a frame or two later
    const { design, theme } = htmlAttrsFor(id);
    html.dataset.design = design;
    html.dataset.theme = theme;
    html.style.colorScheme = (entry.kind === "design" ? entry.meta.dark : entry.dark) ? "dark" : "light";
    persist(id);
  };
  running?.skipTransition(); // the old sweep jumps to its end; the new one starts from that frame
  if (opts.instant || !document.startViewTransition) go();
  else {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cls = reduce ? "vt-fade" : "vt-reveal";
    // The sweep always starts at the switcher's knob, whatever triggered it.
    const knob = document.querySelector<HTMLElement>(".theme-dial-aside .sw-knob");
    const r = knob?.getBoundingClientRect();
    const [x, y] = r && r.width ? [r.left + r.width / 2, r.top + r.height / 2] : opts.from ?? [innerWidth / 2, innerHeight / 2];
    html.style.setProperty("--vt-x", `${x}px`);
    html.style.setProperty("--vt-y", `${y}px`);
    html.style.setProperty("--vt-r", `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
    html.classList.remove("vt-reveal", "vt-fade");
    html.classList.add(cls);
    const t = document.startViewTransition(go);
    running = t;
    t.ready.catch(() => {}); // skipped by a newer switch: expected, not an error
    // A skipped sweep must not strip the class the newer one is animating with.
    t.finished.finally(() => { if (running === t) { running = null; html.classList.remove(cls); } });
  }
  const name = meta?.name ?? (entry.kind === "palette" ? entry.name : id);
  if (!opts.silent) live.current.toast(`Now viewing ${name}`, () => void switchLook(live, prev, { silent: true }));
}

/** Owns the active design or palette: switching, persistence, the `T` key, `?theme=` deep links
 *  and `data-theme-go` clicks. `initial` is the look the server rendered. */
export default function DesignProvider({ initial, palettes, children }: { initial: string; palettes: Theme[]; children: React.ReactNode }) {
  const { toast } = useSite();
  const [current, setCurrent] = useState(initial);

  const entries = useMemo<DialEntry[]>(() => [
    ...DESIGNS.map((meta): DialEntry => ({ kind: "design", id: meta.id, meta })),
    ...[...palettes].sort((a, b) => a.sort_order - b.sort_order).map((t): DialEntry => ({
      kind: "palette", id: t.slug, name: t.name, dark: isDarkColor(t.tokens.bg), swatch: [t.tokens.bg, t.tokens.text, t.tokens.accent],
    })),
  ], [palettes]);

  // Latest values for the once-bound listeners and the async switch.
  const live = useRef<Live>({ current, entries, setCurrent, toast });
  useEffect(() => { live.current = { current, entries, setCurrent, toast }; }, [current, entries, toast]);

  const apply = useCallback((id: string, opts?: Opts) => switchLook(live, id, opts), []);

  const setDesign = useCallback((id: string, from?: [number, number]) => { void apply(id, { from }); }, [apply]);
  // `T` steps through the nine designs plus Classic (one stop, in the last palette used), not all 25 entries.
  const lastPalette = useRef(DEFAULT_THEME_SLUG);
  useEffect(() => { if (!designById(current)) lastPalette.current = current; }, [current]);
  const cycle = useCallback((dir: 1 | -1 = 1) => {
    const stops = [lastPalette.current, ...DESIGNS.map((d) => d.id)];
    const cur = wanted ?? live.current.current;
    const i = Math.max(0, stops.indexOf(designById(cur) ? cur : lastPalette.current));
    void apply(stops[(i + dir + stops.length) % stops.length]);
  }, [apply]);

  useEffect(() => {
    // Mount: the boot script may have corrected <html> (legacy palette, lost cookie, deep link);
    // adopt that look, then drop `?theme=` so a reload or shared URL isn't pinned to it.
    const html = document.documentElement;
    const url = new URL(location.href);
    const deep = url.searchParams.has("theme");
    if (deep) { url.searchParams.delete("theme"); history.replaceState(history.state, "", url); }
    const fromDom = html.dataset.theme;
    if (fromDom && fromDom !== live.current.current && live.current.entries.some((e) => e.id === fromDom)) void apply(fromDom, { instant: true, silent: true });
    else if (deep) persist(live.current.current);
    if (designById(live.current.current)) ensureFonts(designById(live.current.current));

    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>("[data-theme-go]");
      if (!el) return;
      e.preventDefault();
      void apply(el.dataset.themeGo!, { from: [e.clientX, e.clientY] });
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== "t" && e.key !== "T") || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.isContentEditable || t?.closest("input, textarea, select")) return;
      e.preventDefault();
      cycle(e.shiftKey ? -1 : 1);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey); };
  }, [apply, cycle]);

  const value = useMemo<DesignCtx>(() => ({ entries, current, setDesign, cycle }), [entries, current, setDesign, cycle]);
  return <DesignContext.Provider value={value}>{children}</DesignContext.Provider>;
}
