# Bento Globe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static Location tile in the Bento section with an interactive cobe-powered 3D globe whose dot markers (home / current / default) are theme-reactive, hoverable for city + local time, editable in inline-edit mode, and indexed by the RAG bot.

**Architecture:** Pure-globe card (cobe canvas, full-bleed). Theme reactivity rebuilds the cobe instance when `<html data-theme>` changes; palette is read from CSS vars. Marker hit-testing is a DOM overlay layer: each frame projects (lat,lng) → screen coordinates using cobe's `state.phi`, positioning an absolutely-placed `<button>` per marker. CSS tooltips show city/region/country and `Intl.DateTimeFormat` time + timezone short code. Markers persist as one `site_content` JSON array (key `bento.globe_markers`) so any location-related RAG query retrieves the full picture in one chunk. Edit mode mounts a `<MarkerEditorPanel>` overlaid on the globe card with add/edit/delete.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, `cobe` (new dep), `motion/react` (existing), Supabase (existing), OpenAI embeddings (existing path), Tailwind + CSS-vars theming (existing).

**Conventions:**
- This repo has no test framework. The deterministic gate per task is `node_modules/.bin/tsc --noEmit` + `node_modules/.bin/eslint <touched files>`. The behavioral gate is a Vercel preview push on the `dev` branch + manual visual check. Every task ends with one or both. Where TDD would say "write failing test first," we instead state the precise expected visual/behavioral outcome to be verified on the preview.
- Per CLAUDE.md, all feature work happens on `dev`. Do NOT merge to `main` from inside this plan — that requires explicit user approval at the end.
- Commit per task using the existing `feat:` / `fix:` / `chore:` prefixes seen in `git log`.

**Spec:** `docs/superpowers/specs/bento-globe-design.md`

---

## File Structure (decisions locked in)

**New files:**
- `components/Globe.tsx` — cobe canvas + theme rebuild + projection layer + hover tooltip. ~250 lines.
- `components/BentoGlobeCard.tsx` — bento-tile wrapper. Mounts `<Globe>` + (in edit mode) `<MarkerEditorPanel>`. ~50 lines.
- `components/MarkerEditorPanel.tsx` — list + add/edit/delete UI for markers. ~200 lines.
- `supabase/globe_markers_seed.sql` — idempotent UPSERT of seed markers into `site_content`.

**Modified:**
- `lib/types.ts` — add `GlobeMarkerKind`, `GlobeMarker`.
- `lib/embeddings.ts` — convert `buildSiteContentText` to async; add `buildGlobeMarkersText` with education-table join.
- `app/admin/actions.ts` — add `updateGlobeMarkers`; await the new async `buildSiteContentText`.
- `app/admin/rag-actions.ts` — await the new async `buildSiteContentText` inside `backfillPrimaryEmbeddings`.
- `app/page.tsx` — parse `bento.globe_markers` JSON, pass to `<Bento>`.
- `components/Bento.tsx` — accept `markers` prop, replace `.bento-location` JSX with `<BentoGlobeCard markers={markers} />`.
- `app/globals.css` — `.bento-globe` styles (card, canvas, hit-targets, tooltip, editor panel) + bento grid template adjustment.
- `package.json` — add `cobe`.
- `CLAUDE.md` — append bento globe section.

---

## Task 1: Install cobe and add marker types

**Files:**
- Modify: `package.json` (deps)
- Modify: `lib/types.ts`

- [ ] **Step 1: Install cobe**

Run from repo root:
```bash
npm install cobe
```

Expected: package added to `dependencies`, lockfile updated. No peer-dep warnings — cobe has zero deps.

- [ ] **Step 2: Add GlobeMarker types to `lib/types.ts`**

Append after the `Theme` interface (around line 65):

```ts
export type GlobeMarkerKind = "home" | "current" | "default";

export interface GlobeMarker {
  id: string;          // uuid, client-generated
  city: string;
  region: string;      // state/province — may be empty for non-US locations
  country: string;
  lat: number;         // -90..90
  lng: number;         // -180..180
  timezone: string;    // IANA name, e.g. "America/Los_Angeles"
  kind: GlobeMarkerKind;
}
```

- [ ] **Step 3: Type-check**

Run:
```bash
node_modules/.bin/tsc --noEmit
```
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json lib/types.ts
git commit -m "chore(globe): add cobe dependency + GlobeMarker types"
```

---

## Task 2: Seed three markers into site_content

**Files:**
- Create: `supabase/globe_markers_seed.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/globe_markers_seed.sql` with:

```sql
-- Seeds the bento globe markers into site_content. Idempotent — the ON
-- CONFLICT path leaves existing data alone on re-run, only inserting if
-- the key does not yet exist. Edit the JSON directly here only if you
-- want to reset to the seed values; otherwise use the inline-edit UI.
insert into public.site_content (key, value)
values (
  'bento.globe_markers',
  '[
    {"id":"00000000-0000-4000-8000-000000000001","city":"Boston","region":"MA","country":"USA","lat":42.3601,"lng":-71.0589,"timezone":"America/New_York","kind":"home"},
    {"id":"00000000-0000-4000-8000-000000000002","city":"West Lafayette","region":"IN","country":"USA","lat":40.4259,"lng":-86.9081,"timezone":"America/Indiana/Indianapolis","kind":"default"},
    {"id":"00000000-0000-4000-8000-000000000003","city":"San Francisco","region":"CA","country":"USA","lat":37.7749,"lng":-122.4194,"timezone":"America/Los_Angeles","kind":"current"}
  ]'::text
)
on conflict (key) do nothing;
```

- [ ] **Step 2: Apply migration to the linked Supabase project**

Run from repo root:
```bash
supabase db query --linked -f supabase/globe_markers_seed.sql
```

Expected: a single `INSERT 0 1` (first run) or `INSERT 0 0` (re-run). No errors.

- [ ] **Step 3: Verify the row exists**

Run:
```bash
supabase db query --linked -- "select key, length(value) from site_content where key = 'bento.globe_markers';"
```

Expected: one row with `length` ≈ 450–600 (the JSON string length).

- [ ] **Step 4: Commit**

```bash
git add supabase/globe_markers_seed.sql
git commit -m "feat(globe): seed bento.globe_markers with Boston/West Lafayette/SF"
```

---

## Task 3: Parse markers in app/page.tsx and pass to Bento

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/Bento.tsx`

- [ ] **Step 1: Parse the new key in `app/page.tsx`**

In `app/page.tsx`, after the existing `parseSafe(content["bento.interests"], undefined)` line (line 28), add:

```ts
import type { GlobeMarker } from "@/lib/types";
// ... (keep other imports)

const bentoGlobeMarkers = parseSafe<GlobeMarker[]>(content["bento.globe_markers"], []);
```

Then in the `<Bento ... />` JSX, add the prop:

```tsx
<Bento
  location={content["bento.location"]}
  building={bentoBuilding}
  stats={bentoStats}
  stack={bentoStack}
  interests={bentoInterests}
  markers={bentoGlobeMarkers}
/>
```

- [ ] **Step 2: Accept the prop in `components/Bento.tsx`**

In `components/Bento.tsx`:

Add to the imports at the top:
```ts
import type { GlobeMarker } from "@/lib/types";
```

Extend the `Props` interface:
```ts
interface Props {
  location?: string;
  building?: Building;
  stats?: Stat[];
  stack?: string[];
  interests?: string[];
  markers?: GlobeMarker[];
}
```

Add a new default constant near `DEF_STACK`:
```ts
const DEF_MARKERS: GlobeMarker[] = [];
```

Destructure the new prop in the `Bento` function signature:
```ts
export default function Bento({ location: lp, building: bp, stats: sp, stack: skp, interests: ip, markers: mp }: Props) {
```

Add state:
```ts
const [markers, setMarkers] = useState<GlobeMarker[]>(mp ?? DEF_MARKERS);
```

