"use client";
import { useEffect, useRef, useState } from "react";
import { parseCount } from "@/lib/count";

/** A number that counts up once, when it first scrolls into view. Shows the real value at once under performance
 *  mode, reduced motion, or inline editing (the editor needs plain text), and always ends on the exact string. */
export default function Counter({ value, ...rest }: { value: string } & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState<string | null>(null); // null = show `value` as is
  useEffect(() => {
    const el = ref.current, p = parseCount(value);
    const calm = document.documentElement.classList.contains("lite") || document.documentElement.classList.contains("inline-edit-on") || matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!el || !p || p.n === 0 || calm) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), dur = 1100;
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / dur), eased = 1 - Math.pow(1 - k, 3);
        if (k < 1) { setShown(p.pre + Math.round(p.n * eased).toLocaleString("en-US") + p.post); raf = requestAnimationFrame(tick); }
        else setShown(null);
      };
      setShown(p.pre + "0" + p.post);
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value]);
  return <b ref={ref} {...rest}>{shown ?? value}</b>;
}
