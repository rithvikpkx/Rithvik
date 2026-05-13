# Design Plan — Rithvik.ai

## Philosophy

Dark-first, premium, and alive. The site should feel like a living dashboard, not a static resume. Every interaction should feel intentional and polished. Minimal clutter, maximum personality.

---

## Tech Stack

- **Next.js 16** — App Router, server components, server actions
- **Tailwind CSS 4** — utility-first styling
- **motion (Framer Motion v12)** — animations and transitions via `motion/react`
- **Supabase** — Postgres database, pgvector, and auth
- **OpenAI** — `text-embedding-3-small` for RAG embeddings
- **DeepSeek** — `deepseek-chat` for RAG response generation via Vercel AI SDK
- **Vercel** — deployment (auto-deploys on push to `main`)
- **Geist Sans + Geist Mono** — typography

---

## Layout Structure

### Hero ✅
Full-viewport intro section. Name, tagline ("CS + Math @ Purdue"), and primary CTAs ("View Projects", "Get in Touch"). Dot grid background. Staggered Framer Motion entrance on load.

### Bento Dashboard Grid ✅
CSS Grid of cards. Staggered entrance animation on scroll. Cards include:
- Location + live local time
- Tech stack marquee (infinite scroll, pauses on hover)
- Status / availability
- GitHub activity

### Education ✅
Purdue University card with local PNG logo (`public/images/purdue.png`), role, and date. FadeIn on scroll.

### Projects ✅
Two-column card grid. Data served from Supabase `projects` table. Tags, badge, description, and links per card.

### Experience / Timeline ✅
Vertical timeline with animated tracing beam (Framer Motion). Data served from Supabase `experience` table.

### Contact ✅
Minimal icon links for GitHub, LinkedIn, and Email.

### Footer ✅
Copyright + stack attribution.

---

## Components & Design Elements

### Navigation ✅
- Sticky, hides on scroll down, reappears on scroll up via Framer Motion `animate={{ y }}`
- Backdrop blur + semi-transparent background (glassmorphism)
- "I am Rithvik" admin button with hover tooltip
- Note: dark/light mode toggle not implemented

### Bento Cards ✅
- **Location** — city + timezone + live local time (updates every second)
- **Tools Marquee** — infinite CSS animation, pauses on hover, fade masks on edges

### Animations ✅
- **FadeIn** (`components/FadeIn.tsx`) — `whileInView` blur+fade reveal, `once: true`, configurable delay
- **Staggered bento reveal** — `staggerChildren: 0.08` via Framer Motion variants
- **Hero stagger** — `staggerChildren: 0.12` on mount
- **Nav hide/show** — `motion.header` with `animate={{ y }}`
- **Tracing beam** — `motion.div` with `animate={{ top: ["-50%", "120%"] }}` looping in `TimelineBeam.tsx`
- **RAG panel** — `AnimatePresence` + `motion.div` scale+fade

### Typography ✅
- Geist Sans for UI text, Geist Mono for code/terminal elements
- Tight letter-spacing for premium feel
- Gradient text clip on hero heading
- CSS `::selection` highlight in yellow

### Color Palette ✅
| Token | Value | Usage |
|---|---|---|
| `--bg` | `#08080e` | Page background |
| `--bg-soft` | `#0d0d16` | Section alternates |
| `--card` | `rgba(255,255,255,0.034)` | Card backgrounds |
| `--text` | `#eeeef6` | Body text |
| `--muted` | `#82829a` | Secondary text |
| `--accent` | `#c2305e` | Highlights, links, logo |
| `--green` | `#4ade80` | Status indicators |
| `--border` | `rgba(255,255,255,0.07)` | Card edges |

### Cards ✅
- Semi-transparent dark background with border
- `border-radius: 16px`
- Subtle hover lift via Framer Motion `whileHover={{ y: -3 }}`

---

## RAG Chatbot — "RAG (Rithvik Augmented Generation)" ✅

- Floating "Ask RAG" button (bottom-right), expands to chat panel
- `AnimatePresence` open/close animation
- Streaming responses token by token (DeepSeek `deepseek-chat`)
- RAG pipeline: OpenAI `text-embedding-3-small` → pgvector cosine similarity → top 5 chunks → DeepSeek
- Chat history: last 6 messages sent as context
- Rate limiting: 20 req/min per IP (proxy.ts)
- Input validation: 500 char max
- Hardened system prompt: recruiter-positive framing, jailbreak refusal, context-only answers
- Typing indicator (three animated dots) while streaming

---

## Admin UI — "I am Rithvik" ✅

- Nav bar button with tooltip ("If you're Rithvik and want to edit this content...")
- Auth via Supabase (email + password, single admin user)
- Session managed via `@supabase/ssr` cookies, guarded by `proxy.ts`
- **Projects CRUD** — add, edit, delete with inline form (all fields)
- **Experience CRUD** — add, edit, delete with inline form (all fields)
- Server actions with `revalidatePath("/")` — changes appear on homepage immediately
- Logout route at `/admin/logout`

---

## SEO & Meta ✅

- Full OpenGraph metadata (type, url, siteName, locale)
- Twitter `summary_large_image` card
- Dynamic OG image at `/opengraph-image` (1200×630, branded, dark theme)
- Dynamic favicon at `/icon` (32×32, "R" in accent color)
- Canonical URL, robots index/follow

---

## Static Assets

| File | Usage |
|---|---|
| `public/images/purdue.png` | Purdue University logo in Education section |

---

## Phase 1 Status

All planned features shipped. Tagged `v1`. Live at [rithvik.ai](https://rithvik.ai).
