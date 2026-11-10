"use client";
// Glyph's Experience pieces: box-drawing pipes with a packet running down them, and the education object as
// extruded ASCII art (a mortarboard) whose depth layer shifts with the pointer.
import type { Content } from "@/lib/content/types";
import type { Skin } from "@/lib/designs/skin";
import { hash7 } from "./data";
import "./experience.css";

const PIPE = "╎".repeat(160), FAT = "┃".repeat(160);
const CAP = String.raw`
                .-*-.
            .-*'     '*-.
        .-*'             '*-.
    .-*'                     '*-.
   '*-.                       .-*'|
       '*-.               .-*'    |
       |   '*-.       .-*'   |    |
       |       '*-.-*'       |   [#]
       |                     |   |#|
        '*-.             .-*'    '-'
            '*-..___..-*'`.slice(1);

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

/** The mortarboard in text: a dim copy behind as its depth, the lit copy in front, a commit line under it. */
function AsciiCap({ education: e }: { education: Content["education"] }) {
  return (
    <div className="gx-art">
      <pre className="gx-cap gx-depth">{CAP}</pre>
      <pre className="gx-cap gx-face">{CAP}</pre>
      <p className="gx-tag"><span>{hash7(e.school)}</span> (tag: education)</p>
    </div>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: Pipe, EducationObject: AsciiCap };
