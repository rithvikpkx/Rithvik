# CLAUDE.md

Guidance for Claude Code in this repo. Project: a personal portfolio for **Rithvik Praveen Kumar** at [rithvik.ai](https://rithvik.ai) — a showcase plus a playground for live inline editing and an AI chatbot.

> **The overhaul is live on `dev`** (v7 design; Steps 0–2 done, tags `step0-done` / `step1-done` / `step2-done`). `/` serves the v7 site; `main`/production still runs the old site until "merge to main". Plan + status: `docs/plans/v4-overhaul.md` (next: Step 3 features). Design source of truth: `docs/mockups/v7/` (rules `CONTRACT.md`); porting pattern: `designs/PORTING.md`; shared interfaces: `docs/plans/step1-contract.md`.

## Stack

- **Next.js 16** (App Router), React 19, TypeScript; plain global CSS per component/design (no Tailwind classes in use)
- **Supabase** (Postgres + Auth) — `@supabase/ssr` for cookie sessions, `@supabase/supabase-js` for the server admin client. Auth is **passwordless OTP** (email code + magic link); the password column is unused by the UI.
- **Resend** — two distinct paths: (1) custom SMTP for Supabase Auth emails (`auth@rithvik.ai`); (2) the contact composer POSTs directly to the **Resend HTTP API** (`fetch` to `https://api.resend.com/emails`, no SDK) from `contact@rithvik.ai`. Verified domain `rithvik.ai` covers both.
- **Motion** (`motion/react`) for animation
- **WebGL**: one hand-rolled shader runtime (`lib/shader/`), no 3D library
- **OpenAI REST via `fetch`, no SDK** (`lib/openai.ts` streams chat via SSE; embeddings/HyDE/captioning/suggestions call the API directly) — `gpt-4o-mini` for chat, HyDE, image captioning; `text-embedding-3-small` for embeddings (`app/api/chat`). DeepSeek was tried and rolled back (it ignored grounding rules; `gpt-4o-mini` follows them reliably).
- **unpdf** for serverless PDF text extraction (replaced `pdf-parse@2`, which crashed on Vercel with `DOMMatrix is not defined`; `pdf-parse` must stay out of `package.json`)
- Deployed on **Vercel**: `dev` → preview, `main` → production. **The apex `rithvik.ai` is the serving host and `www` 307s to it** — a Vercel domain setting, not code. `siteUrl` in `app/(v7)/layout.tsx` (→ `metadataBase` + `alternates.canonical`) must keep pointing at the apex to match. It was the other way round once, and Google ended up caching the favicon under `www` while indexing the apex, which is why search results showed a blank globe. Don't "fix" `siteUrl` to `www`.
- **Performance**: v7 pages render per request (design cookie) but every DB read is cached (`getContent`, `getPalettes`, 60s), so Supabase stays off the hot path; overlays, designs and admin chrome are lazy chunks; one WebGL context with adaptive resolution; 45–60fps target, performance mode (`html.lite`) for low-power machines.

- **Security headers** (`next.config.ts` `headers()`): static CSP + nosniff/Referrer-Policy/X-Frame-Options/Permissions-Policy/HSTS. `script-src` keeps `'unsafe-inline'` on purpose: per-request nonces would force every page dynamic and kill ISR, and Next's inline hydration scripts have no stable hash. Previews also allow `vercel.live`. A new third-party host (fonts, images, embeds) needs a CSP entry or it is blocked.

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

### Page composition (v7)

Three root layouts via route groups, no top-level `app/layout.tsx` (crossing groups is a full document load):
- `app/(v7)/` — the site: `/` and `/work/[slug]` (a deep link = the full site with that case sheet open). Layout sets `<html data-design data-theme>` from the `rithvik-design` cookie, injects palette tokens (`ThemeStyleInjector`), runs the pre-paint `BOOT_SCRIPT`, and mounts `EditModeProvider` + lazy `EditModeOverlays`. SEO metadata lives here.
- `app/(plain)/` — `/buffett` (below).
- `app/(lab)/` — `/lab/<stream>` component harnesses (noindex, unlinked).

`components/site/SitePage.tsx` renders every v7 page: `getContent()` + `getPalettes()` + `getLook()` (cookie or `?theme=`) → `SiteProvider` → `DesignProvider` → `ActiveDesign` → the design component, plus the `Switcher`. **Pages are per-request** (they read the cookie), so there is no page ISR; instead the reads are cached: `getContent()` is `unstable_cache` 60s tagged `v7-content` (admin actions call `updateTag(CONTENT_TAG)` so saves show at once) and `getPalettes()` 60s.

- **Content** (`lib/content/`): `Content` = the mockup's `C` shape; `map.ts` `toContent()` (tested) maps DB rows, falling back per field to `fixture.ts`. DB: v7 columns on `projects`/`experience`/`education` + `site_content` keys `v7.*` (status, line, thesis, about, now, places, stack, faq, numbers) + `profile.work_authorization`. `v7.*` keys are NOT embedded (skipped in backfill) until Step 3 adds proper text builders.
- **Designs** (`lib/designs/registry.ts` + `designs/<id>/`): nine designs (Nimbus, Stipple, Glyph, Prism, Mercury, Thermal, Starlight, Tracker, Foil), lazy-loaded. **One shared page** (`components/site/layout/SiteLayout`: sticky header, hero, sections in `SECTIONS` order, mini footer); each design is a **skin** (`lib/designs/skin.ts`: labels, section classes, body overrides, `Title`, `SectionOrnament`, `NameFx`, `PortraitFx`, `ExperienceConnector`, `EducationObject`, `projectArt`) + `<id>.css` scoped under `[data-design="<id>"]` + optional `motion.ts` and shader. **Classic** (`designs/classic/`) is the reference skin with no overrides; it renders every legacy palette and is the first-visit default (GitHub Light). New design → `designs/PORTING.md`. The knowledge-graph section is gone from every look (code kept in `components/site/graph`).
- **Switching** (`components/site/DesignProvider.tsx`, `useDesign()`): cookie + localStorage, no flash on reload, a view-transition sweep that grows out of the switcher knob (the unit is its own transition layer, `view-transition-name: v7-dial`, so it stays live during the sweep). **Switching never locks**: the newest switch wins (a stale load bails, the running sweep is skipped). Chrome hit-tests every event to `<html>` during a view transition, so the switcher routes those to its controls by geometry, `T` cycles Classic + the nine designs, `?theme=` deep links, `data-theme-go` hooks, toast with Undo.
- **Shared components** (`components/site/`): `SiteProvider` (`useSite()`: content, overlays, toasts, `html.lite`; wires `data-case/compose/resume/agent/play/copy` clicks), lazy overlays (`CaseSheet`, `ComposerWindow`, `ResumeWindow`, `PlayWindow`, `AgentDock`, `Toasts`), `tether/Tether` (the portrait with GitHub / LinkedIn / Email / Resume on verlet strings, `sim.ts` tested; hero + footer; **the photo is never filtered by default; a per-look effect applies only while the visitor toggles it by clicking** (`PortraitFx` → `kinetic/PhotoFx`, a separate layer over the untouched photo)), `mark/Mark` (ouroboros), `graph/KnowledgeGraph` (`lib/graph/kg.ts`, tested), `Glyph` (`Icon`/`Logo` from `lib/assets`), `Clock`, `ShaderCanvas`.
- **Shader runtime** (`lib/shader/`): ONE WebGL context for the page (a switch swaps programs), shared GLSL head, per-design `setUniform` API (`uniforms` prop / `useShaderUniforms()`), adaptive resolution, pause off-screen/hidden, a single still frame under `html.lite` or reduced motion, fps watchdog that offers performance mode once. No design may create a second context or a 2D canvas for effects.
- **Performance mode** = the `html.lite` class (single source of truth; the lever on the switcher, restored pre-paint from `localStorage[rithvik-lite]`). Designs must render a designed still under it.
- **Edit mode on v7**: the site has no visible login button — `rithvik.ai/?edit` opens the login panel (or edit mode if the tab is signed in). Edit chrome CSS: `components/EditMode.css` (old tokens mapped from `--ui-*`). Editing the v7 content fields is Step 3.

### Buffett mode (`/buffett`)

A bare-HTML homage to berkshirehathaway.com, linked as **For Warren Buffett** from Classic's footer. Own root layout `app/(plain)/layout.tsx` (own `<html>`/`<body>`, inline styling, no providers/theme/JS). `app/(plain)/buffett/page.tsx` is a server component reading the same Supabase data, filtered `published = true` like every public read. Internal `/` links are plain `<a>` (full nav across the layout boundary), so the file disables `@next/next/no-html-link-for-pages` file-wide.

A bare-HTML homage to berkshirehathaway.com, reached via the **For Warren Buffett** link near the theme dial (`components/BuffettLink.tsx`, with a hover tooltip). It lives in its own root layout `app/(plain)/layout.tsx` (own `<html>`/`<body>`, all styling inline, no providers/theme/JS). `app/(plain)/buffett/page.tsx` is a server component that pulls the **same** Supabase data as the homepage and renders it as plain semantic HTML, mirroring the homepage's published-visibility (Education filtered by `published`; Projects/Experience not). Internal `/` links use plain `<a>` for a full nav across the layout boundary — the page disables `@next/next/no-html-link-for-pages` file-wide for that reason (a line-level directive kept getting detached by editor auto-formatting).

### Palette themes (`lib/themes.ts`, `components/ThemeStyleInjector.tsx`)

Legacy palettes are rows in the `themes` table (`tokens` JSONB: `bg, bg-soft, text, muted, accent, accent-glow, green`). `ThemeStyleInjector` emits `:root[data-theme="<slug>"]{…}` for every row (slugs + values validated against an allowlist before injection). On v7 a palette renders **Classic**, which maps the 7 tokens onto the shared `--ui-*` / `--pt-*` / `--kg-*` tokens so overlays follow the palette. Classic lifts `--muted` per slug where a palette failed 4.5:1 — **a palette added later must pass 4.5:1 on its own** (or add a line in `designs/classic/classic.css`). The switcher (`components/site/switcher/`: a detented knob with drag/inertia/spring physics in `physics.ts` (tested), wheel/arrows, clickable jewels; the performance lever; the /status lamp) lists designs, a gap, then palettes, bottom-left.

### Inline editing (passwordless OTP)

- `EditModeProvider` (client) owns `isEditing`, `panelOpen`, the Supabase session, and the OTP flow.
- **Passwordless login**: enter email → Supabase emails a numeric code AND a magic link (one token, two paths). Enter the code in the panel for same-tab auth, or click the link for a fresh tab.
- **Resend SMTP** sends from `auth@rithvik.ai` (SPF/DKIM/return-path DNS on Vercel); the built-in mailer is bypassed. The Magic Link **email template is customized** to render both `{{ .Token }}` and `{{ .ConfirmationURL }}` — the default omits the token, leaving the code path empty.
- **OTP length** is whatever Supabase generates (default 8 in newer projects); the panel input accepts 6–10 digits.
- **Session policy**: per-tab via `sessionStorage[rithvik-tab-auth]`; closing the tab clears it. "Exit editing" signs out of Supabase too. The browser client is lazy-loaded (`import()` in `EditModeProvider`) only when a login starts or the tab is already authed, so visitors never download it. Public reads filter `published = true`; edit mode loads drafts through `listAllProjects`/`listAllExperience` (admin-only).
- **Allow-list**: two layers. `NEXT_PUBLIC_ADMIN_EMAIL` is checked client-side before the Supabase call — instant feedback + avoids burning the OTP rate limit. The one that actually enforces anything is `requireAuth()`, which compares the session email against server-only `ADMIN_EMAIL` (falling back to the `NEXT_PUBLIC_` one) and **fails closed if neither is set**. A Supabase session only proves *someone* signed in to the project, not that Rithvik did — never treat "has a session" as "is admin".
- **Magic-link landing**: callback redirects to `/?auth=ok`; `EditModeProvider` detects the marker on mount, pre-arms `tabAuth`, flips `isEditing`, strips the param via `history.replaceState` (without the marker the in-tab SDK fires `INITIAL_SESSION`, which the per-tab policy filters out, leaving the new tab unauthenticated).
- Components: `InlineLoginPanel` (top-right two-step card), `EditBar` (bottom "Exit editing"), `EditableText` (contentEditable, saves on blur, Esc reverts, Enter blurs unless multiline), `EditableTagList` (chip editor).
- Server actions in `app/admin/actions.ts` (`create/update/deleteProject`, same for Experience, `updateEducation`, `upsertSiteContent`, `updateGlobeMarkers`) all call `requireAuth()` + `revalidatePath("/")`.
- Callback `app/auth/callback/route.ts` exchanges the PKCE code for a session, redirects to `/?auth=ok` or `/?auth_error=…`.

### Email composer (`components/site/overlays/ComposerWindow.tsx`, `app/api/contact/route.ts`, `lib/sanitize-html.ts`)

Visitors email Rithvik from a draggable, non-modal floating window (`components/site/windows/Window.tsx`; full-screen sheet ≤640px), opened by any `data-compose` hook. The body is a plain textarea converted to escaped `<p>`/`<br>` HTML; the payload is `{ from, subject, bodyHtml, honeypot }`.

- **`lib/sanitize-html.ts`** — allowlist sanitizer (`sanitizeEmailHtml`, `htmlToText`). Reconstructs each kept tag from scratch so raw attributes (`onclick`/`style`/`javascript:`) never survive; drops `<script>`/`<style>` entirely. Allowlist: `b, strong, i, em, u, s, strike, ul, ol, li, p, br, a[safe href]`. Unit-tested via `node:test` (`node --experimental-strip-types --test lib/sanitize-html.test.ts`), which needed `allowImportingTsExtensions: true` in `tsconfig.json` (valid under `noEmit`).
- **`app/api/contact/route.ts`** — POST handler. **Honeypot**: hidden field filled → fake 200, dropped. Validates email/subject/body, **re-sanitizes body server-side** (server is the gate). **Rate limit**: 3 sends/hr per IP (IPv6 /64) + 50/hr global via `lib/rate-limit.ts` → `rate_limit_hit` RPC (atomic, fails closed); `contact_submissions` stays the send log. Sends via Resend HTTP API (`fetch`) from `CONTACT_FROM` to `CONTACT_TO`, visitor address in `reply_to` only (never `from` — SPF/DKIM). Sender display name HTML-escaped before header interpolation. Logs each send.
- **Owner-only context footer** — `lib/contact-context.ts` (pure, tested) appends a "Context" block to the email that goes to `CONTACT_TO` only: source (RAG agent draft / contact composer), page URL + design, `https://<origin>/admin/chats/<agent session id>` (only when the posted `agentSessionId` is a uuid that exists in `agent_sessions`), visitor geo (Vercel headers), user agent, referrer, time. Everything is escaped; page and referrer are plain text, never links. `openComposer(subject, body, { agentSessionId })` carries the id from `draft_email` / `/contact`. `contact_submissions.agent_session_id` needs `supabase/contact_agent_session_migration.sql`; the route retries the insert without it until applied. The footer sits in the email body, so a reply quotes it: it says "delete before replying".
- **No CC to sender** — `/api/contact` sets `reply_to: sender` only. It used to `cc: [sender]`, but `from` is unverified visitor input, so cc'ing it made the route a small open relay. Don't reinstate the CC without verifying the address first.

**DB:** `contact_submissions` table (id, created_at, ip, from_email, subject, status) — service-role only, RLS enabled with no anon policies. Migration: `supabase/contact_submissions_migration.sql`.

**Env (server-only):** `RESEND_API_KEY`, `CONTACT_FROM`, `CONTACT_TO`.

### Agent + RAG (`components/site/agent/*`, `overlays/AgentDock.tsx`, `lib/agent/*`, `app/api/chat/route.ts`)

A Claude Code-style agent docked bottom-centre on every design (⌘K or `/` to summon): `❯` prompt, slash commands (`lib/agent/commands.ts`: `/help /resume /projects /experience /contact /theme /now /clear /export /history /fullscreen /quit`), `⏺ Search(site, "q")` tool rows, streamed answers, a status line (`⚠ rate limited · retry in Xm` from `Retry-After`), Esc interrupts (AbortController) then closes, ↑/↓ history. Side effects (open a project, a link, the composer, a game, the resume, a scroll) ask first: `[⏎ Yes] [n No] [a Always this session]`, **one at a time, in request order** (a queue in `useAgent`); when a step opened an overlay the collapsed dock shows the next confirmation above it (`.agent[data-pending]`, z 96). `switch_design` runs at once with `u Undo`. The dock blurs its input before opening an overlay — overlays restore focus on close, and the input's `onFocus` would reopen the agent over them. History sent to the server = real turns only. `SecondaryContextPanel` (uploaded docs, re-embed, temperature) is edit-mode only.

**Extras**: edit-mode slash commands `/embed`, `/temp <0-1.2>`, `/docs`, `/resume sync` (`ADMIN_COMMANDS` in `lib/agent/commands.ts`, never in `COMMANDS` so visitors don't see them; runner `components/site/agent/adminCommands.ts`, gated by a module flag `AgentDock` sets from `isEditing`; the server actions re-check auth). Starter chips answer instantly from `Content` (`lib/agent/starters.ts`, no API call). Selecting page text shows an "Ask" chip (`components/site/AskSelection.tsx`, Alt+A, Esc) that opens the agent with `Explain: "<quote>"`. Every design carries the anchor ids `top, work, experience, about, play, questions, contact` + `project-<slug>`/`experience-<slug>` (`npm run check:anchors`). Golden eval: `npm run eval -- --base http://localhost:3000 [--model <id>] [--rotate-ip]` runs `evals/agent.jsonl` (40 cases) and writes `evals/results/`.

> Deep dives: `docs/explanations/rag-pipeline.md` (retrieval), `docs/plans/feat-agentic-actions.md` (actions + the calibration data behind the thresholds). This is the quick reference.

**Controls**: suggestion chips **fill the input, never send**; actions are confirmation rows, never automatic. `SimpleMarkdown` returns React elements (never `dangerouslySetInnerHTML`) and renders only http/https/mailto links. Transcript export via `/export`, or the header **Copy chat** / **Download chat** buttons (`rag-chat-<YYYY-MM-DD-HHmm>.md`): `lib/transcript.ts` (pure, tested) renders every panel row (prompts, rewrite/search rows, tool calls with their confirmation outcome, answers, footnote sources, suggestions, notes) with timestamps under a header (site, date, session id, model, design, tokens). Rows are stamped with `at` in `useAgent.add`.

**RAG** is the agent's name ("Rithvik Augmented Generation"; header `✻ RAG`). The prompt is an auto-growing `<textarea>` (1-6 rows): Enter sends, Shift+Enter is a newline, and ↑/↓ walk history only when the caret is on the first/last line. **Diagnostics**: `/usage` shows this visitor's hourly window, session tokens, last-turn timings, model and cache header; `/api/chat` returns `X-RateLimit-Limit/Remaining/Reset` (reset = epoch seconds, from one count query after the hit in `lib/rate-limit.ts`; no migration) and `GET /api/chat/usage` reads the window without spending a turn. The status line is `● ready · 3 turns · 41/60 left · 12.4k tok · 1.9s · ? for shortcuts` (unknown pieces hidden; `.s-*` classes drop hint/time/tok as the panel narrows). `Overlays` mounts inside `DesignProvider` (SitePage passes `overlays={null}` to SiteProvider): rendered outside it the agent could not see the design, so `/theme` and `switch_design` failed.

**Tools** (`lib/agent/tools.ts`, OpenAI function calling): `open_project(slug)`, `show_section(id)`, `open_resume()`, `start_game(id)`, `switch_design(id)`, `draft_email(subject, body)`, `local_time(place)`. Enums come from content/registry/palettes each turn; `validateToolCall` drops any unknown name or malformed JSON, `draft_email` strips URLs + control chars, `local_time` runs on the server (`result` in the frame). ≤2 side effects per step, ≤3 steps per turn (`MAX_STEPS`); each step's tool results go back to the model, so "show me X, then help me email him" becomes open_project → draft_email. **No tool takes or returns a URL.** `draft_email` opens `openComposer(subject, body)` prefilled; it never sends.

**Bot actions** (`lib/chat-actions.ts`, `lib/action-links.ts`) — the **fallback when the model called no tool** (kept because they also offer GitHub/demo links, which no tool does). Max 2 per turn, always a confirmation, never automatic.
- **Derived deterministically from retrieval metadata: no model, no extra LLM call.** `match_primary` returns `source_table`/`metadata`/`similarity`; `source_table` → anchor, `metadata.slug` → DB row.
- **The model never supplies a URL.** Actions name a record; `action-links.ts` resolves it from published rows and `safeUrl()` permits only `http(s)`; scroll targets must match `/^[a-zA-Z0-9_-]+$/`. A model-authored link behind a button is a phishing vector, and secondary documents are a prompt-injection surface.
- **Gate on a SEPARATE bare-question retrieval, never the HyDE embedding.** HyDE writes a Rithvik-flavoured hypothetical for *any* input, so off-topic questions land inside the corpus — "who won the world cup?" scores 0.732 with HyDE, 0.099 without. `ACTION_SIMILARITY_FLOOR` applies to the bare-question score; the HyDE chunks still choose *what* to point at, so the button matches what the answer discussed. Also suppressed behind a refusal (`isDeclineAnswer`).
- Scroll targets map to the standard anchors (`#about`, `#experience-<slug>`, `#project-<slug>`, …).

**Citations + highlight**: retrieved records are numbered `[n]` in the prompt; the `sources` frame carries a server-derived `anchor` (`anchorFor`, `lib/agent/highlight.ts`). After an answer the lowest-numbered cited anchor present in the design scrolls to `block: center` with a fading `--ui-accent` ring (`.agent-hl`, `components/site/agent/highlight.ts`) — once, and never when full screen, an overlay covers the page, or the visitor scrolled/typed in the last 3s. Footnote clicks always scroll + highlight.

**Page context** (`lib/agent/context.ts`): each request carries `{design, section (landmark nearest the viewport centre), caseSlug, selection ≤500}`; the server keeps only values that name something real and quotes the selection as untrusted data.

**Two pgvector stores**, both **HNSW** (NOT IVFFlat — it under-retrieved with `lists` ≫ rows):
- `primary_embeddings` — one row per `projects`/`experience`/`education`/`site_content` record, auto-upserted on inline edit inside `safeEmbed` (save first, embed second). `syncPrimary` respects `published`; `site_content` has no such column and always embeds. Chunk text is statement-form prose with a name anchor ("Rithvik Praveen Kumar studies at Purdue…"); dotted keys map to readable phrases.
- `secondary_embeddings` — uploaded files (PDF `unpdf`, DOCX `mammoth`, text UTF-8, images captioned). Per-file cap 200 chunks. **The only place `chunkText` runs** — primary rows are already chunk-sized.
  - **Writes never delete first.** `reembedSecondaryDocuments` upserts on `(document_id, chunk_index)` then trims the tail. The old delete-then-insert order left a window with zero embeddings; a timeout inside it lost the document permanently.
  - Embedding is **batched** (`embedTexts`, 64/request) — that is what keeps a re-chunk inside the serverless timeout. There is no `maxDuration` in the repo.

`app/api/chat/route.ts` per turn:
0. **Guard rails before any spend** — malformed JSON → 400; `message` ≤500 chars; client `messages` filtered and clamped to 5 turns × 2000 chars (history enters the system prompt *and* replays as real turns, so uncapped it is both a cost amplifier and a way to forge an assistant turn); then 60/hr per IP (IPv6 /64) + 1500/hr global via `lib/rate-limit.ts` → `rate_limit_hit` RPC, recorded atomically *before* the work so bursts and failures both count; limiter error → 503 (fails closed). The 429 carries `Retry-After`.
1. **Rewrite** (history only) — `AUX_MODEL` turns a follow-up into a standalone question (`lib/agent/rewrite.ts`) before HyDE, retrieval and gating; shown as `⏺ Rewrite(…)`.
2. **HyDE** + **one batched embedding** (hyde vector + bare-question gate vector), then `match_primary` (5) + `match_secondary` (6) + the bare gate in parallel. Retrieval failing degrades to profile-only, never a 500.
3. **Grounding** — the whole published profile (`renderProfile(getContent())`, `lib/agent/profile.ts`) goes in the system prompt **every turn**; retrieval adds numbered records (uploaded docs + the synced resume are only reachable this way). `scrubPrivate` removes phone numbers and graduation dates from both; the prompt forbids them too. TIER 1/2 rules unchanged; partial answers allowed. Empty-context guard now only fires if the profile is empty AND retrieval found nothing.
4. **Steps** — up to 3 streamed completions on `CHAT_MODEL` with tools; text and validated tool frames stream as they happen. `req.signal` aborts every upstream call.
5. `done`, then suggestions + fallback actions + `usage.total_tokens` in the trailer.

**Models** (`lib/openai.ts`, fetch, no SDK): `CHAT_MODEL` (default `gpt-4o-mini`) answers and calls tools; `AUX_MODEL` (default `gpt-5-nano`, `reasoning_effort: "minimal"`) does rewrite, HyDE and suggestions. `chatBody()` handles both families: reasoning models (gpt-5*, o*) get `max_completion_tokens` + `reasoning_effort` and never `temperature`. With `EVAL_TOKEN` set, a matching `x-eval-token` lets `x-eval-model` pick the answer model per request (the eval uses it); otherwise both headers are ignored.

**Suggestions are verified, not just generated.** A candidate is written against the context for the *current* question (C1) but answered against a **fresh retrieval** (C2), and the model also invents plausible-adjacent questions nothing in the corpus answers. Both dead-end into the canned refusal, which is worse than showing nothing. Three deterministic gates, no judge model:
0. **Freshness** — drops repeats of anything asked or offered in the last two turns. Lexical (Jaccard) **and** cosine (`REDUNDANT_COSINE`), unioned: neither alone works, because a reworded question can share no vocabulary with the original. Asked-question vectors ride the same batched `embedTexts` call as gate 2.
1. **Evidence** — the model must quote the span answering it, verified present in C1 by `containsGrounding()` (6-word shingles, because models paraphrase even when told to quote verbatim).
2. **Retrieval** — embed the candidate, run the same `match_*` the answer will run, confirm the evidence comes back (or is in the always-present profile).

Generated **after** the answer and given the answer text — generating blind was why it kept offering questions the answer had just covered. Costs nothing visible, since the `done` frame has already unlocked the prompt. Watch `[rag] suggestions: N proposed -> N lex-fresh -> N grounded -> N sem-fresh -> N retrievable -> N shown` if chips stop appearing. **Tuning is latency-bound**: each candidate costs a question *and* a quote, and the call must finish inside the answer's stream — 8 candidates with long quotes took a turn from 2.4s to 6.3s. Returns `[]` on any failure; a suggestions problem must never affect the answer.

**Stream wire format v2** (`lib/suggestion-protocol.ts`, shared by route + panel + `evals/lib.mjs`): `text/plain` where answer text streams raw and events are NUL-delimited JSON frames between text runs: `rewrite{q}` → `search{q,n,top[{src,score}]}` → `sources{items[{n,label,anchor?}]}` → (text | `tool{id,name,args,result?}`)* → `done` (answer finished: unlocks the prompt before chips) → `trailer{suggestions,actions,usage}`. **The route emits every frame, never the model.** `parseFrames()` withholds a partially-arrived frame and keeps part indices stable as the stream grows; `splitStream()` collapses to answer + trailer.

Secondary originals live in the private `secondary` Storage bucket. RLS denies anon on all three RAG tables; the route reaches them via `adminClient()`.

Env (`.env.local`, see `.env.local.example`): `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_ADMIN_EMAIL`, `ADMIN_EMAIL` (server-only; the one `requireAuth()` enforces — falls back to the `NEXT_PUBLIC_` one, fails closed if both are unset). `DEEPSEEK_API_KEY` is dead code. Composer adds `RESEND_API_KEY`, `CONTACT_FROM`, `CONTACT_TO`.

**One-time setup:** apply `supabase/rag_pipeline_migration.sql`, then edit mode → "Re-embed all primary content". **Cost** ~5k answer tokens/turn with the full profile (~$0.001 on gpt-4o-mini).

### RAG runtime settings

`rag.temperature` lives in `site_content` and is edited from the **Context panel** slider in edit mode — no redeploy. `app/api/chat/route.ts` reads it alongside retrieval (so the read is free) and builds the `ChatOpenAI` per request; unset/blank falls back to 0.7, and everything is clamped to 0–1.2 (above that `gpt-4o-mini` degrades).

Two traps this design exists to avoid:
- **Never write it via `upsertSiteContent`** — that embeds what it writes, which would put "Site content (rag.temperature): 0.9" into `primary_embeddings` and let the bot retrieve its own settings as a fact. `updateRagTemperature` writes directly, and `backfillPrimaryEmbeddings` skips any key under the `rag.` prefix.
- **Constants live in `lib/rag-settings.ts`, not in `app/admin/actions.ts`** — a `"use server"` module may only export async functions, and exporting a plain `const` from one is a build error that `tsc` does not catch. Only the Next compiler does, so it surfaces as a 500 at runtime.

Temperature changes phrasing variety, **not** how much the model may extrapolate — that is governed by the TIER 1/TIER 2 grounding rules. Raising it makes answers more varied, not more speculative.

### Supabase browser-client gotcha

`lib/supabase-browser.ts` MUST use `createBrowserClient` from `@supabase/ssr`, NOT `createClient` from `@supabase/supabase-js`. Only the SSR version stores sessions in cookies; the plain client uses localStorage, which server actions can't read, so `requireAuth()` would redirect every save. This was a real bug.

## Database

All in the Supabase public schema:

- `projects`, `experience`, `education` (single-row Purdue today)
- `site_content` — key/value: v7 keys `v7.{role,status,line,thesis,about,now,places,stack,faq,numbers}` (JSON as text), `profile.work_authorization` (shown only in resume fine print + the agent), `hero.name.{line1,line2}`, `contact.link.{github,linkedin,email}`, `rag.temperature`; legacy `hero.*`/`bento.*`/`contact.*` rows from the old site remain (embedded for the bot) and are harmless.
- `themes` — `{ slug, name, tokens(JSONB), sort_order, published }`
- `primary_embeddings` — pgvector for live content; auto-upserted on edits; respects `published` (except `site_content`). Service-role only.
- `secondary_documents` — uploaded-file metadata.
- `secondary_embeddings` — pgvector for secondary chunks; FK to `secondary_documents` `on delete cascade`.
- `contact_submissions` — rate-limit window + contact log for the inline email composer (id, created_at, ip, from_email, subject, status). Service-role only; RLS enabled with no anon policies.

- `rate_limit_hits` — generic rate-limit window (bucket, key, created_at) behind the `rate_limit_hit` RPC; pruned per call. Service-role only.
- `chat_requests` — legacy `/api/chat` counter, no longer written (superseded by `rate_limit_hits`).

RLS: content tables are `SELECT`-public (each gated on `published` where the column exists), **writes via service-role in server actions only — no table carries a write policy**; the RAG tables + `contact_submissions` + `chat_requests` + `rate_limit_hits` are service-role for read+write.

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
- `rate_limit_rpc_migration.sql` — `rate_limit_hits` + atomic `rate_limit_hit()` RPC (per-bucket advisory lock, per-key + global caps; execute revoked from anon/authenticated); prunes `chat_requests`
- `v7_content_migration.sql` — v7 columns (projects headline/kind/icon/ctx/v7_order, experience period, education focus/grad) + `v7.*` site_content seeds; seed-only, never overwrites edits
- `v7_faq_refresh_migration.sql` — owner's general FAQ, no graduation/start-date placeholders, `profile.work_authorization`

The linked project is **`Rithvik`** (not `rithvikpkx's Project` or `Grind-Catapult26` — three under the same org).

## File layout cheat sheet

```
next.config.ts        — images, CSP + security headers, /preview → / redirect
app/
  (v7)/layout.tsx     — site root: design cookie → <html data-design data-theme>, palette tokens, BOOT_SCRIPT, EditModeProvider + EditModeOverlays, SEO metadata
  (v7)/page.tsx       — "/" = SitePage;  (v7)/work/[slug]/page.tsx — full site with that case open
  (v7)/core.css       — v7 base tokens, type, view-transition sweep, shared chrome primitives, lite toggle
  (plain)/            — /buffett (bare layout + page)
  (lab)/              — /lab/<stream> dev harnesses (noindex)
  icon.tsx / apple-icon.tsx / opengraph-image.tsx
  admin/actions.ts, admin/rag-actions.ts, admin/auth-helper.ts (requireAuth)
  api/chat/route.ts   — guard rails → rate limit → HyDE → match_primary + match_secondary → gpt-4o-mini stream → suggestions/actions trailer
  api/contact/route.ts — honeypot + validation + rate limit + Resend send
  auth/callback/route.ts — PKCE exchange → /?auth=ok or /?auth_error=…
designs/
  registry: lib/designs/registry.ts;  <id>/index.tsx + motion.ts + <id>.css;  classic/ (palettes);  PORTING.md
components/
  site/               — SitePage, SiteProvider, DesignProvider, ActiveDesign, switcher/, ShaderCanvas, LiteToggle (lab only), Glyph, Clock,
                        EditModeOverlays, overlays/*, agent/*, case/*, windows/*, play/*, layout/*, tether/*, mark/*, graph/*
  EditModeProvider, InlineLoginPanel, EditBar, EditMode.css, SecondaryContextPanel, EditableText, EditableTagList
  ThemeProvider, ThemeStyleInjector, SimpleMarkdown
lib/
  content/            — Content type, fixture, toContent (tested), getContent (cached)
  designs/            — registry (+ tested), server (getPalettes, getLook), types
  shader/             — GLSL head, runtime (one context, uniforms), helpers (tested)
  agent/, graph/, play/ — pure logic for the agent, knowledge graph, games (tested)
  assets/             — icons/logos, land, spinners/banner/commits, SITE_CREDITS
  supabase-browser.ts / supabase-server.ts, rate-limit.ts (tested), openai.ts (tested), embeddings.ts, chunk-text.ts,
  suggestion-protocol.ts, rag-settings.ts, chat-actions.ts, action-links.ts, suggestions.ts, transcript.ts,
  file-extractors.ts, sanitize-html.ts, themes.ts, words.ts, types.ts
docs/plans/v4-overhaul.md (plan + status), step1-contract.md;  docs/mockups/v7/ (design source);  docs/explanations/rag-pipeline.md
```

## Where to look first when something breaks

- **Wrong design on load / flash** → check the `rithvik-design` cookie and `BOOT_SCRIPT` in `lib/designs/registry.ts`; `<html data-design data-theme>` must match before first paint.
- **Design looks unstyled** → its CSS must be scoped `:root[data-design="<id>"]` and imported by `designs/<id>/index.tsx`; shared chrome primitives live in `app/(v7)/core.css`.
- **Shader blank / two canvases** → `lib/shader/runtime.ts` logs compile errors with design line numbers; a design must render exactly one `<ShaderCanvas>`.
- **Edit-mode save / `requireAuth()` redirects to login** → browser client isn't `createBrowserClient` (cookie mismatch in `lib/supabase-browser.ts`).
- **Switcher knob freezes during a switch** → `.theme-dial-aside` (the switcher keeps that class) lost `view-transition-name: v7-dial` (app/(v7)/core.css), or a child gained its own `view-transition-name`.
- **Theme missing from the dial** → `SELECT slug,name,sort_order,published FROM themes`; palette rows are cached 60s (`getPalettes`).
- **RAG hallucinating wildly** → right chunk missing/low-ranked. Embed the question, query `match_primary` with `match_count=17`; if buried, check logs for `[rag] hyde failed`. Recovery: re-embed primary.
- **RAG canned refusal for known facts** → `[rag] empty-context guard fired` = both retrievals hit 0 rows. Verify index is HNSW: `SELECT indexdef FROM pg_indexes WHERE tablename='primary_embeddings';`.
- **RAG 500 "Embedding failed"** → `OPENAI_API_KEY` missing/exhausted (embeddings, HyDE, captioning, chat all use OpenAI).
- **RAG stale after edits** → logs for `[rag] … embed skipped:`. Recovery: SecondaryContextPanel → "Re-embed all primary content".
- **`[rag] hyde failed`** → OpenAI 429/401; retrieval falls back to raw question. **`[rag] match_secondary rpc error:`** → reapply migration (chat degrades to working source).
- **PDF upload crashes Vercel bundle** → `pdf-parse` crept back in (DOMMatrix). Use `unpdf`; `pdf-parse` MUST NOT be in `package.json`.
- **Secondary upload "MIME not supported"** → add to `TEXT_MIMES`/`IMAGE_MIMES` or add extractor in `lib/file-extractors.ts`. **"N chunks (cap 200)"** → split the file.
- **`match_primary`/`match_secondary` not found** → `rag_pipeline_migration.sql` not applied (or wrong project). Re-apply (idempotent).
- **Secondary panel missing** → edit mode only; open `/?edit` and log in first.
- **OTP email never arrives** → Resend logs first (delivered? → spam/DNS); if empty, Supabase didn't hand off → SMTP settings/key. 422 in auth logs = email not in `auth.users` or `shouldCreateUser:false` rejected it.
- **Magic link → Supabase error page** → redirect URL not allow-listed; add wildcard, re-request.
- **Magic link doesn't enter edit mode in new tab** → `?auth=ok` stripped early or callback failed; check `/auth/callback` logs.
- **OTP code rejected** → length mismatch; confirm Supabase OTP length 6–10. **"Email rate limit exceeded"** → 4/hr/email cap; wait 15 min or reuse a code.
