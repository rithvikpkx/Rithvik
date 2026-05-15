# feat-theme — Development Plan

## Overview

Add a premium, tactile half-radial theme selector anchored to the left edge of the viewport. Half the dial protrudes into the page; the rest sits off-screen. Visitors can click, drag-rotate, scroll-wheel, or use the keyboard to cycle between site-wide color themes — the entire palette transitions smoothly. Themes are stored as design-token objects in Supabase so adding a new palette later is one DB row, not a code change.

V1 ships with two themes — **Rithvik Dark** (current site) and **Rithvik Light** (same accents, light backgrounds). The architecture supports N themes; the dial scales gracefully.

---

## Goals

- Premium glass dial that feels like a physical knob (not a flat menu)
- Three interaction methods: click, drag-rotate, scroll-wheel — plus keyboard
- DB-backed themes for extensibility (new theme = new row, no code)
- Smooth, screen-wide palette transitions (no jarring color swap)
- Persisted user choice in localStorage; respects choice across reloads
- Responsive: mini-dial variant on small screens, same interaction model
- Accessible: focusable, ARIA-labeled, keyboard-navigable
- No flash-of-wrong-theme on page load (FOUC-free)

## Non-Goals (v1)

- Inline admin CRUD for themes — themes are seeded via SQL/migration only
- Color-picker UI for creating themes from the browser
- Per-section theme overrides
- Automatic theme based on time of day

---

## Decisions Locked In (from clarifying questions)

| Decision | Choice |
|---|---|
| Dial selection model | Rotating dial with a fixed pointer at the top of the visible arc; selected option lines up under the pointer |
| First-visit behavior | Always start on Rithvik Dark |
| Persistence | User's manual selection is saved to localStorage and survives reloads |
| Scope | Visitor dial + 2 seeded themes; no inline admin theme CRUD |
| Mobile behavior | Mini-dial — smaller radius, same interaction model |

---

## Themes at Launch

### Rithvik Dark (default)
The current site palette, untouched. Becomes one row in the `themes` table with `slug = "rithvik-dark"`.

### Rithvik Light
A light-mode palette using the **same brand accents** (pink/red `--accent`, gradient colors, Purdue gold). Backgrounds invert; text and borders adjust for contrast. Proposed initial values (subject to refinement during implementation):

| Token | Dark value | Light value (proposed) |
|---|---|---|
| `--bg` | `#0b0908` | `#fafaf7` |
| `--text` | `#ffffff` | `#0e0b0a` |
| `--muted` | `rgba(255,255,255,0.55)` | `rgba(14,11,10,0.6)` |
| `--card` | `rgba(255,255,255,0.025)` | `rgba(255,255,255,0.7)` |
| `--card-hover` | `rgba(255,255,255,0.045)` | `rgba(255,255,255,0.95)` |
| `--border` | `rgba(255,255,255,0.08)` | `rgba(14,11,10,0.08)` |
| `--border-hover` | `rgba(255,255,255,0.18)` | `rgba(14,11,10,0.16)` |
| `--accent` | unchanged | unchanged |
| `--accent-glow` | unchanged | slightly lighter overlay if needed |
| Hero flickering grid color | `#ffffff` (particles) | `#0e0b0a` (dark particles on light bg) |
| Nav glass tint | dark translucent | light translucent |

Final Light-theme values get tuned during implementation against every section.

---

## Architecture

### Token strategy

CSS custom properties (variables) on `:root` are the source of truth for all themable values. They're already in `app/globals.css` today; we'll consolidate every theme-dependent color into the var set.

Each theme is a flat key→value map of CSS variable values. Applying a theme = swapping the values of those vars at the document root.

We use a **server-rendered `<style>` block** containing all themes' selectors, plus an `data-theme` attribute on `<html>` that picks which selector wins:

```html
<style id="theme-tokens">
  :root[data-theme="rithvik-dark"]  { --bg: #0b0908; --text: #fff; /* … */ }
  :root[data-theme="rithvik-light"] { --bg: #fafaf7; --text: #0e0b0a; /* … */ }
</style>

<html data-theme="rithvik-dark">
```

To swap themes, JS just sets `document.documentElement.dataset.theme = slug`. No re-render, no inline style writes, no FOUC.

### FOUC prevention

A tiny inline script in `<head>` reads `localStorage` and sets `data-theme` on `<html>` before any React hydration. This avoids a flash of the default theme when a visitor's saved choice is different.

```html
<script>
  try {
    var t = localStorage.getItem("rithvik-theme") || "rithvik-dark";
    document.documentElement.dataset.theme = t;
  } catch (_) {}
</script>
```

Injected via Next.js `app/layout.tsx`.

### Database schema

New `themes` table:

```sql
CREATE TABLE themes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,        -- "rithvik-dark"
  name        TEXT NOT NULL,               -- "Rithvik Dark"
  tokens      JSONB NOT NULL,              -- { "bg": "#0b0908", "text": "#fff", ... }
  sort_order  INT DEFAULT 0,
  published   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read themes" ON themes FOR SELECT USING (true);
```

