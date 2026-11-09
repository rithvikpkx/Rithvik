"use client";
import type { DesignProps } from "@/lib/designs/types";

/** Placeholder for Prism; Step 2 ports the real site from docs/mockups/v7/themes/prism.js. */
export default function Prism({ content }: DesignProps) {
  return (
    <main className="stage" id="top" style={{ padding: "15vh 24px" }}>
      <h1>{content.name}</h1>
      <p>Prism (placeholder)</p>
    </main>
  );
}
