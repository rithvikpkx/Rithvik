# rithvik.ai overhaul: handoff

Status (2026-11-08): **APPROVED for development.** The owner approved the v7 direction (minus Relief) and
asked to start building it into the real site on `dev` (Vercel preview). Next session: start at
"Development plan" → Step 0. Nothing merges to `main` without the owner saying "merge to main".

## Summary of the design phase (read this first)
- v3 → v4: classic site + 12 CSS design systems, page routes, TUI agent, records player, games.
- v5: one long andreas.vision-style page, overlays instead of pages, a generated geometric ouroboros mark
  (`ouroPath`), plain portrait with GitHub/LinkedIn/Email nodes centred underneath and beams curving into
  the photo (owner rejected serpent decorations around the photo as too busy).
- v6: "absolutely wild, modern-art" rewrite. Each design became a **whole different website** rendered
  from one content file, each with one WebGL shader. Owner references: mindofakira.com (scratchable
  vinyl, drawing artboard), andreas.vision (light-hearted, cohesive motif, clean logo), suho.studio
  (density: one visual + little text per screen), christendijoux.com (fluid ASCII/halftone),
  petrillo.studio (instant red hit).
- v7 (approved): owner kept Nimbus, Stipple, Glyph ("crisp, well defined, high quality"), cut the busy
  ones, asked for trippy-but-calm designs with effects used smartly, 45–60fps, a performance mode, a
  shared knowledge graph, custom assets. Relief (embossed paper) was built and then **removed** ("not
  good"). Final set: **Nimbus (default), Stipple, Glyph, Prism, Mercury, Thermal, Starlight, Tracker,
  Foil**.
- Constant requirements: unfiltered portrait + three beamed contacts; Claude Code-style agent TUI;
  floating email window; design switcher (each design a different site); Play (records vinyl, artboard,
  Type Racer, Angle, Dots, Center the Div); resume window; minimal copy (no emoji, no exclamation marks,
  no invented facts); calm density; hireable.

## Links and files
- **v7 mockup (current):** https://claude.ai/artifact/GiBtDmZtV7hf7uLv7PrArV — sources in `docs/mockups/v7/` (contract
  `CONTRACT.md`, ten designs in `themes/`, generated assets in `assets/`). `?theme=<id>` opens a design.
- **v6 mockup (previous):** https://claude.ai/artifact/QAeMB9v6S4zsUdLqgAjHDp — sources in `docs/mockups/v6/` (contract
  `CONTRACT.md`; nine designs in `themes/`). Preview locally over http; `?theme=<id>` opens a design.
- **v5 mockup (previous):** https://claude.ai/artifact/9BiFx5yvvesRWxMFeJtXRe — sources in `docs/mockups/v5/`
  (contract `CONTRACT.md`; `systems-1.css` glass/comic/brutal/neon, `-2` crt/win98/paper/pane, `-3`
  lab/ledger/riso/spectrum). Serve over http locally (`python3 -m http.server --directory docs/mockups/v5`).
- **v4 mockup (previous):** https://claude.ai/artifact/SaunHuCP7ADViTosm7uLQL — sources in `docs/mockups/v4/`
  (`index.html`, `base.css` = classic site + token contract, `systems-1.css` glass/comic/brutal/neon,
  `systems-2.css` crt/win98/paper/pane, `systems-3.css` lab/ledger/riso/spectrum, `app.js`, `assets.js`,
  `CONTRACT.md` = the design-system contract, `assets/`).
- **v3 mockup (previous, kept for comparison):** https://claude.ai/artifact/9KyTTPdvyTF8BQ4hjdQUHV — sources
  in `docs/mockups/v3/`.
- **Asset bundle builder:** `docs/mockups/tools/build_assets.py` (builds `assets.js` from downloaded
  lucide-static 1.70.0, simple-icons 16.37.0, bootstrap-icons 1.13.2, world-atlas 2.0.2 land-110m,
  cli-spinners 3.4.0, FIGlet "ANSI Shadow" font, `commits.txt` git history). `lemniscate.txt` = logo path.
