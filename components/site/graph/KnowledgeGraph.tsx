"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { buildKG, kgLayout, KG_TYPES, type KGNode, type KGType } from "@/lib/graph/kg";
import { Icon } from "../portrait/Glyph";
import { useSite } from "../SiteProvider";
import KgShape from "./KgShape";
import "./graph.css";

const TYPE_LABEL = Object.fromEntries(KG_TYPES) as Record<KGType, string>;

/** Local time in an IANA zone, e.g. "3:07 PM". */
const clock = (tz: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date());

/** Everything on record about Rithvik as one explorable SVG graph, built from site content: radial tree
 *  (me, fields, projects/roles, skills, school, places) with hover highlight, click-to-card and type filters.
 *  Size it by giving it a width (height comes from --kg-h); restyle via --kg-* tokens and .kg-* classes. */
export default function KnowledgeGraph({ id = "g", className = "" }: { id?: string; className?: string }) {
  const { content, openCase, openComposer } = useSite();
  const kg = useMemo(() => buildKG(content), [content]);
  const adj = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    kg.edges.forEach((e) => { (m[e.a] ||= new Set()).add(e.b); (m[e.b] ||= new Set()).add(e.a); });
    return m;
  }, [kg]);

  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<KGType>>(new Set());
  const [isIn, setIsIn] = useState(false);
  const markId = `kgm-${useId().replace(/:/g, "")}`;

  // Measure the svg once it is near the viewport, then on resize (debounced) so the layout re-flows without thrashing.
  useEffect(() => {
    const svg = svgRef.current, root = rootRef.current;
    if (!svg || !root) return;
    let t = 0, started = false;
    const measure = () => { const r = svg.getBoundingClientRect(); setSize({ w: Math.max(320, Math.round(r.width)), h: Math.max(320, Math.round(r.height)) }); };
    const ro = new ResizeObserver(() => { if (!started) return; clearTimeout(t); t = window.setTimeout(measure, 160); });
    const io = new IntersectionObserver(([en]) => {
      if (!en?.isIntersecting || started) return;
      started = true; measure(); requestAnimationFrame(() => setIsIn(true));
    }, { rootMargin: "200px" });
    io.observe(root); ro.observe(svg);
    return () => { io.disconnect(); ro.disconnect(); clearTimeout(t); };
  }, []);

  const pos = useMemo(() => (size ? kgLayout(kg, size.w, size.h) : null), [kg, size]);
  const focus = sel ?? hover;
  const near = focus ? adj[focus] : undefined;
  const node = sel ? kg.byId[sel] : null;
  const w = size?.w ?? 0;

  /** Pointer, focus and keyboard handlers for one node: hover/focus highlights, click/Enter/Space opens its card. */
  const nodeProps = (n: KGNode) => ({
    onClick: (e: React.MouseEvent) => { e.stopPropagation(); setSel(n.id); },
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(n.id); } },
    onPointerEnter: () => setHover(n.id),
    onPointerLeave: () => setHover((h) => (h === n.id ? null : h)),
    onFocus: () => setHover(n.id),
    onBlur: () => setHover((h) => (h === n.id ? null : h)),
  });
  const toggle = (t: KGType) => setHidden((s) => { const x = new Set(s); if (!x.delete(t)) x.add(t); return x; });
  const cls = ["kg", className, isIn && "is-in", focus && "has-focus", ...[...hidden].map((t) => "hide-" + t)].filter(Boolean).join(" ");
  const rank = (t: KGType) => KG_TYPES.findIndex((x) => x[0] === t);
  const links = node ? [...(adj[node.id] ?? [])].map((k) => kg.byId[k]).sort((a, b) => rank(a.type) - rank(b.type)) : [];

  return (
    <div ref={rootRef} className={cls} data-kg={id} role="group" aria-label={`Knowledge graph of ${content.first}'s work, skills, roles and places`}
      onKeyDown={(e) => { if (e.key === "Escape" && sel) setSel(null); }}>
      <svg ref={svgRef} className="kg-svg" viewBox={size ? `0 0 ${size.w} ${size.h}` : undefined} onClick={() => setSel(null)}>
        {pos && size && (
          <>
            <g className="kg-edges">
              {kg.edges.map((e, i) => {
                const [x1, y1] = pos[e.a], [x2, y2] = pos[e.b], mx = (x1 + x2) / 2 + (y2 - y1) * 0.12, my = (y1 + y2) / 2 - (x2 - x1) * 0.12;
                return <path key={i} className={`kg-edge${focus && (e.a === focus || e.b === focus) ? " is-lit" : ""}`} data-a={e.a} data-b={e.b} data-kind={e.kind} pathLength={1} style={{ "--i": i } as React.CSSProperties}
                  d={`M${x1.toFixed(1)} ${y1.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`} />;
              })}
            </g>
            <g className="kg-nodes">
              {kg.nodes.map((n, i) => {
                const [x, y] = pos[n.id], left = x < w / 2 - 4, txt = n.short || n.label;
                const lbl = n.type === "me" ? null
                  : w < 560 ? (n.type === "skill" ? null : <text className="kg-label" x={0} y={n.type === "field" ? -13 : 18} textAnchor="middle">{txt}</text>)
                  : n.type === "field" ? <text className="kg-label" x={0} y={y < size.h / 2 ? -15 : 24} textAnchor="middle">{txt}</text>
                  : <text className="kg-label" x={left ? -12 : 12} y={4} textAnchor={left ? "end" : "start"}>{txt}</text>;
                return (
                  <g key={n.id} className={`kg-node${n.id === focus ? " is-focus" : ""}${near?.has(n.id) ? " is-near" : ""}`} data-id={n.id} data-type={n.type}
                    transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} tabIndex={n.type === "skill" ? -1 : 0} role="button"
                    aria-label={n.label + (n.sub ? ", " + n.sub : "")} style={{ "--i": i } as React.CSSProperties} {...nodeProps(n)}>
                    <g className="kg-bob"><KgShape n={n} markId={markId} />{lbl}</g>
                  </g>
                );
              })}
            </g>
          </>
        )}
      </svg>
      <div className="kg-legend" role="toolbar" aria-label="Show or hide node types">
        {KG_TYPES.slice(1).map(([t, l]) => (
          <button key={t} type="button" className="kg-key" data-kg-type={t} aria-pressed={!hidden.has(t)} onClick={() => toggle(t)}>
            <i className="kg-dot" data-type={t} />{l}
          </button>
        ))}
      </div>
      <aside className="kg-card" hidden={!node} aria-live="polite">
        {node && (
          <>
            <button type="button" className="kg-x" aria-label="Close" onClick={() => setSel(null)}><Icon name="x" /></button>
            <p className="kg-type"><i className="kg-dot" data-type={node.type} />{TYPE_LABEL[node.type].replace(/s$/, "")}</p>
            <h3>{node.label}</h3>
            {node.sub && <p className="kg-sub">{node.sub}</p>}
            {!!node.facts?.length && <ul>{node.facts.map((f, i) => <li key={i}>{f}</li>)}</ul>}
            {node.action?.kind === "case" && <button type="button" className="kg-act" onClick={() => openCase((node.action as { slug: string }).slug)}>Open the case <Icon name="arrow-up-right" /></button>}
            {node.type === "place" && node.tz && <p className="kg-time"><Icon name="map-pin" /> <span>{clock(node.tz)}</span> local</p>}
            {node.type === "me" && <button type="button" className="kg-act" onClick={() => openComposer()}>Write to me <Icon name="mail" /></button>}
            <p className="kg-links-h">Connected to {links.length}</p>
            <div className="kg-links">
              {links.map((m) => <button key={m.id} type="button" onClick={() => setSel(m.id)}><i className="kg-dot" data-type={m.type} />{m.label}</button>)}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