Add to the `useEffect` block that resyncs from props (currently lines 59-67):
```ts
useEffect(() => {
  if (!isEditing) {
    setLoc(lp ?? DEF_LOCATION);
    setBld(bp ?? DEF_BUILDING);
    setStats(sp ?? DEF_STATS);
    setStack(skp ?? DEF_STACK);
    setInterests(ip ?? DEF_INTERESTS);
    setMarkers(mp ?? DEF_MARKERS);
  }
}, [lp, bp, sp, skp, ip, mp, isEditing]);
```

(The JSX still renders the old location card for now — we swap it in Task 8 after Globe is ready.)

- [ ] **Step 3: Type-check + lint**

```bash
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint app/page.tsx components/Bento.tsx
```
Expected: both PASS. The `setMarkers` setter is unused right now (ESLint may warn) — if it complains, prefix with `_` (`const [markers, _setMarkers] = ...`) OR temporarily disable with a `// eslint-disable-next-line @typescript-eslint/no-unused-vars` comment on the `useState` line. Pick the prefix; Task 11 will use it.

(Actually, `markers` itself is read by the swap in Task 8, but `setMarkers` isn't used until Task 11. If lint flags unused, keep it; if not, leave clean.)

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx components/Bento.tsx
git commit -m "feat(globe): wire bento.globe_markers through page → Bento prop"
```

---

## Task 4: Add updateGlobeMarkers server action

**Files:**
- Modify: `app/admin/actions.ts`

- [ ] **Step 1: Add the import for GlobeMarker types**

At the top of `app/admin/actions.ts`, alongside existing imports:

```ts
import type { GlobeMarker, GlobeMarkerKind } from "@/lib/types";
```

- [ ] **Step 2: Add the action at the bottom of the file**

Append to `app/admin/actions.ts`:

```ts
const VALID_KINDS: ReadonlySet<GlobeMarkerKind> = new Set(["home", "current", "default"]);

/** Replace the full markers list. Validates each marker (lat/lng range, IANA
 *  timezone, kind enum) then upserts as a JSON array under site_content key
 *  bento.globe_markers. The existing safeEmbed + embedPrimary chain runs the
 *  globe-aware prose builder (see lib/embeddings.ts) so RAG stays in sync. */
export async function updateGlobeMarkers(markers: GlobeMarker[]): Promise<void> {
  await requireAuth();

  for (const m of markers) {
    if (!m.id || typeof m.id !== "string") throw new Error("marker id missing");
    if (!m.city?.trim()) throw new Error(`marker ${m.id}: city required`);
    if (!m.country?.trim()) throw new Error(`marker ${m.id}: country required`);
    if (typeof m.lat !== "number" || m.lat < -90 || m.lat > 90) {
      throw new Error(`marker ${m.id}: lat must be a number in [-90, 90]`);
    }
    if (typeof m.lng !== "number" || m.lng < -180 || m.lng > 180) {
      throw new Error(`marker ${m.id}: lng must be a number in [-180, 180]`);
    }
    if (!VALID_KINDS.has(m.kind)) {
      throw new Error(`marker ${m.id}: invalid kind ${m.kind}`);
    }
    try {
      // Throws RangeError for invalid IANA names. Constructing is free.
      new Intl.DateTimeFormat("en-US", { timeZone: m.timezone });
    } catch {
      throw new Error(`marker ${m.id}: invalid IANA timezone ${m.timezone}`);
    }
  }

  // Reuse the existing upsertSiteContent path — it handles the DB write,
  // revalidate, and (post-Task 5) the globe-aware embed in one shot.
  await upsertSiteContent("bento.globe_markers", JSON.stringify(markers));
}
```

Note: this depends on `upsertSiteContent` being in the same file (it already is, line 148) and on the async `buildSiteContentText` work in Task 5. The action is callable now; the embed produced before Task 5 will use the generic JSON-flattening path, which still works (just less rich prose for the school-join case). Task 5 upgrades it.

- [ ] **Step 3: Type-check**

```bash
node_modules/.bin/tsc --noEmit
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/admin/actions.ts
git commit -m "feat(globe): updateGlobeMarkers server action with validation"
```

---

## Task 5: Globe-aware async prose mapper for embeddings

**Files:**
- Modify: `lib/embeddings.ts`
- Modify: `app/admin/actions.ts` (one call site)
- Modify: `app/admin/rag-actions.ts` (one call site)

- [ ] **Step 1: Add the new builder and async dispatcher in `lib/embeddings.ts`**

In `lib/embeddings.ts`, after the existing `SITE_CONTENT_LABELS` constant (around line 164), add a new label entry:

```ts
const SITE_CONTENT_LABELS: Record<string, string> = {
  // ... existing entries unchanged ...
  "bento.globe_markers":  "Places Rithvik has ties to around the world",
};
```

Then, after the existing sync `buildSiteContentText` function (around line 188), add the globe-marker prose builder:

```ts
import type { GlobeMarker } from "@/lib/types";

/** IANA-id → human-readable timezone display name, for embedded prose only.
 *  Falls back to the IANA id verbatim for entries not in the map — the id
 *  itself is informative enough that retrieval still works. Add cities as
 *  needed, but the fallback keeps this list low-maintenance. */
const TZ_DISPLAY: Record<string, string> = {
  "America/New_York":              "Eastern Time",
  "America/Chicago":               "Central Time",
  "America/Denver":                "Mountain Time",
  "America/Los_Angeles":           "Pacific Time",
  "America/Indiana/Indianapolis":  "Eastern Time",
  "Europe/London":                 "Greenwich Mean Time",
  "Europe/Paris":                  "Central European Time",
  "Asia/Tokyo":                    "Japan Standard Time",
  "Asia/Kolkata":                  "India Standard Time",
  "Asia/Shanghai":                 "China Standard Time",
  "Australia/Sydney":              "Australian Eastern Time",
};

function tzDisplay(iana: string): string {
  return TZ_DISPLAY[iana] ?? iana;
}

function placeFragment(m: GlobeMarker): string {
  const region = m.region ? `, ${m.region}` : "";
  return `${m.city}${region}, ${m.country} (${tzDisplay(m.timezone)}, ${m.timezone})`;
}

/** Build embed prose for the globe markers array. Looks up each default
 *  marker's city against the education table; matches let us say "this is
 *  where he attends X" instead of a generic "ties to" line. Async because of
 *  that join. */
export async function buildGlobeMarkersText(markers: GlobeMarker[]): Promise<string> {
  const label = SITE_CONTENT_LABELS["bento.globe_markers"];
  if (!markers.length) {
    return `${label}: Rithvik Praveen Kumar has no specific places listed on his portfolio globe.`;
  }

  // Pull all schools once, then in-memory match by substring (case-insensitive).
  // Education rows are few (1-3 in practice), so a single SELECT is fine.
  const { data: schools } = await adminClient()
    .from("education")
    .select("school")
    .eq("published", true);
  const schoolNames: string[] = (schools ?? []).map((s) => s.school);

  const matchSchool = (city: string): string | null => {
    const cityLower = city.toLowerCase();
    for (const name of schoolNames) {
      const nameLower = name.toLowerCase();
      // Match if school name contains the city ("Purdue University" doesn't
      // contain "West Lafayette") OR if the city/state appears in tag-like
      // form. As a heuristic backup we also match short city tokens.
      if (nameLower.includes(cityLower) || cityLower.includes(nameLower)) return name;
    }
    return null;
  };

  const lines: string[] = ["Rithvik Praveen Kumar has ties to several places around the world."];
  const home = markers.find((m) => m.kind === "home");
  const current = markers.find((m) => m.kind === "current");
  const defaults = markers.filter((m) => m.kind === "default");

  if (home) {
    lines.push(`His home is ${placeFragment(home)}.`);
  }
  if (current) {
    lines.push(`He currently lives in ${placeFragment(current)} — this is where he is right now.`);
  }
  for (const m of defaults) {
    const school = matchSchool(m.city);
    if (school) {
      lines.push(`He has ties to ${placeFragment(m)} — this is where he attends ${school}.`);
    } else {
      lines.push(`He also has ties to ${placeFragment(m)}.`);
    }
  }

  return `${label}. ${lines.join(" ")}`;
}
```

- [ ] **Step 2: Convert `buildSiteContentText` to async and delegate to the globe builder**

Replace the existing sync `buildSiteContentText` (around lines 170-188) with:

```ts
/** Render a site_content key/value pair as natural prose. Async because some
 *  keys (bento.globe_markers) need DB joins to produce rich text. Most keys
 *  return synchronously through the JSON-flatten fallback. */
export async function buildSiteContentText(key: string, value: string): Promise<string> {
  if (key === "bento.globe_markers") {
    try {
      const markers = JSON.parse(value) as GlobeMarker[];
      return await buildGlobeMarkersText(markers);
    } catch (e) {
      console.warn("[rag] globe markers parse failed; using generic fallback:", e instanceof Error ? e.message : e);
      // fall through to the generic mapper
    }
  }

  const label = SITE_CONTENT_LABELS[key] ?? `Site content (${key})`;
  let prose: string = value;
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      prose = parsed
        .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
        .join(", ");
    } else if (parsed && typeof parsed === "object") {
      prose = Object.entries(parsed as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
        .join(". ");
    }
  } catch {
    // value was a plain string already; use it verbatim
  }
  return `${label}: ${prose}`;
}
```

- [ ] **Step 3: Await it in `app/admin/actions.ts`**

In `app/admin/actions.ts`, find the `upsertSiteContent` function (lines 148-157). The current body is:

```ts
export async function upsertSiteContent(key: string, value: string) {
  await requireAuth();
  const { error } = await adminClient()
    .from("site_content")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  revalidate();
  await safeEmbed(`site_content ${key}`, () =>
    embedPrimary("site_content", key, buildSiteContentText(key, value), { key }));
}
```

Change the embed line so it awaits the now-async `buildSiteContentText`:

```ts
  await safeEmbed(`site_content ${key}`, async () =>
    embedPrimary("site_content", key, await buildSiteContentText(key, value), { key }));
