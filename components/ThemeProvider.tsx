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

const WASH_DURATION_MS = 500;
const WASH_CLEANUP_BUFFER_MS = 120;

/**
 * Owns the active theme slug. Theme changes swap CSS vars synchronously and
 * mount a liquid-glass wash overlay (ThemeWash) that sweeps across the
 * viewport from the dial position. The dial itself remains in the live DOM
 * during the wash — its CSS transform-transitions handle the physical
 * rotation independently, and a higher z-index keeps it above the wash.
 */
export default function ThemeProvider({ themes, children }: Props) {
  const [currentSlug, setCurrentSlug] = useState<string>(DEFAULT_THEME_SLUG);
  // Single wash element with a bumped key on each setTheme call so React
  // remounts it and the CSS animation restarts cleanly on rapid clicks.
  const [wash, setWash] = useState<{ theme: Theme; key: number } | null>(null);
  const washKeyRef = useRef(0);
  const washTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const fromDom = document.documentElement.dataset.theme;
    if (fromDom && themes.some((t) => t.slug === fromDom)) setCurrentSlug(fromDom);
  }, [themes]);

  // Clear any pending wash teardown if the provider unmounts mid-animation.
  useEffect(() => {
    return () => {
      if (washTimerRef.current !== null) window.clearTimeout(washTimerRef.current);
    };
  }, []);

  const applyTheme = (slug: string) => {
    document.documentElement.dataset.theme = slug;
    try { localStorage.setItem(THEME_STORAGE_KEY, slug); } catch {}
  };

  const setTheme = (slug: string) => {
    if (slug === currentSlug) return;
    const next = themes.find((t) => t.slug === slug);
    if (!next) return;

    // Restart the wash animation: bumping the key forces React to remount
    // <ThemeWash>, so its 500ms keyframes replay from 0% even on rapid clicks.
    washKeyRef.current += 1;
    setWash({ theme: next, key: washKeyRef.current });

    // Swap the theme synchronously. The wash overlay covers the dial-origin
    // region while the rest of the page repaints under the wave front.
    setCurrentSlug(slug);
    applyTheme(slug);

    // Tear down the wash element shortly after its animation finishes.
    if (washTimerRef.current !== null) window.clearTimeout(washTimerRef.current);
    washTimerRef.current = window.setTimeout(() => {
      setWash(null);
      washTimerRef.current = null;
    }, WASH_DURATION_MS + WASH_CLEANUP_BUFFER_MS);
  };

  return (
    <ThemeContext.Provider value={{ themes, currentSlug, setTheme }}>
      {children}
      {wash && <ThemeWash key={wash.key} theme={wash.theme} />}
    </ThemeContext.Provider>
  );
}
