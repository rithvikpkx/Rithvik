"use client";
// Glyph: a machine dreaming in text. A skin on the shared layout (designs/PORTING.md). The shader cortex runs behind
// the page (visible in the gaps between opaque panes); every section is a tmux pane (its ornament is the title bar);
// headings and the name decode out of scrambled glyphs once on first view; vim keys move between panes. html.lite
// and reduced motion turn the decode off and hold one still shader frame.
import { useCallback, useEffect, useRef, useState } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionId, Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import { KEYS, SECTIONS } from "./data";
import { useGlyphMotion } from "./motion";
import { XP } from "./experience";
import GlyphName from "./name-fx";
import GlyphPortrait from "./portrait-fx";
import "./glyph.css";

const META = designById("glyph")!;
const PANE: Record<SectionId, [word: string, cmd: string]> = {
  work: ["WORK", "ls ~/work"], experience: ["LOG", "git log --graph"], about: ["MAN", "man rithvik"],
  play: ["BIN", "ls ~/bin"], questions: ["ASK", "rithvik --ask"], contact: ["MAIL", "mail rpk"],
};
const HUE: Record<string, string> = { blue: "gl-hb", red: "gl-hr", amber: "" };


/** The pane's tmux title bar: window number and name, then the command it runs. */
function TitleBar({ id, index }: { id: SectionId; index: number }) {
  return <header className="gl-tbar" aria-hidden="true"><span className="gl-tw">{index + 2}:{SECTIONS[index + 1][1]}</span><span className="gl-tc"><span className="gl-dim">$</span> {PANE[id][1]}</span></header>;
}

/** The pane heading: a slash rule and the word, decoded on first view. */
function Title({ id, hid }: { id: SectionId; hid: string }) {
  return <h2 className="gl-h2" id={hid}><span className="gl-sl" aria-hidden="true">{"///"}</span><span data-scr>{PANE[id][0]}</span></h2>;
}




export const SKIN: Skin = {
  id: "glyph",
  ...XP,
  rootClass: "gl",
  sectionClass: (id) => `gl-sec gl-pane ${HUE[SECTIONS.find(([s]) => s === id)![2]]}`.trim(),
  SectionOrnament: TitleBar,
  Title,
  NameFx: GlyphName,
  PortraitFx: GlyphPortrait,
  contactLead: "$ sudo hire rithvik",
  projectArt: { palette: ["#050505", "#EDEDED", "#FFC400", "#3BA4FF"], params: { hole: 0, rest: 0, lift: 14, stroke: 0.9 } },
};

/** The whole Glyph site: the shared layout as tmux panes over a dreaming text cortex. */
export default function Glyph({ content }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  const [keys, setKeys] = useState(false);
  const toggleKeys = useCallback((v?: boolean) => setKeys((p) => (v === undefined ? !p : v)), []);
  useGlyphMotion(root, toggleKeys);

  // the shortcuts card (press ?) closes on any click outside it
  useEffect(() => {
    if (!keys) return;
    const off = (ev: MouseEvent) => { if (!(ev.target as Element).closest("#gl-keys")) setKeys(false); };
    document.addEventListener("click", off);
    return () => document.removeEventListener("click", off);
  }, [keys]);

  return (
    <SiteLayout content={content} skin={SKIN} rootRef={root}>
      <ShaderCanvas spec={META.shader} dark={META.dark} />
      <span className="gl-msg" id="gl-msg" aria-live="polite" />
      <div className="gl-keys" id="gl-keys" role="dialog" aria-label="Keyboard shortcuts" hidden={!keys}><dl>{KEYS.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>
    </SiteLayout>
  );
}
