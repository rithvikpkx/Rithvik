"use client";
import { speak, stopSpeaking } from "./speech";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadHistory, pushHistory, saveHistory, stepHistory } from "@/lib/agent/history";
import { resolveTarget } from "@/lib/agent/targets";
import { collectContext } from "@/lib/agent/context";
import { autoScrollTarget, citedNumbers } from "@/lib/agent/highlight";
import { scrollAndHighlight } from "./highlight";
import { normalizeActions, type ChatAction } from "@/lib/chat-actions";
import { normalizeSuggestions, parseFrames, type AgentEvent, type Source } from "@/lib/suggestion-protocol";
import { GAMES } from "@/lib/play/games";
import type { Content } from "@/lib/content/types";
import { runSlash } from "./slash";
import { answerStarter } from "./starters";
import type { Choice, Design, Item, NewItem, Turn } from "./types";

/** What the agent needs from the surrounding site. */
export type Host = {
  content: Content;
  design: Design;
  openCase: (slug: string) => void;
  openResume: () => void;
  openComposer: (subject?: string, body?: string) => void;
  openPlay: (id?: string) => void;
  close: () => void;
  toggleFull: () => void;
  toast: (message: string) => void;
  /** Slug of the case sheet the visitor came from, for page context. */
  caseSlug?: string | null;
  /** Live view state (read when an answer lands, not when it was asked). */
  view?: () => { full: boolean; covered: boolean };
};

type Cooldown = { until: number; status: 429 | 503 };
type Run = { ctl: AbortController; answered: boolean };
type Ask = { question: string; key: string; go: () => void; tool?: { name: string; args: string }; detail?: string[]; once?: boolean };

const SESSION_KEY = "rithvik-agent-session";
/** The server-issued conversation id for this tab, or null (no storage, or no turn answered yet). */
const readSession = () => { try { return sessionStorage.getItem(SESSION_KEY); } catch { return null; } };
const writeSession = (id: string | null) => { try { if (id) sessionStorage.setItem(SESSION_KEY, id); else sessionStorage.removeItem(SESSION_KEY); } catch { /* private mode: the id just isn't remembered */ } };

/** Clips a question for the Search(...) row. */
const clip = (s: string, n = 48) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
/** open_project → OpenProject, for the tool row. */
const pascal = (s: string) => s.replace(/(^|_)(\w)/g, (_, __, c: string) => c.toUpperCase());
/** The [n] markers an answer cites, in first-seen order, limited to real sources. */
const cited = (text: string, sources: Source[]) =>
  citedNumbers(text).map((n) => sources.find((s) => s.n === n)).filter((s): s is Source => !!s);

