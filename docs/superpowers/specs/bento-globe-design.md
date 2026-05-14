# Bento Globe — Design Spec

## Goal

Replace the static "Location" tile in the Bento section of the homepage with an interactive 3D globe (cobe). The globe is the entire card — no eyebrow, no "Purdue University" text, no inline LocalTime. Markers represent meaningful places (home / current / default), are hoverable for city + current local time, are editable via the existing inline-edit mode, and are indexed by the RAG bot so it can answer "where is Rithvik right now?" style questions.

## Non-goals

- Click-on-globe-to-place markers. Manual lat/lng fields only.
- Drag-and-drop reordering. Insertion order is display order.
- Auto-geocoding from a city name. No external geocoder dependency.
- Per-theme palette overrides in the markers config. Cobe colors derive from CSS vars; CSS vars derive from the theme. Adding a new theme requires no globe code change.
- A dedicated `globe_markers` table. Markers live in `site_content` for retrieval-shape reasons (see RAG section).

## Architecture

### Components

**`components/Globe.tsx`** — presentational. Props: `markers: GlobeMarker[]`, `className?: string`. Owns:
- The cobe canvas instance (created in `useEffect`, destroyed on unmount and on theme change).
- A DOM-overlay layer (one absolutely-positioned `<button>` per marker, sized to its hit area) that projects each marker's (lat, lng) → (x, y) every animation frame using the same phi/theta as cobe.
- The hover/focus tooltip (CSS-styled, glass).
- A MutationObserver on `<html data-theme>` that triggers a globe rebuild when the theme changes (cobe doesn't support live config mutation).
- Pointer-drag rotation (carried from the user's reference snippet), spring-damped via `motion/react`'s `useSpring`.

**`components/BentoGlobeCard.tsx`** — bento integration. In view mode, renders `<Globe>` full-bleed. In edit mode (`useEditMode().isEditing`), also mounts `<MarkerEditorPanel>` overlaid on the card.

**`components/MarkerEditorPanel.tsx`** — edit UI. List of existing markers (city · kind chip · ✎ · ⌫). "Add marker" button reveals an inline form. Save calls the new `updateGlobeMarkers` server action.

**`components/Bento.tsx`** — replaces the JSX of `.bento-location` with `<BentoGlobeCard markers={markers} />`. Receives `markers` as a new prop. The eyebrow, the inline LocalTime, and the `bento.location` site_content key reference are all removed from this card.

### Data model

One JSON array stored under `site_content` key `bento.globe_markers`:

```ts
// lib/types.ts
export type GlobeMarkerKind = "home" | "current" | "default";

export interface GlobeMarker {
  id: string;          // uuid, client-generated on create
  city: string;        // "San Francisco"
  region: string;      // "CA" or "California" — free text, may be empty for non-US
  country: string;     // "USA"
  lat: number;         // -90..90
  lng: number;         // -180..180
  timezone: string;    // IANA, e.g. "America/Los_Angeles"
  kind: GlobeMarkerKind;
}
```

Seed (idempotent UPSERT in migration):

| city | region | country | lat | lng | timezone | kind |
|---|---|---|---|---|---|---|
| Boston | MA | USA | 42.3601 | -71.0589 | America/New_York | home |
| West Lafayette | IN | USA | 40.4259 | -86.9081 | America/Indiana/Indianapolis | default |
| San Francisco | CA | USA | 37.7749 | -122.4194 | America/Los_Angeles | current |

### Visual mapping (cobe config)

Cobe takes RGB triples in [0, 1]. At mount and on every `data-theme` change, the globe reads computed CSS variables from `<html>` and builds the config fresh:

| cobe field | source |
|---|---|
| `baseColor` | `--text` parsed → RGB / 255 |
| `glowColor` | `--bg` parsed → RGB / 255 |
| `markerColor` | `--accent` parsed → RGB / 255 (per-marker overridden in the markers array — see below) |
| `dark` | luminance(`--bg`) < 0.5 → `1` else `0` |
| `diffuse` | `1.0` (slightly brighter than the demo's 0.4; the demo's value looked muddy on light themes) |
| `mapBrightness` | dark theme → `4`, light theme → `1.2` |
| `mapSamples` | `16000` |

Per-marker color and size, applied at config build:

| kind | size | color source |
|---|---|---|
| `home` | 0.10 | `--accent` |
| `current` | 0.12 | `--green` |
| `default` | 0.06 | `--accent` mixed 60% toward `--bg` (passed as a pre-computed RGB triple) |

### Marker projection (DOM overlay)

For each marker, every animation frame:

1. Convert (lat, lng) → 3D point on unit sphere using cobe's convention (phi = (90 - lat) * π/180, theta = (lng + 180) * π/180, then x = sin(phi)cos(theta), y = cos(phi), z = sin(phi)sin(theta)).
2. Apply the current rotation matrix (rotate around Y axis by `state.phi`, then around X by `theta` from cobe config).
3. If post-rotation z > 0 → marker is on the far side. Set the hit-target's `pointer-events: none` and dim it (or hide its tooltip if active).
4. Otherwise project to screen: `screenX = canvasWidth/2 + x * radius`, `screenY = canvasHeight/2 - y * radius`, where `radius = canvasWidth * 0.42` (cobe's globe is ~0.84 of canvas diameter; tune empirically).
5. Position the absolutely-positioned hit-target at (screenX, screenY) using `transform: translate3d(...)` (cheap on the compositor).

Frame loop runs via cobe's `onRender` callback — same hook that already runs every frame for the rotation update.

### Hover/focus tooltip

The hit-target is a transparent `<button type="button" aria-label="{city}">` with size 28px (touch-friendly), centered on the projected marker position. The same element accepts `:hover`, `:focus-visible`, and keyboard focus (tab order: hit-targets enumerated in marker array order). On hover/focus:

- Tooltip springs in (CSS `transition: opacity 180ms, transform 180ms cubic-bezier(0.32, 0.72, 0, 1)`, scale 0.92 → 1).
- Anchored above the marker by default; if anchor + tooltip extends beyond the card, flip to below.
- Contents:
  - Line 1: `<strong>{city}, {region}</strong>` (or just `{city}` if region is empty)
  - Line 2: `{country}`
  - Line 3: `{time} {tzCode}` — e.g. `4:32 PM PDT`
  - Time computed via `Intl.DateTimeFormat("en-US", { timeZone: marker.timezone, hour: "numeric", minute: "2-digit", hour12: true }).format(now)`.
  - tzCode via `Intl.DateTimeFormat("en-US", { timeZone: marker.timezone, timeZoneName: "short" }).formatToParts(now).find(p => p.type === "timeZoneName").value`.
- A `setInterval(updateNow, 30_000)` ticks while any tooltip is active; cleared when nothing is hovered/focused.

### Bento layout

The current `.bento-grid` lays out 5 cards. The globe needs roughly a square aspect at ≥ 320×320 to read well. Concrete plan:
- Enlarge `.bento-location` to span 2 columns × 2 rows (or equivalent based on the existing template).
- Reflow neighboring cards (`bento-building`, `bento-stats`, `bento-marquee`, `bento-interests`) to fill the remaining space.
- I'll preview the layout on the `dev` Vercel build and adjust before merging.
- Mobile (single-column bento): the globe card height clamps to `min(360px, 70vw)` so it doesn't dominate the viewport.

The `.bento-location` class is reused so existing edit-mode hover styles still apply. New CSS lives under a new `.bento-globe` modifier inside `app/globals.css`.

### Edit mode (server action + UI)

**Server action** in `app/admin/actions.ts`:

```ts
export async function updateGlobeMarkers(markers: GlobeMarker[]): Promise<void>
```

Behavior:
1. `await requireAuth()`.
2. Light validation — each marker has non-empty `city`/`country`, lat in [-90, 90], lng in [-180, 180], valid IANA timezone (try `new Intl.DateTimeFormat("en-US", { timeZone: m.timezone })` in a try/catch), kind ∈ enum.
3. `await upsertSiteContent("bento.globe_markers", JSON.stringify(markers))`.
4. Wrapped by the existing `safeEmbed` path — `upsertSiteContent` already triggers `embedPrimary("site_content", ...)`. No new RAG plumbing.
5. `revalidatePath("/")`.

**`MarkerEditorPanel` UI**:
- Glass card, anchored bottom-right of the globe card, max-width 320px, scrollable.
- Header: "Markers" + count + close (only visible when expanded; click anywhere outside collapses).
- List rows: city · kind pill · ✎ · ⌫. ✎ expands the row in-place into the form below. ⌫ deletes immediately and saves (no confirm prompt — undo would be nicer but is out of scope).
- "+ Add marker" CTA opens an inline form with: City, Region, Country, Latitude (number input, step 0.0001), Longitude (number input, step 0.0001), Timezone (text input with a `<datalist>` of common IANA zones for autocomplete), Kind (3-button segmented control). "Save" submits; "Cancel" discards.
- Inputs paste-friendly: dropping a `lat, lng` string into the Latitude field is parsed and both fields populated.
- All saves go through `updateGlobeMarkers` with the new full array — keeps it simple, no per-row endpoints.

### RAG integration

**Storage:** unchanged. Markers are in `site_content` key `bento.globe_markers`. The existing `embedPrimary("site_content", key)` path already auto-embeds on save.

**Why one chunk and not per-marker:** if each marker were its own row in a new table with its own embedding chunk, a query like "where has Rithvik lived?" would return one nearest-neighbor city, not all of them. By keeping all markers in one chunk, *any* location query retrieves the full picture in one retrieval. Same reasoning as `bento.stack` / `bento.interests`.

**Embedding text** — extend the existing prose mapper in `lib/embeddings.ts`. For key `bento.globe_markers` with value as JSON-parsed `GlobeMarker[]`, generate:

```
Rithvik Praveen Kumar has ties to several places around the world.
{home_clause if any home marker}
{current_clause if any current marker}
{default_clauses joined with newlines, if any default markers}
```

If the markers array is empty, embedding text is just the lead sentence followed by `"No specific places listed."` — the chunk still exists so retrieval doesn't silently drop. Clause rules:
- `home`: `"His home is {city}, {region}, {country} ({tz_display_name}, {iana})."`
- `current`: `"He currently lives in {city}, {region}, {country} ({tz_display_name}, {iana}) — this is where he is right now."`
- `default` that matches a school name found in the `education` table: `"He has ties to {city}, {region}, {country} ({tz}) — this is where he attends/attended {school}."`
- `default` otherwise: `"He has ties to {city}, {region}, {country} ({tz_display_name}, {iana})."`

`tz_display_name` derived from the IANA id via a small static map for the common cases (e.g., `America/New_York` → "Eastern Time"); falls back to the IANA id if unknown.

To match a school, the prose builder reads `education.school` rows in the same server context — the existing `embedPrimary` flow already runs server-side with `adminClient()`, so this is just one extra select. If the join fails (e.g. RLS hiccup), the default clause is used.

**Backfill:** the existing "Re-embed all primary content" button in `SecondaryContextPanel` re-runs the prose builder over every `site_content` row, so it picks up the new key automatically.

**Empty-context guard:** unchanged. `app/api/chat/route.ts` already short-circuits to the canned refusal when both retrievals return zero rows. Location chunks should retrieve reliably given the rich, name-anchored prose.

## Files touched / added

**New:**
- `components/Globe.tsx`
- `components/BentoGlobeCard.tsx`
- `components/MarkerEditorPanel.tsx`
- `supabase/globe_markers_seed.sql` — idempotent UPSERT of the 3 seed markers into `site_content`.

**Modified:**
- `components/Bento.tsx` — replace location-card JSX, accept `markers` prop, remove `loc`/`DEF_LOCATION` and the `LocalTime` import in this card. The legacy `bento.location` site_content row is left untouched in the DB for one release (clean rollback story); a follow-up cleanup can remove it once the globe is stable.
- `app/page.tsx` — fetch+parse `bento.globe_markers`, pass to `<Bento>`.
- `app/admin/actions.ts` — add `updateGlobeMarkers` action.
- `lib/types.ts` — add `GlobeMarker`, `GlobeMarkerKind`.
- `lib/embeddings.ts` — add prose mapper branch for `bento.globe_markers`, with the school-join logic.
- `app/globals.css` — `.bento-globe` styles (card sizing, canvas, hit-targets, tooltip, editor panel). Bento grid template adjustment.
- `package.json` — add `cobe` dependency.
- `CLAUDE.md` — append a short note under the Bento section describing the globe + markers data model + RAG behavior.

## Pitfalls / risks

1. **Cobe config is build-time, not mutable.** Theme changes require destroying and recreating the cobe instance. Pointer state and rotation must survive a rebuild (`phiRef`, `r` motion value persist across the effect's deps).
2. **DOM overlay projection must match cobe's internal rotation exactly.** The `state.phi` updates that cobe writes are read inside `onRender`, so the overlay can use the same `phi` value cobe just used. The `theta` value comes from the cobe config (we set 0.3 like the reference) and stays constant.
3. **`useTouchMove` only fires when at least one touch is active.** The drag handler must guard `e.touches[0]` like the reference snippet does.
4. **`Intl.DateTimeFormat` timezone validation:** an invalid IANA name throws on construction. We use try/catch as the validator in `updateGlobeMarkers` — no allow-list needed.
5. **Marker hit-targets on the back of the globe still occupy DOM space.** They get `pointer-events: none` AND `opacity: 0` so they don't steal focus from front markers via keyboard tab order. Tab order for back markers is handled by `tabIndex={-1}` toggled in the projection loop.
6. **`force-dynamic` root layout** already applies — DB-only edits to `bento.globe_markers` show up on next request, same as themes. No additional cache busting required.
7. **Cobe is a large bundle** (~50KB gz). It's a client component and code-splits naturally with the `BentoGlobeCard`. If LCP regresses on the homepage, lazy-import `Globe` via `next/dynamic({ ssr: false })`.

## Testing plan

- Visual: open `dev` preview, confirm globe renders, drag rotation works, hover tooltip appears with correct time, time updates after waiting 30s, all 14 themes look reasonable (especially light themes — diffuse + mapBrightness tuned for these).
- Edit mode: log in, add a marker (e.g. "London, England, UK, 51.5074, -0.1278, Europe/London, default"), verify it appears and is hoverable; edit it; delete it.
- RAG: ask "where is Rithvik right now?", "where did Rithvik grow up?", "where does Rithvik go to school?", "what time is it for Rithvik?" — all should ground in the globe markers chunk. Verify by checking Vercel logs for the retrieval list.
- TypeScript: `node_modules/.bin/tsc --noEmit` clean.
- Build: `node_modules/.bin/next build` succeeds (cobe ships ESM; confirm Next 16 handles it).
- Lint: `node_modules/.bin/eslint <touched files>` clean.

## Open implementation choices (resolved in code, not spec)

- Exact globe-card grid span (2×2 vs 3×2 etc.) — preview-driven.
- Exact tooltip styling — start from existing glass-card recipe (`--card`, `color-mix(...)`), refine on preview.
- Whether the home and current marker pulse slightly. Default: no pulse for v1 (more visual noise).
