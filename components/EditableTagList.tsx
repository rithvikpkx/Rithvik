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
  const [error, setError] = useState<string | null>(null);

  if (!isEditing) {
    return (
      <div className={className}>
        {tags.map((t) => <span key={t}>{t}</span>)}
      </div>
    );
  }

  // Runs a save and surfaces failure; parents roll their state back on throw.
  const save = async (next: string[]) => {
    setError(null);
    try { await onSave(next); return true; }
    catch { setError("Save failed. Change reverted."); return false; }
  };

  const addTag = async (raw: string) => {
    const tag = raw.trim();
    if (!tag || tags.includes(tag)) { setInputVal(""); return; }
    // keep the typed text on failure so it isn't lost
    if (await save([...tags, tag])) setInputVal("");
  };

  const removeTag = (tag: string) => save(tags.filter((t) => t !== tag));

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
      {error && <small role="alert" className="edit-error">{error}</small>}
    </div>
  );
}
