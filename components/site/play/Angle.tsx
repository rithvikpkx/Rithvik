"use client";
import { useEffect, useRef, useState } from "react";
import { GAMES } from "@/lib/play/games";
import { angleRound, meanOf } from "@/lib/play/scoring";
import { GameFrame, Replay, token } from "./GameFrame";

const G = GAMES.find((g) => g.id === "angle")!;
const ROUNDS = 5;
const newRound = () => angleRound(Math.random(), Math.random());

/** Angle Approximator: estimate the angle between two rays; five rounds, scored as mean degrees off. */
export default function Angle() {
  return <Replay>{(again) => <Round onAgain={again} />}</Replay>;
}

/** One game: slider guess, lock in to reveal the true angle, advance after a short pause. */
function Round({ onAgain }: { onAgain: () => void }) {
  const [rd, setRd] = useState(newRound);
  const [round, setRound] = useState(0); // locked-in rounds
  const [guess, setGuess] = useState(90);
  const [reveal, setReveal] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const sum = useRef(0);
  const tm = useRef(0);
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => () => clearTimeout(tm.current), []);

  // Draws the two rays from a shared point; the true angle is written only after lock-in.
  useEffect(() => {
    const c = cv.current, g = c?.getContext("2d");
    if (!c || !g) return;
    const W = c.width, H = c.height, ox = W / 2, oy = H * 0.72, L = H * 0.55;
    g.clearRect(0, 0, W, H); g.lineCap = "round"; g.strokeStyle = token(c, "--fg"); g.lineWidth = 4;
    for (const a of [rd.base, rd.base + (rd.target * Math.PI) / 180]) { g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.cos(a) * L, oy - Math.sin(a) * L); g.stroke(); }
    g.fillStyle = token(c, "--accent"); g.beginPath(); g.arc(ox, oy, 6, 0, 7); g.fill();
    if (reveal) { g.font = `600 22px ${token(c, "--font-l", "monospace")}`; g.fillText(`${rd.target}°`, ox + 14, oy + 30); }
  }, [rd, reveal]);

  const lock = () => {
    sum.current += Math.abs(guess - rd.target);
    setReveal(true);
    const n = round + 1;
    setRound(n);
    if (n >= ROUNDS) { setScore(meanOf(sum.current, ROUNDS)); return; }
    tm.current = window.setTimeout(() => { setRd(newRound()); setReveal(false); }, 900);
  };

  return (
    <GameFrame g={G} help="Estimate the angle between the rays. Five rounds." score={score} onAgain={onAgain}>
      <div className="g-canvas-box"><canvas ref={cv} width={420} height={315} role="img" aria-label="Two rays meeting at a point" /></div>
      <div className="g-row">
        <input type="range" min={0} max={180} value={guess} onChange={(e) => setGuess(+e.target.value)} aria-label="Your guess in degrees" style={{ flex: 1 }} />
        <b className="g-stat" style={{ fontSize: "1.4rem" }}>{guess}°</b>
        <button className="btn sm" type="button" onClick={lock} disabled={reveal}>Lock in</button>
      </div>
      <p className="label">Round {Math.min(round + (reveal ? 0 : 1), ROUNDS)} of {ROUNDS}</p>
    </GameFrame>
  );
}
