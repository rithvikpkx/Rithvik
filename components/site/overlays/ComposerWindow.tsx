"use client";
import { useState } from "react";
import Window from "../windows/Window";
import Icon from "../windows/Icon";
import { useSite } from "../SiteProvider";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Plain textarea text → minimal HTML for /api/contact (which re-sanitises server-side). */
function toHtml(text: string) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
}

/** The v7 floating email window; posts the same payload as the old composer to /api/contact. */
export default function ComposerWindow({ subject: initialSubject }: { subject: string }) {
  const { content, close, toast } = useSite();
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [bad, setBad] = useState<{ from?: boolean; subject?: boolean; body?: boolean }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const b = { from: !EMAIL_RE.test(from.trim()), subject: !subject.trim(), body: !body.trim() };
    setBad(b);
    if (b.from || b.subject || b.body) { document.getElementById(b.from ? "cmp-from" : b.subject ? "cmp-subj" : "cmp-body")?.focus(); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: from.trim(), subject: subject.trim(), bodyHtml: toHtml(body.trim()), honeypot }),
      });
      if (res.ok) { toast("Sent. I'll reply to " + from.trim()); close(); return; }
      setError(res.status === 429 ? "You've sent a few already. Try again in a bit." : "Couldn't send. Please try again.");
    } catch {
      setError("Couldn't send. Please try again.");
    }
    setBusy(false);
  };

  const err = (show: boolean | undefined, id: string, text: string) => show && <p className="field-err" id={id}>{text}</p>;

  return (
    <Window title="New message" icon="mail" label="New message" className="composer-win" place="corner" onClose={close} initialFocus="#cmp-from">
      <form className="composer" onSubmit={send} noValidate>
        <div className="cmp-fields">
          <div className="cmp-row">
            <label htmlFor="cmp-to">To</label>
            <input className="field" id="cmp-to" value={content.links.email} readOnly />
            <button type="button" className="ui-ic" data-copy={content.links.email} aria-label="Copy address"><Icon name="copy" /></button>
          </div>
          <div className="cmp-row">
            <label htmlFor="cmp-from">From</label>
            <input className="field" id="cmp-from" type="email" placeholder="you@company.com" autoComplete="email" value={from}
              onChange={(e) => setFrom(e.target.value)} aria-invalid={!!bad.from} aria-describedby="err-from" />
            {err(bad.from, "err-from", "Add your email so I can reply")}
          </div>
          <div className="cmp-row">
            <label htmlFor="cmp-subj">Subject</label>
            <input className="field" id="cmp-subj" type="text" placeholder="Internship opportunity" maxLength={200} value={subject}
              onChange={(e) => setSubject(e.target.value)} aria-invalid={!!bad.subject} aria-describedby="err-subj" />
            {err(bad.subject, "err-subj", "Add a subject")}
          </div>
          <div className="cmp-row grow">
            <label htmlFor="cmp-body" className="sr-only">Message</label>
            <textarea className="field" id="cmp-body" rows={7} placeholder="Hi Rithvik," value={body}
              onChange={(e) => setBody(e.target.value)} aria-invalid={!!bad.body} aria-describedby="err-body" />
            {err(bad.body, "err-body", "Write a message first")}
          </div>
          {/* Honeypot: hidden from people, bots fill it and the route drops the message. */}
          <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
            style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
        </div>
        <footer className="cmp-foot">
          <span className="cmp-note" role="status" style={error ? { color: "#ff6b6b" } : undefined}>{error || "Goes straight to my inbox"}</span>
          <button className="ui-btn primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Send"} <Icon name="send" /></button>
        </footer>
      </form>
    </Window>
  );
}
