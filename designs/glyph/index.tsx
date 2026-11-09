"use client";
// Glyph: a machine dreaming in text (port of docs/mockups/v7/themes/glyph.js; see designs/PORTING.md).
// Where each effect lives: the shader cortex at full intensity on the first screen, half off the right edge
// (visible only in the gaps between opaque panes) in the sections; glyph decode on headings once on first
// view; the typing prompt only while the hero is on screen; vim quips only on unmapped keys. html.lite and
// reduced motion turn the decode and typing off and hold one still shader frame.
import { useCallback, useRef, useState, useEffect, type FormEvent, type ReactNode } from "react";
import type { DesignProps } from "@/lib/designs/types";
import { designById } from "@/lib/designs/registry";
import { PLAY } from "@/lib/play/games";
import { useSite } from "@/components/site/SiteProvider";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import Clock from "@/components/site/Clock";
import Portrait from "@/components/site/portrait/Portrait";
import Mark from "@/components/site/mark/Mark";
import KnowledgeGraph from "@/components/site/graph/KnowledgeGraph";
import { ASKS, KEYS, SECTIONS, hash7 } from "./data";
import { useGlyphMotion } from "./motion";
import "./glyph.css";

const META = designById("glyph")!;
const logoSrc = (l: string) => (/^(\/|https?:)/.test(l) ? l : `/images/${l}`); // content stores the bare file name
const win = (i: number) => `${i + 1}:${SECTIONS[i][1]}`;

/** A row of tag chips. */
function Tags({ tags }: { tags: string[] }) {
  return <span className="gl-tags">{tags.map((t) => <span key={t}>{t}</span>)}</span>;
}

/** One tmux pane: a title bar (window, command, a short note) and a body with generous space. */
function Pane({ id, hue, win: w, cmd, note, word, cls, children }: { id: string; hue: string; win: string; cmd: string; note?: string; word?: string; cls?: string; children: ReactNode }) {
  return (
    <section id={id} className={`gl-sec gl-pane${cls ? " " + cls : ""}`} data-hue={hue} aria-labelledby={`${id}-h`}>
      <header className="gl-tbar"><span className="gl-tw">{w}</span><span className="gl-tc"><span className="gl-dim">$</span> {cmd}</span>{note && <span className="gl-tn">{note}</span>}</header>
      <div className="gl-pb">{word && <h2 className="gl-h2" id={`${id}-h`}><span className="gl-sl" aria-hidden="true">{"///"}</span><span data-scr>{word}</span></h2>}{children}</div>
    </section>
  );
}

/** One git commit: hash, decoration, date, and a `git show` body that expands. */
function Commit({ x, lane, deco, open }: { x: DesignProps["content"]["experience"][number]; lane?: boolean; deco?: ReactNode; open?: boolean }) {
  return (
    <li className={`gl-c${lane ? " l2" : ""}`} id={`experience-${x.slug}`}>
      <span className="gl-node" aria-hidden="true">*</span>
      <details open={open}>
        <summary>
          <span className="gl-c-h"><span className="gl-hash">{hash7(x.slug)}</span>{deco && <> <span className="gl-deco">({deco})</span></>} <span className="gl-dim">{x.when}</span></span>
          <span className="gl-c-s">{x.role}</span>
          <span className="gl-c-o">{x.org}</span>
        </summary>
        <div className="gl-c-body"><ul className="gl-dash">{x.desc.map((d, i) => <li key={i}>{d}</li>)}</ul><Tags tags={x.tags} /></div>
      </details>
    </li>
  );
}

/** One contact command: a link or a button styled as a shell line. */
function Cmd({ href, hook, cmd, label }: { href?: string; hook?: Record<string, string>; cmd: ReactNode; label: string }) {
  const inner = <><span className="gl-ps" aria-hidden="true">$</span><code>{cmd}</code><span className="gl-run">{label}</span></>;
  return <li>{href ? <a className="gl-cmd" href={href} target="_blank" rel="noopener">{inner}</a> : <button type="button" className="gl-cmd" {...hook}>{inner}</button>}</li>;
}

