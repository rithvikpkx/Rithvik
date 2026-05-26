"use client";
import { useEffect, useRef, useState } from "react";
import { useContactComposer } from "./ContactComposerProvider";
import RichTextEditor from "./RichTextEditor";

const MIN_W = 360, MIN_H = 420, MAX_W = 760, MAX_H = 820;
const DEFAULT = { w: 460, h: 580 };
const SIZE_KEY = "contact-composer-size";
const DRAG_THRESHOLD = 4;  // px before a pointerdown counts as a drag
const MOBILE_BP = 640;

type Status = "idle" | "confirm" | "sending" | "success" | "error" | "rate-limited";

function clamp(n: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, n)); }

// Read persisted size once. SSR-safe: the window only renders after open().
function loadSize() {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const s = JSON.parse(localStorage.getItem(SIZE_KEY) || "null");
    if (typeof s?.w === "number" && typeof s?.h === "number") {
      return { w: clamp(s.w, MIN_W, MAX_W), h: clamp(s.h, MIN_H, MAX_H) };
    }
  } catch { /* ignore */ }
  return DEFAULT;
}

interface Props { toAddress: string; }

export default function ContactComposer({ toAddress }: Props) {
  const { isOpen, close } = useContactComposer();
  const panelRef = useRef<HTMLDivElement>(null);

  const [size, setSize] = useState(loadSize);
  // Center on the viewport at mount. A lazy initializer (not an effect) keeps
  // inline left/top always present, so the CSS needs no centering logic and the
  // mobile sheet just overrides with !important. ssr:false → window is defined.
  const [pos, setPos] = useState(() => {
    if (typeof window === "undefined") return { x: 0, y: 0 };
    return {
      x: Math.max(12, (window.innerWidth - size.w) / 2),
      y: Math.max(12, (window.innerHeight - size.h) / 3),
    };
  });
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [copied, setCopied] = useState(false);

  // Esc closes.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  // Persist size whenever it changes.
  useEffect(() => {
    try { localStorage.setItem(SIZE_KEY, JSON.stringify(size)); } catch { /* ignore */ }
  }, [size]);

  // Drag via the header. Move the panel with a GPU-composited transform applied
  // straight to the DOM (no React state per move → smooth), then bake the offset
  // into the resting position once on pointerup. Capture nothing on pointerdown
  // and only engage past a threshold so the header close button still clicks.
  const startDrag = (e: React.PointerEvent) => {
    if (window.innerWidth < MOBILE_BP) return;        // sheet mode: no drag
    const el = panelRef.current;
    if (!el) return;
    const startX = e.clientX, startY = e.clientY;
    let dx = 0, dy = 0, dragging = false;
    const move = (ev: PointerEvent) => {
      dx = ev.clientX - startX; dy = ev.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!dragging) { dragging = true; el.style.willChange = "transform"; }
      el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!dragging) return;
      // Bake the offset into left/top directly AND clear the transform in the
      // same frame (no flash before React re-renders), then sync React state.
      const nx = pos.x + dx, ny = pos.y + dy;
      el.style.left = `${nx}px`;
      el.style.top = `${ny}px`;
      el.style.transform = "";
      el.style.willChange = "";
      setPos({ x: nx, y: ny });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Resize via the bottom-right handle.
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const origin = { ...size };
    const move = (ev: PointerEvent) => {
      setSize({
        w: clamp(origin.w + (ev.clientX - startX), MIN_W, MAX_W),
        h: clamp(origin.h + (ev.clientY - startY), MIN_H, MAX_H),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const copyTo = async () => {
    try {
      await navigator.clipboard.writeText(toAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable — ignore */ }
  };

  const reset = () => { setFrom(""); setSubject(""); setBodyHtml(""); setStatus("idle"); };

  // Step 1: Send asks the user to verify their return address first — a wrong
  // "From" means the reply never reaches them.
  const requestConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("confirm");
  };

  // Step 2: actually send, after they've confirmed the address.
  const confirmSend = async () => {
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, subject, bodyHtml, honeypot }),
      });
      if (res.ok) { setStatus("success"); return; }
      setStatus(res.status === 429 ? "rate-limited" : "error");
    } catch {
      setStatus("error");
    }
  };

  if (!isOpen) return null;

  const canSend = Boolean(from.trim() && subject.trim() && bodyHtml.trim());

  return (
    <div className="composer-overlay" role="dialog" aria-label="Email Rithvik">
      <div
        ref={panelRef}
        className="composer-panel"
        style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      >
        <div className="composer-shine" aria-hidden="true" />
        <div className="composer-header" onPointerDown={startDrag} title="Drag to move">
          <span className="composer-title">Email Rithvik</span>
          <span className="composer-grip" aria-hidden="true">
            <i></i><i></i><i></i>
          </span>
          <button
            type="button"
            className="composer-peek"
            aria-label="Hold to peek at the page behind"
            title="Peek at the page behind"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button type="button" className="composer-close" onClick={close} aria-label="Close">×</button>
        </div>

        {status === "success" ? (
          <div className="composer-success">
            <p>Sent — I&apos;ll get back to you.</p>
            <div className="composer-success-actions">
              <button type="button" onClick={reset}>Send another</button>
              <button type="button" onClick={close}>Close</button>
            </div>
          </div>
        ) : status === "confirm" || status === "sending" ? (
          <div className="composer-confirm">
            <p className="composer-confirm-q">Send this email?</p>
            <p className="composer-confirm-note">
              I&apos;ll reply to <strong className="composer-confirm-email">{from}</strong>. Please
              double-check it&apos;s correct — if it&apos;s wrong, I won&apos;t be able to reach you back.
            </p>
            <div className="composer-confirm-actions">
              <button type="button" onClick={() => setStatus("idle")} disabled={status === "sending"}>
                Back
              </button>
              <button
                type="button" className="composer-send" onClick={confirmSend}
                disabled={status === "sending"}
              >
                {status === "sending" ? "Sending…" : "Confirm & send"}
              </button>
            </div>
          </div>
        ) : (
          <form className="composer-form" onSubmit={requestConfirm}>
            <div className="composer-field composer-to">
              <label>To</label>
              <span className="composer-to-addr">{toAddress}</span>
              <button type="button" className="composer-copy" onClick={copyTo}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="composer-field">
              <label htmlFor="composer-from">From</label>
              <input
                id="composer-from" type="email" required autoFocus
                placeholder="you@example.com"
                value={from} onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="composer-field">
              <label htmlFor="composer-subject">Subject</label>
              <input
                id="composer-subject" type="text" required maxLength={200}
                placeholder="Subject"
                value={subject} onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <RichTextEditor initialHtml={bodyHtml} onChange={setBodyHtml} />

            {/* Honeypot: off-screen, hidden from real users; bots fill it. */}
            <input
              type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
              className="composer-hp"
              value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
            />

            {status === "error" && (
              <p className="composer-msg composer-err">Couldn&apos;t send — please try again.</p>
            )}
            {status === "rate-limited" && (
              <p className="composer-msg composer-err">You&apos;ve sent a few already — try again in a bit.</p>
            )}

            <div className="composer-actions">
              <button type="submit" className="composer-send" disabled={!canSend}>
                Send
              </button>
            </div>
          </form>
        )}

        <div className="composer-resize" onPointerDown={startResize} aria-hidden="true" />
      </div>
    </div>
  );
}
