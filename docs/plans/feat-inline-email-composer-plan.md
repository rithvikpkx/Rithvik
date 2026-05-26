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
