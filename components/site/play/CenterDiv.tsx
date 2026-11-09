"use client";
import { useEffect, useRef, useState } from "react";
import { GAMES } from "@/lib/play/games";
import { centerError, meanOf } from "@/lib/play/scoring";
import { GameFrame, Replay } from "./GameFrame";

const G = GAMES.find((g) => g.id === "center")!;
const ROUNDS = 3;
const RATIOS = ["16 / 10", "4 / 3", "21 / 9"];
const NUDGE: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/** Center the Div: drag a box to the exact centre of a dashed frame, then submit; three rounds, scored as mean pixels off. */
export default function CenterDiv() {
  return <Replay>{(again) => <Round onAgain={again} />}</Replay>;
}

/** One game: random start position and frame shape per round, target revealed on submit. */
function Round({ onAgain }: { onAgain: () => void }) {
  const [round, setRound] = useState(0); // submitted rounds
  const [pos, setPos] = useState<[number, number]>([0, 0]);
  const [target, setTarget] = useState<[number, number] | null>(null);
  const [last, setLast] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const sum = useRef(0);
  const tm = useRef(0);
  const drag = useRef<[number, number] | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => () => clearTimeout(tm.current), []);

  // Each round the frame changes shape (set via aspect-ratio), so the start point is measured on the next frame.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const r = box.current!.getBoundingClientRect();
      setPos([r.width * (0.15 + Math.random() * 0.2), r.height * (0.2 + Math.random() * 0.6)]);
      setTarget(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [round]);

  const busy = target !== null;
  const clamp = (x: number, y: number, r: DOMRect): [number, number] => [Math.max(0, Math.min(r.width, x)), Math.max(0, Math.min(r.height, y))];

  const submit = () => {
    const r = box.current!.getBoundingClientRect(), err = centerError(pos, r.width, r.height);
    setTarget([r.width / 2, r.height / 2]); setLast(err);
    sum.current += err;
    const n = round + 1;
    if (n >= ROUNDS) { setScore(meanOf(sum.current, ROUNDS)); return; }
    tm.current = window.setTimeout(() => setRound(n), 900);
  };

  return (
    <GameFrame g={G} help="Drag the box until it's dead centre, then submit. Three rounds; arrow keys nudge." score={score} onAgain={onAgain}>
      <div className="cd-box" ref={box} style={{ aspectRatio: RATIOS[round % 3] }}>
        <i className={`cd-target${target ? " show" : ""}`} style={target ? { left: target[0], top: target[1] } : undefined} />
        <div
          className="cd-div" tabIndex={0} aria-label="Draggable box" aria-roledescription="draggable box" style={{ left: pos[0], top: pos[1] }}
          onPointerDown={(e) => { if (busy) return; drag.current = [e.clientX - pos[0], e.clientY - pos[1]]; e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (!drag.current) return; setPos(clamp(e.clientX - drag.current[0], e.clientY - drag.current[1], box.current!.getBoundingClientRect())); }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          onKeyDown={(e) => { const m = NUDGE[e.key]; if (m && !busy) { e.preventDefault(); setPos([pos[0] + m[0], pos[1] + m[1]]); } }}
        >div</div>
      </div>
      <div className="g-row">
        <button className="btn sm" type="button" onClick={submit} disabled={busy}>Submit</button>
        <span className="label">Round {Math.min(round + (busy ? 2 : 1), ROUNDS)} of {ROUNDS}{last !== null ? ` · last ${last.toFixed(1)}px off` : ""}</span>
      </div>
    </GameFrame>
  );
}
