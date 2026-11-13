"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Runner } from "@/lib/darkroom/client";
import type { Frame } from "@/lib/darkroom/frame";
import { POS, neighbours, search } from "@/lib/darkroom/layout";
import { BY_ID, EFFECTS, FAMILIES, fill, randomParams, stepFor } from "@/lib/darkroom/registry";
import type { Effect, Step } from "@/lib/darkroom/types";
import { useSite } from "../SiteProvider";
import { Icon as Ic } from "../Glyph";
import "./darkroom.css";

const PORTRAIT = "/images/rithvik.jpeg";
const PREVIEW = 512; // longest side of the working image; effect pixel sizes scale from this
const MAX_STACK = 6;
const STILL_T = 1.7; // the frame an animated effect rests on when motion is off
type Item = Step & { uid: number };

/** Draws an image source into a canvas no larger than `max` on its longest side and returns its pixels. */
function grab(img: CanvasImageSource & { width: number; height: number }, max: number): Frame {
  const s = max / Math.max(img.width, img.height), w = Math.round(img.width * s), h = Math.round(img.height * s), c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.imageSmoothingQuality = "high";
  x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h);
  return { w, h, data: d.data };
}

/** Hands a blob to the browser as a download through a temporary object URL. */
function download(blob: Blob, name: string) {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Deterministic drift for a dot: small offsets and a slow period derived from its position. */
const drift = (i: number): CSSProperties => ({ "--dx": `${((i * 7) % 9) - 4}px`, "--dy": `${((i * 5) % 9) - 4}px`, "--dd": `${9 + ((i * 3) % 7)}s`, "--dl": `-${(i * 1.7) % 11}s` }) as CSSProperties;

/** The Darkroom toy: a constellation of image effects. Click a dot to apply it to the portrait, shift+click to stack,
 *  tune the selected one, randomize, and export a PNG. Rendering runs in a worker; the picture never leaves the browser. */
export default function Darkroom() {
  const { toast } = useSite();
  const [stack, setStack] = useState<Item[]>(() => [{ uid: 1, ...stepFor("cmyk") }]);
  const [sel, setSel] = useState(1);
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState<string | null>(null);
  const [stacking, setStacking] = useState(false); // touch has no shift key: this chip stands in for it
  const [src, setSrc] = useState<{ key: string; w: number; h: number } | null>(null);
  const [own, setOwn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const runner = useRef<Runner | null>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const fromCv = useRef<HTMLCanvasElement | null>(null);
  const fade = useRef(0);
  const wantFade = useRef(true);
  const uid = useRef(1);
  const orig = useRef<(CanvasImageSource & { width: number; height: number }) | null>(null);
  const seen = useRef(true);
  const srcN = useRef(0);
  const file = useRef<HTMLInputElement>(null);
  const busyT = useRef(0);

  // One worker-backed runner for the life of the tab. The busy flag is debounced so quick renders never flash the indicator.
  useEffect(() => {
    const r = new Runner();
    r.onBusy = (b) => { clearTimeout(busyT.current); if (b) busyT.current = window.setTimeout(() => setBusy(true), 140); else setBusy(false); };
    runner.current = r;
    return () => { clearTimeout(busyT.current); r.destroy(); runner.current = null; };
  }, []);

  /** Loads a picture as the working source (the portrait on open, or the visitor's own file). */
  const loadSource = useCallback((img: CanvasImageSource & { width: number; height: number }, isOwn: boolean) => {
    const f = grab(img, PREVIEW), key = `s${++srcN.current}`;
    orig.current = img;
    runner.current?.setSource(key, f);
    setOwn(isOwn);
    wantFade.current = true;
    setSrc({ key, w: f.w, h: f.h });
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => loadSource(img, false);
    img.src = PORTRAIT;
  }, [loadSource]);

  // Previews run only while the window is on screen.
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const io = new IntersectionObserver(([e]) => { seen.current = e.isIntersecting; });
    io.observe(c);
    return () => io.disconnect();
  }, []);

  /** Paints a rendered frame, with a short crossfade from what was showing when `blend` is set. */
  const show = useCallback((f: Frame, blend: boolean) => {
    const c = cv.current;
    if (!c) return;
    if (c.width !== f.w || c.height !== f.h) { c.width = f.w; c.height = f.h; blend = false; }
    const ctx = c.getContext("2d")!, img = new ImageData(f.data as Uint8ClampedArray<ArrayBuffer>, f.w, f.h);
    cancelAnimationFrame(fade.current);
    if (!blend || matchMedia("(prefers-reduced-motion: reduce)").matches) { ctx.putImageData(img, 0, 0); return; }
    const from = (fromCv.current ??= document.createElement("canvas")), to = document.createElement("canvas");
    from.width = to.width = f.w; from.height = to.height = f.h;
    from.getContext("2d")!.drawImage(c, 0, 0); // freeze whatever is on screen, even a half-finished fade
    to.getContext("2d")!.putImageData(img, 0, 0);
    const t0 = performance.now();
    const step = (now: number) => {
      const a = Math.min(1, (now - t0) / 320), e = 1 - (1 - a) ** 3;
      ctx.globalAlpha = 1; ctx.drawImage(from, 0, 0);
      ctx.globalAlpha = e; ctx.drawImage(to, 0, 0);
      ctx.globalAlpha = 1;
      if (a < 1) fade.current = requestAnimationFrame(step);
    };
    fade.current = requestAnimationFrame(step);
  }, []);

  const steps = useMemo<Step[]>(() => stack.map((s) => ({ id: s.id, intensity: s.intensity, params: s.params })), [stack]);
  const animated = steps.some((s) => BY_ID.get(s.id)?.animated);

  // Re-render whenever the stack or source changes; the newest edit always wins over queued ones.
  useEffect(() => {
    if (!src || !runner.current) return;
    const blend = wantFade.current;
    wantFade.current = false;
    runner.current.render({ srcKey: src.key, steps, t: animated ? STILL_T : 0 }, (f) => show(f, blend));
  }, [src, steps, animated, show]);

  // Animated effects tick at ~15fps, only while the toy is on screen and motion is allowed (lite mode and reduced motion get the still).
  useEffect(() => {
    if (!animated || !src) return;
    if (document.documentElement.classList.contains("lite") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = performance.now(), r = runner.current!;
    const id = window.setInterval(() => {
      if (document.hidden || !seen.current) return;
      r.render({ srcKey: src.key, steps, t: STILL_T + (performance.now() - t0) / 1000 }, (f) => show(f, false), true);
    }, 66);
    return () => clearInterval(id);
  }, [animated, src, steps, show]);

  const hits = useMemo(() => search(query), [query]);
  const inStack = new Map(stack.map((s, i) => [s.id, i + 1]));
  const current = stack.find((s) => s.uid === sel) ?? stack[stack.length - 1] ?? null;
  const fx = current ? BY_ID.get(current.id)! : null;
  const near = useMemo(() => (fx ? neighbours(fx.id, 4) : []), [fx]);
  const shown = hover ? BY_ID.get(hover) ?? null : null;

  /** Applies an effect: replaces the stack by default, adds to (or takes out of) it when stacking. */
  const choose = (id: string, add: boolean) => {
    wantFade.current = true;
    const found = stack.find((s) => s.id === id);
    if (add) {
      if (found) { const rest = stack.filter((s) => s.uid !== found.uid); setStack(rest); setSel(rest[rest.length - 1]?.uid ?? 0); return; }
      if (stack.length >= MAX_STACK) { toast(`The stack holds ${MAX_STACK}. Remove one first.`); return; }
      const n = { uid: ++uid.current, ...stepFor(id) };
      setStack([...stack, n]); setSel(n.uid);
      return;
    }
    const keep = found ?? { uid: ++uid.current, ...stepFor(id) };
    setStack([keep]); setSel(keep.uid);
  };
  const edit = (uidv: number, patch: Partial<Step>) => setStack((s) => s.map((x) => (x.uid === uidv ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) => { wantFade.current = true; setStack((s) => { const n = [...s], j = i + d; if (j < 0 || j >= n.length) return s; [n[i], n[j]] = [n[j], n[i]]; return n; }); };
  const remove = (u: number) => { wantFade.current = true; const rest = stack.filter((s) => s.uid !== u); setStack(rest); if (sel === u) setSel(rest[rest.length - 1]?.uid ?? 0); };

  /** One to three random effects with random parameters, and a fresh seed wherever an effect has one. */
  const randomize = () => {
    const pool = [...EFFECTS].sort(() => Math.random() - 0.5), n = 1 + Math.floor(Math.random() * 3);
    const next = pool.slice(0, n).map((e) => ({ uid: ++uid.current, id: e.id, intensity: 1, params: randomParams(e, Math.random) }));
    wantFade.current = true;
    setStack(next); setSel(next[next.length - 1].uid);
  };
  const reroll = () => { if (current && fx) edit(current.uid, { params: randomParams(fx, Math.random) }); };

  const onOwn = async (f: File | undefined) => {
    if (!f) return;
    try {
      const bmp = await createImageBitmap(f);
      loadSource(bmp, true);
    } catch { toast("That file could not be read as an image."); }
  };

  /** Re-runs the stack at twice the preview size from the original picture and downloads the PNG. */
  const exportPng = async () => {
    const r = runner.current, o = orig.current;
    if (!r || !o || exporting) return;
    setExporting(true);
    try {
      const big = grab(o, PREVIEW * 2), key = `x${++srcN.current}`;
      r.setSource(key, big);
      const out = await r.run({ srcKey: key, steps, t: STILL_T, cache: false });
      const c = document.createElement("canvas");
      c.width = out.w; c.height = out.h;
      c.getContext("2d")!.putImageData(new ImageData(out.data as Uint8ClampedArray<ArrayBuffer>, out.w, out.h), 0, 0);
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
      if (!blob) throw new Error("encode");
      download(blob, `darkroom-${steps.map((s) => s.id).join("+") || "original"}.png`);
      toast("Saved. Processed in your browser, never uploaded.");
    } catch { toast("Export failed. Try a smaller stack."); } finally { setExporting(false); }
  };

  const label = stack.map((s) => BY_ID.get(s.id)?.name).join(" + ") || "Original";
  const lines = useMemo(() => {
    const ids = new Set<string>();
    const add = (id: string) => neighbours(id, 3).forEach((n) => ids.add(`${id}|${n.id}`));
    if (fx) add(fx.id);
    if (hover) add(hover);
    return [...ids].map((k) => k.split("|"));
  }, [fx, hover]);

  return (
    <div className="dr" data-busy={busy || undefined}>
      <div className="dr-sky-wrap">
        <div className="dr-top">
          <label className="dr-search">
            <Ic name="search" />
            <input type="search" value={query} placeholder="Describe an effect… (retro, dots, glitchy)" aria-label="Describe an effect" autoComplete="off"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && query) { e.stopPropagation(); setQuery(""); }
                if (e.key === "Enter") { const best = [...hits].sort((a, b) => b[1] - a[1])[0]; if (best && query) choose(best[0], e.shiftKey || stacking); }
              }} />
          </label>
          <button type="button" className={`dr-chip dr-stackmode${stacking ? " on" : ""}`} aria-pressed={stacking} onClick={() => setStacking((v) => !v)} title="Tapping a dot adds it to the stack instead of replacing it">
            <Ic name="plus" />Stack
          </button>
        </div>
        <div className="dr-sky" role="group" aria-label="Effects constellation. Click an effect to apply it, shift+click to stack." onPointerLeave={() => setHover(null)}>
          <svg className="dr-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {lines.map(([a, b]) => <line key={`${a}${b}`} x1={POS.get(a)!.x * 100} y1={POS.get(a)!.y * 100} x2={POS.get(b)!.x * 100} y2={POS.get(b)!.y * 100} vectorEffect="non-scaling-stroke" />)}
          </svg>
          {FAMILIES.map((f) => {
            const m = EFFECTS.filter((e) => e.family === f.id), cx = m.reduce((s, e) => s + POS.get(e.id)!.x, 0) / m.length, top = Math.min(...m.map((e) => POS.get(e.id)!.y));
            return <span key={f.id} className="dr-fam" data-f={f.id} style={{ left: `${cx * 100}%`, top: `${top * 100}%` }} aria-hidden="true">{f.name}</span>;
          })}
          {EFFECTS.map((e, i) => {
            const p = POS.get(e.id)!, hit = hits.has(e.id), n = inStack.get(e.id);
            return (
              <button key={e.id} type="button" className="dr-dot" data-f={e.family} data-on={n ? "" : undefined} data-sel={fx?.id === e.id ? "" : undefined} data-dim={hit ? undefined : ""}
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, ...drift(i) }} aria-pressed={!!n} aria-label={`${e.name}, ${e.family}. ${e.desc}`}
                onPointerEnter={() => setHover(e.id)} onFocus={() => setHover(e.id)} onBlur={() => setHover((h) => (h === e.id ? null : h))}
                onClick={(ev) => choose(e.id, ev.shiftKey || ev.metaKey || ev.ctrlKey || stacking)}>
                <i />{n && stack.length > 1 && <b>{n}</b>}
              </button>
            );
          })}
          {shown && <Card e={shown} at={POS.get(shown.id)!} />}
          {query && hits.size === 0 && <p className="dr-none">Nothing matches. Try “dots”, “retro” or “glitch”.</p>}
        </div>
        <p className="dr-foot"><span>{EFFECTS.length} effects</span> · click to apply · shift+click to stack<span className="dr-key">{FAMILIES.map((f) => <em key={f.id} data-f={f.id}>{f.name}</em>)}</span></p>
      </div>

      <div className="dr-view">
        <div className="dr-frame" style={{ aspectRatio: src ? `${src.w} / ${src.h}` : "1" }}>
          <canvas ref={cv} aria-label={`Portrait with ${label} applied`} role="img" />
          <span className="dr-tag">{label}</span>
          {busy && <span className="dr-spin" aria-hidden="true" />}
        </div>
        <div className="dr-actions">
          <button type="button" className="dr-chip" onClick={randomize}><Ic name="shuffle" />Randomize</button>
          <button type="button" className="dr-chip dr-primary" onClick={exportPng} disabled={exporting}><Ic name="download" />{exporting ? "Exporting…" : "Export PNG"}</button>
          <button type="button" className="dr-chip" onClick={() => file.current?.click()}><Ic name="plus" />Use my image</button>
          {own && <button type="button" className="dr-chip" onClick={() => { const img = new Image(); img.onload = () => loadSource(img, false); img.src = PORTRAIT; }}><Ic name="rotate-ccw" />Portrait</button>}
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { onOwn(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        {own && <p className="dr-note">Your image stays in this browser. Nothing is uploaded.</p>}
      </div>

      <div className="dr-panel">
        {stack.length > 1 && (
          <ol className="dr-stack" aria-label="Effect stack, applied first to last">
            {stack.map((s, i) => (
              <li key={s.uid} data-sel={s.uid === current?.uid ? "" : undefined}>
                <button type="button" className="dr-pick" onClick={() => setSel(s.uid)}><span className="dr-n">{i + 1}</span>{BY_ID.get(s.id)?.name}</button>
                <button type="button" className="dr-mini" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}><Ic name="arrow-up" /></button>
                <button type="button" className="dr-mini" aria-label="Move later" disabled={i === stack.length - 1} onClick={() => move(i, 1)}><Ic name="arrow-up" className="ic dn" /></button>
                <button type="button" className="dr-mini" aria-label={`Remove ${BY_ID.get(s.id)?.name}`} onClick={() => remove(s.uid)}><Ic name="x" /></button>
              </li>
            ))}
          </ol>
        )}
        {fx && current && <Panel fx={fx} item={current} near={near} onEdit={(patch) => edit(current.uid, patch)} onReroll={reroll} onPick={(id, add) => choose(id, add || stacking)} />}
        {!fx && <p className="dr-note">Pick a dot to start.</p>}
      </div>
    </div>
  );
}

