# "For Warren Buffett" Plain-HTML Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/buffett` route that renders the portfolio's real content as a bare, animation-free HTML page (an homage to berkshirehathaway.com), reachable from an easter-egg button near the theme dial; and remove two light themes.

**Architecture:** Convert the single root layout into **multiple root layouts via Next.js route groups** — `app/(site)/` holds today's themed layout + homepage, `app/(plain)/` holds a minimal bare layout + the `/buffett` page. Crossing between groups triggers a full document load, so `/buffett` arrives with none of the main site's JS, themes, or chrome. The `/buffett` page is a server component reusing the existing Supabase queries.

**Tech Stack:** Next.js 16 App Router (route groups, multiple root layouts), React 19 server components, Supabase (`serverClient`), plain CSS. No tests framework for components in this repo — verification gates are `tsc --noEmit`, `next build`, a Supabase query, and manual preview, per CLAUDE.md.

**Note on tooling:** per `memory/node-shell-shim.md`, invoke Node via `command node` (e.g. `command node node_modules/.bin/tsc`); shebang bins like `tsc`/`eslint`/`next` are otherwise fine. Supabase migrations apply with `supabase db query --linked -f <file>` against the linked **`Rithvik`** project.

---

## Task 1: Remove `monokai-pro-light` and `atom-one-light` themes

**Files:**
- Create: `supabase/themes_remove_themes.sql`
- Modify: `supabase/themes_add_more_themes.sql`
- Modify: `supabase/themes_add_editor_themes.sql`

- [ ] **Step 1: Write the removal migration**

Create `supabase/themes_remove_themes.sql`:

```sql
-- Remove two light themes from the picker. Idempotent.
DELETE FROM themes WHERE slug IN ('monokai-pro-light', 'atom-one-light');
```

- [ ] **Step 2: Stop `themes_add_more_themes.sql` from re-adding `monokai-pro-light`**

In `supabase/themes_add_more_themes.sql`, delete the entire `INSERT … 'monokai-pro-light' …` block (the one titled under "New light themes", values through `ON CONFLICT (slug) DO NOTHING;`). Then in the reorder `UPDATE themes SET sort_order = CASE slug` block, delete this single line:

```sql
  WHEN 'monokai-pro-light'    THEN 3
```

Leave the remaining light entries (`github-light` 0, `rithvik-light` 1, `high-contrast-light` 4) as-is — gaps are harmless since the dial sorts relatively.

- [ ] **Step 3: Stop `themes_add_editor_themes.sql` from re-adding `atom-one-light`**

In `supabase/themes_add_editor_themes.sql`, delete the entire `INSERT … 'atom-one-light' …` block (the last INSERT in the file, under "Light themes", values through `ON CONFLICT (slug) DO NOTHING;`).

- [ ] **Step 4: Apply the removal migration to the linked DB**

Run: `supabase db query --linked -f supabase/themes_remove_themes.sql`
Expected: completes with `"rows": []` (no error).

- [ ] **Step 5: Verify the two themes are gone**

Run: `supabase db query --linked "SELECT slug FROM themes WHERE slug IN ('monokai-pro-light','atom-one-light');"`
Expected: empty result (no rows for either slug).

- [ ] **Step 6: Commit**

```bash
git add supabase/themes_remove_themes.sql supabase/themes_add_more_themes.sql supabase/themes_add_editor_themes.sql
git commit -m "feat(themes): remove Monokai Pro Light and Atom One Light"
```

---

## Task 2: Restructure into route groups — move the themed site into `app/(site)/`

This moves the existing root layout + homepage into a `(site)` route group without changing their content (URLs are unaffected by route groups). The only content edit is fixing the relative `globals.css` import.

**Files:**
- Move: `app/layout.tsx` → `app/(site)/layout.tsx`
- Move: `app/page.tsx` → `app/(site)/page.tsx`
- Modify: `app/(site)/layout.tsx:3` (import path)

- [ ] **Step 1: Create the group dir and move both files (preserving git history)**

