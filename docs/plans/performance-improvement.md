# Performance Improvement Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Implement task-by-task, in order, committing after each task. Each task is independently shippable and leaves `dev` in a working, deployable state.

**Goal:** Make rithvik.ai fast on both axes — eliminate per-request DB load and oversized assets on the backend/network path, and make the frontend _feel_ snappy (smooth, consistent scrolling, hovering, and animation) by moving work onto the GPU compositor and off the critical path.

**Architecture:** Five fronts. (1) Cache the homepage with ISR so visitors stop hitting Supabase 5× per load. (2) Shrink the 1 MB hero photo. (3) Stop the WebGL globe from burning CPU when off-screen. (4) Trim the initial JS bundle (motion import optimization + lazy-loading overlay widgets). (5) Convert layout-thrashing animations (blur/`y`/`font-weight`) to GPU-composited `opacity`/`transform`, gate below-the-fold sections with `content-visibility`, and make `prefers-reduced-motion` consistent.

**Tech Stack:** Next.js 16 (App Router, ISR), React 19, `next/image`, `motion/react`, cobe (WebGL), Tailwind v4 / `app/globals.css`, Supabase. macOS `sips` for image resizing. Node 22 / npm.

---

## Verification model (read first)

This repo has **no unit-test framework** (see `package.json` — no jest/vitest/playwright). Per `CLAUDE.md`, the real verification gates are, in order of cost:

1. `node_modules/.bin/tsc --noEmit` — type check (cheapest gate)
2. `npx eslint <touched files>` — lint
3. `npx next build` — catches Vercel bundling/SSR issues and **prints each route's render mode** (the key signal for the ISR task)
4. Vercel preview on `dev` — the only way to catch real SSR/edge behavior
5. Manual / Lighthouse / DevTools Performance — the only way to confirm "feels snappy"

So tasks below verify with `tsc`/`eslint`/`build` + a **manual check** rather than a failing-test loop. Where a task's success is a measurable runtime property (frame rate, route mode, byte size), the verification step names the exact thing to observe.

**Baseline capture (do this once before Task 1):**

- [ ] **Step 0.1: Record current bundle + route modes**

Run:

```bash
cd /Users/rithvikpraveenkumar/Repos/Rithvik
npx next build 2>&1 | tee /tmp/perf-baseline-build.txt
```

In the route table at the end, note the symbol next to `/`:

- `ƒ (Dynamic)` — current expected state (because of `force-dynamic`)
- `●  (SSG)` / `○ (Static)` / ISR — the target state after Task 3

Also note the "First Load JS" number for `/` — this is the bundle baseline to beat after Tasks 4 & 7.

- [ ] **Step 0.2: Record asset baseline**

Run:

```bash
ls -la public/images/rithvik.jpeg
```

Expected today: `~1052007` bytes. This is the byte-size baseline for Task 2.

- [ ] **Step 0.3: Capture a runtime baseline (manual)**

Start `npm run dev`, open the site, open DevTools → Performance, record ~6s of scrolling top-to-bottom plus hovering the hero title. Note: visible jank during scroll, and whether the globe keeps repainting when scrolled past (Rendering tab → "Frame Rendering Stats" / paint flashing). Keep this recording mentally as the "before."

---

## File structure

