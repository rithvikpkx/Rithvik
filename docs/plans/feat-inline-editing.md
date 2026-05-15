# feat-inline-editing — Development Plan

## Overview

Replace the separate `/admin` dashboard with a fully inline editing experience anchored to the main page. Clicking "I am Rithvik" morphs the button into a login panel. After authenticating, the entire page becomes editable in place — every section, card, and text field can be clicked and modified without leaving the page.

---

## Goals

- Zero-redirect auth: login panel expands from the nav button, never leaves the page
- Edit-in-place for all dynamic content (projects, experience, site-wide text)
- Add/delete controls per section with an "empty slug" placeholder flow
- Changes persist to Supabase immediately on field blur (auto-save)
- Visual edit mode indicator so it's always clear when the page is live-editable
- No regression to the public visitor experience

---

## What Gets Editable

| Section | Fields | Currently |
|---|---|---|
| **Hero** | Tagline, sub-line | Hardcoded in `Hero.tsx` |
| **Bento** | Location, "Currently Building" title + description + tags, stats numbers + labels, stack list, interests list | Hardcoded in `Bento.tsx` |
| **Education** | School name, degree description, concentrations, URL | Hardcoded in `Education.tsx` |
| **Projects** | Title, badge, description, tags, links (github/live/demo), image_url, featured, published, sort_order | Supabase `projects` table |
| **Experience** | Org, org_url, role, date_range, description, tags, location, featured, published, sort_order | Supabase `experience` table |
| **Contact** | Section headline, sub-copy, social link URLs/labels | Hardcoded in `Contact.tsx` |

---

## Architecture

### Edit Mode Context

A single `EditModeContext` (React context, client component) wraps the entire page. It holds:

```ts
interface EditModeContext {
  isEditing: boolean;
  session: SupabaseSession | null;
  login: (email: string, password: string) => Promise<string | null>; // returns error or null
  logout: () => void;
}
```

All sections read `isEditing` from this context. When `false`, sections render exactly as they do today (no change for visitors). When `true`, sections swap to their editable variants.

### Data Flow in Edit Mode

