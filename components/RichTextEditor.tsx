"use client";
import { useEffect, useRef } from "react";

// execCommand is deprecated but universally supported and dep-free, matching the
// repo's hand-rolled SimpleMarkdown philosophy. The parent reads innerHTML on
// each change and sanitizes (lib/sanitize-html) before sending.
const TOOLS = [
  { cmd: "bold",                label: "B",  title: "Bold",          style: { fontWeight: 700 } },
  { cmd: "italic",              label: "I",  title: "Italic",        style: { fontStyle: "italic" } },
  { cmd: "underline",           label: "U",  title: "Underline",     style: { textDecoration: "underline" } },
  { cmd: "strikeThrough",       label: "S",  title: "Strikethrough", style: { textDecoration: "line-through" } },
  { cmd: "insertUnorderedList", label: "•",  title: "Bullet list" },
  { cmd: "insertOrderedList",   label: "1.", title: "Numbered list" },
] as const;

interface Props {
  initialHtml?: string;
  onChange: (html: string) => void;
}

export default function RichTextEditor({ initialHtml, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const seed = useRef(initialHtml);   // captured once for the mount-time seed

  // Seed content on mount so the editor survives parent remounts (e.g. the
  // confirm step) without losing what was typed.
  useEffect(() => {
    if (ref.current && seed.current) ref.current.innerHTML = seed.current;
  }, []);

  // execCommand acts on the document selection. Ensure the caret is inside the
  // editor first — a command fired before the user has clicked in (or while
  // focus sits on a toolbar button) would otherwise target nothing and no-op.
  const focusEditor = (): Selection | null => {
    const el = ref.current;
    if (!el) return null;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return null;
    if (!sel.anchorNode || !el.contains(sel.anchorNode)) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);   // caret at end
      sel.removeAllRanges();
      sel.addRange(range);
    }
    return sel;
  };

  const exec = (cmd: string) => {
    const el = ref.current;
    if (!el) return;
    focusEditor();
    document.execCommand(cmd, false);
    onChange(el.innerHTML);
  };

  // Links need their own path: prompt() steals focus and collapses the
  // selection, and createLink no-ops on a collapsed range. So save the range
  // before prompting, restore it after, then either wrap the selected text or
  // insert the URL itself as a clickable link.
  const addLink = () => {
    const el = ref.current;
    if (!el) return;
    const sel = focusEditor();
    const saved = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    const input = window.prompt("Link URL (https://… or mailto:…)")?.trim();
    if (!input) return;
    const href = /^(https?:\/\/|mailto:)/i.test(input) ? input : `https://${input}`;
    el.focus();
    const sel2 = window.getSelection();
    if (saved && sel2) { sel2.removeAllRanges(); sel2.addRange(saved); }
    if (saved && !saved.collapsed) {
      document.execCommand("createLink", false, href);
    } else {
      const text = input.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string);
      document.execCommand("insertHTML", false, `<a href="${href.replace(/"/g, "&quot;")}">${text}</a>`);
    }
    onChange(el.innerHTML);
  };

  return (
    <div className="composer-editor">
      <div className="composer-toolbar" role="toolbar" aria-label="Formatting">
        {TOOLS.map((t) => (
          <button
            key={t.cmd}
            type="button"
            title={t.title}
            aria-label={t.title}
            onMouseDown={(e) => e.preventDefault()}   // keep the editor's selection
            onClick={() => exec(t.cmd)}
            style={"style" in t ? (t.style as React.CSSProperties) : undefined}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          title="Link"
          aria-label="Link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={addLink}
        >
          🔗
        </button>
      </div>
      <div
        ref={ref}
        className="composer-body"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Message body"
        suppressContentEditableWarning
        onInput={() => ref.current && onChange(ref.current.innerHTML)}
      />
    </div>
  );
}
