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

`ThemeProvider` wraps the app, exposes `useTheme()` → `{ themes, currentSlug, setTheme }`. `setTheme` writes `localStorage` and updates `currentSlug` immediately (driving the dial rotation), but **defers** flipping `<html data-theme>` until the wash overlay has fully covered the viewport. A cancelable timer unmounts the wash after ~800ms.

### Theme transition (delayed-swap overlay wash + live-DOM rotation)

Two parallel animations, both in the live DOM. **No View Transitions API** — the spec suppresses live painting of every named element during a transition, which made the physical dial rotation impossible to see. Instead we fake the "old ahead / new behind" effect with a glass overlay that masks the moment of the actual page swap.

- **Dial rotation** (`.theme-strip-option { transition: transform 0.42s cubic-bezier(0.32, 0.72, 0, 1) }`) — each pill's `transform: translate(0, calc(-50% + Y)) rotate(Xdeg)` recomputes whenever `selectedIdx` changes; CSS interpolates it. Because `currentSlug` updates synchronously on click, the rotation starts immediately in parallel with the wash.
- **`ThemeWash`** (`components/ThemeWash.tsx` + `.theme-wash` keyframes in `globals.css`) — fixed full-viewport `<div>` with:
  - **Radial gradient background** sweeping from `circle at 0% 50%` (dial origin). Behind the wave: a translucent tint of the incoming `--wash-bg`. At the wave front: a thin oil-slick rim (accent → white-accent → accent) acting as the glass crest. Ahead of the wave: fully transparent.
  - **Radial mask** in lockstep with the gradient. Behind = opaque, ahead = transparent. This is what makes the boundary between "swept" and "unswept" regions look like a sharp wave front.
  - **`backdrop-filter`** stacks an **SVG `feTurbulence` + `feDisplacementMap`** filter (`#wash-glass`, defined inline inside `ThemeWash`) before the CSS chain (`blur(22px) saturate(185%) brightness(1.04) hue-rotate(4deg)`). The SVG filter is what actually warps content beneath like real glass — CSS `blur` alone only softens, doesn't bend.
