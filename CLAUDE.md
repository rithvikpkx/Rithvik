# CLAUDE.md

Guidance for Claude Code when working in this repo. Project: a personal portfolio for **Rithvik Praveen Kumar**, deployed to [rithvik.ai](https://rithvik.ai), built as a one-stop showcase plus an experimental playground for live editing + an AI chatbot.

## Stack

- **Next.js 16** (App Router), React 19, TypeScript, Tailwind v4 (CSS in `app/globals.css`)
- **Supabase** (Postgres + Auth) — `@supabase/ssr` for cookie-based sessions, `@supabase/supabase-js` server admin client
- **Motion** (`motion/react`) for animation
- **LangChain** (`@langchain/openai`) for the planned RAG bot in `app/api/chat`
- Deployed on **Vercel** (`dev` branch deploys preview, `main` deploys production)

Node 22, package manager: npm. `npm run dev` / `npm run build` / `npm run lint`.

## Rules (carried from earlier)

- Keep design philosophy simple. Architecture minimal and clean.
- Each function: 1–2 sentence description as a comment.
- Confusing or non-obvious lines: 1 short inline comment explaining WHY.
- Develop in **vertical slices** across the full stack — keep work visible and testable end-to-end.
- Self-test before claiming done. `node_modules/.bin/tsc --noEmit` is the cheapest gate; visual check on Vercel preview is the next.

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

So **adding a new theme is one DB row** — define the 7 primary tokens and every surface adapts automatically. No CSS changes required.

At SSR, `ThemeStyleInjector` renders one `<style id="theme-tokens">` block containing `:root[data-theme="<slug>"] { … }` for every theme. The active theme is set on `<html data-theme="…">` by:
1. `<html data-theme="rithvik-dark">` hardcoded in JSX (works with JS disabled).
2. An inline boot script at the top of `<body>` that reads `localStorage[rithvik-theme]` and overwrites the attribute **before first paint** — no FOUC.

`ThemeProvider` wraps the app, exposes `useTheme()` → `{ themes, currentSlug, setTheme }`. `setTheme` swaps `currentSlug` + `data-theme` + `localStorage` synchronously and mounts a `<ThemeWash>` overlay (keyed for restart on rapid clicks). A cancelable timer unmounts the wash ~620ms later.

### Theme transition (overlay wash, live-DOM rotation)

There are two independent animations playing simultaneously, both in the live DOM — **no View Transitions API**. Earlier versions used `document.startViewTransition`; it broke the dial (per-element groups got pulled out of the dial's `overflow: hidden` clipping, and the API interpolates bounding boxes rather than transforms, so the pill rotation didn't visibly play).

- **`ThemeWash`** (`components/ThemeWash.tsx` + `.theme-wash` keyframes in `globals.css`) — fixed full-viewport `<div>` with a radial-mask wave sweeping from `circle at 0% 50%` (the dial origin) over 500ms. Wave fill uses the incoming theme's `bg`/`accent` set inline as `--wash-bg` / `--wash-accent`. `z-index: 195`. Remounted via React `key` so the animation restarts cleanly on rapid clicks.
- **Dial rotation** (`.theme-strip-option { transition: transform 0.42s cubic-bezier(0.32, 0.72, 0, 1) }`) — each pill's `transform: translate(0, calc(-50% + Y)) rotate(Xdeg)` recomputes when `selectedIdx` changes; CSS interpolates it. The whole fan rotates as one cohesive unit.

Layering: `.theme-dial-aside` is at `z-index: 200` so the dial sits **above** the wash and stays visibly rotating while the wave passes under it. The dial's `overflow: hidden` half-pill shape clips the pills throughout — no detachment.

`prefers-reduced-motion` swaps the wash for a quick fade (`@keyframes theme-wash-fade`) and zeros the pill transition durations (existing rule at the bottom of the dial CSS block).

### Inline editing (`feat-inline-editing.md`, completed)

- `EditModeProvider` (client) owns `isEditing`, `panelOpen`, Supabase session, login/logout
- Session policy: stays alive **per tab** (`sessionStorage` flag `rithvik-tab-auth`); closing the tab clears it so the next tab requires fresh login. The Supabase session itself is not signed out on "exit edit mode" — so re-entering the dial doesn't reopen the login panel
- `InlineLoginPanel` — top-right glass card, springs from the nav button
- `EditBar` — bottom floating indicator with "Exit editing"
- `EditableText` — `contentEditable` wrapper, saves on blur, Escape reverts, Enter blurs unless `multiline`
- `EditableTagList` — chip editor (× on each, input adds on Enter/comma/blur)
- Server actions in `app/admin/actions.ts` — `createProject/updateProject/deleteProject`, same for Experience, `updateEducation`, `upsertSiteContent`. Every action calls `requireAuth()` (reads cookie session) and `revalidatePath("/")`

### Important Supabase gotcha

The browser client in `lib/supabase.ts` MUST be `createBrowserClient` from `@supabase/ssr` (NOT `createClient` from `@supabase/supabase-js`). Only the SSR version stores sessions in cookies — the plain client uses localStorage, which server actions can't read, so `requireAuth()` would redirect every save call to `/admin/login`. This was a real bug.

## Database

Tables (all in Supabase public schema):

- `projects` — portfolio projects
- `experience` — timeline rows
- `education` — schools (single-row Purdue today)
- `site_content` — key/value JSONB store for hardcoded text that became editable (`hero.tagline`, `hero.sub_line`, `bento.location`, `bento.building`, `bento.stats`, `bento.stack`, `bento.interests`, `contact.headline`, `contact.sub`, optional `contact.link.{github,linkedin,email}`)
- `themes` — `{ slug, name, tokens (JSONB), sort_order, published }`. Currently seeded: Rithvik Dark, Rithvik Light, Rithvik Terminal

RLS: all tables `SELECT` public; INSERT/UPDATE/DELETE use the service-role key only in server actions.

### Migration files (apply via Supabase SQL editor)

- `supabase/stage3_migration.sql` — education table + site_content seed (inline-editing stage 3)
- `supabase/themes_migration.sql` — themes table + Dark/Light/Terminal seed (idempotent ON CONFLICT)
- `supabase/themes_add_terminal.sql` — UPSERT just the Terminal row (run if other themes already exist)

## File layout cheat sheet

```
app/
  layout.tsx          — fetches themes, renders ThemeStyleInjector + FOUC script + ThemeProvider + EditModeProvider
  page.tsx            — fetches site_content; passes to Hero/Bento/Contact; renders all sections
  globals.css         — tokens, dial, .theme-wash keyframes, all the rest
  admin/
    actions.ts        — server actions for all tables (still used; the /admin UI pages are deprecated)
    login/, logout/   — legacy pages, replaced by InlineLoginPanel; kept for fallback
    page.tsx          — legacy dashboard, deprecated
  api/chat/           — RAG bot endpoint (in progress)

components/
  Nav.tsx, Footer.tsx, Hero.tsx, Bento.tsx, Education(.tsx + Client.tsx),
  Projects(.tsx + Client.tsx), Experience(.tsx + Client.tsx), Contact.tsx
  EditModeProvider.tsx, InlineLoginPanel.tsx, EditBar.tsx
  EditableText.tsx, EditableTagList.tsx
  ThemeProvider.tsx, ThemeStyleInjector.tsx, ThemeDial.tsx, ThemeWash.tsx
  FadeIn.tsx, KineticText.tsx, FlickeringGrid.tsx, TimelineBeam.tsx, LocalTime.tsx, EduLogo.tsx
  RagBot.tsx          — chatbot UI (the brain is in app/api/chat)

lib/
  supabase.ts         — clients (browser uses createBrowserClient)
  themes.ts           — token list, fallback tokens, buildThemeStyleSheet
  types.ts            — Project, Experience, Education, SiteContent, Theme, Database

plans/
  feat-inline-editing.md  — done (stages 1–8 shipped, merged to main as v1.1)
  feat-theme.md           — stages 1–7 done; stage 8 (mobile polish + cleanup) remains
```

## Pitfalls learned the hard way

- **Don't use `document.startViewTransition` for the theme swap** — it freezes the live DOM behind snapshot pseudo-elements, so CSS transitions on `.theme-strip-option` don't visibly play. Per-pill `view-transition-name` also pulls each pill out of the dial's `overflow: hidden` clipping (named groups are NOT clipped by their parent's overflow), and the API interpolates bounding boxes rather than transforms — pills snap to the new rotation at t=0 and only slide linearly. Use the overlay-wash approach in `ThemeProvider` instead.
- **`setPointerCapture` on `pointerdown` breaks button clicks** — the click target is redirected from the inner button to the captured container. Only call `setPointerCapture` once you've confirmed an actual drag (movement past a threshold).
- **React's `onWheel` is passive from v17+** — `e.preventDefault()` doesn't work. To intercept the wheel for the theme dial cycling, attach via `addEventListener("wheel", h, { passive: false })` in a `useEffect`.
- **CSS variables aren't animatable** unless you declare `@property --name { syntax: '<percentage>'; … }`. The wash uses this for `--wash-pos`.
- **Restart a CSS animation via React `key` bump** — the wash element is keyed on a counter incremented per `setTheme` call so rapid clicks remount it and the 500ms keyframes replay from 0%.
- **Dial z-index must sit above the wash** — wash is at `195`, dial-aside at `200`. Otherwise the wave covers the dial mid-rotation.

