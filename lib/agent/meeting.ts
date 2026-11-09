/** Meeting requests from the agent: validate, rate-limit, store on the session, email the owner once.
 *  Server-only in practice (Resend key, service role) but written with lazy imports so the pure parts test under node. */
import { clip, isUuid } from "./obs.ts";

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;
const RATE_PER_KEY = 3;     // requests per visitor key (IP bucket) per hour
const RATE_GLOBAL = 30;     // all visitors per hour; protects the sending domain
const SITE_ORIGIN = "https://rithvik.ai";

export type MeetingInput = {
  name: string; email: string; company?: string; role?: string;
  /** Proposed slots as the visitor phrased them; max 5. */
  times: string[];
  /** IANA zone the times are in (e.g. "America/New_York"), shown beside them. */
  timeZone?: string;
  notes?: string;
  sessionId: string;
};

export type MeetingValid = {
  name: string; email: string; company: string | null; role: string | null;
  times: string[]; timeZone: string | null; notes: string | null; sessionId: string;
};

/** Collapses whitespace and control characters (incl. CR/LF) so a value is safe in a header-like line. */
function oneLine(s: unknown, max: number): string | null {
  return clip(typeof s === "string" ? s.replace(/[\u0000-\u001f\u007f\s]+/g, " ") : s, max);
}

/** True for a zone name Intl accepts. */
function validZone(z: string): boolean {
  try { new Intl.DateTimeFormat("en", { timeZone: z }); return true; } catch { return false; }
}

/** Checks and normalises a request at the trust boundary; the error text is safe to show the visitor. */
export function validateMeeting(i: MeetingInput): { ok: true; value: MeetingValid } | { ok: false; error: string } {
  const name = oneLine(i.name, 100);
  if (!name) return { ok: false, error: "A name is required." };
  const email = oneLine(i.email, 254);
  if (!email || !EMAIL_RE.test(email)) return { ok: false, error: "A valid email is required." };
  if (!Array.isArray(i.times) || i.times.length === 0 || i.times.length > 5) return { ok: false, error: "Propose between one and five times." };
  const times = i.times.map((t) => oneLine(t, 120));
  if (times.some((t) => !t)) return { ok: false, error: "Each proposed time needs a description." };
  const timeZone = oneLine(i.timeZone, 64);
  if (timeZone && !validZone(timeZone)) return { ok: false, error: "Unknown time zone." };
  if (!isUuid(i.sessionId)) return { ok: false, error: "Missing conversation." };
  return {
    ok: true,
    value: {
      name, email, company: oneLine(i.company, 100), role: oneLine(i.role, 100), times: times as string[], timeZone,
      // notes may span lines, so only trim and cap
      notes: clip(i.notes, 2000), sessionId: i.sessionId,
    },
  };
}

/** Escapes HTML-significant characters; the email regex still permits some of them in the local part. */
export function esc(s: string): string {
  return s.replace(/[<>"'&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "&": "&amp;" })[c] as string);
}

/** The owner's email: subject, HTML and plain-text bodies. Every visitor-supplied value is escaped in the HTML. */
export function buildMeetingEmail(v: MeetingValid, link: string): { subject: string; html: string; text: string } {
  const subject = `Interview request: ${v.name}${v.company ? ` (${v.company})` : ""}`;
  const zone = v.timeZone ? ` (${v.timeZone})` : "";
  const rows: [string, string][] = [["Name", v.name], ["Email", v.email], ["Company", v.company ?? "—"], ["Role", v.role ?? "—"]];
  const html =
    `<p style="color:#888;font-size:13px;margin:0 0 8px">Meeting request from the rithvik.ai agent</p><hr>` +
    `<table cellpadding="4" style="border-collapse:collapse">${rows.map(([k, val]) => `<tr><td style="color:#888">${k}</td><td>${esc(val)}</td></tr>`).join("")}</table>` +
    `<p><b>Proposed times${esc(zone)}</b></p><ul>${v.times.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` +
    (v.notes ? `<p><b>Notes</b></p><p>${esc(v.notes).replace(/\n/g, "<br>")}</p>` : "") +
    `<p><a href="${esc(link)}">Read the conversation</a></p>`;
  const text =
    `Meeting request from the rithvik.ai agent\n\n${rows.map(([k, val]) => `${k}: ${val}`).join("\n")}\n\n` +
    `Proposed times${zone}:\n${v.times.map((t) => `- ${t}`).join("\n")}\n` +
    (v.notes ? `\nNotes:\n${v.notes}\n` : "") + `\nConversation: ${link}\n`;
  return { subject, html, text };
}

/** Validates, rate-limits (3/hr per `key`, 30/hr overall), records the contact on the session, then sends one
 *  email to CONTACT_TO with reply_to set to the visitor. `key` is the caller's `clientKey(req)`.
 *  Call it only after the visitor has confirmed the details in the chat. */
export async function sendMeetingRequest(
  input: MeetingInput & { key: string },
): Promise<{ ok: true } | { ok: false; error: string; retryAfter?: number }> {
  const checked = validateMeeting(input);
  if (!checked.ok) return checked;
  const v = checked.value;

  const { rateLimit } = await import("@/lib/rate-limit");
  const limited = await rateLimit("meeting", input.key, RATE_PER_KEY, RATE_GLOBAL);
  if (!limited.ok) {
    return { ok: false, error: limited.status === 429 ? "Too many requests. Try again later." : "Could not send right now.", retryAfter: limited.retryAfter };
  }

  const { RESEND_API_KEY, CONTACT_FROM, CONTACT_TO } = process.env;
  if (!RESEND_API_KEY || !CONTACT_FROM || !CONTACT_TO) {
    console.error("[meeting] RESEND_API_KEY/CONTACT_FROM/CONTACT_TO unset");
    return { ok: false, error: "Could not send right now." };
  }

  // Store first so the owner can follow up from /admin/chats even if the email never arrives.
  try {
    const { adminClient } = await import("@/lib/supabase-server");
    const { error } = await adminClient().from("agent_sessions")
      .update({ visitor_name: v.name, visitor_email: v.email, visitor_company: v.company, follow_up: true })
      .eq("id", v.sessionId);
    if (error) throw error;
  } catch (e) {
    console.error("[meeting] session update failed:", e instanceof Error ? e.message : e);
  }

  const origin = process.env.SITE_URL?.replace(/\/$/, "") || SITE_ORIGIN;
  const mail = buildMeetingEmail(v, `${origin}/admin/chats/${v.sessionId}`);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    // reply_to (never from) carries the visitor, so SPF/DKIM stay intact and Reply reaches them
    body: JSON.stringify({ from: CONTACT_FROM, to: CONTACT_TO, reply_to: v.email, subject: mail.subject, html: mail.html, text: mail.text }),
  });
  if (!res.ok) {
    console.error("[meeting] resend send failed:", res.status, await res.text());
    return { ok: false, error: "Could not send right now." };
  }
  return { ok: true };
}
