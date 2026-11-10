# Adding a design: skin + CSS + optional shader

Every look renders the same page (`components/site/layout/`): sticky header, hero, the sections in a fixed
order, footer. A design never writes that markup. It is a **skin** (`lib/designs/skin.ts`) plus scoped CSS,
plus an optional shader and per-slot themed pieces. `designs/classic/` is the reference: a skin with no
overrides at all.

## The page (owned by the layout, identical everywhere)
- **Header** (`Header.tsx`): sticky; ouroboros mark + full name (to `#top`) | the nav, centred on the page
  (`NAV_SECTIONS`, labels from `skin.labels`) | "I am Rithvik". Nothing else.
- **Hero** (`#top`): the name (`NameFx` or plain), `status`, `line`, and the tethered portrait
  (`components/site/tether/Tether`: photo + GitHub / LinkedIn / Email / Resume on physical strings).
- **Sections** in `SECTIONS` order: `work, experience, about, play, questions, contact`. Each is
  `<section id={id} aria-labelledby="{id}-h">` → ornament → title → body.
- **Footer**: the same tether, small, then one line: mark, name, ©year, Privacy · Status · For Warren Buffett.
- Anchors `project-<slug>`, `experience-<slug>`, `education` come from the bodies (`npm run check:anchors`).

## Files
- `designs/<id>/index.tsx`: `"use client"`, `const SKIN: Skin = { … }`, and a default export
  `function <Name>({ content }: DesignProps)` returning `<SiteLayout content skin={SKIN} …>`. It stays
  client-importable because DesignProvider lazy-loads it on a switch.
- `designs/<id>/<id>.css`: imported by `index.tsx`, every rule scoped `:root[data-design="<id>"]`.
- `designs/<id>/motion.ts` (optional): one effect hook on the root ref, full cleanup (a switch unmounts it).
- Pure helpers in their own `.ts` with a `node:test` next to them. Assets in `public/v7/<id>/`.
- Register it in `lib/designs/registry.ts` (`DESIGNS`: id, name, swatch, fonts, shader, `load`).

