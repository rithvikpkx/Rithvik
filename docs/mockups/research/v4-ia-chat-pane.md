# rithvik.ai v4 — IA, TUI agent, "Pane" design system, data changes

## 1. Information architecture

**Measured problem:** the mockup landing is ~9,000px tall at 1440 wide. A recruiter's three questions (what has he built, where has he worked, how do I reach him) resolve at ~2,300px, ~5,000px and ~6,600px. Everything after Contact is the owner's playground in recruiter clothes, and four design-discovery mechanisms (coach mark, hero style chip, "12 ways" strip, switch toast) fight for the first screen.

### Routes

| Route | Job | Recruiter learns |
|---|---|---|
| `/` | Convince in 90 seconds; every section links deeper | Who, what he builds, proof, availability, contact |
| `/work`, `/work/[slug]` | Depth per project: problem → build → stack → outcome → media/links | Can he ship? Six shareable case pages (today's `#project-slug` anchors become real routes the bot can open) |
| `/about` | The person: Now (globe, city, live time), what he is building/reading, teaching, stack, colophon | Location, timezone, curiosity, fit |
| `/play` | Arcade iframes, records deck, design gallery | Nothing required; for engineers who stayed |
| `/resume` | Full-page PDF with Download; replaces the modal so it is linkable from the bot, signatures, LinkedIn | Everything, in their format |
| `/chat` | Full-screen TUI agent (same agent as the dock) | Any question, with sources and actions |
| `/buffett` | Unchanged | Plain-HTML fallback |

Nav (andreas.vision pill): **Work · About · Play** + `Resume` button + `⌘K` chat summon. One-word titles everywhere. Italic optical-size serif only in classic palettes; each system supplies its own display voice.

### Landing order, one job each

1. **Hero** — kinetic name; one status line (`● CS + Math at Purdue · open to SWE and AI internships`); one sentence on what he builds; two CTAs (Resume · Ask); portrait right. *Learns:* who, level, availability.
2. **Work** — three featured projects as large cards (Mind-Controlled Arm with footage, BoilerFrame, EEG Thought Prediction), stack as plain text, one link each, "All six →". *Learns:* ships hardware + ML + full-stack.
3. **Experience** — a ledger, not a timeline: four rows `role · org · when`, each expanding inline to two bullets. *Learns:* research now, RAG platform for 500+ learners, taught 40 kids.
4. **Education** — one row: Purdue · B.S. CS + Math · SE and AI/ML concentrations · expected grad. *Learns:* degree, date.
5. **Now** — compact strip: city, live local time, "this week" from `site_content now.*`. Globe moves to `/about`. *Learns:* where he is; the site is alive.
6. **Contact** — headline, email + copy, GitHub/LinkedIn, `Write to Rithvik` opens the floating composer (no inline form). *Learns:* one-click reach.
7. **Footer** — mark, name, Buffett line; dial at the viewport edge.

Target ≤5 viewports in classic.

### Cut, and why

- **"12 ways" strip, hero style chip, coach mark, toast "Try next"** — four mechanisms for one feature; keep the nav design control + dial + `T`. "This site comes in 12 designs" is auxiliary hero text.
- **Stack Map** — restates tags already on every card; the filter is a toy. Stack becomes a line on `/about`.
- **Ticker band** — one design's decoration occupying flow space in all fourteen.
- **Placeholder timeline card** ("Your newest role goes here") — admin UI leaking to visitors.
- **Education side column + campus photo** — padding; the facts are in Experience.
- **Notes grid** — six cards re-narrating Projects and Experience.
- **Colophon flows, torus, changelog, contribution graph** — self-referential; changelog + architecture move to `/about#colophon`, torus and sample-data contrib grid are dropped.
- **Records deck, arcade, globe** — to `/play` and `/about`.
- **Welcome "I'm here as a Recruiter/Engineer" row** — asks the visitor to work before receiving value.
- **Forced bento** — gone by construction: sections are rows and lists; only Work uses cards.

## 2. Chat as a TUI agent

One agent, two shells: a **dock** (bottom-centre bar; panel grows upward to 60vh) on every page, and **full-screen** at `/chat` (`⌘⏎` from the dock). Summon with `⌘K` or `/` anywhere; `Esc` collapses.

**Welcome banner** (first open):
```
╭─────────────────────────────────────────────╮
│ ✻ rithvik.ai agent  v4.0       gpt-4o-mini  │
│   grounded in 23 records + resume · /help   │
╰─────────────────────────────────────────────╯
Tips: "what has he built?" · /resume · /contact
```
plus three starter chips (precomputed, send instantly, as today).

**Prompt line:** `❯ ` prefix, blinking block caret; `↑/↓` history (per browser, 50 entries); `Tab` accepts ghost text; `/` at column 0 opens a fuzzy command palette (`↑↓⏎`); `Shift+⏎` newline; `Ctrl+U` clear line; `Ctrl+L` clear screen; `?` on empty input shows shortcuts.

**Slash commands** (client-side, no LLM, each rendered as a tool call): `/help` · `/resume` · `/projects [slug]` · `/experience` · `/contact [subject]` opens the composer · `/theme <name|random|list>` · `/now` · `/clear` (confirms past 4 turns) · `/export` Markdown transcript · `/history` · `/fullscreen` · `/quit`.

**Turn rendering** (Claude Code grammar):
```
❯ what stack did boilerframe use?

⏺ Searching site (query: "BoilerFrame stack")
  ⎿  3 chunks · projects/boilerframe 0.81 · experience/hack-the-future 0.44

⏺ BoilerFrame is a MERN app: React front end, Express/Node server,
  MongoDB, AWS Rekognition for the face pipeline. [1]

⏺ Open project "BoilerFrame"? (/work/boilerframe)
  ⎿  [⏎ Yes]  [n No]  [a Always this session]
```
- `⏺` is the message bullet (hollow `◯` while streaming); `⎿` lines are tool results collapsed to one line, `→` or click expands.
- Streaming appends in place. Retrieval, HyDE, bare-question action gate and suggestion gates stay exactly as in `app/api/chat/route.ts`; the retrieval metadata that already drives actions populates the `⎿` line, so no new model calls.
- **Spinner verbs** rotate every ~1.2s: Retrieving… Reading… Grounding… Drafting… Verifying…; frames `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`; elapsed seconds and `esc to interrupt` trail it.
- **Status line** (always visible at the panel foot): `● ready · 23 records · ctx 4.1k · 2 turns · ? help`; becomes the spinner while busy, `⚠ rate limited · retry in 12m` on 429.
- **Interrupt:** `Esc` aborts the fetch (`AbortController`), keeps partial text, appends `⎿ Interrupted`; second `Esc` collapses.
- **Permission-style confirmations:** anything with a side effect (open composer with prefilled subject, navigate, switch theme, external link) renders `⏺ Do X?` with `⏎ Yes / n No / a Always`. `⏎` default keeps it one key. Same-page scroll+highlight runs without asking. Theme switches add `[u Undo]` after running.
- **Sources** as `[1] projects/boilerframe` footnotes; digit key or click opens.
- **Message actions** (hover, or `.` on the last turn): copy, regenerate, edit-and-resend (`↑` on empty input), rate.
- **History:** 8 sessions in `localStorage`; `/history` opens them as a pane; export via `lib/transcript.ts`.
- **Mobile (≤640px):** full-screen sheet; palette becomes chips; `⏺/⎿` kept, key hints hidden.
- **Admin (edit mode):** `/embed`, `/temp 0.7`, `/docs` replace the SecondaryContextPanel UI.

**Reskin per system** (grammar constant, chrome swaps): Classic — hairline panel, `⏺` in `--accent`, mono only for prompt and status. Pane — native reference rendering. CRT (ex-ASCII) — phosphor glow, `>` prompt, `█` caret, type-in. Liquid Glass — frosted panel, soft dots, status in a pill. Comic Pop — speech-bubble panel, POW-dot bullet, Bangers status. Neo-Brutalist — 3px black frame, hard shadow, uppercase verbs, yellow block caret. Tide Pool — porthole panel, spinner `○◌◍●` bubbles. Claymation — puffy pill, squishing-dot spinner. Desktop 98 — bevelled DOS window, `C:\RITHVIK>` prompt, underscore caret. Neon Arcade — magenta glow frame, Audiowide verbs, scanline sweep while streaming. Pixel Retro — RPG dialogue box, `steps()` text, `▼` continue marker. Paper Sketch — ruled pane, hand-drawn circle bullet, pencil tool lines. Sakura — hairline left margin, `〉` prompt, petal spinner. Blueprint — white on blue, `FIG.` label, dashed tool tree.

## 3. New design system: **Pane**

A modern software TUI (lazygit, btop, Claude Code), not a hardware CRT. **Proposal:** rename the existing "ASCII Terminal" to **CRT** (its signature is phosphor, scanlines, rain, VT323, ASCII-art portrait) and add **Pane** as its software sibling. Both stay; they share only monospace.

| | CRT (existing) | Pane (new) |
|---|---|---|
| Metaphor | 1980s phosphor monitor | tmux session on a 2025 laptop |
| Palette | 2 colours + glow | 8-colour terminal palette, no glow |
| Type | VT323 display, JetBrains Mono | one mono (IBM Plex Mono), two sizes |
| Decor | rain, scanlines, bloom, ASCII portrait | none; the grid is the decoration |
| Chrome | `┤ LABEL ├` on double frames | `╭─ title ─╮` rounded single frames, tabs, status bar |
| Motion | typewriter, blink | cursor moves, panes slide one cell, no fades |

**Palette (dark default):** bg `#11111b`, surface `#181825`, fg `#cdd6f4`, dim `#6c7086`, line `#313244`, accent `#89b4fa`, ok `#a6e3a1`, warn `#f9e2af`, err `#f38ba8`, select `#45475a` (Catppuccin-adjacent so it reads as "my terminal"). **Light variant:** Solarized paper `#fdf6e3`, fg `#073642`, accent `#268bd2`.

**Type:** IBM Plex Mono 400/600; 14px/1.5 body, 12px status; display is the same font at 32–48px/600, no uppercase. The hero name is large mono, not ASCII art (that is CRT's).

**Grid:** `--cw: .6em; --ch: 1.5em` character cells; every padding, gap and width is `calc(n * var(--cw))` / `var(--ch)`. Page is a centred 120-column terminal, 80 columns on mobile. No pixel radii.

**Box-drawing chrome:** panes draw borders from `╭ ─ ╮ │ ╰ ╯` via `::before`; title sits in the top rule (`╭─ work ─────── 3/6 ─╮`); focused pane rule turns `--accent`. Buttons `[ Resume ]`, toggles `[x]`, links dim→fg underline.

**Sections as panes:** Hero — a tmux window: top bar `[0] rithvik  1:work 2:about 3:play`, bottom status `● open to internships │ West Lafayette 14:02 │ ⌘K ask`. Work — lazygit split: project list left with `›` cursor, details right; `j/k` move, `⏎` opens `/work/slug`. Experience — `git log --oneline` rows: `a3f2c1e  2026  Undergraduate Researcher · Snowball Lab`. Education — one `╭─ education ─╮` pane of `key: value` lines. Now — btop strip: city, live time, `▁▃▅` tick. Contact — mutt-style compose window: `From:` `Subject:` body, `y` sends. Footer — tmux status bar with the dial as `[1][2][3]…`.

**Navigation:** nav links read `1 work 2 about 3 play`, digits are keybindings; `g g` top, `G` bottom, `?` opens a keymap pane. Mouse works identically.

**Motion:** nothing animates by colour or blur. Allowed: cursor blink (`steps`), pane entrance slides exactly one cell row, list cursor moves instantly, per-token stream, spinner frames. `prefers-reduced-motion` stops the blink.

## 4. Backend / data-model changes

- `projects`: add `summary text`, `body_md text` (case page), `year int`, `featured bool`, `sort_order int`, `media_url`, `media_alt`, `links jsonb` ({github, demo}). Bullet `description` stays.
- `experience`: add `sort_order int`, `tags text[]`. `education`: add `expected_grad date`, `concentrations text[]`.
- `site_content`: new keys `hero.status`, `now.city`, `now.timezone`, `now.building`, `now.learning`; `bento.*` retires with the bento (globe markers move to `about.globe_markers`).
- `themes`: add `kind` (`palette|system`) and `system_id` so the dial has one source for palettes and systems; system CSS stays in the repo.
- New `resume_versions (id, created_at, storage_path, source gdoc|upload, is_current)` + private `resume` bucket; `/resume` serves the current row; `syncResume` server action.
- New `game_scores (game_id, baseline numeric, unit, updated_at)` for `/play` baselines, editable in edit mode.
- Optional `chat_sessions (id, created_at, ip_hash, turns)` for the admin visitors view; `chat_requests` stays the rate limiter; history itself stays client-side.
- Embeddings: `syncPrimary` embeds `summary` + `body_md` (chunked via `chunkText`, relaxing the "only secondary chunks" rule for `body_md`); `deriveActions` gains `navigate(route)` next to `scroll`, resolved from published slugs as today.
- RLS unchanged in principle: new content tables public-read on `published`, writes service-role only.
