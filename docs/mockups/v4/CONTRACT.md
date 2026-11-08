# rithvik.ai v4: design-system contract

`index.html` + `base.css` render the **classic** site (legacy colour palettes: GitHub Light etc.).
Clean, recruiter-first, quiet. Each **design system** you write must make the same page feel like an
**entirely different website**: not a recolour. Change materials, typography, layout and composition
(grid, hero arrangement, how sections are framed, nav shape, card/row treatment, the agent's chrome,
the record player's chrome), while every function, element and piece of content keeps working.
Read `index.html` and `base.css` in full first. Do not edit them, `app.js` or this file.

Bar: ethereal yet almost physical; high craft; nothing generic. Hard requirement: crisp, never laggy.

## Selectors
- `<html>` carries `data-system="<id>"`, `data-mode="light|dark"`, classes `lite`, `admin`,
  `agent-full` (agent is full screen), `entering` (hero entrance running), `no3d` (flat ouroboros).
- Tokens: `[data-system="<id>"] { … }` (bare attribute, so the small preview cards
  `.mini[data-system="<id>"]` in the Designs gallery also get them).
- Dark/alternate variant tokens: `:root[data-system="<id>"][data-mode="dark"] { … }`.
- Everything else: prefix `:root[data-system="<id>"]` so nothing leaks into other systems or minis.
- Optional preview flourish: `.mini[data-system="<id>"] { … }` (cheap).
- Prefix keyframe names with the system id.

## Tokens (defaults in base.css `:root, [data-system]`)
Palette `--bg --bg-soft --fg --muted --accent --accent-fg --accent-text --ok`
Surfaces `--panel --panel-fg --panel-muted --line --line-strong --field --field-fg --chip-bg --chip-fg
--hover-bg --nav-bg --nav-glass --glass`
Shape `--bw --r --r-media --r-sm --r-xs --btn-r --chip-r --shadow --shadow-float --btn-shadow --press`
Type `--font-d` (hero name, case titles, signature) `--font-t` (section titles) `--font-b` (body)
`--font-l` (labels/data) `--d-style --d-weight --d-track --t-weight --t-track --t-case --label-case
--label-track`
Globe (read by JS) `--globe-dot --globe-home --globe-school --globe-now`
3D ouroboros: `--ouro-3d: 1|0` (JS reads it; set `0` to fall back to the flat SVG ring `.ouro-flat`,
e.g. for terminal/pixel-ish systems). When 3D is on, the tube is tinted from `--accent` and `--fg`.
Agent skin `--agent-bg --agent-fg --agent-muted --agent-accent --agent-line --agent-font
--agent-text-font --agent-r --agent-shadow`
Records `--rec-pill-bg --rec-pill-fg --rec-pill-muted --rec-label --rec-label-ink`
Motion `--ease-out --ease-in-out --ease-drawer` (don't change), layout `--page-max --gutter`.

## Fonts (JS loads one Google Fonts stylesheet per active system; always give fallbacks)
glass: Geist + `-apple-system,"SF Pro Display"` · comic: Bangers, Geist · brutal: "Archivo Black",
Archivo (variable wdth/wght) · neon: Audiowide, "Chakra Petch" · crt: VT323, "JetBrains Mono" ·
win98: system Tahoma/Verdana, VT323 for LCD bits · paper: Caveat, Kalam · pane: "IBM Plex Mono" ·
lab: "Bricolage Grotesque" (variable opsz/wdth/wght), "JetBrains Mono" · ledger: Doto (variable),
"IBM Plex Mono", "Libre Barcode 39 Text" · riso: Syne, "Instrument Serif" (italic), "Space Mono" ·
spectrum: "Unica One", "Geist Mono".

## Decoration slots (`display:none` until you enable)
In `.bg-layer` (fixed, z 0, pointer-events none): `.deco.blob.b1/.b2/.b3`, `.deco.halftone`,
`.deco.grid`, `.deco.ruled`, `.deco.sun`, `.deco.floor > i`, `.deco.grain`, `.deco.vignette`,
`canvas.deco.rain#rain` (JS draws character rain only when `data-system="crt"`; you show/size it),
`.deco.taskbar` (`.tb-start .tb-tasks .tb-task .tb-clock` live clock; Desktop 98).
Outside: `.deco.frame` (fixed 1px viewport frame, inset 8px), `.deco.scan` (fixed overlay z 70),
`canvas.deco.blobs#blobs` (Lab only: JS draws blob tracking boxes/IDs/coords; you `display:block`).
`.bg-layer` paints `--bg`; replace its background for textures (pre-rendered gradients only).

## Components and hooks (see index.html for exact markup)
- Nav: `.nav-wrap(.away when scrolled down) > .nav` with `.brand .ouro-mark` (animated SVG mark,
  colour = currentColor, head = --accent), `.nav-links a.roll` (JS splits letters into `.rc > span`),
  `[aria-current=page]`, `.nav-tools .nav-design .nd-dot .nd-name .nav-ask kbd .btn.sm`.
- Views: `main.view[data-view=home|work|case|about|play|resume|chat]`, one visible at a time.
- Hero: `.hero .hero-grid .hero-copy .hero-name.kinetic (.k-line > .ch with --k 0..1 from cursor
  proximity: give each system its own mapping) .ascii-name (JS-rendered FIGlet banner; show only
  in crt) .hero-status .live-dot .hero-line .ph (pointer-highlight phrase; JS adds an SVG .ph-box rect
  and .ph-cursor) .hero-ctas .btn.magnetic .btn.ghost .hero-visual .portrait-stage .portrait img
  .ascii-portrait (crt only) canvas.ouro-3d .ouro-flat` and the recruiter `.profile .pf dt dd .pf-sub`.
- Section frame: `.section .wrap .sec-head .sec-title .sec-dek .sec-more`, `.page-top`.
- Work: `.feature-grid / .work-list > a.fcard (.fc-media img|.no-media, .fc-view, .fc-tags .chip,
  .fc-title, .fc-ctx)`.
- Experience: `.ledger > li.lrow(.open) > button.lr-head (.lr-when .lr-role .lr-org .lr-where
  .lr-plus) + .lr-body > .lr-inner > div (.bullets li, .chips .chip)`.
- Education `.edu-row .edu-logo .edu-school .edu-degree .edu-meta`; FAQ `.faq details summary .ans`;
  Contact `.contact .contact-row .contact-email code .contact-actions .icon-link .logo`.
- Case page: `.case .case-col .case-back h1 .case-lede .case-meta dt/dd .case-figure .case-links
  .case-next .trace > i`.
- About: `.about-grid .about-bio .now .now-city .now-time .kv .globe .stack .st-row .colophon .steps
  .log`.
- Play: records `.records(.is-on .is-scratching) .rec-stage .rec-platter .rec-disc .rec-spin
  .rec-photo .rec-label (.rl-title .rl-sub .rl-side) .rec-sheen .rec-spindle svg.rec-arm .arm`
  `.rec-side .rec-pill-wrap .goo .goo-pill .goo-btn .rec-pill .rp-disc .rp-meta .rp-time .rp-bar
  .rec-play .rec-hint`. The `.goo` layer uses an SVG goo filter so the play button flows out of
  the pill when playing; keep `.goo-*` the same colour as `--rec-pill-bg`. The record photo stays a
  real photo; you may apply a filter/blend that suits your system (duotone, infrared, phosphor…).
  Games `.games .game-row (.gr-ic .gr-name .gr-desc .gr-base .gr-go) .game-frame .gf-bar .gf-body`
  + game internals (`.g-*`, `.tr-text`, `.g-canvas-box`, `.cd-box`, `.cd-div`, `.result .rc-*`).
  Designs gallery `.designs .mini`.
- Resume `.pdf-viewport .pdf-page` (keep the page white paper, restyle the viewport only).
- Footer `.footer .ft-sign .signature .ft-links .clocks .buffett-line .credits`.
- Agent (terminal coding agent, Claude Code grammar), present on every page:
  `.agent .agent-bar .ab-prompt .ab-input .ab-kbd .ab-send(.busy) .agent-panel .agent-head
  .agent-title .at-mark .agent-model .agent-actions .agent-log .agent-banner (.acc .dim) .t-tips
  .t-starters .t-chip(.sugg) .t-user .t-line .t-dot(.live) .t-body .t-tool(.args) .t-res .t-confirm
  .t-key(.primary) .t-src .t-acts .t-interrupted .t-sugg .agent-palette .agent-status .spin`;
  `html.agent-full` = full screen. **Reskin the agent fully per system** (see per-system briefs).
- Composer `.composer-wrap .composer .cmp-head .cmp-row .cmp-foot .field .field-err`.
- NEUTRAL, do not restyle: `.dial*`, `.pill`, `.toast*`, `.mock-bar`, `.pdf-page`.

## Rules
- Animate only transform / opacity (clip-path allowed). `backdrop-filter` only where the system is
  glass. Static textures via gradients or tiny inline SVG data URIs; never animate SVG filters or
  feTurbulence. Ambient loops: few elements, transform/opacity, pause under `html.lite`
  (base hides `.blob .rain .floor .grain .blobs`; hide anything else you animate).
- Hover only under `@media (hover:hover) and (pointer:fine)`. Visible focus rings.
- Body text ≥ 4.5:1, large ≥ 3:1, in both variants.
- No horizontal overflow at 390px; size the hero name per font so it fits.
- Keep the agent bar bottom-centre; you may change its shape/chrome completely.
- Comment each system block header with its name and signature idea.
- Keep each system ≤ ~450 lines. Self-check braces:
  `node -e "const s=require('fs').readFileSync(F,'utf8');let d=0;for(const c of s){if(c=='{')d++;if(c=='}')d--;if(d<0)throw 'neg'};console.log(d)"` → 0.
- You may screenshot with Playwright to verify: `require("/Users/rithvikpraveenkumar/.npm/_npx/e41f203b7505f1fb/node_modules/playwright")`,
  executablePath `/Users/rithvikpraveenkumar/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
  page `file://…/mockup-v4/index.html`, set `localStorage["rv4-system"]` (+ `rv4-mode`) before load.
  Routes are hashes: `#home #work #work-boilerframe #about #play #resume #chat`.
  `app.js` may still be in progress when you start; if it is missing, screenshot what renders.
