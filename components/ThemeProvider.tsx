"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { flushSync } from "react-dom";
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

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// `document.startViewTransition` is in baseline-modern browsers (Chrome 111+,
// Safari 18+, Firefox 129+) but TypeScript's lib.dom may still lag in this
// project's TS version, so we type it here.
type ViewTransitionDoc = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => unknown;
};

/**
 * Owns the active theme slug. Theme changes go through the View Transitions
 * API so the browser snapshots OLD and NEW pages and animates between them
 * with a radial mask sweeping from the dial — see globals.css for the
 * ::view-transition-new(root) keyframes. flushSync forces React to commit
 * the state change synchronously so the new snapshot includes the updated
 * dial selection.
 */
export default function ThemeProvider({ themes, children }: Props) {
  const [currentSlug, setCurrentSlug] = useState<string>(DEFAULT_THEME_SLUG);

  useEffect(() => {
    const fromDom = document.documentElement.dataset.theme;
    if (fromDom && themes.some((t) => t.slug === fromDom)) setCurrentSlug(fromDom);
  }, [themes]);

  const applyTheme = (slug: string) => {
    document.documentElement.dataset.theme = slug;
    try { localStorage.setItem(THEME_STORAGE_KEY, slug); } catch {}
  };

  const setTheme = (slug: string) => {
    if (!themes.some((t) => t.slug === slug) || slug === currentSlug) return;

    const doc = document as ViewTransitionDoc;
    const canTransition = typeof doc.startViewTransition === "function" && !prefersReducedMotion();

    const commit = () => {
      // flushSync so the dial state lands in the NEW snapshot the browser
      // is about to take (otherwise React would commit on the next tick,
      // after the snapshot, and the OLD selection would briefly persist).
      flushSync(() => setCurrentSlug(slug));
      applyTheme(slug);
    };

    if (!canTransition) {
      commit();
      return;
    }

    doc.startViewTransition!(commit);
  };

  return (
    <ThemeContext.Provider value={{ themes, currentSlug, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