Seed with two rows: `rithvik-dark` and `rithvik-light`.

### Data flow

```
Server (page.tsx)
  └─ serverClient().from("themes").select("*").order("sort_order")
       │
       ├─ Pass themes to ThemeProvider via props
       │
       └─ Server-render <style id="theme-tokens"> containing all themes' CSS

Client
  ├─ Inline FOUC script sets data-theme before hydration
  ├─ ThemeProvider exposes { themes, currentSlug, setTheme }
  ├─ ThemeDial reads from ThemeProvider, calls setTheme(slug)
  └─ setTheme writes data-theme attribute + localStorage
```

No client-side fetch needed after initial load — themes are bundled into the SSR'd HTML.

### Token enumeration

During implementation, every theme-dependent CSS variable in `globals.css` is enumerated and added to the `tokens` JSON shape. Static tokens (fonts, border-radius, animation timings) stay outside the theme system.

Initial pass — themable tokens:
- `--bg`, `--text`, `--muted`
- `--card`, `--card-hover`
- `--border`, `--border-hover`
- `--accent`, `--accent-glow`, `--accent-rgb`
- Nav glass tint, scroll indicator color
- Hero flickering-grid particle color
- Code/mono background if any
- Shadow values that are color-dependent

---

## Dial Component

### Geometry

