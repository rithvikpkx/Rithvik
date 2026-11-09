"use client";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { matchCommands, NO_ARG } from "@/lib/agent/commands";
import { EditModeContext } from "@/components/EditModeProvider";
import { DesignContext } from "../DesignProvider";
import { useSite } from "../SiteProvider";
import { Icon } from "../Glyph";
import { setAdminMode } from "../agent/adminCommands";
import StatusLine from "../agent/StatusLine";
import Transcript, { type RowHandlers } from "../agent/Transcript";
import { useAgent } from "../agent/useAgent";
import { scrollAndHighlight } from "../agent/highlight";
import "../agent/agent.css";

/** True when a keystroke is going into a form field or editor, where global shortcuts must stay out of the way. */
function isTyping(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable);
}

/** The bottom-centre agent prompt. Always mounted so the transcript survives while another overlay
 *  is open; the panel expands when overlay.kind === "agent" (the bar itself is always there). */
export default function AgentDock() {
  const site = useSite();
  const { overlay, content, openAgent, close } = site;
  const design = useContext(DesignContext); // null in the lab harness: /theme then says so instead of throwing
  const open = overlay?.kind === "agent";
  const admin = useContext(EditModeContext)?.isEditing ?? false; // null in the lab harness
  useEffect(() => { setAdminMode(admin); return () => setAdminMode(false); }, [admin]);
  const [full, setFull] = useState(false);
  const [input, setInput] = useState("");
  const [palIdx, setPalIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const recalled = useRef<string | null>(null); // the history entry currently in the input, so repeated up-arrows keep walking

  // openAgent(question) prefills the prompt; derived during render so no effect has to set state.
  // Also remembers the case sheet the agent was summoned over, for page context (one overlay at a time).
  const [seen, setSeen] = useState(overlay);
  const [caseSlug, setCaseSlug] = useState<string | null>(null);
  if (overlay !== seen) {
    setSeen(overlay);
    if (overlay?.kind === "agent" && overlay.question) setInput(overlay.question);
    if (overlay?.kind === "case") setCaseSlug(overlay.slug);
    else if (overlay?.kind !== "agent") setCaseSlug(null);
  }

  // Overlays restore focus to whatever had it when they close; if that is this input, its onFocus
  // would reopen the agent over them (instantly under StrictMode's double effect). So blur first.
  const host = useMemo(() => {
    const away = <A extends unknown[]>(f: (...a: A) => void) => (...a: A) => { inputRef.current?.blur(); f(...a); };
    return {
      content, design, caseSlug,
      view: () => ({ full: latest.current.full, covered: !!latest.current.overlay && latest.current.overlay.kind !== "agent" }),
      openCase: away(site.openCase), openResume: away(site.openResume), openComposer: away(site.openComposer), openPlay: away(site.openPlay),
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
  const h = useMemo<RowHandlers>(() => ({
    send: (q) => { if (latest.current.agent.submit(q)) setInput(""); },
    fill: (q) => { setInput(q); inputRef.current?.focus(); },
    answer: (id, c) => latest.current.agent.answerAsk(id, c),
    undo: (id) => latest.current.agent.undo(id),
    copy: (t) => latest.current.agent.copy(t, "Copied"),
    cite: (a) => { scrollAndHighlight(a); },
  }), []);

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

  /** Prompt keys: palette, history, confirmations (Enter/n/a), full screen, Ctrl+L / Ctrl+U, "?" for help. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (matches.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setPalIdx(Math.max(0, Math.min(matches.length - 1, pal + (e.key === "ArrowDown" ? 1 : -1))));
      return;
    }
    if (matches.length && (e.key === "Tab" || e.key === "Enter")) {
      e.preventDefault();
      const [c] = matches[pal];
      if (e.key === "Enter" && NO_ARG.has(c)) go(c);
      else setInput(`${c} `);
      return;
    }
    if (e.key === "ArrowUp" && (!input || input === recalled.current)) {
      const v = agent.recall(1);
      if (v !== null) { e.preventDefault(); recalled.current = v; setInput(v); }
      return;
    }
    if (e.key === "ArrowDown" && recalled.current !== null && input === recalled.current) {
      e.preventDefault();
      const v = agent.recall(-1) ?? "";
      recalled.current = v || null;
      setInput(v);
      return;
    }
    if (!input && agent.pendingId !== null && ["Enter", "n", "a"].includes(e.key)) {
      e.preventDefault();
      agent.answerAsk(agent.pendingId, e.key === "Enter" ? "yes" : e.key === "n" ? "no" : "always");
      return;
    }
    const last = items[items.length - 1];
    if (!input && e.key === "u" && last?.kind === "tool" && last.undo) { e.preventDefault(); agent.undo(last.id); return; }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); host.toggleFull(); return; }
    if (e.key === "l" && e.ctrlKey) { e.preventDefault(); agent.clear(); return; }
    if (e.key === "u" && e.ctrlKey) { e.preventDefault(); setInput(""); return; }
    if (e.key === "?" && !input) { e.preventDefault(); go("/help"); }
  };

  return (
    <div className="agent" data-open={open} data-full={open && full} data-pending={!open && !!agent.pending}>
      {open && (
        <section className="agent-panel" aria-label="Rithvik's agent">
          <header className="agent-head">
            <span className="agent-title"><span className="at-mark" aria-hidden="true">✻</span> rithvik.ai agent</span>
            <span className="agent-model">{process.env.NEXT_PUBLIC_CHAT_MODEL}</span>
            <span className="agent-actions">
              <button type="button" className="ag-btn" aria-label="Full screen (Cmd+Enter)" title="Full screen" onClick={host.toggleFull}><Icon name={full ? "minimize-2" : "maximize-2"} /></button>
              <button type="button" className="ag-btn" aria-label="Close (Esc)" title="Close" onClick={close}><Icon name="chevron-down" /></button>
            </span>
          </header>
          <div className="agent-log" ref={logRef} role="log">
            <Transcript items={items} h={h} projects={content.projects.length} roles={content.experience.length} />
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
          <StatusLine turns={agent.turns.length} busySince={busySince} cooldown={agent.cooldown} />
        </section>
      )}
      {!open && agent.pending && (
        // A multi-step turn can open a case sheet (collapsing the panel) with more steps queued: confirm them here.
        <div className="agent-pending" role="group" aria-label="Agent wants to">
          <span className="q">{agent.pending.question}</span>
          <button type="button" className="t-key primary" onClick={() => agent.answerAsk(agent.pending!.id, "yes")}>⏎ Yes</button>
          <button type="button" className="t-key" onClick={() => agent.answerAsk(agent.pending!.id, "no")}>n No</button>
        </div>
      )}
      <form className="agent-bar" autoComplete="off" onSubmit={(e) => { e.preventDefault(); if (busy && !input.trim()) agent.interrupt(); else go(input); }}>
        <span className="ab-prompt" aria-hidden="true">❯</span>
        <label htmlFor="agent-input" className="sr-only">Ask about Rithvik</label>
        <input id="agent-input" ref={inputRef} className="ab-input" type="text" value={input} maxLength={500} enterKeyHint="send"
          placeholder="Ask about Rithvik, or type / for commands"
          onChange={(e) => { setInput(e.target.value); setPalIdx(0); }}
          onFocus={() => { if (!open) openAgent(); }} onClick={() => { if (!open) openAgent(); }}
          onKeyDown={onKeyDown} />
        <kbd className="ab-kbd" aria-hidden="true">⌘K</kbd>
        <button className={`ab-send${busy ? " busy" : ""}`} type="submit" aria-label={busy ? "Interrupt" : "Send"}><Icon name={busy ? "square" : "arrow-up"} /></button>
      </form>
    </div>
  );
}
