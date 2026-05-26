"use client";
import { useEffect, useRef, useState } from "react";
import { useContactComposer } from "./ContactComposerProvider";
import RichTextEditor from "./RichTextEditor";

const MIN_W = 360, MIN_H = 420, MAX_W = 760, MAX_H = 820;
const DEFAULT = { w: 460, h: 580 };
const SIZE_KEY = "contact-composer-size";
const DRAG_THRESHOLD = 4;  // px before a pointerdown counts as a drag
const MOBILE_BP = 640;

type Status = "idle" | "sending" | "success" | "error" | "rate-limited";

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
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
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

  // Drag via the header. Capture nothing on pointerdown — only move once past
  // the threshold, so header buttons (close) still click cleanly.
  // When pos is null the panel is CSS-centered; read its actual rect on first drag.
  const startDrag = (e: React.PointerEvent) => {
    if (window.innerWidth < MOBILE_BP) return;        // sheet mode: no drag
    const startX = e.clientX, startY = e.clientY;
    // Resolve origin from DOM rect when no explicit pos is set yet.
    const rect = panelRef.current?.getBoundingClientRect();
    const origin = pos ?? (rect ? { x: rect.left, y: rect.top } : { x: startX, y: startY });
    let dragging = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      dragging = true;
      setPos({ x: origin.x + dx, y: origin.y + dy });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const sending = status === "sending";
  const canSend = Boolean(from.trim() && subject.trim() && bodyHtml.trim()) && !sending;

  return (
    <div className="composer-overlay" role="dialog" aria-label="Email Rithvik">
      <div
        ref={panelRef}
        className="composer-panel"
        style={pos ? { left: pos.x, top: pos.y, width: size.w, height: size.h } : undefined}
      >
        <div className="composer-header" onPointerDown={startDrag}>
          <span className="composer-title">Email Rithvik</span>
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
        ) : (
          <form className="composer-form" onSubmit={submit}>
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

            <RichTextEditor onChange={setBodyHtml} />

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
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        )}

        <div className="composer-resize" onPointerDown={startResize} aria-hidden="true" />
      </div>
    </div>
  );
}
