"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { DEFAULT_THEME_SLUG, THEME_STORAGE_KEY } from "@/lib/themes";
import type { Theme } from "@/lib/types";
import ThemeWash from "./ThemeWash";

interface ThemeCtx {
  themes: Theme[];
  currentSlug: string;
  setTheme: (slug: string) => void;
}

const ThemeContext = createContext<ThemeCtx | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

interface Props {
  themes: Theme[];
  children: React.ReactNode;
}

// Must stay in sync with the @keyframes theme-wash timeline in globals.css.
const WASH_DURATION_MS = 720;
// Fires at ~50% of the wash timeline — the moment the wave's mask radius
// fully covers the viewport. Doing the data-theme swap behind a fully opaque
// overlay is what lets the user perceive "old ahead / new behind" without
// the page actually being rendered in two themes simultaneously.
const THEME_APPLY_DELAY_MS = 360;
const WASH_CLEANUP_BUFFER_MS = 80;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Theme transitions are two parallel animations, both in the live DOM:
 *
 *   1. The dial pills rotate via their CSS transform-transition (420ms)
 *      because `currentSlug` updates synchronously on click — the dial
 *      reads currentSlug and recomputes each pill's transform.
 *   2. A <ThemeWash> overlay sweeps a radial-mask glass wave from the dial
 *      across the viewport (~720ms). Ahead of the wave you see the OLD
 *      theme directly; behind the wave you see a translucent tint of the
 *      NEW theme + backdrop-filtered (warped + blurred) view of the page.
 *
 * `data-theme` on <html> is NOT flipped on click. We hold it on the OLD
 * theme until ~360ms in — the point at which the wave's mask fully covers
 * the viewport and the overlay is at opacity 1 everywhere. We swap behind
 * that fully-opaque cover, then the overlay fades out and the now-NEW page
 * underneath matches what the overlay was already showing.
 *
 * Rapid clicks: every timer is cancelable so re-entering setTheme tears the
 * previous in-flight transition down before starting the new one.
 */
export default function ThemeProvider({ themes, children }: Props) {
  const [currentSlug, setCurrentSlug] = useState<string>(DEFAULT_THEME_SLUG);
  const [wash, setWash] = useState<{ theme: Theme; key: number } | null>(null);
  const washKeyRef = useRef(0);
  const applyTimerRef = useRef<number | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const fromDom = document.documentElement.dataset.theme;
    if (fromDom && themes.some((t) => t.slug === fromDom)) setCurrentSlug(fromDom);
  }, [themes]);

  useEffect(() => () => {
    if (applyTimerRef.current !== null) window.clearTimeout(applyTimerRef.current);
    if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current);
  }, []);

  const setTheme = (slug: string) => {
    if (slug === currentSlug) return;
    const next = themes.find((t) => t.slug === slug);
    if (!next) return;

    // Persist immediately so a reload (or a parallel tab) reflects the choice
    // even if the wash animation gets interrupted mid-flight.
    try { localStorage.setItem(THEME_STORAGE_KEY, slug); } catch {}

    if (prefersReducedMotion()) {
      // No wash, no delay — straight swap. Reduced-motion users get the
      // instant theme change without any sweep animation.
      setCurrentSlug(slug);
      document.documentElement.dataset.theme = slug;
      return;
    }

    if (applyTimerRef.current !== null) window.clearTimeout(applyTimerRef.current);
    if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current);

    // Restart the wash animation by bumping the key (forces remount). The
    // dial selection updates in the same render so its CSS transition fires
    // simultaneously with the wave.
    washKeyRef.current += 1;
    setWash({ theme: next, key: washKeyRef.current });
    setCurrentSlug(slug);

    applyTimerRef.current = window.setTimeout(() => {
      document.documentElement.dataset.theme = slug;
      applyTimerRef.current = null;
    }, THEME_APPLY_DELAY_MS);

    clearTimerRef.current = window.setTimeout(() => {
      setWash(null);
      clearTimerRef.current = null;
    }, WASH_DURATION_MS + WASH_CLEANUP_BUFFER_MS);
  };

  return (
    <ThemeContext.Provider value={{ themes, currentSlug, setTheme }}>
      {children}
      {wash && <ThemeWash key={wash.key} theme={wash.theme} />}
    </ThemeContext.Provider>
  );
}
