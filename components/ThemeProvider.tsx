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
 * Owns the active theme slug. Source of truth at runtime:
 *   document.documentElement.dataset.theme
 * Plus localStorage for persistence across visits. The FOUC boot script in
 * app/layout.tsx writes the attribute before paint; this provider syncs
 * React state to it on mount and writes both DOM + localStorage on setTheme.
 */
export default function ThemeProvider({ themes, children }: Props) {
  // Server has no document; the boot script will fix this on the client.
  const [currentSlug, setCurrentSlug] = useState<string>(DEFAULT_THEME_SLUG);

  useEffect(() => {
    const fromDom = document.documentElement.dataset.theme;
    if (fromDom && themes.some((t) => t.slug === fromDom)) {
      setCurrentSlug(fromDom);
    }
  }, [themes]);

  const setTheme = (slug: string) => {
    if (!themes.some((t) => t.slug === slug)) return;
    document.documentElement.dataset.theme = slug;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, slug);
    } catch (_) {
      // localStorage may be unavailable (privacy mode); the DOM attribute still applies for this session
    }
    setCurrentSlug(slug);
  };

  return (
    <ThemeContext.Provider value={{ themes, currentSlug, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
