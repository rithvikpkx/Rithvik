# Inline Email Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let visitors email Rithvik from the site via a draggable, resizable compose window backed by a `/api/contact` route that sends through the Resend HTTP API.

**Architecture:** A `ContactComposerProvider` context shares open/close state so the Hero and Contact email buttons launch a single `ContactComposer` window (mounted once via `DeferredOverlays`). The window holds a `RichTextEditor` (contentEditable + execCommand). On send it POSTs to `app/api/contact/route.ts`, which sanitizes the body, rate-limits per IP via a `contact_submissions` Supabase table, and sends from `contact@rithvik.ai` with the visitor's address as `reply_to` using `fetch` against `https://api.resend.com/emails`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4 (CSS in `app/globals.css`), Supabase (service-role `adminClient()`), Resend HTTP API. No new runtime dependencies. The sanitizer is unit-tested with Node 22's built-in `node:test` + type stripping (zero deps).

**Spec:** `docs/plans/feat-inline-email-composer.md`

**Workflow note:** All work happens on `dev` (already checked out). Commit each task. Do NOT merge to `main` without explicit approval (see CLAUDE.md). The DB migration must be applied to the linked `Rithvik` project before any merge.

---

### Task 1: Database migration — `contact_submissions`

**Files:**
- Create: `supabase/contact_submissions_migration.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Inline email composer: per-IP rate-limit window + a record of who reached out.
-- Service-role only (the /api/contact route uses adminClient()); no anon policies.
create table if not exists public.contact_submissions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  ip          text,
  from_email  text,
  subject     text,
  status      text not null default 'sent'
);

create index if not exists contact_submissions_ip_created_idx
  on public.contact_submissions (ip, created_at desc);

alter table public.contact_submissions enable row level security;
-- Intentionally no policies: only the service-role key (server route) can read/write.
```

- [ ] **Step 2: Apply to the linked project**

Run: `supabase db query --linked -f supabase/contact_submissions_migration.sql`
Expected: success, no error. (Idempotent — safe to re-run.)

- [ ] **Step 3: Verify the table exists**

Run: `supabase db query --linked --query "select count(*) from public.contact_submissions;"`
Expected: returns `0`.

- [ ] **Step 4: Commit**

```bash
git add supabase/contact_submissions_migration.sql
git commit -m "feat: contact_submissions table for inline email composer"
```

---

### Task 2: Environment variables

**Files:**
- Modify: `.env.local.example`
- Modify: `.env.local` (local only — not committed)

- [ ] **Step 1: Append the new vars to `.env.local.example`**

Add these lines at the end of `.env.local.example`:

```
# Inline email composer (Resend HTTP API — https://api.resend.com/emails)
# RESEND_API_KEY is the same kind of key used for Resend SMTP auth; generate in the Resend dashboard.
# All three are server-only (no NEXT_PUBLIC_ prefix).
RESEND_API_KEY=
CONTACT_FROM=contact@rithvik.ai
CONTACT_TO=rithvikpkx@gmail.com
```

- [ ] **Step 2: Add the same three keys to local `.env.local`** with real values (`RESEND_API_KEY` from the Resend dashboard). Do not commit `.env.local`.

- [ ] **Step 3: Commit the example only**

```bash
git add .env.local.example
git commit -m "chore: document contact composer env vars"
```

---

### Task 3: HTML sanitizer + plaintext fallback (TDD)

**Files:**
- Create: `lib/sanitize-html.ts`
- Test: `lib/sanitize-html.test.ts`

This is pure, security-sensitive logic, so it gets real unit tests via Node 22's built-in test runner (no dependency). Everything else in this plan is verified by `tsc`/`eslint`/`next build`/preview, matching the repo's existing norms.

- [ ] **Step 1: Write the failing test**

Create `lib/sanitize-html.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeEmailHtml, htmlToText } from "./sanitize-html.ts";

test("keeps allowlisted formatting tags", () => {
  assert.equal(sanitizeEmailHtml("<b>hi</b> <i>there</i>"), "<b>hi</b> <i>there</i>");
});

test("keeps lists", () => {
  assert.equal(sanitizeEmailHtml("<ul><li>a</li><li>b</li></ul>"), "<ul><li>a</li><li>b</li></ul>");
});

test("drops script blocks and their contents", () => {
  assert.equal(sanitizeEmailHtml("a<script>alert(1)</script>b"), "ab");
});

test("strips event-handler and style attributes by reconstructing tags", () => {
  assert.equal(sanitizeEmailHtml('<b onclick="x()" style="color:red">x</b>'), "<b>x</b>");
});

test("drops unknown tags but keeps their text", () => {
  assert.equal(sanitizeEmailHtml('<img src=x onerror=alert(1)>text<div>y</div>'), "texty");
});

test("keeps safe http/mailto links, dropping all other attrs", () => {
  assert.equal(
    sanitizeEmailHtml('<a href="https://x.com" onclick="bad()">x</a>'),
    '<a href="https://x.com">x</a>',
  );
});

test("drops javascript: links, keeping the text", () => {
  assert.equal(sanitizeEmailHtml('<a href="javascript:alert(1)">x</a>'), "x");
});

test("normalizes <br>", () => {
  assert.equal(sanitizeEmailHtml("a<br/>b<BR>c"), "a<br>b<br>c");
});

test("htmlToText converts blocks/breaks to newlines and strips tags", () => {
  assert.equal(htmlToText("<p>hi</p><ul><li>a</li><li>b</li></ul>"), "hi\na\nb");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test lib/sanitize-html.test.ts`