- **v4 IA / agent / Pane research note:** `docs/mockups/research/v4-ia-chat-pane.md`.
- Republish an artifact by passing its URL (`url`) to the Artifact tool and the files from `docs/mockups/v4/`.
- Local preview: Playwright at `/Users/rithvikpraveenkumar/.npm/_npx/e41f203b7505f1fb/node_modules/playwright`,
  Chrome at `~/Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/...`.
  `file://` blocks the mp3 fetch and canvas pixel reads (ASCII portrait); serve over http to test those.

## v7 mockup (current, 2026-11-08)
Owner verdict on v6: keep Nimbus, Stipple, Glyph ("crisp, well defined, high quality, high resolution");
cut Petal, Chroma, Synapse, Slit, Afterimage, Vertigo ("too busy, way too overwhelming"); Glyph needed
real separation between elements; Synapse's graph idea became a shared feature. New brief: trippy,
ethereal effects used smartly (not everywhere), 45–60fps sustained, a performance mode for low-power
machines, custom high-fidelity assets.
- Nine designs (Relief removed by the owner after review): Nimbus (default), Stipple, Glyph (now one pane per screen), Prism (chromatic aberration,
  dispersion, caustics), Mercury (liquid chrome metaballs, ferrofluid), Thermal (FLIR false colour,
  palette switch), Starlight (night vision, IR flashlight), Tracker (CV blob tracking over real page
  elements), Foil (holographic card, lenticular).
- Core additions: knowledge graph `H.graph()` (radial tree built from `content.js`: me → fields →
  projects/roles → skills, plus school and places; hover, click-to-card, type filters) in every design;
  performance mode = `html.lite` via the switcher's lightning button (shader frozen, designs drop their
  heavy effects) plus an offer when frames stay under ~32fps; case sheets show a generated project object.
- Assets: Nano Banana Pro on Weave (free tier: 2 runs) made the chrome ouroboros and chrome ribbon; Figma's
  generator (gemini-3.1-flash-image, gpt-image-2.5-flare) made the prism, paper, foil and six project
  objects. Figma file: https://www.figma.com/design/pCufh6qWiIDnYAls4uTMVE.
- Production notes: Thermal sets an extra uniform `u_pv` on the core GL program from outside (core should
  expose theme uniforms properly). Relief's files were removed from `docs/mockups/v7/`.

## v6 mockup (superseded by v7)
Owner brief: an "absolutely wild, visually stunning, bold, extremely abstract, almost modern-art"
portfolio; ethereal and emotional; vivid colour; granular details; each design a **completely different
website**; still hireable. Model: Opus 5.5 builds everything (owner's call after asking which model is
better; I said I couldn't verify Fable 5.1's design strengths). Effects budget: **one GPU shader per
design** (resolution-capped, adaptive, paused off-screen, still frame under reduced motion), else
CSS/SVG/DOM. Owner references (round 2): mindofakira.com (scratchable tilted vinyl, free-drawing
artboard), andreas.vision (light-hearted, cohesive pixel-cloud motif, clean minimal logo),
suho.studio (density: one visual + a little text per screen), christendijoux.com (fluid ASCII/halftone),
petrillo.studio (instant full-bleed red landing).
- Architecture (`docs/mockups/v6/`): `content.js` (`window.C`, the only facts), `core.js` (theme engine:
  each design's `render(C,H)` returns a whole site; shader runtime; portrait with three beamed
  contacts, photo never filtered; design switcher with circular view-transition reveal; Claude
  Code-style agent; floating email window; resume window; case sheet; the ouroboros mark `H.mark()`;
  Play window with records vinyl, artboard, Type Racer, Angle, Dots, Center the Div), `core.css`,
  `themes/<id>.js|css`, `CONTRACT.md` (rules for designs).
- Nine designs: Petal (default: full-red landing that breathes into crimson silk), Chroma (Bauhaus
  Truchet tiles), Synapse (connectome graph over an EEG field), Glyph (terminal broadsheet over a
  halftone/ASCII cortex, keyboard-first), Slit (festival bands, slit-scan at 128 BPM), Stipple (living
  ink-stipple pamphlet), Afterimage (cinematic scenes, projector beam), Vertigo (op-art moiré with a
  lens), Nimbus (light-hearted pixel-cloud sky after andreas.vision).
- v5 changes kept: plain portrait (no serpent layers) with the three contact nodes centred underneath
  and beams curving up into the photo.

