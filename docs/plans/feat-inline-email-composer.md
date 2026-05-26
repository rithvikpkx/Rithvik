# Feature: Inline Email Composer

**Status:** spec / not yet implemented
**Branch:** `dev` (per CLAUDE.md workflow)

## Goal

Let a visitor email Rithvik directly from the website with minimal friction. Clicking
the email button opens a **draggable, resizable compose window** overlaying the site.
The visitor fills in their own email (so Rithvik knows who to reply to), a subject, and
a rich-text body, then sends. The message lands in Rithvik's inbox, sent from a verified
`rithvik.ai` address with the visitor's address in `Reply-To` — so replying is one click.

Today the email button only copies the address to the clipboard. After this feature the
button opens the composer, with a small "copy address" affordance kept as a fallback.

## Key decisions (locked during brainstorming)

- **Send path:** **fetch-based Resend HTTP API** (`POST https://api.resend.com/emails`).
  No SMTP, no `nodemailer` — `fetch` is built into the Node runtime, which is the better
  fit for a one-shot send on Vercel's serverless functions. Same Resend API key, same
  verified `rithvik.ai` domain, same deliverability as SMTP.
- **From / Reply-To:** Resend can only send *from* a verified domain address. So:
  `from: contact@rithvik.ai`, `to:` Rithvik's inbox, `reply_to:` the visitor's address.
  The visitor's email also appears in the body. Hitting "reply" in the inbox goes straight
  to the visitor. (`contact@rithvik.ai` is already covered by the existing verified domain —
  **no new DNS records**.)
- **Abuse protection:** per-IP rate limit (3 sends/hour) + hidden honeypot field + email
  format/length validation. No CAPTCHA, no third-party service, no friction for real senders.
- **Rate-limit store:** a `contact_submissions` table in the existing Supabase Postgres
  (no new service; doubles as a contact log).
- **Editor:** hand-rolled `contentEditable` + toolbar with **bold, italic, underline,
  strikethrough, bullet list, numbered list, link** via `document.execCommand`. Dep-free,
  matching the repo's hand-rolled `SimpleMarkdown` philosophy. Output serialized to a
  sanitized tag allowlist — raw `innerHTML` is never trusted.
- **Window UX:** draggable + resizable (RAG-style: clamped min/max, size persisted to
  `localStorage`) on desktop; full-screen sheet on mobile. **Theme-aware** (uses site
  tokens `--card`/`--bg`/`--text`/`--accent`/`--border`) so it feels native to the site —
  deliberately *unlike* the RAG bot's fixed dark `--rag-*` surface.
- **Triggers:** both the Hero connect-cluster email button and the Contact section email
  button open the composer; a small "copy address" affordance remains as fallback.

## Architecture

### Components (client)

- **`components/ContactComposerProvider.tsx`** — React context holding `isOpen` +
  `open()` / `close()`. Wraps the page sections so any email button can call `open()`.
  Exposes `useContactComposer()`. Mirrors the `EditModeProvider` / `ThemeProvider` pattern.
- **`components/ContactComposer.tsx`** — the window, mounted **once** (like `RagBot`), not
  per-button. Reads `isOpen` from the provider. Owns:
  - Drag (via header bar) and resize (corner handle), clamped to a min/max, size persisted
    to `localStorage[contact-composer-size]` and hydrated SSR-safe via lazy `useState`.
  - **Drag safety:** do NOT `setPointerCapture` on `pointerdown` — only after a small drag
    threshold is crossed (documented pitfall: capturing early breaks header button clicks).
  - Desktop = floating window; mobile (≤ breakpoint) = full-screen sheet.
  - Form state: `from`, `subject`, body HTML (from the editor), honeypot field, and a UI
    status machine: `idle → sending → success | error | rate-limited`.
  - Esc closes, focus trap, `aria` labels, honors `prefers-reduced-motion`.
- **`components/RichTextEditor.tsx`** — `contentEditable` region + toolbar. Each toolbar
  button runs the matching `document.execCommand` (`bold`, `italic`, `underline`,
  `strikeThrough`, `insertUnorderedList`, `insertOrderedList`, `createLink`). Exposes the
  current body to the parent (controlled-ish: parent reads serialized HTML on send).
