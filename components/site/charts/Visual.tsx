"use client";
import { useEffect, useRef, useState } from "react";
import { sanitizeVisual } from "@/lib/agent/artifacts";

// The visual's own policy: styles only, inline images (data:) only, no network of any kind.
const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";

/** A model-made HTML/SVG visual, drawn in a sandboxed iframe: `sandbox=""` means no scripts, no forms, no popups and an
 *  opaque origin (it can't touch the page), and its CSP blocks every load. It inherits the look through --fg, --bg,
 *  --accent, --muted and --line, read from the agent's tokens. */
export default function Visual({ html, height, title }: { html: string; height: number; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vars, setVars] = useState<string | null>(null);
  useEffect(() => {
    const cs = getComputedStyle(ref.current!);
    const v = (n: string, d: string) => (cs.getPropertyValue(n).trim() || d).replace(/[<>;{}]/g, ""); // our own tokens, but never let one close the style
    setVars(`--fg:${v("--a-fg", "#ededf0")};--bg:${v("--a-bg", "#111")};--accent:${v("--a-accent", "#7cc4ff")};--muted:${v("--a-muted", "#9a9aa4")};--line:${v("--a-line", "rgba(255,255,255,.14)")};`);
  }, []);
  const doc = vars === null ? "" : `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><style>:root{${vars}}*{box-sizing:border-box}html,body{margin:0;background:transparent;color:var(--fg);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;overflow:auto}body{padding:12px}</style></head><body>${sanitizeVisual(html)}</body></html>`;
  return (
    <div ref={ref} className="ch-visual" style={{ height }}>
      {doc && <iframe sandbox="" srcDoc={doc} title={title} loading="lazy" referrerPolicy="no-referrer" />}
    </div>
  );
}
