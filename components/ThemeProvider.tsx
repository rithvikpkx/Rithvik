"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { DEFAULT_THEME_SLUG, THEME_STORAGE_KEY } from "@/lib/themes";
import type { Theme } from "@/lib/types";
import ThemeWash from "./ThemeWash";

// Total wash duration must match the keyframes in globals.css
const WASH_DURATION_MS = 750;
// Theme is actually applied at ~50% so the user never sees a hard snap
const WASH_SWAP_MS = 375;

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

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Owns the active theme slug and orchestrates the liquid-glass wash on every
 * change. The wash overlay's colors come from the incoming theme; the actual
 * document data-theme is swapped mid-animation so the user sees the wash
 * uncover the new palette rather than a hard snap.
 */
export default function ThemeProvider({ themes, children }: Props) {
  // Mirror whatever the FOUC boot script wrote to <html>, so SSR is stable.
  const [currentSlug, setCurrentSlug] = useState<string>(DEFAULT_THEME_SLUG);
  const [wash, setWash] = useState<{ theme: Theme; id: number } | null>(null);
  const washIdRef = useRef(0);
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fromDom = document.documentElement.dataset.theme;
    if (fromDom && themes.some((t) => t.slug === fromDom)) setCurrentSlug(fromDom);
  }, [themes]);

  // Clean up any pending timers on unmount.
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
    if (!next) return;
    if (slug === currentSlug && !wash) return;

    // Reduced-motion: snap, no wash.
    if (prefersReducedMotion()) {
      applyTheme(slug);
      setCurrentSlug(slug);
      return;
    }

    // Cancel any pending wash so rapid changes restart cleanly.
    if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
    if (endTimerRef.current)  clearTimeout(endTimerRef.current);

    // Update React state immediately so the dial's "selected" state moves now —
    // the document-level data-theme is delayed so the wash covers the swap.
    setCurrentSlug(slug);
    washIdRef.current++;
    setWash({ theme: next, id: washIdRef.current });

    swapTimerRef.current = setTimeout(() => {
      applyTheme(slug);
    }, WASH_SWAP_MS);

    endTimerRef.current = setTimeout(() => {
      setWash(null);
    }, WASH_DURATION_MS + 30);
  };

  return (
    <ThemeContext.Provider value={{ themes, currentSlug, setTheme }}>
      {children}
      {wash && <ThemeWash key={wash.id} theme={wash.theme} />}
    </ThemeContext.Provider>
  );
}