/** The whole Glyph site. */
export default function Glyph({ content: C }: DesignProps) {
  const { openAgent } = useSite();
  const root = useRef<HTMLDivElement>(null);
  const [keys, setKeys] = useState(false);
  const [sel, setSel] = useState(0);
  const toggleKeys = useCallback((v?: boolean) => setKeys((p) => (v === undefined ? !p : v)), []);
  useGlyphMotion(root, toggleKeys);

  // the shortcuts card closes on any click outside it
  useEffect(() => {
    if (!keys) return;
    const off = (ev: MouseEvent) => { if (!(ev.target as Element).closest("#gl-keys, #gl-help")) setKeys(false); };
    document.addEventListener("click", off);
    return () => document.removeEventListener("click", off);
  }, [keys]);

  const ask = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const inp = e.currentTarget.elements.namedItem("q") as HTMLInputElement, v = inp.value.trim();
    inp.value = ""; inp.blur(); openAgent(v || undefined);
  };

  const X = C.experience, ed = C.education;
  const [eu, ed2] = C.links.email.split("@");
  const progs = PLAY;
  const stackKeys = Object.entries(C.stack);

  return (
    <main className="stage" id="stage" tabIndex={-1}>
      <div className="gl" id="gl" ref={root}>
        <nav className="gl-tmux" aria-label="Sections">
          <a className="gl-sess" href="#top" data-gl-go="0" aria-label="Top"><Mark className="gl-mk" label="" /></a>
          <ol className="gl-wins">{SECTIONS.map(([id, nm], i) => <li key={id}><a href={`#${id}`} data-gl-go={i} aria-current={i === 0 ? "true" : undefined}><b>{i + 1}</b><span>:{nm}</span></a></li>)}</ol>
          <span className="gl-tfill" aria-hidden="true" />
          <span className="gl-msg" id="gl-msg" aria-live="polite" />
          <button type="button" className="gl-help" id="gl-help" aria-expanded={keys} aria-controls="gl-keys" onClick={() => toggleKeys()}><kbd>?</kbd><span>keys</span></button>
        </nav>
        <div className="gl-keys" id="gl-keys" role="dialog" aria-label="Keyboard shortcuts" hidden={!keys}><dl>{KEYS.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>

        <section id="top" className="gl-sec gl-hero" data-hue="amber" aria-labelledby="gl-name">
          <p className="gl-meta"><span><span className="gl-led" aria-hidden="true" />open to SWE and AI internships</span><span>{C.now.city} · <Clock tz={C.now.tz} /></span></p>
          <div className="gl-stage">
            <p className="gl-cond">{C.thesis.map((t) => <span key={t} data-scr>{t}</span>)}</p>
            <div className="gl-card">
              <p className="gl-card-p">{C.line}</p>
              <form className="gl-ask" id="gl-ask" autoComplete="off" onSubmit={ask}>
                <span className="gl-ask-p" aria-hidden="true">❯</span>
                <label className="sr-only" htmlFor="gl-ask-in">Ask the agent about {C.first}</label>
                <input id="gl-ask-in" name="q" className="gl-ask-in" type="text" maxLength={500} placeholder={ASKS[0]} spellCheck={false} />
                <button className="gl-ask-go" type="submit" aria-label="Ask">⏎</button>
              </form>
              <div className="gl-acts">
                <button type="button" className="gl-btn" data-resume=""><kbd>r</kbd>resume</button>
                <button type="button" className="gl-btn gl-btn-hue" data-compose=""><kbd>m</kbd>get in touch</button>
              </div>
            </div>
          </div>
          <h1 className="gl-word" id="gl-name" aria-label={C.name}><span className="gl-w1" data-scr aria-hidden="true">{C.first.toUpperCase()}</span><span className="gl-w2" aria-hidden="true">{C.last.toUpperCase()}</span></h1>
        </section>

        <Pane id="whoami" hue="amber" win={win(0)} cmd="whoami" cls="gl-who">
          <div className="gl-who-pt"><Portrait id="glyph" /></div>
          <div className="gl-who-r">
            <p className="gl-who-h" id="whoami-h"><span data-scr>{C.first.toLowerCase()}</span><span className="gl-caret" aria-hidden="true" /></p>
            <p className="gl-who-s">{C.status}</p>
            <dl className="gl-nums">{C.numbers.map(([n, l]) => <div key={l}><dt>{n}</dt><dd>{l}</dd></div>)}</dl>
          </div>
        </Pane>

        <Pane id="work" hue="amber" win={win(1)} cmd="ls ~/work" note={`${C.projects.length} entries`} word="WORK">
          <div className="gl-ranger">
            <ol className="gl-ls">{C.projects.map((p, i) => (
              <li key={p.slug}><button type="button" className="gl-row" data-case={p.slug} aria-current={i === sel ? "true" : undefined} onPointerEnter={() => setSel(i)} onFocus={() => setSel(i)}>
                <span className="c-name"><span data-scr>{p.slug}</span>/</span><span className="c-kind">{p.kind.toLowerCase()}</span><span className="c-go" aria-hidden="true">⏎</span>
              </button></li>
            ))}</ol>
            <div className="gl-prev">{C.projects.map((p, i) => (
              <article className="gl-pv" key={p.slug} hidden={i !== sel}>
                <h3>{p.title}</h3>
                <p className="gl-pv-head">{p.headline}</p>
                <p className="gl-pv-d">{p.ctx}</p>
                <Tags tags={p.tags} />
                <p className="gl-pv-acts"><button type="button" className="gl-btn gl-btn-hue" data-case={p.slug}><kbd>⏎</kbd>open case</button>{Object.entries(p.links).map(([k, v]) => <a key={k} className="gl-btn" href={v} target="_blank" rel="noopener">{k.toLowerCase()} ↗</a>)}</p>
              </article>
            ))}</div>
          </div>
        </Pane>

        <Pane id="experience" hue="blue" win={win(2)} cmd="git log --graph" note="click a commit to show it" word="LOG">
          <ol className="gl-git">
            {X.slice(0, 2).map((x, i) => <Commit key={x.slug} x={x} open={i === 0} deco={i === 0 ? <><b className="d-head">HEAD</b>, <b className="d-tag">tag: now</b></> : undefined} />)}
            <li className="gl-fork" aria-hidden="true" />
            {X.slice(2).map((x, i) => <Commit key={x.slug} x={x} lane deco={i === 0 ? <b className="d-br">code-ninjas</b> : undefined} />)}
            <li className="gl-join" aria-hidden="true" />
            <li className="gl-c gl-edu" id="education">
              <span className="gl-node" aria-hidden="true">*</span>
              <div className="gl-edu-in">
                <span className="gl-c-h"><span className="gl-hash">{hash7(ed.school)}</span> <span className="gl-deco">(<b className="d-tag">tag: education</b>)</span>{ed.grad && <> <span className="gl-dim">{ed.grad}</span></>}</span>
                <div className="gl-edu-row">
                  {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size logo from content */}
                  <img src={logoSrc(ed.logo)} alt="" width={36} height={36} /><span className="gl-c-s">{ed.degree}</span>
                </div>
                <span className="gl-c-o">{ed.school} · {ed.focus}</span>
              </div>
            </li>
          </ol>
        </Pane>

        <Pane id="about" hue="blue" win={win(3)} cmd="man rithvik" note="section 1" word="MAN" cls="gl-man">
          <div className="gl-man-cols">
            <div className="gl-man-a">
              <h3 className="gl-mh">NAME</h3>
              <p className="gl-mb"><b>rithvik</b> — {C.role.toLowerCase()}</p>
              <h3 className="gl-mh">DESCRIPTION</h3>
              {C.about.map((a, i) => <p className="gl-mb" key={i}>{a}</p>)}
            </div>
            <div className="gl-man-b">
              <h3 className="gl-mh">ENVIRONMENT</h3>
              <dl className="gl-env">
                <div><dt>BUILDING</dt><dd>{C.now.building}</dd></div>
                <div><dt>RESEARCHING</dt><dd>{C.now.researching}</dd></div>
                <div><dt>LEARNING</dt><dd>{C.now.learning}</dd></div>
              </dl>
              <h3 className="gl-mh">FILES</h3>
              <dl className="gl-files">{C.places.map((pl) => <div key={pl.key}><dt>~/{pl.key}</dt><dd>{pl.city}</dd><dd className="gl-clk"><Clock tz={pl.tz} /></dd></div>)}</dl>
              <details className="gl-more"><summary><span className="gl-flag">--stack</span></summary><ul className="gl-tree">{stackKeys.map(([k, v], i, a) => (
                <li key={k}><span className="gl-dim">{i === a.length - 1 ? "└──" : "├──"}</span> <b>{k.toLowerCase()}/</b><ul>{v.map((x, j) => <li key={x}><span className="gl-dim">{i === a.length - 1 ? "    " : "│   "}{j === v.length - 1 ? "└──" : "├──"}</span> {x}</li>)}</ul></li>
              ))}</ul></details>
              <details className="gl-more"><summary><span className="gl-flag">--faq</span></summary><dl className="gl-faq">{C.faq.map(([q, a]) => <div key={q}><dt>{q}</dt><dd>{a}</dd></div>)}</dl></details>
            </div>
          </div>
        </Pane>

        <Pane id="graph" hue="blue" win={win(4)} cmd="rithvik --graph" note="hover to trace · click to open" word="MAP" cls="gl-map">
          <KnowledgeGraph id="glyph" />
        </Pane>

        <Pane id="play" hue="red" win={win(5)} cmd="ls ~/bin" note="for fun" word="BIN">
          <ol className="gl-bin">{progs.map((p) => (
            <li key={p.id}><button type="button" className="gl-prog" data-play={p.id}>
              <span className="gl-prog-x"><span className="gl-dim">./</span>{p.id}</span>
              <span className="gl-prog-d">{p.desc || p.name}</span>
            </button></li>
          ))}</ol>
        </Pane>

        <Pane id="contact" hue="red" win={win(6)} cmd="mail rpk" note="inbox open" cls="gl-mail">
          <h2 className="gl-big" id="contact-h"><button type="button" data-compose="" className="gl-big-b"><span data-scr>{eu}</span><wbr /><span className="gl-at">@</span><span data-scr>{ed2}</span></button></h2>
          <ol className="gl-cmds">
            <Cmd hook={{ "data-compose": "Internship opportunity" }} cmd={<>sudo hire rithvik <span className="gl-dim">--role</span> <q>&quot;SWE or AI intern&quot;</q></>} label="compose" />
            <Cmd href={C.links.github} cmd={`open ${C.links.github.replace(/^https?:\/\//, "")}`} label="open" />
            <Cmd href={C.links.linkedin} cmd={`open ${C.links.linkedin.replace(/^https?:\/\//, "").replace(/\/$/, "")}`} label="open" />
            <Cmd hook={{ "data-resume": "" }} cmd="less resume.pdf" label="view" />
            <Cmd hook={{ "data-copy": C.links.email }} cmd={`pbcopy <<< ${C.links.email}`} label="copy" />
          </ol>
        </Pane>

        <footer className="gl-foot"><span className="gl-foot-mk" aria-hidden="true"><Mark className="gl-mk" label="" /></span><p><span className="gl-dim">[process completed]</span> {C.name}</p></footer>
      </div>
      <ShaderCanvas spec={META.shader} dark={META.dark} />
    </main>
  );
}
