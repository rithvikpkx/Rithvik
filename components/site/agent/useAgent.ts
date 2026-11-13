"use client";
import { speak, stopSpeaking } from "./speech";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadHistory, pushHistory, saveHistory, stepHistory } from "@/lib/agent/history";
import { resolveTarget } from "@/lib/agent/targets";
import { parseArtifact } from "@/lib/agent/artifacts";
import { collectContext } from "@/lib/agent/context";
import { citedNumbers } from "@/lib/agent/highlight";
import { capOffers, MAX_OFFERS } from "@/lib/agent/offers";
import { normalizeActions, type ChatAction } from "@/lib/chat-actions";
import { normalizeSuggestions, parseFrames, type AgentEvent, type Source } from "@/lib/suggestion-protocol";
import { GAMES } from "@/lib/play/games";
import { createShareLink } from "@/app/agent/share-actions";
import type { Content } from "@/lib/content/types";
import type { ComposerMeta } from "../SiteProvider";
import { formatAge, usageLines, type Usage } from "@/lib/agent/status";
import { buildTranscriptMarkdown, transcriptFilename } from "@/lib/transcript";
import { runSlash } from "./slash";
import { answerStarter } from "./starters";
import type { Design, Item, NewItem, Turn } from "./types";

/** What the agent needs from the surrounding site. */
export type Host = {
  content: Content;
  design: Design;
  openCase: (slug: string) => void;
  openResume: () => void;
  openComposer: (subject?: string, body?: string, meta?: ComposerMeta) => void;
  openPlay: (id?: string) => void;
  lite: boolean;
  setLite: (on: boolean) => void;
  close: () => void;
  toggleFull: () => void;
  toast: (message: string) => void;
  /** Slug of the case sheet the visitor came from, for page context. */
  caseSlug?: string | null;
};

type Cooldown = { until: number; status: 429 | 503 };
type Run = { ctl: AbortController; answered: boolean };
/** A proposed action waiting to become a button: nothing runs until the visitor clicks it. */
type Offer = { key: string; label: string; go: () => void; detail?: string[]; once?: boolean };

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

