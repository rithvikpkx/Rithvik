"use client";
import { useId, useState } from "react";
import { artifactTable, type ArtifactSpec } from "@/lib/agent/artifacts";
import CartesianChart from "./CartesianChart";
import Donut from "./Donut";
import Timeline from "./Timeline";
import Graph from "./Graph";
import { StatRow, Table } from "./Figures";
import { DataTable } from "./shared";

/** Draws a validated artifact spec with the matching chart component, in a compact card that fits the log's width.
 *  "Expand" makes the chart taller and shows its data as a visible table. */
export default function ArtifactView({ spec }: { spec: ArtifactSpec }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const h = open ? 300 : 170;
  const { columns, rows } = artifactTable(spec);
  const plot = spec.type === "bar" || spec.type === "line" || spec.type === "area" || spec.type === "donut" || spec.type === "graph";
  return (
    <section className="ch ch-art" aria-labelledby={id}>
      <div className="ch-art-head">
        <h4 id={id}>{spec.title}</h4>
        {plot && <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "Collapse" : "Expand"}</button>}
      </div>
      {spec.type === "bar" || spec.type === "line" || spec.type === "area" ? (
        <CartesianChart kind={spec.type} title={spec.title} labels={spec.data.labels} series={spec.data.series} unit={spec.unit} height={h} />
      ) : spec.type === "donut" ? (
        <Donut title={spec.title} slices={spec.data.slices} unit={spec.unit} />
      ) : spec.type === "timeline" ? (
        <Timeline title={spec.title} items={spec.data.items} />
      ) : spec.type === "table" ? (
        <Table columns={spec.data.columns} rows={spec.data.rows} />
      ) : spec.type === "stats" ? (
        <StatRow items={spec.data.items} />
      ) : (
        <Graph title={spec.title} nodes={spec.data.nodes} edges={spec.data.edges} />
      )}
      {open && plot && <DataTable caption={`${spec.title} data`} columns={columns} rows={rows} visible />}
    </section>
  );
}
