"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import SimpleMarkdown from "./SimpleMarkdown";

interface Message {
  role: "user" | "bot";
  content: string;
}

const WELCOME: Message = {
  role: "bot",
  content:
    "Hey! I'm **RAG** — I know everything about Rithvik. Treat me like a talking portfolio: ask me about his projects, skills, or background, and I'll answer like he would.",
};

/* Starter prompts shown as chips on the welcome screen. Answers are
   precomputed (no API call) so they feel instant. Keep them grounded in
   real site_content — update if the underlying data drifts. */
const STARTERS: { q: string; a: string }[] = [
  {
    q: "What does Rithvik study?",
    a: "Rithvik is studying **Computer Science and Math at Purdue University** in West Lafayette, IN. He's building at the intersection of AI, systems, and real-world problems.",
  },
  {
    q: "Why does Rithvik love CS?",
    a: "Rithvik loves CS because it sits at the **intersection of AI, systems, and real-world problems** — the place where an idea becomes something you can actually ship. His interests span full-stack engineering, applied ML, computer systems, startups, and research, so CS keeps giving him new corners to explore.",
  },
  {
    q: "What is rithvik.ai?",
    a: "**rithvik.ai** is Rithvik's full-stack AI-powered personal platform — a portfolio, a live admin UI for inline editing, and the RAG chatbot you're talking to right now. Built with `Next.js`, `Supabase`, and the `OpenAI API`.",
  },
  {
    q: "How can I reach him?",
    a: "You can email Rithvik directly at [rithvikpkx@gmail.com](mailto:rithvikpkx@gmail.com), or check the **Contact** section at the bottom of the page for his other links.",
  },
];

// Resize bounds. Min keeps the panel usable; max stays under most viewports.
const SIZE = {
  minW: 320,
  minH: 420,
  maxW: 720,
  maxH: 820,
  defaultW: 380,
  defaultH: 520,
};

const STORAGE_KEY = "rag-panel-size";

export default function RagBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Lazy initializer reads persisted size once. Safe under SSR — the panel
  // isn't rendered until the user clicks the launcher post-hydration, so any
  // size difference between SSR and client doesn't affect initial markup.
  const [size, setSize] = useState<{ w: number; h: number }>(() => {
    if (typeof window === "undefined") return { w: SIZE.defaultW, h: SIZE.defaultH };
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { w?: number; h?: number };
        if (typeof parsed.w === "number" && typeof parsed.h === "number") {
          return {
            w: clamp(parsed.w, SIZE.minW, SIZE.maxW),
            h: clamp(parsed.h, SIZE.minH, SIZE.maxH),
          };
        }
      }
    } catch {}
    return { w: SIZE.defaultW, h: SIZE.defaultH };
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message tokens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  /** Drag the top-left corner to resize. Because the panel is anchored to
   *  bottom-right, dragging up/left grows it; down/right shrinks it. */
  const onResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.w;
    const startH = size.h;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    function onMove(ev: PointerEvent) {
      const dx = startX - ev.clientX; // moving left -> positive -> grow width
      const dy = startY - ev.clientY; // moving up   -> positive -> grow height
      const nextW = clamp(startW + dx, SIZE.minW, SIZE.maxW);
      const nextH = clamp(startH + dy, SIZE.minH, SIZE.maxH);
      setSize({ w: nextW, h: nextH });
    }
    function onUp() {
      target.releasePointerCapture?.(e.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      // Persist the final size
      try {
        // Read the current state via the ref-like trick: setSize callback
        setSize((cur) => {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cur));
          return cur;
        });
      } catch {}
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [size.w, size.h]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setLoading(true);

    // Build history from current messages before adding the new ones.
    // Map "bot" -> "assistant" for the API, skip empty streaming placeholders.
    const history = messages
      .filter((m) => m.content.length > 0)
      .slice(-5)
      .map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }));

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "bot", content: "" },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, messages: history }),
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "bot",
            content: updated[updated.length - 1].content + chunk,
          };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "bot",
          content: "Something went wrong. Please try again.",
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  /** Append a starter Q+A pair instantly without hitting the API. Used by
   *  the precomputed example chips on the welcome screen. */
  function handleStarterClick(starter: { q: string; a: string }) {
    if (loading) return;
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: starter.q },
      { role: "bot", content: starter.a },
    ]);
  }

  // Show chips only on the welcome screen (no real exchange has happened yet).
  const showStarters = messages.length === 1 && messages[0].role === "bot";

  return (
    <div className="rag-launcher">
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            className="rag-panel"
            style={
              {
                "--rag-w": `${size.w}px`,
                "--rag-h": `${size.h}px`,
              } as React.CSSProperties
            }
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Animated shine border ring */}
            <div className="rag-shine" aria-hidden />

            {/* Top-left resize handle */}
            <div
              className="rag-resize"
              onPointerDown={onResizePointerDown}
              role="separator"
              aria-label="Resize chat"
              aria-orientation="vertical"
              title="Drag to resize"
            />

            <div className="rag-header">
              <div className="rag-title-group">
                <span className="pulse-dot" />
                <span className="rag-title rag-gradient-text">RAG</span>
                <span className="rag-subtitle">Rithvik Augmented Generation</span>
              </div>
              <button className="rag-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>

            <div className="rag-messages">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`rag-message ${msg.role === "user" ? "rag-message-user" : "rag-message-bot"}`}
                >
                  <div className="rag-bubble">
                    {msg.content ? (
                      msg.role === "bot"
                        ? <SimpleMarkdown text={msg.content} />
                        : <p>{msg.content}</p>
                    ) : (
                      <span className="rag-typing"><span /><span /><span /></span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {showStarters && (
              <div className="rag-starters" aria-label="Example questions">
                {STARTERS.map((s) => (
                  <button
                    key={s.q}
                    type="button"
                    className="rag-chip"
                    onClick={() => handleStarterClick(s)}
                    disabled={loading}
                  >
                    {s.q}
                  </button>
                ))}
              </div>
            )}

            <div className="rag-input-row">
              <input
                ref={inputRef}
                type="text"
                className="rag-input"
                placeholder="Ask me anything about Rithvik..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
              <button
                className="rag-send"
                onClick={handleSend}
                disabled={loading || !input.trim()}
                aria-label="Send"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button className="rag-btn" onClick={() => setOpen((o) => !o)} aria-label="Chat with RAG">
        <svg
          className="rag-btn-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          width="20"
          height="20"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="rag-gradient-text">Ask RAG</span>
      </button>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