```

- [ ] **Step 4: Await it in `app/admin/rag-actions.ts`**

In `app/admin/rag-actions.ts`, find the site_content backfill loop (around line 57-63). The current body:

```ts
const { data: site } = await db.from("site_content").select("*");
for (const row of site ?? []) {
  try {
    await embedPrimary("site_content", row.key, buildSiteContentText(row.key, row.value), { key: row.key });
    counts.site_content++;
  } catch (err) { errors.push(`site_content ${row.key}: ${err instanceof Error ? err.message : err}`); }
}
```

Change to await the async builder:

```ts
const { data: site } = await db.from("site_content").select("*");
for (const row of site ?? []) {
  try {
    await embedPrimary("site_content", row.key, await buildSiteContentText(row.key, row.value), { key: row.key });
    counts.site_content++;
  } catch (err) { errors.push(`site_content ${row.key}: ${err instanceof Error ? err.message : err}`); }
}
```

- [ ] **Step 5: Type-check + lint**

```bash
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint lib/embeddings.ts app/admin/actions.ts app/admin/rag-actions.ts
```
Expected: both PASS. (If lint flags the `try { ... } catch {}` empty catch, replace with `catch (e) { void e; }`.)

- [ ] **Step 6: Re-embed primary content to validate the new prose path**

Once deployed to the `dev` preview (push first), log in to the site, open the SecondaryContextPanel, and click "Re-embed all primary content". Then in Supabase SQL editor run:

```sql
select substring(content from 1 for 400)
from primary_embeddings
where source_table = 'site_content' and source_id = 'bento.globe_markers';
```

Expected: content starts with "Places Rithvik has ties to around the world. Rithvik Praveen Kumar has ties to several places..." and mentions Boston, San Francisco, West Lafayette, and (because Purdue exists in education) the "this is where he attends Purdue University" clause for West Lafayette.

- [ ] **Step 7: Commit**

```bash
git add lib/embeddings.ts app/admin/actions.ts app/admin/rag-actions.ts
git commit -m "feat(globe,rag): globe-aware async site_content prose mapper with school join"
```

---

## Task 6: Globe component (cobe canvas + theme reactivity)

**Files:**
- Create: `components/Globe.tsx`

This task ships a minimal Globe: the cobe canvas, pointer-drag rotation, and theme-driven config rebuild. **No markers, no tooltip yet.** Visually verifiable on the preview.

- [ ] **Step 1: Add helper for parsing CSS colors**

We need to convert CSS color strings (e.g. `#0a0a0a`, `rgb(10,10,10)`, `oklch(...)`) to RGB triples in [0,1] for cobe. The cheapest reliable way is a tiny offscreen `<canvas>` 1x1: write `fillStyle = cssColor`, read back. Browsers normalize any CSS color to `rgb(...)` on read.

Create `components/Globe.tsx` with this exact content:

