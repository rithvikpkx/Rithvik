"use client";
import type { ReactNode, Ref } from "react";
import type { Content } from "@/lib/content/types";
import { SECTIONS, SECTION_LABELS, type SectionId, type Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import type { Palette } from "@/lib/art/art";
import Mark from "@/components/site/mark/Mark";
import Tether from "@/components/site/tether/Tether";
import Header from "./Header";
import { DEFAULT_SECTIONS } from "./sections";
import "./layout.css";

type Props = {
  content: Content;
  skin: Skin;
  /** The page root, for a design's motion hook. */
  rootRef?: Ref<HTMLDivElement>;
  /** The look's layer inside the hero, behind the copy: a shader host, a viewfinder, a themed control. */
  hero?: ReactNode;
  /** Drawn behind the hero portrait, inside its box (a holo card, a camera feed). */
  portraitBackdrop?: ReactNode;
  /** Root-level extras: the ShaderCanvas, SVG defs, cursor trails. */
  children?: ReactNode;
};

/** The one page composition every look renders: sticky header, hero, the sections in a fixed order, footer.
 *  A design is a `Skin` (lib/designs/skin.ts) plus CSS; it never re-implements this markup. */
export default function SiteLayout({ content: c, skin, rootRef, hero, portraitBackdrop, children }: Props) {
  return (
    <div className={`ly ${skin.rootClass ?? ""}`.trim()} data-skin={skin.id} ref={rootRef}>
      <a className="skip" href="#work">Skip to content</a>
      <style dangerouslySetInnerHTML={{ __html: artTokens(skin) }} />
      {children /* first, so fixed layers (the shader) paint beneath the page at equal z-index */}
      <Header name={c.name} skin={skin} />
      <main className="stage" id="stage" tabIndex={-1}>
        <Hero content={c} skin={skin} backdrop={portraitBackdrop}>{hero}</Hero>
        {SECTIONS.map((id, i) => <Section key={id} id={id} index={i} content={c} skin={skin} />)}
      </main>
      <Footer content={c} skin={skin} />
    </div>
  );
}

/** A look's project-art palette: the skin's, else the registry swatch, else the page's own tokens (Classic). */
export const artPalette = (skin: Skin): Palette =>
  skin.projectArt?.palette ?? designById(skin.id)?.swatch ?? ["var(--ly-soft)", "var(--ui-fg)", "var(--ui-accent)", "var(--ui-muted)"];

/** The palette as root tokens (--art-0..3), so the Work body and the case sheet (rendered outside this tree) agree. */
const artTokens = (skin: Skin) => `:root[data-design="${skin.id}"]{${artPalette(skin).map((c, i) => `--art-${i}:${c}`).join(";")}}`;

/** First screen: the name, the status and the one line under it, and the tethered portrait. */
function Hero({ content: c, skin, backdrop, children }: { content: Content; skin: Skin; backdrop?: ReactNode; children?: ReactNode }) {
  const Name = skin.NameFx;
  return (
    <section className="ly-hero" id="top" aria-labelledby="top-h">
      {children}
      <div className="ly-hero-in">
        <div className="ly-hero-copy">
          <h1 className="ly-name" id="top-h">
            {Name ? <Name first={c.first} last={c.last} /> : <><span className="ly-first" data-edit="name.first">{c.first}</span> <span className="ly-last" data-edit="name.last">{c.last}</span></>}
          </h1>
          <p className="ly-status" data-edit="v7.status">{c.status}</p>
          <p className="ly-line" data-edit="v7.line">{c.line}</p>
        </div>
        <div className="ly-hero-pt">{backdrop}<Tether id="hero" fx={skin.PortraitFx} /></div>
      </div>
    </section>
  );
}

/** One anchored section: the skin's ornament, a one-word title, then the skin's body or the shared default. */
function Section({ id, index, content, skin }: { id: SectionId; index: number; content: Content; skin: Skin }) {
  const Body = skin.sections?.[id] ?? DEFAULT_SECTIONS[id];
  const { SectionOrnament: Ornament, Title } = skin;
  const label = skin.labels?.[id] ?? SECTION_LABELS[id], hid = `${id}-h`;
  return (
    <section className={skin.sectionClass?.(id) ?? "ly-sec ly-wrap"} id={id} aria-labelledby={hid}>
      {Ornament && <Ornament id={id} index={index} />}
      {Title ? <Title id={id} index={index} label={label} hid={hid} /> : <h2 className={`ly-title ${skin.titleClass ?? ""}`.trim()} id={hid}>{label}</h2>}
      <div className="ly-body"><Body content={content} skin={skin} /></div>
    </section>
  );
}

/** The same cluster as the hero, smaller, then one quiet line: mark, name, year, and three tiny links. */
function Footer({ content: c }: { content: Content; skin: Skin }) {
  return (
    <footer className="ly-foot">
      <div className="ly-foot-pt"><Tether id="foot" /></div>
      <div className="ly-foot-mini">
        <span className="ly-foot-who"><span className="ly-mk"><Mark kind="tiny" label="" /></span>{c.name}</span>
        <span>© {new Date().getFullYear()}</span>
        <nav aria-label="Site"><a href="/privacy">Privacy</a>·<a href="/status">Status</a>·<a href="/buffett">For Warren Buffett</a></nav>
      </div>
    </footer>
  );
}