Expected: FAIL — cannot resolve `./sanitize-html.ts` (module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `lib/sanitize-html.ts`:

```ts
// Allowlist HTML sanitizer for the contact composer body. The editor produces
// HTML via execCommand; this neutralizes everything outside a safe allowlist by
// RECONSTRUCTING each kept tag from scratch — raw attributes are never echoed
// back, so onclick / style / javascript: payloads can't survive. Used both
// client-side (preview) and server-side (the route never trusts the client).

const ALLOWED_TAGS = new Set([
  "b", "strong", "i", "em", "u", "s", "strike", "ul", "ol", "li", "p", "br", "a",
]);

// Pull a safe href out of an <a> opening tag, or null if absent/unsafe.
function safeHref(tag: string): string | null {
  const m = tag.match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!m) return null;
  const raw = (m[2] ?? m[3] ?? m[4] ?? "").trim();
  // Only web + mail links; blocks javascript:, data:, etc.
  if (!/^(https?:\/\/|mailto:)/i.test(raw)) return null;
  return raw.replace(/[<>"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** Strip the input to an allowlist of inline/list tags, dropping everything else
 *  (including <script>/<style> and their contents) while keeping text. */
export function sanitizeEmailHtml(input: string): string {
  // Drop script/style blocks wholesale (tags + contents) before tokenizing.
  const withoutBlocks = input.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");

  // Walk tag-by-tag; reconstruct kept tags clean, drop the rest, leave text as-is.
  return withoutBlocks.replace(/<\/?[^>]+>/g, (tag) => {
    const m = tag.match(/^<\s*(\/?)\s*([a-z0-9]+)/i);
    if (!m) return "";                          // malformed → drop
    const closing = m[1] === "/";
    const name = m[2].toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return "";     // not allowlisted → drop tag, keep text
    if (closing) return `</${name}>`;
    if (name === "br") return "<br>";
    if (name === "a") {
      const href = safeHref(tag);
      return href ? `<a href="${href}">` : "";  // unsafe/missing href → drop tag, keep text
    }
    return `<${name}>`;                          // reconstruct with NO attributes
  });
}

/** Cheap plaintext fallback for the email's text part: block/break tags become
 *  newlines, remaining tags are stripped, and the few entities we emit decoded. */
export function htmlToText(input: string): string {
  return input
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|li|ul|ol)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types --test lib/sanitize-html.test.ts`
Expected: PASS — all 9 tests pass.

- [ ] **Step 5: Typecheck**

Run: `node_modules/.bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/sanitize-html.ts lib/sanitize-html.test.ts
git commit -m "feat: allowlist HTML sanitizer for contact composer (tested)"
```

---

### Task 4: API route — `app/api/contact/route.ts`

**Files:**
- Create: `app/api/contact/route.ts`

- [ ] **Step 1: Write the route**

```ts
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
    `<p style="color:#888;font-size:13px;margin:0 0 8px">Sent from rithvik.ai by ${sender}</p><hr>`;
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
```

- [ ] **Step 2: Typecheck**

Run: `node_modules/.bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `node_modules/.bin/eslint app/api/contact/route.ts`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/contact/route.ts
git commit -m "feat: /api/contact route — sanitize, rate-limit, send via Resend API"
```

---

### Task 5: `ContactComposerProvider`

**Files:**
- Create: `components/ContactComposerProvider.tsx`

- [ ] **Step 1: Write the provider**

```tsx
"use client";
import { createContext, useContext, useState, type ReactNode } from "react";

interface ContactComposerCtx {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const Ctx = createContext<ContactComposerCtx | null>(null);

/** Shares the composer's open/close state so any email button can launch the
 *  single ContactComposer window mounted at the page root. */
export function ContactComposerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Ctx.Provider value={{ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useContactComposer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useContactComposer must be used within ContactComposerProvider");
  return ctx;
}
```

- [ ] **Step 2: Typecheck**

Run: `node_modules/.bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ContactComposerProvider.tsx
git commit -m "feat: ContactComposerProvider context"
```

---

### Task 6: `RichTextEditor`

**Files:**
- Create: `components/RichTextEditor.tsx`

- [ ] **Step 1: Write the editor**

```tsx
"use client";
import { useRef } from "react";

// execCommand is deprecated but universally supported and dep-free — matching
// the repo's hand-rolled SimpleMarkdown philosophy. The parent reads innerHTML
// on every change and sanitizes (lib/sanitize-html) before sending.
const TOOLS = [
  { cmd: "bold",              label: "B",  title: "Bold",          style: { fontWeight: 700 } },
  { cmd: "italic",            label: "I",  title: "Italic",        style: { fontStyle: "italic" } },
  { cmd: "underline",         label: "U",  title: "Underline",     style: { textDecoration: "underline" } },
  { cmd: "strikeThrough",     label: "S",  title: "Strikethrough", style: { textDecoration: "line-through" } },
  { cmd: "insertUnorderedList", label: "•",  title: "Bullet list" },
  { cmd: "insertOrderedList",   label: "1.", title: "Numbered list" },
] as const;

interface Props {
  onChange: (html: string) => void;
}

export default function RichTextEditor({ onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Apply a formatting command to the current selection, refocus, push HTML up.
  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    ref.current?.focus();
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const addLink = () => {
    const url = window.prompt("Link URL (https://… or mailto:…)");
    if (url) exec("createLink", url);
  };

  return (
    <div className="composer-editor">
      <div className="composer-toolbar" role="toolbar" aria-label="Formatting">
        {TOOLS.map((t) => (
          <button
            key={t.cmd}
            type="button"
            title={t.title}
            aria-label={t.title}
            onMouseDown={(e) => e.preventDefault()}  // keep the selection inside the editor
            onClick={() => exec(t.cmd)}
            style={"style" in t ? (t.style as React.CSSProperties) : undefined}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          title="Link"
          aria-label="Link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={addLink}
        >
          🔗
        </button>
      </div>
      <div
        ref={ref}
        className="composer-body"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Message body"
        suppressContentEditableWarning
        onInput={() => ref.current && onChange(ref.current.innerHTML)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `node_modules/.bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/RichTextEditor.tsx
git commit -m "feat: RichTextEditor (contentEditable + execCommand toolbar)"
```

---

### Task 7: `ContactComposer` window

**Files:**
- Create: `components/ContactComposer.tsx`

Design notes: this is a **non-modal** floating window — the overlay container passes pointer events through (`pointer-events: none`) so the rest of the site stays interactive; only the panel captures events. On mobile it becomes a full-screen sheet (CSS in Task 8). Drag only engages after a small threshold so the close button still clicks (the `setPointerCapture`-on-`pointerdown` pitfall from CLAUDE.md). The copy-address fallback lives on the "To" row.

- [ ] **Step 1: Write the window**

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useContactComposer } from "./ContactComposerProvider";
import RichTextEditor from "./RichTextEditor";

const MIN_W = 360, MIN_H = 420, MAX_W = 760, MAX_H = 820;
const DEFAULT = { w: 460, h: 580 };
const SIZE_KEY = "contact-composer-size";
const DRAG_THRESHOLD = 4;  // px before a pointerdown counts as a drag
const MOBILE_BP = 640;

type Status = "idle" | "sending" | "success" | "error" | "rate-limited";

function clamp(n: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, n)); }

// Read persisted size once. SSR-safe: the window only renders after open().
function loadSize() {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const s = JSON.parse(localStorage.getItem(SIZE_KEY) || "null");
    if (typeof s?.w === "number" && typeof s?.h === "number") {
      return { w: clamp(s.w, MIN_W, MAX_W), h: clamp(s.h, MIN_H, MAX_H) };
    }
  } catch { /* ignore */ }
  return DEFAULT;
}

interface Props { toAddress: string; }

export default function ContactComposer({ toAddress }: Props) {
  const { isOpen, close } = useContactComposer();

  const [size, setSize] = useState(loadSize);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [copied, setCopied] = useState(false);

  // Center on first open (desktop only; mobile is a full-screen sheet via CSS).
  useEffect(() => {
    if (isOpen && pos === null && typeof window !== "undefined") {
      setPos({
        x: Math.max(12, (window.innerWidth - size.w) / 2),
        y: Math.max(12, (window.innerHeight - size.h) / 3),
      });
    }
  }, [isOpen, pos, size.w, size.h]);

  // Esc closes.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  // Persist size whenever it changes.
  useEffect(() => {
    try { localStorage.setItem(SIZE_KEY, JSON.stringify(size)); } catch { /* ignore */ }
  }, [size]);

  // Drag via the header. Capture nothing on pointerdown — only move once past
  // the threshold, so header buttons (close) still click cleanly.
  const startDrag = (e: React.PointerEvent) => {
    if (window.innerWidth < MOBILE_BP) return;        // sheet mode: no drag
    const startX = e.clientX, startY = e.clientY;
    const origin = pos ?? { x: 0, y: 0 };
    let dragging = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      dragging = true;
      setPos({ x: origin.x + dx, y: origin.y + dy });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Resize via the bottom-right handle.
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const origin = { ...size };
    const move = (ev: PointerEvent) => {
      setSize({
        w: clamp(origin.w + (ev.clientX - startX), MIN_W, MAX_W),
        h: clamp(origin.h + (ev.clientY - startY), MIN_H, MAX_H),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const copyTo = async () => {
    try {
      await navigator.clipboard.writeText(toAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable — ignore */ }
  };

  const reset = () => { setFrom(""); setSubject(""); setBodyHtml(""); setStatus("idle"); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, subject, bodyHtml, honeypot }),
      });
      if (res.ok) { setStatus("success"); return; }
      setStatus(res.status === 429 ? "rate-limited" : "error");
    } catch {
      setStatus("error");
    }
  };

  if (!isOpen) return null;

  const sending = status === "sending";
  const canSend = Boolean(from.trim() && subject.trim() && bodyHtml.trim()) && !sending;

  return (
    <div className="composer-overlay" role="dialog" aria-label="Email Rithvik">
      <div
        className="composer-panel"
        style={pos ? { left: pos.x, top: pos.y, width: size.w, height: size.h } : undefined}
      >
        <div className="composer-header" onPointerDown={startDrag}>
          <span className="composer-title">Email Rithvik</span>
          <button type="button" className="composer-close" onClick={close} aria-label="Close">×</button>
        </div>

        {status === "success" ? (
          <div className="composer-success">
            <p>Sent — I’ll get back to you.</p>
            <div className="composer-success-actions">
              <button type="button" onClick={reset}>Send another</button>
              <button type="button" onClick={close}>Close</button>
            </div>
          </div>
        ) : (
          <form className="composer-form" onSubmit={submit}>
            <div className="composer-field composer-to">
              <label>To</label>
              <span className="composer-to-addr">{toAddress}</span>
              <button type="button" className="composer-copy" onClick={copyTo}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="composer-field">
              <label htmlFor="composer-from">From</label>
              <input
                id="composer-from" type="email" required autoFocus
                placeholder="you@example.com"
                value={from} onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="composer-field">
              <label htmlFor="composer-subject">Subject</label>
              <input
                id="composer-subject" type="text" required maxLength={200}
                placeholder="Subject"
                value={subject} onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <RichTextEditor onChange={setBodyHtml} />

            {/* Honeypot: off-screen, hidden from real users; bots fill it. */}
            <input
              type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
              className="composer-hp"
              value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
            />

            {status === "error" && (
              <p className="composer-msg composer-err">Couldn’t send — please try again.</p>
            )}
            {status === "rate-limited" && (
              <p className="composer-msg composer-err">You’ve sent a few already — try again in a bit.</p>
            )}

            <div className="composer-actions">
              <button type="submit" className="composer-send" disabled={!canSend}>
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        )}

        <div className="composer-resize" onPointerDown={startResize} aria-hidden="true" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `node_modules/.bin/tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ContactComposer.tsx
git commit -m "feat: ContactComposer draggable/resizable window"
```

---

### Task 8: Styling — `app/globals.css`

**Files:**
- Modify: `app/globals.css` (append at the end)

- [ ] **Step 1: Append the composer styles**

Add to the end of `app/globals.css`:

```css
/* ── Inline email composer ─────────────────────────────────────────────
   Theme-AWARE (uses site tokens) so it feels native, unlike the RAG bot's
   fixed dark surface. Non-modal: the overlay passes pointer events through;
   only the panel captures them, so the site stays interactive behind it. */
.composer-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  pointer-events: none;
}
.composer-panel {
  position: fixed;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  background: var(--bg-soft, var(--bg));
  color: var(--text);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  border-radius: 14px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}
