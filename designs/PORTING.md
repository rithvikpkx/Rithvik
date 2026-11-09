# Porting a v7 design (pattern from Nimbus)

Source: `docs/mockups/v7/themes/<id>.js` + `<id>.css`. Target: `designs/<id>/`. `designs/nimbus/` is the
reference port; copy its shape.

## Files
- `index.tsx`: `"use client"`, default export `function <Name>({ content }: DesignProps)`. It must be
  client-importable because DesignProvider lazy-loads it on a switch (SSR still renders it first).
- `<id>.css`: imported by `index.tsx`.
- Pure helpers (pixel art, maths, shader tweaks) in their own `.ts` with a `node:test` next to them.
- Effects (the mockup's `mount`) in one hook, e.g. `motion.ts` → `use<Name>Motion(rootRef)`.
- Assets → `public/v7/<id>/` (keep the originals in docs).

## render(C, H) → JSX
- Keep the mockup's markup and class names exactly, so the CSS ports with a sed. Wrap the site in
  `<main className="stage" id="stage" tabIndex={-1}>`.
- `esc(x)` → just `{x}`. `C` → `content` (v7 `Content`). Hide empty optional fields (`education.grad`);
  render `content.faq` as given.
- Helpers: `H.portrait({id, cls})` → `<Portrait id className>`; `H.mark(kind)` → `<Mark kind label="" />`
  (`label=""` when decorative); `H.graph({id})` → `<KnowledgeGraph id>`; `H.icon/H.logo` → `<Icon name>` /
  `<Logo slug>`; `H.PLAY` → `PLAY` from `@/lib/play/games`.
- Hooks stay declarative: `data-case / data-compose / data-resume / data-agent / data-play / data-copy`
  (SiteProvider) and `data-theme-go` (DesignProvider). Give `data-case` links a real `href={/work/<slug>}`.
- Generated SVG strings (pixel art, patterns) can go in via `dangerouslySetInnerHTML` on the wrapper the
  mockup already had; they are our own constants, never user input, and keep thousands of rects out of React.
- Anything that depends on the clock or the visitor (`H.clock`, `?hour=`, local time) differs between server
  and client: read it with `useSyncExternalStore` and a server snapshot of `0`/`null`, render a neutral value
  until hydrated (see `designs/nimbus/time.ts`). Nothing fills `data-clock` for you.

## mount(root, H) → effects
- One `useEffect` on a root ref; port the body nearly verbatim. Every listener, observer, timer, rAF and
  Web Animation is undone in the cleanup (a design switch unmounts it).
- Simple per-element handlers (form submit, `<details>` toggle) become React props instead.
- `H.reduceMotion()` → read `matchMedia("(prefers-reduced-motion: reduce)")` **or** `html.lite` at event
  time, not once. `H.fine` → `matchMedia("(hover: hover) and (pointer: fine)")`. `H.openAgent` etc. →
  `useSite()`.

## CSS
- `sed 's/:root\[data-theme="<id>"\]/:root[data-design="<id>"]/g'` scopes every rule (including
  `.lite`, `body` and the chrome overrides, which keep working because the shared components kept the
  mockup's class names). Replace `"Geist"` / `"Geist Mono"` with `var(--font-geist-sans)` /
  `var(--font-geist-mono)` (next/font).
- Design fonts come from the registry's `fonts` query; the layout and DesignProvider load them.

## Shader
- Nothing mounts it for you: render `<ShaderCanvas spec={meta.shader} dark={meta.dark} />` once inside the
  design (`designById("<id>")`). With `host` set, the canvas goes into that element of your markup.
- If the mockup rewrites the shader per visitor (Nimbus bakes the sun/hour and palette), derive a new spec
  from the registry one in a `useMemo` and pass `undefined` until it is known, so it mounts once.
- The runtime already freezes to one still under `html.lite` / reduced motion.

## Verify
`python3 -m http.server --directory docs/mockups/v7 8707` vs `/preview?theme=<id>` at 1440×900 and 390×844
(normal + `html.lite`), section by section; rAF fps over 3s; no horizontal overflow; tab through the first
screen; no console errors; `tsc`, `eslint designs/<id>`, `next build --webpack`.

## Counts in copy
Never hardcode counts the mockup wrote as words ("Six projects"): use `countWord(content.projects.length)` from `lib/words.ts`.

## Performance mode
The site-wide toggle is `<LiteToggle className="v7-lite" />`, mounted once by `components/site/SitePage.tsx`; designs only react to `html.lite`.
