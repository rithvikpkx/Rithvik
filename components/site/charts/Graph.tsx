"use client";
import { useRef, useState } from "react";
import { circleLayout } from "@/lib/charts/scale";
import { DataTable, seriesColor, useWidth } from "./shared";

export type GraphNode = { id: string; label: string; group?: string };

/** A small node-link diagram on a ring: nodes coloured by group (fixed order, at most 8 groups), edges as hairlines,
 *  hovering a node lights its neighbours. For a handful of relations, not a layout engine. */
export default function Graph({ title, nodes, edges }: { title: string; nodes: GraphNode[]; edges: { from: string; to: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref, 520);
  const [hover, setHover] = useState<string | null>(null);
  const h = Math.round(Math.min(width * 0.85, 320));
  const r = Math.max(30, Math.min(width / 2 - 84, h / 2 - 22));
  const ring = circleLayout(nodes.length, width / 2, h / 2, r);
  const pos = new Map(nodes.map((nd, i) => [nd.id, ring[i]]));
  const groups = [...new Set(nodes.map((nd) => nd.group ?? ""))].slice(0, 8);
  const near = (id: string) => hover === null || hover === id || edges.some((e) => (e.from === hover && e.to === id) || (e.to === hover && e.from === id));
  const summary = `Graph${title ? `: ${title}` : ""}. ${nodes.length} nodes, ${edges.length} connections: ${edges.map((e) => `${nodes.find((n) => n.id === e.from)?.label} to ${nodes.find((n) => n.id === e.to)?.label}`).join("; ")}.`;
  return (
    <div className="ch" ref={ref}>
      <svg viewBox={`0 0 ${width} ${h}`} height={h} role="img" aria-label={summary} onPointerLeave={() => setHover(null)}>
        {edges.map((e, i) => {
          const a = pos.get(e.from), b = pos.get(e.to);
          if (!a || !b) return null;
          const lit = hover === null || e.from === hover || e.to === hover;
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={{ stroke: "var(--ch-base)" }} strokeWidth={lit && hover !== null ? 2 : 1} opacity={lit ? 1 : 0.25} />;
        })}
        {nodes.map((nd) => {
          const p = pos.get(nd.id)!;
          const right = Math.sin(p.angle) > 0.15, left = Math.sin(p.angle) < -0.15;
          const lab = nd.label.length > 18 ? `${nd.label.slice(0, 17)}…` : nd.label;
          return (
            <g key={nd.id} opacity={near(nd.id) ? 1 : 0.35} onPointerEnter={() => setHover(nd.id)} onPointerDown={() => setHover(nd.id)}>
              <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
              <circle className="ch-ring ch-in" cx={p.x} cy={p.y} r={5} style={{ color: seriesColor(Math.max(0, groups.indexOf(nd.group ?? ""))) }} fill="currentColor" />
              <text x={p.x + (right ? 10 : left ? -10 : 0)} y={p.y + (right || left ? 4 : Math.cos(p.angle) > 0 ? -10 : 18)} textAnchor={right ? "start" : left ? "end" : "middle"}>{lab}</text>
            </g>
          );
        })}
      </svg>
      {groups.length > 1 && (
        <ul className="ch-legend" aria-hidden="true">{groups.map((g, i) => <li key={g}><span className="ch-key" style={{ background: seriesColor(i) }} />{g || "other"}</li>)}</ul>
      )}
      <DataTable caption={title || summary} columns={["From", "To"]} rows={edges.map((e) => [nodes.find((n) => n.id === e.from)?.label ?? e.from, nodes.find((n) => n.id === e.to)?.label ?? e.to])} />
    </div>
  );
}
