"use client";
import { useState } from "react";
import Mark from "@/components/site/mark/Mark";

const B = "/brand/";
const SIZES = [16, 32, 64, 256];
const PANES = [
  { id: "light", bg: "#fafaf9", fg: "#16161a", line: "rgba(0,0,0,.1)" },
  { id: "dark", bg: "#0f0f12", fg: "#f4f4f5", line: "rgba(255,255,255,.12)" },
] as const;
const MARKS = ["mark-light", "mark-dark", "mark-black", "mark-white", "mark-accent", "mark-small", "favicon"];
const ICONS: [string, number][] = [["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512], ["icon-maskable-192.png", 192], ["icon-maskable-512.png", 512]];

/** Review sheet for the brand library (public/brand): every asset on light and dark, at 16/32/64/256px, lockups, icons, OG cards, animations. */
export default function BrandLab() {
  const [run, setRun] = useState(0); // remounts the draw-on marks to replay them
  const cap = { fontSize: 11, opacity: 0.6, marginTop: 6 } as const;
  const row = { display: "flex", flexWrap: "wrap", gap: 24, alignItems: "end" } as const;
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", background: "#888", minHeight: "100vh" }}>
      <header style={{ display: "flex", gap: 12, alignItems: "center", padding: "16px 24px", background: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: 18, marginRight: "auto" }}>/lab/brand</h1>
        <span style={{ fontSize: 12, color: "#666" }}>public/brand · npm run brand</span>
        <button onClick={() => setRun(run + 1)}>Replay draw-on</button>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 560px), 1fr))" }}>
        {PANES.map((p) => (
          <section key={p.id} data-pane={p.id} style={{ background: p.bg, color: p.fg, padding: "24px 24px 48px", display: "grid", gap: 40 }}>
            <h2 style={{ margin: 0, fontSize: 14, letterSpacing: ".08em", textTransform: "uppercase" }}>{p.id}</h2>

            <div>
              <h3 style={{ fontSize: 13 }}>Mark component (currentColor) at 16 / 32 / 64 / 256</h3>
              <div style={row}>
                {SIZES.map((s) => (
                  <figure key={s} style={{ margin: 0 }}>
                    <div style={{ width: s }}><Mark kind={s <= 16 ? "tiny" : "solid"} label="" /></div>
                    <figcaption style={cap}>{s}px{s <= 16 ? " · tiny" : ""}</figcaption>
                  </figure>
                ))}
                <figure style={{ margin: 0 }}><div style={{ width: 64 }}><Mark kind="accent" label="" /></div><figcaption style={cap}>accent</figcaption></figure>
                <figure style={{ margin: 0 }}><div style={{ width: 64 }}><Mark kind="hatch" label="" /></div><figcaption style={cap}>hatch</figcaption></figure>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: 13 }}>Animated (component, then the standalone SVG files)</h3>
              <div style={row}>
                <figure style={{ margin: 0 }}><div style={{ width: 96 }}><Mark key={run} draw label="" /></div><figcaption style={cap}>draw</figcaption></figure>
                <figure style={{ margin: 0 }}><div style={{ width: 96 }}><Mark idle label="" /></div><figcaption style={cap}>idle</figcaption></figure>
                <figure style={{ margin: 0 }}><div style={{ width: 96 }}><Mark kind="spinner" label="" /></div><figcaption style={cap}>loader</figcaption></figure>
                <figure style={{ margin: 0 }}><div style={{ width: 24 }}><Mark kind="spinner" label="" /></div><figcaption style={cap}>24px</figcaption></figure>
                {["mark-draw", "mark-idle", "mark-loader"].map((f) => (
                  <figure key={f} style={{ margin: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- the point is to show the shipped file as-is */}
                    <img key={f === "mark-draw" ? run : f} src={`${B}${f}.svg`} width={96} height={96} alt={f} />
                    <figcaption style={cap}>{f}.svg</figcaption>
                  </figure>
                ))}
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: 13 }}>Files</h3>
              {MARKS.map((f) => (
                <div key={f} style={{ ...row, marginBottom: 16 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {SIZES.map((s) => <img key={s} src={`${B}${f}.svg`} width={s} height={s} alt={`${f} ${s}px`} />)}
                  <span style={cap}>{f}.svg</span>
                </div>
              ))}
              <div style={row}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/favicon.ico" width={32} height={32} alt="favicon.ico" /><span style={cap}>favicon.ico (16/32/48)</span>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: 13 }}>Lockups</h3>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${B}lockup-horizontal-${p.id}.svg`} alt="horizontal lockup" style={{ height: 56, display: "block", maxWidth: "100%" }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${B}lockup-horizontal-${p.id}.svg`} alt="horizontal lockup, small" style={{ height: 24, display: "block", marginTop: 16 }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${B}lockup-stacked-${p.id}.svg`} alt="stacked lockup" style={{ height: 140, display: "block", marginTop: 24 }} />
            </div>

            <div>
              <h3 style={{ fontSize: 13 }}>App icons</h3>
              <div style={row}>
                {ICONS.map(([f]) => (
                  <figure key={f} style={{ margin: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={B + f} width={96} height={96} alt={f} style={f.includes("maskable") ? { borderRadius: "50%" } : undefined} />
                    <figcaption style={cap}>{f}</figcaption>
                  </figure>
                ))}
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: 13 }}>Open Graph</h3>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${B}og-${p.id}.png`} alt={`OG card, ${p.id}`} style={{ width: "100%", maxWidth: 600, display: "block", border: `1px solid ${p.line}` }} />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