## v5 mockup (superseded by v6 for direction; kept for comparison)
Owner feedback on v4 → v5 (2026-11-08):
17. **One long page, no page routes.** Sections: Hero → Work → Experience (+ Education row) → About
    (full-bleed accent band, pinned globe) → Play → Questions → Footer/Contact. The nav is an
    andreas.vision-style pill (mark + Work · About · Play · Contact) that only scrolls, with a sliding
    scroll-spy highlight and a page-progress ring around the mark; actions sit right (design pill,
    Resume, write-to-me). Chat, resume, email, case studies and games are **layers over the page**:
    agent bar (bottom), draggable non-modal windows (resume, composer), a bottom sheet with an X for
    case studies, and a FLIP expansion for play cards. Production keeps `/work/[slug]` etc. only as
    deep links that open the same layers (SEO), not as separate pages.
18. **Logo rebuilt**: a geometric ouroboros generated from one function (`ouroPath` in
    `docs/mockups/v5/app.js`): an even ring, a rounded snout with a wedge mouth, a tail that tapers
    into the mouth, an eye hole. Weights Fine / Ring (default) / Bold. Renders solid, inverse, accent,
    hatched, 16px favicon, spinner. Animations: draw-on (stroke mask), blink, hover spin, rotation tied
    to scroll in the nav, a giant hatched footer mark that draws in on scroll and whose pupil follows
    the pointer, a progress fill in the case sheet, the traveller on the About globe. Replaces the
    lemniscate mark.
19. **Portrait**: the 3D tube was dropped (read as phallic). Now a layered orbit with parallax depth:
    engraved serpent (Ouroboros by Abake, public domain), a measured ring with ticks + text path, a
    scaled serpent ring (Openclipart ouroboros, CC0), the photo. The **original photo + animated
    beams to GitHub / LinkedIn / Email is back**: three contact nodes on the orbit with pulses
    travelling into the photo.
20. **No project thumbnails** (inconsistent coverage). Work cards are type-led: icon, label, outcome
    headline, context, tags, a hatched mark watermark that turns on hover, "View" pill unroll.
21. **Play** = an endless 2D field of cards (drag/flick with inertia, horizontal trackpad, arrow keys;
    vertical wheel stays with the page), filter pill (All · Games · Designs · More) + shuffle. A card
    expands (FLIP) into its full UI: games, the records player, the mark specimen, Stack, Colophon.
    Design cards apply that design (toast + Undo).
22. Kept: theme pill dial, 12 design systems + 16 palettes, bottom chat bar (TUI agent), Buffett line.
    Systems were re-ported onto v5 markup (`docs/mockups/v5/CONTRACT.md`); the LarpParty
    `docs/UI-STYLES.md` styles were treated as spirit, not exact values.
Sources: `docs/mockups/v5/` (`index.html`, `base.css`, `app.js`, `systems-1..3.css`, `CONTRACT.md`,
`assets/ouro-engraved.svg`, `assets/ouro-scales.svg`). andreas.vision reference screenshots were taken
with Playwright (home, work, case, about, writing, play) for structure only.
UI proposals in v5: scroll-spy nav pill + progress ring; portrait orbit with depth parallax that
spreads as you scroll; type-led work cards; case sheet whose mark fills as you read; pixel-stepped
accent band with a scroll-scrubbed globe journey Boston → West Lafayette → SF; endless play field with
card-to-panel expansion; FAQ with an inline ask box that hands off to the agent; footer clocks with
day/night icons and GMT offsets; giant hatched mark with a watching pupil.

## Owner decisions (chronological, all still in force unless superseded)
1. Overhaul order: security/correctness fixes first, then features as vertical slices on `dev`.
2. Analytics: first-party events + IP→company enrichment + self-identified visitors (email given in
   chat/composer/resume download). Outreach = **reviewed draft queue**, never auto-send.
3. Resume: **Google Doc is master** → site auto-pulls a PDF export; admin = Sync now / Upload override.
4. Chat: TUI agent emulating **Claude Code** (prompt, slash commands, ⏺/⎿ tool rows, spinner, status
   line, Esc interrupt, ⏎/n/a confirmations), docked bottom-centre, ⌘K / `/` to summon, full-screen route,
   **reskinned per design system**.
5. Themes: keep the legacy palette themes (GitHub Light default + 15 others) as the simple "classic"
   site. Design systems must change the whole UI (feels like a new website), function unchanged.