| File                                  | Change  | Responsibility after change                                                                                                                        |
| ------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next.config.ts`                      | Modify  | Image formats (AVIF/WebP) + `optimizePackageImports: ['motion']`                                                                                   |
| `public/images/rithvik.jpeg`          | Replace | 540×540 (~3× display size), re-encoded — under ~80 KB                                                                                              |
| `public/images/rithvik-original.jpeg` | Create  | Backup of the 1254px original (gitignored or committed, see Task 2)                                                                                |
| `app/layout.tsx`                      | Modify  | Drop `force-dynamic`; add `revalidate = 60` (ISR)                                                                                                  |
| `app/page.tsx`                        | Modify  | Add `revalidate = 60`; render lazy overlay wrapper instead of direct RagBot/SecondaryContextPanel                                                  |
| `components/DeferredOverlays.tsx`     | Create  | `"use client"` wrapper that `next/dynamic`-imports RagBot + SecondaryContextPanel (`ssr:false`)                                                    |
| `components/Globe.tsx`                | Modify  | IntersectionObserver + `visibilitychange` gate on the rAF loop                                                                                     |
| `components/FadeIn.tsx`               | Modify  | Remove animated `filter: blur`; animate `opacity` + `transform` only; reduced-motion aware                                                         |
| `components/Hero.tsx`                 | Modify  | `item`/`connectCol` variants: drop blur, keep opacity + transform                                                                                  |
| `components/KineticText.tsx`          | Modify  | Remove permanent `will-change` (transient cost, not steady-state)                                                                                  |
| `components/FlickeringGrid.tsx`       | Modify  | Hoist rgba string-building out of the per-cell hot loop                                                                                            |
| `app/globals.css`                     | Modify  | `scroll-padding-top`; nav backdrop-blur tuned + layer-promoted; `content-visibility` on below-fold sections; consolidated `prefers-reduced-motion` |

---

## Task 1: Next config — image formats + motion import optimization

Smallest, lowest-risk change; unblocks Task 2's image gains and trims motion's bundle cost.

**Files:**

- Modify: `next.config.ts`

- [ ] **Step 1.1: Replace the empty config**

Current `next.config.ts` is an empty object. Replace its body with:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	images: {
		// Serve modern formats; AVIF first (smaller), WebP fallback. The browser
		// negotiates via Accept headers — older browsers still get the original.
		formats: ["image/avif", "image/webp"],
	},
	experimental: {
		// Tree-shake motion's barrel import so unused exports don't ship. motion is
		// imported in ~13 client components; this trims the shared client bundle.
		optimizePackageImports: ["motion"],
	},
};

export default nextConfig;
```

- [ ] **Step 1.2: Type-check**

Run: `node_modules/.bin/tsc --noEmit`
Expected: no output (exit 0).

- [ ] **Step 1.3: Build to confirm config is valid**

Run: `npx next build`
Expected: build completes; no warning about unknown config keys. Note the new "First Load JS" for `/` vs the Step 0.1 baseline — `optimizePackageImports` should hold it flat or reduce it.

- [ ] **Step 1.4: Commit**

```bash
git add next.config.ts
git commit -m "perf: enable AVIF/WebP image formats + optimizePackageImports for motion"
```

---

## Task 2: Shrink the hero profile photo (1 MB → ~80 KB)

`public/images/rithvik.jpeg` is 1254×1254 / ~1 MB but renders at `sizes="180px"` with `priority` (`components/HeroConnect.tsx:60`). It's in the LCP path. 540px (3× the 180px display box) is crisp on the highest-DPR screens and an order of magnitude smaller.

**Files:**

- Replace: `public/images/rithvik.jpeg`
- Create: `public/images/rithvik-original.jpeg` (backup)

- [ ] **Step 2.1: Back up the original**

Run:

```bash
cd /Users/rithvikpraveenkumar/Repos/Rithvik
cp public/images/rithvik.jpeg public/images/rithvik-original.jpeg
```

- [ ] **Step 2.2: Resize to 540px longest edge, in place**

`sips` is built into macOS and preserves aspect ratio with `-Z` (max dimension).

Run:

```bash
sips -Z 540 -s formatOptions 82 public/images/rithvik.jpeg --out public/images/rithvik.jpeg
```

`-s formatOptions 82` re-encodes JPEG at quality 82 (visually lossless at this size).

- [ ] **Step 2.3: Confirm the new size**

Run:

```bash
sips -g pixelWidth -g pixelHeight public/images/rithvik.jpeg
ls -la public/images/rithvik.jpeg
```

Expected: `pixelWidth: 540`, `pixelHeight: 540`; file size well under 100 KB (target ~50–80 KB) vs the ~1 MB baseline.

- [ ] **Step 2.4: Keep the backup out of the deployed bundle**

The backup must not ship to Vercel. Add it to `.gitignore`:

