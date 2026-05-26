"use client";
import dynamic from "next/dynamic";

// Both widgets are non-critical overlays: RagBot is a launcher pinned bottom-
// right (below the fold), and SecondaryContextPanel only renders in edit mode.
// Splitting them out of the initial bundle shrinks First Load JS for every
// visitor. ssr:false is valid here because this file is a Client Component.
const RagBot = dynamic(() => import("./RagBot"), { ssr: false });
const SecondaryContextPanel = dynamic(() => import("./SecondaryContextPanel"), { ssr: false });

/** Mounts the deferred, non-critical overlay widgets. Rendered at the end of
 *  the page so neither blocks the main content's hydration. */
export default function DeferredOverlays() {
  return (
    <>
      <SecondaryContextPanel />
      <RagBot />
    </>
  );
}
