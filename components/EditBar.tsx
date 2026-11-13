"use client";
import { motion, AnimatePresence } from "motion/react";
import { useEditMode } from "./EditModeProvider";

export default function EditBar() {
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
          <button className="edit-bar-exit" onClick={logout}>
            Exit
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
