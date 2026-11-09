"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { loadHistory, pushHistory, saveHistory, stepHistory } from "@/lib/agent/history";
import { resolveTarget } from "@/lib/agent/targets";
import { normalizeActions, type ChatAction } from "@/lib/chat-actions";
import { splitStream, SUGGESTIONS_SENTINEL } from "@/lib/suggestion-protocol";
import type { Content } from "@/lib/content/types";
import type { useDesign } from "../DesignProvider";
import { runSlash } from "./slash";
import type { Choice, Item, NewItem, Turn } from "./types";

/** The current design engine API, or null when no provider is mounted (the lab harness). */
export type Design = ReturnType<typeof useDesign> | null;

/** What the agent needs from the surrounding site. */
export type Host = {
  content: Content;
  design: Design;
  openCase: (slug: string) => void;
  openResume: () => void;
  openComposer: (subject?: string) => void;
  close: () => void;
  toggleFull: () => void;
  toast: (message: string) => void;
};

type Cooldown = { until: number; status: 429 | 503 };
type Run = { ctl: AbortController; answerId: number | null; answered: boolean };

/** Clips a question for the Search(...) row. */
const clip = (s: string, n = 48) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** The agent's state machine: transcript items, real turns, the /api/chat stream, confirmations. */
export function useAgent(host: Host) {
  const [items, setItems] = useState<Item[]>([{ id: 0, kind: "banner" }]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busySince, setBusySince] = useState<number | null>(null);
  const [cooldown, setCooldown] = useState<Cooldown | null>(null);
  // Lazy init (not an effect): the dock only mounts client-side, so localStorage is there.
  const [history, setHistory] = useState<string[]>(() => loadHistory(typeof localStorage === "undefined" ? undefined : localStorage));

  const seq = useRef(0);
  const run = useRef<Run | null>(null);
  const hIdx = useRef(-1);
  const always = useRef(new Set<string>());
  const asks = useRef(new Map<number, { key: string; run: () => void }>());
  const undos = useRef(new Map<number, () => void>());

  /** Appends a row. `undo` (tool rows only) is held in a ref so state stays plain data and the
   *  callback never runs inside a state updater. */
  const add = useCallback((it: NewItem, undo?: () => void): number => {
    const id = ++seq.current;
    if (undo) undos.current.set(id, undo);
    setItems((p) => [...p, { ...it, ...(undo ? { undo: true } : {}), id } as Item]);
    return id;
  }, []);
  const patch = useCallback((id: number, f: (i: Item) => Item) => setItems((p) => p.map((i) => (i.id === id ? f(i) : i))), []);

  /** Queues a side effect behind a permission row; "Always this session" skips the row next time. */
  const ask = useCallback((question: string, key: string, go: () => void) => {
    if (always.current.has(key)) {
      add({ kind: "ask", question, state: "auto" });
      go();
      return;
    }
    asks.current.set(add({ kind: "ask", question, state: "pending" }), { key, run: go });
  }, [add]);

  /** Resolves a confirmation: Yes and Always run it, No drops it. */
  const answerAsk = useCallback((id: number, choice: Choice) => {
    const a = asks.current.get(id);
    if (!a) return;
    asks.current.delete(id);
    if (choice === "always") always.current.add(a.key);
    patch(id, (i) => (i.kind === "ask" ? { ...i, state: choice } : i));
    if (choice !== "no") a.run();
  }, [patch]);

  const pendingId = useMemo(() => items.find((i) => i.kind === "ask" && i.state === "pending")?.id ?? null, [items]);

  const scroll = useCallback((ids: string[]) => {
    const el = ids.map((id) => document.getElementById(id)).find(Boolean);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, []);

  /** Turns a server action (a record name, never a URL the model wrote) into a confirmation row. */
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

  const copy = useCallback((text: string, msg: string) => {
    navigator.clipboard?.writeText(text).then(() => host.toast(msg), () => {});
  }, [host]);

  /** Stops the in-flight turn. Before the answer completes it leaves "Interrupted"; after, it only drops the trailing chips. */
  const interrupt = useCallback(() => {
    const r = run.current;
    if (!r) return;
    run.current = null;
    r.ctl.abort();
    setBusySince(null);
    if (r.answerId !== null) patch(r.answerId, (i) => (i.kind === "answer" ? { ...i, streaming: false } : i));
    if (!r.answered) add({ kind: "note", text: "Interrupted" });
  }, [add, patch]);

  /** One question to /api/chat, streamed into the transcript. History is real turns only. */
  const converse = useCallback(async (q: string) => {
    const me: Run = { ctl: new AbortController(), answerId: null, answered: false };
    run.current = me;
    setBusySince(Date.now());
    const searchId = add({ kind: "tool", name: "Search", args: `site, "${clip(q)}"` });
    const gone = () => run.current !== me; // interrupted or cleared: stop touching the transcript
    const at = Date.now();
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
        }),
      });
      if (gone()) return;
      if (!res.ok) {
        const text = (await res.text().catch(() => "")).trim();
        if (res.status === 429 || res.status === 503) {
          const secs = Number(res.headers.get("Retry-After")) || (res.status === 429 ? 3600 : 60);
          setCooldown({ until: Date.now() + secs * 1000, status: res.status });
        }
        patch(searchId, (i) => (i.kind === "tool" ? { ...i, result: "no response" } : i));
        add({ kind: "note", tone: "warn", text: text || "Something went wrong. Try again." });
        return;
      }
      if (!res.body) throw new Error("Something went wrong. Try again.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (gone()) return;
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const { answer } = splitStream(acc);
        if (me.answerId === null && answer.trim()) {
          me.answerId = add({ kind: "answer", text: answer, streaming: true });
          patch(searchId, (i) => (i.kind === "tool" ? { ...i, result: "read site records" } : i));
        } else if (me.answerId !== null) {
          patch(me.answerId, (i) => (i.kind === "answer" ? { ...i, text: answer } : i));
        }
        // The sentinel means the answer is complete (chips may still be verifying): unlock now.
        if (!me.answered && acc.includes(SUGGESTIONS_SENTINEL)) {
          me.answered = true;
          setBusySince(null);
          if (me.answerId !== null) patch(me.answerId, (i) => (i.kind === "answer" ? { ...i, streaming: false } : i));
          setTurns((p) => [...p, { q, a: answer, suggestions: [], at }]);
        }
      }
      const { answer, suggestions, actions } = splitStream(acc);
      if (me.answerId === null) {
        patch(searchId, (i) => (i.kind === "tool" ? { ...i, result: "no response" } : i));
        add({ kind: "note", tone: "warn", text: "No answer came back. Try again." });
        return;
      }
      patch(me.answerId, (i) => (i.kind === "answer" ? { ...i, text: answer, streaming: false } : i));
      if (!me.answered) setTurns((p) => [...p, { q, a: answer, suggestions: [], at }]);
      if (suggestions?.length) {
        setTurns((p) => p.map((t) => (t.at === at ? { ...t, suggestions } : t)));
        add({ kind: "suggest", chips: suggestions });
      }
      normalizeActions(actions).forEach(queueAction);
    } catch (e) {
      if (gone()) return;
      if (me.answerId !== null) patch(me.answerId, (i) => (i.kind === "answer" ? { ...i, streaming: false } : i));
      add({ kind: "note", tone: "warn", text: e instanceof Error && e.message ? e.message : "Something went wrong. Try again." });
    } finally {
      if (!gone()) {
        run.current = null;
        setBusySince(null);
      }
    }
  }, [add, patch, queueAction, turns]);

  const clear = useCallback(() => {
    const r = run.current;
    run.current = null;
    r?.ctl.abort();
    asks.current.clear();
    undos.current.clear();
    setBusySince(null);
    setTurns([]);
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
    if (isSlash) runSlash(q, { add, clear, history: next, toggleFull: host.toggleFull, close: host.close });
    else void converse(q);
    return true;
  }, [add, clear, converse, cooldown, history, host, interrupt]);

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

  return { items, turns, history, busySince, cooldown, pendingId, submit, interrupt, answerAsk, recall, undo, clear, copy };
}
