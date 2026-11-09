"use client";
import "./EditMode.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useEditMode } from "./EditModeProvider";

type Step = "email" | "code";

export default function InlineLoginPanel() {
  const { panelOpen, closePanel, requestOtp, verifyOtpCode } = useEditMode();
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Surface callback errors handed off by /auth/callback?auth_error=...
  // Read straight from window.location (client-only, runs once on mount) rather
  // than useSearchParams() — the latter forces a Suspense boundary during the
  // static prerender the ISR build does for /_not-found, which would error.
  useEffect(() => {
    const url = new URL(window.location.href);
    const authError = url.searchParams.get("auth_error");
    if (!authError) return;
    // Strip the param so refreshes don't keep replaying the error.
    url.searchParams.delete("auth_error");
    router.replace(url.pathname + url.search);
    // Defer the setState off the effect's synchronous path.
    const raf = requestAnimationFrame(() => setError(authError));
    return () => cancelAnimationFrame(raf);
  }, [router]);

  // Reset state when the panel closes so the next open starts fresh — tracked
  // during render rather than in an effect to avoid a cascading re-render.
  const [prevOpen, setPrevOpen] = useState(panelOpen);
  if (prevOpen !== panelOpen) {
    setPrevOpen(panelOpen);
    if (!panelOpen) {
      setStep("email");
      setCode("");
      setError("");
      setLoading(false);
    }
  }

  // Esc closes the panel from anywhere on the page, not only while focus is inside it.
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closePanel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panelOpen, closePanel]);

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
          {/* Dimmed backdrop: closes the panel on outside click */}
          <motion.div
            className="login-panel-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={closePanel}
          />

          {/* Centered card (the header button sits in a different place in every design). `rr-block` keeps the whole panel
              (inputs AND the "check <email>" line) out of session replays; `data-rr-mask` on the inputs is the second layer. */}
          <div className="login-panel-wrap">
          <motion.div
            className="login-panel rr-block"
            role="dialog"
            aria-modal="true"
            aria-labelledby="il-title"
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10, transition: { duration: 0.14 } }}
            transition={{ type: "spring", stiffness: 440, damping: 32 }}
          >
            <button className="login-panel-close" onClick={closePanel} aria-label="Close">
              ×
            </button>

            <p className="login-panel-eyebrow"><span className="login-panel-tape" aria-hidden="true" />Restricted area</p>
            <h2 className="login-panel-title" id="il-title">I am Rithvik.</h2>
            <p className="login-panel-warning">
              {step === "email"
                ? <>🚨 Rithvik-only zone. If you&apos;re not Rithvik, there&apos;s nothing to see here. Probably. The door opens for exactly one email.</>
                : <>📬 Code on its way. Impostors don&apos;t get mail.</>}
            </p>

            {step === "email" && (
              <form onSubmit={submitEmail} className="login-panel-form">
                <div className="admin-field">
                  <label htmlFor="il-email">Email</label>
                  <input
                    id="il-email"
                    data-rr-mask
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="the one true email"
                    autoFocus
                  />
                </div>

                {error && <p className="admin-error">{error}</p>}

                <button type="submit" className="admin-submit" disabled={loading}>
                  {loading ? "Knocking…" : "Let me in →"}
                </button>
              </form>
            )}

            {step === "code" && (
              <form onSubmit={submitCode} className="login-panel-form">
                <p className="otp-instructions">
                  Check <strong>{email}</strong> for the code, or click the link in the email.
                </p>
                <div className="admin-field">
                  <label htmlFor="il-code">Code</label>
                  <input
                    id="il-code"
                    data-rr-mask
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6,10}"
                    maxLength={10}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    required
                    autoComplete="one-time-code"
                    placeholder="12345678"
                    autoFocus
                    className="otp-input"
                  />
                </div>

                {error && <p className="admin-error">{error}</p>}

                <button type="submit" className="admin-submit" disabled={loading || code.length < 6}>
                  {loading ? "Checking…" : "Open sesame →"}
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
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