```bash
echo "public/images/rithvik-original.jpeg" >> .gitignore
```

(Anything in `public/` is served verbatim, so an un-ignored backup would be publicly downloadable _and_ deployed.)

- [ ] **Step 2.5: Visual check**

Run `npm run dev`, open the hero. The profile photo must look crisp at its 180px size on a retina display (zoom the browser to 200% to stress it — should still be sharp, not mushy). If soft, redo Step 2.2 with `-Z 720`.

- [ ] **Step 2.6: Commit**

```bash
git add public/images/rithvik.jpeg .gitignore
git commit -m "perf: resize hero photo 1254px/1MB -> 540px/~80KB (LCP asset)"
```

---

## Task 3: Replace `force-dynamic` with 60s ISR

`app/layout.tsx:25` sets `export const dynamic = "force-dynamic"`, opting the whole site out of caching. Every visit triggers 5 uncached Supabase round-trips (themes, site_content, projects, experience, education). ISR caches the rendered page and regenerates it at most once per 60s. Inline edits already call `revalidatePath("/")` in the server actions, so editor changes stay **instant**; raw SQL theme inserts appear within 60s.

**Files:**

- Modify: `app/layout.tsx` (remove `dynamic`, add `revalidate`)
- Modify: `app/page.tsx` (add `revalidate`)

- [ ] **Step 3.1: Swap the directive in the layout**

In `app/layout.tsx`, replace the block at lines 21–25:

```typescript
// Themes can be added/updated directly in Supabase (outside the inline-edit
// flow that calls revalidatePath). Marking the root layout dynamic ensures
// new theme rows appear immediately without requiring a redeploy. The cost
// is one extra Supabase fetch per request, which is negligible.
export const dynamic = "force-dynamic";
```

with:

```typescript
// ISR: cache the rendered tree and regenerate at most once per 60s. Inline
// edits call revalidatePath("/") in app/admin/actions.ts, so editor changes
// appear instantly; raw SQL theme inserts (outside that flow) appear within
// 60s — without paying 5 uncached Supabase round-trips on every visit, which
// is what force-dynamic cost us.
export const revalidate = 60;
```

- [ ] **Step 3.2: Add the same revalidate to the page**

In `app/page.tsx`, add directly under the imports (after line 12, before `parseSafe`):

```typescript
// Match the layout's ISR window so the homepage data (site_content, projects,
// experience, education) is cached and regenerated on the same 60s cadence.
export const revalidate = 60;
```

- [ ] **Step 3.3: Type-check**

Run: `node_modules/.bin/tsc --noEmit`
Expected: clean.

- [ ] **Step 3.4: Build and confirm the route is no longer dynamic — THE key check**

Run: `npx next build`
In the route table, the `/` entry must now show a static/ISR marker with a revalidate value (e.g. `●  /` with `Revalidate: 1m`), **not** `ƒ (Dynamic)`.

**Contingency:** if `/` still prints `ƒ (Dynamic)`, a Supabase fetch is opting the route into dynamic rendering (e.g. an internal `cache: 'no-store'`). In that case, wrap the reads in `unstable_cache` so caching no longer depends on fetch behavior. Minimal form for the page:

```typescript
import { unstable_cache } from "next/cache";

const getSiteContent = unstable_cache(
	async () => (await serverClient().from("site_content").select("key, value")).data ?? [],
	["site-content"],
	{ revalidate: 60, tags: ["site-content"] },
);
```

…and call `getSiteContent()` instead of the inline query. Apply the same pattern to the themes fetch in `layout.tsx` if needed. Only reach for this if Step 3.4 shows the route is still dynamic.

- [ ] **Step 3.5: Manual freshness check on the Vercel preview**

After pushing (Step 3.6), on the `dev` preview: enter edit mode, change the hero sub-line, save — it must update on reload **immediately** (revalidatePath path). This confirms editing didn't regress.

