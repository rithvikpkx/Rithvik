"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useEditMode } from "./EditModeProvider";

export default function InlineLoginPanel() {
  const { panelOpen, closePanel, login } = useEditMode();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const err = await login(email, password);
    if (err) {
      setError(err);
      setLoading(false);
    }
    // On success: EditModeProvider sets isEditing=true and panelOpen=false
  };

  return (
    <AnimatePresence>
      {panelOpen && (
        <>
          {/* Invisible backdrop — closes panel on outside click */}
          <motion.div
            className="login-panel-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={closePanel}
          />

          {/* Panel — springs in from top-right anchored to nav button */}
          <motion.div
            className="login-panel"
            initial={{ opacity: 0, scale: 0.93, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: -8 }}
            transition={{ type: "spring", stiffness: 440, damping: 32 }}
          >
            <button className="login-panel-close" onClick={closePanel} aria-label="Close">
              ×
            </button>

            <p className="login-panel-eyebrow">Admin</p>
            <h2 className="login-panel-title">I am Rithvik.</h2>
            <p className="login-panel-warning">
              🚨 Rithvik-only zone. If you&apos;re not Rithvik, there&apos;s nothing to see here. Probably.
            </p>

            <form onSubmit={handleSubmit} className="login-panel-form">
              <div className="admin-field">
                <label htmlFor="il-email">Email</label>
                <input
                  id="il-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  autoFocus
                />
              </div>
              <div className="admin-field">
                <label htmlFor="il-password">Password</label>
                <input
                  id="il-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </div>

              {error && <p className="admin-error">{error}</p>}

              <button type="submit" className="admin-submit" disabled={loading}>
                {loading ? "Signing in…" : "Sign in →"}
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