## Dead / legacy code

- `app/admin/{login,logout,page.tsx,ExperienceManager.tsx,ProjectManager.tsx}` — pre-inline-editing dashboard. Kept as fallback while the inline flow stabilizes; safe to delete once happy.

## Where to look first when something breaks

- Theme not switching → check the browser console for React errors from `ThemeProvider`. Check `localStorage.getItem("rithvik-theme")`. Try forcing `document.documentElement.dataset.theme = "rithvik-light"` in devtools to isolate CSS issues.
- Edit-mode save redirects to `/admin/login` → the browser client probably isn't `createBrowserClient` (cookie mismatch with server actions).
- Wash overlay missing or doesn't restart on rapid clicks → check that `ThemeProvider` is bumping `washKeyRef.current` and passing it as `<ThemeWash key={...} />`. Verify `--wash-bg` / `--wash-accent` are set inline on the wash element.
- Dial rotation doesn't animate → confirm `.theme-strip-option` still has `transition: transform 0.42s ...` and that pills do NOT have any `view-transition-name` style.
- Wave covers the dial mid-transition → `.theme-dial-aside` `z-index` must be above `.theme-wash` (200 vs 195).
- A theme is missing from the dial → run `supabase/themes_migration.sql` (or `themes_add_terminal.sql` for just Terminal). Verify with `SELECT slug FROM themes;`.

## What's still open

- Feat-theme **stage 8** — mobile polish, accessibility verification, cleanup of any remaining dead code.
- RAG bot — `api/chat` route + `RagBot.tsx` UI; not yet integrated end-to-end.
- Decision pending on whether to remove the legacy `/admin/*` pages entirely.
