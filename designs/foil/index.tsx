"use client";
import type { DesignProps } from "@/lib/designs/types";

/** Placeholder for Foil; Step 2 ports the real site from docs/mockups/v7/themes/foil.js. */
export default function Foil({ content }: DesignProps) {
  return (
    <main className="stage" id="top" style={{ padding: "15vh 24px" }}>
      <h1>{content.name}</h1>
      <p>Foil (placeholder)</p>
    </main>
  );
}
