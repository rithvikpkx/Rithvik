"use client";
import { useEffect, type RefObject } from "react";
import { registerWarp } from "./engine";
import "./warp.css";

/** Makes the referenced card's silhouette bow away from the cursor (see engine.ts). The card needs `position: relative` and its
 *  own `border-radius` (the warp reads it); strength is the `--warp` CSS token (0 turns it off, default 1). */
export function useWarp(ref: RefObject<HTMLElement | null>) {
  useEffect(() => (ref.current ? registerWarp(ref.current) : undefined), [ref]);
}