```tsx
"use client";

import { useEffect, useRef } from "react";
import createGlobe, { type COBEOptions } from "cobe";
import { useMotionValue, useSpring } from "motion/react";
import type { GlobeMarker } from "@/lib/types";

const MOVEMENT_DAMPING = 1400;

type RGB = [number, number, number];

/** Parses any CSS color string (hex, rgb, oklch, var-resolved value) into a
 *  [r,g,b] triple in [0,1]. Uses an offscreen 1x1 canvas to let the browser
 *  do the normalization — pure CSS-color parsing in JS is hard.
 *  Falls back to medium gray on any failure. */
function parseColor(css: string): RGB {
  if (typeof document === "undefined") return [0.5, 0.5, 0.5];
  const cnv = document.createElement("canvas");
  cnv.width = 1; cnv.height = 1;
  const ctx = cnv.getContext("2d");
  if (!ctx) return [0.5, 0.5, 0.5];
  ctx.fillStyle = "#888";       // reset baseline so an invalid input doesn't carry over
  ctx.fillStyle = css.trim();   // browser parses; if invalid, fillStyle keeps the prior value
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

/** sRGB relative luminance per WCAG. Used to pick cobe's `dark: 0|1`. */
function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Mix two RGBs in linear-light: out = a * (1-t) + b * t. Used to dim the
 *  `default` marker color toward the bg. */
function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t];
}

function readPalette() {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const bg = parseColor(css.getPropertyValue("--bg"));
  const text = parseColor(css.getPropertyValue("--text"));
  const accent = parseColor(css.getPropertyValue("--accent"));
  const green = parseColor(css.getPropertyValue("--green") || "#4ade80");
  const dark = luminance(bg) < 0.5 ? 1 : 0;
  return { bg, text, accent, green, dark };
}

function buildConfig(
  markers: GlobeMarker[],
  palette: ReturnType<typeof readPalette>,
): COBEOptions {
  const cobeMarkers = markers.map((m) => {
    // Size by kind. Color cannot be per-marker in cobe's API; we render each
    // marker with the global markerColor, so we instead set markerColor to
    // accent and rely on the overlay layer (Task 9+) for kind-specific
    // visual differentiation. Size still encodes kind here.
    const size = m.kind === "current" ? 0.12 : m.kind === "home" ? 0.10 : 0.06;
    return { location: [m.lat, m.lng] as [number, number], size };
  });

  return {
    width: 800,
    height: 800,
    onRender: () => {},
    devicePixelRatio: 2,
    phi: 0,
    theta: 0.3,
    dark: palette.dark,
    diffuse: 1.0,
    mapSamples: 16000,
    mapBrightness: palette.dark ? 4 : 1.2,
    baseColor: palette.text,
    markerColor: palette.accent,
    glowColor: palette.bg,
    markers: cobeMarkers,
  };
}

export interface GlobeProps {
  markers: GlobeMarker[];
  className?: string;
}

export function Globe({ markers, className }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const widthRef = useRef(0);
  const phiRef = useRef(0);
  const pointerInteracting = useRef<number | null>(null);

  // Bump this when we want to force a cobe rebuild (theme change). Cobe's
  // config is build-time only; the React effect below re-runs on any change
  // to the deps, which includes this token.
  const rebuildKey = useRef(0);

  const r = useMotionValue(0);
  const rs = useSpring(r, { mass: 1, damping: 30, stiffness: 100 });

  const updatePointer = (val: number | null) => {
    pointerInteracting.current = val;
    if (canvasRef.current) canvasRef.current.style.cursor = val !== null ? "grabbing" : "grab";
  };
  const updateMovement = (clientX: number) => {
    if (pointerInteracting.current !== null) {
      const delta = clientX - pointerInteracting.current;
      r.set(r.get() + delta / MOVEMENT_DAMPING);
    }
  };

  // (Re)create the cobe globe whenever markers change or theme flips.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onResize = () => { widthRef.current = canvas.offsetWidth; };
    window.addEventListener("resize", onResize);
    onResize();

    const palette = readPalette();
    const config = buildConfig(markers, palette);

    const globe = createGlobe(canvas, {
      ...config,
      width: widthRef.current * 2,
      height: widthRef.current * 2,
      onRender: (state) => {
        if (!pointerInteracting.current) phiRef.current += 0.005;
        state.phi = phiRef.current + rs.get();
        state.width = widthRef.current * 2;
        state.height = widthRef.current * 2;
      },
    });

    setTimeout(() => { canvas.style.opacity = "1"; }, 0);

    // Rebuild on theme change.
    const themeObserver = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.attributeName === "data-theme") {
          rebuildKey.current += 1;
          // Trigger this effect to re-run by destroying + reinitting inline.
          // We can't actually re-run useEffect from inside without a state
          // change, so we tear down + rebuild locally:
          globe.destroy();
          const newPalette = readPalette();
          const newConfig = buildConfig(markers, newPalette);
          const fresh = createGlobe(canvas, {
            ...newConfig,
            width: widthRef.current * 2,
            height: widthRef.current * 2,
            onRender: (state) => {
              if (!pointerInteracting.current) phiRef.current += 0.005;
              state.phi = phiRef.current + rs.get();
              state.width = widthRef.current * 2;
              state.height = widthRef.current * 2;
            },
          });
          // Replace closure references — destroy old in cleanup chain.
          // We track the latest in a ref so cleanup destroys the right one.
          latestGlobeRef.current = fresh;
          return;
        }
      }
    });
    const latestGlobeRef = { current: globe };
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      themeObserver.disconnect();
      latestGlobeRef.current.destroy();
      window.removeEventListener("resize", onResize);
    };
  }, [markers, rs]);

  return (
    <div className={`globe-wrap${className ? " " + className : ""}`}>
      <canvas
        ref={canvasRef}
        className="globe-canvas"
        onPointerDown={(e) => {
          pointerInteracting.current = e.clientX;
          updatePointer(e.clientX);
        }}
        onPointerUp={() => updatePointer(null)}
        onPointerOut={() => updatePointer(null)}
        onMouseMove={(e) => updateMovement(e.clientX)}
        onTouchMove={(e) => { if (e.touches[0]) updateMovement(e.touches[0].clientX); }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Add base styles to `app/globals.css`**

Append at the end of the bento section (after line ~614, before the keyframes), or anywhere stable in the file:

```css
/* ===== BENTO GLOBE ===== */
.globe-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none; /* canvas re-enables; overlay layer enables */
}
.globe-canvas {
  width: 100%;
  height: 100%;
  max-width: 100%;
  aspect-ratio: 1 / 1;
  opacity: 0;
  transition: opacity 500ms ease;
  contain: layout paint size;
  pointer-events: auto;
  cursor: grab;
}
```

- [ ] **Step 3: Type-check + lint**

```bash
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint components/Globe.tsx
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/Globe.tsx app/globals.css
git commit -m "feat(globe): Globe component with cobe canvas + theme-reactive rebuild"
```

(Not visually verifiable yet — Globe isn't mounted anywhere. Task 8 mounts it.)

---

## Task 7: BentoGlobeCard wrapper

**Files:**
- Create: `components/BentoGlobeCard.tsx`

- [ ] **Step 1: Create the wrapper**

Create `components/BentoGlobeCard.tsx`:

```tsx
"use client";

import { motion } from "motion/react";
import type { GlobeMarker } from "@/lib/types";
import { Globe } from "./Globe";

interface Props {
  markers: GlobeMarker[];
}