6. Dial: keep the existing pill dial; one pill per system + sun/moon variant chip; two groups (Designs,
   divider, Palettes). Default stays **GitHub Light**; theme discovery emphasised (nav design control,
   dial wiggle, T shortcut, Designs gallery in Play, switch toast with Undo).
7. **Curated 12 design systems:** Pane (new TUI), Lab (depth map + blob tracking), Ledger (receipt +
   emboss/deboss), Riso (risograph), Spectrum (infrared light / night-vision dark), Liquid Glass, Comic
   Pop, Neo-Brutalist, Neon Arcade, CRT (renamed from ASCII Terminal), Desktop 98, Paper Sketch.
   Retired: Tide Pool, Claymation, Pixel Retro, Sakura, Blueprint.
8. Liquid Glass variants: pastel daylight = light, navy night = dark (approved).
9. Hero: portrait + **3D ouroboros** circling it (raw WebGL, no Spline). Logo = animated SVG ouroboros
   travelling an infinity loop (lemniscate), in nav, footer, record label.
10. **No Lenis** (removed per research: hurts latency, find-in-page, anchors). Native smooth anchors.
11. Copy: clean, minimal, one-word section titles (Work, Experience, Education, Questions, Contact,
    About, Play). Andreas-style pill nav: Work · About · Play + design control + Ask ⌘K + Resume.
12. Remove the "Then → Now" growth section entirely. Career core first, fun after.
13. Hold off on work-tied UI (EEG trace ribbon, TinyML circuit board) until the owner updates his work
    content. Experience section needs updated content from the owner.
14. Use existing internet assets wherever possible (icons, logos, photos, fonts, audio, map data) with
    licences respected and credited in one footer line.
15. Record player must be high fidelity (real photographic LP, fluid pill player with a goo-filter play
    button that detaches while playing), scratchable.
16. Minigames live on `<game>.rithvik.si`; rithvik.ai embeds them. Deliverable for that repo: detailed
    prompts the owner passes to Claude Code sessions in the rithvik.si codebase (not written yet).

## v4 information architecture (as mocked)
Routes (hash views in the mockup; real routes in Next): `/` · `/work` · `/work/[slug]` · `/about` ·
`/play` · `/resume` · `/chat` · `/buffett` (unchanged plain-HTML page).
- **Home:** Hero (italic serif name with kinetic weight hover; status line `CS + Math at Purdue · open to
  SWE and AI internships`; one sentence; CTAs View resume + Ask a question; portrait + 3D ouroboros) →
  Profile ledger (Based in, Studying, Focus, Latest, Open to, Resume) → Work (3 featured cards: Mind-
  Controlled Arm, BoilerFrame, Citizen Happiness) → Experience (expandable ledger rows) → Education (one
  row) → Questions (recruiter FAQ) → Contact (email + copy, View resume, Write to me, GitHub, LinkedIn) →
  Footer (serif signature, sitemap, clocks Boston / West Lafayette / SF, Buffett line, credits).
- **Work:** all 6 projects as cards → case page (640–680px column, H1 serif, lede, tags, meta row
  Type/Context/Stack, figure, bullets, links, next project, reading-progress trace).
- **About:** bio, Now (city, live time, building/researching/learning, Natural Earth dot globe with
  Boston→West Lafayette→SF arcs), Stack (grouped, real logos), Colophon (how the site works + real git log).
- **Play:** Records (turntable), Games (8 rows; 4 playable in mockup: Type Racer, Angle Approximator,
  Count the Dots, Center the Div; others Big-O or Bust, Hex Eye, Reaction Lab, Prime Time), Designs gallery.
- **Resume:** PDF viewer page with Download; admin Sync now / Upload override.
- Cut from v3: "12 ways" strip, hero style chip, coach mark, Stack Map, ticker, Notes grid, home Colophon,
  sample contribution graph, Then→Now, eyebrow labels above headings.
- Placeholders the owner must fill: `{{season and dates}}` (internship availability), `{{graduation}}`,
  work authorization, newest experience entries, LinkedIn URL.