.composer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  cursor: move;
  user-select: none;
  background: color-mix(in srgb, var(--text) 6%, transparent);
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.1));
}
.composer-title { font-weight: 600; font-size: 0.95rem; }
.composer-close {
  border: none;
  background: transparent;
  color: var(--muted, var(--text));
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}
.composer-close:hover { color: var(--text); }

.composer-form, .composer-success {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  flex: 1;
  min-height: 0;
}
.composer-field { display: flex; align-items: center; gap: 8px; }
.composer-field label {
  width: 56px;
  font-size: 0.8rem;
  color: var(--muted, var(--text));
}
.composer-field input {
  flex: 1;
  background: var(--card, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  border-radius: 8px;
  padding: 8px 10px;
  color: var(--text);
  font: inherit;
}
.composer-field input:focus { outline: none; border-color: var(--accent); }
.composer-to-addr { flex: 1; font-size: 0.9rem; color: var(--text); }
.composer-copy, .composer-success-actions button {
  background: transparent;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.18));
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 0.78rem;
  color: var(--muted, var(--text));
  cursor: pointer;
}
.composer-copy:hover { color: var(--text); border-color: var(--accent); }

/* Editor */
.composer-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  border-radius: 8px;
  overflow: hidden;
}
.composer-toolbar {
  display: flex;
  gap: 2px;
  padding: 6px;
  background: color-mix(in srgb, var(--text) 5%, transparent);
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.1));
}
.composer-toolbar button {
  min-width: 30px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text);
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.85rem;
}
.composer-toolbar button:hover { background: color-mix(in srgb, var(--text) 12%, transparent); }
.composer-body {
  flex: 1;
  min-height: 120px;
  padding: 10px 12px;
  overflow-y: auto;
  outline: none;
  font-size: 0.92rem;
  line-height: 1.5;
}
.composer-body:empty::before {
  content: "Write your message…";
  color: var(--muted, rgba(255, 255, 255, 0.4));
}