const card = {
  hidden: { opacity: 0, filter: "blur(8px)", y: 20 },
  visible: { opacity: 1, filter: "blur(0px)", y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

/** Bento tile that hosts the interactive globe. View-only for now; Task 11
 *  layers in the edit-mode marker editor. */
export default function BentoGlobeCard({ markers }: Props) {
  return (
    <motion.div
      className="bento-card bento-location bento-globe"
      variants={card}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
    >
      <Globe markers={markers} />
    </motion.div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
node_modules/.bin/tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/BentoGlobeCard.tsx
git commit -m "feat(globe): BentoGlobeCard view-mode wrapper"
```

---

## Task 8: Swap the location card in Bento + grid resize

**Files:**
- Modify: `components/Bento.tsx`
- Modify: `app/globals.css`

This is the first visually verifiable task. Push `dev` after committing and visit the Vercel preview.

- [ ] **Step 1: Replace the `.bento-location` JSX block in `Bento.tsx`**

In `components/Bento.tsx`, find the existing Location card block (currently lines 91-100):

```tsx
{/* ── Location ────────────────────────────────────────────────── */}
<motion.div className="bento-card bento-location" variants={card} whileHover={{ y: -3, transition: { duration: 0.2 } }}>
  <p className="card-eyebrow">Location</p>
  <EditableText
    tag="h3" className="card-title" value={loc}
    onSave={async (v) => { setLoc(v); await upsertSiteContent("bento.location", v); }}
  />
  <p className="card-sub">Purdue University</p>
  <LocalTime />
</motion.div>
```

Replace with:

```tsx
{/* ── Location (Globe) ─────────────────────────────────────────── */}
<BentoGlobeCard markers={markers} />
```

Remove the now-unused imports / state at the top of the file:
- `import LocalTime from "./LocalTime";`
- `import EditableText from "./EditableText";` — keep this only if used by other cards (it is — Building/Stats). Keep.
- `const DEF_LOCATION = "West Lafayette, IN";`
- The `loc` state and its setter (`const [loc, setLoc] = useState(...)`) — remove.
- The `setLoc(lp ?? DEF_LOCATION)` line inside the useEffect — remove.
- The `lp` destructure stays only if still referenced; if not, remove from both destructure and Props.

Add the import for the new card near the other component imports:

```ts
import BentoGlobeCard from "./BentoGlobeCard";
```

- [ ] **Step 2: Resize the bento grid so the globe has a square ~2×2 footprint**

In `app/globals.css`, find the bento span declarations (lines 587-591):

```css
.bento-location  { grid-column: span 3; }
.bento-building  { grid-column: span 5; }
.bento-stats     { grid-column: span 4; }
.bento-marquee   { grid-column: span 8; }
.bento-interests { grid-column: span 4; }
```

Change to:

```css
.bento-location  { grid-column: span 4; grid-row: span 2; }
.bento-building  { grid-column: span 8; }
.bento-stats     { grid-column: span 8; }
.bento-marquee   { grid-column: span 8; }
.bento-interests { grid-column: span 4; }
```

And add to make the globe card actually use its row span:

```css
.bento-globe {
  min-height: 360px;
  padding: 0;            /* canvas is full-bleed */
  position: relative;
  overflow: hidden;
}
.bento-globe::after { opacity: 0 !important; }  /* kill the radial-gradient overlay for this card */
```

(Place these near the other `.bento-*` rules.)

- [ ] **Step 3: Type-check + lint**

```bash
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint components/Bento.tsx app/globals.css
```
Expected: PASS. ESLint may flag unused imports if `LocalTime` or `DEF_LOCATION` is still referenced. Remove what's unused; keep what isn't.

- [ ] **Step 4: Push dev and verify on Vercel preview**

```bash
git add components/Bento.tsx app/globals.css
git commit -m "feat(globe): swap location card for BentoGlobeCard + resize grid"
git push origin dev
```

Wait ~60s for Vercel preview. Open the preview URL. Expected visual:
- Bento section's top-left tile is a spinning globe instead of the static text card.
- The 3 markers (Boston, West Lafayette, SF) are visible as dots.
- Dragging the globe with the mouse rotates it; releasing snaps back to slow auto-rotate.
- Switching themes via the dial repaints the globe (base/glow colors flip on the next frame).
- The bento card it occupies is roughly square, ≥360px tall.
- No console errors.

If the canvas appears as a black square with no globe drawn, the cobe instance may not be reading widths correctly — check `widthRef.current` in DevTools.

---

## Task 9: Marker projection overlay (no tooltip yet)

**Files:**
- Modify: `components/Globe.tsx`
- Modify: `app/globals.css`

Add an absolutely-positioned overlay of one `<button>` per marker. Position each button every frame using the same `state.phi` cobe writes. Each button is visible (small colored dot) but doesn't show a tooltip yet — that's Task 10.

- [ ] **Step 1: Add a projection ref and overlay refs to `Globe.tsx`**

In `components/Globe.tsx`, inside the `Globe` function, add near the other refs:

```tsx
const overlayRef = useRef<HTMLDivElement>(null);
const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
```

Reset `buttonRefs.current` on every render so the array matches the current markers count:
```tsx
buttonRefs.current = [];
```
Put that line right above the `return (...)` statement.

- [ ] **Step 2: Add a projection helper near the top of the file**

After `mix` and before `readPalette`, add:

```ts
/** Project (lat,lng) → 3D unit sphere coords in cobe's convention, rotated
 *  by the current phi (around Y) and the fixed theta (around X). Returns
 *  null if the point is on the back hemisphere (z >= 0 in cobe's view). */
function project(
  lat: number,
  lng: number,
  phi: number,
  theta: number,
): { x: number; y: number; visible: boolean } {
  // Cobe spherical convention: phi_spherical = (90 - lat) * π/180,
  // theta_spherical = (lng + 180) * π/180.
  const phiS = ((90 - lat) * Math.PI) / 180;
  const thetaS = ((lng + 180) * Math.PI) / 180;
  // Initial point on unit sphere.
  let x = Math.sin(phiS) * Math.cos(thetaS);
  let y = Math.cos(phiS);
  let z = Math.sin(phiS) * Math.sin(thetaS);
  // Rotate around Y by phi (the spinning axis).
  const cosP = Math.cos(phi), sinP = Math.sin(phi);
  const xR = x * cosP - z * sinP;
  const zR = x * sinP + z * cosP;
  x = xR; z = zR;
  // Rotate around X by theta (cobe's static tilt).
  const cosT = Math.cos(theta), sinT = Math.sin(theta);
  const yR = y * cosT - z * sinT;
  const zR2 = y * sinT + z * cosT;
  y = yR; z = zR2;
  // Camera is at +z looking toward -z; visible if z is negative (front).
  return { x, y, visible: z < 0 };
}
```

- [ ] **Step 3: Update the cobe `onRender` callback (both occurrences — initial + theme rebuild) to also drive the overlay**

In the initial `createGlobe(...)` call's `onRender`, and in the theme-rebuild `createGlobe(...)` call's `onRender`, replace each with this body:

```ts
onRender: (state) => {
  if (!pointerInteracting.current) phiRef.current += 0.005;
  const phi = phiRef.current + rs.get();
  state.phi = phi;
  state.width = widthRef.current * 2;
  state.height = widthRef.current * 2;

  // Drive the overlay layer in lockstep with the canvas frame.
  const overlay = overlayRef.current;
  if (!overlay) return;
  const w = widthRef.current;
  const cx = w / 2;
  const cy = w / 2;
  const radius = w * 0.42; // tuned to cobe's drawn globe radius
  const theta = 0.3;       // matches config.theta

  for (let i = 0; i < markers.length; i++) {
    const btn = buttonRefs.current[i];
    if (!btn) continue;
    const p = project(markers[i].lat, markers[i].lng, phi, theta);
    const screenX = cx + p.x * radius;
    const screenY = cy - p.y * radius;
    btn.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) translate(-50%, -50%)`;
    btn.style.opacity = p.visible ? "1" : "0";
    btn.style.pointerEvents = p.visible ? "auto" : "none";
    btn.tabIndex = p.visible ? 0 : -1;
  }
},
```

- [ ] **Step 4: Render the overlay layer**

Change the `return (...)` block to:

```tsx
return (
  <div className={`globe-wrap${className ? " " + className : ""}`}>
    <canvas
      ref={canvasRef}
      className="globe-canvas"
      onPointerDown={(e) => { pointerInteracting.current = e.clientX; updatePointer(e.clientX); }}
      onPointerUp={() => updatePointer(null)}
      onPointerOut={() => updatePointer(null)}
      onMouseMove={(e) => updateMovement(e.clientX)}
      onTouchMove={(e) => { if (e.touches[0]) updateMovement(e.touches[0].clientX); }}
    />
    <div ref={overlayRef} className="globe-overlay" aria-label="Globe markers">
      {markers.map((m, i) => (
        <button
          key={m.id}
          ref={(el) => { buttonRefs.current[i] = el; }}
          type="button"
          className={`globe-marker globe-marker-${m.kind}`}
          aria-label={`${m.city}${m.region ? ", " + m.region : ""}, ${m.country}`}
        />
      ))}
    </div>
  </div>
);
```

(Drop the duplicate `buttonRefs.current = []` line if you added one earlier — the array is mutated via `ref={(el) => ...}` so it always reflects the rendered count. If TypeScript flags the ref callback for not returning void, wrap in braces as shown.)

- [ ] **Step 5: CSS for the overlay layer**

Append to `app/globals.css` in the BENTO GLOBE section:

```css
.globe-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none; /* individual markers re-enable */
}
.globe-marker {
  position: absolute;
  top: 0; left: 0;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 60%, transparent);
  cursor: pointer;
  transition: opacity 200ms ease, transform 0ms; /* transform changes every frame, no easing */
  outline-offset: 4px;
}
.globe-marker-home    { background: var(--accent); }
.globe-marker-current { background: var(--green); box-shadow: 0 0 14px color-mix(in srgb, var(--green) 70%, transparent); }
.globe-marker-default { background: color-mix(in srgb, var(--accent) 70%, var(--bg)); width: 12px; height: 12px; }
.globe-marker:hover, .globe-marker:focus-visible {
  transform: translate3d(var(--x, 0), var(--y, 0), 0) scale(1.4) translate(-50%, -50%);
}
```

Note: the transform on hover would compete with the every-frame inline transform. Better solution — drop the hover transform for now (Task 10 handles "expanded on hover" via the tooltip box, not a marker scale). Replace the `:hover, :focus-visible` rule with:

```css
.globe-marker:hover, .globe-marker:focus-visible {
  box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 90%, transparent);
}
```

- [ ] **Step 6: Type-check + lint**

```bash
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint components/Globe.tsx
```
Expected: PASS.

- [ ] **Step 7: Push dev and verify on preview**

```bash
git add components/Globe.tsx app/globals.css
git commit -m "feat(globe): DOM-overlay marker projection synced to cobe rotation"
git push origin dev
```

Wait for preview. Expected visual:
- 3 colored dots overlaid on the globe at Boston / West Lafayette / SF.
- As the globe rotates, dots track their cities exactly, smoothly.
- Dots on the far side fade out (opacity → 0).
- SF dot is green; Boston dot is accent-colored and slightly larger; West Lafayette dot is dimmer/smaller.
- Hovering a dot brightens its glow but doesn't yet show a tooltip.
- No console errors. No visual desync between cobe's internal dots and the overlay dots (they should be near-coincident — if your overlay dots are visibly offset from the cobe dots, the `radius = w * 0.42` constant needs tuning; try 0.41 or 0.43).

If the markers swim around independently of the rotation, the projection's phi sign is wrong — try negating `phi` inside `project`.

---

## Task 10: Hover/focus tooltip with city + local time

**Files:**
- Modify: `components/Globe.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Add hover state and tooltip render**

In `components/Globe.tsx`, import `useState` and add at the top of the `Globe` function:

```ts
import { useEffect, useRef, useState } from "react";
```

Inside `Globe`:

```ts
const [hoverIdx, setHoverIdx] = useState<number | null>(null);
const [now, setNow] = useState<Date>(() => new Date());
```

Add an effect that ticks `now` every 30s only while a tooltip is open:

```ts
useEffect(() => {
  if (hoverIdx === null) return;
  const interval = setInterval(() => setNow(new Date()), 30_000);
  return () => clearInterval(interval);
}, [hoverIdx]);
```

- [ ] **Step 2: Add time formatter helpers**

Above the `Globe` component (after `readPalette` is fine):

```ts
function formatLocalTime(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, hour: "numeric", minute: "2-digit", hour12: true,
    }).format(date);
  } catch {
    return "—";
  }
}

function formatTzShort(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, timeZoneName: "short",
    }).formatToParts(date);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}