## The Skin contract (`lib/designs/skin.ts`)
```ts
type Skin = {
  id: string;
  rootClass?: string;                                   // class on the page root; your CSS hangs off it
  labels?: Partial<Record<SectionId, string>>;          // one-word themed titles (also the nav labels)
  sectionClass?: (id: SectionId) => string;             // extra classes on each <section>
  titleClass?: string;                                  // extra class on the default <h2>
  Title?: ComponentType<{ id; index; label; hid }>;     // themed heading; must render <h2 id={hid}>
  sections?: Partial<Record<SectionId, ComponentType<SectionProps>>>; // body overrides; default = shared
  SectionOrnament?: ComponentType<{ id; index }>;       // drawn first in every section (dividers, title bars)
  NameFx?: ComponentType<{ first; last }>;              // hero name; keep data-edit="name.first|name.last"
  PortraitFx?: ComponentType<{ on: boolean }>;          // inside the photo; `on` flips per click
  ExperienceConnector?: ComponentType<{ index; count }>;// the material between stations (default: a thread)
  EducationObject?: ComponentType<{ education }>;       // the themed education object (default: a seal)
  ContactFrame?: ComponentType<{ children: ReactNode }>;  // wraps the shared Contact copy + buttons (seal, dark room, heat strip)
  contactLead?: string;                                 // one themed line above the Contact headline
  projectArt?: { palette: [string, string, string, string]; params?: Record<string, number> };
};
```
`SiteLayout` also takes runtime nodes a design builds in its component (they can use the design's state):
`rootRef` (for `motion.ts`), `hero` (a layer inside `#top` behind the copy: shader host, HUD, one themed
control), `portraitBackdrop` (behind the hero portrait, in its box: Foil's holo card) and `children`
(root-level, rendered first: `<ShaderCanvas>`, SVG defs, fixed overlays).

Every field is optional: a new design can start as `{ id, rootClass }` plus CSS and get the full page.

### Where the wave-2 streams plug in
- **Work** (done): the shared body is `components/site/work/Work.tsx`, a disc of procedural art
  (`lib/art`), one facet per project. A look sets `projectArt: { palette: [ground, ink, accent, second],
  params: { hole, rest, lift, density, stroke } }` (palette entries may be `var(--x, #fallback)`); SiteLayout
  publishes the palette as `--art-0..3` so the case sheet matches. No per-project assets. Review at `/lab/art`.
- **S7 Play**: same for the shared `Play` body; delete per-design `sections.play`.
- **Experience + Education** (done, S8): `components/site/layout/Experience.tsx` renders the roles as stations
  down one connector and the education object (sticky beside them when the section is wide) with its caption.
  A look adds `designs/<id>/experience.tsx` exporting `XP = { ExperienceConnector, EducationObject }`, spread
  into its skin, plus `experience.css`. Connectors are built from `.xp-track` / `.xp-fill` / `.xp-head` (they
  follow the scroll-driven `--fill`); stations get `data-lit` once the fill passes them; the object reads
  `--px` / `--py` / `--pv` (a pointer spring). Its base state (animation: none) is the calm still.
- **S9 Name + portrait** (done): every look has `designs/<id>/name-fx.tsx` (a `KineticName` from
  `components/site/kinetic/` with a per-look `feel`, optional `paint`/`frame` hooks, and CSS in `fx.css` reading
  `--k`/`--x`/`--y`/`--px`/`--py` on `.kn-l`) and `portrait-fx.tsx` (a `PhotoFx`: SVG filter primitives + CSS
  overlays on a copy of the photo, revealed per click with a `--pfx-off`/`--pfx-on` clip-path). No second GL
  context, no 2D canvas.
- **S10 Questions, Contact, About**: shared bodies in `sections.tsx`; remove per-design overrides as the
  shared ones land. Copy lives in content or the bodies, never in the layout.
- **S10 Questions, Contact, About** (done): shared bodies `layout/Questions.tsx` (3 flip cards + an ask card that
  `layout/Contact.tsx` (every button opens the composer; the address only shows inside it). A look themes them with
  tokens (`--ly-contact-text/-mx/-just` to centre Contact), `ContactFrame` and `contactLead`; no per-look bodies.

## Theming with CSS only
- Shared tokens every design sets on `:root[data-design="<id>"]`: `--ui-bg/fg/muted/accent/line/field/font/mono`
  (chrome) and `--pt-*` (portrait + nodes + strings: `--pt-photo-r`, `--pt-node-bg`, `--pt-beam`,
  `--pt-pulse-a/b` …).
- Layout tokens (defaults in `layout.css` at zero specificity): `--ly-display`, `--ly-name-font/-weight/-style/
  -track/-case`, `--ly-head-bg`, `--ly-head-font`, `--ly-line`, `--ly-soft`, `--ly-gutter`, `--ly-head-h`.
- Then restyle the shared classes under your scope: `.ly-head`, `.ly-nav a[aria-current]`, `.ly-iam`,
  `.ly-name`, `.ly-first`, `.ly-last`, `.ly-status`, `.ly-line`, `.ly-title`, `.ly-foot-mini`, `.pt-*`.
  Rings or bezels around the photo use `--pt-x / --pt-y / --pt-w` (the photo box in the figure).
- Anything a look sets on a token from an element below `:root` (next/font variables on the root class) must
  be declared on that element (`.cl { --ly-name-font: var(--cl-serif) }`).

## Shader
Render `<ShaderCanvas spec={meta.shader} dark={meta.dark} />` once, as a `SiteLayout` child. With `host` set
in the registry, put the host element where it belongs (in `hero` for a hero-only field, in `portraitBackdrop`,
or as a fixed root child). One WebGL context per page; no second canvas for effects. The runtime already
freezes to one still under `html.lite` / reduced motion.

## Motion
- One effect on the root ref; every listener, observer, timer, rAF and animation undone in the cleanup.
- Calm = `matchMedia("(prefers-reduced-motion: reduce)")` or `html.lite`, read at event time. Designs must
  render a designed still under it.
- Hooks stay declarative: `data-case / data-compose / data-resume / data-agent / data-play / data-copy`
  (SiteProvider). Give `data-case` links a real `href={/work/<slug>}`.
- Clock- or visitor-dependent values: `useSyncExternalStore` with a neutral server snapshot
  (`components/site/Clock.tsx`).

## Copy
One-word titles, no eyebrows, no emoji, no exclamation marks. No counts hardcoded as words (use
`countWord` from `lib/words.ts`). GitHub / LinkedIn / Email / Resume live only in the two tether clusters.

## Verify
`tsc --noEmit`, `eslint designs/<id>`, `npm run check:anchors`, `next build --webpack`; then `?theme=<id>` at
1440×900 and 390×844 (top, mid-page with the sticky header, footer), normal and `html.lite`; no horizontal
overflow; no console errors.
