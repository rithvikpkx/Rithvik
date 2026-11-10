"use client";
import type { ReactNode } from "react";
import type { SectionProps } from "@/lib/designs/skin";
import { Icon } from "@/components/site/Glyph";
import Clock from "@/components/site/Clock";
import Counter from "./Counter";
import StackPlay from "./StackPlay";
import "./about.css";

const PLACE_LABEL = { home: "Home", school: "School", now: "Now" } as const;

/** A "now" tile: a small label with its icon, then the one thing (editable in place). */
function Now({ icon, label, edit, children, wide }: { icon: string; label: string; edit?: string; children: string; wide?: boolean }) {
  if (!children) return null;
  return (
    <li className={`ab-tile ab-now${wide ? " wide" : ""}`}>
      <span className="ab-k"><Icon name={icon} />{label}</span>
      <b className="ab-v" data-edit={edit}>{children}</b>
    </li>
  );
}

/** The About bento: what he is on right now, where (live clocks), the stack as tiles to toss, and a few counters. */
export default function About({ content: c }: SectionProps) {
  const city = (p: SectionProps["content"]["places"][number]): ReactNode => (p.key === "now" ? <span data-edit="v7.now.city">{c.now.city || p.city}</span> : p.city);
  return (
    <div className="ab">
      <ul className="ab-grid">
        <Now icon="cpu" label="Building" edit="v7.now.building" wide>{c.now.building}</Now>
        <Now icon="activity" label="Researching" edit="v7.now.researching">{c.now.researching}</Now>
        <Now icon="trending-up" label="Learning" edit="v7.now.learning">{c.now.learning}</Now>
        {c.places.map((p) => (
          <li key={p.key} className="ab-tile ab-place" data-key={p.key}>
            <span className="ab-k"><Icon name="map-pin" />{PLACE_LABEL[p.key]}</span>
            <b className="ab-v">{city(p)}</b>
            <Clock tz={p.key === "now" ? c.now.tz || p.tz : p.tz} className="ab-clock" />
          </li>
        ))}
      </ul>
      {Object.keys(c.stack).length > 0 && <StackPlay stack={c.stack} />}
      {c.numbers.length > 0 && (
        <ul className="ab-nums">
          {c.numbers.map(([v, l], i) => (
            <li key={l} className="ab-tile">
              <Counter className="ab-big" value={v} data-edit={`numbers.${i}.v`} />
              <span className="ab-l" data-edit={`numbers.${i}.l`}>{l}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
