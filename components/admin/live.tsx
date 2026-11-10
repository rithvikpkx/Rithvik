"use client";
/** The dashboard's small client islands: the live clock + self-refresh, counting numbers, keyboard list navigation,
 *  and remote logos with a fallback. */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { fmtInt, fmtMs, fmtRate, fmtUsd } from "@/lib/status/format";
import { duration } from "@/lib/track/views";

const still = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A UTC clock with a pulse dot; every `every` seconds it re-fetches the server data (router.refresh) unless the tab
 *  is hidden or the owner is typing, and the dot flashes when fresh numbers land. */
export function Live({ every = 60 }: { every?: number }) {
  const router = useRouter();
  const [t, setT] = useState<string>("");
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const tick = () => setT(new Date().toISOString().slice(11, 16));
    tick();
    const c = setInterval(tick, 10_000);
    const r = setInterval(() => {
      const el = document.activeElement;
      if (document.visibilityState !== "visible" || (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      router.refresh();
      setBeat((b) => b + 1);
    }, every * 1000);
    return () => { clearInterval(c); clearInterval(r); };
  }, [router, every]);
  return (
    <span className="d-live" title={`Refreshes every ${every}s`}>
      <i key={beat} aria-hidden="true" />live<b suppressHydrationWarning>{t ? `${t} utc` : ""}</b>
    </span>
  );
}

type Kind = "int" | "ms" | "pct" | "usd" | "dur";
const FMT: Record<Kind, (n: number) => string> = { int: fmtInt, ms: fmtMs, pct: fmtRate, usd: fmtUsd, dur: (n) => duration(n) };

/** A number that counts up to its value on mount and glides to new values on refresh (instant under reduced motion).
 *  The server renders the final value, so there is no flash without JS. */
export function Num({ value, kind = "int" }: { value: number | null; kind?: Kind }) {
  const [shown, setShown] = useState(value);
  const from = useRef<number | null>(null);
  useEffect(() => {
    if (value === null || still()) { setShown(value); from.current = value; return; }
    const a = from.current ?? 0, b = value, t0 = performance.now(), D = from.current === null ? 900 : 600;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
      setShown(a + (b - a) * e);
      if (k < 1) raf = requestAnimationFrame(step); else from.current = b;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  if (shown === null || value === null) return <>–</>;
  return <>{FMT[kind](kind === "int" ? Math.round(shown) : shown)}</>;
}

/** Wraps a list: j/k or the arrow keys move focus between its rows (`a[data-row]`), Enter opens (native link),
 *  and "/" focuses the page's search box. Keys are ignored while typing in a field. */
export function KeyNav({ children, className }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === "/") { const s = document.querySelector<HTMLInputElement>(".dash input[type=search]"); if (s) { e.preventDefault(); s.focus(); } return; }
      const dir = e.key === "j" || e.key === "ArrowDown" ? 1 : e.key === "k" || e.key === "ArrowUp" ? -1 : 0;
      if (!dir || !box.current) return;
      const rows = [...box.current.querySelectorAll<HTMLAnchorElement>("a[data-row]")];
      if (!rows.length) return;
      e.preventDefault();
      const i = rows.indexOf(document.activeElement as HTMLAnchorElement);
      const next = rows[i < 0 ? (dir > 0 ? 0 : rows.length - 1) : Math.min(rows.length - 1, Math.max(0, i + dir))];
      next.focus();
      next.scrollIntoView({ block: "nearest", behavior: still() ? "auto" : "smooth" });
    };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, []);
  return <div ref={box} className={className}>{children}</div>;
}

const HOST = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

/** A site's favicon (DuckDuckGo's icon service) for a hostname, falling back to `fallback` when the host is not a
 *  plain domain or the icon fails to load. */
export function Logo({ host, fallback, size = 16 }: { host: string | null | undefined; fallback: ReactNode; size?: number }) {
  const [bad, setBad] = useState(false);
  const h = (host ?? "").replace(/^www\./, "").toLowerCase();
  if (bad || !HOST.test(h)) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a 16px remote favicon; next/image would proxy it for nothing
    <img className="d-logo" src={`https://icons.duckduckgo.com/ip3/${h}.ico`} width={size} height={size} alt="" loading="lazy" onError={() => setBad(true)} />
  );
}
