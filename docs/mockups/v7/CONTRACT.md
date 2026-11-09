# rithvik.ai v7: design contract

v6 is not a skin system. **Each design is a complete website of its own**: its own layout, information
architecture, typography, motion, interaction model and one GPU shader, rendered from the same content
(`content.js` → `window.C`). Switching designs swaps the whole site. The owner's brief: "absolutely wild,
visually stunning, bold, creative, extremely abstract, almost modern-art level", ethereal and emotional
(visitors should feel a wave of awe), with pops of vivid colour and many small granular details, while
still clearly a software / AI engineer portfolio that gets him hired.

Read `index.html`, `core.css`, `core.js` and `content.js` first. Write only your two files:
`themes/<id>.js` and `themes/<id>.css` (both already linked from index.html). Do not edit anything else.

## Register
```js
V6.theme({
  id: "<id>", name: "<Name>", mood: "<2-4 words>", dark: true|false,
  keywords: ["words", "the agent", "maps to you"],   // e.g. /theme <word>
  fonts: "family=Foo:wght@400;700&family=Bar",          // Google Fonts css2 query, no host
  swatch: ["#bg", "#fg", "#a", "#b"],                    // switcher card colours
  cardFont: '"Foo", serif',                              // switcher card title font
  colors: ["#c0", "#c1", "#c2", "#c3"],                  // shader uniforms u_c0..u_c3
  shaderScale: 0.5,                                      // 0.35–0.6 of CSS px × DPR (adaptive below)
  shaderHost: "#selector" | undefined,                   // element in your markup that hosts the canvas; omit = fixed full-screen background
  shader: `void main(){ … gl_FragColor = vec4(c, 1.); }`,
  render(C, H) { return `…whole site html…`; },
  mount(root, H) { …; return () => { /* remove every listener, timer, rAF */ }; },
});
```
## Shader (GLSL ES 1.0, one per design)
Prepended for you: `precision highp float;` uniforms `u_res` (px), `u_time` (s), `u_mouse` (0..1,
smoothed, y up), `u_scroll` (page 0..1), `u_dark`, `u_c0..u_c3` (vec3), and helpers `hash21 vnoise
snoise fbm` (fbm = 5 octaves of simplex). Budget: it must hold 60fps at 1440×900 on an M1 at scale 0.5
(the runtime lowers resolution if frames run long). Keep it to roughly ≤ 3 `fbm` calls per pixel. Add a
dithering/grain final pass so the capped resolution reads as texture, not blur. Under reduced motion or
"calm effects" the core renders a single still frame. No other WebGL contexts and no 2D canvases;
everything else is DOM, CSS and SVG.

## render(C, H): the whole site
`H` = `{ C, esc, icon(name), logo(slug), chip(tag), portrait({id, cls}), mark(kind), graph({id}), KG, PLAY, openPlay(id), hydrate, reduceMotion, fine,
P(slug), toast, store, openCase(slug), openComposer(subject), openResume(), openAgent(question),
clock(tz), kickShader }`. Icons: Lucide names in `assets.js` (`icon("arrow-up-right")` etc.); logos:
Simple Icons slugs (`github`, `linkedin`, `python`, `react`, `tensorflow`, `arduino`…).
Declarative hooks the core wires for you: `data-agent` (open the agent), `data-resume` (resume window),
`data-compose` / `data-compose="Subject"` (floating email window), `data-case="<slug>"` (case sheet),
`data-theme-go="<id>"` (switch design), `data-copy="text"`, `data-clock="<IANA tz>"` (filled on render), `data-play="<toy id>"` (Play window).

Required content and anchors (any order, any form your concept wants):
- `#top`: first screen. Name, what he does, the status line (open to SWE and AI internships), and clear
  ways to act: resume, email, ask. The portrait must be visible on the first screen or one scroll away.
