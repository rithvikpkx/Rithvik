"use client";
// Glyph: a machine dreaming in text. A skin on the shared layout (designs/PORTING.md). The shader cortex runs behind
// the page (visible in the gaps between opaque panes); every section is a tmux pane (its ornament is the title bar);
// headings and the name decode out of scrambled glyphs once on first view; vim keys move between panes. html.lite
// and reduced motion turn the decode off and hold one still shader frame.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { SectionId, SectionProps, Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import { KEYS, SECTIONS, hash7 } from "./data";
import { useGlyphMotion } from "./motion";
import "./glyph.css";

const META = designById("glyph")!;
const logoSrc = (l: string) => (/^(\/|https?:)/.test(l) ? l : `/images/${l}`); // content stores the bare file name
const PANE: Record<SectionId, [word: string, cmd: string]> = {
  work: ["WORK", "ls ~/work"], experience: ["LOG", "git log --graph"], about: ["MAN", "man rithvik"],
  play: ["BIN", "ls ~/bin"], questions: ["ASK", "rithvik --ask"], contact: ["MAIL", "mail rpk"],
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

/** The name as one huge decoding word with the surname running up its side. */
function Name({ first, last }: { first: string; last: string }) {
  return <span className="gl-word"><span className="gl-w1" data-scr data-edit="name.first">{first}</span> <span className="gl-w2" data-edit="name.last">{last}</span></span>;
}

/** One git commit: hash, decoration, date, and a `git show` body that expands. */
function Commit({ x, lane, deco, open }: { x: DesignProps["content"]["experience"][number]; lane?: boolean; deco?: ReactNode; open?: boolean }) {
  return (
    <li className={`gl-c${lane ? " l2" : ""}`} id={`experience-${x.slug}`}>
      <span className="gl-node" aria-hidden="true">*</span>
      <details open={open}>
        <summary>
          <span className="gl-c-h"><span className="gl-hash">{hash7(x.slug)}</span>{deco && <> <span className="gl-deco">({deco})</span></>} <span className="gl-dim" data-edit={`role:${x.slug}:when`}>{x.when}</span></span>
          <span className="gl-c-s" data-edit={`role:${x.slug}:role`}>{x.role}</span>
          <span className="gl-c-o" data-edit={`role:${x.slug}:org`}>{x.org}</span>
        </summary>
        <div className="gl-c-body"><ul className="gl-dash">{x.desc.map((d, i) => <li key={i} data-edit={`role:${x.slug}:desc.${i}`}>{d}</li>)}</ul><Tags tags={x.tags} /></div>
      </details>
    </li>
  );
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

/** Experience: the roles as a git graph (a side lane for the earlier job), education as the root tag. */
function Experience({ content: C }: SectionProps) {
  const X = C.experience, ed = C.education;
  return (
    <ol className="gl-git">
      {X.slice(0, 2).map((x, i) => <Commit key={x.slug} x={x} open={i === 0} deco={i === 0 ? <><b className="d-head">HEAD</b>, <b className="d-tag">tag: now</b></> : undefined} />)}
      <li className="gl-fork" aria-hidden="true" />
      {X.slice(2).map((x, i) => <Commit key={x.slug} x={x} lane deco={i === 0 ? <b className="d-br">earlier</b> : undefined} />)}
      <li className="gl-join" aria-hidden="true" />
      <li className="gl-c gl-edu" id="education">
        <span className="gl-node" aria-hidden="true">*</span>
        <div className="gl-edu-in">
          <span className="gl-c-h"><span className="gl-hash">{hash7(ed.school)}</span> <span className="gl-deco">(<b className="d-tag">tag: education</b>)</span>{ed.grad && <> <span className="gl-dim" data-edit="edu:grad">{ed.grad}</span></>}</span>
          <div className="gl-edu-row">
            {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size logo from content */}
            <img src={logoSrc(ed.logo)} alt="" width={36} height={36} /><span className="gl-c-s" data-edit="edu:degree">{ed.degree}</span>
          </div>
          <span className="gl-c-o"><span data-edit="edu:school">{ed.school}</span> · <span data-edit="edu:focus">{ed.focus}</span></span>
        </div>
      </li>
    </ol>
  );
}


const SKIN: Skin = {
  id: "glyph",
  rootClass: "gl",
  sectionClass: (id) => `gl-sec gl-pane ${HUE[SECTIONS.find(([s]) => s === id)![2]]}`.trim(),
  SectionOrnament: TitleBar,
  Title,
  NameFx: Name,
  contactLead: "$ sudo hire rithvik",
  sections: { work: Work, experience: Experience },
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
