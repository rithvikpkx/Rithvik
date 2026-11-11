"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { PIXEL } from "@/lib/darkroom/fx-pixel";

/** [x%, y%, size, colour slot] for the miniature constellation, and which dots are joined. */
const DOTS: [number, number, number, number][] = [
  [18, 26, 9, 0], [34, 14, 7, 0], [50, 30, 11, 1], [70, 18, 8, 1], [84, 36, 10, 2], [64, 50, 7, 2],
  [40, 52, 9, 0], [22, 66, 8, 1], [48, 78, 11, 2], [74, 74, 8, 0], [88, 62, 6, 1],
];
const LINKS: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [2, 6], [6, 7], [6, 8], [5, 9], [4, 10], [8, 9]];
const ATKINSON = PIXEL.find((e) => e.id === "atkinson")!;

/** The Darkroom tile: the portrait dithered once (Atkinson, drawn as a mask so the ink follows the look) with a small constellation twinkling over it. */
export default function DarkroomPreview() {
  const [mask, setMask] = useState("");

  // Dither a 150px copy of the portrait and keep only where the ink falls; the tile paints that mask in --pf-ink.
  useEffect(() => {
    let dead = false;
    const img = new Image();
    img.onload = () => {
      if (dead) return;
      const n = 150, c = document.createElement("canvas");
      c.width = c.height = n;
      const x = c.getContext("2d", { willReadFrequently: true })!;
      x.imageSmoothingQuality = "high";
      x.drawImage(img, 0, 0, n, n);
      const src = x.getImageData(0, 0, n, n), out = ATKINSON.apply({ w: n, h: n, data: src.data }, { scale: 1, pal: 0, contrast: 1.35 }, { k: 1, t: 0, atlas: () => { throw new Error("unused"); } });
      for (let i = 0; i < out.data.length; i += 4) { out.data[i + 3] = out.data[i] < 128 ? 255 : 0; out.data[i] = out.data[i + 1] = out.data[i + 2] = 0; }
      x.putImageData(new ImageData(out.data as Uint8ClampedArray<ArrayBuffer>, n, n), 0, 0);
      setMask(c.toDataURL("image/png"));
    };
    img.src = "/images/rithvik.jpeg";
    return () => { dead = true; };
  }, []);

  return (
    <span className="pf-shape">
      <span className="pf-dr-ph" style={mask ? ({ "--m": `url(${mask})` } as CSSProperties) : undefined} />
      <svg className="pf-dr-ln" viewBox="0 0 100 100" preserveAspectRatio="none">
        {LINKS.map(([a, b]) => <line key={`${a}-${b}`} x1={DOTS[a][0]} y1={DOTS[a][1]} x2={DOTS[b][0]} y2={DOTS[b][1]} vectorEffect="non-scaling-stroke" />)}
      </svg>
      {DOTS.map(([x, y, s, c], i) => <i key={i} className={`c${c}`} style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, animationDelay: `${-(i * 0.7) % 4}s` }} />)}
    </span>
  );
}
