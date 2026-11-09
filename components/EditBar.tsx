"use client";
import "./EditMode.css";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { useEditMode } from "./EditModeProvider";

/** Bottom edit bar; `onEditContent` (v7 site only) adds the button that opens the Edit content window. */
export default function EditBar({ onEditContent }: { onEditContent?: () => void }) {
  const { isEditing, logout } = useEditMode();

  return (
    <AnimatePresence>
      {isEditing && (
        <motion.div
          className="edit-bar"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          role="status"
          aria-live="polite"
        >
          <span className="edit-bar-indicator" aria-hidden="true" />
          <span className="edit-bar-label">Edit mode</span>
          <span className="edit-bar-sep" aria-hidden="true">·</span>
          <span className="edit-bar-hint">Click any text to edit — saves automatically on blur</span>
          {onEditContent && <button className="edit-bar-exit" onClick={onEditContent}>Edit content</button>}
          <Link className="edit-bar-exit" href="/admin/chats" style={{ textDecoration: "none" }}>Chats</Link>
          <button className="edit-bar-exit" onClick={logout}>
            Exit
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
