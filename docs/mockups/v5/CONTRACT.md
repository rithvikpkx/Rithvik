# rithvik.ai v5: design-system contract

`index.html` + `base.css` render the **classic** site (legacy colour palettes, GitHub Light default).
v5 is **one long page** of sections (Hero → Work → Experience+Education → About band → Play field →
Questions → Footer/contact). Chat, resume, composer, case studies and games open as **layers over the
page** (agent bar, draggable windows, a bottom sheet, a FLIP-expanded panel). The structure, spacing
and calm come from andreas.vision: generous whitespace, minimal text, one-word section titles, quiet
chrome, one bright element per view.

Each **design system** must make the same page feel like an **entirely different website**: not a
recolour. Change materials, typography, composition, how sections are framed, nav shape, card and
row treatment, the agent's chrome, the windows' chrome, the play tiles, the record player. Every
function, element and piece of content keeps working. Read `index.html`, `base.css` and `app.js`
(markup it generates) first. Do not edit them or this file.

Bar: ethereal yet almost physical; high craft; nothing generic; **less clutter than v4**. Crisp, 60fps.

## Selectors
- `<html>` carries `data-system="<id>"`, `data-mode="light|dark"`, classes `lite`, `admin`,
  `agent-full`, `entering` (hero entrance), `locked` (an overlay is open).
- Tokens: `[data-system="<id>"] { … }` (bare attribute, so play tiles `.tile.mini[data-system="<id>"]`
  also get them). Dark/alternate variant: `:root[data-system="<id>"][data-mode="dark"] { … }`.
- Everything else: prefix `:root[data-system="<id>"]`. Keyframes prefixed with the system id.
- Optional cheap flourish for the tile preview: `.tile.mini[data-system="<id>"] { … }`.

