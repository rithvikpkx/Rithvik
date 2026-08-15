"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import SimpleMarkdown from "./SimpleMarkdown";
import { splitStream, SUGGESTIONS_SENTINEL } from "@/lib/suggestion-protocol";
import { buildTranscriptMarkdown, transcriptFilename } from "@/lib/transcript";

interface Message {
  role: "user" | "bot";
  content: string;
  /** Follow-ups offered after this bot turn. Kept per-message (not just for the
   *  latest turn) so the exported transcript can include every round's chips. */
  suggestions?: string[];
  /** Error / rate-limit notice — exported as such rather than as an answer. */
  isNotice?: boolean;
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

/** Seconds → a human countdown. The window is an hour, so minutes are the
 *  useful unit until the last stretch, where a live second count reassures the
 *  visitor that something is actually happening. */
function formatCooldown(totalSeconds: number): string {
  if (totalSeconds <= 60) return `${totalSeconds}s`;
  const mins = Math.ceil(totalSeconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

export default function RagBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Epoch ms until which the composer stays locked after a 429. Derived from the
  // server's Retry-After so the countdown matches the real window, not a guess.
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  // Esc hides the ghost for the current turn without clearing the chips. Stored
  // as the message count it was dismissed at, so the next turn re-arms it for
  // free — no effect, and therefore no cascading render.
  const [ghostDismissedAt, setGhostDismissedAt] = useState<number | null>(null);
  // Which suggestion the visitor has moved into the prompt field. Tagged with
  // the turn it belongs to so a new answer resets the choice without an effect.
  const [pick, setPick] = useState<{ turn: number; idx: number } | null>(null);
  // Below this width there's no Tab key, so the ghost can't be accepted —
  // all three suggestions render as chips instead.
  const [isNarrow, setIsNarrow] = useState(false);
  const [copied, setCopied] = useState(false);
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

  // Track the narrow breakpoint for the ghost-vs-chips split. Matches the
  // ≤640px rule the composer's mobile sheet already uses.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Tick the rate-limit countdown once a second, and release the composer the
  // moment the window reopens. Interval only exists while a cooldown is active.
  useEffect(() => {
    if (cooldownUntil === null) return;
    const tick = () => {
      const left = Math.ceil((cooldownUntil - Date.now()) / 1000);
      if (left <= 0) {
        setCooldownUntil(null);
        setCooldownLeft(0);
      } else {
        setCooldownLeft(left);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  // Only the most recent turn's suggestions are live — older chips would
  // compete with the current ones. Suppressed while streaming and during a
  // cooldown, where acting on them is impossible anyway. Every turn's
  // suggestions stay on their own message for the transcript export.
  const lastMessage = messages[messages.length - 1];
  const activeSuggestions =
    loading || cooldownUntil !== null || lastMessage?.role !== "bot" || lastMessage.isNotice
      ? []
      : lastMessage.suggestions ?? [];

  // All suggestions stay visible at all times: exactly one occupies the prompt
  // field (as ghost text while the field is empty, as real text once picked)
  // and the others are chips. Picking a chip therefore SWAPS — the one leaving
  // the field becomes a chip again, so the visitor is always choosing among the
  // full set rather than watching options disappear.
  const trimmedInput = input.trim();
  const selectedIdx =
    pick?.turn === messages.length && pick.idx < activeSuggestions.length ? pick.idx : 0;

  // Ghost only renders on desktop (no Tab key on narrow) and only while the
  // field is empty — which is why the native placeholder is enough.
  const ghostIdx =
    !isNarrow &&
    ghostDismissedAt !== messages.length &&
    trimmedInput === "" &&
    activeSuggestions.length > 0
      ? selectedIdx
      : -1;
  const ghostSuggestion = ghostIdx >= 0 ? activeSuggestions[ghostIdx] : null;

  // Whichever suggestion is in the field is excluded from the chips. When the
  // visitor types something of their own it matches nothing, so all of them
  // come back as chips.
  const occupiedIdx = trimmedInput === "" ? ghostIdx : activeSuggestions.indexOf(trimmedInput);
  const chipItems = activeSuggestions
    .map((text, idx) => ({ text, idx }))
    .filter(({ idx }) => idx !== occupiedIdx);

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
    // cooldownUntil also gates the button and Enter key; checked here too so no
    // path can spend a request while the window is closed.
    if (!text || loading || cooldownUntil !== null) return;

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

    // Chips shown over the last couple of bot turns, so the server can pick
    // fresh angles instead of recycling the same three questions.
    const recentlyOffered = messages
      .filter((m) => m.role === "bot" && m.suggestions?.length)
      .slice(-2)
      .flatMap((m) => m.suggestions ?? []);

    // Index of the placeholder this turn streams into. Targeting a fixed index
    // rather than "the last message" keeps a late-arriving trailer from writing
    // onto a newer turn once the composer is freed early.
    const botIndex = messages.length + 1;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "bot", content: "" },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `offered` lets the server avoid re-proposing chips the visitor has
        // just seen — without it two consecutive turns can produce identical
        // suggestion rows.
        body: JSON.stringify({ message: text, messages: history, offered: recentlyOffered }),
      });

      if (!res.ok) {
        // Surface the server's own message rather than a generic failure. The
        // 400s ("too long", "required") and the 429 are all actionable, and
        // telling a rate-limited visitor to "try again" is the wrong advice —
        // each retry writes another chat_requests row and digs them deeper.
        const serverMessage = (await res.text().catch(() => "")).trim();
        if (res.status === 429) {
          // Retry-After is in seconds; fall back to the full window if absent.
          const secs = Number(res.headers.get("Retry-After")) || 3600;
          setCooldownUntil(Date.now() + secs * 1000);
        }
        throw new Error(serverMessage || "Something went wrong. Please try again.");
      }
      if (!res.body) throw new Error("Something went wrong. Please try again.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      // Accumulate the whole stream: the answer and the trailing suggestions
      // payload share one text/plain body, separated by a sentinel. splitStream
      // withholds any partially-arrived sentinel so it never renders.
      let acc = "";
      let answerDone = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const { answer } = splitStream(acc);
        setMessages((prev) => {
          const updated = [...prev];
          updated[botIndex] = { role: "bot", content: answer };
          return updated;
        });
        // The sentinel means the answer is complete; the verified-suggestion
        // pass may still be running. Free the composer now rather than making
        // the visitor wait on chips they may not even use.
        if (!answerDone && acc.includes(SUGGESTIONS_SENTINEL)) {
          answerDone = true;
          setLoading(false);
        }
      }

      const { answer, suggestions } = splitStream(acc);
      setMessages((prev) => {
        const updated = [...prev];
        updated[botIndex] = {
          role: "bot",
          content: answer,
          suggestions: suggestions ?? undefined,
        };
        return updated;
      });
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : "Something went wrong. Please try again.";
      setMessages((prev) => {
        const updated = [...prev];
        updated[botIndex] = { role: "bot", content: msg, isNotice: true };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  /** True once the visitor has actually exchanged anything worth exporting —
   *  the welcome message alone doesn't count. */
  const hasTranscript = messages.some((m) => m.role === "user");

  /** Downloads the conversation as a Markdown file, suggestions included. */
  function handleDownloadTranscript() {
    const now = Date.now();
    const md = buildTranscriptMarkdown(messages, now);
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = transcriptFilename(now);
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on the next tick — revoking synchronously can cancel the download
    // in some browsers before it has read the blob.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  /** Copies the same Markdown to the clipboard. Offered alongside the download
   *  rather than as a fallback — pasting into a doc is a different need than
   *  saving a file. */
  async function handleCopyTranscript() {
    const md = buildTranscriptMarkdown(messages, Date.now());
    try {
      await navigator.clipboard.writeText(md);
    } catch {
      // Clipboard API needs a secure context and permission; fall back to the
      // legacy path so the button still does something on older/edge setups.
      const ta = document.createElement("textarea");
      ta.value = md;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* nothing more to try */ }
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  /** Moves a suggestion into the prompt field without sending it. The one it
   *  displaces returns to the chip row, so all suggestions stay reachable and
   *  the visitor can cycle freely before committing. */
  function applySuggestion(idx: number, text: string) {
    setPick({ turn: messages.length, idx });
    setInput(text);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Tab / → accepts the ghost suggestion when the field is empty. Accepting
    // clears the ghost, so a second Tab moves focus normally — no keyboard trap.
    if ((e.key === "Tab" || e.key === "ArrowRight") && ghostSuggestion && !input) {
      e.preventDefault();
      // No focus call here: the keypress came from the input, so it already has
      // focus. Only the chips need applySuggestion's focus side-effect.
      setInput(ghostSuggestion);
      return;
    }
    if (e.key === "Escape" && ghostSuggestion && !input) {
      e.preventDefault();
      setGhostDismissedAt(messages.length);
      return;
    }
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
              {hasTranscript && (
                <>
                  <button
                    className="rag-header-btn"
                    onClick={handleCopyTranscript}
                    title="Copy transcript as Markdown"
                    aria-label="Copy transcript as Markdown"
                  >
                    {copied ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="15" height="15">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                        <rect x="9" y="9" width="11" height="11" rx="2" />
                        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                      </svg>
                    )}
                  </button>
                  <button
                    className="rag-header-btn"
                    onClick={handleDownloadTranscript}
                    title="Download transcript (.md)"
                    aria-label="Download transcript as Markdown file"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                      <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" />
                    </svg>
                  </button>
                </>
              )}
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

            {chipItems.length > 0 && (
              <div className="rag-suggests" aria-label="Suggested follow-up questions">
                <span className="rag-suggests-label">Suggested</span>
                {chipItems.map(({ text: s, idx }) => (
                  <button
                    key={s}
                    type="button"
                    className="rag-suggest-chip"
                    onClick={() => applySuggestion(idx, s)}
                    title="Put this in the message box (doesn't send)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11" aria-hidden="true">
                      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                    </svg>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {cooldownUntil !== null && (
              <p className="rag-cooldown" role="status">
                Message limit reached — try again in {formatCooldown(cooldownLeft)}.
              </p>
            )}

            <div className="rag-input-row">
              <input
                ref={inputRef}
                type="text"
                className="rag-input"
                // Matches MAX_INPUT_LENGTH in app/api/chat/route.ts so the
                // server's 400 is unreachable by ordinary typing.
                maxLength={500}
                // The ghost suggestion rides the native placeholder. Because it
                // only ever shows while the field is empty, this is visually
                // identical to an overlay and costs none of the font-metric or
                // scroll-sync fragility a mirrored div would.
                placeholder={
                  cooldownUntil !== null
                    ? "Message limit reached…"
                    : ghostSuggestion ?? "Ask me anything about Rithvik..."
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading || cooldownUntil !== null}
              />
              <button
                className="rag-send"
                onClick={handleSend}
                disabled={loading || cooldownUntil !== null || !input.trim()}
                aria-label="Send"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {ghostSuggestion && (
              <p className="rag-ghost-hint" aria-hidden="true">
                <kbd>Tab</kbd> to use suggestion
              </p>
            )}
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
