"use client";
import dynamic from "next/dynamic";

// Both widgets are non-critical overlays: RagBot is a launcher pinned bottom-
// right (below the fold), and SecondaryContextPanel only renders in edit mode.
// ContactComposer renders nothing until its launch button is clicked. Splitting
// them out of the initial bundle shrinks First Load JS for every visitor.
// ssr:false is valid here because this file is a Client Component.
const RagBot = dynamic(() => import("./RagBot"), { ssr: false });
const SecondaryContextPanel = dynamic(() => import("./SecondaryContextPanel"), { ssr: false });
const ContactComposer = dynamic(() => import("./ContactComposer"), { ssr: false });

// Derive the public "To" address shown in the composer from the editable
// contact.link.email value (mailto: stripped), falling back to the default.
const DEFAULT_EMAIL = "rithvikpkx@gmail.com";

/** Mounts the deferred, non-critical overlay widgets. Rendered at the end of
 *  the page so neither blocks the main content's hydration. */
export default function DeferredOverlays({ emailUrl }: { emailUrl?: string }) {
  const toAddress = (emailUrl ?? "").replace(/^mailto:/i, "").trim() || DEFAULT_EMAIL;
  return (
    <>
      <SecondaryContextPanel />
      <RagBot />
      <ContactComposer toAddress={toAddress} />
    </>
  );
}
