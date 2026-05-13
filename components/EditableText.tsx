"use client";
import { useEffect, useRef, useState } from "react";
import { useEditMode } from "./EditModeProvider";

type Tag = "h1" | "h2" | "h3" | "h4" | "p" | "span";

interface Props {
  value: string;
  onSave: (val: string) => Promise<void>;
  tag?: Tag;
  className?: string;
  placeholder?: string;
  /** Allow Enter key to insert newlines instead of blurring. */
  multiline?: boolean;
}

export default function EditableText({
  value,
  onSave,
  tag = "span",
  className = "",
  placeholder,
  multiline = false,
}: Props) {
  const { isEditing } = useEditMode();
  const el = useRef<HTMLElement | null>(null);
  const lastSaved = useRef(value);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Sync DOM text if the value prop changes while the element isn't focused
  useEffect(() => {
    if (el.current && document.activeElement !== el.current) {
      el.current.textContent = value;
    }
    lastSaved.current = value;
  }, [value]);

  const Tag = tag;

  if (!isEditing) {
    return <Tag className={className}>{value}</Tag>;
  }

  const handleBlur = async () => {
    const newVal = el.current?.textContent?.trim() ?? "";
    if (newVal === lastSaved.current) return;
    if (!newVal) {
      // Restore if cleared completely
      if (el.current) el.current.textContent = lastSaved.current;
      return;
    }
    setStatus("saving");
    try {
      await onSave(newVal);
      lastSaved.current = newVal;
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1600);
    } catch {
      if (el.current) el.current.textContent = lastSaved.current;
      setStatus("idle");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      el.current?.blur();
    }
    if (e.key === "Escape") {
      if (el.current) el.current.textContent = lastSaved.current;
      el.current?.blur();
    }
  };

  const cls = [
    "editable-text",
    status === "saved" ? "is-saved" : status === "saving" ? "is-saving" : "",
    className,
  ].filter(Boolean).join(" ");

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const setRef = (node: HTMLElement | null) => { el.current = node; };

  return (
    <Tag
      ref={setRef as any}
      className={cls}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      data-placeholder={placeholder}
    >
      {value}
    </Tag>
  );
}