## Classic design rules (base.css)
Tokens: see `docs/mockups/v4/CONTRACT.md`. Type: Newsreader italic (hero name, case H1, signature only),
Geist (titles 500, body 16/1.65), Geist Mono (data/labels 12px). Section titles one word,
`clamp(2.75rem, 6.2vw, 6rem)`, tracking -0.035em. Container `--page-max 1264px`, gutter
`max(clamp(20px,6vw,88px), (100vw-1264px)/2)`. Hairlines instead of cards (only Work uses cards; media
radius 20, hover = image scale 1.04 over 600ms in-out + "View" pill unroll via clip-path). Curves:
`--ease-out cubic-bezier(.23,1,.32,1)`, `--ease-in-out cubic-bezier(.77,0,.175,1)`,
`--ease-drawer cubic-bezier(.32,.72,0,1)`; UI ≤ 300ms; one hero entrance (lead name 12px rise 600ms,
support +120ms, decoration fade); no scroll reveals; nav hides on scroll down (blur 6px, -12px, 200ms);
panels use transitions + `@starting-style` (not keyframes); reduced motion = gentler not zero.
Design-system switch = 480ms datamosh View Transition (clip-path bands + hue/saturate steps), crossfade
under reduced motion; palette flips instant.

## Agent (chat) spec — production target
Grammar: welcome box banner; `❯` prompt; slash commands `/help /resume /projects [slug] /experience
/contact [subject] /theme <name|random|list> /now /clear /export /history /fullscreen /quit` (client-side,
rendered as tool calls); turn = user line → `⏺ Rewrite(follow-up)` (if follow-up) → `⏺ Search(site,
"q")` + `⎿ N records · source score…` (from real retrieval metadata, no extra model calls) → streamed
`⏺` answer (append text nodes; hollow/blinking dot while streaming) → `[n] source` footnotes → permission
confirm `⏺ Open project "X"?` `[⏎ Yes] [n No] [a Always this session]` for side effects (navigate, open
composer, external link); theme switches run immediately with `u Undo`. Spinner frames from cli-spinners
`dots`, verbs rotate ~1.2s (Retrieving, Reading, Grounding, Drafting, Verifying) + elapsed + "esc to
interrupt". Status line `● ready · 23 records + resume · ctx 4.1k · N turns · ? for shortcuts`, 429 →
`⚠ rate limited · retry in Xm`. Keys: ⌘K/`/` summon, Esc interrupts (AbortController) then closes, ↑/↓
history (50, localStorage), Tab/↑↓ palette, ⌘⏎ full screen, Ctrl+L clear, Ctrl+U clear line, `?` help.
Admin (edit mode) commands replace SecondaryContextPanel: `/embed`, `/temp 0.7`, `/docs`.
Bot brain upgrades (from earlier plan, still valid): history-aware query rewrite; full published profile
in context every turn + vector search only for uploaded docs; resume + FAQ keys in corpus; prompt allows
partial answers; stronger model for the answer call only (pick by eval); tool calling (show_section,
open_project, open_resume, start_game, switch_style, draft_email, local_time) with server-side target
resolution (model never supplies URLs); cited sources; 40-question golden eval; drop LangChain; abort on
`req.signal`; `safeUrl` on markdown links.

## Design systems (12) — signatures (full CSS in docs/mockups/v4/systems-*.css)
- **Pane** (tmux/lazygit/Claude Code TUI, IBM Plex Mono, char-cell grid, no radii/fades; light Solarized
  paper, dark Catppuccin-ish `#11111b/#cdd6f4/#89b4fa`; panes titled `[n] name`; nav = tmux window bar).
- **Lab** (depth map + blob tracking; `#0e1116`, detection green `#9cff6b`; Bricolage Grotesque +
  JetBrains Mono; corner ticks, ID/coord labels; JS draws tracking boxes on `#blobs` canvas; NOTE its
  default (light mode) is the dark lab and the moon toggle shows the pale bench — inverted semantics).
- **Ledger** (receipt + emboss/deboss; paper `#f4f1ea`, ink `#2b2a28`, stamp red `#c8372d`; Doto + IBM Plex
  Mono + Libre Barcode 39 Text; perforated stubs, dotted leaders, AVAILABLE stamp, thermal-printer agent).
- **Riso** (fluoro pink `#ff48b0`, blue `#0078bf`, yellow `#ffe800` on `#f3efe6`; Syne + Instrument Serif +
  Space Mono; misregistration that snaps on hover; duotone photos — known issue: record disc turns blue).
