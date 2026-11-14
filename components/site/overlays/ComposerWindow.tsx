"use client";
import { useContext, useState } from "react";
import { DesignContext } from "../DesignProvider";
import Window from "../windows/Window";
import { Icon } from "../Glyph";
import { useSite } from "../SiteProvider";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Plain textarea text → minimal HTML for /api/contact (which re-sanitises server-side). */
function toHtml(text: string) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
}

type FormProps = { subject: string; body?: string; agentSessionId?: string };

/** The email form: posts the same payload as the old composer to /api/contact. Used in the floating window and inline
 *  (recruiter mode); `idPrefix` keeps field ids unique when both are on the page, `onSent` runs after a send. */
export function ComposerForm({ subject: initialSubject, body: initialBody = "", agentSessionId, idPrefix: p = "cmp", onSent }: FormProps & { idPrefix?: string; onSent?: () => void }) {
  const { content, toast } = useSite();
  const design = useContext(DesignContext); // null in the lab harness
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [honeypot, setHoneypot] = useState("");
  const [bad, setBad] = useState<{ from?: boolean; subject?: boolean; body?: boolean }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Before anything is sent the visitor confirms their own address by typing it again: a typo there means Rithvik
  // can never reply, so this step is deliberately strict (it must match, and pasting is off).
  const [confirming, setConfirming] = useState(false);
  const [again, setAgain] = useState("");
  const matches = again.trim().toLowerCase() === from.trim().toLowerCase();

  /** Send pressed: check the fields, then ask for the address again instead of sending straight away. */
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const b = { from: !EMAIL_RE.test(from.trim()), subject: !subject.trim(), body: !body.trim() };
    setBad(b);
    if (b.from || b.subject || b.body) { document.getElementById(`${p}-${b.from ? "from" : b.subject ? "subj" : "body"}`)?.focus(); return; }
    setAgain(""); setError(""); setConfirming(true);
    requestAnimationFrame(() => document.getElementById(`${p}-again`)?.focus());
  };
  /** Back to the form, focused on the address so it can be corrected. */
  const editAddress = () => { setConfirming(false); requestAnimationFrame(() => document.getElementById(`${p}-from`)?.focus()); };

  /** Sends, only after the address was confirmed. */
  const deliver = async () => {
    if (!matches || busy) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: from.trim(), subject: subject.trim(), bodyHtml: toHtml(body.trim()), honeypot,
          // Owner-only context for the email footer (the route validates all of it).
          agentSessionId, pageUrl: location.href, design: design?.current, referrer: document.referrer }),
      });
      if (res.ok) { toast("Sent. I'll reply to " + from.trim()); setSubject(""); setBody(""); setBusy(false); setConfirming(false); onSent?.(); return; }
      setError(res.status === 429 ? "You've sent a few already. Try again in a bit." : "Couldn't send. Please try again.");
    } catch {
      setError("Couldn't send. Please try again.");
    }
    setBusy(false);
    setConfirming(false); // show the error on the form
  };

  const err = (show: boolean | undefined, id: string, text: string) => show && <p className="field-err" id={id}>{text}</p>;

  return (
      <form className="composer" onSubmit={send} noValidate>
        <div className="cmp-fields">
          <div className="cmp-row">
            <label htmlFor={`${p}-to`}>To</label>
            <input className="field" id={`${p}-to`} value={content.links.email} readOnly />
          </div>
          <div className="cmp-row">
            <label htmlFor={`${p}-from`}>From</label>
            <input className="field" id={`${p}-from`} type="email" placeholder="you@company.com" autoComplete="email" value={from}
              onChange={(e) => setFrom(e.target.value)} aria-invalid={!!bad.from} aria-describedby={`${p}-err-from`} />
            {err(bad.from, `${p}-err-from`, "Add your email so I can reply")}
          </div>
          <div className="cmp-row">
            <label htmlFor={`${p}-subj`}>Subject</label>
            <input className="field" id={`${p}-subj`} type="text" placeholder="Internship opportunity" maxLength={200} value={subject}
              onChange={(e) => setSubject(e.target.value)} aria-invalid={!!bad.subject} aria-describedby={`${p}-err-subj`} />
            {err(bad.subject, `${p}-err-subj`, "Add a subject")}
          </div>
          <div className="cmp-row grow">
            <label htmlFor={`${p}-body`} className="sr-only">Message</label>
            <textarea className="field" id={`${p}-body`} rows={7} placeholder="Hi Rithvik," value={body}
              onChange={(e) => setBody(e.target.value)} aria-invalid={!!bad.body} aria-describedby={`${p}-err-body`} />
            {err(bad.body, `${p}-err-body`, "Write a message first")}
          </div>
          {/* Honeypot: hidden from people, bots fill it and the route drops the message. */}
          <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
            style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
        </div>
        <footer className="cmp-foot">
          <button type="button" className="ui-btn" data-copy={content.links.email}><Icon name="copy" /> Copy email</button>
          <span className="cmp-note" role="status" style={error ? { color: "#ff6b6b" } : undefined}>{error}</span>
          <button className="ui-btn primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Send"} <Icon name="send" /></button>
        </footer>
        {confirming && (
          <div className="cmp-confirm" role="alertdialog" aria-modal="true" aria-labelledby={`${p}-cf-h`} aria-describedby={`${p}-cf-d`}
            onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); editAddress(); } }}>
            <div className="cmp-confirm-card">
              <p className="cmp-confirm-k"><Icon name="mail" /> Check your email address</p>
              <h3 id={`${p}-cf-h`}>Is this right?</h3>
              <p className="cmp-confirm-addr">{from.trim()}</p>
              <p id={`${p}-cf-d`} className="cmp-confirm-d">
                Rithvik will reply to this address. <b>If it has a typo, he won&apos;t be able to reach you</b>, so please type it once more to confirm.
              </p>
              <label className="cmp-confirm-l" htmlFor={`${p}-again`}>Type your email again</label>
              <input className="field" id={`${p}-again`} type="email" autoComplete="off" spellCheck={false} placeholder="you@company.com" value={again}
                onChange={(e) => setAgain(e.target.value)} onPaste={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void deliver(); } }}
                aria-invalid={again.length >= from.trim().length && !matches} aria-describedby={`${p}-cf-m`} />
              <p id={`${p}-cf-m`} className={`cmp-confirm-m${matches ? " ok" : ""}`} role="status">
                {matches ? "✓ Matches. You're good to send." : again.length >= from.trim().length ? "That doesn't match the address above. Check both for typos." : "Typing it again catches typos (pasting is off)."}
              </p>
              <div className="cmp-confirm-actions">
                <button type="button" className="ui-btn" onClick={editAddress}>Edit my email</button>
                <button type="button" className="ui-btn primary" disabled={!matches || busy} onClick={() => void deliver()}>{busy ? "Sending…" : "Confirm & send"} <Icon name="send" /></button>
              </div>
            </div>
          </div>
        )}
      </form>
  );
}

/** The v7 floating email window. */
export default function ComposerWindow(props: FormProps) {
  const { close } = useSite();
  return (
    <Window title="New message" icon="mail" label="New message" name="email" className="composer-win" place="corner" onClose={() => close("composer")} initialFocus="#cmp-from">
      <ComposerForm {...props} onSent={() => close("composer")} />
    </Window>
  );
}
