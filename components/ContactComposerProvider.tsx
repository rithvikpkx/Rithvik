"use client";
import { createContext, useContext, useState, type ReactNode } from "react";

interface ContactComposerCtx {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const Ctx = createContext<ContactComposerCtx | null>(null);

/** Shares the composer's open/close state so any email button can launch the
 *  single ContactComposer window mounted at the page root. */
export function ContactComposerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Ctx.Provider value={{ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useContactComposer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useContactComposer must be used within ContactComposerProvider");
  return ctx;
}