- **Spectrum** (light = infrared plum/pink, dark = night-vision green; Unica One + Geist Mono; halation,
  vignette, reticles, 900ms exposure fades; film-strip work cards).
- **Liquid Glass**, **Comic Pop**, **Neo-Brutalist**, **Neon Arcade**, **CRT** (FIGlet banner + ASCII
  portrait + rain, `--ouro-3d:0`), **Desktop 98** (bevelled windows, taskbar, CD Player window, no MS
  branding), **Paper Sketch** (ruled notebook, stickers, tape).
- 3D ouroboros reads `--ouro-3d` (0 → flat SVG ring). Fonts load per active system from Google Fonts.

## Research digests (sources the owner supplied; key takeaways)
- **ai-design-skills (elayadesign):** one primary CTA above fold; no eyebrow labels; no periods in hero
  heading; Tailwind type scale; spacing 0/2/4/8/12/16/24/32/40/48/64/80/96; radius 0/2/4/6/8/12/16/24/full,
  nested radius = outer − gap; base curve `cubic-bezier(.22,1,.36,1)`; recruiter FAQ before Contact; final
  CTA = hero CTA; mark unknown facts `{{like_this}}`.
- **christendijoux.com:** two colours + alpha tiers; three-role type (condensed display / Geist body /
  11px mono uppercase labels as an "instrument panel"); hairlines, 1px viewport frame; profile ledger near
  the top; don't copy its 2.8s preloader, pinned horizontal rail, dithered-only portrait.
- **andreas.vision:** pill nav, italic serif used in exactly 3 places, one-word section titles ~105px
  Geist 500; card hover never moves the card (media scale + "View" pill clip-path unroll); nav hides on
  scroll; case pages show meta before imagery; his "fluid CD player" is a muted video, not interactive.
- **emotion-agency.com:** feel → believe → verify → act; lightness-only mood shifts; one pinned beat max;
  decode effect on one line only; opt-in micro-sound; avoid long pinned stories, GL text effects, Lenis.
- **Emil Kowalski skills:** gate animation by frequency (keyboard actions → none); 3 curve tokens; never
  ease-in; UI < 300ms; enter scale .95–.97, never 0; transitions not keyframes for re-triggerable UI;
  gestures 1:1 then velocity-seeded spring; release velocity from last 3–5 moves; no per-frame CSS vars
  on parents; reduced motion = gentler; throttle text/aria updates.
- **impeccable (pbakaus):** ban eyebrow kickers; no gradient text; elevation once (border OR shadow); no
  nested cards; mono only for code/data; real icon set; theme browser surfaces (caret, scrollbar, focus).
- **unslop (heydamir, CC BY 4.0 — credit if adapted):** one bright element, quiet chrome; sentence case;
  4px grid; no emoji; no exclamation marks; no trailing periods on short strings; no looping decoration.
- **taste-skill / ui-ux-pro-max:** real photos and real full-colour logos; no captions under visuals;
  44px tap targets; errors inline under fields; hero enters once.
- **Skiper UI / Aceternity UI:** usable (adapt, theme via tokens): Magnetic Button, Pointer Highlight,
  Text Roll nav (Skiper58 — free tier requires attribution "Skiper UI"), Expandable Card, Direction Aware
  Hover, Tracing Beam, Draggable Card, Compare slider, Progressive Blur (Skiper41), Card Stack Scroll
  (Skiper16, strip its bundled Lenis). Skip glows/beams/sparkles/bento/marquees/preloaders. Skiper imports
  `framer-motion` → rewrite to `motion/react`.
- **Spline:** rejected (runtime 442–813 KB gz, watermark on free, self-hosting needs Pro ~$300/yr). 3D
  ouroboros done in raw WebGL (OGL ~20 KB is the production option).
- **Visual styles research:** CRT/receipt/depth/blob/datamosh/night-vision/riso/infrared/emboss recipes →
  became Lab, Ledger, Riso, Spectrum, datamosh switch, emboss buttons. Static textures only; no animated
  feTurbulence; canvas ≤ 24 fps, DPR ≤ 1.5, pause off-screen.

