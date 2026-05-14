# CLAUDE.md

Guidance for Claude Code when working in this repo. Project: a personal portfolio for **Rithvik Praveen Kumar**, deployed to [rithvik.ai](https://rithvik.ai), built as a one-stop showcase plus an experimental playground for live editing + an AI chatbot.

## Stack

- **Next.js 16** (App Router), React 19, TypeScript, Tailwind v4 (CSS in `app/globals.css`)
- **Supabase** (Postgres + Auth) — `@supabase/ssr` for cookie-based sessions, `@supabase/supabase-js` server admin client
- **Motion** (`motion/react`) for animation
- **LangChain** (`@langchain/openai`) wrapping **OpenAI** `gpt-4o-mini` for chat completions, HyDE expansion, and image captioning; OpenAI `text-embedding-3-small` for embeddings in the RAG bot (`app/api/chat`). DeepSeek was tried earlier and rolled back — see Pitfalls.
- **unpdf** for serverless PDF text extraction (replaced `pdf-parse@2` which crashed on Vercel due to a `DOMMatrix` reference at module evaluation).
- Deployed on **Vercel** (`dev` branch deploys preview, `main` deploys production)

Node 22, package manager: npm. `npm run dev` / `npm run build` / `npm run lint`.

## Rules (carried from earlier)

- Keep design philosophy simple. Architecture minimal and clean.
- Each function: 1–2 sentence description as a comment.
- Confusing or non-obvious lines: 1 short inline comment explaining WHY.
- Develop in **vertical slices** across the full stack — keep work visible and testable end-to-end.
- Self-test before claiming done. `node_modules/.bin/tsc --noEmit` is the cheapest gate; visual check on Vercel preview is the next.

## CI/CD and branching

Vercel is wired up to the GitHub repo with two long-lived branches:

- **`dev`** — every push triggers a **preview deployment** at a `rithvik-<hash>.vercel.app` URL. This is where all feature work happens and where the user reviews changes before they go live.
- **`main`** — every push triggers a **production deployment** at [rithvik.ai](https://rithvik.ai). Only fully completed, tested work lands here.

### Workflow for a new feature

1. Work happens on `dev`. Commit each logical step (`feat:`, `fix:`, `chore:`, `revert:` prefixes per the existing log). Push to `origin/dev` and let the Vercel preview build. Iterate until the user is happy with the preview.
2. When the user explicitly says "merge to main" (or equivalent), integrate with a **descriptive merge commit**:
   ```
   git checkout main
   git pull origin main
   git merge --no-ff dev -m "chore: merge dev → main (<bundle title>)"
   git push origin main
   ```
   The merge commit body should bullet the bundled feature areas — past examples in `git log` for the format. `--no-ff` is intentional: it preserves a visible "this is when dev landed" boundary instead of fast-forwarding the linear history into main.
3. Never push directly to `main`. Never merge without explicit user approval — production goes to a real domain.
4. Hotfixes are extremely rare; if needed, branch off `main`, fix, merge back to BOTH `main` and `dev` so they don't drift.

### Things to verify before suggesting a merge

- `node_modules/.bin/tsc --noEmit` clean
- `node_modules/.bin/eslint <touched files>` clean
- `node_modules/.bin/next build` succeeds (catches Vercel-specific bundling issues that don't show up locally)
- Vercel preview on `dev` is rendering correctly (the **only** way to catch SSR/edge runtime bugs that pass `next build` locally — see Pitfalls > Vercel)
- DB migrations in `supabase/*.sql` are applied to the linked project (`supabase db query --linked -f ...`) BEFORE the merge, since static state assumptions may break otherwise

## High-level architecture

### Page composition

`app/page.tsx` is a server component. It fetches `site_content` once and passes parsed/typed props down to client section components. Each section (`Hero`, `Bento`, `Education`, `Projects`, `Experience`, `Contact`) renders the same way for visitors but adapts to edit mode via `useEditMode()`.

### Server / client section split

Sections backed by their own table (`Projects`, `Experience`, `Education`) use a two-file pattern:

- `ComponentName.tsx` — server component, fetches the rows from Supabase, renders the section wrapper and section header, passes `initialRows` to a client component.
- `ComponentNameClient.tsx` — `"use client"`, owns local state, runs the edit-mode UI (sort buttons, add/delete, inline `EditableText` for each field, `EditableTagList` for tag arrays). Public view in this same component when `isEditing === false`.

Sections that just read keys from `site_content` (`Hero`, `Bento`, `Contact`) are single client components that take their content as props and use `useEditMode()` to swap to `EditableText` when editing.

### Theme system (`lib/themes.ts`, `components/ThemeProvider.tsx`, `components/ThemeStyleInjector.tsx`, `components/ThemeDial.tsx`)

Themes are rows in the `themes` table. Each row has a `tokens` JSONB column. **Only the primary palette is per-theme**:

`bg, bg-soft, text, muted, accent, accent-glow, green` (plus optional `font`).

Surface tokens are **derived in CSS via `color-mix()`**:

- `--card`, `--card-hover`, `--border`, `--border-hover` — `color-mix(in srgb, var(--text) X%, transparent)`
- `--nav-glass` — `color-mix(in srgb, var(--bg) 72%, transparent)`
- `--panel-glass` — `color-mix(in srgb, var(--bg) 90%, transparent)`

So **adding a new theme is one DB row** — define the 7 primary tokens and every surface adapts automatically. No CSS changes required. The dial currently fans out **14 themes**: 3 Rithvik-branded (Dark, Light, Terminal) plus 11 popular editor themes (One Dark Pro, Dracula, GitHub Dark/Light, Tokyo Night, Night Owl, Catppuccin Mocha, SynthWave '84, Ayu Mirage, Atom One Light).

At SSR, `ThemeStyleInjector` renders one `<style id="theme-tokens">` block containing `:root[data-theme="<slug>"] { … }` for every theme. The active theme is set on `<html data-theme="…">` by:
1. `<html data-theme="rithvik-dark">` hardcoded in JSX (works with JS disabled).
2. An inline boot script at the top of `<body>` that reads `localStorage[rithvik-theme]` and overwrites the attribute **before first paint** — no FOUC.

`ThemeProvider` wraps the app, exposes `useTheme()` → `{ themes, currentSlug, setTheme }`. `setTheme` is an **instant flip** — it writes `localStorage`, swaps `<html data-theme>`, and updates `currentSlug`. There is no page-wide transition animation.

**Root layout is `force-dynamic`** (`app/layout.tsx`) so new theme rows inserted directly into Supabase appear on the next page load — no redeploy required. The cost is one additional cheap themes-fetch per request, which is negligible at this site's traffic. Previously the layout was statically generated and DB-added themes wouldn't show up until the next build; this was a real foot-gun and the fix is permanent.

### Theme transition (instant flip + live dial rotation)

The only animation on a theme change is the dial pill rotation itself. The page-wide colors swap instantly — every CSS-var-driven surface (bg, text, borders, glass tints, etc.) repaints in the new theme on the next frame.

- **Dial rotation** (`.theme-strip-option { transition: transform 0.42s cubic-bezier(0.32, 0.72, 0, 1) }`) — each pill's `transform: translate(0, calc(-50% + Y)) rotate(Xdeg)` recomputes whenever `selectedIdx` changes; CSS interpolates it. The fan rotates smoothly as one cohesive unit while the rest of the page has already snapped to the new theme.

Earlier iterations tried two transition animations and we rolled both back:
- **View Transitions API** with per-pill `view-transition-name` — pulled pills out of the dial's `overflow: hidden` clipping (named groups aren't clipped by their parent's overflow) and interpolated their bounding boxes rather than their transforms, so pills snapped to the new rotation at t=0 and only slid linearly.
- **`<ThemeWash>` overlay** with delayed `data-theme` swap — a glass wave sweeping from the dial across the viewport, with the `data-theme` flip hidden behind the opaque crest. Looked busy; the instant flip reads cleaner.

### First-visit dial wiggle

A small one-time `translate + rotate` shake on the dormant dial draws attention to the theme picker without being intrusive. Implementation lives entirely in `ThemeDial.tsx` + the `.is-wiggling` rule in `globals.css`:

- Fires 5s after the user lands, if and only if `localStorage[rithvik-theme-wiggle-shown]` is unset.
- Suppressed early (and the flag set) the moment `currentSlug` changes — if the user already discovered the dial, no nudge needed.
- Three shake cycles (~1.8s total), pauses on hover/focus, honors `prefers-reduced-motion`.
- Pure client-side: no DB, no API calls, no props from the layout. The constants live in `ThemeDial.tsx`.

An earlier iteration auto-rotated the dial and selected SynthWave '84 by itself; it was too invasive and was rolled back. See Pitfalls.

### Inline editing (`feat-inline-editing.md`, completed)

- `EditModeProvider` (client) owns `isEditing`, `panelOpen`, Supabase session, login/logout
- Session policy: stays alive **per tab** (`sessionStorage` flag `rithvik-tab-auth`); closing the tab clears it so the next tab requires fresh login. The Supabase session itself is not signed out on "exit edit mode" — so re-entering the dial doesn't reopen the login panel
- `InlineLoginPanel` — top-right glass card, springs from the nav button
- `EditBar` — bottom floating indicator with "Exit editing"
- `EditableText` — `contentEditable` wrapper, saves on blur, Escape reverts, Enter blurs unless `multiline`
- `EditableTagList` — chip editor (× on each, input adds on Enter/comma/blur)
- Server actions in `app/admin/actions.ts` — `createProject/updateProject/deleteProject`, same for Experience, `updateEducation`, `upsertSiteContent`. Every action calls `requireAuth()` (reads cookie session) and `revalidatePath("/")`

### RAG bot (`components/RagBot.tsx`, `components/SimpleMarkdown.tsx`, `components/SecondaryContextPanel.tsx`, `app/api/chat/route.ts`)

A floating **"Ask RAG"** launcher in the bottom-right (mounted in `app/page.tsx`). The button is intentionally attention-grabbing — animated gradient text inside a halo'd pill — to telegraph "this site has an AI bot" at a glance. Clicking opens a glass chat panel; messages stream from `/api/chat` token-by-token. A second launcher to its left — `SecondaryContextPanel` — only appears in edit mode and manages the bot's secondary knowledge.

**Chat panel UI specifics:**
- **Theme-independent palette.** The launcher, panel, bubbles, chips, and input use private `--rag-*` tokens (defined inside `.rag-launcher` in `globals.css`) with hardcoded values. The bot looks identical on Dark, Light, Terminal, and every editor theme — the gradient/shine effects rely on a fixed dark-slate base to read correctly.
- **Animated shine border** ring around the panel (`.rag-shine`, masked radial gradient).
- **Resizable** by dragging the top-left corner: clamped to 320×420 min and 720×820 max; size persisted to `localStorage[rag-panel-size]` and hydrated via a lazy `useState` initializer (SSR-safe — the panel only renders post-hydration on user click, so SSR/client size mismatch is invisible).
- **`SimpleMarkdown` renderer** for bot replies — hand-rolled, dep-free; handles `**bold**`, `*italic*`/`_italic_`, inline `` `code` ``, fenced ``` blocks, `[text](url)` links, headings `# ##`, bullet/numbered lists, paragraphs with soft `<br>` for streaming mid-paragraph newlines. User messages render as plain text. The chat system prompt has a FORMATTING section instructing the model to use sparing markdown (max 2–3 bolded spans, bullets only for 3+ items, backticks for tech names) so the renderer has clean input.
- **Starter chips** appear only on the welcome screen (`messages.length === 1 && messages[0].role === "bot"`). Each chip has a precomputed Q+A pair (`STARTERS` constant in `RagBot.tsx`). Clicking appends the user message + bot answer instantly — no API call, no latency, no embedding load. Chips disappear the moment any real exchange happens. **Maintenance note:** the answers are static and grounded in current `site_content` seeds; update `STARTERS` if Rithvik changes schools, tech stack, or contact info significantly.
- **"Talking portfolio" welcome message** explicitly frames RAG so new visitors immediately understand what they're talking to.

> Full architectural deep dive: see `explanations/rag-pipeline.md`. This section is the quick reference.

Two parallel pgvector stores in Supabase, both indexed with **HNSW** (NOT IVFFlat — see Pitfalls):

- `primary_embeddings` — one row per `projects` / `experience` / `education` / `site_content` record. Auto-upserted by `app/admin/actions.ts` on every inline edit, wrapped in `safeEmbed` (save first, then embed; OpenAI failures don't undo saves). For `projects` / `experience` / `education` the upsert goes through `syncPrimary(...)`, which respects each row's `published` flag — `false` rows have their embedding deleted, matching backfill's `published = true` filter. `site_content` has no `published` column and always embeds via `embedPrimary` directly. `match_primary(query_embedding, match_count)` RPC returns top-N by cosine similarity. Chunk text is **statement-form natural prose with a Rithvik name anchor** (e.g. "Rithvik Praveen Kumar studies at Purdue University…") — labels like `[bento.stack]` are mapped to readable phrases ("Rithvik's tech stack and technologies he works with") so the embedded text actually carries semantic meaning instead of opaque dotted keys.
- `secondary_embeddings` — chunks from files Rithvik uploads via `SecondaryContextPanel`. Tied to `secondary_documents` rows that track filename / mime / storage path. PDFs use **`unpdf`** (a serverless-friendly wrapper around pdfjs-dist), DOCX uses `mammoth`, plain text reads UTF-8 directly, images get captioned by `gpt-4o-mini` and the caption is embedded. Per-file chunk cap = 200 to bound embedding cost per upload. `match_secondary(query_embedding, match_count)` mirrors the primary RPC.

`app/api/chat/route.ts` runs the following on every turn:
1. **HyDE expansion** — `generateHypotheticalAnswer(question)` calls `gpt-4o-mini` for a 1–2 sentence statement-form answer. The question + hypothetical are concatenated and embedded together. This is what makes question-form queries (like "where did rithvik study?") retrieve the right statement-form chunks.
2. **Parallel retrieval** — `Promise.allSettled` over `match_primary` + `match_secondary`, **top 10 each**. A failed source falls back to `[]` so one regression doesn't 500 the request.
3. **Empty-context guard** — if BOTH retrievals return zero rows, short-circuit the LLM entirely and stream the canned "I don't have that specific detail" refusal. Loud `[rag] empty-context guard fired` warning so a regression surfaces immediately.
4. **Context block** — three labeled sections: `## Recent conversation` (last 5 turns, for continuity), `## What's on the website` (primary chunks), `## Background materials` (secondary chunks).
5. **Chat completion** — streams from **OpenAI `gpt-4o-mini`** (NOT DeepSeek — see Pitfalls). System prompt has a top-of-prompt CRITICAL GROUNDING RULES section that's explicit about never inventing facts and only treating Recent conversation as continuity, not as a fact source. Recent turns are also passed as actual `Human`/`AI` message turns so the model sees a real conversation, not a transcript dump.

Originals of secondary uploads live in the private `secondary` Supabase Storage bucket. RLS denies anon access to all three RAG tables; the chat route and server actions reach them via `adminClient()` (service-role).

Env vars in `.env.local` (see `.env.local.example`): `OPENAI_API_KEY` (used for embeddings, HyDE, image captioning, and chat), `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `DEEPSEEK_API_KEY` is dead code now — left in the example for future reference but not consumed anywhere.

**One-time setup:** apply `supabase/rag_pipeline_migration.sql` in the Supabase SQL editor (or via `supabase db query --linked -f ...` with the CLI), then enter edit mode and hit "Re-embed all primary content" in `SecondaryContextPanel`. After that, every inline edit keeps primary in sync automatically, and the same panel handles secondary uploads + deletions. No terminal scripts needed.

**Cost** roughly $0.0008 per chat turn end-to-end (1 HyDE call + 1 embed + 1 chat completion, all on gpt-4o-mini / text-embedding-3-small). A few hundred queries/month is well under $1.

### Important Supabase gotcha

The browser client in `lib/supabase.ts` MUST be `createBrowserClient` from `@supabase/ssr` (NOT `createClient` from `@supabase/supabase-js`). Only the SSR version stores sessions in cookies — the plain client uses localStorage, which server actions can't read, so `requireAuth()` would redirect every save call to `/admin/login`. This was a real bug.

## Database

Tables (all in Supabase public schema):

- `projects` — portfolio projects
- `experience` — timeline rows
- `education` — schools (single-row Purdue today)
- `site_content` — key/value JSONB store for hardcoded text that became editable (`hero.tagline`, `hero.sub_line`, `bento.location`, `bento.building`, `bento.stats`, `bento.stack`, `bento.interests`, `contact.headline`, `contact.sub`, optional `contact.link.{github,linkedin,email}`)
- `themes` — `{ slug, name, tokens (JSONB), sort_order, published }`. Currently seeded: Rithvik Dark, Rithvik Light, Rithvik Terminal
- `primary_embeddings` — pgvector store for live website content. One row per projects/experience/education/site_content record; auto-upserted on inline edits. projects/experience/education respect `published` (rows flip to `false` are deleted from the store); site_content has no published column and always embeds. Service-role only.
- `secondary_documents` — file metadata for user-uploaded RAG materials (filename, mime, storage path, byte size).
- `secondary_embeddings` — pgvector store for chunks extracted from secondary documents. Linked to `secondary_documents` via FK with `on delete cascade`.

RLS: all content tables `SELECT` public; INSERT/UPDATE/DELETE use the service-role key only in server actions. The three RAG tables are service-role for both read and write — the chat route reaches them via `adminClient()`.

### Migration files (apply via Supabase SQL editor)

- `supabase/stage3_migration.sql` — education table + site_content seed (inline-editing stage 3)
- `supabase/themes_migration.sql` — themes table + Dark/Light/Terminal seed (idempotent ON CONFLICT)
- `supabase/themes_add_terminal.sql` — UPSERT just the Terminal row (run if other themes already exist)
- `supabase/themes_add_editor_themes.sql` — 11 popular editor themes (One Dark Pro, Dracula, GitHub Dark/Light, Tokyo Night, Night Owl, Catppuccin Mocha, SynthWave '84, Ayu Mirage, Atom One Light). Idempotent; sort orders 10–31 so it sits after the 3 Rithvik themes.
- `supabase/rag_pipeline_migration.sql` — pgvector extension + `primary_embeddings` + `secondary_documents` + `secondary_embeddings` + **HNSW** indexes + `match_primary` + `match_secondary` RPCs + RLS lockdown + Storage bucket. Apply once; the rest is UI-driven. (NOTE: an earlier version used IVFFlat with `lists = 100`; that caused silent under-retrieval — see Pitfalls. HNSW is the correct choice and is what the committed migration sets up.)

Apply migrations via the linked CLI: `supabase db query --linked -f supabase/<file>.sql`. The linked project is the `Rithvik` Supabase project (not `rithvikpkx's Project` or `Grind-Catapult26` — there are three under the same org).

## File layout cheat sheet

```
app/
  layout.tsx          — force-dynamic root layout; fetches themes, renders ThemeStyleInjector + FOUC script + ThemeProvider + EditModeProvider + ThemeDial
  page.tsx            — fetches site_content; passes to Hero/Bento/Contact; renders all sections
  globals.css         — tokens, dial, rag chat (theme-independent), all the rest
  admin/
    actions.ts        — server actions for all tables (used by inline-editing flow)
    rag-actions.ts    — server actions: backfillPrimaryEmbeddings, list/upload/delete secondary docs
    auth-helper.ts    — shared requireAuth (used by actions.ts and rag-actions.ts)
  api/chat/route.ts   — HyDE expand → match_primary + match_secondary → gpt-4o-mini stream

components/
  Nav.tsx, Footer.tsx, Hero.tsx, Bento.tsx, Education(.tsx + Client.tsx),
  Projects(.tsx + Client.tsx), Experience(.tsx + Client.tsx), Contact.tsx
  EditModeProvider.tsx, InlineLoginPanel.tsx, EditBar.tsx
  EditableText.tsx, EditableTagList.tsx
  ThemeProvider.tsx, ThemeStyleInjector.tsx, ThemeDial.tsx
  FadeIn.tsx, KineticText.tsx, FlickeringGrid.tsx, TimelineBeam.tsx, LocalTime.tsx, EduLogo.tsx
  RagBot.tsx           — floating chat launcher + streaming chat panel (resizable, markdown)
  SimpleMarkdown.tsx   — hand-rolled markdown renderer used by bot replies
  SecondaryContextPanel.tsx  — edit-mode-only panel: list/upload/delete secondary docs + backfill

lib/
  supabase.ts         — clients (browser uses createBrowserClient)
  themes.ts           — token list, fallback tokens, buildThemeStyleSheet
  types.ts            — Project, Experience, Education, SiteContent, Theme, Database
  embeddings.ts       — OpenAI embed wrapper, chunker, row→text builders, upsert helpers
  file-extractors.ts  — PDF/DOCX/TXT/MD readers + gpt-4o-mini image captioner

plans/
  feat-inline-editing.md  — done (stages 1–8 shipped, merged to main as v1.1)
  feat-theme.md           — done (theme stage 8 polish + a11y complete)
  feat-rag-pipeline.md    — done (RAG pipeline shipped + IVFFlat/DOMMatrix/HyDE rescues)

explanations/
  rag-pipeline.md         — deep architectural reference for the RAG bot
```

## Pitfalls learned the hard way

### Theme / UI

- **Don't add a page-wide transition animation to the theme swap.** Two prior approaches were rolled back: (a) `document.startViewTransition` freezes the live DOM during the transition, so per-pill CSS rotation can't visibly play, and per-element `view-transition-name` pulls children out of their parent's `overflow: hidden` clipping while interpolating bounding boxes rather than transforms; (b) a custom glass-wash overlay with a delayed `data-theme` flip worked mechanically but read as visually busy. The instant flip + live pill rotation is the chosen architecture.
- **`setPointerCapture` on `pointerdown` breaks button clicks** — the click target is redirected from the inner button to the captured container. Only call `setPointerCapture` once you've confirmed an actual drag (movement past a threshold).
- **React's `onWheel` is passive from v17+** — `e.preventDefault()` doesn't work. To intercept the wheel for the theme dial cycling, attach via `addEventListener("wheel", h, { passive: false })` in a `useEffect`.
- **Auto-rotating the theme dial on first visit was rejected as too invasive.** The original idea was to expand the dial after a delay and cycle it to SynthWave '84 to introduce the picker. Even with a 10s delay and a narrowly-scoped abort, the page-wide color flip felt presumptuous — visitors had not asked for a theme change. The replacement is a subtle one-time wiggle on the dormant pill (3 cycles, ~1.8s, hover-paused), which signals "this is interactive" without forcing a color decision. Lesson: discoverability nudges should affect the affordance, not the underlying state.
- **Mounting an edit-mode-only component outside `<EditModeProvider>` 500s the entire route.** `useEditMode()` throws if no provider is above it in the tree, which crashes SSR for every visitor (not just authenticated editors). The previously-shipped `ThemeDemoSettings` panel triggered this and was rolled back. If you add a new component that calls `useEditMode()`, mount it INSIDE `<EditModeProvider>` (which wraps `{children}` in `app/layout.tsx`, not the theme dial siblings).
- **`force-dynamic` on the root layout is required when content can be changed via direct DB writes** (themes added through `supabase db query`). Without it, the homepage is statically generated at build time and stale DB state lingers until the next deploy. The cost is one extra Supabase fetch per request, which is negligible. The inline-editing flow already revalidates via `revalidatePath("/")`, but anything that bypasses server actions (raw SQL, dashboard inserts) needs this safety net.

### RAG (every one of these cost real debugging time)

- **`pgvector` IVFFlat with `lists` ≫ rows silently returns 0–1 chunks per query.** The initial migration used the published `lists = sqrt(rows)` heuristic and shipped with `lists = 100` — fine for ten thousand rows, catastrophic for the seventeen we had on day one. Each cluster ended up nearly empty; the default `ivfflat.probes = 1` searched a single cluster and almost always returned the seed row only. Symptom: empty `contextBlock`, then the chat model hallucinates wildly (Penn State / Michigan / fictional projects) because the system prompt's "refuse if not in context" rule wasn't enough to overcome a cost-optimized model's tendency to fill blanks. **Use HNSW** — no row-count-dependent parameter to tune, works correctly at any scale.
- **`pdf-parse@2.x` crashes on Vercel** at module evaluation: `ReferenceError: DOMMatrix is not defined`. The library transitively loads `pdfjs-dist`, which references the browser-only `DOMMatrix` global at the top of its module. Vercel's Node functions runtime doesn't expose it; local Node 24/25 does, so the issue only manifests in production. **Use `unpdf`** — same `pdfjs-dist` under the hood but ships the polyfills serverless needs.
- **Cost-optimized LLMs (DeepSeek, etc.) treat "don't fabricate" as a suggestion, not a rule.** Even with explicit "if not in context, refuse" wording at the top of the system prompt, DeepSeek would routinely invent plausible-sounding facts about Rithvik (wrong university, wrong GitHub handle, wrong projects). `gpt-4o-mini` follows the rule reliably for ~5x the cost (still pennies per month at our traffic). Lesson: model instruction adherence is a hard requirement for RAG; don't trade it away for a 5x cost saving on what's already a cheap workload.
- **Embedding similarity is not search.** A question like "where did rithvik study?" doesn't naturally embed close to a chunk that begins `Education: B.S. ...` — question form and statement form live in different parts of embedding space. Two fixes layered together: (1) rewrite chunk text as natural prose with the subject name visible (`Rithvik Praveen Kumar studies at Purdue...`); (2) **HyDE** — generate a 1–2 sentence hypothetical answer with `gpt-4o-mini`, concat with the question, embed the combo. Statement-form input embeds close to statement-form chunks. Both are required; either alone is insufficient.
- **Decouple "RPC succeeded" from "RPC returned data."** Supabase's JS client distinguishes thrown rejections from in-band `{ data: null, error }` responses. Our `unpack(label, res)` helper handles both, logging `[rag] ... rpc error:` so a missing function or RLS regression doesn't silently degrade to empty context. **Also**: even a successful RPC can return `[]` — the empty-context guard in `route.ts` short-circuits the LLM entirely in that case so the bot returns the canned refusal instead of hallucinating from training data.
- **`Promise.all` is wrong here; use `Promise.allSettled`.** Two parallel retrievals (primary + secondary) — if either rejects, `Promise.all` 500s the whole request. With `Promise.allSettled` + the unpack helper, one source can fail and the bot still answers from the other.
- **`safeEmbed` swallows embedding errors on inline-edit actions** so a transient OpenAI hiccup never undoes a user's save. The row is in the DB; if the embedding fails, the worst case is RAG sees a stale version of that one row until the next edit or the "Re-embed all primary content" backfill. `console.warn` (not `error`) so transient OpenAI 429s don't flood Vercel's error stream.
- **Vercel deployments are bundled separately per route.** During the `pdf-parse` DOMMatrix crash, the `/api/chat` endpoint kept working because it doesn't import `lib/file-extractors.ts`; only the server-actions bundle (which `app/admin/rag-actions.ts` loads into) was broken. So "the chat bot is alive" doesn't mean "all server actions work."

## Where to look first when something breaks

- Theme not switching → check the browser console for React errors from `ThemeProvider`. Check `localStorage.getItem("rithvik-theme")`. Try forcing `document.documentElement.dataset.theme = "rithvik-light"` in devtools to isolate CSS issues.
- Edit-mode save redirects to `/admin/login` → the browser client probably isn't `createBrowserClient` (cookie mismatch with server actions).
- Dial rotation doesn't animate → confirm `.theme-strip-option` still has `transition: transform 0.42s ...` and that pills do NOT have any `view-transition-name` style.
- A theme is missing from the dial → run `supabase/themes_migration.sql` (Rithvik themes) or `supabase/themes_add_editor_themes.sql` (editor themes). Verify with `SELECT slug, name, sort_order FROM themes ORDER BY sort_order;`. If the row exists in the DB but the dial doesn't show it, the layout's themes-fetch is probably stale-cached — the layout is `force-dynamic` so this shouldn't happen, but a Vercel preview that pre-dates that change would. Trigger a redeploy.
- **RAG bot hallucinating wildly** (wrong school, made-up projects) → the empty-context guard hasn't fired but retrieval is missing the relevant chunks. Check the rank: in Supabase SQL editor, embed the question via OpenAI manually and query `match_primary` with `match_count = 17`. If the right chunk is buried at rank 8+, HyDE expansion in `app/api/chat/route.ts` may have malfunctioned (check Vercel logs for `[rag] hyde failed`). Recovery: re-embed primary content from the panel to refresh chunks with the latest prose format.
- **RAG returns the canned "I don't have that specific detail"** for things you know are in the DB → `[rag] empty-context guard fired` will be in Vercel logs. Means BOTH `match_primary` AND `match_secondary` returned 0 rows. Most common cause is the pgvector index being misconfigured — verify it's HNSW not IVFFlat: `SELECT indexdef FROM pg_indexes WHERE tablename = 'primary_embeddings';`.
- **RAG returns 500 "Embedding failed"** → `OPENAI_API_KEY` missing or quota-exhausted. The chat-completion model is **`gpt-4o-mini`** (NOT DeepSeek anymore); embeddings, HyDE, image captioning, AND chat all use OpenAI.
- **RAG answers feel stale after inline edits** → confirm `safeEmbed` isn't silently failing — Vercel logs would show `[rag] ... embed skipped:` warnings. Recovery: open edit mode → SecondaryContextPanel → "Re-embed all primary content".
- **PDF upload fails on Vercel with a server-bundle crash** → `pdf-parse` crept back in somewhere via a dependency. We use `unpdf` because `pdf-parse@2`'s pdfjs-dist refers to `DOMMatrix` at module evaluation, which Vercel's Node runtime doesn't expose. `pdf-parse` MUST NOT be in `package.json`.
- **Secondary upload fails with "MIME type … not supported"** → add the type to `TEXT_MIMES`/`IMAGE_MIMES` or write a new extractor branch in `lib/file-extractors.ts`.
- **Secondary upload fails with "File produces N chunks (cap is 200)"** → the file is too long. Split it into smaller documents before uploading.
- **`match_primary` / `match_secondary` not found** → `supabase/rag_pipeline_migration.sql` wasn't applied, or was applied to a different Supabase project than the one in `.env.local`. Use `supabase db query --linked -f supabase/rag_pipeline_migration.sql` to re-apply (idempotent).
- **Secondary panel doesn't appear** → check `useEditMode().isEditing`. The panel self-gates; if you're not logged in via `InlineLoginPanel` it won't render.
- **Chat route logs `[rag] match_secondary rpc error:`** → the table or RPC is missing; reapply the migration. Note the chat route gracefully degrades (returns answers using only the source that worked) so the bot still responds.
- **Chat route logs `[rag] hyde failed`** → HyDE expansion errored (likely an OpenAI 429 or 401). Retrieval falls back to embedding the raw question — still works, just retrieval quality on question-form queries drops. Check `OPENAI_API_KEY` and quota.
