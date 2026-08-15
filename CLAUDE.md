# CLAUDE.md

Guidance for Claude Code in this repo. Project: a personal portfolio for **Rithvik Praveen Kumar** at [rithvik.ai](https://rithvik.ai) — a showcase plus a playground for live inline editing and an AI chatbot.

## Stack

- **Next.js 16** (App Router), React 19, TypeScript, Tailwind v4 (CSS in `app/globals.css`)
- **Supabase** (Postgres + Auth) — `@supabase/ssr` for cookie sessions, `@supabase/supabase-js` for the server admin client. Auth is **passwordless OTP** (email code + magic link); the password column is unused by the UI.
- **Resend** — two distinct paths: (1) custom SMTP for Supabase Auth emails (`auth@rithvik.ai`); (2) the contact composer POSTs directly to the **Resend HTTP API** (`fetch` to `https://api.resend.com/emails`, no SDK) from `contact@rithvik.ai`. Verified domain `rithvik.ai` covers both.
- **Motion** (`motion/react`) for animation
- **cobe** v2 for the WebGL globe in Bento (we drive our own rAF loop — v2 has no `onRender`)
- **LangChain** (`@langchain/openai`) → **OpenAI** `gpt-4o-mini` for chat, HyDE, image captioning; `text-embedding-3-small` for embeddings (`app/api/chat`). DeepSeek was tried and rolled back (it ignored grounding rules; `gpt-4o-mini` follows them reliably).
- **unpdf** for serverless PDF text extraction (replaced `pdf-parse@2`, which crashed on Vercel with `DOMMatrix is not defined`; `pdf-parse` must stay out of `package.json`)
- Deployed on **Vercel**: `dev` → preview, `main` → production
- **Performance** (`next.config.ts` + `docs/plans/performance-improvement.md`): homepage uses **ISR** (`export const revalidate = 60` in `app/(site)/layout.tsx` and `app/(site)/page.tsx`), NOT `force-dynamic` (which cost ~5 uncached Supabase round-trips per visit); `next/image` with AVIF/WebP formats for the hero photo; `optimizePackageImports: ["motion"]` to tree-shake the motion barrel; the globe rAF and the RAG/composer overlays are deferred/paused (see their sections).

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

The app uses **two Next.js root layouts via route groups**: `app/(site)/` holds the themed portfolio, and `app/(plain)/` holds a deliberately bare layout for the `/buffett` easter-egg page (see Buffett mode). There is **no** top-level `app/layout.tsx` — crossing between the groups is a full document load.

`app/(site)/page.tsx` is a server component: fetches `site_content` once, passes typed props to client section components. Sections (`Hero`, `Bento`, `Education`, `Projects`, `Experience`, `Contact`) render identically for visitors but adapt to edit mode via `useEditMode()`.

### Buffett mode (`/buffett`)

A bare-HTML homage to berkshirehathaway.com, reached via the **For Warren Buffett** link near the theme dial (`components/BuffettLink.tsx`, with a hover tooltip). It lives in its own root layout `app/(plain)/layout.tsx` (own `<html>`/`<body>`, all styling inline, no providers/theme/JS). `app/(plain)/buffett/page.tsx` is a server component that pulls the **same** Supabase data as the homepage and renders it as plain semantic HTML, mirroring the homepage's published-visibility (Education filtered by `published`; Projects/Experience not). Internal `/` links use plain `<a>` for a full nav across the layout boundary — the page disables `@next/next/no-html-link-for-pages` file-wide for that reason (a line-level directive kept getting detached by editor auto-formatting).

### Server / client section split

Table-backed sections (`Projects`, `Experience`, `Education`) use two files:
- `Component.tsx` — server: fetches rows, renders wrapper + header, passes `initialRows` down.
- `ComponentClient.tsx` — `"use client"`: local state, edit-mode UI (sort/add/delete, `EditableText` per field, `EditableTagList` for tag arrays), and the public view when not editing.

`site_content`-only sections (`Hero`, `Bento`, `Contact`) are single client components taking content as props, swapping to `EditableText` when editing.

Project/Experience descriptions are stored **one bullet per line** (newline-separated, no dash prefix) and rendered by `components/DescriptionBlock.tsx` — a list when multi-line, a plain `<p>` for a single line (bullet marker is CSS, `.desc-bullets` in `globals.css`). `supabase/bulletize_descriptions.sql` is the migration that converted the old prose blurbs.

### Theme system (`lib/themes.ts`, `components/Theme{Provider,StyleInjector,Dial}.tsx`)

Themes are rows in the `themes` table with a `tokens` JSONB column. **Only the primary palette is per-theme**: `bg, bg-soft, text, muted, accent, accent-glow, green` (+ optional `font`). Surface tokens are **derived in CSS via `color-mix()`** — `--card`/`--card-hover`/`--border`/`--border-hover` mix `--text` into transparent; `--nav-glass`/`--panel-glass` mix `--bg`. So **adding a theme is one DB row** — define 7 tokens, every surface adapts, no CSS changes.

The dial fans out the `themes` rows ordered by `sort_order`, **all light themes first, then dark** (`sort_order` 0–4 light, 10–22 dark). Current set: light — GitHub Light (the default), Rithvik Light, High Contrast Light; dark — Rithvik Dark, Rithvik Terminal, One Dark Pro, Dracula, GitHub Dark, Tokyo Night, Night Owl, Catppuccin Mocha, SynthWave '84, Ayu Mirage, Monokai Pro (Filter Octagon), High Contrast Dark, Tokyo Night Horizon. (Monokai Pro Light and Atom One Light were removed.)

At SSR, `ThemeStyleInjector` emits one `<style id="theme-tokens">` with `:root[data-theme="<slug>"]{…}` for every theme. Active theme is set on `<html data-theme>` by (1) a hardcoded `github-light` default in JSX (`DEFAULT_THEME_SLUG` in `lib/themes.ts`), then (2) an inline boot script that reads `localStorage[rithvik-theme]` and overwrites the attribute before first paint (no FOUC).

`ThemeProvider` exposes `useTheme()` → `{ themes, currentSlug, setTheme }`. `setTheme` is an **instant flip**: writes localStorage, swaps `<html data-theme>`, updates `currentSlug`. No page-wide transition animation (two approaches — `startViewTransition` and a glass-wash overlay — were rolled back).

**The homepage uses ISR (`export const revalidate = 60`)**, not `force-dynamic`. Inline edits call `revalidatePath("/")` so editor changes appear instantly; theme rows inserted directly into Supabase (raw SQL/dashboard) appear within 60s without a redeploy.

### Theme transition + first-visit wiggle

The only animation on a theme change is the dial pill rotation; page colors swap instantly. `.theme-strip-option { transition: transform 0.42s cubic-bezier(0.32,0.72,0,1) }` interpolates each pill's `transform` when `selectedIdx` changes.

A one-time dial **wiggle** (in `ThemeDial.tsx` + `.is-wiggling` in `globals.css`) nudges discovery: fires 5s after landing if `localStorage[rithvik-theme-wiggle-shown]` is unset, suppressed the moment `currentSlug` changes, 3 cycles (~1.8s), hover/focus-paused, honors `prefers-reduced-motion`. Pure client-side. (An earlier auto-rotate-to-SynthWave idea was rejected as invasive.)

### Bento globe (`components/Globe.tsx`, `BentoGlobeCard.tsx`, `MarkerEditorPanel.tsx`)

The Location tile is an interactive cobe globe. Markers live as a JSON array in `site_content` under `bento.globe_markers` (one chunk, not per-marker), each `{ id, city, region, country, lat, lng, timezone (IANA), kind: "home"|"current"|"default" }`. Seeds: Boston (home, `--accent`), West Lafayette (default, dim accent), San Francisco (current, `--green`).

- **No animation loop** — cobe v2 renders once and exposes `update(opts)`. `Globe.tsx` owns a `requestAnimationFrame` loop pushing `{phi, width, height}` every frame, which also positions the DOM marker overlay (cobe v2 has no `onRender` — all motion must come from a caller-owned rAF). The loop **pauses when the globe scrolls off-screen (`IntersectionObserver`) or the tab is hidden (`visibilitychange`)** so it doesn't burn CPU/GPU below the fold (a perf-plan change).
- **Theme reactivity** — reads `--bg`/`--text`/`--accent` via `getComputedStyle`, converts each to a [0,1] RGB triple through an offscreen 1×1 canvas (parses any CSS color incl. `oklch`). On `data-theme` change (MutationObserver) the instance is destroyed and rebuilt (cobe can't live-mutate colors). `dark` flag derives from `--bg` luminance, so new themes need zero JS.
- **Hover/tooltip** — canvas has no DOM hit testing, so per-frame a projection helper maps each marker's (lat,lng)→(x,y) using the same `phi` and fixed `theta: 0.3` and positions an absolutely-placed `<button>`. Back-hemisphere markers (post-rotation z ≥ 0) get `opacity:0` + `pointer-events:none`. Tooltip is driven from the rAF loop (`tooltipRef`) so it tracks rotation live; content is `Intl.DateTimeFormat`-driven (city local time + tz short code).
- **Editing** — `MarkerEditorPanel.tsx` mounts only in edit mode; Save calls `updateGlobeMarkers` (`app/admin/actions.ts`), which validates (lat/lng range, IANA tz via `new Intl.DateTimeFormat` in try/catch, kind enum) then delegates to `upsertSiteContent`. For `bento.globe_markers`, the async `buildSiteContentText` → `buildGlobeMarkersText` joins the `education` table to produce a "he attends Purdue" clause for any default marker whose city matches a school name (case-insensitive substring).

### Hero connect cluster (`components/HeroConnect.tsx`, `ui/animated-beam.tsx`, `SocialIcons.tsx`)

The hero is a two-column grid (`.hero-content`): text left, "connect cluster" right. The cluster is the profile photo (`public/images/rithvik.jpeg`, served via `next/image` with `fill`/`priority`) above three circular social buttons (GitHub/LinkedIn/Email) joined by animated beams pulsing **upward** into the photo.

- `HeroConnect.tsx` owns the refs and renders three `<AnimatedBeam>` sharing `delay`/`duration`/`repeatDelay` (unison pulse). Buttons mirror `contact.link.*` (read-only here — URLs are edited in Contact); Email copies to clipboard.
- `ui/animated-beam.tsx` — vendored MagicUI, `cn` helper stripped, `prefers-reduced-motion` gate added, plus a **`vertical` prop** (upstream only animates horizontal beams).
- The cluster entrance animates **opacity + blur only, never `y`** — a translate would leave the ref-measured beams pointing at stale coords.
- Flickering-grid particle color derives from the active theme's `--bg` luminance (`gridColorForBg` in `Hero.tsx`), not a slug check, so new light themes need zero code.

### Inline editing (passwordless OTP)

- `EditModeProvider` (client) owns `isEditing`, `panelOpen`, the Supabase session, and the OTP flow.
- **Passwordless login**: enter email → Supabase emails a numeric code AND a magic link (one token, two paths). Enter the code in the panel for same-tab auth, or click the link for a fresh tab.
- **Resend SMTP** sends from `auth@rithvik.ai` (SPF/DKIM/return-path DNS on Vercel); the built-in mailer is bypassed. The Magic Link **email template is customized** to render both `{{ .Token }}` and `{{ .ConfirmationURL }}` — the default omits the token, leaving the code path empty.
- **OTP length** is whatever Supabase generates (default 8 in newer projects); the panel input accepts 6–10 digits.
- **Session policy**: per-tab via `sessionStorage[rithvik-tab-auth]`; closing the tab clears it. The Supabase session itself isn't signed out on "exit edit mode".
- **Allow-list**: two layers. `NEXT_PUBLIC_ADMIN_EMAIL` is checked client-side before the Supabase call — instant feedback + avoids burning the OTP rate limit. The one that actually enforces anything is `requireAuth()`, which compares the session email against server-only `ADMIN_EMAIL` (falling back to the `NEXT_PUBLIC_` one) and **fails closed if neither is set**. A Supabase session only proves *someone* signed in to the project, not that Rithvik did — never treat "has a session" as "is admin".
- **Magic-link landing**: callback redirects to `/?auth=ok`; `EditModeProvider` detects the marker on mount, pre-arms `tabAuth`, flips `isEditing`, strips the param via `history.replaceState` (without the marker the in-tab SDK fires `INITIAL_SESSION`, which the per-tab policy filters out, leaving the new tab unauthenticated).
- Components: `InlineLoginPanel` (top-right two-step card), `EditBar` (bottom "Exit editing"), `EditableText` (contentEditable, saves on blur, Esc reverts, Enter blurs unless multiline), `EditableTagList` (chip editor).
- Server actions in `app/admin/actions.ts` (`create/update/deleteProject`, same for Experience, `updateEducation`, `upsertSiteContent`, `updateGlobeMarkers`) all call `requireAuth()` + `revalidatePath("/")`.
- Callback `app/auth/callback/route.ts` exchanges the PKCE code for a session, redirects to `/?auth=ok` or `/?auth_error=…`.

### Inline email composer (`components/ContactComposer.tsx`, `ContactComposerProvider.tsx`, `RichTextEditor.tsx`, `app/api/contact/route.ts`, `lib/sanitize-html.ts`)

Visitors can email Rithvik directly from the site via a draggable, resizable, theme-aware floating window — no mailto, no clipboard copy required.

- **`ContactComposerProvider.tsx`** — context exposing `useContactComposer()` → `{ isOpen, open, close }`. Wraps the page tree in `app/(site)/page.tsx`. Both the Hero connect-cluster email button and the Contact-section email button call `open()`.
- **`ContactComposer.tsx`** — the floating window. **Non-modal**: `.composer-overlay` is `pointer-events:none` so the site stays interactive; only the panel captures events. Draggable via header; resizable from bottom-right; size persisted to `localStorage[contact-composer-size]`. **Lazy useState initializer** computes the centered start position (not an effect — avoids `react-hooks/set-state-in-effect`), so `left/top/width/height` are always inline. Mobile (≤640px) overrides to a full-screen sheet with `!important`. Esc closes; From autofocuses; the "To" row has a **copy-address fallback** button.
- **`RichTextEditor.tsx`** — contentEditable body editor with a toolbar (bold/italic/underline/strikethrough/bullet list/numbered list/link) via `document.execCommand` — deprecated but dep-free, matching `SimpleMarkdown`'s philosophy.
- **`lib/sanitize-html.ts`** — allowlist sanitizer (`sanitizeEmailHtml`, `htmlToText`). Reconstructs each kept tag from scratch so raw attributes (`onclick`/`style`/`javascript:`) never survive; drops `<script>`/`<style>` entirely. Allowlist: `b, strong, i, em, u, s, strike, ul, ol, li, p, br, a[safe href]`. Unit-tested via `node:test` (`node --experimental-strip-types --test lib/sanitize-html.test.ts`), which needed `allowImportingTsExtensions: true` in `tsconfig.json` (valid under `noEmit`).
- **`app/api/contact/route.ts`** — POST handler. **Honeypot**: hidden field filled → fake 200, dropped. Validates email/subject/body, **re-sanitizes body server-side** (server is the gate). **Rate limit**: 3 sends/hr/IP via `contact_submissions`. Sends via Resend HTTP API (`fetch`) from `CONTACT_FROM` to `CONTACT_TO`, visitor address in `reply_to` only (never `from` — SPF/DKIM). Sender display name HTML-escaped before header interpolation. Logs each send.
- **`components/DeferredOverlays.tsx`** — mounts `RagBot`, `SecondaryContextPanel`, `ContactComposer`, all `dynamic(..., { ssr:false })`, split out of the initial bundle. Derives composer `toAddress` from `contact.link.email`.

**Phase 2 polish:**
- **Rainbow shine border** — `.composer-shine` mirrors `.rag-shine`: a 1px masked radial-gradient ring (`@keyframes rag-shine`); panel surface stays theme-aware, ring is fixed purple/orange. `prefers-reduced-motion` disables it.
- **Drag hint** — three-dot `.composer-grip` in the header, `cursor: grab`/`grabbing` + "Drag to move" tooltip.
- **Peek-through** — `.composer-peek` eye button; pure CSS `:has(...:hover, :focus-visible)` drops the panel to `opacity: 0.12` to glance behind. No JS.
- **Send animation** — `components/SendAnimation.tsx`: viewport `<canvas>` dematerializing particles into a paper-airplane fly-off (~2.2s rAF). Rendered as a **sibling** of `.composer-panel` so `overflow:hidden`/`isolation`/drag-transform can't clip it. Honors `prefers-reduced-motion`. Success/error gated on BOTH animation finishing AND request settling (two refs + `finalize()`) so neither a slow nor fast network desyncs.
- **No CC to sender** — `/api/contact` sets `reply_to: sender` only. It used to `cc: [sender]`, but `from` is unverified visitor input, so cc'ing it made the route a small open relay: anyone could have rithvik.ai deliver arbitrary (sanitized) HTML to an address of their choosing, on the same domain that sends auth mail. Don't reinstate the CC without verifying the address first.

**DB:** `contact_submissions` table (id, created_at, ip, from_email, subject, status) — service-role only, RLS enabled with no anon policies. Migration: `supabase/contact_submissions_migration.sql`.

**Env (server-only):** `RESEND_API_KEY`, `CONTACT_FROM`, `CONTACT_TO`.

### RAG bot (`components/RagBot.tsx`, `SimpleMarkdown.tsx`, `SecondaryContextPanel.tsx`, `app/api/chat/route.ts`)

Floating **"Ask RAG"** launcher (bottom-right, lazy via `DeferredOverlays`) opens a glass panel streaming from `/api/chat`. `SecondaryContextPanel` is a second launcher, edit-mode only.

> Deep dives: `docs/explanations/rag-pipeline.md` (retrieval), `docs/plans/feat-agentic-actions.md` (actions + the calibration data behind the thresholds). This is the quick reference.

**Panel UI**
- **Theme-independent**: private `--rag-*` tokens on `.rag-launcher` — the gradient/shine effects need a fixed dark base, so it looks identical on every site theme.
- Resizable from the top-left, clamped 320×420 → 720×820, persisted to `localStorage[rag-panel-size]` via lazy `useState`.
- `SimpleMarkdown` is hand-rolled and dep-free, and returns **React elements, never `dangerouslySetInnerHTML`** — so model output can't inject HTML.
- **Three control types, styled differently because they behave differently:**

| Control | Behaviour |
|---|---|
| Starter chips (`.rag-chip`, welcome screen only) | **Send instantly** — precomputed Q+A in `STARTERS`, no API call. Update if schools/stack/contact drift. |
| Suggestion chips (`.rag-suggest-chip`, dashed) | **Fill the input, never send.** Picking one swaps: the displaced suggestion returns to the row. |
| Action buttons (`.rag-action`, solid) | **Do something** — open a link, scroll+highlight, open the composer. |

  Identical-looking controls with opposite behaviour would be a trap; keep them distinct.
- **Ghost text is the input's native `placeholder`**, not an overlay — it only ever shows while the field is empty, which removes all font-metric and scroll-sync fragility. Tab or → accepts, Esc dismisses. ≤640px has no Tab key, so everything renders as chips.
- **Transcript export** — header buttons copy or download `rag-chat-<stamp>.md` including each turn's suggestions (`lib/transcript.ts`, pure + tested). Suggestions are stored per-message so every round is captured.

**Bot actions** (`lib/chat-actions.ts`, `lib/action-links.ts`) — max 2 per turn, always a button, never automatic.
- **Derived deterministically from retrieval metadata: no model, no extra LLM call.** `match_primary` returns `source_table`/`metadata`/`similarity`; `source_table` → anchor, `metadata.slug` → DB row.
- **The model never supplies a URL.** Actions name a record; `action-links.ts` resolves it from published rows and `safeUrl()` permits only `http(s)`; scroll targets must match `/^[a-zA-Z0-9_-]+$/`. A model-authored link behind a button is a phishing vector, and secondary documents are a prompt-injection surface.
- **Gate on a SEPARATE bare-question retrieval, never the HyDE embedding.** HyDE writes a Rithvik-flavoured hypothetical for *any* input, so off-topic questions land inside the corpus — "who won the world cup?" scores 0.732 with HyDE, 0.099 without. `ACTION_SIMILARITY_FLOOR` applies to the bare-question score; the HyDE chunks still choose *what* to point at, so the button matches what the answer discussed. Also suppressed behind a refusal (`isDeclineAnswer`).
- Scroll targets: `#about`, `#bento`, `#education`, `#experience-<slug>`, `#project-<slug>`. A new section needs an `id` **and** a mapping in `deriveActions`.

**Two pgvector stores**, both **HNSW** (NOT IVFFlat — it under-retrieved with `lists` ≫ rows):
- `primary_embeddings` — one row per `projects`/`experience`/`education`/`site_content` record, auto-upserted on inline edit inside `safeEmbed` (save first, embed second). `syncPrimary` respects `published`; `site_content` has no such column and always embeds. Chunk text is statement-form prose with a name anchor ("Rithvik Praveen Kumar studies at Purdue…"); dotted keys map to readable phrases.
- `secondary_embeddings` — uploaded files (PDF `unpdf`, DOCX `mammoth`, text UTF-8, images captioned). Per-file cap 200 chunks. **The only place `chunkText` runs** — primary rows are already chunk-sized.
  - **Writes never delete first.** `reembedSecondaryDocuments` upserts on `(document_id, chunk_index)` then trims the tail. The old delete-then-insert order left a window with zero embeddings; a timeout inside it lost the document permanently.
  - Embedding is **batched** (`embedTexts`, 64/request) — that is what keeps a re-chunk inside the serverless timeout. There is no `maxDuration` in the repo.

`app/api/chat/route.ts` per turn:
0. **Guard rails before any spend** — malformed JSON → 400; `message` ≤500 chars; client `messages` filtered and clamped to 5 turns × 2000 chars (history enters the system prompt *and* replays as real turns, so uncapped it is both a cost amplifier and a way to forge an assistant turn); then 30/hr/IP via `chat_requests`, recorded *before* the work so bursts and failures both count. The 429 carries `Retry-After`.
1. **HyDE** — question + hypothetical embedded together, so question-form queries match statement-form chunks.
2. **Parallel retrieval** — `match_primary` + `match_secondary`, top 10 each; a failed source falls back to `[]`.
3. **Empty-context guard** — both empty → canned refusal, no LLM call. Returns via `streamText()`, so it carries no trailer.
4. **Context block** — recent conversation / website / background materials.
5. **Stream** from `gpt-4o-mini` (NOT DeepSeek) at the runtime temperature.
6. **Suggestions + actions**, then the trailer.

**Suggestions are verified, not just generated.** A candidate is written against the context for the *current* question (C1) but answered against a **fresh retrieval** (C2), and the model also invents plausible-adjacent questions nothing in the corpus answers. Both dead-end into the canned refusal, which is worse than showing nothing. Three deterministic gates, no judge model:
0. **Freshness** — drops repeats of anything asked or offered in the last two turns. Lexical (Jaccard) **and** cosine (`REDUNDANT_COSINE`), unioned: neither alone works, because a reworded question can share no vocabulary with the original. Asked-question vectors ride the same batched `embedTexts` call as gate 2.
1. **Evidence** — the model must quote the span answering it, verified present in C1 by `containsGrounding()` (6-word shingles, because models paraphrase even when told to quote verbatim).
2. **Retrieval** — embed the candidate, run the same `match_*` the answer will run, confirm the evidence comes back.

Generated **after** the answer and given the answer text — generating blind was why it kept offering questions the answer had just covered. Costs nothing visible, since the sentinel has already unlocked the composer. Watch `[rag] suggestions: N proposed -> N lex-fresh -> N grounded -> N sem-fresh -> N retrievable -> N shown` if chips stop appearing. **Tuning is latency-bound**: each candidate costs a question *and* a quote, and the call must finish inside the answer's stream — 8 candidates with long quotes took a turn from 2.4s to 6.3s. Returns `[]` on any failure; a suggestions problem must never affect the answer.

**Stream wire format** (`lib/suggestion-protocol.ts`, shared by route + panel): the answer streams as `text/plain`, then a NUL-delimited sentinel — emitted **the instant the answer completes**, so it doubles as an "answer finished" marker and the composer unlocks without waiting on chips — followed by `{"suggestions":[…],"actions":[…]}`. **The route emits the sentinel, not the model**, so it cannot be forgotten or malformed. `splitStream()` withholds a partially-arrived sentinel so a half-delivered marker never flashes.

Secondary originals live in the private `secondary` Storage bucket. RLS denies anon on all three RAG tables; the route reaches them via `adminClient()`.

Env (`.env.local`, see `.env.local.example`): `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_ADMIN_EMAIL`, `ADMIN_EMAIL` (server-only; the one `requireAuth()` enforces — falls back to the `NEXT_PUBLIC_` one, fails closed if both are unset). `DEEPSEEK_API_KEY` is dead code. Composer adds `RESEND_API_KEY`, `CONTACT_FROM`, `CONTACT_TO`.

**One-time setup:** apply `supabase/rag_pipeline_migration.sql`, then edit mode → "Re-embed all primary content". **Cost** ~$0.0008/turn.

### RAG runtime settings

`rag.temperature` lives in `site_content` and is edited from the **Context panel** slider in edit mode — no redeploy. `app/api/chat/route.ts` reads it alongside retrieval (so the read is free) and builds the `ChatOpenAI` per request; unset/blank falls back to 0.7, and everything is clamped to 0–1.2 (above that `gpt-4o-mini` degrades).

Two traps this design exists to avoid:
- **Never write it via `upsertSiteContent`** — that embeds what it writes, which would put "Site content (rag.temperature): 0.9" into `primary_embeddings` and let the bot retrieve its own settings as a fact. `updateRagTemperature` writes directly, and `backfillPrimaryEmbeddings` skips any key under the `rag.` prefix.
- **Constants live in `lib/rag-settings.ts`, not in `app/admin/actions.ts`** — a `"use server"` module may only export async functions, and exporting a plain `const` from one is a build error that `tsc` does not catch. Only the Next compiler does, so it surfaces as a 500 at runtime.

Temperature changes phrasing variety, **not** how much the model may extrapolate — that is governed by the TIER 1/TIER 2 grounding rules. Raising it makes answers more varied, not more speculative.

### Supabase browser-client gotcha

`lib/supabase.ts` MUST use `createBrowserClient` from `@supabase/ssr`, NOT `createClient` from `@supabase/supabase-js`. Only the SSR version stores sessions in cookies; the plain client uses localStorage, which server actions can't read, so `requireAuth()` would redirect every save. This was a real bug.

## Database

All in the Supabase public schema:

- `projects`, `experience`, `education` (single-row Purdue today)
- `site_content` — key/value for editable text + structured JSON: `hero.tagline`, `hero.sub_line`, `hero.name.{line1,line2}`, `bento.{building,stack,interests}`, `bento.globe_markers` (JSON array, see globe section), `contact.{headline,sub}`, optional `contact.link.{github,linkedin,email}`. The Growth bento tile is hardcoded in `components/Bento.tsx`, not a row.
- `themes` — `{ slug, name, tokens(JSONB), sort_order, published }`
- `primary_embeddings` — pgvector for live content; auto-upserted on edits; respects `published` (except `site_content`). Service-role only.
- `secondary_documents` — uploaded-file metadata.
- `secondary_embeddings` — pgvector for secondary chunks; FK to `secondary_documents` `on delete cascade`.
- `contact_submissions` — rate-limit window + contact log for the inline email composer (id, created_at, ip, from_email, subject, status). Service-role only; RLS enabled with no anon policies.

- `chat_requests` — per-IP rate-limit window for `/api/chat` (id, created_at, ip). Service-role only. A counter, not a log: rows outside the window are disposable.

RLS: content tables are `SELECT`-public (each gated on `published` where the column exists), **writes via service-role in server actions only — no table carries a write policy**; the RAG tables + `contact_submissions` + `chat_requests` are service-role for read+write.

> `projects`/`experience`/`site_content` once carried `FOR ALL USING (auth.role() = 'authenticated')`, which is true for *any* signed-in user of the project — combined with open signups that let anyone rewrite the site through PostgREST with the public anon key, bypassing every app-layer guard. `supabase/tighten_content_rls.sql` removed them. **Never add a write policy keyed on `auth.role()`**; the service role bypasses RLS, so server actions need no policy at all.

### Migrations (apply via `supabase db query --linked -f supabase/<file>.sql`)

- `stage3_migration.sql` — education table + site_content seed
- `rag_pipeline_migration.sql` — pgvector + the 3 RAG tables + **HNSW** indexes + `match_primary`/`match_secondary` RPCs + RLS + Storage bucket. Apply once. (An earlier IVFFlat version under-retrieved.)
- `globe_markers_seed.sql` — UPSERT the 3 seed markers
- `resume_seed.sql` — idempotent sync of `projects` + `experience` with the canonical resume (holds the **old prose** descriptions — re-applying it overwrites the bullet form)
- `bulletize_descriptions.sql` — rewrites `projects`/`experience` descriptions into newline-separated bullet lines (rendered by `DescriptionBlock`); re-embed primary content after applying
- `contact_submissions_migration.sql` — contact composer rate-limit/log table (`contact_submissions`), service-role RLS
- `themes_*.sql` (5 files: `themes_migration`, `_add_terminal`, `_add_editor_themes`, `_add_more_themes`, `_remove_themes`) — seeded the theme set in that order, all idempotent. The live list is whatever is in the `themes` table; adding a theme is one row, not a migration.
- `seed_missing_site_content.sql` — upserts `hero.name.line2`, `contact.link.github`, `contact.link.email` (previously only component fallbacks; now DB-backed so /buffett + RAG see them)
- `tighten_content_rls.sql` — **security**: drops the `auth.role() = 'authenticated'` write policies on `projects`/`experience`/`site_content` (see the RLS note above). Idempotent.
- `chat_rate_limit_migration.sql` — `chat_requests` table for the `/api/chat` per-IP limit, plus tightens `education`'s public-read to `published = true` (drafts were readable via the anon API)

The linked project is **`Rithvik`** (not `rithvikpkx's Project` or `Grind-Catapult26` — three under the same org).

## File layout cheat sheet

```
next.config.ts        — AVIF/WebP image formats + optimizePackageImports:["motion"]
app/
  (site)/layout.tsx   — ISR root (revalidate=60) for the themed site: themes fetch, ThemeStyleInjector + FOUC script + ThemeProvider + (EditModeProvider wrapping children + InlineLoginPanel + EditBar) + ThemeDial + BuffettLink
  (site)/page.tsx     — ISR (revalidate=60): fetches site_content + parses globe markers; renders sections + DeferredOverlays  → "/"
  (plain)/layout.tsx  — bare second root layout (own <html>/<body>, inline CSS, no providers/theme/JS) for /buffett
  (plain)/buffett/page.tsx — plain-HTML homage page (server component, same DB data, no animations)  → "/buffett"
  globals.css         — tokens, dial, bento (globe/markers/growth), rag chat (theme-independent), OTP login, composer (mobile sheet inset between nav + RAG), buffett link/tooltip
  icon.tsx / apple-icon.tsx / opengraph-image.tsx — dynamic favicon / iOS icon / OG image
  admin/actions.ts    — server actions for all tables (incl. updateGlobeMarkers)
  admin/rag-actions.ts— backfillPrimaryEmbeddings, reembedSecondaryDocuments, list/upload/delete secondary docs
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
  DescriptionBlock      — renders a project/experience description as a bullet list (multi-line) or <p> (single line)
  DeferredOverlays      — mounts RagBot + SecondaryContextPanel + ContactComposer (all dynamic, ssr:false)
  BuffettLink           — easter-egg "For Warren Buffett" link to /buffett + hover tooltip (rendered in (site) layout)
  ui/animated-beam      — vendored MagicUI (cn stripped, reduced-motion + vertical added)

lib/
  supabase.ts         — clients (browser = createBrowserClient)
  themes.ts           — token list, fallbacks, buildThemeStyleSheet
  types.ts            — Project, Experience, Education, SiteContent, Theme, Database
  embeddings.ts       — embedText (single) + embedTexts (batched), HyDE, row→text builders, upsert helpers
  chunk-text.ts       — dependency-free recursive splitter (CHUNK_TARGET/OVERLAP/HARD_MAX)
  suggestion-protocol.ts — chat stream wire format: sentinel + splitStream (shared client/server, tested)
  rag-settings.ts     — runtime-tunable RAG settings (temperature clamp, never-embedded `rag.` prefix); tested
  chat-actions.ts     — deterministic bot actions from retrieval metadata + URL allowlist (tested)
  action-links.ts     — server-only: loads the allowed URLs from published DB rows
  scroll-highlight.ts — scrollIntoView + temporary highlight ring for the "show me" action
  suggestions.ts      — server-only: generates grounded follow-ups (parallel to the answer)
  transcript.ts       — pure Markdown transcript builder for the export button (tested)
  file-extractors.ts  — PDF/DOCX/TXT/MD readers + image captioner
  sanitize-html.ts    — allowlist HTML sanitizer + htmlToText (unit-tested via node:test)

docs/plans/*          — phase1 design/dev, inline-editing, theme, rag-pipeline, bento-globe, passwordless-otp, inline-email-composer, performance-improvement (all implemented)
docs/explanations/rag-pipeline.md — RAG deep dive
```

## Where to look first when something breaks

- **Theme not switching** → `ThemeProvider` console errors; check `localStorage[rithvik-theme]`; force `data-theme` in devtools to isolate CSS.
- **Edit-mode save / `requireAuth()` redirects to login** → browser client isn't `createBrowserClient` (cookie mismatch in `lib/supabase.ts`).
- **Dial rotation doesn't animate** → `.theme-strip-option` lost `transition: transform …`, or pills regained `view-transition-name`.
- **Theme missing from the dial** → reapply themes migration; `SELECT slug,name,sort_order FROM themes`. ISR means raw SQL inserts surface within 60s (instant after any inline edit's `revalidatePath`).
- **RAG hallucinating wildly** → right chunk missing/low-ranked. Embed the question, query `match_primary` with `match_count=17`; if buried, check logs for `[rag] hyde failed`. Recovery: re-embed primary.
- **RAG canned refusal for known facts** → `[rag] empty-context guard fired` = both retrievals hit 0 rows. Verify index is HNSW: `SELECT indexdef FROM pg_indexes WHERE tablename='primary_embeddings';`.
- **RAG 500 "Embedding failed"** → `OPENAI_API_KEY` missing/exhausted (embeddings, HyDE, captioning, chat all use OpenAI).
- **RAG stale after edits** → logs for `[rag] … embed skipped:`. Recovery: SecondaryContextPanel → "Re-embed all primary content".
- **`[rag] hyde failed`** → OpenAI 429/401; retrieval falls back to raw question. **`[rag] match_secondary rpc error:`** → reapply migration (chat degrades to working source).
- **PDF upload crashes Vercel bundle** → `pdf-parse` crept back in (DOMMatrix). Use `unpdf`; `pdf-parse` MUST NOT be in `package.json`.
- **Secondary upload "MIME not supported"** → add to `TEXT_MIMES`/`IMAGE_MIMES` or add extractor in `lib/file-extractors.ts`. **"N chunks (cap 200)"** → split the file.
- **`match_primary`/`match_secondary` not found** → `rag_pipeline_migration.sql` not applied (or wrong project). Re-apply (idempotent).
- **Secondary panel missing** → self-gates on `useEditMode().isEditing`; log in first.
- **OTP email never arrives** → Resend logs first (delivered? → spam/DNS); if empty, Supabase didn't hand off → SMTP settings/key. 422 in auth logs = email not in `auth.users` or `shouldCreateUser:false` rejected it.
- **Magic link → Supabase error page** → redirect URL not allow-listed; add wildcard, re-request.
- **Magic link doesn't enter edit mode in new tab** → `?auth=ok` stripped early or callback failed; check `/auth/callback` logs.
- **OTP code rejected** → length mismatch; confirm Supabase OTP length 6–10. **"Email rate limit exceeded"** → 4/hr/email cap; wait 15 min or reuse a code.
