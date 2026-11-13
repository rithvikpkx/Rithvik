# Owner review round 2 (2026-11-10)

The owner's feedback on the v7 site after review round 1, turned into streams. Reference screenshots live in
`docs/plans/round2-refs/`. Every stream reads **Global rules** plus its own section. Merge to `main` only on
"merge to main".

## Global rules (all streams)

- **Same layout, themed objects.** Layout and structure are standard across all ten looks (Classic + nine designs);
  only the effects and the *non-standard representation* of each item are themed (a liquid-metal pipeline joining
  experiences in Mercury, a cloud for education in Nimbus, and so on). Fresh, unique, visually interesting.
- **Visual over textual.** No section is text-heavy. Bullets only when needed. Cut "AI slop" copy everywhere: themed
  lines that carry the look are fine (Thermal's "warmest lead" style), filler and commentary are not. Minimal copy:
  one-word section titles, no eyebrows, no emoji, no exclamation marks.
- **No repeated buttons.** GitHub / LinkedIn / Email / Resume live in the hero string cluster and the footer cluster,
  nowhere else. The header right holds only "I am Rithvik".
- **Never fixed claims about the owner** ("close to the hardware", "I like EEG"); those were phases.
- **Physical feel.** Springs, strings, detents, inertia: things should feel like objects.
- **Scalable designs.** Adding a design must be: a skin file + CSS + optional shader + per-slot effects, on top of
  the shared layout. No per-design copies of layout markup.
- **Performance.** 60fps target (45 acceptable on heavy looks); one WebGL context (`lib/shader/`); `html.lite` and
  `prefers-reduced-motion` render a designed still.
- **Portrait rule (changed by the owner):** the photo is never filtered *by default*; a per-look photographic effect
  applies only while the visitor has clicked it (toggle back on a second click).
- Owner's working style: `~/.claude/.../memory/owner-working-style.md` (low density, one idea per screen, effects in
  one or two smart places, never busy).

## Shared layout (stream S1, wave 1)

- **Header** (every look): always visible while scrolling (sticky). Left: ouroboros mark + full name. Centre: the nav,
  centred on the page. Right: only "I am Rithvik". Remove the header Resume and Email buttons.
