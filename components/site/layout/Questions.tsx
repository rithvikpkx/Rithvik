"use client";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { SectionProps } from "@/lib/designs/skin";
import { Icon } from "@/components/site/Glyph";
import { useSite } from "@/components/site/SiteProvider";
import { useWarp } from "@/components/site/fx/warp/useWarp";
import "./questions.css";

const pad = (n: number) => String(n).padStart(2, "0");
/** One recruiter question as a card that flips over to its answer in place. */
function Tile({ i, q, a }: { i: number; q: string; a: string }) {
  const [flipped, setFlipped] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  useWarp(ref); // the card bows away from the cursor; a click (the flip) pauses it so the 3D turn is never clipped
  const id = `qz-a-${i}`;
  return (
    <li className="qz-tile" style={{ "--i": i } as CSSProperties} data-flipped={flipped || undefined} ref={ref}>
      <div className="qz-card">
        <button type="button" className="qz-face qz-front" aria-expanded={flipped} aria-controls={id} onClick={() => setFlipped(true)} inert={flipped}>
          <span className="qz-n">{pad(i + 1)}</span>
          <span className="qz-q" data-edit={`faq.${i}.q`}>{q}</span>
          <span className="qz-hint"><Icon name="rotate-ccw" />Flip for the answer</span>
        </button>
        <div className="qz-face qz-back" id={id} inert={!flipped}>
          <span className="qz-n">{pad(i + 1)}</span>
          <p className="qz-a" data-edit={`faq.${i}.a`}>{a}</p>
          <button type="button" className="qz-flipback" onClick={() => setFlipped(false)}><Icon name="rotate-ccw" />Back</button>
        </div>
      </div>
    </li>
  );
}

/** The fourth card: same shape, but a field. Enter sends the question into the agent dock; the card's rect is where the flight starts. */
function AskTile({ i }: { i: number }) {
  const { openAgent } = useSite();
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  useWarp(ref);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const send = () => {
    const q = text.trim();
    if (!q || sent || !ref.current) return;
    openAgent(q, { originRect: ref.current.getBoundingClientRect() });
    setText(""); setSent(true);
    timer.current = setTimeout(() => setSent(false), 2600); // long enough to watch the question leave
  };
  const key = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
  };
  return (
    <li className="qz-tile qz-ask" style={{ "--i": i } as CSSProperties} data-sent={sent || undefined} ref={ref}>
      <div className="qz-card">
        <form className="qz-face qz-front" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <span className="qz-n">{pad(i + 1)}</span>
          <label className="qz-field">
            <span className="sr-only">Ask your own question</span>
            <textarea className="qz-q qz-input" rows={3} maxLength={500} placeholder="Ask your own…" value={text} readOnly={sent}
              onChange={(e) => setText(e.target.value)} onKeyDown={key} />
          </label>
          <span className="qz-sent" role="status">{sent ? <><Icon name="chevron-down" />Sent to the agent below</> : ""}</span>
          <span className="qz-row">
            <span className="qz-hint"><kbd>Enter</kbd> asks the agent</span>
            <button type="submit" className="qz-go" disabled={!text.trim() || sent} aria-label="Ask the agent"><Icon name="arrow-up" /></button>
          </span>
        </form>
      </div>
    </li>
  );
}

/** Three flip cards with the first three questions from the content, then a card of the same shape that takes your own. */
export default function Questions({ content: c }: SectionProps) {
  return (
    <ul className="qz">
      {c.faq.slice(0, 3).map(([q, a], i) => <Tile key={q} i={i} q={q} a={a} />)}
      <AskTile i={Math.min(3, c.faq.length)} />
    </ul>
  );
}
