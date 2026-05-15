"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useEditMode } from "./EditModeProvider";

type Step = "email" | "code";

export default function InlineLoginPanel() {
  const { panelOpen, closePanel, requestOtp, verifyOtpCode } = useEditMode();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Surface callback errors handed off by /auth/callback?auth_error=...
  useEffect(() => {
    const authError = searchParams.get("auth_error");
    if (authError) {
      setError(authError);
      // Strip the param so refreshes don't keep replaying the error.
      const url = new URL(window.location.href);
      url.searchParams.delete("auth_error");
      router.replace(url.pathname + url.search);
    }
  }, [searchParams, router]);

  // Reset state when the panel closes so the next open starts fresh.
  useEffect(() => {
    if (!panelOpen) {
      setStep("email");
      setCode("");
      setError("");
      setLoading(false);
    }
  }, [panelOpen]);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const err = await requestOtp(email);
    setLoading(false);
    if (err) { setError(err); return; }
    setStep("code");
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const err = await verifyOtpCode(email, code);
    setLoading(false);
    if (err) { setError(err); return; }
    // success — onAuthStateChange + provider close the panel
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

            {step === "email" && (
              <form onSubmit={submitEmail} className="login-panel-form">
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

                {error && <p className="admin-error">{error}</p>}

                <button type="submit" className="admin-submit" disabled={loading}>
                  {loading ? "Sending…" : "Send me a code →"}
                </button>
              </form>
            )}

            {step === "code" && (
              <form onSubmit={submitCode} className="login-panel-form">
                <p className="otp-instructions">
                  Check <strong>{email}</strong> for a 6-digit code, or click the link in the email.
                </p>
                <div className="admin-field">
                  <label htmlFor="il-code">Code</label>
                  <input
                    id="il-code"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    required
                    autoComplete="one-time-code"
                    placeholder="123456"
                    autoFocus
                    className="otp-input"
                  />
                </div>

                {error && <p className="admin-error">{error}</p>}

                <button type="submit" className="admin-submit" disabled={loading || code.length !== 6}>
                  {loading ? "Verifying…" : "Verify →"}
                </button>
                <button
                  type="button"
                  className="otp-back-btn"
                  onClick={() => { setStep("email"); setCode(""); setError(""); }}
                  disabled={loading}
                >
                  ← Use a different email
                </button>
              </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