- [ ] **Step 3.6: Commit**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "perf: ISR with 60s revalidate instead of force-dynamic (kills 5 DB round-trips/visit)"
```

---

## Task 4: Lazy-load the chat bot and edit-only panel

`app/page.tsx:62-63` statically imports `SecondaryContextPanel` (only ever visible in edit mode) and `RagBot` (a below-the-fold launcher) into the initial bundle every visitor downloads. Code-split both so they load after the critical render. Because `page.tsx` is a Server Component and `ssr: false` dynamic imports are only allowed inside Client Components, the split goes through a thin client wrapper.

**Files:**

- Create: `components/DeferredOverlays.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 4.1: Create the client wrapper**

Create `components/DeferredOverlays.tsx`:

```tsx
"use client";
import dynamic from "next/dynamic";

// Both widgets are non-critical overlays: RagBot is a launcher pinned bottom-
// right (below the fold), and SecondaryContextPanel only renders in edit mode.
// Splitting them out of the initial bundle shrinks First Load JS for every
// visitor. ssr:false is valid here because this file is a Client Component.
const RagBot = dynamic(() => import("./RagBot"), { ssr: false });
const SecondaryContextPanel = dynamic(() => import("./SecondaryContextPanel"), { ssr: false });

/** Mounts the deferred, non-critical overlay widgets. Rendered at the end of
 *  the page so neither blocks the main content's hydration. */
export default function DeferredOverlays() {
	return (
		<>
			<SecondaryContextPanel />
			<RagBot />
		</>
	);
}
```

- [ ] **Step 4.2: Use the wrapper in the page**

In `app/page.tsx`:

1. Remove the two imports (lines 9–10):

```typescript
import RagBot from "@/components/RagBot";
import SecondaryContextPanel from "@/components/SecondaryContextPanel";
```

and add:

```typescript
import DeferredOverlays from "@/components/DeferredOverlays";
```

2. Replace the two render lines (62–63):

```tsx
      <SecondaryContextPanel />
      <RagBot />
```

with:

```tsx
<DeferredOverlays />
```

- [ ] **Step 4.3: Type-check + lint**

Run:

```bash
node_modules/.bin/tsc --noEmit
npx eslint components/DeferredOverlays.tsx app/page.tsx
```

Expected: both clean.

- [ ] **Step 4.4: Build and compare First Load JS**

Run: `npx next build`
Expected: `/` First Load JS is **lower** than the Step 0.1 baseline; RagBot/SecondaryContextPanel now appear as their own lazily-loaded chunks, not in the initial load.

- [ ] **Step 4.5: Manual check — nothing visually regressed**

`npm run dev`: the "Ask RAG" launcher still appears bottom-right (slightly later is fine), opens and streams a reply. Enter edit mode → the SecondaryContextPanel still appears. Confirm no hydration warning in the console.

- [ ] **Step 4.6: Commit**

```bash
git add components/DeferredOverlays.tsx app/page.tsx
git commit -m "perf: lazy-load RagBot + SecondaryContextPanel out of the initial bundle"
```

---

## Task 5: Gate the globe's rAF loop when off-screen / tab hidden

`components/Globe.tsx` runs an unconditional `requestAnimationFrame` loop (`:194-239`) that calls cobe's `update()` and recomputes every marker's DOM transform **every frame, forever** — even when the Bento section is scrolled far out of view or the tab is backgrounded. `FlickeringGrid` already pauses off-screen via IntersectionObserver; the globe should too. This is steady-state CPU/GPU savings → less competition for the main thread → smoother scrolling elsewhere.

**Files:**

- Modify: `components/Globe.tsx`

- [ ] **Step 5.1: Add a visibility ref + skip-when-hidden logic**

In `Globe.tsx`, inside the main `useEffect` (starts at line 175), after `const canvas = canvasRef.current; if (!canvas) return;`, add a visibility flag:

```typescript
// Pause the render loop when the globe is off-screen or the tab is hidden.
// The rAF stays scheduled (cheap) but we skip the expensive cobe update +
// per-marker projection until the globe is actually visible — mirrors the
// FlickeringGrid pattern and stops idle GPU/CPU burn.
let onScreen = true;
let tabVisible = !document.hidden;
const isActive = () => onScreen && tabVisible;
```

