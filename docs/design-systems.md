# Adding a design system to rithvik.ai

How to add a new deep-integration look (like Thermal, Starlight, Mercury). A **palette** is just colours in the
`themes` table and renders through Classic; a **design system** is a full look: its own shader world, typography,
motion, and a themed version of every object on the page. This document is about design systems. The exact
contract (types, tokens, class names) lives in `designs/PORTING.md`; read it alongside this.

## The bar

Every design system must be **physical, visual, interactive and visually stunning, never flat**. In practice:

- **One world, fully committed.** Pick a concrete subject (a thermal camera, liquid chrome, a blueprint) and
  express everything through its materials, instruments, units and vocabulary.
- **Depth everywhere.** Light, shadow, parallax, material response to the pointer. No surface is a flat fill
  unless flatness is the point and it's lit or textured.
- **Interactive objects.** The hero, name, portrait, education object and contact cloud all respond to the
  pointer in the look's own way.
- **Restraint.** Low density, one idea per screen, effects in one or two smart places per section. A busy look
  is the most common rejection.
- **Fast.** 60fps target (45 acceptable on the heaviest looks); `html.lite` / reduced motion render a designed
  still, never a broken or blank page.
- **Same layout, themed objects.** The page structure is shared and identical across looks. A design changes
  how things look and behave, never what's on the page or its order.

## Anatomy

```
designs/<id>/
  meta.ts           DesignMeta: id, name, mood, dark, keywords, swatch, cardFont, fonts, shader (GLSL), load
  index.tsx         "use client"; the Skin and <SiteLayout> (hero layer, shader host, portrait backdrop)
  <id>.css          everything scoped :root[data-design="<id>"]; tokens first, then shared-class overrides
  motion.ts         optional: one effect hook on the root ref, full cleanup
  name-fx.tsx       NameFx: KineticName with the look's feel (+ fx.css)
  portrait-fx.tsx   PortraitFx: the click-to-apply photographic effect (+ fx.css)
  experience.tsx    XP = { ExperienceConnector, EducationObject } (+ experience.css)
  *.ts + *.test.ts  any pure helpers, with node:test tests
public/v7/<id>/     assets (only if procedural isn't possible), each with a licence note
```

Register it with **one import and one entry** in `lib/designs/more.ts`:

```ts
import { META as blueprint } from "../../designs/blueprint/meta.ts"; // relative + .ts: node tests import this
export const MORE_DESIGNS: DesignMeta[] = [blueprint];
```

`meta.ts` must only import types statically; `load: () => import("@/designs/<id>")` stays a dynamic import so
the registry never pulls the design's component code. The switcher, `T` cycling, `?theme=<id>`, the agent's
`/theme` and `switch_design`, `BOOT_SCRIPT` and `npm run check:anchors` all pick the new look up from the
registry automatically.

## Checklist: every slot gets the theme

A deep design fills every one of these. Skipping one leaves a generic island in the middle of the look.

1. **World / shader** (`meta.shader`): the background of the hero (or the whole page) in the shared WebGL
   runtime (`lib/shader/`). Expose uniforms the motion code drives (pointer, scroll, a "charge" value).
2. **Typography**: a display face that belongs to the world, a readable body face, a utility/mono face.
   Weights must read at 390px (no hairline display cuts).
3. **Header + nav**: `--ly-head-bg`, nav active state, the "I am Rithvik" button in the look's material.
4. **Name** (`NameFx`): kinetic letters with the world's reaction (heat, melt, sparks, ink...). Keep
   `data-edit="name.first|name.last"`; calm at rest.
5. **Portrait** (`PortraitFx` + `--pt-*`): the click-to-apply photographic effect for this world (the photo
   is never filtered until clicked), photo frame/ring, and the **cable tokens** (`--pt-sheath`, `--pt-core`,
   `--pt-glow`, `--pt-pulse-a/m/b`, `--pt-body`) so the light pulses read clearly on this hero.