## Assets used (licences) — credit in one footer line
Lucide icons (ISC), Simple Icons (CC0), Bootstrap Icons LinkedIn (MIT), Natural Earth via world-atlas
(public domain), cli-spinners (MIT), FIGlet ANSI Shadow, Evan-Amos 12" LP photo (public domain, Wikimedia),
"Chili Pepper" by Fred Longshaw 1927 (public domain, Wikimedia; trimmed to 72s loop, 96 kbps), YouTube
thumbnails of the owner's own demos (arm W8EzUuWgi4o, SHAPE eBzE83IjDZM), GitHub OG images of his repos,
Google Fonts (OFL). v3 also used Crissy Field photo (PD) and Purdue Engineering Fountain (Julian Herzog,
CC BY 4.0).

## Codebase scan findings (pre-overhaul; fix in Wave 1)
Security: Next 16.2.6 has critical advisories → upgrade ≥ 16.4.5 + `npm audit fix`; check Supabase Auth
redirect allow-list has no broad `*.vercel.app` wildcard (magic-link session hijack) + disable public
signups; unpublished projects/experience render publicly (service-role reads, no `published` filter);
rate limits are per-exact-IP, racy and fail-open, `chat_requests` never pruned → atomic RPC, IPv6 /64,
global caps, fail closed; SimpleMarkdown renders model-authored URLs → `safeUrl`; no CSP/security
headers; theme tokens injected unescaped into `<style>`; exit-edit-mode never signs out; `lib/supabase.ts`
mixes browser and service-role clients (split + `server-only`).
Correctness: inline-edit saves update UI before save with no rollback; RagBot `finally` race unlocks
input mid-stream; history includes welcome/notices; `backfillPrimaryEmbeddings` deletes before
re-embedding and is unbatched; `sql-schema.md` is destructive and reintroduces removed RLS policies.
Perf: Supabase client (63 KB gz) shipped to every visitor; hero invisible until JS; globe redraws idle
at 4× DPR; FlickeringGrid ~13k fillRects/frame; LangChain 1 MB server chunk; dead admin CSS.

