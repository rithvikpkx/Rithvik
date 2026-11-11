"use client";
// Blueprint: the whole site as one cyanotype drawing set. A skin on the shared layout (designs/PORTING.md).
// The sheet is the shader (fixed, full screen, travelling with the page); a crisp drafting grid rides on it in CSS.
// Each section is a sheet: a zone-ruled border, a title block (drawing no., scale, rev, sheet x of y) and a detail-
// bubble title, plotted as it scrolls in. The hero carries registration marks, a live dimension on the name, a leader
// to the portrait and the set's title block; a fine pointer gets the draftsman's cursor. Contact is the revision
// block. html.lite / reduced motion: a still sheet, every line already drawn, no cursor.
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { DesignProps } from "@/lib/designs/types";
import { SECTIONS, type SectionId, type Skin } from "@/lib/designs/skin";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import { META } from "./meta";
import { sheetFor } from "./drafting";
import { useBlueprintMotion } from "./motion";
import { XP } from "./experience";
import BlueprintName from "./name-fx";
import BlueprintPortrait from "./portrait-fx";
import "./blueprint.css";

const ZONES = [1, 2, 3, 4, 5, 6, 7, 8];

/** Section ornament: the sheet's zone-ruled top border and its title block, plotted when the sheet scrolls in. */
function Sheet({ index }: { id: SectionId; index: number }) {
  const s = sheetFor(index, SECTIONS.length);
  return (
    <div className="bp-sheet bp-draw" aria-hidden="true">
      <div className="bp-zone">{ZONES.map((z) => <i key={z}><b>{z}</b></i>)}</div>
      <dl className="bp-tb">
        <div><dt>Dwg no.</dt><dd>{s.dwg}</dd></div>
        <div><dt>Scale</dt><dd>{s.scale}</dd></div>
        <div><dt>Rev</dt><dd>{s.rev}</dd></div>
        <div><dt>Sheet</dt><dd>{s.sheet}</dd></div>
      </dl>
    </div>
  );
}

/** A drawing title: the detail bubble (number over sheet), the lettered title and its heavy-over-light underline. */
function Title({ index, label, hid }: { id: SectionId; index: number; label: string; hid: string }) {
  return (
    <div className="bp-ttl bp-draw">
      <span className="bp-bub" aria-hidden="true"><b>{index + 1}</b><i>{sheetFor(index, SECTIONS.length).dwg}</i></span>
      <h2 className="ly-title bp-h2" id={hid}>{label}</h2>
      <svg className="bp-ul" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path pathLength={1} d="M0 2H100" /><path pathLength={1} d="M0 6.5H100" />
      </svg>
    </div>
  );
}

const noop = () => () => {};
const today = () => new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

/** Contact frame: the revision block. Earlier revisions are struck through; the current one (redline delta) carries the
 *  shared copy and the contact cloud, dated today. */
function ContactFrame({ children }: { children: ReactNode }) {
  const date = useSyncExternalStore(noop, today, () => "");
  return (
    <div className="bp-rev bp-draw">
      <div className="bp-rev-row bp-rev-hd" aria-hidden="true"><span>Rev</span><span>Description</span><span>Date</span><span>By</span></div>
      <div className="bp-rev-row bp-rev-old" aria-hidden="true"><span>A</span><span>Issued for review</span><span>—</span><span>RPK</span></div>
      <div className="bp-rev-row bp-rev-old" aria-hidden="true"><span>B</span><span>Revised per comments</span><span>—</span><span>RPK</span></div>
      <div className="bp-rev-row bp-rev-now">
        <span className="bp-delta" aria-hidden="true"><b>C</b></span>
        <div className="bp-rev-d">{children}</div>
        <span className="bp-rev-date" aria-hidden="true">{date}</span>
        <span aria-hidden="true">RPK</span>
      </div>
    </div>
  );
}

export const SKIN: Skin = {
  id: "blueprint",
  ...XP,
  rootClass: "bp",
  labels: { work: "Plans", experience: "Revisions", about: "Specs", play: "Workshop", questions: "Notes" },
  sectionClass: (id) => `ly-sec ly-wrap bp-sec bp-sec-${id}`,
  Title,
  SectionOrnament: Sheet,
  NameFx: BlueprintName,
  PortraitFx: BlueprintPortrait,
  ContactFrame,
  contactLead: "Issued for construction",
  projectArt: { palette: ["var(--bp-paper2, #0C3466)", "var(--bp-ink, #EAF3FF)", "var(--bp-red, #FFB09A)", "var(--bp-cyan, #7FC4FF)"], params: { hole: 0.3, stroke: 0.9 } },
};

/** The whole Blueprint site: the shared layout on one travelling sheet, with the hero's drafting marks and the cursor. */
export default function Blueprint({ content }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  useBlueprintMotion(root);
  // the sheet's first scroll offset (a deep link may land mid-page); later ones are set by motion.ts
  const [uniforms] = useState(() => ({ u_sy: typeof window === "undefined" ? 0 : scrollY / Math.max(1, innerHeight) }));
  const hero = (
    <div className="bp-hero" aria-hidden="true">
      <i className="bp-reg" /><i className="bp-reg" /><i className="bp-reg" /><i className="bp-reg" />
      <div className="bp-dim bp-dim-name bp-draw"><i /><i /><span className="bp-dim-v" /></div>
      <div className="bp-lead bp-draw">
        <svg viewBox="0 0 168 64" focusable="false"><path pathLength={1} d="M168 64 L132 30 H0" /><path className="bp-lead-a" d="M168 64 l-9.6 -3.2 l3.4 -3.6 z" /></svg>
        <span className="bp-lead-t"><b>Detail A</b>portrait</span>
      </div>
      <dl className="bp-set bp-draw">
        <div className="bp-set-t"><dt>Project</dt><dd>{content.name}</dd></div>
        <div><dt>Dwg no.</dt><dd>BP-00</dd></div>
        <div><dt>Scale</dt><dd>1:1</dd></div>
        <div><dt>Sheet</dt><dd>0 OF {SECTIONS.length}</dd></div>
      </dl>
    </div>
  );
  return (
    <SiteLayout content={content} skin={SKIN} rootRef={root} hero={hero}>
      <ShaderCanvas spec={META.shader} dark={META.dark} uniforms={uniforms} />
      <div className="bp-cur" aria-hidden="true"><i className="bp-cur-x" /><i className="bp-cur-y" /><span className="bp-cur-r" /><span className="bp-meas" /></div>
    </SiteLayout>
  );
}