.composer-actions { display: flex; justify-content: flex-end; }
.composer-send {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 9px 18px;
  font-weight: 600;
  cursor: pointer;
}
.composer-send:disabled { opacity: 0.5; cursor: not-allowed; }
.composer-msg { font-size: 0.85rem; margin: 0; }
.composer-err { color: #ff6b6b; }
.composer-success { justify-content: center; align-items: center; text-align: center; gap: 16px; }
.composer-success-actions { display: flex; gap: 10px; }

/* Honeypot: pushed fully off-screen, invisible to humans + AT. */
.composer-hp {
  position: absolute !important;
  left: -9999px !important;
  width: 1px;
  height: 1px;
  opacity: 0;
}

/* Resize handle (bottom-right). */
.composer-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  background:
    linear-gradient(135deg, transparent 50%, var(--muted, rgba(255, 255, 255, 0.4)) 50%);
}

/* Mobile: full-screen sheet — drag/resize disabled, inline size overridden. */
@media (max-width: 640px) {
  .composer-overlay { pointer-events: auto; background: rgba(0, 0, 0, 0.4); }
  .composer-panel {
    inset: 0 !important;
    left: 0 !important;
    top: 0 !important;
    width: auto !important;
    height: auto !important;
    border-radius: 0;
  }
  .composer-header { cursor: default; }
  .composer-resize { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .composer-panel { transition: none; }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "style: inline email composer (theme-aware, mobile sheet)"
```

---

### Task 9: Wire it up — provider, mount, and triggers

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/DeferredOverlays.tsx`
- Modify: `components/HeroConnect.tsx`
- Modify: `components/Contact.tsx`

- [ ] **Step 1: Wrap the page in the provider and pass the address to overlays**

In `app/page.tsx`, add the import after line 9 (`import DeferredOverlays …`):

```tsx
import { ContactComposerProvider } from "@/components/ContactComposerProvider";
```

Wrap the returned tree in the provider and pass `emailUrl` to `DeferredOverlays`. Replace the `return ( … )` block (lines 34–67) with:

```tsx
  return (
    <ContactComposerProvider>
      <Nav />
      <main>
        <Hero
          subLine={content["hero.sub_line"]}
          tagLine={content["hero.tagline"]}
          nameLine1={content["hero.name.line1"]}
          nameLine2={content["hero.name.line2"]}
          githubUrl={content["contact.link.github"]}
          linkedinUrl={content["contact.link.linkedin"]}
          emailUrl={content["contact.link.email"]}
        />
        <Bento
          building={bentoBuilding}
          stack={bentoStack}
          interests={bentoInterests}
          markers={bentoGlobeMarkers}
        />
        <Education />
        <Projects />
        <Experience />
        <Contact
          headline={content["contact.headline"]}
          sub={content["contact.sub"]}
          githubUrl={content["contact.link.github"]}
          linkedinUrl={content["contact.link.linkedin"]}
          emailUrl={content["contact.link.email"]}
        />
      </main>
      <Footer />
      <DeferredOverlays emailUrl={content["contact.link.email"]} />
    </ContactComposerProvider>
  );
```

- [ ] **Step 2: Mount the composer in `DeferredOverlays`**

Replace the entire contents of `components/DeferredOverlays.tsx` with:

```tsx
"use client";
import dynamic from "next/dynamic";

// Both widgets are non-critical overlays: RagBot is a launcher pinned bottom-
// right (below the fold), and SecondaryContextPanel only renders in edit mode.
// ContactComposer renders nothing until its launch button is clicked. Splitting
// them out of the initial bundle shrinks First Load JS for every visitor.
// ssr:false is valid here because this file is a Client Component.
const RagBot = dynamic(() => import("./RagBot"), { ssr: false });
const SecondaryContextPanel = dynamic(() => import("./SecondaryContextPanel"), { ssr: false });
const ContactComposer = dynamic(() => import("./ContactComposer"), { ssr: false });

// Derive the public "To" address shown in the composer from the editable
// contact.link.email value (mailto: stripped), falling back to the default.
const DEFAULT_EMAIL = "rithvikpkx@gmail.com";

/** Mounts the deferred, non-critical overlay widgets. Rendered at the end of
 *  the page so neither blocks the main content's hydration. */
export default function DeferredOverlays({ emailUrl }: { emailUrl?: string }) {
  const toAddress = (emailUrl ?? "").replace(/^mailto:/i, "").trim() || DEFAULT_EMAIL;
  return (
    <>
      <SecondaryContextPanel />
      <RagBot />
      <ContactComposer toAddress={toAddress} />
    </>
  );
}
```

- [ ] **Step 3: Make the Hero email button open the composer**

In `components/HeroConnect.tsx`:

Add the import after line 5 (`import { GithubIcon … }`):

```tsx
import { useContactComposer } from "./ContactComposerProvider";
```

Inside the component, after `const containerRef = useRef…` (line 17 area), add:

```tsx
  const { open } = useContactComposer();
```

Replace the email `<button>` (lines 93–101) `onClick` and `aria-label` so it opens the composer:

```tsx
        <button
          ref={emailRef}
          type="button"
          onClick={open}
          className="hero-connect-btn"
          aria-label="Email Rithvik"
        >
          <EmailIcon size={22} />
        </button>
```

The existing `copyEmail`, `copied` state, and the `hero-connect-copied` toast become unused — remove them: delete the `copyEmail` function (lines 25–37), the `copied`/`copyTimer` state (lines 22–23), and the `{copied && (…)}` block (lines 104–108). The copy fallback now lives inside the composer's "To" row.

- [ ] **Step 4: Make the Contact section email button open the composer**

In `components/Contact.tsx`:

Add the import after line 6 (`import { GithubIcon … }`):

```tsx
import { useContactComposer } from "./ContactComposerProvider";
```

Inside the component, after `const { isEditing } = useEditMode();` (line 27), add:

```tsx
  const { open } = useContactComposer();
```

Change the `isCopy` branch's button (lines 86–89) to open the composer instead of copying:

```tsx
              <button type="button" onClick={open} className="contact-link" aria-label="Email Rithvik">
                <Icon />
                {label}
              </button>
```

Leave `copyEmail`, the `copied` state, and the `{isCopy && copied && …}` toast in place if still referenced; otherwise remove them. (The copy fallback is in the composer.) The edit-mode URL editor for `contact.link.email` stays unchanged.

- [ ] **Step 5: Typecheck + lint the touched files**

Run:
```bash
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint app/page.tsx components/DeferredOverlays.tsx components/HeroConnect.tsx components/Contact.tsx
```
Expected: no errors. (If `eslint` flags now-unused `copyEmail`/`copied` in HeroConnect or Contact, remove those symbols.)

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx components/DeferredOverlays.tsx components/HeroConnect.tsx components/Contact.tsx
git commit -m "feat: wire email buttons to ContactComposer via provider"
```

---

### Task 10: Full verification, docs, and preview test

**Files:**
- Modify: `CLAUDE.md` (document the feature, env, file layout)

- [ ] **Step 1: Update `CLAUDE.md`**

- Under **Stack** (Resend bullet), note that the contact composer sends via the Resend **HTTP API** (`fetch`), distinct from the SMTP path used for Supabase auth emails.
- Add an **Architecture** subsection "Inline email composer" summarizing: `ContactComposerProvider` → `ContactComposer` (draggable/resizable, theme-aware, non-modal, mobile sheet) → `RichTextEditor` (execCommand) → `/api/contact` (sanitize via `lib/sanitize-html`, per-IP rate limit via `contact_submissions`, send via Resend API with `reply_to` = visitor). Note the honeypot and the 3/hour/IP limit.
- Under **Database**, add `contact_submissions` (service-role only; rate-limit window + contact log).
- Under **Migrations**, add `contact_submissions_migration.sql`.
- Under **File layout cheat sheet**, add `api/contact/route.ts`, `components/ContactComposer*`, `RichTextEditor`, and `lib/sanitize-html.ts`.
- Add a **Pitfalls** note: Resend can only send from a verified `rithvik.ai` address — visitor goes in `reply_to`, never `from` (SPF/DKIM would reject otherwise).
- Update the env list to include `RESEND_API_KEY`, `CONTACT_FROM`, `CONTACT_TO`.

- [ ] **Step 2: Run the sanitizer tests**

Run: `node --experimental-strip-types --test lib/sanitize-html.test.ts`
Expected: all pass.

- [ ] **Step 3: Full typecheck, lint, build**

Run:
```bash
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint .
npm run build
```
Expected: all clean; `next build` succeeds.

- [ ] **Step 4: Commit docs**

```bash
git add CLAUDE.md
git commit -m "docs: document inline email composer in CLAUDE.md"
```

- [ ] **Step 5: Push to `dev` and test on the Vercel preview**

```bash
git push origin dev
```

On the preview URL, manually verify (this is the only way to catch SSR/edge issues per CLAUDE.md):
1. Click the email button in **both** the Hero cluster and the Contact section → the composer opens centered.
2. Drag the window by its header; resize from the bottom-right handle; reload → size persisted.
3. Type a From address, Subject, and a body using **bold / italic / underline / strikethrough / bullet / numbered / link**.
4. Click **Send** → success state. Confirm the email **arrives in the inbox**, sent from `contact@rithvik.ai`, with the visitor's address as **Reply-To** and rendered formatting.
5. Hit "reply" in the inbox → recipient is the visitor's address.
6. **Honeypot:** in devtools, set the hidden `.composer-hp` input's value before sending → server returns ok but **no email arrives** and **no row** is logged... (it returns fake-ok and drops; confirm no inbox email).
7. **Rate limit:** send 4 times within an hour from the same client → the 4th shows the rate-limited message (429).
8. **Mobile:** narrow the viewport (<640px) → composer is a full-screen sheet; dragging/resizing disabled.

- [ ] **Step 6: (After explicit user approval only) merge to `main`**

Per CLAUDE.md — do NOT do this without the user saying "merge to main", and only after the migration is applied to the linked project:

```bash
git checkout main && git pull origin main
git merge --no-ff dev -m "chore: merge dev → main (inline email composer)"
git push origin main
```

---

## Self-review notes (for the implementer)

- **Spec coverage:** Every spec section maps to a task — send path (Task 4), from/reply-to (Task 4), abuse guard (Tasks 1+4), rate store (Task 1), editor (Task 6), window UX (Tasks 7+8), triggers (Task 9), env (Task 2), DB (Task 1), verification (Task 10).
- **Deviation from spec — modality:** the spec said "focus trap / aria-modal"; this plan implements a **non-modal** floating window (overlay passes pointer events through) because a draggable window the user moves around to see content underneath is non-modal by nature. Mobile is effectively modal (full-screen sheet with backdrop). Esc closes; the From field autofocuses. If the user prefers a true modal, swap the overlay to `pointer-events: auto` + add a focus trap.
- **Copy fallback:** lives on the composer's "To" row (not duplicated in Hero/Contact), satisfying "keep copy as fallback" with minimal surface-area churn.
- **Type consistency:** `useContactComposer()` → `{ isOpen, open, close }` used identically in Tasks 5/7/9. `sanitizeEmailHtml`/`htmlToText` signatures match across Tasks 3/4. `ContactComposer` prop `toAddress` matches the mount in Task 9.

---

# Phase 2 — Polish & delivery additions

> **Status:** spec / not yet implemented. Phase 1 is built, on `dev`. These build on top of it.

**Goal:** Make the composer window pop and feel alive, give the user clear affordances (draggable, peek-through), add a delightful send animation, and improve email delivery so the sender gets a copy and Rithvik can reply-all to thread.

**Decisions locked during brainstorming:**
- **Email copies:** send ONE email to Rithvik's inbox with the sender **CC'd** (Resend `cc`). The sender receives that exact copy — which *is* their confirmation — and Rithvik replies-all to thread with them. No separate/duplicate confirmation email. (`reply_to` = sender is kept too, so a plain reply still reaches them.)
- **Send animation:** the message **dematerializes into particles**, the particles **morph into a paper airplane**, which then **flies off with a trail**, after which the success state fades in. Canvas + rAF, dep-free. Honors `prefers-reduced-motion` (skips straight to success). "Dematerialize" = particles emanate from the message-body region and scatter (not a literal pixel-capture of the text — that would need a heavy rasterizer).
- **Rainbow border:** reuse the RAG `.rag-shine` technique (a masked radial-gradient 1px ring overlay, animated via `background-position`) as `.composer-shine`. The panel surface stays theme-aware; only the border ring is the fixed purple/orange gradient.

**Files touched:**
- Modify: `app/api/contact/route.ts` (add `cc`)
- Modify: `components/ContactComposer.tsx` (shine overlay, drag hint, peek button, send-animation wiring)
- Create: `components/SendAnimation.tsx` (canvas particle → airplane → fly-off)
- Modify: `app/globals.css` (shine, drag grip, peek, animation overlay)
- Modify: `CLAUDE.md` (document Phase 2)

---

### Task P2.1: CC the sender (confirmation + threading)

**Files:**
- Modify: `app/api/contact/route.ts`

This single change satisfies BOTH "send the user a confirmation" and "CC the sender so I can reply-all to thread." The sender's copy is the confirmation.

- [ ] **Step 1: Add `cc` to the Resend payload**

In `app/api/contact/route.ts`, the `fetch` body currently is:

```ts
    body: JSON.stringify({
      from: process.env.CONTACT_FROM!,
      to: process.env.CONTACT_TO!,
      reply_to: sender,
      subject: `[rithvik.ai] ${subject.trim()}`,
      html: headerLine + cleanHtml,
      text: `Sent from rithvik.ai by ${sender}\n\n${htmlToText(cleanHtml)}`,
    }),
```

Change it to CC the sender:

```ts
    body: JSON.stringify({
      from: process.env.CONTACT_FROM!,
      to: process.env.CONTACT_TO!,
      cc: [sender],            // sender gets a copy (their confirmation) + reply-all threads them in
      reply_to: sender,        // plain reply still reaches the sender even if CC is stripped
      subject: `[rithvik.ai] ${subject.trim()}`,
      html: headerLine + cleanHtml,
      text: `Sent from rithvik.ai by ${sender}\n\n${htmlToText(cleanHtml)}`,
    }),
```

Note: the sender already sees `CONTACT_TO` (it's the composer's "To" address), so CC'ing exposes nothing new. `sender` is already validated (`EMAIL_RE`) and HTML-escaped where rendered.

- [ ] **Step 2: Verify**

Run: `node_modules/.bin/tsc --noEmit` → clean. `node_modules/.bin/eslint app/api/contact/route.ts` → clean.

- [ ] **Step 3: Commit**

```bash
git add app/api/contact/route.ts
git commit -m "feat(composer): CC the sender so they get a copy and Rithvik can reply-all"
```

---

### Task P2.2: Rainbow shine border

**Files:**
- Modify: `app/globals.css`
- Modify: `components/ContactComposer.tsx`

- [ ] **Step 1: Add the shine overlay CSS**

Append to the composer block in `app/globals.css` (after the `.composer-panel` rule). The panel already has `overflow: hidden`; add `isolation: isolate` to it and the shine overlay:

```css
/* Rainbow shine border — mirrors .rag-shine: a radial gradient masked into a
   1px ring, animated by shifting background-position. Makes the window pop off
   the content beneath it. */
.composer-panel { isolation: isolate; }
.composer-shine {
  pointer-events: none;
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: radial-gradient(
    transparent,
    transparent,
    rgba(156, 64, 255, 0.85),
    rgba(255, 170, 64, 0.85),
    transparent,
    transparent
  );
  background-size: 300% 300%;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  animation: rag-shine 14s linear infinite;   /* reuse the existing keyframes */
  z-index: 2;
}
@media (prefers-reduced-motion: reduce) {
  .composer-shine { animation: none; }
}
```

(Reuses the existing `@keyframes rag-shine` defined earlier in the file — do not redefine it.)

- [ ] **Step 2: Render the overlay inside the panel**

In `components/ContactComposer.tsx`, add the shine as the FIRST child of `.composer-panel`, before the header:

```tsx
      <div
        ref={panelRef}
        className="composer-panel"
        style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      >
        <div className="composer-shine" aria-hidden="true" />
        <div className="composer-header" onPointerDown={startDrag}>
```

Because the header/form are normal-flow children and the shine is `position:absolute; z-index:2; pointer-events:none`, content stays interactive and the ring floats on top of the border.

- [ ] **Step 3: Verify + commit**

```bash
node_modules/.bin/tsc --noEmit
git add app/globals.css components/ContactComposer.tsx
git commit -m "feat(composer): rainbow shine border (mirrors RAG UI)"
```

---

### Task P2.3: Drag hint

**Files:**
- Modify: `components/ContactComposer.tsx`
- Modify: `app/globals.css`

A subtle grip glyph centered in the header signals draggability, plus a `grab`/`grabbing` cursor and a `title` tooltip.

- [ ] **Step 1: Add the grip element to the header**

In `components/ContactComposer.tsx`, update the header to include a grip between the title and close button:

```tsx
        <div className="composer-header" onPointerDown={startDrag} title="Drag to move">
          <span className="composer-title">Email Rithvik</span>
          <span className="composer-grip" aria-hidden="true">
            <i></i><i></i><i></i>
          </span>
          <button type="button" className="composer-close" onClick={close} aria-label="Close">×</button>
        </div>
```

- [ ] **Step 2: Style the grip + grab cursor**

In `app/globals.css`, replace the `.composer-header { … cursor: move … }` declaration's cursor with `grab`, and add the grip styles:

```css
.composer-header { cursor: grab; }
.composer-header:active { cursor: grabbing; }
/* Three dots: a quiet, conventional "draggable" affordance. */
.composer-grip {
  display: flex;
  gap: 3px;
  margin-left: auto;
  margin-right: 10px;
  opacity: 0.45;
  transition: opacity 0.2s;
}
.composer-header:hover .composer-grip { opacity: 0.8; }
.composer-grip i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--muted, currentColor);
}
```

(The existing `.composer-header` rule sets `justify-content: space-between`; with the grip using `margin-left:auto` the title stays left, grip + close sit right. If layout looks off, change the header to `justify-content: flex-start` — the `margin-left:auto` on the grip already pushes it and the close button to the right edge.)

- [ ] **Step 3: Verify + commit**

```bash
node_modules/.bin/tsc --noEmit
git add components/ContactComposer.tsx app/globals.css
git commit -m "feat(composer): subtle drag-handle grip + grab cursor"
```

---

### Task P2.4: Peek-through (hover to see content beneath)

**Files:**
- Modify: `components/ContactComposer.tsx`
- Modify: `app/globals.css`

An "eye" button in the header; hovering (or focusing) it drops the whole panel's opacity dramatically so the user can glance at what's underneath, then restores on leave. Implemented with CSS `:has()` (no JS state needed) plus a `transition` for smoothness.

- [ ] **Step 1: Add the peek button to the header**

In `components/ContactComposer.tsx`, add the eye button just before the close button:

```tsx
          <button
            type="button"
            className="composer-peek"
            aria-label="Hold to peek at the page behind"
            title="Peek at the page behind"
          >
            {/* eye icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
```

- [ ] **Step 2: Add the peek CSS**

In `app/globals.css`:

```css
.composer-peek {
  display: flex;
  align-items: center;
  border: none;
  background: transparent;
  color: var(--muted, var(--text));
  cursor: pointer;
  padding: 0 4px;
}
.composer-peek:hover { color: var(--text); }
.composer-panel { transition: opacity 0.18s ease; }
/* While the peek control is hovered/focused, fade the whole window so the user
   can glance at the page beneath without moving or closing it. */
.composer-panel:has(.composer-peek:hover),
.composer-panel:has(.composer-peek:focus-visible) {
  opacity: 0.12;
}
```

(`:has()` is supported in all current evergreen browsers. The panel stays interactive at low opacity — moving off the eye restores it.)

- [ ] **Step 3: Verify + commit**

```bash
node_modules/.bin/tsc --noEmit
git add components/ContactComposer.tsx app/globals.css
git commit -m "feat(composer): peek-through control to glance at the page behind"
```

---

### Task P2.5: Send animation (particles → paper airplane → fly-off)

**Files:**
- Create: `components/SendAnimation.tsx`
- Modify: `components/ContactComposer.tsx`
- Modify: `app/globals.css`

A canvas overlay. Phase 1 (0–0.5s): particles appear scattered across the panel body and jitter (dematerialize). Phase 2 (0.5–1.2s): particles ease to target points that form a paper-airplane silhouette (morph). Phase 3 (1.2–2.2s): the whole formation translates along an arc up-and-right off the viewport, leaving a fading trail. On finish → `onDone()`. Reduced-motion → `onDone()` immediately.

- [ ] **Step 1: Create `components/SendAnimation.tsx`**

```tsx
"use client";
import { useEffect, useRef } from "react";

interface Props {
  /** Panel rect the particles emanate from (the message area). */
  rect: DOMRect;
  onDone: () => void;
}

const COUNT = 150;
const DEMAT_MS = 500;          // dematerialize
const MORPH_MS = 700;          // morph into airplane
const FLY_MS = 1000;           // fly off
const TOTAL = DEMAT_MS + MORPH_MS + FLY_MS;

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeIn = (t: number) => t * t;

// A paper-airplane silhouette as normalized [0..1] points; sampled along its
// edges so particles settle into a recognizable plane. Centered on (0.5,0.5).
function airplanePoints(n: number, scale: number): { x: number; y: number }[] {
  // Edges of a classic paper plane (nose right). Coordinates in a -1..1 box.
  const verts: [number, number][] = [
    [1, 0], [-1, -0.7], [-0.35, 0],   // top wing
    [-1, 0.7], [1, 0], [-0.35, 0],    // bottom wing + keel
  ];
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const seg = (i / n) * (verts.length - 1);
    const a = verts[Math.floor(seg)];
    const b = verts[Math.min(Math.floor(seg) + 1, verts.length - 1)];
    const f = seg - Math.floor(seg);
    pts.push({
      x: (a[0] + (b[0] - a[0]) * f) * scale,
      y: (a[1] + (b[1] - a[1]) * f) * scale,
    });
  }
  return pts;
}

