# Design Plan — Rithvik.ai

## Philosophy

Dark-first, premium, and alive. The site should feel like a living dashboard, not a static resume. Every interaction should feel intentional and polished. Minimal clutter, maximum personality.

---

## Tech Stack

- **Next.js** — framework
- **Tailwind CSS** — utility-first styling
- **Framer Motion** — animations and transitions
- **Supabase** — database and auth (for admin UI and RAG)
- **Vercel** — deployment
- **Geist Sans + Geist Mono** — typography (clean, modern, technical)

---

## Layout Structure

### Hero

Full-viewport intro section. Contains name, tagline, and primary CTAs. Background has a design element (e.g. dot grid).

### Bento Dashboard Grid

The centerpiece of the page. A CSS Grid of cards rather than a standard linear sections layout. Cards include live/dynamic content — this is what makes the site feel like a product. Grid collapses gracefully on mobile.

### Projects

Two-column card grid with video or image previews, tags, and short descriptions.

### Experience / Timeline

Vertical timeline with an animated tracing beam connecting entries.

### Contact

Minimal. Black and white icon links for GitHub, LinkedIn, and Email that grow and fill with logo color on hover.

---

## Components & Design Elements

### Navigation

- Sticky, hides on scroll down, reappears on scroll up
- Backdrop blur with semi-transparent background (glassmorphism)
- Dark/light mode toggle

### Bento Cards (examples)

- **Location** — city + timezone + local time
- **Tools Marquee** — infinite scrolling strip of tech stack icons, pauses on hover, fade masks on edges

### Animations

- **BlurFade** — elements fade in with blur on scroll, staggered by section
- **Staggered card reveal** — each bento card has its own transition delay (100–900ms), grid unfolds sequentially
- **Tracing beam** — animated vertical line connecting timeline entries

### Typography

- Geist Sans for all UI text
- Geist Mono for code snippets, stat labels, terminal-style elements
- Tight letter-spacing and line-height for a premium, editorial feel
- Gradient text clip on hero heading

### Color Palette (Dark Mode Primary)

- Background: near-black with a subtle purple undertone
- Foreground: off-white
- Accent: red-purplish color
- Borders: low-opacity white for card edges

### Cards

- Background: semi-transparent dark with slight blur
- Rounded corners (~10px)
- Smooth shadow transitions on hover

---

## RAG Chatbot — "RAG (Rithvik Augmented Generation)"

- Floating chat button, expands to modal or side panel
- Aware of all site content, resume, and projects
- Feels like talking to Rithvik, not a generic assistant
- Subtle typing animation, clean message bubbles

---

## Admin UI — "I am Rithvik"

- Hidden login button or easter egg trigger
- Auth via Supabase
- Inline editing of bento card content, projects, and bio — changes reflected live in production