6. **Section titles**: `labels` (one-word themed titles, also the nav), optional `Title` / `SectionOrnament`.
7. **Work** (`projectArt.palette` + `params`): the procedural art disc in the world's colours.
8. **Experience** (`XP`): a themed connector between stations and a themed **education object**. The official
   Purdue P (`components/site/layout/purdue.tsx`) must stay present and recognisable: change its colour,
   material and effects, never its shape.
9. **About**: tile surfaces, clocks, the stack playground chips and counters via tokens.
10. **Play** (`--pf-*` tokens): the field surface and the six toys in the world's materials.
11. **Questions**: the flip cards and the ask card via tokens. The flip cards and the About tiles share the cursor warp (`components/site/fx/warp/`): their edges bow away from the pointer. Tune it per look with `--warp` on `:root[data-design="<id>"]` (0 = off, 1 = default, ~2 = pronounced); a card's corner radius is read from CSS, so keep `border-radius` on the warping element.
12. **Contact** (`ContactFrame`, `contactLead`, cloud tokens): a themed frame and one short themed line.
13. **Agent dock** (`components/site/agent/agent.css`, keyed `[data-design="<id>"]`): prompt glyph, dot,
    caret, optional scanlines/glow.
14. **Switcher swatch** (`meta.swatch`): four colours that identify the look at a glance.
15. **Lite still**: under `html.lite` the look is still beautiful: shader frozen, effects resting.

## Rules

- **One WebGL context** per page, via `lib/shader/`. No extra canvases for effects. The single documented
  exception is the Ferrari look, which may lazy-load three.js for its car model, only while that look is active,
  and must tear it down completely on switch.
- **No copied IP.** References inspire; they're never reproduced. No third-party logos, wordmarks, characters
  or game/film assets. Brand-inspired looks (e.g. Claude, OpenAI) use the brand's visual language (colour,
  type feel, motion, texture) without logos or wordmarks, and include a small "not affiliated" line in the footer
  area of that look. 3D models and textures need a licence that allows web use; credit them in
  `lib/assets` `SITE_CREDITS`.
- **CSP**: no new third-party hosts unless unavoidable; self-host assets under `public/`. A new host needs a
  `next.config.ts` entry and a reason in the commit.
- **Copy**: one-word section titles, no eyebrows, no filler, no emoji, no exclamation marks. Themed lines are
  welcome where they carry the look (Thermal's "The warmest lead is email"); never claims about the owner.
- **Accessibility**: contrast ≥ 4.5:1 for text, focus states visible, motion respects reduced-motion.
- **Code**: each function gets a 1–2 sentence comment; non-obvious lines a short why-comment. Pure logic gets
  a `node:test`.

## Inspiration library

Use these for feelings and specific techniques, never wholesale layouts:

- **Well-designed pages**: admiretheweb.com, httpster.net.
- **Image effects** (re-implement as our own shaders/SVG filters): grainrad.com (ASCII, dithering, halftone,
  matrix rain, dots, contour, pixel sort, blockify, threshold, edge detection, crosshatch, wave lines, noise
  field, Voronoi, VHS), mozayk.design (abstract shape-mosaic filter), lab.alembic.space (100+ layered shader
  effects; its explore page's clickable constellation of effects).
- **Gradients**: mmeshy.com (mesh gradients from many control points; reproduce as a shader).
- **Type and physics**: moss-type.vercel.app (living 3D moss lettering), ultrapilled.com (bouncy 3D physics
  collages).
- **Interaction**: hellomonday.com (cards warping away from the cursor; the shared warp effect),
  heartbeatdrummachine.plan8.co (the instrument UI behind the Play record player).

## Verify before calling it done

- `node_modules/.bin/tsc --noEmit`, `eslint designs/<id>`, all `node:test` tests, `npm run check:anchors`,
  `next build` (`--webpack` inside a worktree with symlinked `node_modules`).
- Playwright screenshots at 1440×900 and 390×844, `?theme=<id>`: hero at rest, name hovered, portrait clicked,
  each section, footer; again with `html.lite`. No horizontal overflow, no console errors.
- Frame rate on the hero: no long frames while idle; the shader pauses off-screen.
- Read your screenshots against "The bar" above and fix anything flat, busy or generic before reporting.
