"use client";
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { matchCommands, NO_ARG } from "@/lib/agent/commands";
import { EditModeContext } from "@/components/EditModeProvider";
import { DesignContext } from "../DesignProvider";
import { useSite } from "../SiteProvider";
import { Icon } from "../Glyph";
import { setAdminMode } from "../agent/adminCommands";
import StatusLine from "../agent/StatusLine";
import Handoff from "../agent/Handoff";
import Transcript, { type RowHandlers } from "../agent/Transcript";
import { useAgent } from "../agent/useAgent";
import { scrollAndHighlight } from "../agent/highlight";
import Voice from "../agent/Voice";
import "../agent/agent.css";

/** True when a keystroke is going into a form field or editor, where global shortcuts must stay out of the way. */
function isTyping(t: EventTarget | null): boolean {
  // The Artboard (Excalidraw) owns its keys: / and ? are its own shortcuts.
  return t instanceof HTMLElement && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable || !!t.closest(".excalidraw"));
}

/** Narrow screens get a shorter placeholder: a wrapped one makes the prompt two lines tall. */
const NARROW = "(max-width: 560px)";
const subscribeNarrow = (cb: () => void) => { const m = matchMedia(NARROW); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };

/** The bottom-centre agent prompt. Always mounted so the transcript survives while another overlay
 *  is open; the panel expands when overlay.kind === "agent" (the bar itself is always there). */
