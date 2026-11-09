"use client";
import { useEffect, useRef, useState } from "react";
import { GAMES } from "@/lib/play/games";
import { accuracy, addsError, pickLine, wpm } from "@/lib/play/scoring";
import { GameFrame, Replay } from "./GameFrame";

const G = GAMES.find((g) => g.id === "typeracer")!;

/** Type Racer: type a real line from the projects exactly; the timer starts on the first key. */
export default function TypeRacer() {
  return <Replay>{(again) => <Round onAgain={again} />}</Replay>;
}

/** One round: a random line, live WPM and accuracy, score on the last correct character. */
function Round({ onAgain }: { onAgain: () => void }) {
  const [text] = useState(() => pickLine(Math.random()));
  const [v, setV] = useState("");
  const [live, setLive] = useState({ wpm: 0, acc: 100 });
  const [done, setDone] = useState<{ score: number; acc: number } | null>(null);
  const t0 = useRef(0);
  const errs = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus({ preventScroll: true }), []);

  return (
    <GameFrame g={G} help="Type the line exactly. The timer starts on your first key." score={done?.score ?? null} extra={done ? `Accuracy ${done.acc}%` : undefined} onAgain={onAgain}>
      <div className="tr-text" aria-hidden="true">
        {[...text].map((c, i) => <span key={i} className={i < v.length ? (v[i] === c ? "ok" : "bad") : i === v.length ? "cur" : ""}>{c}</span>)}
      </div>
      <input
        ref={input} className="field" type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} value={v} readOnly={!!done}
        aria-label={`Type the line: ${text}`}
        onChange={(e) => {
          const nv = e.target.value;
          if (!t0.current) t0.current = performance.now();
          if (addsError(v, nv, text)) errs.current++;
          setV(nv);
          const w = wpm(nv.length, performance.now() - t0.current), acc = accuracy(errs.current, nv.length);
          setLive({ wpm: w, acc });
          if (nv === text) setDone({ score: w, acc });
        }}
      />
      <p className="label">{live.wpm} WPM · {live.acc}%</p>
    </GameFrame>
  );
}