1. On entering edit mode, each editable section fetches its own data client-side from Supabase directly (using the browser client with the user's auth session).
2. Field changes are held in local component state.
3. On field blur → call the corresponding server action → Supabase write → `revalidatePath("/")` updates the public view.
4. No "Save All" button needed — everything auto-saves per field, matching the mental model of editing a document.

### Component Split Pattern

Each currently-server-rendered section gets split:

```
Projects (server component — public view)
  └─ ProjectsEditor (client component — edit mode, lazy-loaded)
```

The page renders both; CSS/context hides one. The server component is never unmounted (preserves SSR hydration), and the editor overlays on top of it in edit mode.

---

## Auth Flow — Inline Login Panel

### Visual Behavior

1. User hovers "I am Rithvik" → button gets a subtle glow (existing behavior)
2. User clicks → button expands with a spring animation (Framer Motion `layoutId`) into a floating panel anchored to the top-right of the nav pill
3. Panel contains:
   - Fun header: `"I am Rithvik."` + the "Rithvik-only zone" warning
   - Email + Password inputs
   - Sign in button with loading state
   - Close `×` to collapse back to button

4. On success → panel collapses back, button changes to `"✦ Editing"` with an accent glow
5. On logout → button reverts, page exits edit mode

### Implementation

Use Supabase's client-side auth:

```ts
// In EditModeContext
const login = async (email, password) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return error.message;
  setIsEditing(true);
  return null;
};
```

Server actions continue to use the existing `requireAuth()` (cookie-based SSR session check) — no change needed there. Supabase's `signInWithPassword` sets the auth cookie automatically, so subsequent server action calls are already authenticated.

---

## Database Schema Changes

### 1. New `site_content` entries (no schema change, table already exists)

The `site_content` table (`key TEXT PRIMARY KEY, value TEXT`) will store all previously-hardcoded content as JSON blobs:

| key | value shape |
|---|---|
| `hero.tagline` | `"CS + Math @ Purdue"` |
| `hero.sub_line` | `"Building at the intersection of…"` |
| `bento.location` | `"West Lafayette, IN"` |
| `bento.building` | `{ title, description, tags[] }` |
| `bento.stats` | `[{ num, label }]` |
| `bento.stack` | `["Python", "TypeScript", …]` |
| `bento.interests` | `["Full-Stack Engineering", …]` |
| `contact.headline` | `"Let's connect."` |
| `contact.sub` | `"I'm always interested in…"` |
| `contact.links` | `[{ href, label }]` |

### 2. New `education` table (replaces hardcoded Education component)

```sql
CREATE TABLE education (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school      TEXT NOT NULL,
  school_url  TEXT,
  degree      TEXT NOT NULL,        -- "B.S. in Computer Science + Mathematics"
  concentrations TEXT[],            -- ["Software Engineering", "AI / ML"]
  logo_path   TEXT,                 -- "/images/purdue.png"
  sort_order  INT DEFAULT 0,
  published   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

Seed with the current hardcoded Purdue entry. RLS: public SELECT, service-role INSERT/UPDATE/DELETE.

### 3. No changes to `projects` or `experience` tables

They already have all needed fields.

---

## New Files / Components

```
components/
  EditModeProvider.tsx     — Context provider + login logic
  InlineLoginPanel.tsx     — Morphing login UI anchored to nav button
  EditBar.tsx              — Floating "Editing mode" indicator bar at bottom
  editable/
    EditableText.tsx        — contentEditable wrapper with auto-save on blur
    EditableTagList.tsx     — Inline add/remove tag chips
    EditableLinks.tsx       — Key-value link editor (github → url)
    ProjectsEditor.tsx      — Edit-mode version of Projects section
    ExperienceEditor.tsx    — Edit-mode version of Experience section
    BentoEditor.tsx         — Edit-mode version of Bento section
    EducationEditor.tsx     — Edit-mode version of Education section
    ContactEditor.tsx       — Edit-mode version of Contact section
    HeroEditor.tsx          — Edit-mode version of Hero section

app/admin/inline-actions.ts  — New server actions for site_content + education

lib/types.ts                 — Add Education type + site_content typed keys
```

The existing `/admin` pages remain but are deprecated — can be removed in a follow-up cleanup once inline editing is stable.

---

## EditableText Component

The core primitive. Used everywhere a single text field is edited.

```tsx
// Renders a <span contentEditable> in edit mode, plain text in view mode
interface Props {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  className?: string;
  tag?: "h1" | "h2" | "h3" | "p" | "span";
  placeholder?: string;
}
```

Behavior:
- On mount in edit mode: shows a subtle dashed underline to signal editability
- On click: becomes active, cursor placed in text
- On blur: calls `onSave`, shows a brief `✓ saved` flash
- On `Escape`: reverts to last saved value
- Handles `Enter` as blur (no newlines in single-line fields)

---

## Per-Section Edit UI

### Projects Section (edit mode)

- Each project card gets a floating action row:
  - `✎ Edit` (already in edit mode — clicking the card fields edits them inline)
  - `↑ / ↓` sort order arrows
  - `🗑 Delete` with a confirmation popover
- At the bottom of the grid: `+ Add Project` button → inserts a new row with placeholder values and focuses the title field
- Editable fields inline on the card: title (`h3`), badge, description (`p`), tags (`EditableTagList`), links (`EditableLinks`)
- `featured` and `published` toggles as small checkbox chips visible in edit mode

### Experience Section (edit mode)

- Each timeline entry gets:
  - Inline editable: org (`h3`), role, date_range, description, tags
  - `org_url` as a small "link" icon that opens an input when clicked
  - `↑ / ↓` for sort_order, `🗑 Delete`
- `+ Add Entry` at the bottom of the timeline

### Bento Section (edit mode)

- Location card: click `h3` to edit city, click sub to edit university name
- Building card: click title, description, tags all editable
- Stats card: click each number and label to edit
- Stack card: `EditableTagList` for the full stack array
- Interests card: `EditableTagList` for the interests array
- All save to `site_content` table via `upsert`

### Education Section (edit mode)

- School name and URL (link on the text)
- Degree description with inline editable `<span>` segments
- Concentrations as `EditableTagList`
- Logo: file picker (or URL input) for `logo_path`

### Hero Section (edit mode)

- The tagline `CS + Math @ Purdue` becomes editable
- The sub-line `Building at the intersection of…` becomes editable
- The name `Rithvik Praveen Kumar` — editable but with a confirmation dialog ("this updates the heading on every visitor's page")

### Contact Section (edit mode)

- Headline and sub-copy editable
- Links list: each entry shows editable label + URL fields + a `×` to remove
- `+ Add link` at the bottom

---

## EditBar Component

A slim bar pinned to the bottom of the viewport, only visible in edit mode:

```
[ ✦ Edit mode active  ·  All changes auto-saved  ·  Exit editing ]
```

- Provides a clear signal that the page is in edit mode
- "Exit editing" logs out of the edit session (not out of Supabase auth — they stay signed in but `isEditing` goes to false)

---

## Save Strategy

**Auto-save on blur** — every `EditableText` and `EditableTagList` calls its `onSave` prop when the user leaves the field. The `onSave` calls the appropriate server action:

- `updateProject(id, data)` / `createProject(data)` / `deleteProject(id)`
- `updateExperience(id, data)` / etc.
- `upsertSiteContent(key, value)` — new action for `site_content`
- `updateEducation(id, data)` — new action for `education` table

Each server action calls `revalidatePath("/")` so the public-facing SSR data updates immediately.

**Optimistic updates** — the UI updates locally before the server action returns, so editing feels instant. On error, the field reverts and shows an error toast.

---

## Security

- The `InlineLoginPanel` auth is client-side (`supabase.auth.signInWithPassword`) — Supabase handles the session cookie, rate limiting, and brute-force protection
- All server actions still call `requireAuth()` — a visitor who somehow has `isEditing=true` in their context cannot actually write to the DB
- `site_content`, `projects`, and `experience` tables have RLS policies: public SELECT only; INSERT/UPDATE/DELETE require the service role key (used only in server actions)
- The new `education` table gets the same RLS setup
- No credentials are ever sent to the client

---

## Implementation Stages

### Stage 1 — Context + Login Panel
- `EditModeProvider.tsx` with auth state, `isEditing`, login/logout
- `InlineLoginPanel.tsx` — morphing animation from nav button
- Wire into `Nav.tsx` and `app/layout.tsx`
- Verify login works and `isEditing` toggles

### Stage 2 — EditableText primitive + EditBar
- `EditableText.tsx` — contentEditable with save-on-blur
- `EditBar.tsx` — bottom status bar
- Test with Hero tagline as the first editable field

### Stage 3 — Database migration
- Add `education` table in Supabase, seed with current data
- Add `site_content` rows for all hardcoded content
- Write `inline-actions.ts` server actions for `upsertSiteContent`, education CRUD
- Update `lib/types.ts` with new types

### Stage 4 — Projects editor
- `ProjectsEditor.tsx` — edit-mode overlay for the Projects grid
- Inline field editing, add/delete, sort controls
- `EditableTagList.tsx`, `EditableLinks.tsx` primitives

### Stage 5 — Experience editor
- `ExperienceEditor.tsx` — edit-mode timeline
- Same add/delete/sort pattern as projects

### Stage 6 — Bento, Education, Contact editors
- `BentoEditor.tsx` — each card becomes a locally editable unit
- `EducationEditor.tsx` — replaces hardcoded `Education.tsx` data
- `ContactEditor.tsx` — text + link list editing

### Stage 7 — Hero editor
- `HeroEditor.tsx` — tagline and sub-line editable
- Name editing with confirmation dialog

### Stage 8 — Polish + cleanup
- Animations: smooth enter/exit of edit mode per section
- Error states and toast notifications
- Deprecate and remove `/admin` routes
- Full test pass: login, edit every section, logout, verify public view

---

## Open Questions / Decisions Before Starting

1. **Education as one row vs multiple rows** — Purdue is the only school for now; a single-row `education` table is fine. If multiple schools are ever needed, the table design already supports it.

2. **Hero name editability** — The name `Rithvik Praveen Kumar` uses `KineticText` which splits into individual character `<span>`s. Making it directly `contentEditable` will break the component. The edit-mode version should replace `KineticText` with a plain `<input>` or `contentEditable` block.

3. **Image uploads** — Project `image_url` and Education `logo_path` currently reference local public assets or external URLs. For the MVP, an editable URL input is sufficient. A full file-upload flow (Supabase Storage) is a future enhancement.

4. **Bento stats** — Currently three hardcoded objects. Decide whether to make the stat count itself editable (add/remove stats) or just the values. MVP: values only.