export default function AgentDock() {
  const site = useSite();
  const { overlay, content, openAgent, close } = site;
  const design = useContext(DesignContext); // null in the lab harness: /theme then says so instead of throwing
  const open = overlay?.kind === "agent";
  const admin = useContext(EditModeContext)?.isEditing ?? false; // null in the lab harness
  useEffect(() => { setAdminMode(admin); return () => setAdminMode(false); }, [admin]);
  const narrow = useSyncExternalStore(subscribeNarrow, () => matchMedia(NARROW).matches, () => false);
  const [full, setFull] = useState(false);
  const [input, setInput] = useState("");
  const [palIdx, setPalIdx] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const recalled = useRef<string | null>(null); // the history entry currently in the input, so repeated up-arrows keep walking

  // openAgent(question) prefills the prompt; derived during render so no effect has to set state.
  // Also remembers the case sheet the agent was summoned over, for page context (one overlay at a time).
  // With a rect the question flies in from there instead (Handoff), and is sent once it lands.
  const [seen, setSeen] = useState(overlay);
  const [caseSlug, setCaseSlug] = useState<string | null>(null);
  const [fly, setFly] = useState<{ id: number; q: string; from: DOMRect } | null>(null);
  if (overlay !== seen) {
    setSeen(overlay);
    if (overlay?.kind === "agent" && overlay.question) {
      const { question: q, originRect: from } = overlay;
      if (from) setFly((f) => ({ id: (f?.id ?? 0) + 1, q, from }));
      else setInput(q);
    }
    if (overlay?.kind !== "agent") setFly(null);
    if (overlay?.kind === "case") setCaseSlug(overlay.slug);
    else if (overlay?.kind !== "agent") setCaseSlug(null);
  }

  // Overlays restore focus to whatever had it when they close; if that is this input, its onFocus
  // would reopen the agent over them (instantly under StrictMode's double effect). So blur first.
  const host = useMemo(() => {
    const away = <A extends unknown[]>(f: (...a: A) => void) => (...a: A) => { inputRef.current?.blur(); f(...a); };
    return {
      content, design, caseSlug,
      openCase: away(site.openCase), openResume: away(site.openResume), openComposer: away(site.openComposer), openPlay: away(site.openPlay), lite: site.lite, setLite: site.setLite,
      close, toggleFull: () => setFull((f) => !f), toast: (m: string) => site.toast(m),
    };
  }, [content, design, caseSlug, site, close]);
  const agent = useAgent(host);
  const { items, busySince } = agent;
  const busy = busySince !== null;

  // Handlers read the latest agent/state through a ref, so the row callbacks (and memoised rows) stay stable.
  const latest = useRef({ agent, open, input, full, overlay });
  useEffect(() => { latest.current = { agent, open, input, full, overlay }; });

  const go = (q: string) => { if (agent.submit(q)) { setInput(""); setPalIdx(0); recalled.current = null; } };
  // The flown question has landed in the prompt: leave it there for a beat so the eye catches it, then send it as if typed.
  const landTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const land = (q: string) => {
    setInput(q);
    clearTimeout(landTimer.current);
    landTimer.current = setTimeout(() => { const L = latest.current; if (L.input === q && L.agent.submit(q)) { setInput(""); recalled.current = null; } }, 240);
  };
  useEffect(() => () => clearTimeout(landTimer.current), []);
  const flyTarget = useCallback(() => inputRef.current, []);
  const tick = useRef<HTMLSpanElement>(null);
  // Keystroke feedback: the prompt glyph nudges down a hair, like a key travelling. WAAPI (transform only), skipped in performance mode.
  const keyFeel = () => {
    if (document.documentElement.classList.contains("lite") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    tick.current?.animate([{ transform: "translateY(1.5px) scale(.94)" }, { transform: "none" }], { duration: 90, easing: "ease-out" });
  };
  const h = useMemo<RowHandlers>(() => ({
    send: (q) => { if (latest.current.agent.submit(q)) setInput(""); },
    fill: (q) => { setInput(q); inputRef.current?.focus(); },
    press: (row, btn) => latest.current.agent.press(row, btn),
    undo: (id) => latest.current.agent.undo(id),
    copy: (t) => latest.current.agent.copy(t, "Copied"),
    cite: (a) => { scrollAndHighlight(a); },
  }), []);

  // Auto-grow: reset, then fit the content; CSS caps it at six rows and scrolls beyond.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto"; // empty: stay one row (scrollHeight would count a wrapped placeholder)
    if (input) el.style.height = `${el.scrollHeight}px`;
    // Pill-shaped bars (999px radius) would clip a tall draft, so CSS squares them once it wraps.
    if (el.form) el.form.dataset.grown = String(!!input && el.scrollHeight > parseFloat(getComputedStyle(el).lineHeight) * 1.5);
  }, [input]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [items, open]);

  // Global keys: Cmd+K toggles, "/" and "?" summon (never while typing elsewhere), Esc interrupts then closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const L = latest.current;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (L.open && document.activeElement === inputRef.current) { close(); inputRef.current?.blur(); }
        else { openAgent(); inputRef.current?.focus(); }
        return;
      }
      if (e.key === "Escape" && L.open) {
        if (L.agent.busySince !== null) L.agent.interrupt();
        else if (matchCommands(L.input).length) setInput("");
        else { close(); inputRef.current?.blur(); }
        return;
      }
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); openAgent(); setInput("/"); inputRef.current?.focus(); }
      else if (e.key === "?") { e.preventDefault(); openAgent(); L.agent.submit("/help"); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openAgent, close]);

  const matches = open ? matchCommands(input, admin) : [];
  const pal = Math.min(palIdx, Math.max(0, matches.length - 1));

  /** Prompt keys: palette, history, undo, send (Enter; Shift+Enter is a newline),
   *  full screen, Ctrl+L / Ctrl+U, "?" for help. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // History only walks when the caret is on the first/last line, so ↑/↓ still move through a multi-line draft.
    const { value, selectionStart: at, selectionEnd: to } = e.currentTarget;
    const firstLine = !value.slice(0, at).includes("\n") && at === to;
    const lastLine = !value.slice(to).includes("\n") && at === to;
    if (matches.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setPalIdx(Math.max(0, Math.min(matches.length - 1, pal + (e.key === "ArrowDown" ? 1 : -1))));
      return;
    }
    if (matches.length && (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey))) {
      e.preventDefault();
      const [c] = matches[pal];
      if (e.key === "Enter" && NO_ARG.has(c)) go(c);
      else setInput(`${c} `);
      return;
    }
    if (e.key === "ArrowUp" && firstLine && (!input || input === recalled.current)) {
      const v = agent.recall(1);
      if (v !== null) { e.preventDefault(); recalled.current = v; setInput(v); }
      return;
    }
    if (e.key === "ArrowDown" && lastLine && recalled.current !== null && input === recalled.current) {
      e.preventDefault();
      const v = agent.recall(-1) ?? "";
      recalled.current = v || null;
      setInput(v);
      return;
    }
    const last = items[items.length - 1];
    if (!input && e.key === "u" && last?.kind === "tool" && last.undo) { e.preventDefault(); agent.undo(last.id); return; }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); host.toggleFull(); return; }
    // IME composition also fires Enter; never send mid-composition.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); return; }
    if (e.key === "l" && e.ctrlKey) { e.preventDefault(); agent.clear(); return; }
    if (e.key === "u" && e.ctrlKey) { e.preventDefault(); setInput(""); return; }
    if (e.key === "?" && !input) { e.preventDefault(); go("/help"); }
  };

  return (
    <div className="agent" data-open={open} data-full={open && full}>
      {open && (
        <section className="agent-panel" aria-label="RAG, Rithvik's agent">
          <header className="agent-head">
            <span className="agent-title"><span className="at-mark" aria-hidden="true">✻</span> RAG</span>
            <span className="agent-actions">
              <button type="button" className="ag-btn" aria-label="Copy chat as Markdown" title="Copy chat" disabled={!agent.canExport} onClick={agent.copyChat}><Icon name="copy" /></button>
              <button type="button" className="ag-btn" aria-label="Download chat as Markdown" title="Download chat" disabled={!agent.canExport} onClick={agent.downloadChat}><Icon name="download" /></button>
              <button type="button" className="ag-btn" aria-label="Share this conversation" title={agent.canShare ? "Copy a share link" : "Ask something first"} disabled={!agent.canShare} onClick={() => void agent.share()}><Icon name="share-2" /></button>
              <button type="button" className="ag-btn" aria-label="Full screen (Cmd+Enter)" title="Full screen" onClick={host.toggleFull}><Icon name={full ? "minimize-2" : "maximize-2"} /></button>
              <button type="button" className="ag-btn" aria-label="Close (Esc)" title="Close" onClick={close}><Icon name="chevron-down" /></button>
            </span>
          </header>
          <div className="agent-log" ref={logRef} role="log">
            <Transcript items={items} h={h} />
          </div>
          {matches.length > 0 && (
            <div className="agent-palette" role="listbox" aria-label="Commands">
              {matches.map(([c, d], i) => (
                <button key={c} type="button" role="option" aria-selected={i === pal}
                  onMouseDown={(e) => e.preventDefault()} onClick={() => { setInput(`${c} `); inputRef.current?.focus(); }}>
                  {c}<span>{d}</span>
                </button>
              ))}
            </div>
          )}
          </section>
      )}
      <form className="agent-bar" autoComplete="off" onSubmit={(e) => { e.preventDefault(); if (busy && !input.trim()) agent.interrupt(); else go(input); }}>
        <span className="ab-prompt" ref={tick} aria-hidden="true" />
        <label htmlFor="agent-input" className="sr-only">Ask about Rithvik</label>
        <textarea id="agent-input" ref={inputRef} className="ab-input" rows={1} value={input} maxLength={500} enterKeyHint="send"
          placeholder={narrow ? "Ask about Rithvik" : "Ask about Rithvik, or type / for commands"}
          onChange={(e) => { setInput(e.target.value); setPalIdx(0); keyFeel(); }}
          onFocus={() => { if (!open) openAgent(); }} onClick={() => { if (!open) openAgent(); }}
          onKeyDown={onKeyDown} />
        <kbd className="ab-kbd" aria-hidden="true">⌘K</kbd>
        <Voice onTranscript={(t) => { openAgent(); setInput(t); inputRef.current?.focus(); }} onSend={(t) => { openAgent(); go(t); }} />
        <button className={`ab-send${busy ? " busy" : ""}`} type="submit" aria-label={busy ? "Interrupt" : "Send"}><Icon name={busy ? "square" : "arrow-up"} /></button>
      </form>
      {open && <StatusLine actions={items.some((i) => i.kind === "actions")} turns={agent.turns.length} usage={agent.usage} busySince={busySince} cooldown={agent.cooldown} model={process.env.NEXT_PUBLIC_CHAT_MODEL} />}
      {fly && open && <Handoff key={fly.id} question={fly.q} from={fly.from} target={flyTarget} onLand={() => land(fly.q)} onDone={() => setFly(null)} />}
    </div>
  );
}
