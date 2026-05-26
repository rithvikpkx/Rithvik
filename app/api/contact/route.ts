import { adminClient } from "@/lib/supabase";
import { sanitizeEmailHtml, htmlToText } from "@/lib/sanitize-html";

const MAX_SUBJECT = 200;
const MAX_BODY = 20000;                       // raw HTML length cap
const RATE_LIMIT = 3;                         // sends per IP per window
const RATE_WINDOW_MS = 60 * 60 * 1000;        // 1 hour
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Payload = { from?: string; subject?: string; bodyHtml?: string; honeypot?: string };

// Best-effort client IP from Vercel's forwarding header.
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? "").trim() || "unknown";
}

// Escape HTML-significant chars. The email regex permits <, >, " in the local
// part, so the sender address must be escaped before interpolating into HTML.
function esc(s: string): string {
  return s.replace(/[<>"'&]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "&": "&amp;" })[c] as string);
}

export async function POST(req: Request) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const { from = "", subject = "", bodyHtml = "", honeypot = "" } = body;

  // Honeypot: a hidden field real users never see. If filled, a bot did it —
  // return a fake success so the bot doesn't learn it was caught.
  if (honeypot.trim() !== "") return Response.json({ ok: true });

  // Validation
  if (!EMAIL_RE.test(from.trim())) {
    return Response.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (subject.trim().length === 0 || subject.length > MAX_SUBJECT) {
    return Response.json({ error: "Subject is required." }, { status: 400 });
  }
  if (bodyHtml.length > MAX_BODY) {
    return Response.json({ error: "Message is too long." }, { status: 400 });
  }
  const cleanHtml = sanitizeEmailHtml(bodyHtml).trim();
  if (htmlToText(cleanHtml).trim().length === 0) {
    return Response.json({ error: "Message body is required." }, { status: 400 });
  }

  const db = adminClient();
  const ip = clientIp(req);

  // Rate limit: count this IP's sends in the trailing window.
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count } = await db
    .from("contact_submissions")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT) {
    return Response.json({ error: "rate-limited" }, { status: 429 });
  }

  // Send via the Resend HTTP API (fetch — no SDK). from MUST be a verified
  // rithvik.ai address; the visitor goes in reply_to so "reply" reaches them.
  const sender = from.trim();
  const headerLine =
    `<p style="color:#888;font-size:13px;margin:0 0 8px">Sent from rithvik.ai by ${esc(sender)}</p><hr>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM!,
      to: process.env.CONTACT_TO!,
      reply_to: sender,
      subject: `[rithvik.ai] ${subject.trim()}`,
      html: headerLine + cleanHtml,
      text: `Sent from rithvik.ai by ${sender}\n\n${htmlToText(cleanHtml)}`,
    }),
  });

  if (!res.ok) {
    console.error("[contact] resend send failed:", res.status, await res.text());
    return Response.json({ error: "Could not send right now." }, { status: 502 });
  }

  // Log for the rate-limit window + as a record. Best-effort: the email already
  // sent, so a logging hiccup must not fail the request.
  await db.from("contact_submissions").insert({
    ip, from_email: sender, subject: subject.trim(), status: "sent",
  });

  return Response.json({ ok: true });
}
