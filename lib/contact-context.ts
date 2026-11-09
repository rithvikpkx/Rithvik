/** The private "Context" footer appended to the contact email that goes to the owner. Pure (no server
 *  imports) so node:test can load it. Everything here is visitor-controlled except the transcript link,
 *  which is built from the request origin and a validated uuid; all of it is HTML-escaped, and the page
 *  and referrer are shown as plain text (never links) so a crafted URL can't be clicked from the inbox. */
import { isUuid } from "./agent/obs.ts";

/** Escapes HTML-significant characters. The email regex permits <, >, " in the local part, so any
 *  visitor-supplied string must pass through this before it is interpolated into HTML. */
export function escapeHtml(s: string): string {
  return s.replace(/[<>"'&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "&": "&amp;" })[c] as string);
}

export type ContextInput = {
  /** Validated by the caller to exist in agent_sessions; null for a plain composer send. */
  agentSessionId?: string | null;
  /** Origin of this request (https://rithvik.ai), for the transcript link. */
  origin: string;
  pageUrl?: string | null;
  design?: string | null;
  geo: { country?: string | null; region?: string | null; city?: string | null };
  userAgent?: string | null;
  referrer?: string | null;
  at: Date;
};

/** Control chars out, length capped: these strings come from the browser. */
const clean = (s: string | null | undefined, max = 300) => (s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

/** The context block as HTML and plain text. Rows with nothing to say are omitted. */
export function buildContextFooter(c: ContextInput): { html: string; text: string } {
  const agent = isUuid(c.agentSessionId);
  const rows: [string, string, string?][] = []; // [label, text, optional trusted href]
  rows.push(["Source", agent ? "RAG agent draft" : "Contact composer"]);
  const page = clean(c.pageUrl);
  const design = clean(c.design, 40);
  if (page || design) rows.push(["Page", [page, design && `design: ${design}`].filter(Boolean).join(" · ")]);
  if (agent) {
    const link = `${c.origin.replace(/\/+$/, "")}/admin/chats/${c.agentSessionId}`;
    rows.push(["Agent transcript", link, link]);
  }
  const where = [c.geo.city, c.geo.region, c.geo.country].map((x) => clean(x, 80)).filter(Boolean).join(", ");
  if (where) rows.push(["Visitor location", where]);
  const ua = clean(c.userAgent);
  if (ua) rows.push(["Browser", ua]);
  const ref = clean(c.referrer);
  if (ref) rows.push(["Referrer", ref]);
  rows.push(["Sent", c.at.toISOString()]);

  const html =
    `<hr style="border:0;border-top:1px solid #ddd;margin:24px 0 12px">` +
    `<div style="color:#777;font-size:12px;line-height:1.6"><strong>Context</strong> (for you only; delete before replying)<br>` +
    rows.map(([k, v, href]) => `${escapeHtml(k)}: ${href ? `<a href="${escapeHtml(href)}">${escapeHtml(v)}</a>` : escapeHtml(v)}`).join("<br>") +
    `</div>`;
  const text = `\n\n---\nContext (for you only; delete before replying)\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}`;
  return { html, text };
}
