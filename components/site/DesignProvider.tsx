"use client";
import { createContext, useContext } from "react";
import type { DesignMeta } from "@/lib/designs/types";

/** A dial entry: one of the nine designs, or a legacy palette rendered by Classic. */
export type DialEntry =
  | { kind: "design"; id: string; meta: DesignMeta }
  | { kind: "palette"; id: string; name: string; dark: boolean };

type DesignCtx = {
  entries: DialEntry[];
  current: string; // design id, or palette slug (→ Classic)
  setDesign: (id: string, from?: [x: number, y: number]) => void; // `from` = reveal origin
  cycle: (dir?: 1 | -1) => void; // `T`
};

export const DesignContext = createContext<DesignCtx | null>(null);

/** Current design/palette and the switch API. Provided by the design engine
 *  (feat/design-engine); this file defines the contract other streams code against. */
export function useDesign(): DesignCtx {
  const c = useContext(DesignContext);
  if (!c) throw new Error("useDesign outside DesignContext provider");
  return c;
}
