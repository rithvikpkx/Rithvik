"use client";
import { useRef } from "react";

// execCommand is deprecated but universally supported and dep-free — matching
// the repo's hand-rolled SimpleMarkdown philosophy. The parent reads innerHTML
// on every change and sanitizes (lib/sanitize-html) before sending.
const TOOLS = [
  { cmd: "bold",              label: "B",  title: "Bold",          style: { fontWeight: 700 } },
  { cmd: "italic",            label: "I",  title: "Italic",        style: { fontStyle: "italic" } },
  { cmd: "underline",         label: "U",  title: "Underline",     style: { textDecoration: "underline" } },
  { cmd: "strikeThrough",     label: "S",  title: "Strikethrough", style: { textDecoration: "line-through" } },
  { cmd: "insertUnorderedList", label: "•",  title: "Bullet list" },
  { cmd: "insertOrderedList",   label: "1.", title: "Numbered list" },
] as const;

interface Props {
  onChange: (html: string) => void;
}

export default function RichTextEditor({ onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Apply a formatting command to the current selection, refocus, push HTML up.
  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    ref.current?.focus();
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const addLink = () => {
    const url = window.prompt("Link URL (https://… or mailto:…)");
    if (url) exec("createLink", url);
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
            onMouseDown={(e) => e.preventDefault()}
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