- **Shape**: full circle, but positioned so only the right half is visible
- **Position**: `position: fixed`; horizontal: centered on `left: 0` (so the circle's leftmost half is off-screen); vertical: viewport center
- **Radius**: `clamp(140px, 18vw, 180px)` on desktop; `clamp(80px, 22vw, 110px)` on mobile
- **Options**: distributed along the visible 180° arc; for N options, angles at `-90° + (i+1)/(N+1) * 180°` so they're inset from the top/bottom edges
- **Fixed pointer**: at the rightmost point of the dial (3 o'clock equivalent), inside the viewport — small accented marker that doesn't move
- **Rotation**: applied to the dial face (and the options on it); the pointer stays fixed

### Visual style

- Glass surface: `backdrop-filter: blur(18px)`, semi-transparent fill, thin border, layered inner highlight
- Inner ring with subtle radial gradient suggesting curvature
- Each option: small color swatch (the theme's `--accent` color, or a mini palette of `bg + text + accent` stacked) — readable label appears on hover/focus as a tooltip
- Selected option: scaled up slightly + accent glow ring; snaps under the pointer on selection
- Subtle drop shadow + accent shadow on the right side (where it protrudes)
- All styling honors the *current* theme — i.e., the dial itself recolors when the theme changes

### Interactions

| Method | Behavior |
|---|---|
| **Click on option** | Dial rotates so the clicked option aligns with the pointer; `setTheme(slug)` fires after rotation |
| **Drag** | Pointer-down on the dial face → as user drags, dial follows the rotation continuously (compute angle from drag delta around dial center). On release, snap to the nearest option's angular position with a spring; `setTheme` fires on snap |
| **Scroll wheel** | When mouse is over the dial, wheel events step one option at a time and prevent page scroll. Cooldown (e.g. 150ms) between steps so a single flick doesn't fly past every theme |
| **Keyboard** | Tab to focus the dial; Arrow Up/Left = previous theme, Arrow Down/Right = next theme, Enter/Space = no-op (selection is implicit on arrow press) |
| **Touch (mobile)** | Drag works identically via pointer events. Tap on an option behaves like click |

### Snap behavior

- During drag, dial rotation follows the cursor freely (no constraint)
- On pointer-up, compute nearest option angle and animate the dial to it using a spring (motion's `useSpring` or similar): stiffness ~200, damping ~28
- `setTheme(slug)` is called exactly once per release, when the snap target is determined
- For click and wheel, the same snap animation is used so all paths feel identical

### Theme transition (page-wide)

When `data-theme` changes, every theme-bound color property should transition smoothly. We add a global CSS rule:

```css
*,
*::before,
*::after {
  transition:
    background-color 280ms cubic-bezier(0.4, 0, 0.2, 1),
    color 280ms cubic-bezier(0.4, 0, 0.2, 1),
    border-color 280ms cubic-bezier(0.4, 0, 0.2, 1),
    fill 280ms cubic-bezier(0.4, 0, 0.2, 1),
    stroke 280ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

Caveat: applying `transition` to `*` is heavy. We may scope this to a `[data-theme-transitioning="true"]` attribute on `<html>` that's only set briefly during theme changes — eliminates ongoing performance impact during normal interactions.

---

## File / Component Structure

```
components/
  ThemeProvider.tsx       — context: themes list, current slug, setTheme; manages
                            localStorage + data-theme attribute writes
  ThemeDial.tsx           — the visual dial + interaction handlers
  ThemeStyleInjector.tsx  — server component that renders the <style id="theme-tokens">
                            block from the themes array

app/
  layout.tsx              — adds FOUC inline script + ThemeStyleInjector + ThemeProvider
  page.tsx                — fetches themes, passes to provider (or layout fetches them)

lib/
  themes.ts               — Theme type, token map type, helpers (e.g. tokensToCssRules)

supabase/
  stage8_themes.sql       — themes table migration + seed for Dark/Light
```

`ThemeProvider` is a client component with the context. `ThemeStyleInjector` is a server component that takes the themes prop and outputs `<style>` for SSR. Layout fetches themes once on the server.

---

## Accessibility

- Dial is a `role="radiogroup"` with `aria-label="Theme selector"`
- Each option is `role="radio"` with `aria-checked` state and `aria-label="Switch to {theme name}"`
- Focus ring is high-contrast, visible against any theme
- Arrow-key navigation per APG radio-group pattern
- Theme name appears as a `<span class="sr-only">` for screen readers, even when the tooltip is closed
- `prefers-reduced-motion`: snap and transition animations shortened or disabled

---

## Responsive Behavior

Single breakpoint at `max-width: 768px`:
- Radius scales down via `clamp()` (already in geometry section)
- Pointer and option swatches scale proportionally
- Same interactions; touch already supported via pointer events
- Z-index considered against the nav pill and the inline edit bar; dial stays above content but below the login panel modal

---

## Coexistence with existing features

| Surface | Resolution |
|---|---|
| `EditBar` (bottom center, admin) | No conflict — dial is left-center, edit bar is bottom-center |
| `InlineLoginPanel` (top-right modal) | Login panel z-index higher; dial dims slightly when panel is open |
| `Nav` pill (top-center) | Different position; no overlap |
| `RagBot` (likely bottom-right) | Dial stays clear |
| Admin edit mode | Dial remains visible and functional — useful to preview content in different themes while editing |

---

## Implementation Stages

### Stage 1 — Schema + seed + types
- Create migration `supabase/stage8_themes.sql` with `themes` table and seed for `rithvik-dark` and `rithvik-light`
- Add `Theme` interface to `lib/types.ts` and update `Database` type
- Add `ThemeTokens` shape and helpers in `lib/themes.ts`

### Stage 2 — Token plumbing
- Audit `globals.css`; list every themable variable
- Refactor `:root { ... }` so theme-bound vars are moved into `:root[data-theme="rithvik-dark"] { ... }`
- Build `ThemeStyleInjector` server component that renders all themes' CSS
- Add FOUC-prevention inline script in `app/layout.tsx`
- Hardcode `data-theme="rithvik-dark"` to confirm nothing regresses

### Stage 3 — Provider + persistence
- Build `ThemeProvider` client component (context with `themes`, `currentSlug`, `setTheme`)
- Hook localStorage read/write into `setTheme`
- Verify theme persists across reloads

### Stage 4 — Rithvik Light values
- Implement the Light token values from the proposal table
- Walk through every section; tune values for legibility
- Special-case any color that doesn't fit the simple invert (flickering grid, gradients, glow)

### Stage 5 — Dial component (static)
- Build `ThemeDial.tsx` with the geometry, glass styling, fixed pointer, option swatches
- Position fixed; verify on multiple viewport sizes
- Click-only interaction first; rotation/snap on click

### Stage 6 — Drag + wheel + keyboard
- Drag rotation using pointer events; angle math from drag center
- Snap-to-nearest on release with spring animation (use `motion`)
- Wheel-over-dial cycling with cooldown
- Keyboard support (focus + arrows)
- Accessibility wiring (`role="radiogroup"`, `aria-checked`)

### Stage 7 — Page-wide transition
- Add the global `transition` rule (scoped via `[data-theme-transitioning]` attribute)
- Toggle the attribute briefly around `setTheme` calls
- Verify smoothness across all sections

### Stage 8 — Polish + mobile + QA
- Mini-dial sizing at `max-width: 768px`
- `prefers-reduced-motion` honoring
- Visual QA both themes against every section, including admin edit mode
- Verify FOUC prevention in production build

---

## Open Questions to Confirm During Implementation

These have reasonable defaults in this plan but should be sanity-checked while building:

1. **Exact Light theme values** — the proposal table is a starting point; needs hands-on tuning against each section.
2. **Hero flickering-grid color** — currently white particles. Plan calls for dark particles on light bg. Confirm this matches your taste or whether the grid should be hidden on Light.
3. **Gradient text** — uses `var(--accent) → #9b5fe0 → #c44fa8`. These colors are saturated; they may need theme-specific stops for Light, or stay as-is.
4. **Pointer position** — plan puts the fixed pointer at the rightmost (3 o'clock) point of the dial. Alternative: top of the visible arc (12 o'clock). Verify which feels right visually.
5. **Dial vertical position** — vertically centered by default. Could shift slightly up if it collides with anything during scroll.
6. **Option swatch design** — small accent-color dot, or a mini stripe showing `bg / accent / text`? Latter previews the theme better; former is cleaner.
7. **Transition timing** — 280ms ease-out is the proposal. Faster (180ms) feels snappier; slower (400ms) feels more luxurious.
8. **Theme transition scope** — `*` selector is heavy; the `[data-theme-transitioning]` toggle is the safety hatch. Confirm the toggle approach is fine.

---