```bash
mkdir -p "app/(site)"
git mv app/layout.tsx "app/(site)/layout.tsx"
git mv app/page.tsx "app/(site)/page.tsx"
```

(Quote the parens — zsh treats them as glob syntax otherwise.)

- [ ] **Step 2: Fix the relative `globals.css` import**

`globals.css` stays at `app/globals.css`, but the layout is now one level deeper. In `app/(site)/layout.tsx`, change line 3:

```ts
import "../globals.css";
```

(was `import "./globals.css";`). All other imports use the `@/` alias and are unaffected. `page.tsx` uses only `@/` imports — no change needed there.

- [ ] **Step 3: Verify the build still produces `/`**

Run: `command node node_modules/.bin/next build`
Expected: build succeeds; the route list shows `○ /` (or `ƒ /`) generated from `app/(site)/page.tsx`. No "globals.css not found" or missing-module errors.

> If `next build` errors that root metadata files (`icon.tsx`/`opengraph-image.tsx`/`apple-icon.tsx`) conflict with multiple root layouts, move them into `app/(site)/` with `git mv` and rebuild. (They generally remain valid at `app/` root; only move if the build complains.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(app): move themed site into (site) route group"
```

---

## Task 3: Add the minimal `(plain)` root layout

**Files:**
- Create: `app/(plain)/layout.tsx`

- [ ] **Step 1: Create the bare root layout**

Create `app/(plain)/layout.tsx`. It owns its own `<html>`/`<body>`, imports no providers and no `globals.css`, and inlines the Berkshire-style CSS so the document is genuinely bare.

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rithvik Praveen Kumar — Plain HTML",
  // Bare mirror of the homepage; keep it out of the index to avoid duplicate content.
  robots: { index: false, follow: true },
};

// All styling for the plain pages lives here as one inline sheet — no globals,
// no theme tokens, no external fonts. A loving homage to berkshirehathaway.com.
const css = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0 auto; padding: 28px 24px 48px; max-width: 1100px;
    font-family: "Courier New", Courier, monospace;
    color: #1a1a1a; background: #ffffff; line-height: 1.55;
  }
  h1 {
    margin: 0; font-family: Georgia, "Times New Roman", serif;
    font-variant: small-caps; letter-spacing: 0.02em; color: #1a237e;
    font-size: 2rem;
  }
  h2 { font-family: Georgia, "Times New Roman", serif; color: #1a237e; margin-top: 0; }
  h3 { font-family: Georgia, "Times New Roman", serif; margin: 0 0 0.2em; }
  a:link { color: #0000cc; }
  a:visited { color: #551a8b; }
  a:hover { color: #cc0000; }
  hr { border: 0; border-top: 1px solid #888; margin: 22px 0; }
  .return a, .bh-footer a { font-weight: bold; }
  .bh-header { text-align: center; }
  .bh-header .addr { margin: 2px 0; font-weight: bold; }
  .index { display: flex; flex-wrap: wrap; gap: 16px 56px; }
  .index ul { margin: 0; padding-left: 22px; }
  .entry { margin-bottom: 18px; }
  .entry ul { margin: 4px 0; padding-left: 22px; }
  .tags, .meta { color: #555; font-size: 0.9em; }
  .bh-footer .note { color: #555; }
  @media (max-width: 640px) { .index { flex-direction: column; gap: 0; } }
`;

export default function PlainLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `command node node_modules/.bin/tsc --noEmit`
Expected: no errors. (The page it serves doesn't exist yet, but the layout alone compiles.)

- [ ] **Step 3: Commit**

```bash
git add "app/(plain)/layout.tsx"
git commit -m "feat(buffett): add minimal (plain) root layout"
```

---

## Task 4: Build the `/buffett` page

**Files:**
- Create: `app/(plain)/buffett/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/(plain)/buffett/page.tsx`. Server component; reuses the same queries/shapes the live sections use (`site_content`, `education`, `projects`, `experience`). Plain `<a href="/">` links force a full navigation back across the root-layout boundary.

```tsx
import { serverClient } from "@/lib/supabase";
import type {
  Project,
  Experience as ExperienceRow,
  Education as EducationRow,
  GlobeMarker,
} from "@/lib/types";

// Match the homepage ISR cadence so content stays in sync.
export const revalidate = 60;

interface Building { title: string; description: string; tags: string[] }

function parseSafe<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

// Descriptions are stored one bullet per line (see DescriptionBlock).
function bullets(desc: string): string[] {
  return (desc ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
}

function Body({ desc }: { desc: string }) {
  const lines = bullets(desc);
  if (lines.length > 1) return <ul>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>;
  if (lines.length === 1) return <p>{lines[0]}</p>;
  return null;
}

export default async function Buffett() {
  const sb = serverClient();
  const [contentRes, eduRes, projRes, expRes] = await Promise.all([
    sb.from("site_content").select("key, value"),
    sb.from("education").select("*").order("sort_order"),
    sb.from("projects").select("*").order("sort_order"),
    sb.from("experience").select("*").order("sort_order"),
  ]);

  const content = Object.fromEntries(
    ((contentRes.data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]),
  );
  const education = ((eduRes.data ?? []) as EducationRow[]).filter((e) => e.published);
  const projects = ((projRes.data ?? []) as Project[]).filter((p) => p.published);
  const experience = (expRes.data ?? []) as ExperienceRow[];

  const name =
    [content["hero.name.line1"], content["hero.name.line2"]].filter(Boolean).join(" ") ||
    "Rithvik Praveen Kumar";
  const tagline = content["hero.tagline"] ?? "";
  const subLine = content["hero.sub_line"] ?? "";
  const building = parseSafe<Building | undefined>(content["bento.building"], undefined);
  const stack = parseSafe<string[]>(content["bento.stack"], []);
  const interests = parseSafe<string[]>(content["bento.interests"], []);
  const markers = parseSafe<GlobeMarker[]>(content["bento.globe_markers"], []);
  const current = markers.find((m) => m.kind === "current") ?? markers.find((m) => m.kind === "home");
  const location = current
    ? [current.city, current.region, current.country].filter(Boolean).join(", ")
    : "";

  const github = content["contact.link.github"];
  const linkedin = content["contact.link.linkedin"];
  const email = content["contact.link.email"];
  const contactHeadline = content["contact.headline"] ?? "";
  const contactSub = content["contact.sub"] ?? "";

  return (
    <>
      <p className="return"><a href="/">&larr; Return to the full site</a></p>

      <header className="bh-header">
        <h1>{name}</h1>
        {tagline ? <p className="addr">{tagline}</p> : null}
        {location ? <p className="addr">{location}</p> : null}
        <p className="addr">Personal Home Page</p>
      </header>

      <hr />

      <nav className="index" aria-label="Sections">
        <ul>
          <li><a href="#about">About / A Message</a></li>
          <li><a href="#education">Education</a></li>
          <li><a href="#projects">Projects</a></li>
        </ul>
        <ul>
          <li><a href="#experience">Experience</a></li>
          <li><a href="#contact">Contact</a></li>
          {github ? <li><a href={github}>GitHub</a></li> : null}
          {linkedin ? <li><a href={linkedin}>LinkedIn</a></li> : null}
          {email ? <li><a href={`mailto:${email}`}>Email</a></li> : null}
        </ul>
      </nav>

      <hr />

      <section id="about">
        <h2>About</h2>
        {tagline ? <p>{tagline}</p> : null}
        {subLine ? <p>{subLine}</p> : null}
        {building ? (<><h3>{building.title}</h3><p>{building.description}</p></>) : null}
        {stack.length ? <p><strong>Stack:</strong> {stack.join(", ")}</p> : null}
        {interests.length ? <p><strong>Interests:</strong> {interests.join(", ")}</p> : null}
      </section>

      <hr />

      <section id="education">
        <h2>Education</h2>
        {education.map((e) => (
          <div key={e.id} className="entry">
            <h3>{e.school_url ? <a href={e.school_url}>{e.school}</a> : e.school}</h3>
            <p>{e.degree}</p>
            {e.concentrations?.length ? <p>Concentrations: {e.concentrations.join(", ")}</p> : null}
          </div>
        ))}
      </section>

      <hr />

      <section id="projects">
        <h2>Projects</h2>
        {projects.map((p) => (
          <div key={p.id} className="entry">
            <h3>{p.title}{p.badge ? ` — ${p.badge}` : ""}</h3>
            <Body desc={p.description} />
            {p.tags?.length ? <p className="tags">{p.tags.join(" · ")}</p> : null}
            {Object.keys(p.links ?? {}).length ? (
              <p>{Object.entries(p.links).map(([k, v], i) => (
                <span key={k}>{i > 0 ? " · " : ""}<a href={v}>{k}</a></span>
              ))}</p>
            ) : null}
          </div>
        ))}
      </section>

      <hr />

      <section id="experience">
        <h2>Experience</h2>
        {experience.map((x) => (
          <div key={x.id} className="entry">
            <h3>{x.role}{x.org ? <> — {x.org_url ? <a href={x.org_url}>{x.org}</a> : x.org}</> : null}</h3>
            <p className="meta">{[x.date_range, x.location].filter(Boolean).join(" · ")}</p>
            <Body desc={x.description} />
            {x.tags?.length ? <p className="tags">{x.tags.join(" · ")}</p> : null}
          </div>
        ))}
      </section>

      <hr />

      <section id="contact">
        <h2>Contact</h2>
        {contactHeadline ? <p>{contactHeadline}</p> : null}
        {contactSub ? <p>{contactSub}</p> : null}
        <ul>
          {github ? <li><a href={github}>GitHub</a></li> : null}
          {linkedin ? <li><a href={linkedin}>LinkedIn</a></li> : null}
          {email ? <li><a href={`mailto:${email}`}>{email}</a></li> : null}
        </ul>
      </section>

      <hr />

      <footer className="bh-footer">
        <p><a href="/">&larr; Return to the full experience</a></p>
        <p>Copyright &copy; {new Date().getFullYear()} {name}.</p>
        <p className="note">Inspired by the official Berkshire Hathaway website.</p>
      </footer>
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `command node node_modules/.bin/tsc --noEmit`
Expected: no errors. (Confirms the `Project`/`Experience`/`Education`/`GlobeMarker` field names used match `lib/types.ts`.)

- [ ] **Step 3: Build and confirm the route exists**

Run: `command node node_modules/.bin/next build`
Expected: build succeeds; route list includes `/buffett`.

- [ ] **Step 4: Commit**

```bash
git add "app/(plain)/buffett/page.tsx"
git commit -m "feat(buffett): plain-HTML /buffett page rendering live content"
```

---

## Task 5: Add the "For Warren Buffett" button + tooltip near the dial

**Files:**
- Create: `components/BuffettLink.tsx`
- Modify: `app/(site)/layout.tsx` (render it beside `<ThemeDial />`)
- Modify: `app/globals.css` (append button + tooltip styles)

- [ ] **Step 1: Create the button component**

Create `components/BuffettLink.tsx`. Plain server component — a real `<a>` so it does a full navigation into the `(plain)` root layout. The tooltip is a CSS-revealed child.

```tsx
// Easter-egg link to the bare /buffett page. Sits near the theme dial.
export default function BuffettLink() {
  return (
    <a
      className="buffett-link"
      href="/buffett"
      aria-label="For Warren Buffett — a plain HTML version of this site"
    >
      For Warren Buffett
      <span className="buffett-tip" role="tooltip">
        Inspired by the official berkshire hathaway website
      </span>
    </a>
  );
}
```

- [ ] **Step 2: Render it in the `(site)` layout**

In `app/(site)/layout.tsx`, add the import near the other component imports (after the `ThemeDial` import on line 9):

```ts
import BuffettLink from "@/components/BuffettLink";
```

Then render it right after `<ThemeDial />` (inside `<ThemeProvider>`, currently line 79):

```tsx
          <ThemeDial />
          <BuffettLink />
```

- [ ] **Step 3: Append the styles to `globals.css`**

Add to the end of `app/globals.css`. The dial is fixed at the left edge, vertically centered (`top:50%; left:0`), so the link sits in the bottom-left corner, clear of it. Tooltip reveals on hover/focus.

```css
/* "For Warren Buffett" easter-egg link — bottom-left, near the theme dial. */
.buffett-link {
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 90;
  font-size: 0.72rem;
  letter-spacing: 0.02em;
  padding: 6px 11px;
  border-radius: 999px;
  text-decoration: none;
  color: var(--muted);
  background: var(--panel-glass);
  border: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  transition: color 0.2s ease, border-color 0.2s ease;
}
.buffett-link:hover,
.buffett-link:focus-visible {
  color: var(--text);
  border-color: color-mix(in srgb, var(--text) 22%, transparent);
}
.buffett-tip {
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  width: max-content;
  max-width: 240px;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 0.7rem;
  line-height: 1.35;
  color: var(--text);
  background: var(--panel-glass);
  border: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  opacity: 0;
  transform: translateY(4px);
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.buffett-link:hover .buffett-tip,
.buffett-link:focus-visible .buffett-tip {
  opacity: 1;
  transform: translateY(0);
}
@media (prefers-reduced-motion: reduce) {
  .buffett-tip { transition: opacity 0.18s ease; transform: none; }
}
```

- [ ] **Step 4: Typecheck + lint touched files**

Run: `command node node_modules/.bin/tsc --noEmit`
Expected: no errors.
Run: `node_modules/.bin/eslint "components/BuffettLink.tsx" "app/(site)/layout.tsx"`
Expected: no errors/warnings.

- [ ] **Step 5: Commit**

```bash
git add components/BuffettLink.tsx "app/(site)/layout.tsx" app/globals.css
git commit -m "feat(buffett): add 'For Warren Buffett' link + tooltip near the dial"
```

---

## Task 6: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Clean build**

Run: `command node node_modules/.bin/next build`
Expected: succeeds. Route list shows both `/` (from `(site)`) and `/buffett` (from `(plain)`).

- [ ] **Step 2: Manual smoke test (dev server)**

Run: `command node node_modules/.bin/next dev` and check in a browser:
- `/` renders exactly as before — theme dial works, edit mode/login reachable, all sections present, RAG/composer overlays load. The "For Warren Buffett" pill shows bottom-left; hovering shows the bubble "Inspired by the official berkshire hathaway website".
- Clicking it navigates to `/buffett`: bare serif/monospace page, centered header, anchor index jumps to sections, all content present (education, projects, experience, contact), external links work.
- Both the top "Return to the full site" and footer "Return to the full experience" links go back to `/`; browser Back also works.
- Theme picker no longer lists Monokai Pro Light or Atom One Light.

- [ ] **Step 3: Push to dev for a Vercel preview**

```bash
git push origin dev
```

Expected: preview builds at `rithvik-<hash>.vercel.app`; re-run the Step 2 checks against the preview (the only way to catch SSR/edge bugs that pass local build, per CLAUDE.md).

---

## Notes for the implementer

- **Do not merge to `main`** — only the user authorizes that, with a `--no-ff` merge.
- The removal migration (Task 1) is already authoritative; the source-file edits just prevent re-adds. No `FALLBACK_THEMES` change is needed (neither slug is in it).
- If `next build` complains about `app/icon.tsx` / `opengraph-image.tsx` / `apple-icon.tsx` under multiple root layouts, `git mv` them into `app/(site)/` and rebuild (see Task 2, Step 3 note).
- `CLAUDE.md` references (theme count, the file-layout cheat sheet's `app/layout.tsx`/`app/page.tsx` lines, default theme) will be stale after this — update them in a follow-up doc commit if desired (out of scope for these tasks).
