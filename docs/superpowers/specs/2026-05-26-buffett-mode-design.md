# Design: "For Warren Buffett" plain-HTML mode (+ theme removals)

**Date:** 2026-05-26
**Status:** Approved (pending spec review)

## Summary

Two changes to the portfolio:

1. **Remove two themes** — delete `monokai-pro-light` and `atom-one-light` from the
   theme picker.
2. **"For Warren Buffett" mode** — an easter-egg button (near the theme dial) that
   navigates to `/buffett`, a deliberately bare, animation-free HTML rendering of the
   same content, styled as a loving homage to the official Berkshire Hathaway website
   (`berkshirehathaway.com`). A return link makes round-tripping trivial.

---

## Part 1 — Remove two themes

`monokai-pro-light` and `atom-one-light` are both light themes (current `sort_order`
3 and 2). Remove them so the light group becomes: GitHub Light (default), Rithvik
Light, High Contrast Light.

- **DB:** new migration `supabase/themes_remove_themes.sql` —
  `DELETE FROM themes WHERE slug IN ('monokai-pro-light','atom-one-light');`
  (idempotent). Apply to the linked `Rithvik` project.
- **Source cleanup so a re-run can't resurrect them:**
  - `supabase/themes_add_more_themes.sql` — drop the `monokai-pro-light` INSERT and its
    `WHEN 'monokai-pro-light' THEN 3` line from the reorder CASE.
  - `supabase/themes_add_editor_themes.sql` — drop the `atom-one-light` INSERT.
- **No code change:** neither slug is in `FALLBACK_THEMES`. The dial reads `sort_order`
  dynamically, so gaps (0,1,4) are fine; no renumber needed.

---

## Part 2 — `/buffett` plain-HTML mode

### Architecture: multiple root layouts via route groups

Today `app/layout.tsx` is the single root layout and wraps **every** route with the
theme system (`ThemeStyleInjector`, FOUC boot script, `ThemeProvider`),
`EditModeProvider`, `InlineLoginPanel`, `EditBar`, and `ThemeDial`. A truly bare
`/buffett` must inherit none of that. Use Next.js **multiple root layouts**:

```
app/
  (site)/layout.tsx          ← today's app/layout.tsx, moved verbatim
  (site)/page.tsx            ← today's app/page.tsx, moved verbatim  → resolves to "/"
  (plain)/layout.tsx         ← NEW: minimal <html><body>, no providers/theme/chrome
  (plain)/buffett/page.tsx   ← NEW: the plain page
  layout.tsx                 ← REMOVED (each route group owns its <html>/<body>)
  globals.css                ← imported by (site)/layout.tsx only
  icon.tsx, apple-icon.tsx, opengraph-image.tsx, api/, auth/  ← unchanged, stay at app root
```

- Route groups don't affect URLs: `(site)/page.tsx` → `/`, `(plain)/buffett/page.tsx`
  → `/buffett`.
- Crossing between the two root layouts triggers a **full document load** (Next.js
  behavior for multiple root layouts) — desirable here: `/buffett` loads pristine with
  none of the main site's JS, motion, globe, RAG, or composer; returning to `/` is a
  fresh load too.
- `(plain)/layout.tsx` sets its own `metadata`, `<html lang>`, `<body>`, and does NOT
  import `globals.css` (keeps it free of theme tokens). Any minimal reset lives inline
  on the page.

**Risk note:** moving `app/layout.tsx` and `app/page.tsx` into `(site)/` is mechanical
but touches the most critical files. Verify `/` renders unchanged (theme dial, edit
mode, sections, overlays) and `next build` succeeds before merge.

### The `/buffett` page

A **server component** that runs the same Supabase queries used today and renders plain
semantic HTML with a small inline `<style>` mimicking the Berkshire screenshot.

Data sources (reuse existing query shapes):
- `site_content` — `hero.name.{line1,line2}`, `hero.tagline`, `hero.sub_line`,
  `contact.{headline,sub}`, `contact.link.{github,linkedin,email}`,
  `bento.{building,stack,interests}`, `bento.globe_markers` (for a location line).
- `education`, `projects`, `experience` tables (filter `published`, order `sort_order`),
  same as `components/Education.tsx`/`Projects.tsx`/`Experience.tsx`.

Page structure (top to bottom):
1. **Return bar (top):** a prominent `← Return to the full site` link (`<a href="/">`).
2. **Header block:** centered serif — **RITHVIK PRAVEEN KUMAR**, a tagline/"address"
   line (tagline + location), "Personal Home Page".
3. `<hr>` then a **two-column anchor index** (About · Education · Projects · Experience ·
   Contact · GitHub · LinkedIn · Email) — in-page `#anchor` jumps, like Berkshire's link
   grid.
4. `<hr>` then content sections in plain HTML, each with an `<h2 id>`:
   - **About** — name, tagline, sub-line, building/stack/interests as plain text/lists.
   - **Education** — school (linked), degree, concentrations.
   - **Projects** — per project: title, bullet description (split on newline), tags, links.
   - **Experience** — per entry: role @ org (linked), date range, location, bullet
     description, tags.
   - **Contact** — headline/sub + GitHub/LinkedIn/Email links (email as `mailto:`).
5. `<hr>` **footer:** another `← Return to the full experience` link, copyright line,
   and a small "Inspired by the official Berkshire Hathaway website" note.

Styling (inline `<style>` scoped to this page): serif headings, monospace sub-text,
classic underlined blue/purple/red links, generous line rules (`<hr>`), no JS, no
external fonts. Plain, fast, accessible.

### The button (main site)

A small control rendered beside the theme dial (in/next to `ThemeDial.tsx`, which lives
in `(site)/layout.tsx`):
- Markup: `<a href="/buffett">For Warren Buffett</a>` styled as a small pill/link. A real
  anchor so it does a genuine navigation into the `(plain)` root layout.
- **Tooltip on hover/focus:** a bubble reading
  *"Inspired by the official berkshire hathaway website"* (CSS-driven, like existing
  tooltips; `:hover`/`:focus-visible`).
- Only appears on the main site (it's in the `(site)` layout; the `(plain)` layout has no
  dial), so no pathname guard needed.

---

## Out of scope (YAGNI)

- No persistence/remember-my-choice — it's a per-visit toy; the URL is the state.
- No editing on `/buffett` (read-only view).
- No theme awareness on `/buffett` — it's intentionally one fixed bare look.
- No new tables or env vars.

## Verification

- `tsc --noEmit` clean; `eslint` clean on touched files.
- `next build` succeeds (route-group restructure is the main risk).
- Manual: `/` renders identically to before (dial, edit mode, sections, RAG/composer);
  `/buffett` renders bare content with working anchor links and return links; the button
  + tooltip work; Back button round-trips.
- DB: removal migration applied; `SELECT slug FROM themes` no longer lists the two.
