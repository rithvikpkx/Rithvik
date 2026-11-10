"use client";
// Glyph's Experience pieces: box-drawing pipes with a packet running down them, and the education object as
// extruded ASCII art (the Purdue P) whose depth layer shifts with the pointer.
import type { Content } from "@/lib/content/types";
import type { Skin } from "@/lib/designs/skin";
import { GLYPH } from "@/components/site/layout/purdue-grid";
import { hash7 } from "./data";
import "./experience.css";

const PIPE = "╎".repeat(160), FAT = "┃".repeat(160);
// the true silhouette of the Purdue P sampled into a character grid: outline, ring and face get different densities
const ART = GLYPH.map((r) => r.replace(/[.orf]/g, (c) => ({ ".": " ", o: "▒", r: "░", f: "█" })[c]!)).join("\n");

/** Dim pipe glyphs; heavy amber ones behind the scroll front, a packet glyph riding it. */
function Pipe() {
  return (
    <>
      <span className="xp-track gx-pipe">{PIPE}</span>
      <span className="xp-fill gx-pipe gx-hot">{FAT}</span>
      <i className="xp-head"><b className="gx-pkt">▼</b></i>
    </>
  );
}

/** The Purdue P in text: a dim copy behind as its depth, the lit copy in front, a commit line under it. */
function AsciiCap({ education: e }: { education: Content["education"] }) {
  return (
    <div className="gx-art">
      <pre className="gx-cap gx-depth">{ART}</pre>
      <pre className="gx-cap gx-face">{ART}</pre>
      <p className="gx-tag"><span>{hash7(e.school)}</span> (tag: education)</p>
    </div>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: Pipe, EducationObject: AsciiCap };