## Tokens (defaults in base.css `:root, [data-system]`)
Palette `--bg --bg-soft --fg --muted --accent --accent-fg --accent-text --ok`
Surfaces `--panel --panel-fg --panel-muted --line --line-strong --field --field-fg --chip-bg --chip-fg
--hover-bg --nav-bg --nav-glass --glass`
Shape `--bw --r --r-media --r-sm --r-xs --btn-r --chip-r --shadow --shadow-float --btn-shadow --press`
Type `--font-d` (hero name, case H1, signature) `--font-t` (section titles) `--font-b` (body)
`--font-l` (labels/data) `--d-style --d-weight --d-track --t-weight --t-track --t-case --label-case
--label-track`
About band: `.band` sets `--band-bg: var(--accent); --band-fg: var(--accent-fg)`; override on
`:root[data-system=x] .band` to give the band your own material (the globe canvas reads `--band-fg`).
Agent skin `--agent-bg --agent-fg --agent-muted --agent-accent --agent-line --agent-font
--agent-text-font --agent-r --agent-shadow`
Records `--rec-pill-bg --rec-pill-fg --rec-pill-muted --rec-label --rec-label-ink`
Motion `--ease-out --ease-in-out --ease-drawer` (don't change), layout `--page-max --gutter`.

## The mark (ouroboros logo)
Generated SVG inside every `.mark-slot[data-mark=…]` (`nav`, `giant`, `card`, `plate`, `progress`,
`ghost`, `globe`, `agent`, `ask`, `label`, `tile`, `spec`, `cell`, `spin`). Markup:
`svg.mark.mk-<kind> > g.mk-spin > path.mk-body (+ circle.mk-pupil on giant)`. Colour is
`currentColor`; `giant/card/plate` are hatched with a pattern that also uses `currentColor`. Restyle
by setting `color` on the slot (or `filter`, e.g. a phosphor glow for CRT). Don't hide it: it is the
brand and it animates (draw-on, blink, scroll rotation in the nav, giant footer mark whose pupil
follows the pointer). Pixel systems may add `image-rendering`/`shape-rendering: crispEdges`.

## Fonts (JS loads one Google Fonts stylesheet per active system; always give fallbacks)
glass: Geist + `-apple-system,"SF Pro Display"` · comic: Bangers, Geist · brutal: "Archivo Black",
Archivo (variable wdth/wght) · neon: Audiowide, "Chakra Petch" · crt: VT323, "JetBrains Mono" ·
win98: system Tahoma/Verdana, VT323 for LCD bits · paper: Caveat, Kalam · pane: "IBM Plex Mono" ·
lab: "Bricolage Grotesque" (variable opsz/wdth/wght), "JetBrains Mono" · ledger: Doto (variable),
"IBM Plex Mono", "Libre Barcode 39 Text" · riso: Syne, "Instrument Serif" (italic), "Space Mono" ·
spectrum: "Unica One", "Geist Mono".

## Decoration slots (`display:none` until you enable)
In `.bg-layer` (fixed, z 0): `.deco.blob.b1/.b2/.b3 .deco.halftone .deco.grid .deco.ruled .deco.sun
.deco.floor > i .deco.grain .deco.vignette canvas.deco.rain#rain` (JS draws character rain only for
crt) `.deco.taskbar (.tb-start .tb-tasks .tb-task .tb-clock)`. Outside: `.deco.frame`, `.deco.scan`
(fixed overlay), `canvas.deco.blobs#blobs` (Lab only). `.bg-layer` paints `--bg`.

## Components (exact markup: index.html + the generators in app.js)
- **Nav** (two floating groups): `.nav-wrap(.away) > .nav (.brand > svg.brand-progress + .mark-slot)
  .nav-links a.roll[aria-current=true] (JS splits letters into .rc > span) .nav-spy (sliding
  highlight)` and `.nav-tools (.nav-design .nd-dot .nd-name kbd, .btn.sm "Resume", .btn.sm.round)`.
- **Hero**: `.hero .hero-grid .hero-copy (.hero-status .live-dot, h1.hero-name.kinetic > .k-line > .ch
  with --k 0..1 from cursor proximity, pre.ascii-name (crt only), .hero-line .ph (.ph-box .ph-cursor),
  .hero-ctas .btn.magnetic .btn.ghost)` and `.hero-visual > .orbit` = portrait orbit:
  `.orb-depth[data-depth] > i.orb-engraved` (engraved serpent, CSS mask of assets/ouro-engraved.svg,
  `background` = its colour), `svg.orb-ring` (ticks `.tick(.major)`, `.hair` circles, `text`),
  `i.orb-scales` (scaled serpent ring, mask of assets/ouro-scales.svg), `.portrait img` (+
  `pre.ascii-portrait` crt), `svg.beams (.bm-base .bm-pulse, gradient #bm-grad)`, and three
  `.orb-node[data-tip]` contact buttons (GitHub, LinkedIn, Email) placed on the orbit by
  `transform: rotate(var(--a)) translateX(var(--r)) rotate(-a)`. Keep the photo + nodes + beams
  clearly connected: that is the owner's "connection to me". Re-material the serpent layers freely
  (colour, blend, opacity, hide one), but keep at least one serpent ring around the photo.
- **Section frame**: `.section .wrap .sec-head .sec-title .sec-dek`.
- **Work**: `.work-grid > button.wcard.panel(.feat|.side) > .wc-ring(.mark-slot) .wc-top (.wc-ic
  .wc-meta) .wc-view .wc-bottom (.wc-title .wc-ctx .chips.wc-tags .chip)`. No images, by owner
  request: cards are type-led; give them your system's material.
- **Experience**: `.ledger > li.lrow(.open) > button.lr-head (.lr-when .lr-role .lr-org .lr-where
  .lr-plus) + .lr-body > .lr-inner > div (.bullets li, .chips .chip)`; `#education.edu-row
  (.edu-logo .edu-main .edu-school .edu-degree .edu-meta)`.
- **About band**: `section.band#about > svg.band-edge.top/.bottom (rects, .soft) .band-track >
  .band-pin (sticky) > .band-grid > .band-globe (canvas.globe, .g-mark (mark), ol.g-chips li.on)
  .band-copy (.sec-title p dl.kv .band-ctas .btn.inverse)`. The edges are pixel steps; you may
  restyle or hide them (e.g. torn paper, scanline, perforation) and change the band material.
- **Play field**: `.field(.dragging) > .field-track > .tile(.dim)(.rec-tile) (.t-badge .t-art .t-name
  .t-sub)` and design tiles `.tile.mini[data-system] (.mini-name .t-sub .mini-row .mini-card
  .mini-btn)`; controls `.field-ui > .seg (button[aria-checked] .seg-thumb) + .icon-btn`. Tiles are
  absolutely positioned by JS transforms: never set `position`, `left/top` or `transform` on `.tile`.
- **Questions**: `.faq-grid .faq-head .faq #faq-list details summary .ans .faq-ask (.mark-slot input
  .icon-btn)`.
- **Footer**: `.footer .footer-grid .ft-sign .signature .ft-links .ft-nav .clocks li(.here) .ck-ic b i
  .ft-giant (.mark-slot giant) .ft-fine .buffett-line .credits`.
- **Case sheet** (`html.locked` while open): `.sheet .sheet-scrim .sheet-body .sheet-bar
  .sheet-progress .sheet-close .case .case-col h1 .case-lede .case-meta .case-plate (.cp-ic) h2
  .bullets .case-links .case-next`.
- **Play expansion**: `.xp(.pre|.closing) .xp-scrim .xp-panel .xp-bar .xp-title .xp-url .xp-body
  .xp-slot` containing games (`.gf-body .g-wrap .g-stage .g-title .g-help .g-row .tr-text
  .g-canvas-box .cd-box .cd-div .cd-target .result .rc-* .g-stat .note`), the records player
  (`.records(.is-on .is-scratching) .rec-stage .rec-platter .rec-disc .rec-spin .rec-photo
  .rec-label .rec-sheen .rec-spindle svg.rec-arm .rec-side .rec-pill-wrap .goo .goo-pill .goo-btn
  .rec-pill .rp-* .rec-play .rec-hint`; keep `.goo-*` = `--rec-pill-bg`), the mark specimen
  (`.specimen .sp-hero .sp-grid .sp-cell(.inv .acc .tiny) .sp-note`), `.stack .st-row`, `.colophon
  .steps .log`. Never set `transform` on `.xp-panel` (JS animates it).
- **Windows**: `.win(.front) .win-bar .win-title .win-actions .resume-win .pdf-viewport .pdf-page
  .win-foot .composer-win .composer .cmp-fields .cmp-row .cmp-foot .field .field-err`. Windows are
  positioned by JS `left/top`; restyle the chrome (title bar, borders, shadow) per system.
- **Agent** (Claude Code grammar), docked bottom-centre: `.agent .agent-bar .ab-prompt .ab-input
  .ab-kbd .ab-send(.busy) .agent-panel .agent-head .agent-title .at-mark .agent-model .agent-actions
  .agent-log .agent-banner (.acc .dim) .t-tips .t-starters .t-chip(.sugg) .t-user .t-line
  .t-dot(.live) .t-body .t-tool(.args) .t-res .t-confirm .t-key(.primary) .t-src .t-acts
  .t-interrupted .t-sugg .agent-palette .agent-status .spin`; `html.agent-full` = full screen.
  **Reskin the agent fully per system.**
- NEUTRAL, do not restyle: `.dial*`, `.pill`, `.toast*`, `.mock-bar`, `.pdf-page`.

## Rules
- Animate only transform / opacity (clip-path allowed). `backdrop-filter` only where the system is
  glass. Static textures via gradients or tiny inline SVG data URIs; never animate SVG filters or
  feTurbulence. Ambient loops: few elements, transform/opacity, pause under `html.lite`.
- Hover only under `@media (hover:hover) and (pointer:fine)`. Visible focus rings.
- Body text ≥ 4.5:1, large ≥ 3:1, in both variants.
- No horizontal overflow at 390px; size the hero name per font so it fits.
- Less clutter: don't add decorative labels, eyebrows, captions or filler copy. Systems may restyle
  existing text (case, tracking, font) but not add words, except where a system's signature truly
  needs a tiny label set via CSS `content` (keep it to one or two per page).
- Comment each system block header with its name and signature idea. Keep each system ≤ ~420 lines.
- Self-check braces: `node -e "const s=require('fs').readFileSync(F,'utf8');let d=0;for(const c of s){if(c=='{')d++;if(c=='}')d--;if(d<0)throw 'neg'};console.log(d)"` → 0.
- Verify with Playwright: `require("/Users/rithvikpraveenkumar/.npm/_npx/e41f203b7505f1fb/node_modules/playwright")`,
  `executablePath` = `/Users/rithvikpraveenkumar/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`.
  Serve over http (masks + fetch need it): a server is running at `http://localhost:8765/index.html`
  (if not: `python3 -m http.server 8765 --directory <v5 dir>`). Set `localStorage["rv5-system"]` and
  `rv5-mode` via `addInitScript` before load. Screenshot hero, #work, #about (scroll into the band),
  #play, #faq, #contact, open a case (`click .wcard`), open a game tile, the resume window
  (`click [data-open=resume]`), the agent (`click [data-agent]`), at 1440×900 and 390×844, light and
  dark. Look at every screenshot and fix what's off before finishing.