- [ ] **Step 5.2: Short-circuit the tick when inactive**

In the `tick` function (line 194), make the very first line a guard that re-schedules without doing work:

```typescript
    const tick = () => {
      if (!isActive()) {
        raf = requestAnimationFrame(tick);
        return;
      }
      // Idle: ease the drag spring toward 0 ...
```

(Leave the rest of `tick` unchanged.)

- [ ] **Step 5.3: Wire up the observers**

Immediately after `raf = requestAnimationFrame(tick);` (line 239) and before the `setTimeout(...)` opacity reveal, add:

```typescript
const io = new IntersectionObserver(
	([entry]) => {
		onScreen = entry.isIntersecting;
	},
	{ threshold: 0 },
);
io.observe(canvas);

const onVisibility = () => {
	tabVisible = !document.hidden;
};
document.addEventListener("visibilitychange", onVisibility);
```

- [ ] **Step 5.4: Clean them up**

In the cleanup return (line 254), add the two disconnects alongside the existing teardown:

```typescript
return () => {
	cancelAnimationFrame(raf);
	io.disconnect();
	document.removeEventListener("visibilitychange", onVisibility);
	themeObserver.disconnect();
	globeRef.current.destroy();
	window.removeEventListener("resize", onResize);
};
```

- [ ] **Step 5.5: Type-check + lint**

Run:

```bash
node_modules/.bin/tsc --noEmit
npx eslint components/Globe.tsx
```

Expected: clean.

- [ ] **Step 5.6: Manual check — globe pauses off-screen**

`npm run dev`, open DevTools → Rendering → enable "Paint flashing" (or Performance monitor → CPU). Scroll so the Bento globe is well off-screen: CPU should drop and paint flashing on the globe should stop. Scroll back: it resumes spinning smoothly. Switch to another tab and back: no freeze/jump. Drag-to-rotate still works.

- [ ] **Step 5.7: Commit**

```bash
git add components/Globe.tsx
git commit -m "perf: pause globe rAF loop when off-screen or tab hidden"
```

---

## Task 6: Make scroll-in animations GPU-composited (drop blur + layout-affecting y)

`components/FadeIn.tsx` (used by Projects, Experience, Education, Contact) and `components/Hero.tsx` variants animate `filter: blur(10px) → blur(0)`. Animating `filter: blur` forces a full-layer re-rasterization **every frame** — one of the most expensive things to animate — and it runs on every section as it scrolls in. `opacity` + `transform` are composited on the GPU and stay at 60fps. We keep the same "rise + fade" feel using `translateY` (a transform) instead of the animated `y` layout prop where it matters, and drop blur entirely.

**Files:**

- Modify: `components/FadeIn.tsx`
- Modify: `components/Hero.tsx`

- [ ] **Step 6.1: Rewrite FadeIn to opacity + transform only**

Replace the `<motion.div>` in `components/FadeIn.tsx` (lines 15–24) with:

```tsx
<motion.div
	className={className}
	initial={{ opacity: 0, y: 18 }}
	whileInView={{ opacity: 1, y: 0 }}
	viewport={{ once: true, amount: 0.1 }}
	transition={{ duration: 0.5, ease: "easeOut", delay }}
>
	{children}
</motion.div>
```

motion animates `y` via `transform: translateY`, which is GPU-composited — keep it; only the **blur** is removed. Duration trimmed 0.65→0.5s so it reads as snappier.

- [ ] **Step 6.2: Drop blur from the Hero variants**

In `components/Hero.tsx`, replace the `item` and `connectCol` variant definitions (lines 35–44):

```typescript
const item = {
	hidden: { opacity: 0, filter: "blur(10px)", y: 18 },
	visible: { opacity: 1, filter: "blur(0px)", y: 0, transition: { duration: 0.65, ease: "easeOut" as const } },
};
// Connect cluster fades/de-blurs in but does NOT translate — a `y` shift would
// move its layout box mid-animation, leaving the ref-measured beams stale.
const connectCol = {
	hidden: { opacity: 0, filter: "blur(10px)" },
	visible: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.8, ease: "easeOut" as const, delay: 0.35 } },
};
```