/** The agent's state machine: transcript items, real turns, the /api/chat stream, confirmations. */
export function useAgent(host: Host) {
  const [items, setItems] = useState<Item[]>([{ id: 0, kind: "banner" }]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busySince, setBusySince] = useState<number | null>(null);
  const [cooldown, setCooldown] = useState<Cooldown | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(readSession); // lazy: the dock only mounts client-side
  // Lazy init (not an effect): the dock only mounts client-side, so localStorage is there.
  const [history, setHistory] = useState<string[]>(() => loadHistory(typeof localStorage === "undefined" ? undefined : localStorage));

  const seq = useRef(0);
  const run = useRef<Run | null>(null);
  const hIdx = useRef(-1);
  const always = useRef(new Set<string>());
  const asks = useRef(new Map<number, Ask>());
  const queue = useRef<Ask[]>([]); // side effects waiting behind the one on screen, run strictly in order
  const undos = useRef(new Map<number, () => void>());
  const selection = useRef(""); // last text the visitor selected on the page (not in the dock)
  const activity = useRef(0); // last time the visitor scrolled or typed on the page

  // Scrolling or typing outside the dock marks the visitor busy, so an answer won't yank the page.
  useEffect(() => {
    const mark = (e: Event) => {
      if (e.type === "keydown" && e.target instanceof Element && e.target.closest(".agent")) return;
      activity.current = Date.now();
    };
    const evs = ["wheel", "touchmove", "keydown"] as const;
    evs.forEach((t) => window.addEventListener(t, mark, { passive: true }));
    return () => evs.forEach((t) => window.removeEventListener(t, mark));
  }, []);

  // Remember the page selection so "explain this" still has it after focus moves to the prompt.
  useEffect(() => {
    const onSel = () => {
      const s = document.getSelection();
      const node = s?.anchorNode instanceof Element ? s.anchorNode : s?.anchorNode?.parentElement;
      const text = s?.toString().trim() ?? "";
      if (text && !node?.closest(".agent")) selection.current = text.slice(0, 500);
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  /** Appends a row. `undo` (tool rows only) is held in a ref so state stays plain data and the
   *  callback never runs inside a state updater. */
  const add = useCallback((it: NewItem, undo?: () => void): number => {
    const id = ++seq.current;
    if (undo) undos.current.set(id, undo);
    setItems((p) => [...p, { ...it, ...(undo ? { undo: true } : {}), id } as Item]);
    return id;
  }, []);
  const patch = useCallback((id: number, f: (i: Item) => Item) => setItems((p) => p.map((i) => (i.id === id ? f(i) : i))), []);

  /** Shows the next queued side effect once nothing is waiting; "Always" keys run without asking. */
  const pump = useCallback(() => {
    while (asks.current.size === 0 && queue.current.length) {
      const a = queue.current.shift()!;
      if (always.current.has(a.key)) {
        add({ kind: "ask", question: a.question, state: "auto", tool: a.tool });
        a.go();
        continue;
      }
      asks.current.set(add({ kind: "ask", question: a.question, state: "pending", tool: a.tool, detail: a.detail, once: a.once }), a);
    }
  }, [add]);

  /** Queues a side effect behind a permission row. One row is pending at a time, in request order. */
  const ask = useCallback((question: string, key: string, go: () => void, tool?: Ask["tool"], extra?: Pick<Ask, "detail" | "once">) => {
    queue.current.push({ question, key, go, tool, ...extra });
    pump();
  }, [pump]);

  /** Resolves a confirmation: Yes and Always run it, No drops it; then the next one shows. */
  const answerAsk = useCallback((id: number, choice: Choice) => {
    const a = asks.current.get(id);
    if (!a || (a.once && choice === "always")) return; // a send is confirmed every time
    asks.current.delete(id);
    if (choice === "always") always.current.add(a.key);
    patch(id, (i) => (i.kind === "ask" ? { ...i, state: choice } : i));
    if (choice !== "no") a.go();
    pump();
  }, [patch, pump]);

  const pending = useMemo(() => items.find((i): i is Extract<Item, { kind: "ask" }> => i.kind === "ask" && i.state === "pending") ?? null, [items]);

  const scroll = useCallback((ids: string[]) => {
    const el = ids.map((id) => document.getElementById(id)).find(Boolean);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, []);

  /** A scroll target as a confirmation phrase. */
  const sectionName = useCallback((target: string) => {
    if (target.startsWith("project-")) return host.content.projects.find((p) => `project-${p.slug}` === target)?.title ?? "work";
    if (target.startsWith("experience-")) return host.content.experience.find((r) => `experience-${r.slug}` === target)?.org ?? "experience";
    return target === "top" ? "the top" : target;
  }, [host]);

  /** Turns a fallback server action (a record name, never a URL the model wrote) into a confirmation row. */
  const queueAction = useCallback((a: ChatAction) => {
    if (a.type === "open_link") return ask(`Open "${a.label}" in a new tab?`, "link", () => window.open(a.url, "_blank", "noopener,noreferrer"));
    if (a.type === "open_composer") return ask("Draft an email to Rithvik?", "compose", () => host.openComposer(""));
    const r = resolveTarget(a.target);
    if (r.kind === "case") {
      const title = host.content.projects.find((p) => p.slug === r.slug)?.title;
      if (title) return ask(`Open project "${title}"?`, "open-project", () => host.openCase(r.slug));
    }
    const section = a.target.startsWith("experience") ? "experience" : a.target.startsWith("education") ? "education" : a.target.startsWith("project") ? "work" : "about";
    ask(`Scroll to ${section}?`, "navigate", () => scroll(r.kind === "scroll" ? r.ids : ["work", "top"]));
  }, [ask, host, scroll]);

  /** Sends a meeting request the visitor just confirmed; the row shows the outcome. Only ever called from the confirmation. */
  const sendMeeting = useCallback(async (m: Record<string, string>) => {
    const rid = add({ kind: "tool", name: "Meeting", args: m.email });
    const done = (result: string) => patch(rid, (i) => (i.kind === "tool" ? { ...i, result } : i));
    try {
      const res = await fetch("/api/agent/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...m, times: (m.times ?? "").split("\n"), sessionId: readSession() }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      done(res.ok ? `Sent. Rithvik will reply to ${m.email}` : j.error || "Could not send right now.");
    } catch {
      done("Could not send right now.");
    }
  }, [add, patch]);

  /** Runs a model tool call the server already validated; the client re-checks names against
   *  content before acting. Side effects ask first; switch_design runs at once with Undo. */
  const runTool = useCallback((e: Extract<AgentEvent, { t: "tool" }>) => {
    const a = e.args ?? {};
    const tool = { name: pascal(e.name), args: Object.values(a).map((v) => clip(String(v), 40)).join(", ") };
    switch (e.name) {
      case "local_time":
        add({ kind: "tool", name: tool.name, args: tool.args, result: e.result ?? "time unavailable" });
        return;
      case "check_availability":
      case "suggest_times":
        // The server already ran it; the summary is free/busy and times only.
        add({ kind: "tool", name: "Calendar", args: [e.name, a.startISO ?? a.fromISO].filter(Boolean).join(", "), result: e.result ?? "Calendar unavailable" });
        return;
      case "switch_design": {
        const d = host.design;
        if (!d || !d.entries.some((x) => x.id === a.id)) { add({ kind: "tool", name: tool.name, args: tool.args, result: "Not available here" }); return; }
        const prev = d.current;
        d.setDesign(a.id);
        add({ kind: "tool", name: tool.name, args: tool.args, result: `Applied ${a.id}` }, () => d.setDesign(prev));
        return;
      }
      case "open_project": {
        const p = host.content.projects.find((x) => x.slug === a.slug);
        if (p) ask(`Open project "${p.title}"?`, "open-project", () => host.openCase(p.slug), tool);
        return;
      }
      case "show_section": {
        if (!/^[a-z0-9-]+$/.test(a.id ?? "")) return;
        const r = resolveTarget(a.id);
        ask(`Scroll to ${sectionName(a.id)}?`, "navigate", () => (r.kind === "case" ? scroll([a.id, "work"]) : scroll(r.ids)), tool);
        return;
      }
      case "request_meeting": {
        if (!a.name || !a.email || !a.times) return;
        const detail = [`To: Rithvik`, `Name: ${a.name}`, `Email: ${a.email}`, a.company && `Company: ${a.company}`, a.role && `Role: ${a.role}`,
          `Times${a.timeZone ? ` (${a.timeZone})` : ""}: ${a.times.split("\n").join(" · ")}`, a.notes && `Notes: ${a.notes}`].filter((x): x is string => !!x);
        ask("Send this to Rithvik?", "meeting", () => void sendMeeting(a), { name: "RequestMeeting", args: a.name }, { detail, once: true });
        return;
      }
      case "open_resume": ask("Open the resume?", "resume", host.openResume, tool); return;
      case "start_game": {
        const g = GAMES.find((x) => x.id === a.id);
        if (g) ask(`Start ${g.name}?`, "play", () => host.openPlay(g.id), tool);
        return;
      }
      case "draft_email":
        ask(`Draft an email to Rithvik${a.subject ? `: "${clip(a.subject, 60)}"` : ""}?`, "compose", () => host.openComposer(a.subject ?? "", a.body ?? ""), { ...tool, args: clip(a.subject ?? "", 40) });
        return;
    }
  }, [add, ask, host, scroll, sectionName, sendMeeting]);

  const copy = useCallback((text: string, msg: string) => {
    navigator.clipboard?.writeText(text).then(() => host.toast(msg), () => {});
  }, [host]);

  /** Marks every answer row of the turn as finished. */
  const settle = useCallback((ids: number[]) => ids.forEach((id) => patch(id, (i) => (i.kind === "answer" ? { ...i, streaming: false } : i))), [patch]);
  const answerIds = useRef<number[]>([]);

  /** Stops the in-flight turn. Before the answer completes it leaves "Interrupted"; after, it only drops the trailing chips. */
  const interrupt = useCallback(() => {
    stopSpeaking(); // a new question or Esc silences any reply being read aloud
    const r = run.current;
    if (!r) return;
    run.current = null;
    r.ctl.abort();
    setBusySince(null);
    settle(answerIds.current);
    if (!r.answered) add({ kind: "note", text: "Interrupted" });
  }, [add, settle]);

  /** One question to /api/chat, rendered progressively from protocol v2 frames. History is real turns only. */
  const converse = useCallback(async (q: string) => {
    const me: Run = { ctl: new AbortController(), answered: false };
    run.current = me;
    answerIds.current = [];
    setBusySince(Date.now());
    const gone = () => run.current !== me; // interrupted or cleared: stop touching the transcript
    const at = Date.now();
    const context = collectContext({ design: host.design?.current, caseSlug: host.caseSlug ?? undefined, selection: selection.current || undefined });
    selection.current = ""; // a quote applies to one question
    let sources: Source[] = [];
    let answer = "";
    const finish = () => {
      if (me.answered) return;
      me.answered = true;
      setBusySince(null);
      void speak(answer); // no-op unless the visitor turned the speaker on
      settle(answerIds.current);
      const notes = cited(answer, sources);
      if (notes.length) add({ kind: "sources", items: notes });
      // Once per answer: bring the most relevant cited site record into view, unless that would fight the visitor.
      const target = autoScrollTarget({
        answer, sources, exists: (id) => !!document.getElementById(id),
        ...(host.view?.() ?? { full: false, covered: false }), lastActivity: activity.current, now: Date.now(),
      });
      if (target) scrollAndHighlight(target);
      setTurns((p) => [...p, { q, a: answer, suggestions: [], at }]);
    };
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: me.ctl.signal,
        body: JSON.stringify({
          message: q,
          // Same slice the server keeps (5 messages); only completed exchanges, no notices or interrupted turns.
          messages: turns.flatMap((t) => [{ role: "user", content: t.q }, { role: "assistant", content: t.a }]).slice(-5),
          offered: turns.slice(-2).flatMap((t) => t.suggestions),
          context,
          sessionId: readSession() ?? undefined,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (gone()) return;
      const sid = res.headers.get("X-Agent-Session");
      if (sid && sid !== readSession()) { writeSession(sid); setSessionId(sid); }
      if (!res.ok) {
        const text = (await res.text().catch(() => "")).trim();
        if (res.status === 429 || res.status === 503) {
          const secs = Number(res.headers.get("Retry-After")) || (res.status === 429 ? 3600 : 60);
          setCooldown({ until: Date.now() + secs * 1000, status: res.status });
        }
        add({ kind: "note", tone: "warn", text: text || "Something went wrong. Try again." });
        return;
      }
      if (!res.body) throw new Error("Something went wrong. Try again.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let seen = 0; // parts already handled; the last one may be a text run that is still growing
      const rows = new Map<number, number>(); // part index → answer item id (events map to -1)
      while (true) {
        const { done, value } = await reader.read();
        if (gone()) return;
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const parts = parseFrames(acc);
        answer = parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim();
        for (let i = Math.max(0, seen - 1); i < parts.length; i++) {
          const p = parts[i];
          if (p.type === "text") {
            const id = rows.get(i);
            if (id !== undefined) patch(id, (it) => (it.kind === "answer" ? { ...it, text: p.text.trim() } : it));
            else if (p.text.trim()) {
              const nid = add({ kind: "answer", text: p.text.trim(), streaming: true });
              rows.set(i, nid);
              answerIds.current.push(nid);
            }
            continue;
          }
          if (rows.has(i)) continue;
          rows.set(i, -1);
          settle(answerIds.current); // text before an event is complete
          const e = p.event;
          if (e.t === "rewrite") add({ kind: "tool", name: "Rewrite", args: `"${clip(e.q, 60)}"` });
          else if (e.t === "search") {
            const top = (e.top ?? []).map((h) => `${h.src} ${Number(h.score).toFixed(2)}`).join(", ");
            add({ kind: "tool", name: "Search", args: `site, "${clip(e.q)}"`, result: `${e.n} record${e.n === 1 ? "" : "s"}${top ? ` · ${top}` : " · answering from the profile"}` });
          } else if (e.t === "sources") sources = Array.isArray(e.items) ? e.items : [];
          else if (e.t === "tool") runTool(e);
          else if (e.t === "done") finish();
          else if (e.t === "trailer") {
            const chips = normalizeSuggestions(e.suggestions);
            if (chips.length) {
              setTurns((t) => t.map((x) => (x.at === at ? { ...x, suggestions: chips } : x)));
              add({ kind: "suggest", chips });
            }
            normalizeActions(e.actions).forEach(queueAction);
          }
        }
        seen = parts.length;
      }
      if (!answer && !me.answered) {
        add({ kind: "note", tone: "warn", text: "No answer came back. Try again." });
        return;
      }
      finish();
    } catch (e) {
      if (gone()) return;
      settle(answerIds.current);
      add({ kind: "note", tone: "warn", text: e instanceof Error && e.message ? e.message : "Something went wrong. Try again." });
    } finally {
      if (!gone()) {
        run.current = null;
        setBusySince(null);
      }
    }
  }, [add, host, patch, queueAction, runTool, settle, turns]);

  const clear = useCallback(() => {
    const r = run.current;
    run.current = null;
    r?.ctl.abort();
    asks.current.clear();
    queue.current = [];
    undos.current.clear();
    setBusySince(null);
    setTurns([]);
    writeSession(null); // a cleared transcript is a new conversation server-side too
    setSessionId(null);
    setItems([{ id: ++seq.current, kind: "banner" }]);
  }, []);

  /** Sends or runs what was typed. False means it was refused and the text should stay in the input. */
  const submit = useCallback((raw: string): boolean => {
    const q = raw.trim();
    if (!q) return false;
    const isSlash = q.startsWith("/");
    if (!isSlash && cooldown && cooldown.until > Date.now()) {
      add({ kind: "note", tone: "warn", text: "Rate limited. Slash commands still work; questions resume when the timer clears." });
      return false;
    }
    interrupt();
    const next = pushHistory(history, q);
    setHistory(next);
    saveHistory(typeof localStorage === "undefined" ? undefined : localStorage, next);
    hIdx.current = -1;
    add({ kind: "user", text: q });
    if (isSlash) {
      runSlash(q, {
        add, ask, clear, scroll, copy, turns, history: next,
        content: host.content, design: host.design, toggleFull: host.toggleFull, close: host.close,
        openCase: host.openCase, openResume: host.openResume, openComposer: host.openComposer,
      });
    }
    // Starter chips answer instantly from content, with no /api/chat call.
    else if (!answerStarter(q, host.content, add, (a) => setTurns((p) => [...p, { q, a, suggestions: [], at: Date.now() }]))) void converse(q);
    return true;
  }, [add, ask, clear, converse, cooldown, copy, history, host, interrupt, scroll, turns]);

  /** ↑/↓ through prompt history; returns the text to put in the input, or null when there is none. */
  const recall = useCallback((dir: 1 | -1): string | null => {
    if (!history.length || (dir === -1 && hIdx.current < 0)) return null;
    const r = stepHistory(history, hIdx.current, dir);
    hIdx.current = r.idx;
    return r.value;
  }, [history]);

  const undo = useCallback((id: number) => {
    const f = undos.current.get(id);
    if (!f) return;
    undos.current.delete(id);
    f();
    patch(id, (i) => (i.kind === "tool" ? { ...i, undo: false, result: `${i.result ?? ""} · undone` } : i));
  }, [patch]);

  return { items, turns, sessionId, history, busySince, cooldown, pendingId: pending?.id ?? null, pending, submit, interrupt, answerAsk, recall, undo, clear, copy };
}
