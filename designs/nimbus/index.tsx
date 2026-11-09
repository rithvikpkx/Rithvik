"use client";
import type { DesignProps } from "@/lib/designs/types";

/** Placeholder for Nimbus; Step 2 ports the real site from docs/mockups/v7/themes/nimbus.js. */
export default function Nimbus({ content }: DesignProps) {
  return (
    <main className="stage" id="top" style={{ padding: "15vh 24px" }}>
      <h1>{content.name}</h1>
      <p>Nimbus (placeholder)</p>
    </main>
  );
}