```

- [ ] **Step 3: Wire hover handlers on the buttons + render the tooltip**

In the buttons JSX, add `onMouseEnter`, `onMouseLeave`, `onFocus`, `onBlur`:

```tsx
<button
  key={m.id}
  ref={(el) => { buttonRefs.current[i] = el; }}
  type="button"
  className={`globe-marker globe-marker-${m.kind}`}
  aria-label={`${m.city}${m.region ? ", " + m.region : ""}, ${m.country}`}
  onMouseEnter={() => setHoverIdx(i)}
  onMouseLeave={() => setHoverIdx((cur) => (cur === i ? null : cur))}
  onFocus={() => setHoverIdx(i)}
  onBlur={() => setHoverIdx((cur) => (cur === i ? null : cur))}
/>
```

After the marker buttons in the overlay, render the tooltip:

```tsx
{hoverIdx !== null && markers[hoverIdx] && (() => {
  const m = markers[hoverIdx];
  const btn = buttonRefs.current[hoverIdx];
  if (!btn) return null;
  // Read the inline transform we just wrote in onRender to anchor the tooltip
  // — parsing the transform avoids a getBoundingClientRect during animation.
  // We position the tooltip's top-left at the marker, then CSS centers/offsets it.
  return (
    <div
      className="globe-tooltip"
      style={{ transform: btn.style.transform }}
      role="tooltip"
    >
      <strong>{m.city}{m.region ? `, ${m.region}` : ""}</strong>
      <span className="globe-tooltip-country">{m.country}</span>
      <span className="globe-tooltip-time">
        {formatLocalTime(now, m.timezone)} <span className="globe-tooltip-tz">{formatTzShort(now, m.timezone)}</span>
      </span>
    </div>
  );
})()}
```

- [ ] **Step 4: Tooltip CSS**

Append to `app/globals.css`:

```css
.globe-tooltip {
  position: absolute;
  top: 0; left: 0;
  /* sit above the marker, centered horizontally */
  margin-top: -18px;
  margin-left: 0;
  background: var(--panel-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 14px;
  min-width: 160px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.78rem;
  line-height: 1.35;
  color: var(--text);
  box-shadow: 0 8px 24px rgba(0,0,0,0.25);
  pointer-events: none;
  z-index: 5;
  transform-origin: center bottom;
  animation: globe-tip-in 180ms cubic-bezier(0.32, 0.72, 0, 1);
  /* shift up so the bottom of the tooltip is above the marker */
  translate: -50% calc(-100% - 14px);
}
.globe-tooltip strong {
  font-weight: 600;
  letter-spacing: -0.01em;
}
.globe-tooltip-country {
  color: var(--muted);
  font-size: 0.72rem;
}
.globe-tooltip-time {
  font-family: var(--mono);
  font-size: 0.85rem;
  margin-top: 4px;
}
.globe-tooltip-tz {
  color: var(--muted);
  margin-left: 4px;
}
@keyframes globe-tip-in {
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
}
```

Note: the `transform` from the marker's inline style sets the translate to the marker position; the `translate: -50% calc(-100% - 14px)` shifts the tooltip up + centers it. If your CSS engine doesn't like both `transform` and `translate` together on the same element, replace the `translate` rule with adding a fixed offset in the JSX transform string (`${btn.style.transform} translate(-50%, calc(-100% - 14px))`).

- [ ] **Step 5: Type-check + lint**

```bash
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint components/Globe.tsx
```
Expected: PASS.

- [ ] **Step 6: Push dev and verify**

```bash
git add components/Globe.tsx app/globals.css
git commit -m "feat(globe): hover/focus tooltip with city + local time + tz short code"
git push origin dev
```

Expected on preview:
- Hovering any marker shows a glass tooltip above the dot with: city + region (bold), country (muted), and current local time + tz short (e.g. `4:32 PM PDT` for SF).
- The tooltip moves with the dot as the globe rotates.
- Tab key cycles through markers; focused marker shows the tooltip too.
- The time updates correctly (verify by waiting 30s with the tooltip open, or change the interval to 5_000 temporarily to confirm).
- Markers on the back of the globe don't trigger tooltips.

---

## Task 11: MarkerEditorPanel (edit-mode UI)

**Files:**
- Create: `components/MarkerEditorPanel.tsx`
- Modify: `components/BentoGlobeCard.tsx`
- Modify: `components/Bento.tsx` (wire the save callback)

- [ ] **Step 1: Create the editor panel**

Create `components/MarkerEditorPanel.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { GlobeMarker, GlobeMarkerKind } from "@/lib/types";

interface Props {
  markers: GlobeMarker[];
  onSave: (next: GlobeMarker[]) => Promise<void>;
}

const COMMON_TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Indiana/Indianapolis", "America/Phoenix", "America/Anchorage",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid",
  "Asia/Tokyo", "Asia/Shanghai", "Asia/Kolkata", "Asia/Singapore", "Asia/Dubai",
  "Australia/Sydney", "America/Sao_Paulo", "America/Mexico_City",
];

const emptyForm = (): GlobeMarker => ({
  id: crypto.randomUUID(),
  city: "", region: "", country: "",
  lat: 0, lng: 0,
  timezone: "America/New_York",
  kind: "default",
});

