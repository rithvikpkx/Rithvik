"use client";
import { useMemo } from "react";
import SiteProvider from "@/components/site/SiteProvider";
import DesignProvider from "@/components/site/DesignProvider";
import Switcher from "@/components/site/switcher/Switcher";
import { fixture } from "@/lib/content/fixture";
import type { Theme } from "@/lib/types";
import "./lab.css";

/** `n` fake palettes with spread-out hues, so the picker can be tried with more looks than the site has yet. */
function fakePalettes(n: number): Theme[] {
  return Array.from({ length: n }, (_, i) => {
    const h = Math.round((i * 137.5) % 360), dark = i % 2 === 0;
    const bg = `hsl(${h} ${dark ? 22 : 30}% ${dark ? 12 : 94}%)`, text = `hsl(${h} 20% ${dark ? 90 : 14}%)`, accent = `hsl(${(h + 150) % 360} 75% ${dark ? 62 : 42}%)`;
    return { id: `lab-${i}`, slug: `lab-${i}`, name: `Palette ${i + 1}`, sort_order: i, published: true, created_at: "", updated_at: "", tokens: { bg, "bg-soft": bg, text, muted: text, accent, "accent-glow": accent, green: "#3fb950" } };
  });
}

/** Harness for the look picker: the real component, with `?extra=N` fake palettes added so the overflow scrolling can be seen. */
export default function Lab({ extra }: { extra: number }) {
  const palettes = useMemo(() => fakePalettes(extra), [extra]);
  return (
    <SiteProvider content={fixture}>
      <DesignProvider initial="lab-0" palettes={palettes}>
        <main className="lab-page">
          <h1>Look picker</h1>
          <p>The picker is the glass puck at the bottom-left: hover or tap it. {extra} fake palettes plus the real designs; add <code>?extra=30</code> to the URL for more.</p>
        </main>
        <Switcher />
      </DesignProvider>
    </SiteProvider>
  );
}
