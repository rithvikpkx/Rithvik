import { useSyncExternalStore } from "react";

/** Cursor mode: the agent's actions are acted out by a visible "RAG" cursor that glides to the real element on the
 *  page, clicks it (a ripple) and only then runs the action; for an email it opens the composer and types into it.
 *  A module store like ./speech (one cursor per page). Reduced motion or performance mode: the action just runs. */

const KEY = "rithvik-rag-cursor";
const subs = new Set<() => void>();
let on: boolean | null = null;
let el: HTMLDivElement | null = null;
let at = { x: -1, y: -1 };
let queue: Promise<void> = Promise.resolve(); // one action at a time, in order
let hideT: ReturnType<typeof setTimeout> | undefined;

const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Whether cursor mode is on (persisted per browser). */
export function cursorOn(): boolean {
  if (on === null) { try { on = typeof window !== "undefined" && localStorage.getItem(KEY) === "1"; } catch { on = false; } }
  return on;
}
/** Turns cursor mode on or off. */
export function setCursorMode(v: boolean) {
  on = v;
  try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* not remembered */ }
  if (!v) hide(0);
  subs.forEach((f) => f());
}
export function useCursorMode(): boolean {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, cursorOn, () => false);
}

/** The cursor element: an arrow and a "RAG" tag, made on first use. */
function cursor(): HTMLDivElement {
  if (el?.isConnected) return el;
  el = document.createElement("div");
  el.className = "rag-cursor";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4.04 4.69a.5.5 0 0 1 .65-.65l16 6.5a.5.5 0 0 1-.07.95l-6.12 1.58a2 2 0 0 0-1.44 1.43l-1.58 6.13a.5.5 0 0 1-.95.06z"/></svg><span>RAG</span>`;
  document.body.append(el);
  return el;
}
function hide(ms = 1400) {
  clearTimeout(hideT);
  hideT = setTimeout(() => el?.classList.remove("on"), ms);
}

/** Glides the cursor to the middle of `target` (scrolling it into view first). */
async function moveTo(target: Element) {
  const r0 = target.getBoundingClientRect();
  if (r0.top < 60 || r0.bottom > innerHeight - 60) { target.scrollIntoView({ block: "center", behavior: "smooth" }); await wait(550); }
  const r = target.getBoundingClientRect();
  const to = { x: r.left + Math.min(r.width / 2, 140), y: r.top + Math.min(r.height / 2, 60) };
  const c = cursor();
  if (at.x < 0) at = { x: innerWidth / 2, y: innerHeight - 90 }; // first appearance: rises out of the agent dock
  c.classList.add("on");
  clearTimeout(hideT);
  const d = Math.hypot(to.x - at.x, to.y - at.y);
  await c.animate([{ translate: `${at.x}px ${at.y}px` }, { translate: `${to.x}px ${to.y}px` }],
    { duration: Math.min(900, 280 + d * 0.6), easing: "cubic-bezier(.3,.9,.3,1)", fill: "forwards" }).finished.catch(() => {});
  c.style.translate = `${to.x}px ${to.y}px`;
  at = to;
}
/** A click: the arrow dips and a ring spreads. */
async function click() {
  const c = cursor();
  c.classList.remove("click"); void c.offsetWidth; c.classList.add("click");
  await wait(260);
}
/** Types `text` into a React-controlled field, a few characters per frame so long drafts still finish quickly. */
async function type(field: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const set = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  field.focus({ preventScroll: true });
  const step = Math.max(1, Math.ceil(text.length / 90)); // ~90 frames at most, however long the text
  for (let i = step; i < text.length + step; i += step) {
    set.call(field, text.slice(0, i));
    field.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(16);
  }
}
/** The first element matching any selector, visible on the page. */
function find(...sels: string[]): Element | null {
  for (const s of sels) for (const e of document.querySelectorAll(s)) { const r = e.getBoundingClientRect(); if (r.width && r.height) return e; }
  for (const s of sels) { const e = document.querySelector(s); if (e) return e; }
  return null;
}
/** Waits up to ~1.5 s for an element to appear (a window that is opening). */
async function appear(sel: string): Promise<Element | null> {
  for (let i = 0; i < 30; i++) { const e = document.querySelector(sel); if (e) return e; await wait(50); }
  return null;
}

/** Where each action "lives" on the page, for the cursor to click. */
function targetFor(name: string, a: Record<string, string>): Element | null {
  switch (name) {
    case "open_project": return find(`#project-${CSS.escape(a.slug ?? "")}`, `[data-case="${CSS.escape(a.slug ?? "")}"]`, "#work");
    case "show_section": return find(`.ly-nav a[href="#${CSS.escape(a.id ?? "")}"]`, `#${CSS.escape(a.id ?? "top")}`);
    case "open_resume": return find(".pt-resume", "[data-resume]");
    case "draft_email": return find(".pt-email", "[data-compose]");
    case "start_game": return find('.ly-nav a[href="#play"]', "[data-play]", "#play");
    case "switch_design": return find(".sw-puck");
    case "open_recruiter_mode": return find(".ly-recruit");
    default: return null;
  }
}

/** Acts out one action with the cursor, then runs it (`go`). Email drafts are typed into the composer. Queued, so
 *  several actions in one answer play one after another. Falls back to just running when calm or untargetable. */
export function perform(name: string, a: Record<string, string>, go: () => void, draft?: { open: () => void; subject: string; body: string }) {
  queue = queue.then(async () => {
    const t = targetFor(name, a);
    if (calm() || !t) {
      if (draft) { draft.open(); await fill(draft); } else go();
      return;
    }
    await moveTo(t);
    await click();
    if (draft) { draft.open(); await fill(draft); } else go();
    hide();
  }).catch(() => { /* a failed animation never blocks the next action */ });
}

/** Moves into the open composer and types the subject, then the message. */
async function fill(d: { subject: string; body: string }) {
  const subj = (await appear("#cmp-subj")) as HTMLInputElement | null;
  const body = document.querySelector<HTMLTextAreaElement>("#cmp-body");
  if (!subj || !body) return;
  if (!calm()) { await moveTo(subj); await click(); }
  await type(subj, d.subject);
  if (!calm()) { await moveTo(body); await click(); }
  await type(body, d.body);
}
