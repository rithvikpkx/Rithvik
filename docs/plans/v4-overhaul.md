# rithvik.ai v4 overhaul — handoff

Status (2026-11-08): **design phase, mockup v4 published and awaiting owner review.** No production code
has changed yet. Next step after owner approval: parallel implementation on `dev` with granular commits
(see "Implementation plan"). Nothing merges to `main` without the owner saying "merge to main".

## Links and files
- **v4 mockup (current):** https://claude.ai/artifact/SaunHuCP7ADViTosm7uLQL — sources in `docs/mockups/v4/`
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

## Implementation plan (after owner approves v4 mockup)
Subagents in git worktrees on feature branches off `dev`; one logical change per commit
(`feat:/fix:/chore:/refactor:`); orchestrator merges into `dev` one branch at a time and pushes for a
Vercel preview per wave. Never push `main`.
- **Wave 1:** A security & correctness (findings above) · B design-system foundation (token contract from
  `docs/mockups/v4/CONTRACT.md`, `data-system` + `kind palette|system` on `themes` table, CSS split, dial,
  datamosh switch, fonts via next/font `preload:false`) · C agent backend (`lib/openai.ts`, query rewrite,
  full-profile context, tool calling, abort, eval set, drop LangChain).
- **Wave 2:** D/E/F the 12 systems (port `docs/mockups/v4/systems-*.css`) · G agent UI (TUI grammar above)
  · H pages/routes (`/work/[slug]`, `/about`, `/play`, `/resume`, `/chat`), 3D ouroboros (OGL), records
  player, Buffett entry · I resume (Drive API export cron → Storage, viewer) · J Arcade host
  (`GameEmbed` sandboxed iframe, postMessage `{type:"score"}` / `{type:"style", system, mode}`, origin
  allowlist, CSP `frame-src`) + J′ rithvik.si prompts doc.
- **Wave 3:** K analytics & outreach (Vercel Analytics/Speed Insights, `/api/track` beacon, IP→company
  enrichment, dashboard, review queue, privacy page) · L verification (Playwright contact sheets per
  system × 1440/390, 4× CPU-throttle 60fps check, contrast audit, CI) · stretch MCP read-only API.
Data model additions: `projects` (summary, body_md, year, featured, sort_order, media_url, media_alt,
links jsonb), `education` (expected_grad), `site_content` keys (hero.status, now.*, faq.*),
`themes.kind`, `resume_versions`, `game_scores` (baselines), optional `chat_sessions`.

## Open items for the owner
- Review v4 mockup; pick changes; then say "approved" to start implementation.
- Provide: newest experience entries, internship dates, graduation date, work authorization, LinkedIn URL,
  real game baselines.
- Decide: Lab light/dark semantics; Riso record disc colour; whether to keep eyebrow-free labels inside
  systems that styled them as signature.
