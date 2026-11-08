# Design-system CSS contract (rithvik.ai v3 mockup)

The mockup is a single page (`index.html`) styled by `base.css` (shared layout + the default
"classic" GitHub Light look) and three design-system files. Your job is to write ONE of the
`systems-*.css` files, containing FOUR complete design systems. Read `index.html` and `base.css`
in full first: every class you can style is there. Do not edit them.

The bar: each design must feel like an entirely different, high-quality website wearing the same
layout ("same layout, different materials"). Sleek, lively, crisp. Bold display type + quieter body
font, one or two accents, one signature texture/decoration recognisable at a glance, motion that
only slides and fades (plus each style's signature ambient motion). Not a recolour.

Primary source for each style: `/Users/rithvikpraveenkumar/Codebox/Repos/LarpParty/docs/UI-STYLES.md`
(section 3.x for your styles; §1.5–1.10 for conventions) and the working CSS in
`/Users/rithvikpraveenkumar/Codebox/Repos/LarpParty/src/themes/themes.css` (class map: `.scr`=page,
`.bg`=`.bg-layer`, `.disp`=`.display`, `.pick`=option, `.is-night`=dark). Port the values and
techniques, translate game-specific bits into portfolio equivalents, and FIX the contrast pitfalls
the spec lists for your styles.

## Selectors (important)

- `html` carries: `data-system="<id>"`, `data-mode="light|dark"`, `data-palette` (classic only),
  classes `lite`, `notes`, `admin`.
- **Tokens** go in a block keyed on the bare attribute so the small preview cards in the hero
  ("12 ways" strip, `.mini[data-system="<id>"]`) also pick them up:
  `[data-system="glass"] { --bg: …; --fg: …; … }`
- **Dark variant tokens**: `:root[data-system="glass"][data-mode="dark"] { … }`
- **Everything else** (decorations, component overrides, keyframe users) is prefixed with
  `:root[data-system="<id>"]` so it never leaks into other designs or the minis.
- Optional: a little flourish on the preview card itself: `.mini[data-system="<id>"] { … }`
  (e.g. halftone, ruled lines, bevel) so the strip previews each look. Keep it cheap.
- Every design must define a dark variant (owner toggles it with a sun/moon button). For styles
  whose spec has no dark variant (ASCII, Desktop 98), invent a tasteful one (e.g. ASCII dark =
  amber phosphor; Desktop 98 dark = a night-teal/charcoal desktop with the same bevels).

## Token contract (defaults live in base.css `:root, [data-system]`)

Palette: `--bg --bg-soft --fg --muted --accent --accent-2 --accent-fg --accent-text --ok`
Surfaces: `--panel --panel-fg --panel-muted --line --line-strong --field --field-fg --chip-bg
--chip-fg --chip-line --chip-bw --hl --nav-bg --dock-bg --dock-fg`
Glass: `--glass` (backdrop-filter for panels; keep `none` except Liquid Glass), `--nav-glass`,
`--dock-glass` (default blur on nav + chat bar; set `none` for opaque styles)
Shape/depth: `--bw --r --r-sm --btn-r --chip-r --nav-r --nav-link-r --dock-r --chatp-r --shadow
--shadow-hover --btn-shadow --btn-shadow-press --press --lift --btn-line --ghost-bg --ghost-fg
--portrait-bw --portrait-shadow --portrait-filter --dock-shadow --dock-shadow-focus --chatp-bg
--chatp-shadow`
Type: `--font-d --font-b --font-l --d-weight --d-track --d-case --d-lh --btn-font --btn-weight
--btn-case --btn-track --eyebrow-track --eyebrow-case`
Globe canvas (read by JS): `--globe-dot --globe-home --globe-school --globe-now`
Motion: `--ease --ease-ui` (don't change).

`--bg` is also painted on `.bg-layer`; replace `.bg-layer`'s background with gradients/patterns
via `:root[data-system="x"] .bg-layer { background: … }`.

## Fonts

JS loads one Google Fonts stylesheet when a design activates. Families available per design:
- glass: Geist (variable 100–900) + system `-apple-system, "SF Pro Display"` first
- comic: Bangers, Geist
- brutal: "Archivo Black", Archivo (variable wdth 62–125, wght 100–900)
- tide: "Luckiest Guy", Archivo (variable)
- clay: Fredoka (variable wdth 75–125, wght 300–700)
- ascii: VT323, "JetBrains Mono" (variable 100–800)
- win98: system Tahoma/Verdana/"MS Sans Serif"; VT323 for LCD bits
- neon: Audiowide, "Chakra Petch" (400/600/700)
- pixel: "Press Start 2P", "Pixelify Sans" (variable 400–700)
- paper: Caveat (variable 400–700), Kalam (400/700)
- sakura: "Shippori Mincho" (500/600/700), "Zen Kaku Gothic New" (400/500)
- blueprint: "Share Tech Mono", "Architects Daughter"
Always give fallbacks.

## Decoration slots (all `display:none` until you enable them)

Inside `.bg-layer` (fixed, full viewport, pointer-events none, z-index 0):
`.deco.blob.b1/.b2/.b3`, `.deco.stripes`, `.deco.halftone`, `.deco.grid`, `.deco.ruled`,
`.deco.sun`, `.deco.floor > i`, `.deco.stars`, `.deco.cloud.c1/.c2`, `.deco.rays.r1/.r2`,
`.deco.bubbles > i×8` (per-item `--x --d --dl`), `.deco.petals > i×8` (same vars), `.deco.kanji`
(text 創), `.deco.ground`, `.deco.kelp.k1/.k2`, `.deco.dim`, `canvas.deco.rain#rain` (JS draws
ASCII rain when ascii is active — just `display:block` it, size it to the viewport, set opacity),
`.deco.taskbar` (contains `.tb-start`, `.tb-tasks > .tb-task`, `.tb-clock` updated live by JS;
Desktop 98's taskbar — pinned to the bottom of the viewport, the chat dock sits just above it).
Outside it: `.deco.scan` (fixed full-screen overlay, z-index 70, for CRT scanlines),
`svg.deco.pow` (inside `.portrait-wrap`, a "HIRE ME!" starburst for Comic Pop),
`.ticker-band > .ticker-track > span×2` (in-flow band after the hero, for Neo-Brutalist; animate
the track `translateX(0 → -50%)` for a seamless loop).

Bubbles/petals: use `left: var(--x); animation-duration: var(--d); animation-delay: var(--dl)`.

## Component hooks (classes in index.html; all read tokens by default)

- Nav: `.nav-wrap > .nav` with `.brand .brand-mark`, `.nav-links a` (`.is-active` set by JS),
  `.nav-sep`, `.nav-fun`, and a `.btn.sm` Resume button.
- Hero: `.hero`, `.hero-grid`, `.eyebrow`, **`.kinetic`** (h1 name), `.hero-sub` (contains `.hl`),
  `.hero-ctas .btn / .btn.ghost`, `.style-chip` (`.sc-dot .sc-text .sc-try button .sc-dice`),
  `.hero-visual`, `.portrait-wrap`, `.ouro` (SVG ouroboros ring around the photo; `.ouro-body`
  `.ouro-scales` `.ouro-head`, rotating `.ouro-spin`), `.portrait img`, `.socials .icon-btn`.
- **Kinetic name hover:** each letter is `.kinetic .ch` (spaces `.ch.sp`) with a live `--k` from 0
  (far) to 1 (under the cursor), set by JS. Base maps it to variable-font weight. Give each design
  its own mapping that suits its font (e.g. per-letter `translate`/`rotate`/`scale`, colour shift,
  glow, stepped hop, width axis via `font-variation-settings "wdth"`). Use transform/opacity/colour
  where possible; keep transitions ~150–250ms (pixel: `steps()`).
- "12 ways": `.ways-wrap .ways .mini` (`.mini-name .mini-row .mini-btn .mini-card`).
- Sections: `.section`, `.sec-head` (`.eyebrow`, `h2.display`, `.sec-sub`), `.beyond`
  (`.beyond-title`), `.footer` (`.footer-name .footer-sub .footer-links .buffett-line`).
- Panels: `.panel` (stack map, project cards, timeline cards, edu, composer, now, globe, game
  frame, result card, hood cards, field notes, modal cards, chat panel is separate). Panels carry
  `data-label` (e.g. ASCII `┤ LABEL ├` tag), `data-title` (Desktop 98 title bar text),
  `data-fig` (Blueprint "FIG. n" caption). `.panel::before/::after` are free for you to use.
  Note: `.project`, `.tl-card`, `.game-card`, `.note-card`, `.result-card` are panels too.
- Primitives: `.btn`, `.btn.ghost`, `.btn.sm`, `.icon-btn`, `.chip`, `button.chip.is-on`,
  `.field`, `.mini-label`, `.hl`, `.linkish`, `kbd`.
- Projects: `.stackmap` (`.sm-groups .sm-group h4 .chips button.chip`), `.proj-grid .project`
  (`.is-featured`, `.is-dim`; inside `.p-top .p-badge .p-title .p-desc li .p-foot .p-links`).
- Experience: `.timeline` (`::before` line, `::after` moving beam), `.tl-item .tl-dot .tl-card
  .tl-role .tl-org .tl-when .tl-where`, `.tl-item.is-new` (placeholder card).
- Education: `.edu .edu-logo .edu-school .edu-degree .edu-meta .edu-side`.
- Contact: `.contact-links .addr code`, `.composer .cmp-row label .field .cmp-foot`.
- Now: `.now-card .now-dot .now-city .now-time .now-list dt/dd`, `.globe-card canvas .legend .lg`.
- Arcade: `.arcade-grid .game-card` (`.gc-art .gc-name .gc-desc .gc-base b .gc-soon`,
  `.is-playing`), `.game-frame` (`.gf-bar .gf-lights i .gf-url .gf-open .gf-close .gf-body`),
  game internals `.g-title .g-help .tr-text (.ok .bad .cur) .g-canvas-box .cd-box .cd-div
  .g-stat`, `.result-card .rc-row .rc-bar i .rc-verdict`.
- Hood: `.flow li b span` (+`.is-live`), `.torus-card canvas`, `.log li time .type`,
  `.contrib-grid i` (uses `--v`).
- Field notes: `.notes-grid .note-card .nc-icon .nc-title .nc-take .nc-art`.
- Chat: `.chat-dock`, `.chat-bar` (`.cb-prompt` hidden by default, `.cb-input`, `.cb-kbd`,
  `.cb-send`, `.cb-send.is-stop`), `.chat-suggest .starter / .suggest-chip`, `.chat-panel`
  (`.chat-head .ch-title .ch-dot .ch-model .ch-actions .icon-btn.sm`), `.chat-log`, `.msg.user
  .bubble`, `.msg.bot .bubble`, `.rewrite`, `.thinking`, `.tool-call b`, `.action-btn`,
  `.sources`, `.msg-actions button`, `.msg-suggest .suggest-chip`, `.welcome`, `.chat-history`,
  `.chat-tui-status` (hidden by default; JS writes a spinner + status line into it).
- Modals: `.modal .modal-card .modal-head .modal-title .modal-actions` (resume card + admin card
  are `.panel`s; the `.pdf-page` stays a white paper page, and `.buffett-card` stays plain — do not
  restyle those two).
- NEUTRAL, do not restyle: `.dial*`, `.pill`, `.coach`, `.toast`, `.mock-bar`, `.anno`,
  `.buffett-card`, `.pdf-page`.

## Rules

- Performance is a hard requirement: animate only `transform` and `opacity` (the single
  exceptions allowed by the spec: ASCII typewriter `clip-path`, and the base theme-switch reveal).
  `will-change: transform` only on the few moving decoration layers. `backdrop-filter` only in
  Liquid Glass (and keep the count small — never nest glass in glass; nav and chat bar are fixed,
  so prefer lighter blur there). Static textures via gradients/box-shadow; no images except tiny
  inline SVG data URIs if essential. Ambient loops ≤ a handful of elements.
- `html.lite` must kill your ambient decorations (blobs, rain, floor, petals, bubbles, rays, kelp,
  ticker are already hidden by base; hide any other moving decoration you add) and drop blur.
- Wrap hover effects in `@media (hover: hover)`. Keep focus rings visible (`:focus-visible`).
- Body text contrast ≥ 4.5:1, large text ≥ 3:1 in BOTH variants. Use the spec's listed fixes.
- Keep text readable over decorations (e.g. Tide Pool body copy on cream panels; Neon never glows
  body text).
- Don't break layout: no fixed heights on content, no horizontal overflow at 390px wide. Wide
  display fonts (Press Start 2P, Bangers, Archivo Black, Luckiest Guy, Audiowide) need a smaller
  `.kinetic` font-size — set it per design (e.g. `clamp(...)`).
- Ticker band must not be `position: fixed` (it's in-flow). Chat dock stays bottom-centre in every
  design; restyle it (Desktop 98: make the chat bar read as a taskbar app/window; Comic: speech
  bubble; Pixel: RPG dialogue box; Neon: glowing console; etc.).
- Comment each design's block header with its name and signature.
- Target ≤ ~420 lines per design. Self-check brace balance before finishing
  (e.g. `node -e "const s=require('fs').readFileSync(F,'utf8');let d=0;for(const c of s){if(c=='{')d++;if(c=='}')d--;if(d<0)throw 'neg'};console.log(d)"`
  must print 0).
