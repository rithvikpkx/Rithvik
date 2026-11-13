import { after } from "next/server";
import { adminClient } from "@/lib/supabase-server";
import { identifyFromRequest } from "@/lib/track/store";
import { sanitizeEmailHtml, htmlToText } from "@/lib/sanitize-html";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { buildContextFooter, escapeHtml as esc } from "@/lib/contact-context";
import { geoFromHeaders, isUuid } from "@/lib/agent/obs";

const MAX_SUBJECT = 200;
const MAX_BODY = 20000;                       // raw HTML length cap
const RATE_LIMIT = 3;                         // sends per IP (IPv6: per /64) per hour
const RATE_LIMIT_GLOBAL = 50;                 // all senders per hour; protects domain reputation
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// agentSessionId / pageUrl / design / referrer feed the owner-only Context footer; they are untrusted.
type Payload = { from?: string; subject?: string; bodyHtml?: string; honeypot?: string; agentSessionId?: string; pageUrl?: string; design?: string; referrer?: string };

// Best-effort client IP from Vercel's forwarding header.
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? "").trim() || "unknown";
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

  // The hit is recorded atomically before sending, so a failed send still counts.
  const limited = await rateLimit("contact", clientKey(req), RATE_LIMIT, RATE_LIMIT_GLOBAL);
  if (!limited.ok) {
    return Response.json(
      { error: limited.status === 429 ? "rate-limited" : "Could not send right now." },
      { status: limited.status, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const sender = from.trim();

  // The transcript link only goes out for a session that really exists: a guessed or stale id is dropped.
  let agentSessionId: string | null = null;
  if (isUuid(body.agentSessionId)) {
    const { data } = await db.from("agent_sessions").select("id").eq("id", body.agentSessionId).maybeSingle();
    if (data) agentSessionId = data.id as string;
  }
  const context = buildContextFooter({
    agentSessionId,
    origin: new URL(req.url).origin,
    pageUrl: typeof body.pageUrl === "string" ? body.pageUrl : req.headers.get("referer"),
    design: typeof body.design === "string" ? body.design : null,
    geo: geoFromHeaders(req.headers),
    userAgent: req.headers.get("user-agent"),
    referrer: typeof body.referrer === "string" ? body.referrer : null,
    at: new Date(),
  });

  // Log row before sending, marked 'sent' or 'failed' once we know the outcome.
  // agent_session_id needs supabase/contact_agent_session_migration.sql; until it is applied the insert
  // is retried without it so the log row (and the rate-limit record) still lands.
  const row = { ip, from_email: sender, subject: subject.trim(), status: "pending" };
  const first = await db.from("contact_submissions").insert({ ...row, agent_session_id: agentSessionId }).select("id").single();
  const { data: logRow } = first.error ? await db.from("contact_submissions").insert(row).select("id").single() : first;

  // Send via the Resend HTTP API (fetch — no SDK). from MUST be a verified
  // rithvik.ai address; the visitor goes in reply_to so "reply" reaches them.
  //
  // Deliberately NOT cc'ing the sender: `from` is unverified attacker-controlled
  // input, so cc'ing it turned this route into a small open relay — anyone could
  // have rithvik.ai deliver arbitrary sanitized HTML to an address of their
  // choosing, burning domain reputation on the same domain that sends auth mail.
  // reply_to still threads the visitor in as soon as Rithvik replies.
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
      reply_to: sender,        // reply reaches the visitor
      subject: `[rithvik.ai] ${subject.trim()}`,
      html: headerLine + cleanHtml + context.html,
      text: `Sent from rithvik.ai by ${sender}\n\n${htmlToText(cleanHtml)}${context.text}`,
    }),
  });

  // Settle the reserved row. Best-effort: the outcome is already decided, so a
  // logging hiccup must not change what we return to the caller.
  const settle = async (status: string) => {
    if (logRow?.id) await db.from("contact_submissions").update({ status }).eq("id", logRow.id);
  };

  if (!res.ok) {
    console.error("[contact] resend send failed:", res.status, await res.text());
    await settle("failed");
    return Response.json({ error: "Could not send right now." }, { status: 502 });
  }

  await settle("sent");
  // Attach this visitor's browsing history to the address they just wrote from.
  after(() => identifyFromRequest(req, { email: sender }));
  return Response.json({ ok: true });
}