/** Reads a CSS custom property to an rgb string, falling back to a default. */
function tokenColor(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export default function SendAnimation({ rect, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Respect reduced motion: skip the show.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onDone();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) { onDone(); return; }
    const ctx = canvas.getContext("2d");
    if (!ctx) { onDone(); return; }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);

    const accent = tokenColor("--accent", "#9c40ff");
    const text = tokenColor("--text", "#ffffff");

    // Formation center starts at the panel center; airplane targets are relative.
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const targets = airplanePoints(COUNT, Math.min(rect.width, 220) * 0.35);

    const parts = Array.from({ length: COUNT }, (_, i) => ({
      // scatter origin: random within the message rect
      sx: rect.left + Math.random() * rect.width,
      sy: rect.top + Math.random() * rect.height,
      jx: (Math.random() - 0.5) * 40,   // dematerialize jitter
      jy: (Math.random() - 0.5) * 40,
      tx: targets[i].x,
      ty: targets[i].y,
      size: 1 + Math.random() * 2,
      color: Math.random() < 0.5 ? accent : text,
    }));

    // Flight path: ease up and to the right, off-screen.
    const flyDX = window.innerWidth - cx + 200;
    const flyDY = -(cy + 200);

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      let fx = cx, fy = cy, alpha = 1;
      for (const p of parts) {
        let x: number, y: number;
        if (elapsed < DEMAT_MS) {
          const t = elapsed / DEMAT_MS;
          x = p.sx + p.jx * t;
          y = p.sy + p.jy * t;
          alpha = 1;
        } else if (elapsed < DEMAT_MS + MORPH_MS) {
          const t = easeInOut((elapsed - DEMAT_MS) / MORPH_MS);
          x = (p.sx + p.jx) + (cx + p.tx - (p.sx + p.jx)) * t;
          y = (p.sy + p.jy) + (cy + p.ty - (p.sy + p.jy)) * t;
        } else {
          const t = easeIn(Math.min((elapsed - DEMAT_MS - MORPH_MS) / FLY_MS, 1));
          x = cx + p.tx + flyDX * t;
          y = cy + p.ty + flyDY * t;
          alpha = 1 - t;            // fade as it leaves
          fx = cx + flyDX * t; fy = cy + flyDY * t;
        }
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      // (fx, fy used implicitly via per-particle math; kept for readability.)
      void fx; void fy;

      if (elapsed < TOTAL) {
        raf = requestAnimationFrame(frame);
      } else {
        onDone();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className="composer-send-canvas" aria-hidden="true" />;
}
```

NOTE on the `eslint-disable`: if the repo's lint flags it as *unused* (the rule may not fire), remove the directive. The effect intentionally runs once; `rect`/`onDone` are captured at mount.

- [ ] **Step 2: Canvas overlay CSS**

In `app/globals.css`:

```css
/* Send animation canvas — covers the viewport so the airplane can fly off. */
.composer-send-canvas {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 90;   /* above the composer (70) */
}
```

- [ ] **Step 3: Wire it into the send flow in `components/ContactComposer.tsx`**

The animation plays during `"sending"`, and the success/error view only resolves once BOTH the animation has finished AND the request has settled. Add two refs and a `finalize`, and capture the panel rect when sending starts.

Add refs near the other state:

```tsx
  const animDone = useRef(false);
  const sendResult = useRef<Status | null>(null);
  const [sendRect, setSendRect] = useState<DOMRect | null>(null);
```

Replace `confirmSend` with:

```tsx
  // Show the result only when the animation has finished AND the request settled.
  const finalize = () => {
    if (!animDone.current || !sendResult.current) return;
    setStatus(sendResult.current);
    setSendRect(null);
  };

  const confirmSend = async () => {
    animDone.current = false;
    sendResult.current = null;
    setSendRect(panelRef.current?.getBoundingClientRect() ?? null);
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, subject, bodyHtml, honeypot }),
      });
      sendResult.current = res.ok ? "success" : res.status === 429 ? "rate-limited" : "error";
    } catch {
      sendResult.current = "error";
    }
    finalize();
  };

  const onAnimDone = () => { animDone.current = true; finalize(); };