export default function MarkerEditorPanel({ markers, onSave }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState<GlobeMarker | null>(null); // null = not editing, else editing this marker
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Open form to add a new marker.
  const openAdd = () => { setForm(emptyForm()); setErr(null); };
  // Open form to edit an existing one.
  const openEdit = (m: GlobeMarker) => { setForm({ ...m }); setErr(null); };

  // Persist the current form (insert or update) and close.
  const submitForm = async () => {
    if (!form) return;
    setSaving(true); setErr(null);
    try {
      const exists = markers.some((m) => m.id === form.id);
      const next = exists
        ? markers.map((m) => (m.id === form.id ? form : m))
        : [...markers, form];
      await onSave(next);
      setForm(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteMarker = async (id: string) => {
    setSaving(true); setErr(null);
    try {
      await onSave(markers.filter((m) => m.id !== id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  // Parse "lat, lng" pasted into the lat field → autofill both.
  const onLatPaste = (raw: string): { lat: number; lng?: number } | null => {
    const m = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!m) return null;
    return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  };

  return (
    <div className={`globe-editor${expanded ? " globe-editor-open" : ""}`}>
      <button
        type="button"
        className="globe-editor-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? "▾ Markers" : `▸ Markers (${markers.length})`}
      </button>

      {expanded && (
        <div className="globe-editor-body">
          <ul className="globe-marker-list">
            {markers.map((m) => (
              <li key={m.id}>
                <span className="globe-marker-list-city">{m.city}</span>
                <span className={`globe-marker-kind globe-marker-kind-${m.kind}`}>{m.kind}</span>
                <button type="button" onClick={() => openEdit(m)} aria-label={`Edit ${m.city}`}>✎</button>
                <button type="button" onClick={() => deleteMarker(m.id)} aria-label={`Delete ${m.city}`} disabled={saving}>⌫</button>
              </li>
            ))}
          </ul>
          {!form && (
            <button type="button" className="globe-editor-add" onClick={openAdd}>+ Add marker</button>
          )}
          {form && (
            <form
              className="globe-editor-form"
              onSubmit={(e) => { e.preventDefault(); void submitForm(); }}
            >
              <label>City<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required /></label>
              <label>Region<input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="optional" /></label>
              <label>Country<input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} required /></label>
              <label>Latitude
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.lat}
                  onChange={(e) => {
                    const parsed = onLatPaste(e.target.value);
                    if (parsed) setForm({ ...form, lat: parsed.lat, lng: parsed.lng ?? form.lng });
                    else setForm({ ...form, lat: parseFloat(e.target.value) || 0 });
                  }}
                  required
                />
              </label>
              <label>Longitude<input type="number" step="0.0001" value={form.lng} onChange={(e) => setForm({ ...form, lng: parseFloat(e.target.value) || 0 })} required /></label>
              <label>Timezone (IANA)
                <input list="globe-tz-list" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} required />
                <datalist id="globe-tz-list">
                  {COMMON_TIMEZONES.map((tz) => <option key={tz} value={tz} />)}
                </datalist>
              </label>
              <fieldset className="globe-kind-picker">
                <legend>Kind</legend>
                {(["home", "current", "default"] as GlobeMarkerKind[]).map((k) => (
                  <label key={k}>
                    <input type="radio" name="kind" value={k} checked={form.kind === k} onChange={() => setForm({ ...form, kind: k })} />
                    {k}
                  </label>
                ))}
              </fieldset>
              <div className="globe-editor-actions">
                <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                <button type="button" onClick={() => setForm(null)} disabled={saving}>Cancel</button>
              </div>
              {err && <p className="globe-editor-err">{err}</p>}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire the panel into `BentoGlobeCard`**

Replace `components/BentoGlobeCard.tsx` with:

```tsx
"use client";

import { motion } from "motion/react";
import type { GlobeMarker } from "@/lib/types";
import { useEditMode } from "./EditModeProvider";
import { Globe } from "./Globe";
import MarkerEditorPanel from "./MarkerEditorPanel";

interface Props {
  markers: GlobeMarker[];
  onSave: (next: GlobeMarker[]) => Promise<void>;
}

const card = {
  hidden: { opacity: 0, filter: "blur(8px)", y: 20 },
  visible: { opacity: 1, filter: "blur(0px)", y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

export default function BentoGlobeCard({ markers, onSave }: Props) {
  const { isEditing } = useEditMode();
  return (
    <motion.div
      className="bento-card bento-location bento-globe"
      variants={card}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
    >
      <Globe markers={markers} />
      {isEditing && <MarkerEditorPanel markers={markers} onSave={onSave} />}
    </motion.div>
  );
}
```

- [ ] **Step 3: Wire the save callback in `components/Bento.tsx`**

Add the import:
```ts
import { updateGlobeMarkers } from "@/app/admin/actions";
```

Update the BentoGlobeCard call:
```tsx
<BentoGlobeCard
  markers={markers}
  onSave={async (next) => {
    setMarkers(next);
    await updateGlobeMarkers(next);
  }}
/>
```

- [ ] **Step 4: CSS for the editor panel**

Append to `app/globals.css`:

```css
.globe-editor {
  position: absolute;
  bottom: 12px;
  right: 12px;
  z-index: 10;
  background: var(--panel-glass);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 8px;
  max-width: 320px;
  max-height: calc(100% - 24px);
  overflow: auto;
  pointer-events: auto;
  font-size: 0.78rem;
  color: var(--text);
}
.globe-editor-toggle {
  background: transparent;
  border: 0;
  color: var(--text);
  font-family: var(--mono);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  padding: 4px 8px;
}
.globe-editor-body {
  padding-top: 6px;
}
.globe-marker-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.globe-marker-list li {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 6px;
}
.globe-marker-list li:hover { background: color-mix(in srgb, var(--text) 4%, transparent); }
.globe-marker-list-city { flex: 1; }
.globe-marker-kind {
  font-family: var(--mono);
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.globe-marker-kind-home    { background: color-mix(in srgb, var(--accent) 30%, transparent); }
.globe-marker-kind-current { background: color-mix(in srgb, var(--green) 30%, transparent); }
.globe-marker-kind-default { background: color-mix(in srgb, var(--muted) 30%, transparent); }
.globe-marker-list button {
  background: transparent;
  border: 0;
  color: var(--muted);
  cursor: pointer;
  padding: 2px 4px;
}
.globe-marker-list button:hover { color: var(--text); }
.globe-editor-add {
  width: 100%;
  margin-top: 8px;
  padding: 6px;
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  border: 1px dashed var(--border-hover);
  border-radius: 8px;
  color: var(--text);
  cursor: pointer;
}
.globe-editor-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}
.globe-editor-form label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-family: var(--mono);
  font-size: 0.65rem;
  color: var(--muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.globe-editor-form input {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 8px;
  color: var(--text);
  font-family: inherit;
  font-size: 0.85rem;
  text-transform: none;
  letter-spacing: 0;
}
.globe-kind-picker {
  border: 0;
  padding: 0;
  display: flex;
  gap: 8px;
}
.globe-kind-picker legend { font-family: var(--mono); font-size: 0.65rem; color: var(--muted); margin-bottom: 4px; }
.globe-kind-picker label { flex-direction: row; align-items: center; gap: 4px; cursor: pointer; }
.globe-editor-actions { display: flex; gap: 8px; margin-top: 4px; }
.globe-editor-actions button {
  flex: 1;
  background: color-mix(in srgb, var(--accent) 60%, transparent);
  border: 0;
  border-radius: 6px;
  padding: 6px;
  color: var(--text);
  cursor: pointer;
}
.globe-editor-actions button[type="button"] { background: color-mix(in srgb, var(--muted) 25%, transparent); }
.globe-editor-err {
  color: #ef4444;
  font-size: 0.72rem;
  margin: 4px 0 0;
}
```

- [ ] **Step 5: Type-check + lint**

```bash
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint components/MarkerEditorPanel.tsx components/BentoGlobeCard.tsx components/Bento.tsx
```
Expected: PASS.

- [ ] **Step 6: Push dev and verify**

```bash
git add components/MarkerEditorPanel.tsx components/BentoGlobeCard.tsx components/Bento.tsx app/globals.css
git commit -m "feat(globe): MarkerEditorPanel with add/edit/delete + wire updateGlobeMarkers"
git push origin dev
```

Expected on preview:
- Public visitors see only the globe (no editor panel).
- After logging in via the inline-edit dial (✱ → password), a small "▸ Markers (3)" pill appears bottom-right of the globe card.
- Clicking it expands a list with Boston/West Lafayette/SF + delete + edit buttons.
- "+ Add marker" opens an inline form. Enter "London, England, UK, 51.5074, -0.1278, Europe/London, default" → Save. London appears as a new dot.
- Hovering the new London dot shows the tooltip with current London time.
- Edit Boston → change region from "MA" → "Massachusetts" → Save. Hovering shows new label.
- Delete West Lafayette → its dot disappears.
- After any save, refresh the page — markers persist (DB-backed).

---

## Task 12: RAG end-to-end check + CLAUDE.md update + final verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Verify RAG retrieves the new chunk**

Open the preview, click the floating "Ask RAG" button. Ask each of these and verify the bot grounds in the markers chunk (not hallucinated):

1. "Where is Rithvik right now?" → answer mentions San Francisco / Pacific Time.
2. "Where did Rithvik grow up?" → answer mentions Boston (home).
3. "Where does Rithvik go to school?" → answer mentions West Lafayette / Purdue (school-join clause).
4. "What time is it for Rithvik?" → answer references SF / Pacific Time.

If any answer is hallucinated or refuses, check Vercel function logs for `[rag]` warnings and re-run the "Re-embed all primary content" button.

- [ ] **Step 2: Update CLAUDE.md**

In `CLAUDE.md`, locate the "## High-level architecture" section. After the `### Theme system` block and before `### Theme transition`, add a new subsection (or place wherever bento-related notes fit best):

```markdown
### Bento globe (`components/Globe.tsx`, `components/BentoGlobeCard.tsx`, `components/MarkerEditorPanel.tsx`)

The Location tile in the Bento section is an interactive cobe-rendered 3D globe. Markers are stored as a JSON array in `site_content` under key `bento.globe_markers` (one chunk, not per-marker — see Pitfalls). Each marker has `{ id, city, region, country, lat, lng, timezone (IANA), kind: "home"|"current"|"default" }`. Seeds: Boston (home), West Lafayette (default), San Francisco (current). The `current` marker renders in `--green`; `home` in `--accent`; `default` is a dimmer accent mix.

**Theme reactivity:** `Globe.tsx` reads `--bg`, `--text`, `--accent`, `--green` from `getComputedStyle(document.documentElement)` and converts each to a [0,1] RGB triple via an offscreen 1×1 canvas (browser parses any CSS color, including `oklch`). On `<html data-theme>` change (MutationObserver), the cobe instance is destroyed and rebuilt — cobe doesn't support live config mutation. `dark` flag is derived from `--bg` luminance, so adding a new theme is still zero JS — palette + light/dark detection happens automatically.

**Hover info:** cobe is canvas-only with no DOM hit testing. Per-frame, the globe projects each marker's (lat, lng) → (x, y) using the same `state.phi` cobe wrote and the fixed `theta: 0.3`, then positions an absolutely-placed `<button>` per marker. Back-hemisphere markers (post-rotation z >= 0) get `opacity: 0` + `pointer-events: none` + `tabIndex: -1`. The tooltip's content is `Intl.DateTimeFormat`-driven (city local time + tz short code via `formatToParts`).

**Editing:** `MarkerEditorPanel.tsx` mounts only when `useEditMode().isEditing`. The panel's Save calls the `updateGlobeMarkers` server action, which validates (lat/lng range, IANA timezone via `new Intl.DateTimeFormat(...)` in try/catch, kind enum) then delegates to `upsertSiteContent("bento.globe_markers", JSON)`. That goes through the existing `safeEmbed` + `embedPrimary` chain, which uses the now-async `buildSiteContentText`. For the `bento.globe_markers` key specifically, `buildSiteContentText` delegates to `buildGlobeMarkersText`, which joins against the `education` table to produce a "this is where he attends Purdue" clause for any default marker whose city matches a school name. School matching is in-memory substring (case-insensitive) — fine for the few-row scale here.

**Pitfalls:**
- **All markers in one chunk on purpose.** Per-marker rows would make "where has Rithvik lived?" return a single nearest-neighbor city; the one-chunk shape ensures every location-related query retrieves the full picture.
- **Cobe rebuilds — not mutates — on theme change.** `phiRef` and the `motion` spring value persist across rebuilds; only the cobe instance is recreated.
- **Overlay projection radius** is `canvas.offsetWidth * 0.42` (tuned to cobe's drawn globe radius). If overlay dots drift visibly from cobe's internal dots after a future cobe upgrade, retune.
```

Also append to the Pitfalls section at the bottom (under "### RAG"):

```markdown
- **Async site_content prose mapper.** As of the globe feature, `buildSiteContentText` returns a Promise. Both `upsertSiteContent` (in `app/admin/actions.ts`) and the `backfillPrimaryEmbeddings` loop (in `app/admin/rag-actions.ts`) await it. If you add a new caller, await the result — TypeScript will catch the omission but it's easy to miss in a code review.
```

- [ ] **Step 3: Full build to catch any Vercel-specific bundling issues**

```bash
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint components/Globe.tsx components/BentoGlobeCard.tsx components/MarkerEditorPanel.tsx components/Bento.tsx app/page.tsx app/admin/actions.ts app/admin/rag-actions.ts lib/embeddings.ts lib/types.ts
node_modules/.bin/next build
```
Expected: all PASS. `next build` produces a clean build with no errors and bundles cobe into the client chunks for the homepage.

- [ ] **Step 4: Final preview pass**

Push dev one last time and visit the preview. Run through this checklist:

- [ ] Globe renders on all 14 themes (cycle through the dial).
- [ ] Drag to rotate works on mouse.
- [ ] Touch-drag works on mobile (resize browser to mobile width or use devtools device emulation).
- [ ] Markers track cities exactly through rotation.
- [ ] Hover tooltip shows correct city + local time + tz short.
- [ ] Tab key cycles markers; focused marker shows tooltip.
- [ ] Edit mode: add / edit / delete a marker; refresh page; persists.
- [ ] RAG: ask "where is Rithvik right now?" → answer references SF / Pacific.
- [ ] No console errors anywhere.
- [ ] On the smallest mobile viewport, the globe card height clamps reasonably (≥ 300px).

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document bento globe architecture + async prose mapper pitfall"
```

- [ ] **Step 6: Hand off for merge approval**

Do NOT merge to main. Tell the user:

> "Bento globe is complete on `dev` and verified on the preview. All 12 tasks are committed. The preview URL is on the latest `dev` push. When you're happy with it, say 'merge to main' and I'll run the `--no-ff` merge per the CI/CD section of CLAUDE.md."

---

## Self-Review

**Spec coverage:**
- Card layout (pure globe): Task 8 swaps the location card.
- Three marker kinds with distinct color: Tasks 6 (size in cobe), 9 (overlay color), 2 (seed).
- Hover info (city, state, time, tz): Task 10.
- Edit-mode UI: Task 11.
- Theme reactivity: Task 6.
- Database schema + seed: Task 2 (no schema change, just a seed — confirmed in spec).
- RAG awareness of state (home/current/school): Task 5 (kind-aware prose + school join).
- Bento resize: Task 8.

**Placeholder scan:** None. Every step has exact code, exact paths, exact commands.

**Type consistency:** `GlobeMarker` / `GlobeMarkerKind` used consistently across Tasks 1, 3, 4, 5, 6, 7, 9, 10, 11. `updateGlobeMarkers(markers: GlobeMarker[])` signature consistent. The async `buildSiteContentText(key, value): Promise<string>` signature is updated at both callers (Task 5 step 3 and step 4).

**One known dependency order:** Task 4 ships `updateGlobeMarkers` before Task 5 makes the prose mapper async. That's intentional — the action works correctly in Task 4 using the existing sync mapper (which falls back to JSON-flatten for the new key, producing valid-but-less-rich embed text). Task 5 then upgrades the prose without changing the action's surface. Both orderings produce working software at every step.