- **`lib/sanitize-html.ts`** — small dep-free serializer/sanitizer. Walks the editor's DOM
  (or parses a string) and emits only an allowlist of tags/attrs:
  `b, strong, i, em, u, s, strike, ul, ol, li, a[href], p, br`. Strips everything else
  (scripts, styles, event handlers, disallowed attrs). Used **both** client-side (preview)
  and server-side (never trust the client).

### Changed components

- **`components/HeroConnect.tsx`** — email button calls `useContactComposer().open()`
  instead of copy-only; keep copy as a small secondary affordance.
- **`components/Contact.tsx`** — same change for the Contact email link/button.
- **`app/page.tsx`** — wrap sections in `ContactComposerProvider`; mount
  `<ContactComposer />` once alongside `RagBot`.

### API route — `app/api/contact/route.ts` (POST)

Per-request pipeline:

1. **Parse** JSON `{ from, subject, bodyHtml, honeypot }`.
2. **Honeypot** — if `honeypot` is non-empty, return a fake `200 { ok: true }` and drop
   (don't tip off bots).
3. **Validate** — `from` matches an email regex; `subject` non-empty and ≤ ~200 chars;
   `bodyHtml` within a length cap. **Re-sanitize** `bodyHtml` server-side via
   `lib/sanitize-html.ts`. On failure return `400 { error }`.
4. **Rate limit** — read client IP from `x-forwarded-for`; count `contact_submissions`
   rows for that IP in the last hour via `adminClient()`. If ≥ 3, return
   `429 { error: "rate-limited" }`.
5. **Send** — `POST https://api.resend.com/emails` with `Authorization: Bearer RESEND_API_KEY`:
   - `from`: `CONTACT_FROM` (`contact@rithvik.ai`)
   - `to`: `CONTACT_TO` (Rithvik's inbox)
   - `reply_to`: the visitor's `from`
   - `subject`: `[rithvik.ai] <subject>`
   - `html`: a small header line ("Sent from rithvik.ai by &lt;from&gt;") + sanitized body
   - `text`: plaintext fallback derived from the body
   - On non-2xx from Resend, return `502 { error }` and do NOT log a success row.
6. **Log + respond** — insert a `contact_submissions` row (created_at, ip, from_email,
   subject, status) and return `200 { ok: true }`.

Runtime: Node (default). The route reads only server env vars and uses `adminClient()`
(service-role) for DB access, consistent with `app/api/chat/route.ts`.

### Database — `supabase/contact_submissions_migration.sql`

```sql
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
-- No anon policies: service-role only (route uses adminClient()).
```

Apply via `supabase db query --linked -f supabase/contact_submissions_migration.sql`
to the **`Rithvik`** project BEFORE merging to `main`.

### Environment

Add to `.env.local` and `.env.local.example`:

```
# Inline email composer (Resend HTTP API)
RESEND_API_KEY=
CONTACT_FROM=contact@rithvik.ai
CONTACT_TO=rithvikpkx@gmail.com
```

`RESEND_API_KEY` is the same kind of key already used for Resend SMTP auth; generate one
in the Resend dashboard. All three are **server-only** (no `NEXT_PUBLIC_` prefix).

## UX states

- **idle** — form editable, Send enabled when `from` + `subject` + non-empty body are valid.
- **sending** — Send disabled + spinner.
- **success** — "Sent — I'll get back to you." Offer Close / "Send another".
- **error** — inline error with a retry; body preserved.
- **rate-limited** — friendly "You've sent a few already — try again in a bit," keep body.

## Styling

New rules in `app/globals.css` for the composer window, header/drag bar, resize handle,
toolbar, editor surface, and form fields — all using site theme tokens so it adapts across
all 14 themes. Mobile full-screen sheet via a media query.

## Out of scope (YAGNI)

- Attachments / file uploads.
- CC'ing the visitor a copy (chose against during brainstorming).
- CAPTCHA.
- Saving drafts across sessions.
- Markdown export of the body.

## Verification (per CLAUDE.md)

1. `node_modules/.bin/tsc --noEmit` clean.
2. `eslint` clean on touched files.
3. `next build` succeeds.
4. Apply the migration to the linked `Rithvik` project.
5. On the `dev` Vercel preview: open composer from both buttons, drag/resize, format text,
   send a **real test email** and confirm it arrives in the inbox with the visitor's
   address as `Reply-To`. Test honeypot + rate limit (4th send within an hour → 429).
6. Only then, with explicit approval, `--no-ff` merge `dev → main`.