- **Portrait**: call `H.portrait({ id: "<id>" })` exactly once and size it via a wrapper's width. The
  photo is never filtered, tinted, blended, masked into a shape that hides the face, or overlaid (core
  enforces `filter:none`). The three contact nodes (GitHub, LinkedIn, Email) and their beams curving
  into the photo must stay visible and pulsing; restyle them through `--pt-*` tokens and scoped rules
  on `.pt .pt-photo .pt-node .pt-beam .pt-pulse` (shape, colour, ring, size, glow) but keep the
  geometry.
- `#work`: all 6 projects, each opening its details (`data-case` → core sheet, or your own inline
  presentation with the same facts). `#experience`: the 4 roles + education. `#about`: about text plus
  now/places. `#contact`: email (`data-compose`), GitHub, LinkedIn, resume. Stack and FAQ are optional
  but welcome; `C.numbers` are true facts you may feature.
- Copy: you may write your own headings and micro-copy in your design's voice, but **no new facts**:
  every claim must come from `C`. No emoji, no exclamation marks, no lorem ipsum. Keep `{{placeholders}}`
  visible where content uses them.

## v7: owner feedback that overrides anything above
The owner kept **Nimbus, Stipple and Glyph** because they are "crisp, well defined, high quality and high
resolution", and cut the others for being "too busy and way too overwhelming: the content density and
overall stuff happening on the screen is just too much". Every v7 design must therefore:
- **Be calm in structure, wild in one place.** Generous space, clear separation between elements (real
  gaps, panes, rules; never one merged blob of UI), one idea and a little text per screen. Busy is a bug.
- **Use its signature effect smartly, not everywhere.** Full intensity in one or two moments (the first
  screen, a transition, a hover reveal, a scroll beat); subtle or interaction-triggered elsewhere; absent
  behind reading text. Name in a comment at the top of your JS where each effect appears and why.
- **Look crisp and high resolution.** Sharp type and edges, no mushy blur over content, shader output
  composed so its lower internal resolution reads as texture (dither/grain) or sits behind a crisp layer.
