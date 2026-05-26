# CLAUDE.md

Guidance for Claude Code in this repo. Project: a personal portfolio for **Rithvik Praveen Kumar** at [rithvik.ai](https://rithvik.ai) — a showcase plus a playground for live inline editing and an AI chatbot.

## Stack

- **Next.js 16** (App Router), React 19, TypeScript, Tailwind v4 (CSS in `app/globals.css`)
- **Supabase** (Postgres + Auth) — `@supabase/ssr` for cookie sessions, `@supabase/supabase-js` for the server admin client. Auth is **passwordless OTP** (email code + magic link); the password column is unused by the UI.
- **Resend** — two distinct paths: (1) custom SMTP for Supabase Auth emails (`auth@rithvik.ai`); (2) the contact composer POSTs directly to the **Resend HTTP API** (`fetch` to `https://api.resend.com/emails`, no SDK) from `contact@rithvik.ai`. Verified domain `rithvik.ai` covers both.
- **Motion** (`motion/react`) for animation
- **cobe** v2 for the WebGL globe in Bento (we drive our own rAF loop — v2 has no `onRender`)
- **LangChain** (`@langchain/openai`) → **OpenAI** `gpt-4o-mini` for chat, HyDE, image captioning; `text-embedding-3-small` for embeddings (`app/api/chat`). DeepSeek was tried and rolled back — see Pitfalls.
- **unpdf** for serverless PDF text extraction (replaced `pdf-parse@2`, which crashed on Vercel — see Pitfalls)
- Deployed on **Vercel**: `dev` → preview, `main` → production

Node 22, npm. `npm run dev` / `build` / `lint`.

## Rules

- Keep design philosophy simple; architecture minimal and clean.
- Each function: a 1–2 sentence description comment. Non-obvious lines: one short inline comment on WHY.
- Develop in **vertical slices** — keep work visible and testable end-to-end.
- Self-test before claiming done. `node_modules/.bin/tsc --noEmit` is the cheapest gate; a Vercel preview check is next.

## CI/CD and branching

Two long-lived branches, both wired to Vercel:

- **`dev`** — every push → preview at `rithvik-<hash>.vercel.app`. All feature work and user review happens here.
- **`main`** — every push → production at rithvik.ai. Only completed, tested work lands here.

### New-feature workflow

1. Work on `dev`. Commit each logical step (`feat:`/`fix:`/`chore:`/`revert:` prefixes per the log). Push to `origin/dev`, let the preview build, iterate until the user is happy.
2. Only when the user explicitly says "merge to main", integrate with a **descriptive `--no-ff` merge commit** (body bullets the bundled feature areas — see `git log` for format):
   ```
   git checkout main && git pull origin main
   git merge --no-ff dev -m "chore: merge dev → main (<bundle title>)"
   git push origin main
   ```
   `--no-ff` is intentional — it preserves a visible "dev landed here" boundary.
3. Never push directly to `main`. Never merge without explicit approval — production is a real domain.
4. Hotfixes are rare; branch off `main`, fix, merge back into BOTH `main` and `dev` so they don't drift.

### Verify before suggesting a merge

- `tsc --noEmit` clean, `eslint <touched files>` clean
- `next build` succeeds (catches Vercel bundling issues that don't show locally)
- Vercel preview on `dev` renders correctly — the **only** way to catch SSR/edge runtime bugs that pass `next build` locally
- DB migrations in `supabase/*.sql` applied to the linked project (`supabase db query --linked -f ...`) BEFORE the merge

## Architecture

### Page composition

`app/page.tsx` is a server component: fetches `site_content` once, passes typed props to client section components. Sections (`Hero`, `Bento`, `Education`, `Projects`, `Experience`, `Contact`) render identically for visitors but adapt to edit mode via `useEditMode()`.

### Server / client section split

Table-backed sections (`Projects`, `Experience`, `Education`) use two files:
- `Component.tsx` — server: fetches rows, renders wrapper + header, passes `initialRows` down.
- `ComponentClient.tsx` — `"use client"`: local state, edit-mode UI (sort/add/delete, `EditableText` per field, `EditableTagList` for tag arrays), and the public view when not editing.

`site_content`-only sections (`Hero`, `Bento`, `Contact`) are single client components taking content as props, swapping to `EditableText` when editing.

### Theme system (`lib/themes.ts`, `components/Theme{Provider,StyleInjector,Dial}.tsx`)

Themes are rows in the `themes` table with a `tokens` JSONB column. **Only the primary palette is per-theme**: `bg, bg-soft, text, muted, accent, accent-glow, green` (+ optional `font`). Surface tokens are **derived in CSS via `color-mix()`** — `--card`/`--card-hover`/`--border`/`--border-hover` mix `--text` into transparent; `--nav-glass`/`--panel-glass` mix `--bg`. So **adding a theme is one DB row** — define 7 tokens, every surface adapts, no CSS changes.

The dial fans out **14 themes**: 3 Rithvik-branded (Dark, Light, Terminal) + 11 editor themes (One Dark Pro, Dracula, GitHub Dark/Light, Tokyo Night, Night Owl, Catppuccin Mocha, SynthWave '84, Ayu Mirage, Atom One Light).

At SSR, `ThemeStyleInjector` emits one `<style id="theme-tokens">` with `:root[data-theme="<slug>"]{…}` for every theme. Active theme is set on `<html data-theme>` by (1) a hardcoded `rithvik-dark` default in JSX, then (2) an inline boot script that reads `localStorage[rithvik-theme]` and overwrites the attribute before first paint (no FOUC).

`ThemeProvider` exposes `useTheme()` → `{ themes, currentSlug, setTheme }`. `setTheme` is an **instant flip**: writes localStorage, swaps `<html data-theme>`, updates `currentSlug`. No page-wide transition animation (see Pitfalls — two were rolled back).

**Root layout is `force-dynamic`** so theme rows inserted directly into Supabase appear on the next load without a redeploy (see Pitfalls).

### Theme transition + first-visit wiggle

The only animation on a theme change is the dial pill rotation; page colors swap instantly. `.theme-strip-option { transition: transform 0.42s cubic-bezier(0.32,0.72,0,1) }` interpolates each pill's `transform` when `selectedIdx` changes.

A one-time dial **wiggle** (in `ThemeDial.tsx` + `.is-wiggling` in `globals.css`) nudges discovery: fires 5s after landing if `localStorage[rithvik-theme-wiggle-shown]` is unset, suppressed the moment `currentSlug` changes, 3 cycles (~1.8s), hover/focus-paused, honors `prefers-reduced-motion`. Pure client-side. (An earlier auto-rotate-to-SynthWave idea was rejected as invasive — see Pitfalls.)

### Bento globe (`components/Globe.tsx`, `BentoGlobeCard.tsx`, `MarkerEditorPanel.tsx`)

The Location tile is an interactive cobe globe. Markers live as a JSON array in `site_content` under `bento.globe_markers` (one chunk, not per-marker), each `{ id, city, region, country, lat, lng, timezone (IANA), kind: "home"|"current"|"default" }`. Seeds: Boston (home, `--accent`), West Lafayette (default, dim accent), San Francisco (current, `--green`).

- **No animation loop** — cobe v2 renders once and exposes `update(opts)`. `Globe.tsx` owns a `requestAnimationFrame` loop pushing `{phi, width, height}` every frame, which also positions the DOM marker overlay. See Pitfalls.
- **Theme reactivity** — reads `--bg`/`--text`/`--accent` via `getComputedStyle`, converts each to a [0,1] RGB triple through an offscreen 1×1 canvas (parses any CSS color incl. `oklch`). On `data-theme` change (MutationObserver) the instance is destroyed and rebuilt (cobe can't live-mutate colors). `dark` flag derives from `--bg` luminance, so new themes need zero JS.
- **Hover/tooltip** — canvas has no DOM hit testing, so per-frame a projection helper maps each marker's (lat,lng)→(x,y) using the same `phi` and fixed `theta: 0.3` and positions an absolutely-placed `<button>`. Back-hemisphere markers (post-rotation z ≥ 0) get `opacity:0` + `pointer-events:none`. Tooltip is driven from the rAF loop (`tooltipRef`) so it tracks rotation live; content is `Intl.DateTimeFormat`-driven (city local time + tz short code).
- **Editing** — `MarkerEditorPanel.tsx` mounts only in edit mode; Save calls `updateGlobeMarkers` (`app/admin/actions.ts`), which validates (lat/lng range, IANA tz via `new Intl.DateTimeFormat` in try/catch, kind enum) then delegates to `upsertSiteContent`. For `bento.globe_markers`, the async `buildSiteContentText` → `buildGlobeMarkersText` joins the `education` table to produce a "he attends Purdue" clause for any default marker whose city matches a school name (case-insensitive substring).

### Hero connect cluster (`components/HeroConnect.tsx`, `ui/animated-beam.tsx`, `SocialIcons.tsx`)

The hero is a two-column grid (`.hero-content`): text left, "connect cluster" right. The cluster is the profile photo (`public/images/rithvik.jpeg`) above three circular social buttons (GitHub/LinkedIn/Email) joined by animated beams pulsing **upward** into the photo.

- `HeroConnect.tsx` owns the refs and renders three `<AnimatedBeam>` sharing `delay`/`duration`/`repeatDelay` (unison pulse). Buttons mirror `contact.link.*` (read-only here — URLs are edited in Contact); Email copies to clipboard.
- `ui/animated-beam.tsx` — vendored MagicUI, `cn` helper stripped, `prefers-reduced-motion` gate added, plus a **`vertical` prop** (upstream only animates horizontal beams — see Pitfalls).
- The cluster entrance animates **opacity + blur only, never `y`** — a translate would leave the ref-measured beams pointing at stale coords.
- Flickering-grid particle color derives from the active theme's `--bg` luminance (`gridColorForBg` in `Hero.tsx`) — see Pitfalls.

### Inline editing (passwordless OTP)

- `EditModeProvider` (client) owns `isEditing`, `panelOpen`, the Supabase session, and the OTP flow.
- **Passwordless login**: enter email → Supabase emails a numeric code AND a magic link (one token, two paths). Enter the code in the panel for same-tab auth, or click the link for a fresh tab.
- **Resend SMTP** sends from `auth@rithvik.ai` (SPF/DKIM/return-path DNS on Vercel); the built-in mailer is bypassed. The Magic Link **email template is customized** to render both `{{ .Token }}` and `{{ .ConfirmationURL }}` — the default omits the token, leaving the code path empty.
- **OTP length** is whatever Supabase generates (default 8 in newer projects); the panel input accepts 6–10 digits.
- **Session policy**: per-tab via `sessionStorage[rithvik-tab-auth]`; closing the tab clears it. The Supabase session itself isn't signed out on "exit edit mode".
- **Allow-list**: `NEXT_PUBLIC_ADMIN_EMAIL` is checked client-side before the Supabase call — instant feedback + avoids burning the OTP rate limit. Belt-and-suspenders on top of `shouldCreateUser: false`.
- **Magic-link landing**: callback redirects to `/?auth=ok`; `EditModeProvider` detects the marker on mount, pre-arms `tabAuth`, flips `isEditing`, strips the param via `history.replaceState` (see Pitfalls — without the marker the new tab stays unauthenticated).
- Components: `InlineLoginPanel` (top-right two-step card), `EditBar` (bottom "Exit editing"), `EditableText` (contentEditable, saves on blur, Esc reverts, Enter blurs unless multiline), `EditableTagList` (chip editor).
- Server actions in `app/admin/actions.ts` (`create/update/deleteProject`, same for Experience, `updateEducation`, `upsertSiteContent`, `updateGlobeMarkers`) all call `requireAuth()` + `revalidatePath("/")`.
- Callback `app/auth/callback/route.ts` exchanges the PKCE code for a session, redirects to `/?auth=ok` or `/?auth_error=…`.

### Inline email composer (`components/ContactComposer.tsx`, `ContactComposerProvider.tsx`, `RichTextEditor.tsx`, `app/api/contact/route.ts`, `lib/sanitize-html.ts`)

Visitors can email Rithvik directly from the site via a draggable, resizable, theme-aware floating window — no mailto, no clipboard copy required.

- **`ContactComposerProvider.tsx`** — context exposing `useContactComposer()` → `{ isOpen, open, close }`. Wraps the page tree in `app/page.tsx`. Both the Hero connect-cluster email button and the Contact-section email button call `open()`.
- **`ContactComposer.tsx`** — the floating window. **Non-modal**: `.composer-overlay` uses `pointer-events:none` so the site stays interactive behind it; only the panel itself captures events. Draggable via the header; resizable from the bottom-right handle; size persisted to `localStorage[contact-composer-size]`. **Lazy useState initializer** computes the initial centered position (not an effect — avoids the `react-hooks/set-state-in-effect` lint rule), so `left/top/width/height` are always present inline and the CSS needs no centering logic. On mobile (≤640px) a media query overrides to a full-screen sheet with `!important`. Esc closes; From field autofocuses. The "To" row shows the destination address with a **copy-address fallback** button (replacing the old clipboard-only email button).
- **`RichTextEditor.tsx`** — contentEditable body editor with a toolbar (bold/italic/underline/strikethrough/bullet list/numbered list/link) via `document.execCommand` — deprecated but dep-free, matching `SimpleMarkdown`'s philosophy.
- **`lib/sanitize-html.ts`** — allowlist HTML sanitizer (`sanitizeEmailHtml`, `htmlToText`). Reconstructs each kept tag from scratch so raw attributes (`onclick`/`style`/`javascript:` hrefs) never survive; drops `<script>`/`<style>` blocks entirely. Allowlist: `b, strong, i, em, u, s, strike, ul, ol, li, p, br, a[safe href]`. Unit-tested via Node's built-in `node:test` (`node --experimental-strip-types --test lib/sanitize-html.test.ts`). Required adding `allowImportingTsExtensions: true` to `tsconfig.json` (valid because `noEmit` is true).
- **`app/api/contact/route.ts`** — POST handler. **Honeypot**: a hidden field filled → fake 200, silently dropped. Validates email/subject/body, **re-sanitizes body server-side** (client sanitization is convenience, server is the gate). **Rate limit**: 3 sends/hour per IP via the `contact_submissions` table (checks recent rows before sending). Sends via the Resend HTTP API (`fetch`) from `CONTACT_FROM` (`contact@rithvik.ai`) to `CONTACT_TO`, with the visitor's address as `reply_to` — visitor address never goes in `from` (SPF/DKIM would reject). The sender display name is HTML-escaped before header interpolation. Logs each successful send to `contact_submissions`.
- **`components/DeferredOverlays.tsx`** — mounts `ContactComposer` once (dynamic, `ssr:false`), deriving `toAddress` from `contact.link.email` in `site_content`.

**Phase 2 polish:**
- **Rainbow shine border** — `.composer-shine` overlay mirrors `.rag-shine`: a 1px masked radial-gradient ring using the existing `@keyframes rag-shine`. The panel surface stays theme-aware; only the ring is a fixed purple/orange gradient. `prefers-reduced-motion` disables the animation.
- **Drag hint** — a three-dot `.composer-grip` in the header with `cursor: grab`/`grabbing` and a "Drag to move" tooltip.
- **Peek-through** — a `.composer-peek` eye button in the header; pure CSS `:has(.composer-peek:hover, :focus-visible)` drops `.composer-panel` to `opacity: 0.12` so the user can glance at content behind while writing. No JS state.
- **Send animation** — `components/SendAnimation.tsx`: a viewport-covering `<canvas>` that dematerializes particles from the message area, morphs them into a paper-airplane silhouette, and flies the formation off-screen (~2.2s rAF loop). Rendered as a **sibling** of `.composer-panel` (not a child) so the panel's `overflow:hidden`/`isolation`/drag-transform can't clip the fly-off. Honors `prefers-reduced-motion` (skips to `onDone` immediately). Success/error is gated on BOTH the animation finishing AND the request settling — two refs + a `finalize()` in `ContactComposer` — so a slow network never flashes success early and a fast network never cuts the animation short.
- **CC sender** — `/api/contact` now includes `cc: [sender]` so the visitor receives a copy and Rithvik can reply-all to thread. `reply_to: sender` is kept alongside it.

**DB:** `contact_submissions` table (id, created_at, ip, from_email, subject, status) — service-role only, RLS enabled with no anon policies. Migration: `supabase/contact_submissions_migration.sql`.

**Env (server-only):** `RESEND_API_KEY`, `CONTACT_FROM`, `CONTACT_TO`.

### RAG bot (`components/RagBot.tsx`, `SimpleMarkdown.tsx`, `SecondaryContextPanel.tsx`, `app/api/chat/route.ts`)

A floating **"Ask RAG"** launcher (bottom-right, mounted in `page.tsx`) — deliberately attention-grabbing (animated gradient text in a halo'd pill) — opens a glass chat panel streaming from `/api/chat`. A second launcher (`SecondaryContextPanel`) appears only in edit mode to manage secondary knowledge.

**Panel UI:**
- **Theme-independent** — launcher/panel/bubbles/chips/input use private `--rag-*` tokens (hardcoded in `.rag-launcher`), so it looks identical on every theme (gradient/shine effects need a fixed dark base).
- **Shine border** (`.rag-shine`, masked radial gradient).
- **Resizable** from the top-left corner: clamped 320×420 → 720×820, persisted to `localStorage[rag-panel-size]`, hydrated via lazy `useState` (SSR-safe — panel only renders post-click).
- **`SimpleMarkdown`** — hand-rolled, dep-free: bold/italic/inline+fenced code, links, headings, bullet/numbered lists, paragraphs with soft `<br>`. The system prompt's FORMATTING section keeps model output sparing so the renderer gets clean input.
- **Starter chips** appear only on the welcome screen with precomputed Q+A pairs (`STARTERS` in `RagBot.tsx`) — clicking is instant, no API call. **Maintenance:** update `STARTERS` if schools/stack/contact change significantly.

> Deep dive: `docs/explanations/rag-pipeline.md`. This is the quick reference.

Two parallel pgvector stores, both **HNSW** (NOT IVFFlat — see Pitfalls):

- `primary_embeddings` — one row per `projects`/`experience`/`education`/`site_content` record, auto-upserted on inline edit, wrapped in `safeEmbed` (save first, embed second; failures don't undo saves). `projects`/`experience`/`education` go through `syncPrimary(...)`, which respects `published` (false → embedding deleted, matching backfill's filter); `site_content` has no `published` and always embeds via `embedPrimary`. `match_primary(query_embedding, match_count)` returns top-N by cosine. Chunk text is **statement-form prose with a Rithvik name anchor** ("Rithvik Praveen Kumar studies at Purdue…"); dotted labels like `[bento.stack]` are mapped to readable phrases so the text carries real meaning.
- `secondary_embeddings` — chunks from files uploaded via `SecondaryContextPanel`, tied to `secondary_documents` (filename/mime/path). PDF → `unpdf`, DOCX → `mammoth`, text → UTF-8, images → `gpt-4o-mini` caption. Per-file chunk cap 200. `match_secondary` mirrors primary.

`app/api/chat/route.ts` per turn:
1. **HyDE** — `generateHypotheticalAnswer` gets a 1–2 sentence statement; question + hypothetical are embedded together so question-form queries retrieve statement-form chunks.
2. **Parallel retrieval** — `Promise.allSettled` over `match_primary` + `match_secondary`, top 10 each; a failed source falls back to `[]`.
3. **Empty-context guard** — if BOTH return zero rows, short-circuit the LLM and stream the canned refusal. Logs `[rag] empty-context guard fired`.
4. **Context block** — `## Recent conversation` (last 5 turns), `## What's on the website` (primary), `## Background materials` (secondary).
5. **Chat completion** — streams from `gpt-4o-mini` (NOT DeepSeek — see Pitfalls). Top-of-prompt CRITICAL GROUNDING RULES forbid inventing facts; recent turns are passed as real `Human`/`AI` messages, used for continuity only.

Secondary originals live in the private `secondary` Storage bucket. RLS denies anon access to all three RAG tables; the chat route + server actions reach them via `adminClient()` (service-role).

Env (`.env.local`, see `.env.local.example`): `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_ADMIN_EMAIL`. `DEEPSEEK_API_KEY` is dead code (kept in the example only). Contact composer adds three server-only vars: `RESEND_API_KEY`, `CONTACT_FROM` (sending address, e.g. `contact@rithvik.ai`), `CONTACT_TO` (Rithvik's inbox).

**One-time setup:** apply `supabase/rag_pipeline_migration.sql`, then enter edit mode → "Re-embed all primary content" in `SecondaryContextPanel`. After that, inline edits keep primary in sync automatically. **Cost** ~$0.0008/turn — well under $1/month at our traffic.

### Supabase browser-client gotcha

`lib/supabase.ts` MUST use `createBrowserClient` from `@supabase/ssr`, NOT `createClient` from `@supabase/supabase-js`. Only the SSR version stores sessions in cookies; the plain client uses localStorage, which server actions can't read, so `requireAuth()` would redirect every save. This was a real bug.

## Database

All in the Supabase public schema:

- `projects`, `experience`, `education` (single-row Purdue today)
- `site_content` — key/value for editable text + structured JSON: `hero.tagline`, `hero.sub_line`, `bento.{building,stack,interests}`, `bento.globe_markers` (JSON array, see globe section), `contact.{headline,sub}`, optional `contact.link.{github,linkedin,email}`. The Growth bento tile is hardcoded in `components/Bento.tsx`, not a row.
- `themes` — `{ slug, name, tokens(JSONB), sort_order, published }`
- `primary_embeddings` — pgvector for live content; auto-upserted on edits; respects `published` (except `site_content`). Service-role only.
- `secondary_documents` — uploaded-file metadata.
- `secondary_embeddings` — pgvector for secondary chunks; FK to `secondary_documents` `on delete cascade`.
- `contact_submissions` — rate-limit window + contact log for the inline email composer (id, created_at, ip, from_email, subject, status). Service-role only; RLS enabled with no anon policies.

RLS: content tables are `SELECT`-public, writes via service-role in server actions only; the three RAG tables are service-role for read+write.

### Migrations (apply via `supabase db query --linked -f supabase/<file>.sql`)

- `stage3_migration.sql` — education table + site_content seed
- `themes_migration.sql` — themes table + Dark/Light/Terminal (idempotent)
- `themes_add_terminal.sql` — UPSERT just the Terminal row
- `themes_add_editor_themes.sql` — the 11 editor themes (idempotent, sort 10–31)
- `rag_pipeline_migration.sql` — pgvector + the 3 RAG tables + **HNSW** indexes + `match_primary`/`match_secondary` RPCs + RLS + Storage bucket. Apply once. (An earlier IVFFlat version under-retrieved — see Pitfalls.)
- `globe_markers_seed.sql` — UPSERT the 3 seed markers
- `resume_seed.sql` — idempotent sync of `projects` + `experience` with the canonical resume
- `contact_submissions_migration.sql` — contact composer rate-limit/log table (`contact_submissions`), service-role RLS

The linked project is **`Rithvik`** (not `rithvikpkx's Project` or `Grind-Catapult26` — three under the same org).

## File layout cheat sheet

```
app/
  layout.tsx          — force-dynamic root: themes fetch, ThemeStyleInjector + FOUC script + ThemeProvider + (EditModeProvider wrapping children + InlineLoginPanel + EditBar) + ThemeDial
  page.tsx            — fetches site_content + parses globe markers; renders sections + RagBot + SecondaryContextPanel
  globals.css         — tokens, dial, bento (globe/markers/growth), rag chat (theme-independent), OTP login
  icon.tsx / apple-icon.tsx / opengraph-image.tsx — dynamic favicon / iOS icon / OG image
  admin/actions.ts    — server actions for all tables (incl. updateGlobeMarkers)
  admin/rag-actions.ts— backfillPrimaryEmbeddings, list/upload/delete secondary docs
  admin/auth-helper.ts— shared requireAuth
  api/chat/route.ts   — HyDE → match_primary + match_secondary → gpt-4o-mini stream
  api/contact/route.ts — honeypot + validation + rate-limit + Resend HTTP API send
  auth/callback/route.ts — exchanges PKCE code, redirects to /?auth=ok or /?auth_error=…

components/
  Nav, Footer, Hero, Bento, Education(+Client), Projects(+Client), Experience(+Client), Contact
  EditModeProvider, InlineLoginPanel, EditBar, EditableText, EditableTagList
  ThemeProvider, ThemeStyleInjector, ThemeDial
  FadeIn, KineticText, FlickeringGrid, TimelineBeam, LocalTime, EduLogo
  Globe                 — cobe canvas + rAF loop + DOM marker projection + tooltip
  BentoGlobeCard        — mounts Globe + (edit mode) MarkerEditorPanel
  MarkerEditorPanel     — edit-mode marker add/edit/delete
  RagBot                — chat launcher + streaming panel (resizable, markdown)
  SimpleMarkdown        — hand-rolled markdown renderer
  SecondaryContextPanel — edit-mode: secondary docs + backfill
  HeroConnect           — photo + 3 social buttons + beams
  SocialIcons           — shared GitHub/LinkedIn/Email SVGs
  ContactComposer       — draggable/resizable floating email window (non-modal, lazy-init centering, shine/peek/drag-hint)
  ContactComposerProvider — context: isOpen/open/close for the composer
  RichTextEditor        — contentEditable + execCommand toolbar (bold/italic/underline/etc.)
  SendAnimation         — viewport canvas: particle dematerialise → paper-airplane fly-off (~2.2s); sibling of composer panel
  DeferredOverlays      — mounts ContactComposer once (dynamic, ssr:false)
  ui/animated-beam      — vendored MagicUI (cn stripped, reduced-motion + vertical added)

lib/
  supabase.ts         — clients (browser = createBrowserClient)
  themes.ts           — token list, fallbacks, buildThemeStyleSheet
  types.ts            — Project, Experience, Education, SiteContent, Theme, Database
  embeddings.ts       — embed wrapper, chunker, row→text builders, upsert helpers
  file-extractors.ts  — PDF/DOCX/TXT/MD readers + image captioner
  sanitize-html.ts    — allowlist HTML sanitizer + htmlToText (unit-tested via node:test)

docs/plans/*          — all done: phase1 design/dev, inline-editing, theme, rag-pipeline, bento-globe, passwordless-otp
docs/explanations/rag-pipeline.md — RAG deep dive
```

## Pitfalls learned the hard way

### Theme / UI

- **No page-wide transition on theme swap.** Two approaches were rolled back: (a) `startViewTransition` freezes the DOM so pill rotation can't play, and per-element `view-transition-name` escapes the dial's `overflow:hidden` clip while interpolating bounding boxes not transforms; (b) a glass-wash overlay read as visually busy. Instant flip + live pill rotation is the chosen design.
- **`setPointerCapture` on `pointerdown` breaks button clicks** (redirects the click target). Only capture once a drag is confirmed past a threshold.
- **React's `onWheel` is passive** — `preventDefault()` no-ops. Attach via `addEventListener("wheel", h, { passive: false })` in a `useEffect` for dial cycling.
- **Auto-rotating the dial on first visit was rejected as invasive** — visitors hadn't asked for a color change. The subtle one-time wiggle replaced it. Discoverability nudges should affect the affordance, not the underlying state.
- **An edit-mode-only component mounted outside `<EditModeProvider>` 500s the whole route** — `useEditMode()` throws with no provider, crashing SSR for every visitor. Mount such components INSIDE the provider (it wraps `{children}`, not the dial siblings).
- **`force-dynamic` on the root layout is required** when content can change via direct DB writes (themes via raw SQL/dashboard). Without it the homepage is static and stale until the next deploy; server actions revalidate via `revalidatePath("/")` but raw writes don't.
- **cobe v2 has no `onRender`.** Many online snippets are v1, which drove its own rAF. v2 renders once on construction and exposes only `update(opts)`; all motion must come from a caller-owned rAF loop. Don't `as any` to fake `onRender` — it compiles but the globe freezes.
- **MagicUI `AnimatedBeam` only animates horizontal beams** — upstream sweeps the gradient along X. Vertical beams need the local `vertical` prop (sweeps Y). Trail length = the `y1`–`y2` gap; sweep speed = `duration`.
- **`KineticText` must use `block` flow, not `flex flex-wrap`.** With flex, `flex-wrap` breaks between any two letter-spans, splitting words mid-word. `block` only breaks on whitespace (and its space is non-breaking).
- **`radial-gradient(circle, …)` in a non-square box clips** to a hard edge (`circle` sizes to farthest-corner). The hero glow blobs use `ellipse closest-side` so they always fade to transparent inside the box.
- **Theme-dependent UI must derive from tokens, not slug checks.** The flickering grid once keyed on `currentSlug === "rithvik-light"`, so other light themes got invisible white particles. `gridColorForBg` now computes contrast from `tokens.bg` luminance — new light themes need zero code.
- **A fixed-position overlay rendered inside an element with `overflow:hidden` + a `transform`/`will-change` ancestor gets clipped** — the ancestor creates a new containing block, trapping the overlay. Render viewport-covering layers (e.g. `SendAnimation`) as siblings of the clipping element, not children.

### RAG (each cost real debugging time)

- **IVFFlat with `lists` ≫ rows silently returns 0–1 chunks.** The migration shipped `lists = 100` for ~17 rows; with `probes = 1` each near-empty cluster returned only the seed. Symptom: empty context, then wild hallucination. **Use HNSW** — no row-count-dependent tuning.
- **`pdf-parse@2.x` crashes on Vercel** with `ReferenceError: DOMMatrix is not defined` at module eval (its `pdfjs-dist` references the browser-only global; local Node has it, Vercel doesn't). **Use `unpdf`.** `pdf-parse` MUST NOT be in `package.json`.
- **Cost-optimized LLMs treat "don't fabricate" as a suggestion.** DeepSeek invented wrong university/handle/projects despite explicit refusal wording. `gpt-4o-mini` follows the rule reliably for ~5x cost (still pennies). Don't trade instruction adherence for cost on a cheap workload.
- **Embedding similarity ≠ search.** "where did rithvik study?" doesn't embed near `Education: B.S. …`. Two layered fixes, both required: (1) chunk text as natural prose with the name visible; (2) **HyDE** — generate a statement-form hypothetical, concat + embed with the question.
- **Decouple "RPC succeeded" from "RPC returned data."** The `unpack(label, res)` helper handles both thrown rejections and in-band `{data:null,error}`, logging `[rag] … rpc error:`. Even a successful RPC can return `[]` — the empty-context guard short-circuits the LLM so it refuses instead of hallucinating.
- **Use `Promise.allSettled`, not `Promise.all`** — one failed retrieval would 500 the whole request; allSettled lets the bot answer from the surviving source.
- **`safeEmbed` swallows embedding errors** on inline edits (`console.warn`, not error) so an OpenAI hiccup never undoes a save; worst case RAG sees a stale row until the next edit or a backfill.
- **Vercel bundles each route separately.** During the `pdf-parse` crash, `/api/chat` kept working (doesn't import `file-extractors.ts`); only the server-actions bundle was broken. "Chat is alive" ≠ "all server actions work."
- **`buildSiteContentText` is async** (it joins `education` for the globe-markers branch). Both callers — `upsertSiteContent` and the site_content backfill loop — await it. Forgetting `await` puts `[object Promise]` in the embedding, silently degrading retrieval without breaking the build.

### Auth (passwordless OTP)

- **Magic-link tab needs the `?auth=ok` marker.** The callback writes cookies server-side, so the in-tab SDK fires `INITIAL_SESSION` (not `SIGNED_IN`), which the per-tab policy filters out — leaving the tab unauthenticated despite valid cookies. `?auth=ok` is the signal `EditModeProvider` uses to pre-arm the tab flag. Preserve it if you change the callback redirect.
- **PKCE magic links require the same browser session** — `signInWithOtp` stores a `code_verifier` cookie that `exchangeCodeForSession` needs. A link clicked on a different device fails ("auth code and code verifier should be non-empty"); the numeric code path (`verifyOtp`) is the cross-device fallback.
- **Supabase rejects redirects not on the allow-list.** Preview URLs change per deploy — use a wildcard `https://rithvik-*.vercel.app/auth/callback` in Auth → URL Configuration.
- **`shouldCreateUser: false` is mandatory** — otherwise any typed email creates an `auth.users` row. With it, unknown emails 422; the client allow-list catches them before the network call (saves the 4/hr rate limit).
- **The default Magic Link email template omits `{{ .Token }}`** — the code path then has no code. Keep the customized template that renders both token and link.
- **OTP length is per-project configurable** (default 8 now, was 6). The panel accepts 6–10; don't hard-code one length.
- **Resend SMTP** sends from `auth@rithvik.ai`; the built-in mailer is bypassed. If deliverability degrades: Resend logs → DNS health (`dig TXT resend._domainkey.rithvik.ai`) → Supabase SMTP test ping.
- **OTP rate limit is per-email, not per-tab** — 4 sends/hour share one bucket; the 5th throws "Email rate limit exceeded." Wait 15 min or reuse an earlier code.
- **Resend can only send FROM a verified `rithvik.ai` address** — the visitor's email goes in `reply_to`, never `from` (SPF/DKIM would reject otherwise). The contact composer uses the Resend HTTP API via `fetch` (no SDK, no nodemailer); this path is entirely separate from the Supabase Auth SMTP path.

## Where to look first when something breaks

- **Theme not switching** → console for `ThemeProvider` errors; check `localStorage[rithvik-theme]`; force `document.documentElement.dataset.theme` in devtools to isolate CSS.
- **Edit-mode save redirects to `/admin/login`** → browser client isn't `createBrowserClient` (cookie mismatch).
- **Dial rotation doesn't animate** → `.theme-strip-option` lost its `transition: transform …`, or pills regained a `view-transition-name`.
- **Theme missing from the dial** → reapply the relevant themes migration; verify `SELECT slug,name,sort_order FROM themes`. Layout is `force-dynamic` so DB rows should appear immediately; a pre-`force-dynamic` preview would need a redeploy.
- **RAG hallucinating wildly** → guard didn't fire but the right chunk is missing/low-ranked. Manually embed the question and query `match_primary` with `match_count=17`; if buried at rank 8+, check Vercel logs for `[rag] hyde failed`. Recovery: re-embed primary.
- **RAG returns the canned refusal** for known facts → `[rag] empty-context guard fired` in logs means BOTH retrievals hit 0 rows. Verify the index is HNSW: `SELECT indexdef FROM pg_indexes WHERE tablename='primary_embeddings';`.
- **RAG 500 "Embedding failed"** → `OPENAI_API_KEY` missing/exhausted (embeddings, HyDE, captioning, AND chat all use OpenAI / `gpt-4o-mini`).
- **RAG stale after edits** → check Vercel logs for `[rag] … embed skipped:`. Recovery: edit mode → SecondaryContextPanel → "Re-embed all primary content".
- **PDF upload crashes the server bundle on Vercel** → `pdf-parse` crept back in (DOMMatrix at module eval). Must use `unpdf`; `pdf-parse` MUST NOT be in `package.json`.
- **Secondary upload "MIME … not supported"** → add the type to `TEXT_MIMES`/`IMAGE_MIMES` or add an extractor branch in `lib/file-extractors.ts`.
- **Secondary upload "File produces N chunks (cap is 200)"** → split the file.
- **`match_primary`/`match_secondary` not found** → `rag_pipeline_migration.sql` wasn't applied (or to the wrong project). Re-apply (idempotent).
- **Secondary panel missing** → it self-gates on `useEditMode().isEditing`; log in first.
- **`[rag] match_secondary rpc error:`** → table/RPC missing; reapply migration (chat degrades gracefully to the working source).
- **`[rag] hyde failed`** → OpenAI 429/401; retrieval falls back to the raw question (lower quality on question-form queries).
- **OTP email never arrives** → Resend logs first (delivered? → spam/DNS); if Resend shows nothing, Supabase didn't hand off → check SMTP settings/key/test ping; a 422 in auth logs means the email isn't in `auth.users` or `shouldCreateUser:false` rejected it.
- **Magic link → Supabase error page** instead of `/auth/callback` → redirect URL not allow-listed; add it (or a wildcard), then re-request (links bake in the redirect at send time).
- **Magic link clicks but the new tab doesn't enter edit mode** → `?auth=ok` was stripped early or the callback didn't reach success. Check `/auth/callback` logs; usually about preserving the marker.
- **OTP code rejected right after typing** → length mismatch; confirm Supabase OTP length is 6–10 (widen `InlineLoginPanel.tsx` if >10).
- **"Email rate limit exceeded"** → the 4/hr/email cap; wait 15 min or reuse an unexpired code.
- **`requireAuth()` redirects after a working OTP** → cookie-scope mismatch; reconfirm `lib/supabase.ts` uses `createBrowserClient`.
