"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_THEME_SLUG, THEME_STORAGE_KEY } from "@/lib/themes";
import type { Theme } from "@/lib/types";

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

/**
 * Owns the active theme slug. `setTheme` is an instant flip: write
 * localStorage, swap <html data-theme>, update React state. The only
 * theme-change animation in the app is the dial pill rotation, which
 * fires automatically because `currentSlug` drives each pill's transform
 * and `.theme-strip-option` has a CSS transform-transition.
 */
export default function ThemeProvider({ themes, children }: Props) {
  const [currentSlug, setCurrentSlug] = useState<string>(DEFAULT_THEME_SLUG);

  useEffect(() => {
    const fromDom = document.documentElement.dataset.theme;
    if (fromDom && themes.some((t) => t.slug === fromDom)) setCurrentSlug(fromDom);
  }, [themes]);

  const setTheme = (slug: string) => {
    if (slug === currentSlug) return;
    if (!themes.some((t) => t.slug === slug)) return;
    try { localStorage.setItem(THEME_STORAGE_KEY, slug); } catch {}
    document.documentElement.dataset.theme = slug;
    setCurrentSlug(slug);
  };

  return (
    <ThemeContext.Provider value={{ themes, currentSlug, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
