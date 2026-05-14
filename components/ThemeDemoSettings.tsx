"use client";
import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useEditMode } from "./EditModeProvider";
import { setThemeDemoDelay } from "@/app/admin/actions";

const DEMO_SHOWN_KEY = "rithvik-theme-demo-shown";

/* Edit-mode-only control for the first-visit theme demo delay.
   Sits at the bottom-left so it doesn't fight the dial (left edge),
   the EditBar (bottom-center), or the RAG launcher (bottom-right). */

export default function ThemeDemoSettings({ initialDelayMs }: { initialDelayMs: number }) {
  const { isEditing } = useEditMode();
  const [open, setOpen] = useState(false);
  const [seconds, setSeconds] = useState<number>(Math.round(initialDelayMs / 1000));
  const [savedMs, setSavedMs] = useState<number>(initialDelayMs);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function handleSave() {
    setStatus(null);
    const ms = Math.max(0, Math.min(120, seconds)) * 1000;
    startTransition(async () => {
      try {
        const persisted = await setThemeDemoDelay(ms);
        setSavedMs(persisted);
        setStatus(persisted === 0 ? "Demo disabled" : `Saved · ${persisted / 1000}s`);
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  // Resets the localStorage flag so Rithvik can preview the demo on the next
  // page load without needing an incognito window. Doesn't touch the DB.
  function handleReplayPreview() {
    try {
      localStorage.removeItem(DEMO_SHOWN_KEY);
      localStorage.removeItem("rithvik-theme");
      setStatus("Reload the page to preview");
    } catch {
      setStatus("localStorage unavailable");
    }
  }

  const dirty = Math.round(savedMs / 1000) !== seconds;
  const disabled = seconds === 0;

  return (
    <AnimatePresence>
      {isEditing && (
        <motion.div
          className="theme-demo-settings"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        >
          {!open ? (
            <button
              type="button"
              className="theme-demo-trigger"
              onClick={() => setOpen(true)}
              aria-label="Open theme demo settings"
              title="Theme demo settings"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
              <span>Theme demo</span>
            </button>
          ) : (
            <div className="theme-demo-card">
              <div className="theme-demo-header">
                <span className="theme-demo-title">Theme demo</span>
                <button
                  type="button"
                  className="theme-demo-close"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >✕</button>
              </div>

              <label className="theme-demo-field">
                <span className="theme-demo-label">First-visit delay</span>
                <div className="theme-demo-input-row">
                  <input
                    type="number"
                    min={0}
                    max={120}
                    step={1}
                    className="theme-demo-input"
                    value={seconds}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setSeconds(Number.isFinite(n) ? n : 0);
                    }}
                    disabled={isPending}
                  />
                  <span className="theme-demo-unit">seconds</span>
                </div>
                <span className="theme-demo-hint">
                  {disabled
                    ? "Demo is off — first-time visitors won't see it."
                    : "0 disables the demo. Max 120s."}
                </span>
              </label>

              <div className="theme-demo-actions">
                <button
                  type="button"
                  className="theme-demo-btn theme-demo-btn-primary"
                  onClick={handleSave}
                  disabled={!dirty || isPending}
                >
                  {isPending ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  className="theme-demo-btn"
                  onClick={handleReplayPreview}
                  disabled={isPending}
                  title="Clear the local 'demo seen' flag so you can preview"
                >
                  Replay for me
                </button>
              </div>

              {status && <div className="theme-demo-status">{status}</div>}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
