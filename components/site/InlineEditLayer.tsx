"use client";
import "./inline-edit.css";
import { useEffect, useRef, useState } from "react";

export type SaveFn = (key: string, value: string) => Promise<{ ok: true } | { ok: false; error: string }>;
type Tag = { top: number; left: number; text: string; state: "editing" | "saving" | "saved" | "error" };

/** The in-place editor. While mounted (only when the admin turned inline editing on) every `[data-edit="<key>"]` element is
 *  editable as plain text: click it, type, Enter or click away saves, Esc cancels. The save is optimistic; a failure rolls the
 *  text back and shows a toast. Event delegation on `document`, so designs stay plain markup and nothing is set on elements
 *  until they are clicked. Mounted by InlineEdit.tsx; the lab harness mounts it directly with a stubbed `save`. */
export default function InlineEditLayer({ save, toast }: { save: SaveFn; toast: (message: string) => void }) {
  const [tag, setTag] = useState<Tag | null>(null);
  const latest = useRef({ save, toast });
  useEffect(() => { latest.current = { save, toast }; });

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("inline-edit-on");
    const before = new WeakMap<HTMLElement, string>(); // text as it was when editing began (the rollback value)
    let current: HTMLElement | null = null;
    let tagTimer: ReturnType<typeof setTimeout> | undefined;

    const field = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>("[data-edit]") : null);
    /** Floats the status chip just above the field (below when it is at the top of the screen), in document coordinates. */
    const showTag = (el: HTMLElement, text: string, state: Tag["state"], hideAfter = 0) => {
      clearTimeout(tagTimer);
      const r = el.getBoundingClientRect();
      setTag({ top: (r.top < 34 ? r.bottom + 6 : r.top - 28) + window.scrollY, left: Math.max(8, r.left + window.scrollX), text, state });
      if (hideAfter) tagTimer = setTimeout(() => setTag(null), hideAfter);
    };

    const activate = (el: HTMLElement) => {
      if (el.isContentEditable || el.dataset.editState === "saving") return;
      before.set(el, el.textContent ?? "");
      delete el.dataset.editState;
      el.setAttribute("contenteditable", "plaintext-only");
      if (!el.isContentEditable) el.setAttribute("contenteditable", "true"); // engines without plaintext-only; paste is cleaned below
      el.closest("a")?.setAttribute("draggable", "false"); // a draggable link would swallow the text selection
      current = el;
      el.focus();
      showTag(el, "Editing · Enter saves · Esc cancels", "editing");
    };

    /** Ends editing: saves the changed text optimistically, rolls back and toasts on failure. */
    const commit = async (el: HTMLElement) => {
      current = null;
      const was = before.get(el) ?? "";
      const now = (el.textContent ?? "").replace(/\s*\n\s*/g, " ").trim();
      el.removeAttribute("contenteditable");
      el.closest("a")?.removeAttribute("draggable");
      el.textContent = now === was.trim() ? was : now; // one clean text node either way
      if (now === was.trim()) { setTag(null); return; }
      el.dataset.editState = "saving";
      showTag(el, "Saving…", "saving");
      let res: Awaited<ReturnType<SaveFn>>;
      try { res = await latest.current.save(el.dataset.edit!, now); } catch { res = { ok: false, error: "Could not save. Check your connection." }; }
      if (res.ok) { el.dataset.editState = "saved"; showTag(el, "Saved", "saved", 1100); setTimeout(() => { if (el.dataset.editState === "saved") delete el.dataset.editState; }, 1100); }
      else {
        el.textContent = was; // rollback
        el.dataset.editState = "error";
        showTag(el, "Not saved", "error", 2600);
        latest.current.toast(res.error);
        setTimeout(() => { if (el.dataset.editState === "error") delete el.dataset.editState; }, 2600);
      }
    };

    const onDown = (e: Event) => { const el = field(e.target); if (el) activate(el); };
    // Clicks on editable text must not follow the link / open the case sheet / toggle the disclosure around it.
    const onClick = (e: Event) => { if (field(e.target)) { e.preventDefault(); e.stopPropagation(); } };
    const onOut = (e: Event) => { const el = field(e.target); if (el && el === current) void commit(el); };
    const onKey = (e: KeyboardEvent) => {
      if (!current || e.target !== current) return;
      if (e.key === "Enter") { e.preventDefault(); current.blur(); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); current.textContent = before.get(current) ?? ""; current.blur(); }
    };
    const onPaste = (e: ClipboardEvent) => {
      if (!current || e.target !== current) return;
      e.preventDefault();
      document.execCommand("insertText", false, (e.clipboardData?.getData("text/plain") ?? "").replace(/\s*\n\s*/g, " "));
    };

    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("focusout", onOut, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("paste", onPaste, true);
    return () => {
      if (current) current.blur(); // saves a half-finished edit when the toggle is switched off
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("focusout", onOut, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("paste", onPaste, true);
      clearTimeout(tagTimer);
      html.classList.remove("inline-edit-on");
    };
  }, []);

  return tag ? <div className="inline-edit-tag" data-state={tag.state} style={{ top: tag.top, left: tag.left }} role="status">{tag.text}</div> : null;
}