/** The hover card: name, one line, how to use it. It flips to stay inside the sky. */
function Card({ e, at }: { e: Effect; at: { x: number; y: number } }) {
  const style: CSSProperties = { left: `${at.x * 100}%`, top: `${at.y * 100}%`, transform: `translate(${at.x > 0.55 ? "calc(-100% - 18px)" : "18px"}, ${at.y > 0.62 ? "calc(-100% - 6px)" : "-6px"})` };
  return (
    <div className="dr-card" data-f={e.family} style={style} role="status">
      <span className="dr-fk">{e.family}</span>
      <strong>{e.name}</strong>
      <p>{e.desc}</p>
      <small>click to apply · shift+click to stack</small>
    </div>
  );
}

/** The selected effect: intensity, its parameters (sliders, or segments for choices), a reroll, and nearest neighbours. */
function Panel({ fx, item, near, onEdit, onReroll, onPick }: { fx: Effect; item: Item; near: Effect[]; onEdit: (p: Partial<Step>) => void; onReroll: () => void; onPick: (id: string, add: boolean) => void }) {
  const vals = fill(fx, item.params);
  return (
    <section className="dr-sel" data-f={fx.family} aria-label={`${fx.name} settings`}>
      <header>
        <span className="dr-fk">{fx.family}</span>
        <h3>{fx.name}</h3>
        <button type="button" className="dr-mini" aria-label="Randomize this effect's settings" title="Randomize settings" onClick={onReroll}><Ic name="shuffle" /></button>
      </header>
      <p>{fx.desc}</p>
      <label className="dr-slider"><span>Intensity</span>
        <input type="range" min={0} max={1} step={0.01} value={item.intensity} onChange={(e) => onEdit({ intensity: +e.target.value })} />
        <output>{Math.round(item.intensity * 100)}%</output>
      </label>
      {fx.params.map((p) => p.options ? (
        <div key={p.key} className="dr-seg" role="radiogroup" aria-label={p.label}><span>{p.label}</span>
          <div>{p.options.map((o, i) => <button key={o} type="button" role="radio" aria-checked={vals[p.key] === i} onClick={() => onEdit({ params: { ...item.params, [p.key]: i } })}>{o}</button>)}</div>
        </div>
      ) : (
        <label key={p.key} className="dr-slider"><span>{p.label}</span>
          <input type="range" min={p.min} max={p.max} step={p.step} value={vals[p.key]} onChange={(e) => onEdit({ params: { ...item.params, [p.key]: +e.target.value } })} />
          <output>{+vals[p.key].toFixed(2)}</output>
        </label>
      ))}
      <div className="dr-near"><span>Nearest neighbours</span>
        <div>{near.map((n) => <button key={n.id} type="button" data-f={n.family} onClick={(e) => onPick(n.id, e.shiftKey)}><i />{n.name}</button>)}</div>
      </div>
    </section>
  );
}