with (blur removed; the connect cluster's no-`y` rule preserved — that constraint is about the beam refs, not blur):

```typescript
const item = {
	hidden: { opacity: 0, y: 18 },
	visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" as const } },
};
// Connect cluster fades in but does NOT translate — a `y` shift would move its
// layout box mid-animation, leaving the ref-measured beams (HeroConnect) stale.
// Opacity-only keeps the beam endpoints fixed; no blur to avoid per-frame raster.
const connectCol = {
	hidden: { opacity: 0 },
	visible: { opacity: 1, transition: { duration: 0.7, ease: "easeOut" as const, delay: 0.35 } },
};
```

- [ ] **Step 6.3: Type-check + lint**

Run:
className="[transition:font-weight_0.15s_cubic-bezier(0.2,0,0,1),padding_0.15s_cubic-bezier(0.2,0,0,1)] hover:px-(--hover-padding) hover:font-black has-[+span+span:hover]:font-normal has-[+span:hover]:px-(--hover-padding) has-[+span:hover]:font-semibold [:hover+&]:px-(--hover-padding) [:hover+&]:font-semibold [:hover+span+&]:font-normal"

```bash
node_modules/.bin/tsc --noEmit
npx eslint components/FadeIn.tsx components/Hero.tsx
```

Expected: clean.

- [ ] **Step 6.4: Manual check — smoother section reveals**

`npm run dev`, scroll through the sections. Each should fade + rise in crisply with no blur shimmer. In DevTools Performance, the scroll-in no longer shows long paint/raster bars on the animated containers. Hero text and the connect cluster still animate in; the beams still point at the photo correctly (no stale geometry).

- [ ] **Step 6.5: Commit**

```bash
git add components/FadeIn.tsx components/Hero.tsx
git commit -m "perf: GPU-composite scroll-in animations (drop filter:blur, keep opacity+transform)"
```

---

## Task 7: Trim steady-state animation cost (KineticText + FlickeringGrid)

Two micro-but-real costs. `components/KineticText.tsx` sets `will-change: font-weight, padding` **permanently** on every letter span of the hero title — `will-change` is meant to be transient; leaving it on dozens of elements forever holds extra layers/memory and can _hurt_ overall compositing. `components/FlickeringGrid.tsx` builds a fresh `rgba(...)` template string and calls `.toFixed(3)` for **every cell every frame** in its hot double loop.

**Files:**

- Modify: `components/KineticText.tsx`
- Modify: `components/FlickeringGrid.tsx`

- [ ] **Step 7.1: Remove the permanent will-change in KineticText**

In `components/KineticText.tsx`, the span className (line 28) begins with `[will-change:font-weight,padding] `. Remove just that token, keeping the transition and hover rules:

```tsx
className =
	"[transition:font-weight_0.15s_cubic-bezier(0.2,0,0,1),padding_0.15s_cubic-bezier(0.2,0,0,1)] hover:px-(--hover-padding) hover:font-black has-[+span+span:hover]:font-normal has-[+span:hover]:px-(--hover-padding) has-[+span:hover]:font-semibold [:hover+&]:px-(--hover-padding) [:hover+&]:font-semibold [:hover+span+&]:font-normal";
```

The hover ripple still works; we just stop permanently hinting the compositor for an interaction that's idle 99% of the time.

- [ ] **Step 7.2: Hoist the rgba prefix out of FlickeringGrid's hot loop**

In `components/FlickeringGrid.tsx`, the parsed `r,g,b` are constant for the effect's lifetime (lines 38–40). Build the rgba prefix once. Just before the `draw` function (line 60), add:

```typescript
const rgbPrefix = `rgba(${r},${g},${b},`;
```

Then replace the per-cell fillStyle line (79):

```typescript
ctx!.fillStyle = `rgba(${r},${g},${b},${opacities[i].toFixed(3)})`;
```

with:

```typescript
// Prefix is constant; only the alpha varies. Avoids rebuilding the
// template + toFixed allocation for every cell every frame.
ctx!.fillStyle = rgbPrefix + opacities[i] + ")";
```

(`opacities[i]` is a float; `ctx.fillStyle` parses it fine without `toFixed` — the rounding was cosmetic.)

- [ ] **Step 7.3: Type-check + lint**

Run:

```bash
node_modules/.bin/tsc --noEmit
npx eslint components/KineticText.tsx components/FlickeringGrid.tsx
```

Expected: clean.

- [ ] **Step 7.4: Manual check**

`npm run dev`: hero title still ripples on hover (letters bolden + neighbors react). Flickering grid still animates identically. In DevTools Performance while hovering the title, no layout-thrash warning storm; the grid's scripting time per frame is flat or lower.

- [ ] **Step 7.5: Commit**

```bash
git add components/KineticText.tsx components/FlickeringGrid.tsx
git commit -m "perf: drop permanent will-change on KineticText; hoist rgba out of grid hot loop"
```

---

## Task 8: Snappy, consistent scroll & hover in CSS

Four CSS-only wins in `app/globals.css`: (1) the fixed nav uses `backdrop-filter: blur(28px) saturate(180%)` which re-blurs the page behind it on **every scroll frame** — the single biggest scroll-jank source; tune the radius and promote it to its own layer. (2) Anchor jumps land _under_ the fixed nav — add `scroll-padding-top`. (3) Below-the-fold sections lay out/paint even when off-screen — gate them with `content-visibility: auto`. (4) Make `prefers-reduced-motion` honor the new animations consistently.

**Files:**

- Modify: `app/globals.css`

- [ ] **Step 8.1: Add scroll-padding so anchors clear the nav**

`globals.css:44` is `html { scroll-behavior: smooth; }`. Replace it with:

```css
html {
	scroll-behavior: smooth;
	/* Fixed nav pill is ~50px tall + float gap; offset anchor targets so section
     headings aren't hidden under it after a nav click. */
	scroll-padding-top: 88px;
}
```

- [ ] **Step 8.2: Tune the nav backdrop-filter + promote to its own layer**

In the `.nav-pill` block (the rule containing lines 85–86), change:

```css
backdrop-filter: blur(28px) saturate(180%);
-webkit-backdrop-filter: blur(28px) saturate(180%);
```

to:

```css
/* 28px backdrop-blur re-rasterizes the area behind a fixed element on every
     scroll frame — the chief scroll-jank source. 16px is visually close at
     this small size; contain + own layer keep the blur from re-sampling more
     than its own box. */
backdrop-filter: blur(16px) saturate(160%);
-webkit-backdrop-filter: blur(16px) saturate(160%);
will-change: transform;
transform: translateZ(0);
contain: paint;
```

- [ ] **Step 8.3: Gate below-the-fold sections with content-visibility**

The section selectors exist (`.bento-section` at `:596`; `.projects-section`, `.experience-section`, `.education-section`, contact are styled lower). Add this block near the top of the layout/section area of `globals.css` (e.g. right after the `html` rule from Step 8.1). The intrinsic-size values are render-skip placeholders that prevent scrollbar jump — they don't need to be exact:

```css
/* Skip layout + paint for off-screen sections until they're scrolled near.
   Cuts initial render work and per-scroll cost on this long single page.
   contain-intrinsic-size reserves space so the scrollbar doesn't jump as
   sections realize. The hero is intentionally excluded (always above fold). */
.bento-section,
.projects-section,
.experience-section,
.education-section {
	content-visibility: auto;
	contain-intrinsic-size: auto 600px;
}
```

(Do **not** include `.hero` — it's the LCP/above-the-fold region and must render immediately.)

- [ ] **Step 8.4: Consolidate reduced-motion coverage**

There are existing `@media (prefers-reduced-motion: reduce)` blocks (`:250`, `:371`, `:1189`, `:2293`). Append one more at the **end** of `globals.css` to neutralize the smooth-scroll and any residual transform/opacity motion for users who opt out:

```css
@media (prefers-reduced-motion: reduce) {
	html {
		scroll-behavior: auto;
	}
	/* Belt-and-suspenders: kill long transitions/animations site-wide for
     reduced-motion users. Motion's JS variants already respect this via the
     library, but CSS-driven transitions need their own opt-out. */
	*,
	*::before,
	*::after {
		animation-duration: 0.01ms !important;
		animation-iteration-count: 1 !important;
		transition-duration: 0.01ms !important;
	}
}
```

- [ ] **Step 8.5: Lint the stylesheet (build catches CSS errors)**

Run: `npx next build`
Expected: build succeeds (Tailwind v4 compiles `globals.css`); no CSS parse error.

- [ ] **Step 8.6: Manual checks**

`npm run dev`:

- Click a nav item → the section heading lands _below_ the nav, not hidden under it.
- Scroll fast top-to-bottom: noticeably smoother than the Step 0.3 baseline; DevTools Performance shows fewer/shorter paint bars near the nav.
- DevTools → Rendering → no large layout shifts as sections realize (scrollbar stable).
- macOS System Settings → Accessibility → Display → "Reduce motion" ON, reload: scroll jumps instantly, animations don't play. Turn it back OFF.

- [ ] **Step 8.7: Commit**

```bash
git add app/globals.css
git commit -m "perf: snappier scroll/hover — tuned nav blur, scroll-padding, content-visibility, reduced-motion"
```

---

## Task 9: Final verification pass + preview sign-off

**Files:** none (verification only)

- [ ] **Step 9.1: Full clean gate**

Run:

```bash
node_modules/.bin/tsc --noEmit
npx eslint app components lib
npx next build
```

Expected: all clean. In the build route table, `/` shows ISR (revalidate 1m), and First Load JS for `/` is **at or below** the Step 0.1 baseline.

- [ ] **Step 9.2: Confirm the asset + DB wins landed**

```bash
ls -la public/images/rithvik.jpeg   # << ~80KB, not ~1MB
```

And re-read `app/layout.tsx` — no `force-dynamic` remains; `revalidate = 60` present in both layout and page.

- [ ] **Step 9.3: Push to dev and verify on the Vercel preview**

```bash
git push origin dev
```

On the `rithvik-<hash>.vercel.app` preview:

- Run Lighthouse (mobile) on the homepage. Compare Performance score / LCP / TBT against a pre-change run if available. LCP should improve (smaller hero image, ISR-served HTML); TBT should hold or improve (smaller bundle, lazy overlays).
- Scroll/hover feel: smooth, consistent, no globe-induced stutter when the Bento is off-screen.
- Edit mode: log in, edit a field, save → instant update. RagBot opens and streams. SecondaryContextPanel appears in edit mode.
- Theme dial: switching themes still instant; globe rebuilds correctly.

- [ ] **Step 9.4: Report results**

Summarize before/after: First Load JS, hero image bytes, `/` route mode (dynamic→ISR), and the Lighthouse deltas. Do **not** merge to `main` — per `CLAUDE.md`, that requires explicit user approval after preview review.

---

## Self-review notes (coverage against the request)

- **Priority 1 (caching)** → Task 3 (ISR, 60s, with dynamic-route contingency).
- **Priority 2 (hero image)** → Task 2 (1254px/1MB → 540px/~80KB) + Task 1 (AVIF/WebP).
- **Priority 3 (globe rAF gating)** → Task 5 (IntersectionObserver + visibilitychange).
- **Priority 5 (bundle)** → Task 1 (`optimizePackageImports`) + Task 4 (lazy overlays).
- **Snappy frontend (explicit goal)** → Task 6 (GPU-composited reveals), Task 7 (steady-state animation cost), Task 8 (scroll/hover CSS, content-visibility, reduced-motion).

**Out of scope / deliberately not changed:** RAG latency (HyDE→embed serial chain) — flagged in the audit as "measure first," not a confirmed win, and the user did not select it (priority 4). The RAG pipeline is untouched here.
