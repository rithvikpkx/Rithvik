"use client";
import { useEffect, useRef } from "react";
import { makeAtlas } from "@/lib/darkroom/atlas";
import { runStack } from "@/lib/darkroom/engine";
import { EFFECTS, stepFor } from "@/lib/darkroom/registry";

const N = 300;

/** Renders each effect (default params, still frame) into its own canvas, on the main thread, one per tick. */
export default function Sheet() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = N;
      const x = c.getContext("2d", { willReadFrequently: true })!;
      x.drawImage(img, 0, 0, N, N);
      const src = { w: N, h: N, data: x.getImageData(0, 0, N, N).data };
      EFFECTS.forEach((e, i) => setTimeout(() => {
        const t0 = performance.now(), out = runStack(src, [stepFor(e.id)], { t: 1.7, atlas: makeAtlas }), cv = root.current!.querySelector<HTMLCanvasElement>(`[data-id="${e.id}"]`)!;
        cv.getContext("2d")!.putImageData(new ImageData(out.data as Uint8ClampedArray<ArrayBuffer>, N, N), 0, 0);
        cv.parentElement!.querySelector("small")!.textContent = `${Math.round(performance.now() - t0)}ms`;
        if (i === EFFECTS.length - 1) document.body.dataset.done = "1";
      }, i * 20));
    };
    img.src = "/images/rithvik.jpeg";
  }, []);
  return (
    <div ref={root} style={{ display: "grid", gridTemplateColumns: `repeat(6, ${N}px)`, gap: 10, padding: 10, background: "#111", width: "max-content", font: "12px ui-monospace, monospace", color: "#ddd" }}>
      {EFFECTS.map((e) => (
        <figure key={e.id} style={{ margin: 0 }}>
          <canvas data-id={e.id} width={N} height={N} style={{ display: "block", background: "#222" }} />
          <figcaption style={{ padding: "4px 0" }}>{e.name} <small style={{ opacity: .6 }} /></figcaption>
        </figure>
      ))}
    </div>
  );
}
