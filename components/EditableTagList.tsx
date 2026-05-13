"use client";
import { useState } from "react";
import { useEditMode } from "./EditModeProvider";

interface Props {
  tags: string[];
  onSave: (tags: string[]) => Promise<void>;
  className?: string;
}

/** Tag chip list — in edit mode each chip has a remove button and an input adds new tags. */
export default function EditableTagList({ tags, onSave, className = "" }: Props) {
  const { isEditing } = useEditMode();
  const [inputVal, setInputVal] = useState("");

  if (!isEditing) {
    return (
      <div className={className}>
        {tags.map((t) => <span key={t}>{t}</span>)}
      </div>
    );
  }

  const addTag = async (raw: string) => {
    const tag = raw.trim();
    if (!tag || tags.includes(tag)) { setInputVal(""); return; }
    await onSave([...tags, tag]);
    setInputVal("");
  };

  const removeTag = async (tag: string) => {
    await onSave(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(inputVal); }
    if (e.key === "Backspace" && !inputVal && tags.length > 0) removeTag(tags[tags.length - 1]);
  };

  return (
    <div className={`${className} editable-tag-list`}>
      {tags.map((t) => (
        <span key={t} className="editable-tag">
          {t}
          <button type="button" className="tag-remove" onClick={() => removeTag(t)} aria-label={`Remove ${t}`}>×</button>
        </span>
      ))}
      <input
        className="tag-input"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (inputVal.trim()) addTag(inputVal); }}
        placeholder="Add tag…"
      />
    </div>
  );
}