- **Timing** (`@keyframes theme-wash`, 720ms total):
  - 0–8%: opacity fades in while wave is still a dot at the dial.
  - 8–50%: wave sweeps `--wash-pos` from 0% to 110% (just past the viewport's far corner). Overlay opaque the whole time.
  - **At ~50% (360ms in)**: `ThemeProvider`'s `setTimeout` flips `<html data-theme>` to the new slug. The swap is invisible because the overlay is fully opaque everywhere by now.
  - 50–75%: wave keeps expanding (135%) to hold the viewport firmly inside the opaque zone.
  - 75–100%: opacity fades out. The page underneath is now in the new theme, matching what the overlay was already painting — no flash.

Layering: `.theme-dial-aside` is at `z-index: 200`, wash at `195`. The dial sits **above** the wash and stays visibly rotating while the wave passes beneath it. The dial's `overflow: hidden` half-pill shape clips the pills throughout — no detachment.

Why we don't literally render two themes simultaneously: it would require either duplicating the entire React tree under a scoped `data-theme` (heavy + breaks interactivity) or a runtime page-snapshot library like html2canvas (slow, fragile). The overlay approach is a perceptual fake — the heavy `backdrop-filter` makes content beneath the wave unrecognizable enough that swapping `data-theme` underneath is imperceptible.

`prefers-reduced-motion`: `ThemeProvider` short-circuits and applies the theme synchronously without mounting the wash. (`.theme-wash` also has a reduced-motion fallback as defense-in-depth.)

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
- **CSS `blur()` does not warp content; only soften it.** For real glass-style bending you need an SVG `feDisplacementMap` driven by `feTurbulence`, referenced from CSS via `backdrop-filter: url(#filter-id)`. The SVG filter def must be in the DOM when the CSS runs (we put it inside `ThemeWash` itself so it mounts/unmounts with the wash).
- **Decouple `currentSlug` from `<html data-theme>` when you need the dial to react before the page does.** `currentSlug` drives the dial's React render (pills rotate via CSS transition). `data-theme` drives every CSS-var-themed style. Updating them on different schedules is what lets the dial rotate live while the page swap is hidden behind the overlay.
- **`setPointerCapture` on `pointerdown` breaks button clicks** — the click target is redirected from the inner button to the captured container. Only call `setPointerCapture` once you've confirmed an actual drag (movement past a threshold).
- **React's `onWheel` is passive from v17+** — `e.preventDefault()` doesn't work. To intercept the wheel for the theme dial cycling, attach via `addEventListener("wheel", h, { passive: false })` in a `useEffect`.
- **CSS variables aren't animatable** unless you declare `@property --name { syntax: '<percentage>'; … }`. The wash uses this for `--wash-pos`.
- **Restart a CSS animation via React `key` bump** — the wash element is keyed on a counter incremented per `setTheme` call so rapid clicks remount it and the keyframes replay from 0%.
- **Dial z-index must sit above the wash** — wash is at `195`, dial-aside at `200`. Otherwise the wave covers the dial mid-rotation.
- **Cancel pending timers on every `setTheme` re-entry.** ThemeProvider holds refs to both the `data-theme`-apply timer and the wash-clear timer, and clears them on each new call. Without this, rapid clicks would let an earlier timer fire after the next transition started and overwrite `data-theme`.

## Dead / legacy code

- `app/admin/{login,logout,page.tsx,ExperienceManager.tsx,ProjectManager.tsx}` — pre-inline-editing dashboard. Kept as fallback while the inline flow stabilizes; safe to delete once happy.

## Where to look first when something breaks

- Theme not switching → check the browser console for React errors from `ThemeProvider`. Check `localStorage.getItem("rithvik-theme")`. Try forcing `document.documentElement.dataset.theme = "rithvik-light"` in devtools to isolate CSS issues.
- Edit-mode save redirects to `/admin/login` → the browser client probably isn't `createBrowserClient` (cookie mismatch with server actions).
- Wash overlay missing or doesn't restart on rapid clicks → check that `ThemeProvider` is bumping `washKeyRef.current` and passing it as `<ThemeWash key={...} />`. Verify `--wash-bg` / `--wash-accent` are set inline on the wash element.
- Wash isn't warping content (just blurs it) → the SVG filter inside `ThemeWash` may not be in the DOM, or `backdrop-filter: url(#wash-glass)` failed. Check devtools for the `<svg className="theme-wash-defs">` element while the wash is mounted. Some browsers also drop the whole `backdrop-filter` chain if any one filter fails to resolve — the `-webkit-backdrop-filter` line is the bare CSS fallback.
- Page flashes from old → new at the wave's mid-point → the `data-theme` apply timer is firing while the overlay isn't fully opaque yet. Check `THEME_APPLY_DELAY_MS` in `ThemeProvider` matches the keyframe `%` at which the wash is at peak opacity AND `--wash-pos ≥ 110%`.
- Dial rotation doesn't animate → confirm `.theme-strip-option` still has `transition: transform 0.42s ...` and that pills do NOT have any `view-transition-name` style.
- Wave covers the dial mid-transition → `.theme-dial-aside` `z-index` must be above `.theme-wash` (200 vs 195).
- A theme is missing from the dial → run `supabase/themes_migration.sql` (or `themes_add_terminal.sql` for just Terminal). Verify with `SELECT slug FROM themes;`.

## What's still open

- Feat-theme **stage 8** — mobile polish, accessibility verification, cleanup of any remaining dead code.
- RAG bot — `api/chat` route + `RagBot.tsx` UI; not yet integrated end-to-end.
- Decision pending on whether to remove the legacy `/admin/*` pages entirely.
