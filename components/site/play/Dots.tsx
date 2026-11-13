"use client";
import { useEffect, useRef, useState } from "react";
import { GAMES } from "@/lib/play/games";
import { dotCount, dotsError, meanOf } from "@/lib/play/scoring";
import { GameFrame, Replay, token } from "./GameFrame";

const G = GAMES.find((g) => g.id === "dots")!;
const ROUNDS = 3;
const FLASH_MS = 800;

/** Count the Dots: dots flash for 0.8 seconds and you guess how many; three rounds, scored as mean percent off. */
export default function Dots() {
  return <Replay>{(again) => <Round onAgain={again} />}</Replay>;
}

/** One game: flash, guess, reveal the true count, repeat. */
function Round({ onAgain }: { onAgain: () => void }) {
  const [phase, setPhase] = useState<"idle" | "flash" | "guess">("idle");
  const [round, setRound] = useState(0); // submitted rounds
  const [val, setVal] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const n = useRef(0);
  const sum = useRef(0);
  const tm = useRef(0);
  const cv = useRef<HTMLCanvasElement>(null);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => () => clearTimeout(tm.current), []);

  const flash = () => {
    const c = cv.current, g = c?.getContext("2d");
    if (!c || !g) return;
    n.current = dotCount(Math.random());
    g.clearRect(0, 0, c.width, c.height); g.fillStyle = token(c, "--accent");
    for (let i = 0; i < n.current; i++) { g.beginPath(); g.arc(20 + Math.random() * (c.width - 40), 20 + Math.random() * (c.height - 40), 5, 0, 7); g.fill(); }
    setPhase("flash");
    tm.current = window.setTimeout(() => {
      g.clearRect(0, 0, c.width, c.height);
      setPhase("guess");
      inp.current?.focus({ preventScroll: true });
    }, FLASH_MS);
  };

  const submit = () => {
    const c = cv.current, g = c?.getContext("2d");
    if (phase !== "guess" || val === "" || !c || !g) return;
    sum.current += dotsError(+val, n.current);
    const r = round + 1;
    setRound(r);
    g.fillStyle = token(c, "--fg"); g.font = `600 20px ${token(c, "--font-l", "monospace")}`; g.fillText(`There were ${n.current}`, 20, 40);
    setVal(""); setPhase("idle");
    if (r >= ROUNDS) setScore(meanOf(sum.current, ROUNDS));
  };

  return (
    <GameFrame g={G} help="Dots flash for 0.8 seconds. How many? Three rounds." score={score} onAgain={onAgain}>
      <div className="g-canvas-box"><canvas ref={cv} width={420} height={315} role="img" aria-label="Flashing dots" /></div>
      <div className="g-row">
        <button className="btn sm" type="button" onClick={flash} disabled={phase !== "idle" || score !== null}>Flash dots</button>
        <input ref={inp} className="field" type="number" inputMode="numeric" min={0} placeholder="How many?" aria-label="Your count" style={{ width: 130 }} value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
        <button className="btn sm" type="button" onClick={submit} disabled={phase !== "guess" || val === ""}>Submit</button>
      </div>
      <p className="label">Round {Math.min(round + 1, ROUNDS)} of {ROUNDS}</p>
    </GameFrame>
  );
}
