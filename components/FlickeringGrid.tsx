"use client";
import { useEffect, useRef } from "react";

interface Props {
  squareSize?: number;
  gridGap?: number;
  color?: string;
  maxOpacity?: number;
  flickerChance?: number;
  className?: string;
}

/** Canvas-based flickering grid. Each square independently transitions toward a random target opacity. */
export default function FlickeringGrid({
  squareSize = 4,
  gridGap = 6,
  color = "#ffffff",
  maxOpacity = 0.12,
  flickerChance = 0.08,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let opacities: Float32Array;
    let targets: Float32Array;
    let cols = 0;
    let rows = 0;
    let visible = true;

    // Parse hex color once
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      canvas!.width  = rect.width  * devicePixelRatio;
      canvas!.height = rect.height * devicePixelRatio;
      ctx!.scale(devicePixelRatio, devicePixelRatio);

      cols = Math.ceil(rect.width  / (squareSize + gridGap));
      rows = Math.ceil(rect.height / (squareSize + gridGap));
      const count = cols * rows;

      opacities = new Float32Array(count);
      targets   = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        opacities[i] = Math.random() * maxOpacity;
        targets[i]   = Math.random() * maxOpacity;
      }
    }

    function draw() {
      if (!visible) {
        animId = requestAnimationFrame(draw);
        return;
      }

      const rect = canvas!.getBoundingClientRect();
      ctx!.clearRect(0, 0, rect.width, rect.height);

      for (let c = 0; c < cols; c++) {
        for (let row = 0; row < rows; row++) {
          const i = c * rows + row;

          if (Math.random() < flickerChance) {
            targets[i] = Math.random() * maxOpacity;
          }

          opacities[i] += (targets[i] - opacities[i]) * 0.15;

          ctx!.fillStyle = `rgba(${r},${g},${b},${opacities[i].toFixed(3)})`;
          ctx!.fillRect(
            c   * (squareSize + gridGap),
            row * (squareSize + gridGap),
            squareSize,
            squareSize
          );
        }
      }

      animId = requestAnimationFrame(draw);
    }

    resize();
    draw();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Pause animation when scrolled off-screen
    const io = new IntersectionObserver(
      ([entry]) => { visible = entry.isIntersecting; },
      { threshold: 0 }
    );
    io.observe(canvas);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      io.disconnect();
    };
  }, [squareSize, gridGap, color, maxOpacity, flickerChance]);

  return <canvas ref={canvasRef} className={className} />;
}
