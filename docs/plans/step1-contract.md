# Step 1 contract (read before touching code)

Shared rules for the parallel Step 1 streams. Source of truth for UI: `docs/mockups/v7/` (`core.js`,
`core.css`, `content.js`, `themes/*`, `CONTRACT.md`). Plan: `docs/plans/v4-overhaul.md` → "Final-site
vision" + "Step 1". House rules: CLAUDE.md (one short doc comment per function, WHY-comments only,
minimal code, granular conventional commits).

## Where the new site lives
- New root layout in its own route group: `app/(v7)/layout.tsx` + `app/(v7)/preview/page.tsx`
  (`robots: noindex`). The old site in `app/(site)/` stays untouched until the switch-over (then `/`
  moves into `(v7)`). Separate root layouts mean the old `globals.css` never collides with v7 CSS.
- Shared components: `components/site/<area>/…`. Designs: `designs/<id>/index.tsx` + `designs/<id>/<id>.css`
  with every rule scoped under `[data-design="<id>"]`. Classic (palettes) = `designs/classic/`.
- CSS keeps the mockup's global class names (`.pt`, `.pt-photo`, `.pt-node`, `.case`, `.win`, …):
  designs restyle shared components through those names and `--pt-*`-style tokens (v7 CONTRACT.md).
  Port each component's rules from `core.css` into that component's own global `.css` file.
- Assets you need from `docs/mockups/v7/assets/` → copy into `public/v7/…` (keep originals).
- Per-stream test harness: `app/(lab)/lab/<stream>/page.tsx` → `/lab/<stream>` (bare root layout already in
  `app/(lab)/layout.tsx`, noindex). Wrap in `<SiteProvider content={fixture}>` and import your own CSS plus
  `docs/mockups/v7/core.css`-equivalent tokens you need. Throwaway, fine to keep.

## Interfaces (already in `dev`; extend, don't rename)
- Content: `getContent()` from `@/lib/content` (server only) → `Content` (`lib/content/types.ts`,
  mirrors v7 `C`). Client code reads it via `useSite().content`. `lib/content/fixture.ts` = test data.
- Site shell: `components/site/SiteProvider.tsx` → `useSite()`: `content, overlay, openCase(slug),
  openComposer(subject?), openResume(), openAgent(q?), openPlay(id?), close(), toast(msg, undo?),
  toasts, dismissToast, lite, setLite`. It already wires `data-case / data-compose / data-resume /
  data-agent / data-play / data-copy` clicks. Overlay slots: `components/site/overlays/<Name>.tsx`
  (default export, placeholder until your stream fills it; keep the prop signature).
- Designs: `lib/designs/types.ts` (`DesignMeta`, `ShaderSpec`, `DesignProps`). Switch API:
  `components/site/DesignProvider.tsx` → `useDesign()`: `entries, current, setDesign(id, from?), cycle(dir?)`.
- Performance mode = `html.lite` class (single source of truth; `useSite().lite`).
- Icons/logos/land/spinners/banner/commits: `lib/assets/{icons,land,misc}.ts` (ported from the mockup;
  no icon packages).

## Ownership (only edit files you own; anything shared → note it in your report)
| Stream | Owns |
|---|---|
| feat/content-model | `supabase/v7_content_migration.sql`, `lib/content/index.ts` (DB read), seed, `lib/types.ts` additions |
| feat/design-engine | `app/(v7)/layout.tsx`, `app/(v7)/core.css` (tokens/base/type from core.css), `app/(v7)/preview/page.tsx`, `lib/designs/registry.ts`, `components/site/DesignProvider.tsx` (implement provider), dial integration (`components/ThemeDial.tsx` may be extended, not broken for the old site), pre-paint script, view-transition reveal |
| feat/shader-runtime | `lib/shader/*`, `components/site/ShaderCanvas.tsx`, fps watchdog + performance-mode toggle UI |
| feat/core-visuals | `components/site/{mark,portrait,graph}/*`, `overlays/Toasts.tsx` |
| feat/core-windows | `components/site/{case,windows}/*`, `overlays/{CaseSheet,ComposerWindow,ResumeWindow}.tsx`, `app/(v7)/work/[slug]/page.tsx` |
| feat/play-window | `components/site/play/*`, `overlays/PlayWindow.tsx` |
| feat/agent-tui | `components/site/agent/*`, `overlays/AgentDock.tsx` (client only; `/api/chat` unchanged) |

## Done = for every stream
`node_modules/.bin/tsc --noEmit` clean, `node_modules/.bin/eslint <touched>` clean, any new pure logic has a
`node:test` (`node --experimental-strip-types --test lib/**/*.test.ts`), your lab page renders with no
console errors, reduced motion respected, no horizontal overflow at 390px. Don't push or merge.
