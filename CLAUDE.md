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

`ThemeProvider` wraps the app, exposes `useTheme()` → `{ themes, currentSlug, setTheme }`. `setTheme` writes `data-theme`, mirrors to `localStorage`, and **wraps the change in `document.startViewTransition`** so the swap animates via the View Transitions API. `flushSync(setCurrentSlug)` inside the callback so React commits the dial state synchronously and lands in the NEW snapshot.

### Theme transition (View Transitions API)

The transition is implemented entirely in CSS on view-transition pseudo-elements (`app/globals.css` — section "THEME VIEW TRANSITION"):

- `::view-transition-old(root)` stays fully opaque underneath
- `::view-transition-new(root)` reveals with a radial mask sweeping from the dial position (`circle at 0% 50%`), animated via a `@property --vt-reveal: <percentage>` so the mask radius interpolates smoothly
- Filter (blur/saturate/brightness/hue-rotate) decays to identity by 50% of the 900ms timeline so there's no lingering blur at the handoff
- Each theme pill carries `viewTransitionName: theme-pill-<slug>` so the browser interpolates each pill's position/rotation from OLD to NEW (the "fan re-arrangement" plays on screen during the transition)
- `.theme-dial-content` has `view-transition-name: theme-dial-shell` so the glass shell stays visible — without this the shell is inside the root snapshot and gets hidden behind the wave mask at the start, leaving pills floating
- A default `::view-transition-old(*) / new(*)` rule kills the pseudo-element crossfade for all groups (show new immediately, hide old) so pills don't ghost as two stacked images
- `prefers-reduced-motion` skips the transition entirely (`document.startViewTransition` check + CSS reset)

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
  globals.css         — tokens, dial, view-transition pseudo-element styling, all the rest
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
  ThemeProvider.tsx, ThemeStyleInjector.tsx, ThemeDial.tsx
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

- **View Transitions + per-element `view-transition-name`**: each element with a name gets pulled out of its parent's snapshot. It is **not** clipped by the parent's `overflow: hidden`. If you don't want pills floating outside the dial container, the container also needs its own `view-transition-name`.
- **View Transitions default crossfade**: `::view-transition-old/new` fade over 250ms by default. With per-element groups, this stacks two ghostly images at the same interpolated position. Kill it with `::view-transition-old(*) { animation: none; opacity: 0 } / ::view-transition-new(*) { animation: none; opacity: 1 }`.
- **`setPointerCapture` on `pointerdown` breaks button clicks** — the click target is redirected from the inner button to the captured container. Only call `setPointerCapture` once you've confirmed an actual drag (movement past a threshold).
- **`flushSync` inside `startViewTransition` callback** — without it React commits state on the next tick, AFTER the NEW snapshot is taken, so the new selection doesn't appear in the transition.
- **React's `onWheel` is passive from v17+** — `e.preventDefault()` doesn't work. To intercept the wheel for the theme dial cycling, attach via `addEventListener("wheel", h, { passive: false })` in a `useEffect`.
- **CSS variables aren't animatable** unless you declare `@property --name { syntax: '<percentage>'; … }`. The theme transition uses this for `--vt-reveal`.

## Dead / legacy code

- `components/ThemeWash.tsx` — leftover from an earlier overlay-based theme transition that was abandoned for the View Transitions API approach. Not imported anywhere; safe to delete.
- `app/admin/{login,logout,page.tsx,ExperienceManager.tsx,ProjectManager.tsx}` — pre-inline-editing dashboard. Kept as fallback while the inline flow stabilizes; safe to delete once happy.

## Where to look first when something breaks

- Theme not switching → check the browser console: is `document.startViewTransition` defined? Check `localStorage.getItem("rithvik-theme")`. Try forcing `document.documentElement.dataset.theme = "rithvik-light"` in devtools to isolate CSS issues.
- Edit-mode save redirects to `/admin/login` → the browser client probably isn't `createBrowserClient` (cookie mismatch with server actions).
- Theme dial pills look "broken" mid-transition → check that `.theme-dial-content` has `view-transition-name: theme-dial-shell` and that the `::view-transition-old(*) / new(*)` no-crossfade defaults are in `globals.css`.
- A theme is missing from the dial → run `supabase/themes_migration.sql` (or `themes_add_terminal.sql` for just Terminal). Verify with `SELECT slug FROM themes;`.

## What's still open

- Feat-theme **stage 8** — mobile polish, accessibility verification, cleanup of any remaining dead code.
- RAG bot — `api/chat` route + `RagBot.tsx` UI; not yet integrated end-to-end.
- Decision pending on whether to remove the legacy `/admin/*` pages entirely.
