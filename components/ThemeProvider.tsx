"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { DEFAULT_THEME_SLUG, THEME_STORAGE_KEY } from "@/lib/themes";
import type { Theme } from "@/lib/types";
import ThemeWash from "./ThemeWash";

// Total wash duration must match the @keyframes in globals.css
const WASH_DURATION_MS = 500;
// Theme is applied at ~44% through (peak coverage) so the snap hides under the wave
const WASH_SWAP_MS = 220;

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

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface Props {
  themes: Theme[];
  children: React.ReactNode;
}

/**
 * Owns the active theme slug and orchestrates the liquid-glass wash on every
 * change. Dial-selected state updates immediately for instant feedback; the
 * document-level data-theme attribute is delayed to the wash's peak coverage
 * so the swap hides under the wave. Reduced-motion path snaps immediately
 * and uses a brief opacity fade instead of the wave animation.
 */
export default function ThemeProvider({ themes, children }: Props) {
  const [currentSlug, setCurrentSlug] = useState<string>(DEFAULT_THEME_SLUG);
  const [wash, setWash] = useState<{ theme: Theme; id: number } | null>(null);
  const washIdRef = useRef(0);
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fromDom = document.documentElement.dataset.theme;
    if (fromDom && themes.some((t) => t.slug === fromDom)) setCurrentSlug(fromDom);
  }, [themes]);

  useEffect(() => () => {
    if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
  }, []);

  const applyTheme = (slug: string) => {
    document.documentElement.dataset.theme = slug;
    try { localStorage.setItem(THEME_STORAGE_KEY, slug); } catch {}
  };

  const setTheme = (slug: string) => {
    const next = themes.find((t) => t.slug === slug);
    if (!next || slug === currentSlug) return;

    // Cancel any pending wash from a recent rapid click.
    if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
    if (endTimerRef.current)  clearTimeout(endTimerRef.current);

    // Instant dial feedback — the selected pill highlight moves immediately.
    setCurrentSlug(slug);

    if (prefersReducedMotion()) {
      applyTheme(slug);
      washIdRef.current++;
      setWash({ theme: next, id: washIdRef.current });
      endTimerRef.current = setTimeout(() => setWash(null), 260);
      return;
    }

    washIdRef.current++;
    setWash({ theme: next, id: washIdRef.current });
    swapTimerRef.current = setTimeout(() => applyTheme(slug), WASH_SWAP_MS);
    endTimerRef.current  = setTimeout(() => setWash(null), WASH_DURATION_MS + 30);
  };

  return (
    <ThemeContext.Provider value={{ themes, currentSlug, setTheme }}>
      {children}
      {wash && <ThemeWash key={wash.id} theme={wash.theme} />}
    </ThemeContext.Provider>
  );
}