/** The agent's state machine: transcript items, real turns, the /api/chat stream, action buttons. */
export function useAgent(host: Host) {
  const [items, setItems] = useState<Item[]>([{ id: 0, kind: "banner" }]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busySince, setBusySince] = useState<number | null>(null);
  const [cooldown, setCooldown] = useState<Cooldown | null>(null);
  const [usage, setUsage] = useState<Usage>({ tokens: 0 }); // rate-limit headers, trailer tokens and timings
  const [sessionId, setSessionId] = useState<string | null>(readSession); // lazy: the dock only mounts client-side
  // Lazy init (not an effect): the dock only mounts client-side, so localStorage is there.
  const [history, setHistory] = useState<string[]>(() => loadHistory(typeof localStorage === "undefined" ? undefined : localStorage));

  const seq = useRef(0);
  const run = useRef<Run | null>(null);
  const hIdx = useRef(-1);
  const offers = useRef<Offer[]>([]); // this turn's proposals, turned into one row of buttons when the turn ends
  const presses = useRef(new Map<number, () => void>()); // button id → its action (held here so rows stay plain data)
  const shown = useRef<{ row: number | null; keys: string[] }>({ row: null, keys: [] }); // this turn's button row, so the late fallback offers join it
  const undos = useRef(new Map<number, () => void>());
  const selection = useRef(""); // last text the visitor selected on the page (not in the dock)

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
    setItems((p) => [...p, { ...it, ...(undo ? { undo: true } : {}), at: Date.now(), id } as Item]);
    return id;
  }, []);
  const patch = useCallback((id: number, f: (i: Item) => Item) => setItems((p) => p.map((i) => (i.id === id ? f(i) : i))), []);

  /** Records a proposed action; it becomes a button at the end of the turn and never runs by itself. */
  const offer = useCallback((key: string, label: string, go: () => void, extra?: Pick<Offer, "detail" | "once">) => {
    offers.current.push({ key, label, go, ...extra });
  }, []);

  /** Shows the pending proposals as buttons under the answer: a new row, or appended to this turn's row when the
   *  fallback actions arrive after the tool ones. Deduped by target and capped across the whole turn. */
  const flushOffers = useCallback(() => {
    const t = shown.current;
    const fresh = capOffers(offers.current.filter((o) => !t.keys.includes(o.key)), MAX_OFFERS - t.keys.length);
    offers.current = [];
    if (!fresh.length) return;
    const buttons = fresh.map((o) => {
      const id = ++seq.current;
      presses.current.set(id, o.go);
      return { id, key: o.key, label: o.label, clicked: false, ...(o.once ? { once: true } : {}) };
    });
    t.keys.push(...fresh.map((o) => o.key));
    const detail = fresh.find((o) => o.detail)?.detail;
    if (t.row === null) t.row = add({ kind: "actions", buttons, detail });
    else patch(t.row, (i) => (i.kind === "actions" ? { ...i, buttons: [...i.buttons, ...buttons], detail: i.detail ?? detail } : i));
  }, [add, patch]);

  /** Runs a button's action. Buttons stay live (until /clear) so a visitor can come back to an older answer. */
  const press = useCallback((rowId: number, buttonId: number) => {
    const go = presses.current.get(buttonId);
    if (!go) return;
    patch(rowId, (i) => (i.kind === "actions" ? { ...i, buttons: i.buttons.map((b) => (b.id === buttonId ? { ...b, clicked: true } : b)) } : i));
    go();
  }, [patch]);

  const scroll = useCallback((ids: string[]) => {
    const el = ids.map((id) => document.getElementById(id)).find(Boolean);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, []);

  /** A scroll target's display name for its button. */
  const sectionName = useCallback((target: string) => {
    if (target.startsWith("project-")) return host.content.projects.find((p) => `project-${p.slug}` === target)?.title ?? "Work";
    if (target.startsWith("experience-")) return host.content.experience.find((r) => `experience-${r.slug}` === target)?.org ?? "Experience";
    return target === "top" ? "the top" : target[0].toUpperCase() + target.slice(1);
  }, [host]);

  /** Opens the composer from the agent, tagged with this conversation so the email's owner-only context links to it. */
  const compose = useCallback((subject?: string, body?: string) => host.openComposer(subject, body, { agentSessionId: readSession() ?? undefined }), [host]);

  /** Turns a fallback server action (a record name, never a URL the model wrote) into an offer. */
  const offerAction = useCallback((a: ChatAction) => {
    if (a.type === "open_link") return offer(`link:${a.url}`, a.label.includes("↗") ? a.label : `${a.label} ↗`, () => window.open(a.url, "_blank", "noopener,noreferrer"));
    if (a.type === "open_composer") return offer("compose", "Draft email", () => compose(""));
    const r = resolveTarget(a.target);
    if (r.kind === "case") {
      const title = host.content.projects.find((p) => p.slug === r.slug)?.title;
      if (title) return offer(`case:${r.slug}`, `↗ Open ${title}`, () => host.openCase(r.slug));
    }
    offer(`scroll:${a.target}`, `↓ Go to ${sectionName(a.target)}`, () => scroll(r.kind === "scroll" ? r.ids : ["work", "top"]));
  }, [offer, compose, host, scroll, sectionName]);

  /** Sends a meeting request the visitor just clicked Send on; the row shows the outcome. Only ever called from that button. */
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

  /** Handles a model tool call the server already validated; the client re-checks names against content.
   *  Typed chat: side effects only become buttons, so nothing happens until the visitor clicks. Voice mode (`now`):
   *  the visitor asked out loud, so they happen at once with a tool row, except a meeting request, which still waits. */
  const runTool = useCallback((e: Extract<AgentEvent, { t: "tool" }>, now = false) => {
    const a = e.args ?? {};
    const tool = { name: pascal(e.name), args: Object.values(a).map((v) => clip(String(v), 40)).join(", ") };
    const act: typeof offer = (key, label, go, extra) => {
      if (!now || extra?.once) return offer(key, label, go, extra);
      go();
      if (!key.startsWith("design:")) add({ kind: "tool", name: tool.name, args: tool.args, result: label.replace(/^[↗↓]\s*/, "") }); // a design switch logs its own row, with undo
    };
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
        const entry = d?.entries.find((x) => x.id === a.id);
        if (!d || !entry) return;
        const name = entry.kind === "design" ? entry.meta.name : entry.name;
        act(`design:${a.id}`, `Switch to ${name}`, () => {
          const prev = d.current;
          d.setDesign(a.id);
          add({ kind: "tool", name: "SwitchDesign", args: a.id, result: `Applied ${name}` }, () => d.setDesign(prev));
        });
        return;
      }
      case "open_project": {
        const p = host.content.projects.find((x) => x.slug === a.slug);
        if (p) act(`case:${p.slug}`, `↗ Open ${p.title}`, () => host.openCase(p.slug));
        return;
      }
      case "show_section": {
        if (!/^[a-z0-9-]+$/.test(a.id ?? "")) return;
        const r = resolveTarget(a.id);
        act(`scroll:${a.id}`, `↓ Go to ${sectionName(a.id)}`, () => (r.kind === "case" ? scroll([a.id, "work"]) : scroll(r.ids)));
        return;
      }
      case "request_meeting": {
        if (!a.name || !a.email || !a.times) return;
        const detail = [`To: Rithvik`, `Name: ${a.name}`, `Email: ${a.email}`, a.company && `Company: ${a.company}`, a.role && `Role: ${a.role}`,
          `Times: ${a.times.split("\n").join(" · ")}`, a.notes && `Notes: ${a.notes}`].filter((x): x is string => !!x);
        act("meeting", "Send meeting request", () => void sendMeeting(a), { detail, once: true });
        return;
      }
      case "open_resume": act("resume", "Open resume", host.openResume); return;
      case "start_game": {
        const g = GAMES.find((x) => x.id === a.id);
        if (g) act(`game:${g.id}`, `Play ${g.name}`, () => host.openPlay(g.id));
        return;
      }
      case "draft_email":
        act("compose", "Draft email", () => compose(a.subject ?? "", a.body ?? ""));
        return;
    }
  }, [add, offer, compose, host, scroll, sectionName, sendMeeting]);

  const copy = useCallback((text: string, msg: string) => {
    navigator.clipboard?.writeText(text).then(() => host.toast(msg), () => {});
  }, [host]);

  /** Copies a read-only link to this conversation (the server mints it for the session this tab holds). */
  const share = useCallback(async () => {
    if (!sessionId) return;
    try {
      const r = await createShareLink(sessionId);
      if (!r.ok) return host.toast(r.error);
      await navigator.clipboard.writeText(location.origin + r.path);
      host.toast("Link copied · expires in 30 days");
    } catch {
      host.toast("Could not copy the link");
    }
  }, [host, sessionId]);

  // The export reads the latest rows through a ref, so the callbacks below stay stable.
  const itemsRef = useRef(items);
  const usageRef = useRef(usage);
  useEffect(() => { itemsRef.current = items; usageRef.current = usage; });

  /** The whole conversation as Markdown: every row the panel shows, under a session/model header. */
  const exportMd = useCallback(() => buildTranscriptMarkdown(itemsRef.current, Date.now(), {
    session: readSession(), model: process.env.NEXT_PUBLIC_CHAT_MODEL, design: host.design?.current, tokens: usageRef.current.tokens,
  }), [host]);

  const copyChat = useCallback(() => copy(exportMd(), "Chat copied"), [copy, exportMd]);

  /** Saves the Markdown as rag-chat-<date-time>.md through a throwaway link. */
  const downloadChat = useCallback(() => {
    const url = URL.createObjectURL(new Blob([exportMd()], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = transcriptFilename(Date.now());
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); // after the click has been handled
  }, [exportMd]);

  /** The /usage row: this visitor's hourly window (a free read, it never counts as a turn), tokens and timings. */
  const showUsage = useCallback(async () => {
    const rid = add({ kind: "tool", name: "Usage", args: "", result: "checking…" });
    let u = usageRef.current;
    try {
      const r = await fetch("/api/chat/usage", { cache: "no-store" });
      if (r.ok) {
        const j = (await r.json()) as { limit: number; remaining: number; reset: number | null };
        u = { ...u, limit: j.limit, remaining: j.remaining, reset: j.reset ?? undefined };
        setUsage(u);
      }
    } catch { /* fall back to what the last response said */ }
    patch(rid, (i) => (i.kind === "tool" ? { ...i, result: "This visitor, this session", lines: usageLines(u, process.env.NEXT_PUBLIC_CHAT_MODEL, Date.now()) } : i));
  }, [add, patch]);

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
    offers.current = [];
    shown.current = { row: null, keys: [] };
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
      flushOffers(); // the tools' proposals appear with the answer, not after the slower suggestions
      setTurns((p) => [...p, { q, a: answer, suggestions: [], at }]);
      const totalMs = Date.now() - at;
      setUsage((p) => ({ ...p, totalMs }));
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
      const num = (h: string) => { const v = res.headers.get(h); return v !== null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined; };
      const limit = num("X-RateLimit-Limit"), remaining = num("X-RateLimit-Remaining");
      if (limit !== undefined && remaining !== undefined) setUsage((p) => ({ ...p, limit, remaining, reset: num("X-RateLimit-Reset") }));
      const cache = res.headers.get("x-vercel-cache") ?? res.headers.get("x-cache") ?? undefined; // only when the host sends one
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
      let first = true; // first body chunk = time to first byte
      let seen = 0; // parts already handled; the last one may be a text run that is still growing
      const rows = new Map<number, number>(); // part index → answer item id (events map to -1)
      while (true) {
        const { done, value } = await reader.read();
        if (gone()) return;
        if (done) break;
        if (first) { first = false; const ttfbMs = Date.now() - at; setUsage((p) => ({ ...p, ttfbMs, cache, cached: false })); }
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
          } else if (e.t === "cache") {
            setUsage((p) => ({ ...p, cached: true }));
            add({ kind: "tool", name: "Cache", args: "semantic", result: `hit · answered ${formatAge(e.age)} ago` });
          } else if (e.t === "sources") sources = Array.isArray(e.items) ? e.items : [];
          else if (e.t === "tool") runTool(e);
          else if (e.t === "artifact") {
            const a = parseArtifact(e.spec); // the client trusts no frame: rebuild it through the same gate
            if (a.ok) add({ kind: "artifact", spec: a.spec });
          }
          else if (e.t === "done") finish();
          else if (e.t === "trailer") {
            const used = Number(e.usage?.total_tokens);
            if (used > 0) setUsage((p) => ({ ...p, tokens: p.tokens + used, lastTokens: used }));
            normalizeActions(e.actions).forEach(offerAction);
            flushOffers(); // fallback buttons join the row (or start it), ahead of the follow-up chips
            const chips = normalizeSuggestions(e.suggestions);
            if (chips.length) {
              setTurns((t) => t.map((x) => (x.at === at ? { ...x, suggestions: chips } : x)));
              add({ kind: "suggest", chips });
            }
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
  }, [add, host, patch, offerAction, flushOffers, runTool, settle, turns]);

  const clear = useCallback(() => {
    const r = run.current;
    run.current = null;
    r?.ctl.abort();
    offers.current = [];
    presses.current.clear();
    undos.current.clear();
    setBusySince(null);
    setTurns([]);
    setUsage({ tokens: 0 });
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
        add, clear, scroll, copy, turns, exportMd, usage: showUsage, history: next,
        content: host.content, design: host.design, toggleFull: host.toggleFull, close: host.close,
        openCase: host.openCase, openResume: host.openResume, openComposer: compose,
        openPlay: host.openPlay, lite: host.lite, setLite: host.setLite, share, canShare: !!sessionId && turns.length > 0, download: downloadChat,
      });
    }
    // Starter chips answer instantly from content, with no /api/chat call.
    else if (!answerStarter(q, host.content, add, (a) => setTurns((p) => [...p, { q, a, suggestions: [], at: Date.now() }]))) void converse(q);
    return true;
  }, [add, clear, compose, converse, cooldown, copy, exportMd, downloadChat, history, host, interrupt, scroll, sessionId, share, showUsage, turns]);

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

  // ---- voice mode (GPT-Live): its transcripts land in the log as ordinary question and answer rows ----
  const liveRow = useRef<{ who: "user" | "agent"; id: number; text: string } | null>(null);
  const liveQ = useRef("");
  /** Closes the open live row: an answer stops streaming and joins the history as a turn. */
  const liveTurnEnd = useCallback(() => {
    const cur = liveRow.current;
    liveRow.current = null;
    if (!cur) return;
    if (cur.who === "user") { liveQ.current = cur.text; return; }
    patch(cur.id, (i) => (i.kind === "answer" ? { ...i, streaming: false } : i));
    const q = liveQ.current, a = cur.text;
    setTurns((p) => [...p, { q, a, suggestions: [], at: Date.now() }]);
  }, [patch]);
  /** Appends live transcript text, opening a new row whenever the speaker changes. */
  const liveText = useCallback((who: "user" | "agent", delta: string) => {
    const cur = liveRow.current;
    if (cur && cur.who === who) {
      cur.text += delta;
      const t = cur.text;
      patch(cur.id, (i) => (i.kind === "user" || i.kind === "answer" ? { ...i, text: t } : i));
      return;
    }
    liveTurnEnd();
    const text = delta.replace(/^\s+/, "");
    const id = add(who === "user" ? { kind: "user", text } : { kind: "answer", text, streaming: true });
    liveRow.current = { who, id, text };
  }, [add, patch, liveTurnEnd]);

  /** Voice mode: one tool call from the live model. The server validates it (the same gate as typed chat); then it
   *  runs here at once and the result text goes back to the model. */
  const liveTool = useCallback(async (name: string, args: string): Promise<string> => {
    let j: { call?: { id: string; name: string; args: Record<string, string>; result?: string; artifact?: unknown } | null; reply?: string } = {};
    try {
      const res = await fetch("/api/voice/tool", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, arguments: args, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      j = await res.json();
    } catch { return "Rejected: the action could not run."; }
    const c = j.call;
    if (c) {
      liveTurnEnd(); // what the voice says next lands under the action, not above it
      if (c.artifact) { const p = parseArtifact(c.artifact); if (p.ok) add({ kind: "artifact", spec: p.spec }); }
      else runTool({ t: "tool", id: c.id, name: c.name, args: c.args, result: c.result }, true);
      flushOffers();
    }
    return j.reply ?? "Rejected.";
  }, [add, runTool, flushOffers, liveTurnEnd]);

  return { liveText, liveTurnEnd, liveTool, items, turns, usage, canExport: items.some((i) => i.kind === "user"), copyChat, downloadChat, canShare: !!sessionId && turns.length > 0, share, history, busySince, cooldown, submit, interrupt, press, recall, undo, clear, copy };
}