- **Performance:** sustain 45–60fps at 1440×900 with the shader running (shaderScale may go up to 0.75 if
  it holds 45fps; more than one fbm per pixel is fine within that). **Performance mode** is `html.lite`
  (the switcher's lightning button): the core already freezes the shader to one still frame; you must also
  turn off your ambient loops, heavy filters, blend modes, `backdrop-filter`, large animated transforms and
  canvas-like DOM churn under `html.lite`, while the design still looks intentional (a designed still, not a
  broken page). Verify performance mode with screenshots.
- **Knowledge graph:** include `${H.graph({ id: "<id>" })}` in a section with `id="graph"` (titled in your
  voice, e.g. "Map", "Connectome", "Index"). The core lays it out as a radial tree (Rithvik → fields →
  projects/roles → skills, plus school and places) and wires hover, click-to-card and type filters. Style it
  fully: `--kg-h --kg-edge --kg-edge-lit --kg-label --kg-font --kg-me --kg-field --kg-project --kg-role
  --kg-school --kg-place --kg-skill --kg-card-bg --kg-card-fg` and scoped rules on `.kg .kg-svg .kg-edge
  .kg-node[data-type] .kg-shape .kg-ring .kg-label .kg-legend .kg-key .kg-dot .kg-card .kg-act .kg-links`.
  Don't set `transform` on `.kg-node` (it carries the position); animate `.kg-bob` inside it instead.
- **Custom assets:** generated, high-resolution images may be provided under `assets/<id>/` and
  `assets/projects/` (the orchestrator will message you the files). Use them as decoration (`alt=""`,
  `loading="lazy"`, `decoding="async"`, explicit width/height), never as the portrait, and degrade
  gracefully if a file is missing.
- The portrait rule is unchanged: the real photo, never filtered, tinted, thermal-mapped or overlaid.

## Owner direction, round 2 (applies to every design)
- **Density, like suho.studio**: one visual idea and a little text per screen. Light and digestible;
  never crammed. Generous pacing beats more stuff.
- **Light-hearted and fun throughout** (andreas.vision, mindofakira.com): small playful touches,
  surprises on hover, toys. Serious about the work, never stiff.
- **The logo**: `H.mark()` returns the clean minimal ouroboros mark as inline SVG (currentColor;
  `H.mark("hatch")` for a hatched version). Use it as the site logo in your nav/header, and if it fits
  your concept as a recurring motif (andreas.vision uses his horse everywhere). Don't redraw it.
- **Play**: include a `#play` section (any form: shelf, arcade, exhibits, programs, tracks...) with an
  entry point for every toy in `H.PLAY` (`{ id, name, desc, icon }`): buttons/links with
  `data-play="<id>"`, or call `H.openPlay(id)`. Toys: `records` (a tilted vinyl you can drag to scratch,
  like mindofakira.com), `artboard` (free drawing with mirror), and games `typeracer`, `angle`, `dots`,
  `center`. The Play window is shared core chrome: restyle it via tokens and scoped rules on
  `.play-win .play-tabs .play-body .ab-* .records .rec-* .g-* .result .rc-*` like the other windows.

## Chrome: make it yours
The core chrome (switcher bottom-left, agent bar bottom-centre, email + resume windows, case sheet,
toast) is styled through tokens; set them under `:root[data-theme="<id>"]` and go further with scoped
overrides so the chrome feels native to your site:
`--ui-bg --ui-fg --ui-muted --ui-accent --ui-accent-fg --ui-line --ui-field --ui-font --ui-mono --ui-r
--ui-shadow --ui-blur` and portrait `--pt-ring --pt-ring-w --pt-photo-bg --pt-photo-r --pt-shadow
--pt-node-bg --pt-node-fg --pt-node-line --pt-node-r --pt-node-size --pt-beam --pt-pulse-a --pt-pulse-b
--pt-beam-w --pt-pulse-w`. The agent keeps its Claude Code grammar (❯ prompt, ⏺ tool rows, status
line) but should be fully reskinned per design (selectors: `.agent .agent-bar .ab-* .agent-panel
.agent-head .agent-log .agent-banner .t-* .agent-palette .agent-status`). Don't move the agent bar or
switcher off their corners, don't hide them.

## CSS rules
- Every selector starts with `:root[data-theme="<id>"]` (body background too:
  `:root[data-theme="<id>"] body { … }`). Keyframes prefixed `<id>-`. Never style other designs.
- The fixed shader canvas sits behind `#stage` (z 0 vs 1); keep text legible over it.
- Animate transform / opacity / clip-path only; other properties only on hover/focus transitions.
  `backdrop-filter` sparingly. No animated SVG filters. Pause ambient loops off-screen and under
  `html.lite`. Hover effects under `@media (hover:hover) and (pointer:fine)`.
- Accessibility: body text ≥ 4.5:1 against what is actually behind it, visible focus, keyboard
  reachable controls, semantic headings, `prefers-reduced-motion` respected (gentler, not dead).
- No horizontal overflow at 390px. The first screen must render complete on first paint (no
  preloaders, no sound gates, nothing waiting at opacity 0 for an observer).

## Verify (required)
Serve: `http://localhost:8765/index.html?theme=<id>` (if down: `python3 -m http.server 8765 --directory
<v6 dir>`). Playwright: `require("/Users/rithvikpraveenkumar/.npm/_npx/e41f203b7505f1fb/node_modules/playwright")`,
`executablePath` `/Users/rithvikpraveenkumar/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`.
Screenshot 1440×900 and 390×844: the first screen, every section, the agent open (`click [data-agent]`,
then type a question), the email window (`click [data-compose]`), a case (`click [data-case]`) and the
switcher deck (`click #sw-toggle`). Look at every shot and fix what's off. No console errors (log
`pageerror` and shader warnings). Check frame rate roughly: in the page, count rAF ticks over 2s with
the shader running (expect ≥ 55 at 1440×900).