## Development plan (current)
Source of truth for the UI: `docs/mockups/v7/` (published https://claude.ai/artifact/GiBtDmZtV7hf7uLv7PrArV):
`content.js` (the content shape `C`), `core.js` + `core.css` (shared engine and chrome), `themes/<id>.js|css`
(nine designs), `CONTRACT.md` (rules every design follows), `assets/` (generated images, record + audio).
Process: work on `dev` (every push = Vercel preview). Big streams run as subagents in git worktrees on
feature branches off `dev`, one logical change per commit (`feat:/fix:/chore:/refactor:`); merge into `dev`
one branch at a time; verify (tsc, eslint on touched files, `next build`, preview) before each push.
Never push or merge to `main` without "merge to main". Apply `supabase/*.sql` migrations to the linked
`Rithvik` project before relying on them.

### Step 0: general fixes (current site, before any UI work)
From the codebase scan; each item is its own commit.
- Security: upgrade Next to ≥ 16.4.5 + `npm audit fix`; Supabase Auth redirect allow-list without broad
  `*.vercel.app` wildcards, public signups disabled (dashboard settings: tell the owner what to click);
  filter unpublished `projects`/`experience` in every server read; rate limits as an atomic Postgres RPC
  (IPv6 /64 bucketing, global caps, fail closed) and prune `chat_requests`; `safeUrl` for any URL rendered
  from model output; CSP + security headers in `next.config.ts`; escape theme tokens injected into
  `<style>`; exiting edit mode signs out; split `lib/supabase.ts` into browser vs `server-only` service-role
  modules.
- Correctness: inline-edit saves with rollback on failure; RagBot `finally` race that unlocks input
  mid-stream; chat history excludes welcome/notices; `backfillPrimaryEmbeddings` upserts-then-trims and
  batches (like `reembedSecondaryDocuments`); remove or fix the destructive `sql-schema.md`.
- Perf: keep the Supabase browser client out of visitor bundles; hero renders without JS; drop LangChain for
  a thin `lib/openai.ts` (the RAG pipeline otherwise unchanged).
- Done when: tsc + eslint + `next build` clean, preview renders, chat and contact still work.

### Final-site vision (owner, 2026-11-08; supersedes "dial and palette themes go away")
The page always uses the v7 layout. The existing side pill dial (`ThemeDial`) stays and gains the nine
designs alongside the legacy palette themes, which stay selectable. A legacy palette = a "classic" design:
the v7 layout coloured by that palette's 7 tokens. Step 1's switcher work extends the dial rather than
replacing it.
- Decisions (2026-11-08): palettes all share one **Classic** v7 layout (no shader, coloured by the palette's
  7 tokens; built from the v5 long-page base + v4 classic rules, reviewed on the preview); the 9 designs keep
  their own layouts. **Default for first-time visitors = GitHub Light palette (Classic)**, not Nimbus.
  Step 1 is done when Classic and Nimbus both render end to end from DB content.

### Step 1: foundation for the overhaul
- Content: extend the DB to the `C` shape in `docs/mockups/v7/content.js` (projects: headline, kind,
  icon, ctx, desc lines, tags, links jsonb, sort_order, featured; experience; education expected_grad;
  `site_content` keys for status, line, thesis, about, now, faq, numbers). One server `getContent()`
  returns `C`; ISR stays.
- Design engine: `lib/designs/` registry; each design is a lazy-loaded client component
  (`next/dynamic`) plus CSS scoped under `[data-design="<id>"]`; choice persisted in localStorage +
  cookie so SSR and the pre-paint script pick the right design without a flash; default Nimbus; switcher
  with the circular view-transition reveal; `T` cycles; `?theme=` deep link.
- Shared components (port from `docs/mockups/v7/core.js`): Mark (ouroboros), Portrait (photo never
  filtered, three nodes + beams), KnowledgeGraph (`KG` build + radial `kgLayout`, hover/click card/
  filters, built from DB content), CaseSheet (`/work/[slug]` deep links open it), Windows (Resume,
  Composer → existing `/api/contact`), PlayWindow (records vinyl with Web Audio scratch, artboard,
  4 games), Toast, Performance mode (`html.lite` + fps watchdog under ~32fps).
- Shader runtime: one WebGL context singleton, shared GLSL head (noise helpers), adaptive resolution,
  pause off-screen/hidden, still frame under lite/reduced motion, **plus a proper per-design uniforms
  API** (replaces Thermal's `u_pv` workaround).
- Agent: port the TUI grammar (prompt, slash commands, tool rows, status line, confirmations, `/theme`
  switches designs) onto the existing `/api/chat` stream + suggestion protocol. Agent backend upgrades
  (query rewrite, full-profile context, tool calling, abort on `req.signal`, eval set) can follow in Step 3.
- Done when: Nimbus renders end to end from DB content on the preview with all shared components.

### Step 2: port the designs
Order: Nimbus → Glyph → Stipple → Prism → Mercury → Thermal → Starlight → Tracker → Foil. Each port turns
`render(C,H)` into JSX and `mount()` into effects with cleanup, reuses its shader and CSS, and keeps the
`CONTRACT.md` rules. Acceptance per design: visual parity with the mockup at 1440×900 and 390×844,
45–60fps with the shader running, performance mode as a designed still, no horizontal overflow, body text
≥ 4.5:1, keyboard reachable, no console errors. Move generated assets from `docs/mockups/v7/assets/` to
`public/` (Figma source file: https://www.figma.com/design/pCufh6qWiIDnYAls4uTMVE).

### Step 3: features
Resume (Google Doc is master → PDF export sync to Storage; admin Sync now / Upload override), knowledge
graph from DB, agent upgrades (above), edit mode for the new content fields, `/buffett` unchanged,
minigames later on `<game>.rithvik.si` with embeds (prompts doc for that repo still to write), analytics
and outreach after launch (first-party events, review queue, never auto-send).

### Step 4: verification and merge
Playwright contact sheets per design × 1440/390 (normal + performance mode), fps check under 4× CPU
throttle, contrast audit, preview review by the owner. Merge to `main` only on "merge to main".

## Open items for the owner
- v7 approved (2026-11-08). Pending: the Mercury builder the owner resumed may have edited `themes/mercury.*`
  after the last publish; check `git diff`/the artifact before porting Mercury.
- Provide: newest experience entries, internship dates, graduation date, work authorization, LinkedIn URL,
  real game baselines.
- Copy to review: lines designs wrote in their own voice (e.g. Nimbus "Head in the clouds, hands on the
  hardware", Thermal "Six builds, warmest first."); no new facts were added.