- **Hero**: simple, close to the old site (`round2-refs/old-hero-strings.jpg`; old code `git show main:components/Hero.tsx`,
  `main:components/HeroConnect.tsx`). Name, then "CS + Math @ Purdue" and "Building intelligent software for an
  intelligent world." directly under it, readable immediately. Portrait with **four** nodes (GitHub, LinkedIn, Email,
  Resume) tethered by flowing, slightly rounded lines in the old curve shape. The tethers are physical strings: on
  the opening animation the portrait appears, then the nodes drop into place and bounce on their strings. Remove the
  hero Email me / Resume / Ask buttons and anything else in the hero (e.g. Thermal's palette row stays only if it is
  the look's one themed control; it must not crowd the hero).
- **Footer** (identical structure in every look): the same animated cluster (small portrait + the four tethered
  nodes), then a mini footer: ouroboros mark, full name, "© <current year>", and Privacy · Status · For Warren Buffett
  as extremely small, subtle underlined text links. Remove the big footer (sitemap, city clocks, colophon/commentary
  about icons, shaders, fonts). `round2-refs/old-footer-remove.png` is what goes.
- **Remove** the knowledge-graph section (the owner may bring it back later, more tastefully).
- **Section order** (anchors must still exist: `top, work, experience, about, play, questions, contact` +
  `project-<slug>` / `experience-<slug>`; `npm run check:anchors`): Hero, Work, Experience (+ Education), About (Now),
  Play, Questions, Contact, Footer.
- **Skin contract**: each design supplies its theme via slots with sane defaults (shader, name effect, portrait
  effect, experience connector, education object, project-art palette, section ornaments). Wave-2 streams fill slots.

## Wave 1 streams (parallel)

- **S2 Dashboards** — `/admin`, `/admin/chats`, `/admin/visitors`, `/status`. Currently "AI slop": generic layout,
  generic charts, boring lists. One look (no theme switching), but a creative, deep design that feels part of the main
  site. Research real website + agent observability dashboards for inspiration (feelings and specific elements, never
  a wholesale copy). More interesting visualizations and animation, list views that are visual and work well, not
  overburdened.
- **S3 Logo library** — a high-fidelity, abstract, versatile ouroboros logo. Asset library: mark, mark + wordmark
  (horizontal, stacked), light/dark/mono, animated variants (loader, draw-on, idle), favicon (svg/ico), apple-touch,
  PWA 192/512 + maskable, OG image. Wire into `components/site/mark`, `app/icon.tsx`, `app/apple-icon.tsx`,
  `app/opengraph-image.tsx`. A `/lab/brand` sheet to review them.
- **S4 Theme switcher** — the pill dial locks until the switch animation finishes; replace it with an extremely
  visual, physical control (knob / rotary switch / lever with detents, inertia, sound-free tactile feel). Switching
  must never lock: a new turn interrupts the running transition. Integrate the performance-mode (low power / reduced
  motion) toggle into the same unit as its own physical switch (no more loose button bottom-left). Keep the status
  dot reachable (it may live on the unit). Designs + palettes both stay selectable.
- **S5 Agent TUI** — closer to Claude Code in look and feel (`round2-refs/claude-code-start.png`): a start block with
  the logo (ouroboros, not Claude's mascot), name + version, model + effort, and a tagline like "RAG · Rithvik
  Augmented Generation. Rithvik's own agent." Claude Code-style status line and prompt. Keep the modular design so
  each look adds its own spin. Add animation and physicality so it feels like a real terminal in the page. Expose a
  hand-off API for S10: `askAgent(question, originRect)` that opens the dock with the question and animates from the
  origin rect.

## Wave 2 streams (after S1 merges; parallel)

- **S6 Projects** — remove the six generated project images (not scalable). Procedurally generated art for every
  project in every look, from a lightweight deterministic "reasoning" over the project's fields (kind, stack, dates,
  title, headline...), not only the tech count (Thermal's approach is the starting point). New projects get art
  automatically. Display projects in a non-grid arrangement (an abstract shape / spatial composition), different from
  the Play canvas.
- **S7 Play** — no text-heavy cards (`round2-refs/current-play-cards.png`). An infinite, multi-directional,
  draggable canvas like `round2-refs/andreas-infinite-cards.jpg`, but with non-standard shapes (2D/3D shapes, odd
  card silhouettes). Each item shows a visual immediately (the record player shows a spinning record, etc.).
- **S8 Experience + Education** — standardize the structure across looks; much more visual and physical. Experiences
  joined by a themed connector (liquid-metal pipeline in Mercury...). Education is not a generic banner: a themed
  object per look (cloud in Nimbus, metallic blob in Mercury...).
- **S9 Name + portrait** — bring back the kinetic text on the full name (`git show main:components/KineticText.tsx`)
  with a per-look twist (Thermal heats/cools while warping; Mercury melts/drips metal while morphing...). Clicking the
  portrait applies a per-look photographic effect (thermal camera, liquid-metal face, night vision...), via the one
  shared WebGL context.
- **S10 Questions, Contact, About, copy** —
  - Questions: not an FAQ accordion. Exactly 3 questions in a fresh design, then a 4th item of the same shape that is
    an input. On Enter, the question visibly travels from the card to the agent bar (bottom centre), which opens with
    it and runs normally. The hand-off must be intentional and easy to follow (S5's `askAgent`).
  - Contact: keep the themed flavour (Thermal's "warmest lead"). Every email interaction opens the composer; remove
    direct copy-email everywhere except a Copy button inside the composer. Replace "write and it goes straight to my
    inbox" with something crisp like "Always open to new opportunities. Connect with me to learn more."
  - About → **Now board + stack playground + numbers** (owner's choice): a visual bento of DB-editable tiles
    (Building, Learning, Reading/Listening, Places with live clocks), the stack as physics logo tiles you can toss,
    and a few animated numbers (e.g. projects shipped, commits this year). Low density.
  - Copy pass across all looks: cut slop, keep the good themed lines.

Round 3 status (2026-11-10): all five streams merged on `dev` (tether beams, orb switcher, Purdue P per look,
Play cleanup + turntable, ouroboros working line + frozen stack with Logos/Text). Owner review pending.

## Round 4 (owner, 2026-11-10)
- **Switcher**: the orb ring is rough, doesn't scale with more looks, and perf mode + status look bolted on. He likes
  lab concept C's "one blob consumes another" spirit but not its long, unlabelled drag. Next step is a concepts page
  (wild, physical, abstract pickers + rendered web references); nothing is built until he picks one.
- **Pulse**: no visible pulse travelling. New spec: each node charges a glow, dims, then fires a pulse node →
  portrait through a clear glass cable; staggered and repeating.
- **Agent**: no auto-scroll after answers; Yes/No/Always confirmations become plain clickable action buttons.
- **Artboard**: the real Excalidraw library (lazy-loaded, self-hosted assets) with export options.
- **Contact/footer**: an orbiting cloud of bigger GitHub/LinkedIn/Email/Resume buttons replaces Contact's three
  buttons; the footer drops the portrait cluster and keeps only the slim line.
- **Prism**: portrait centred inside the prism. **Mercury**: no drip on the name; heavier type.
Models: Opus/high for the concepts page + Artboard, Sonnet/high for the rest (owner OK).

## Round 5: new design systems (owner, 2026-11-10)
Guide: `docs/design-systems.md` (quality bar, anatomy, per-slot checklist, rules, inspiration library). New designs
register from `designs/<id>/meta.ts` + one line in `lib/designs/more.ts`.
Design systems (Opus/high, branches `feat/ds-*`): elemental family (fire, water, earth, lightning, nature; inspired by
elemental-ninja energy, no Ninjago IP), Claude + OpenAI (visual language only, no logos, "not affiliated" line),
particle clouds, cyberpunk (Night City / Blade Runner feel, no copied assets), Ferrari Daytona SP3 (three.js allowed
for this look only, licensed model, no Ferrari marks), liquid glass, blueprint. Bitmap skipped (Nimbus + Glyph cover
it; dither/halftone live in Darkroom).
Features (Sonnet/high): Meniscus picker with a visible cap + scrolling overflow (replaces the orbs); drum-machine
player (heartbeatdrummachine-style) replaces the turntable; Darkroom Play toy (alembic-style constellation of
~30 grainrad/mozayk-style effects on the portrait; the per-look portrait click stays); Hello Monday-style cursor warp
on cards.