```

Render the animation overlay when sending (add inside the panel, e.g. right after `.composer-shine`):

```tsx
        {status === "sending" && sendRect && (
          <SendAnimation rect={sendRect} onDone={onAnimDone} />
        )}
```

Add the import at the top: `import SendAnimation from "./SendAnimation";`

Behavior check: on "Confirm & send" the confirm view stays (buttons disabled, "Sending…"), the canvas plays over everything; when both the fetch and the animation are done, the view switches to success (or error/rate-limited, which renders the form again with the message). Reduced-motion users skip the animation (`onDone` fires immediately) and just wait on the fetch.

- [ ] **Step 4: Verify**

```bash
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint components/SendAnimation.tsx components/ContactComposer.tsx
command npm run build
```
All clean; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/SendAnimation.tsx components/ContactComposer.tsx app/globals.css
git commit -m "feat(composer): particle→paper-airplane send animation"
```

---

### Task P2.6: Docs, verification, preview

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `CLAUDE.md`** — in the inline-email-composer architecture subsection, note: the rainbow `.composer-shine` border (mirrors RAG), the drag-grip + grab cursor, the `:has()`-based peek-through control, the `SendAnimation` canvas (particles → airplane → fly-off, reduced-motion aware), and that the route now CCs the sender (their copy is the confirmation; reply-all threads them in).

