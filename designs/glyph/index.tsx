"use client";
// Glyph: a machine dreaming in text. A skin on the shared layout (designs/PORTING.md). The shader cortex runs behind
// the page (visible in the gaps between opaque panes); every section is a tmux pane (its ornament is the title bar);
// headings and the name decode out of scrambled glyphs once on first view; vim keys move between panes. html.lite
// and reduced motion turn the decode off and hold one still shader frame.
import { useCallback, useEffect, useRef, useState } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionId, SectionProps, Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import Clock from "@/components/site/Clock";
import { KEYS, SECTIONS } from "./data";
import { useGlyphMotion } from "./motion";
import { XP } from "./experience";
import GlyphName from "./name-fx";
import GlyphPortrait from "./portrait-fx";
import "./glyph.css";

const META = designById("glyph")!;
const PANE: Record<SectionId, [word: string, cmd: string]> = {
  work: ["WORK", "ls ~/work"], experience: ["LOG", "git log --graph"], about: ["MAN", "man rithvik"],
  play: ["BIN", "ls ~/bin"], questions: ["FAQ", "rithvik --faq"], contact: ["MAIL", "mail rpk"],
};
const HUE: Record<string, string> = { blue: "gl-hb", red: "gl-hr", amber: "" };

/** A row of tag chips. */
function Tags({ tags }: { tags: string[] }) {
  return <span className="gl-tags">{tags.map((t) => <span key={t}>{t}</span>)}</span>;
}

/** The pane's tmux title bar: window number and name, then the command it runs. */
function TitleBar({ id, index }: { id: SectionId; index: number }) {
  return <header className="gl-tbar" aria-hidden="true"><span className="gl-tw">{index + 2}:{SECTIONS[index + 1][1]}</span><span className="gl-tc"><span className="gl-dim">$</span> {PANE[id][1]}</span></header>;
}

/** The pane heading: a slash rule and the word, decoded on first view. */
function Title({ id, hid }: { id: SectionId; hid: string }) {
  return <h2 className="gl-h2" id={hid}><span className="gl-sl" aria-hidden="true">{"///"}</span><span data-scr>{PANE[id][0]}</span></h2>;
}


/** Work: a ranger-style file list with a live preview of the selected project. */
function Work({ content: C }: SectionProps) {
  const [sel, setSel] = useState(0);
  return (
    <div className="gl-ranger">
      <ol className="gl-ls">{C.projects.map((p, i) => (
        <li key={p.slug} id={`project-${p.slug}`}><button type="button" className="gl-row" data-case={p.slug} aria-current={i === sel ? "true" : undefined} onPointerEnter={() => setSel(i)} onFocus={() => setSel(i)}>
          <span className="c-name"><span data-scr>{p.slug}</span>/</span><span className="c-kind">{p.kind.toLowerCase()}</span><span className="c-go" aria-hidden="true">⏎</span>
        </button></li>
      ))}</ol>
      <div className="gl-prev">{C.projects.map((p, i) => (
        <article className="gl-pv" key={p.slug} hidden={i !== sel}>
          <h3 data-edit={`project:${p.slug}:title`}>{p.title}</h3>
          <p className="gl-pv-head" data-edit={`project:${p.slug}:headline`}>{p.headline}</p>
          <p className="gl-pv-d" data-edit={`project:${p.slug}:ctx`}>{p.ctx}</p>
          <Tags tags={p.tags} />
          <p className="gl-pv-acts"><button type="button" className="gl-btn gl-btn-hue" data-case={p.slug}><kbd>⏎</kbd>open case</button>{Object.entries(p.links).map(([k, v]) => <a key={k} className="gl-btn" href={v} target="_blank" rel="noopener">{k.toLowerCase()} ↗</a>)}</p>
        </article>
      ))}</div>
    </div>
  );
}


/** About: a man page (name, description, environment, files) and the numbers. */
function About({ content: C }: SectionProps) {
  const stackKeys = Object.entries(C.stack);
  return (
    <div className="gl-man-cols">
      <div className="gl-man-a">
        <h3 className="gl-mh">NAME</h3>
        <p className="gl-mb"><b>rithvik</b> — {C.role.toLowerCase()}</p>
        <h3 className="gl-mh">DESCRIPTION</h3>
        {C.about.map((a, i) => <p className="gl-mb" key={i} data-edit={`v7.about.${i}`}>{a}</p>)}
        <dl className="gl-nums">{C.numbers.map(([n, l], i) => <div key={l}><dt data-edit={`numbers.${i}.v`}>{n}</dt><dd data-edit={`numbers.${i}.l`}>{l}</dd></div>)}</dl>
      </div>
      <div className="gl-man-b">
        <h3 className="gl-mh">ENVIRONMENT</h3>
        <dl className="gl-env">
          <div><dt>BUILDING</dt><dd data-edit="v7.now.building">{C.now.building}</dd></div>
          <div><dt>RESEARCHING</dt><dd data-edit="v7.now.researching">{C.now.researching}</dd></div>
          <div><dt>LEARNING</dt><dd data-edit="v7.now.learning">{C.now.learning}</dd></div>
        </dl>
        <h3 className="gl-mh">FILES</h3>
        <dl className="gl-files">{C.places.map((pl) => <div key={pl.key}><dt>~/{pl.key}</dt><dd>{pl.city}</dd><dd className="gl-clk"><Clock tz={pl.tz} /></dd></div>)}</dl>
        <details className="gl-more"><summary><span className="gl-flag">--stack</span></summary><ul className="gl-tree">{stackKeys.map(([k, v], i, a) => (
          <li key={k}><span className="gl-dim">{i === a.length - 1 ? "└──" : "├──"}</span> <b>{k.toLowerCase()}/</b><ul>{v.map((x, j) => <li key={x}><span className="gl-dim">{i === a.length - 1 ? "    " : "│   "}{j === v.length - 1 ? "└──" : "├──"}</span> {x}</li>)}</ul></li>
        ))}</ul></details>
      </div>
    </div>
  );
}

/** Questions: the man page's FAQ section. */
function Questions({ content: C }: SectionProps) {
  return <dl className="gl-faq">{C.faq.map(([q, a], i) => <div key={q}><dt data-edit={`faq.${i}.q`}>{q}</dt><dd data-edit={`faq.${i}.a`}>{a}</dd></div>)}</dl>;
}

/** Contact: the address as one huge decoding line and a single hire command; both open the composer. */
function Contact({ content: C }: SectionProps) {
  const [eu, ed2] = C.links.email.split("@");
  return (
    <>
      <p className="gl-big"><button type="button" data-compose="" className="gl-big-b"><span data-scr>{eu}</span><wbr /><span className="gl-at">@</span><span data-scr>{ed2}</span></button></p>
      <ol className="gl-cmds">
        <li><button type="button" className="gl-cmd" data-compose="Internship opportunity"><span className="gl-ps" aria-hidden="true">$</span><code>sudo hire rithvik <span className="gl-dim">--role</span> <q>&quot;SWE or AI intern&quot;</q></code><span className="gl-run">compose</span></button></li>
      </ol>
    </>
  );
}

const SKIN: Skin = {
  id: "glyph",
  ...XP,
  rootClass: "gl",
  sectionClass: (id) => `gl-sec gl-pane ${HUE[SECTIONS.find(([s]) => s === id)![2]]}`.trim(),
  SectionOrnament: TitleBar,
  Title,
  sections: { work: Work, about: About, questions: Questions, contact: Contact },
  NameFx: GlyphName,
  PortraitFx: GlyphPortrait,
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
