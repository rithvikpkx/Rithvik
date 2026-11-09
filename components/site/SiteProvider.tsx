"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Content } from "@/lib/content/types";
import Overlays from "./overlays/Overlays";

/** Which layer is open over the page. One at a time keeps the page calm. */
export type Overlay =
  | { kind: "case"; slug: string }
  | { kind: "composer"; subject: string }
  | { kind: "resume" }
  | { kind: "agent"; question?: string }
  | { kind: "play"; id?: string }
  | null;

export type Toast = { id: number; message: string; undo?: () => void };

type SiteCtx = {
  content: Content;
  overlay: Overlay;
  openCase: (slug: string) => void;
  openComposer: (subject?: string) => void;
  openResume: () => void;
  openAgent: (question?: string) => void;
  openPlay: (id?: string) => void;
  close: () => void;
  toasts: Toast[];
  toast: (message: string, undo?: () => void) => void;
  dismissToast: (id: number) => void;
  lite: boolean; // performance mode (`html.lite`)
  setLite: (on: boolean) => void;
};

const Ctx = createContext<SiteCtx | null>(null);

/** Shared state for the v7 site: content, the open overlay, toasts, performance mode. */
export function useSite(): SiteCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSite outside SiteProvider");
  return c;
}

let toastSeq = 0;
export const LITE_KEY = "rithvik-lite";

/** Notifies useSyncExternalStore when <html>'s class list changes. */
function subscribeLite(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
}

/** Provides useSite() and wires the mockup's declarative hooks (data-case, data-compose,
 *  data-resume, data-agent, data-play, data-copy) so designs stay plain markup. */
export default function SiteProvider({ content, children }: { content: Content; children: React.ReactNode }) {
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  // `html.lite` is the single source of truth (set pre-paint by the design engine), so
  // state can't drift from the class and SSR (false) hydrates without a mismatch.
  const lite = useSyncExternalStore(subscribeLite, () => document.documentElement.classList.contains("lite"), () => false);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((message: string, undo?: () => void) => {
    const id = ++toastSeq;
    setToasts((t) => [...t.slice(-2), { id, message, undo }]);
    setTimeout(() => dismissToast(id), 4000);
  }, [dismissToast]);

  const setLite = useCallback((on: boolean) => {
    document.documentElement.classList.toggle("lite", on);
    try { localStorage.setItem(LITE_KEY, on ? "1" : "0"); } catch {}
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(
        "[data-case],[data-compose],[data-resume],[data-agent],[data-play],[data-copy]",
      );
      if (!el) return;
      const d = el.dataset;
      e.preventDefault();
      if (d.case !== undefined) setOverlay({ kind: "case", slug: d.case });
      else if (d.compose !== undefined) setOverlay({ kind: "composer", subject: d.compose });
      else if (d.resume !== undefined) setOverlay({ kind: "resume" });
      else if (d.agent !== undefined) setOverlay({ kind: "agent", question: d.agent || undefined });
      else if (d.play !== undefined) setOverlay({ kind: "play", id: d.play || undefined });
      else if (d.copy !== undefined) navigator.clipboard?.writeText(d.copy).then(() => toast("Copied"), () => {});
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [toast]);

  const value = useMemo<SiteCtx>(() => ({
    content, overlay, toasts, toast, dismissToast, lite, setLite,
    openCase: (slug) => setOverlay({ kind: "case", slug }),
    openComposer: (subject = "") => setOverlay({ kind: "composer", subject }),
    openResume: () => setOverlay({ kind: "resume" }),
    openAgent: (question) => setOverlay({ kind: "agent", question }),
    openPlay: (id) => setOverlay({ kind: "play", id }),
    close: () => setOverlay(null),
  }), [content, overlay, toasts, toast, dismissToast, lite, setLite]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <Overlays />
    </Ctx.Provider>
  );
}