- [ ] **Step 2: Full gates**

```bash
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint .
command npm run build
```
All clean; `eslint .` stays at 0 errors.

- [ ] **Step 3: Commit + push**

```bash
git add CLAUDE.md
git commit -m "docs: document inline email composer Phase 2 additions"
git push origin dev
```

- [ ] **Step 4: Preview test (manual — needs the dev preview + live RESEND_API_KEY)**

1. Window has the animated rainbow border and pops off the page.
2. Header shows the grip dots; cursor is grab/grabbing; dragging is still smooth.
3. Hovering the eye drops the window to ~12% opacity so you can see the page behind; leaving restores it.
4. Send → confirm → "Confirm & send" plays the particle→airplane→fly-off animation, then success.
5. **Email:** the message arrives in Rithvik's inbox with the **sender CC'd**; the **sender also receives the copy** (confirmation); hitting **reply-all** addresses the sender and threads from that email.
6. Reduced-motion (OS setting): shine/animation are static/skipped; send still works.

---

## Phase 2 self-review notes

- **Confirmation == CC:** the single CC'd email is the sender's confirmation; no second email is sent (decided during brainstorming). This satisfies both the "confirmation email" and "CC the sender" requests with one send.
- **Animation correctness:** success/error is gated on BOTH animation completion and request settlement (two refs + `finalize`), so a slow network doesn't show success early and a fast network doesn't cut the animation. Reduced-motion short-circuits `onDone`.
- **`:has()` peek:** no JS state; the panel stays interactive at low opacity so the user can keep typing while peeking. If a target browser lacks `:has()` (none current), the window simply won't fade — graceful.
- **Shine reuses `@keyframes rag-shine`** — do not duplicate the keyframes; only add the `.composer-shine` rule.
- **Type consistency:** `SendAnimation` prop `rect: DOMRect`, `onDone: () => void`; `sendResult` reuses the `Status` union (`"success" | "error" | "rate-limited"`).
