"use client";
// Stipple: a hand-printed pamphlet that breathes. A skin on the shared layout (designs/PORTING.md). The shader cloud
// sits behind the page, knocked out behind every reading block by paper plates; the square lens is on the hero name
// (idle drift; its NameFx) and the dispatch plates (hover); SVG stipple filters touch display type only. Section
// titles are chapters: a stippled roman numeral, the chapter name, a folio. html.lite and reduced motion switch the
// lens, drift, seal spin and every filter off, leaving a crisp two-ink letterpress still.
import { Fragment, useRef, type ReactNode } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionId, Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import SiteLayout from "@/components/site/layout/SiteLayout";
import Mark from "@/components/site/mark/Mark";
import { DEFS } from "./defs";
import { useStippleMotion } from "./motion";
import { XP } from "./experience";
import StippleName from "./name-fx";
import StipplePortrait from "./portrait-fx";
import "./stipple.css";

const META = designById("stipple")!;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
const CHAPTER: Record<SectionId, string> = { work: "Dispatches", experience: "Errata", about: "Foreword", play: "Supplement", questions: "Correspondence", contact: "The seal" };


/** A chapter heading: stippled roman numeral, chapter name, folio. */
function Chapter({ id, index, hid }: { id: SectionId; index: number; label: string; hid: string }) {
  const plate = id === "about" || id === "questions";
  return (
    <header className={`st-chh${plate ? "" : " st-plate-sm"}`}>
      <span className="st-rom" aria-hidden="true">{ROMAN[index]}</span><h2 id={hid}>{CHAPTER[id]}</h2><span className="st-folio">— {index + 2} —</span>
    </header>
  );
}


/** Contact frame: the shared copy, then the seal; pressing it opens the message window too. */
function ContactFrame({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <button type="button" className="st-seal" data-compose="Internship opportunity" aria-label="Write a message">
        <svg viewBox="0 0 300 300" aria-hidden="true">
          <defs><path id="st-ring" d="M150 150 m-104 0 a104 104 0 1 1 208 0 a104 104 0 1 1 -208 0" /></defs>
          <g filter="url(#st-seal)"><circle cx="150" cy="150" r="138" fill="#FF3B1F" /></g>
          <circle cx="150" cy="150" r="122" fill="none" stroke="#F9CDB0" strokeWidth="1.5" strokeDasharray="1 5" strokeLinecap="round" />
          <circle cx="150" cy="150" r="84" fill="none" stroke="#F9CDB0" strokeWidth="1.2" />
          <g className="st-seal-spin"><text fontSize="14" fill="#F9CDB0"><textPath href="#st-ring" textLength="646" lengthAdjust="spacing">WRITE TO RITHVIK · OPEN TO NEW OPPORTUNITIES ·</textPath></text></g>
          <foreignObject x="104" y="104" width="92" height="92"><div style={{ width: 92, height: 92, color: "#F9CDB0" }}><Mark label="" /></div></foreignObject>
        </svg>
      </button>
    </>
  );
}

export const SKIN: Skin = {
  id: "stipple",
  ...XP,
  rootClass: "st",
  sectionClass: (id) => ({ work: "st-ch st-wide", play: "st-ch st-wide", about: "st-ch st-wide", questions: "st-ch st-wide", contact: "st-ch st-seal-sec", experience: "st-ch" })[id],
  Title: Chapter,
  NameFx: StippleName,
  PortraitFx: StipplePortrait,
  ContactFrame,
  projectArt: { palette: ["#F9CDB0", "#17110E", "#FF3B1F", "#2B44B8"], params: { hole: 0.3, rest: 5, stroke: 1.15 } },
};

/** The whole Stipple site: the shared layout printed on peach stock over a breathing stipple cloud. */
export default function Stipple({ content }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  useStippleMotion(root);
  const hero = <><span className="st-reg st-reg-tl" aria-hidden="true" /><span className="st-reg st-reg-tr" aria-hidden="true" /><span className="st-reg st-reg-bl" aria-hidden="true" /><span className="st-reg st-reg-br" aria-hidden="true" /></>;
  return (
    <SiteLayout content={content} skin={SKIN} rootRef={root} hero={hero}>
      <ShaderCanvas spec={META.shader} dark={META.dark} />
      <svg className="st-defs" width="0" height="0" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: DEFS }} />
    </SiteLayout>
  );
}
