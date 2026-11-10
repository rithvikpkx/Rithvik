"use client";
import { useState } from "react";
import SiteProvider, { useSite } from "@/components/site/SiteProvider";
import Mark, { type MarkKind } from "@/components/site/mark/Mark";
import Portrait from "@/components/site/tether/Tether";
import KnowledgeGraph from "@/components/site/graph/KnowledgeGraph";
import { fixture } from "@/lib/content/fixture";

const KINDS: MarkKind[] = ["solid", "inverse", "accent", "hatch", "giant", "plate", "card", "spinner", "tiny"];
// Nimbus-like light tokens so the harness can be compared with the mockup (?theme=nimbus); dark flips them.
const LIGHT = { "--ui-bg": "#fff", "--ui-fg": "#0E1B2B", "--ui-muted": "#45556B", "--ui-accent": "#0B6FC9", "--ui-accent-fg": "#fff", "--ui-line": "rgba(14,27,43,.12)", "--ui-field": "#EEF7FF", "--pt-photo-bg": "#C4E6FF", "--pt-ring": "#fff", "--pt-ring-w": "8px", "--pt-node-r": "14px", "--pt-beam": "rgba(10,155,255,.32)", "--pt-pulse-a": "#0A9BFF", "--pt-pulse-b": "#FFC93C", "--kg-h": "680px", "--kg-field": "#0A9BFF", "--kg-project": "#FFC93C", "--kg-role": "#0773D1", "--kg-school": "#6CC4FF", "--kg-place": "#8E9CE2", "--kg-me": "#0E1B2B", "--kg-skill": "#9FD0FA" };
const DARK = { "--ui-bg": "#0f0f12", "--ui-fg": "#f4f4f5", "--ui-muted": "#a1a1aa", "--ui-accent": "#ff4d8d", "--ui-accent-fg": "#0f0f12", "--ui-line": "rgba(255,255,255,.14)", "--ui-field": "rgba(255,255,255,.06)", "--pt-photo-bg": "#222", "--pt-node-bg": "#1b1b20", "--pt-node-fg": "#f4f4f5", "--pt-node-line": "rgba(255,255,255,.14)" };

/** Everything the visuals stream ships, on one page: marks, portrait at two widths, graph, toasts. */
function Visuals({ dark, setDark }: { dark: boolean; setDark: (d: boolean) => void }) {
  const { toast, lite, setLite } = useSite();
  const [n, setN] = useState(0);
  return (
    <main style={{ background: "var(--ui-bg)", color: "var(--ui-fg)", minHeight: "100vh", padding: "24px 16px 80px", fontFamily: "system-ui, sans-serif", ...(dark ? DARK : LIGHT) } as React.CSSProperties}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 56 }}>
        <header style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: 20, marginRight: "auto" }}>/lab/visuals</h1>
          <button onClick={() => setDark(!dark)}>{dark ? "Light" : "Dark"}</button>
          <button onClick={() => setLite(!lite)} aria-pressed={lite}>Performance mode: {lite ? "on" : "off"}</button>
          <button onClick={() => { const k = n + 1; setN(k); toast(`Toast number ${k}`, () => toast("Undone")); }}>Fire toast with Undo</button>
        </header>

        <section aria-labelledby="h-mark">
          <h2 id="h-mark">Mark</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "end" }}>
            {KINDS.map((k) => (
              <figure key={k} style={{ margin: 0, textAlign: "center", fontSize: 12, width: 96 }}>
                <div style={{ width: k === "tiny" ? 16 : 80, margin: "0 auto 8px", ...(k === "inverse" ? { background: "#111", padding: 8, boxSizing: "content-box", color: "#fff" } : {}) }}>
                  <Mark kind={k} blink={k === "solid"} draw={k === "accent"} />
                </div>
                {k}
              </figure>
            ))}
            <figure style={{ margin: 0, fontSize: 12 }}>
              <div style={{ width: 200 }}><Mark kind="giant" blink /></div>giant (blinks)
            </figure>
          </div>
        </section>

        <section aria-labelledby="h-pt">
          <h2 id="h-pt">Portrait</h2>
          <div style={{ display: "flex", gap: 48, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ width: 360, maxWidth: "100%" }} data-w="360"><Portrait id="lab360" /></div>
            <div style={{ width: 520, maxWidth: "100%" }} data-w="520"><Portrait id="lab520" /></div>
          </div>
        </section>

        <section aria-labelledby="h-kg">
          <h2 id="h-kg">Knowledge graph</h2>
          <KnowledgeGraph id="lab" />
        </section>
      </div>
    </main>
  );
}

/** Lab harness page for feat/core-visuals. */
export default function Page() {
  const [dark, setDark] = useState(false);
  return (
    <SiteProvider content={fixture}>
      <Visuals dark={dark} setDark={setDark} />
    </SiteProvider>
  );
}
