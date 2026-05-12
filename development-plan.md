# Development Plan — Rithvik.ai

This document is the authoritative implementation roadmap for rithvik.ai. Each stage is a self-contained vertical slice with clear scope, technical steps, and a validation checklist. Work through stages in order. Complete all validation items before committing and moving to the next stage.

---

## Context

**Repo:** `rithvikpkx/Rithvik` (Next.js 16, TypeScript, Tailwind CSS 4, App Router)  
**Deployed at:** rithvik.ai via Vercel — every push to `main` triggers a production deploy  
**Current state (v0.2):** Full Next.js migration complete. All sections rendered as components. Static data, no database, no animations beyond CSS, no AI.

**Component map:**
```
app/
  layout.tsx        — root layout, Geist font, metadata
  page.tsx          — assembles all section components
  globals.css       — all design tokens and custom CSS
components/
  Nav.tsx           — client, hide-on-scroll
  Hero.tsx          — server
  Bento.tsx         — server (contains LocalTime client child)
  LocalTime.tsx     — client, live clock
  Education.tsx     — server
  EduLogo.tsx       — client, image with fallback
  Projects.tsx      — server, hardcoded data
  Experience.tsx    — server, hardcoded data
  Contact.tsx       — server
  Footer.tsx        — server
  RagBot.tsx        — client, static UI preview
  SectionReveal.tsx — client, IntersectionObserver for .blur-fade
```

**Final goal:** Dark, premium, "living dashboard" personal site with:
- Framer Motion animations throughout
- Supabase-backed dynamic content
- Admin UI ("I am Rithvik") for live content editing
- RAG chatbot ("RAG — Rithvik Augmented Generation") powered by Claude API

---

## Stage 1 — Framer Motion: Scroll Reveal

**Goal:** Replace the CSS + IntersectionObserver blur-fade system with Framer Motion's `whileInView` for cleaner, more controllable scroll reveals.

**Install:**
```bash
npm install motion
```

**Steps:**

1. Create `components/FadeIn.tsx` — a reusable wrapper component:
   - Props: `children`, `delay?: number`, `className?: string`
   - Use `motion.div` from `motion/react` with `initial={{ opacity: 0, filter: "blur(10px)", y: 18 }}`, `whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}`, `viewport={{ once: true, amount: 0.1 }}`, and `transition={{ duration: 0.65, ease: "easeOut", delay }}`

2. Replace every element with `className="blur-fade"` and inline `--delay` style across all components with `<FadeIn delay={n}>...</FadeIn>`. Affected components: `Hero.tsx`, `Bento.tsx`, `Education.tsx`, `Projects.tsx`, `Experience.tsx`, `Contact.tsx`.

3. Delete `components/SectionReveal.tsx` and remove its import from `page.tsx`.

4. Remove the `.blur-fade` and `.blur-fade.visible` CSS rules from `globals.css` (they are no longer needed).

**Validation:**
- [ ] Run `npm run build` — zero errors
- [ ] `npm run dev` — open localhost:3000, scroll through entire page, all sections fade in smoothly
- [ ] Elements do not flash or appear before their reveal
- [ ] No console errors
- [ ] Delete `SectionReveal.tsx` confirmed removed from disk

**Commit:** `feat: replace CSS scroll reveal with Framer Motion FadeIn`

---

## Stage 2 — Framer Motion: Nav + Hero Animations

**Goal:** Add polished entry and interaction animations to the Nav and Hero using Framer Motion.

**Steps:**

1. **Nav (`Nav.tsx`):**
   - Wrap the `<header>` with `motion.header`
   - Animate hide/show: replace the CSS `.hidden` class toggle with `motion.header` `animate={{ y: hidden ? "-100%" : "0%" }}` and `transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}`
   - Remove the `.nav-wrapper.hidden` CSS rule from `globals.css`

2. **Hero (`Hero.tsx`):**
   - Wrap `hero-content` children in a `motion.div` container with `variants` for staggered children using `staggerChildren: 0.12`
   - Each child (h1, hero-sub div, hero-actions div) gets `variants` for `hidden` and `visible` states (same blur+fade as FadeIn)
   - Animate on mount (not scroll) since hero is always visible: use `initial="hidden"` and `animate="visible"`

3. **Shimmer button:**
   - Add `whileHover={{ y: -2 }}` and `whileTap={{ scale: 0.97 }}` to `.btn-shimmer` and `.btn-outline` links (wrap in `motion.a`)

**Validation:**
- [ ] `npm run build` — zero errors
- [ ] Nav slides up/down smoothly on scroll without flash
- [ ] Hero content staggers in on page load (name first, then tagline, then buttons)
- [ ] Buttons respond to hover and tap with subtle motion
- [ ] No layout shift on load

**Commit:** `feat: Framer Motion nav hide/show and hero stagger animation`

---

## Stage 3 — Framer Motion: Bento Grid + Cards

**Goal:** Animate the bento grid cards with a staggered entrance and subtle hover lift using Framer Motion.

**Steps:**

1. Convert `Bento.tsx` to a client component (`"use client"`) — required for motion variants.

2. Wrap the `.bento-grid` div in a `motion.div` with `variants` that set `staggerChildren: 0.08` and `delayChildren: 0.1`.

3. Wrap each `.bento-card` div in a `motion.div` with `variants` for `hidden` (opacity 0, y 20, blur 8px) and `visible` (opacity 1, y 0, blur 0), plus `whileHover={{ y: -3, transition: { duration: 0.2 } }}`.

4. Remove `transform` and `transition` hover rules from `.bento-card` in `globals.css` since Framer Motion owns those now. Keep border-color and background transitions (CSS handles color, Framer handles position).

**Validation:**
- [ ] `npm run build` — zero errors
- [ ] Bento cards stagger in as the section scrolls into view
- [ ] Card hover lift is smooth, no jank
- [ ] Marquee animation (CSS) still works and pauses on hover
- [ ] Live time in Location card still updates every second

**Commit:** `feat: Framer Motion staggered bento grid entrance`

---

## Stage 4 — Framer Motion: RAG Panel + Timeline

**Goal:** Polish the RAG chatbot open/close animation and the timeline tracing beam using Framer Motion.

**Steps:**

1. **RAG Panel (`RagBot.tsx`):**
   - Replace the CSS `.rag-panel.open` toggle with `AnimatePresence` + `motion.div`
   - Panel enters with `initial={{ opacity: 0, scale: 0.94, y: 10 }}` and exits with the same values
   - Use `transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}`
   - Remove `.rag-panel`, `.rag-panel.open` transition CSS from `globals.css`

2. **Timeline beam (`Experience.tsx`):**
   - Convert the `.timeline-beam::after` CSS animation to a `motion.div` positioned absolutely inside `.timeline-beam`
   - Use `animate={{ top: ["−50%", "120%"] }}` with `transition={{ duration: 3.2, ease: "easeInOut", repeat: Infinity }}`
   - Convert `Experience.tsx` to a client component to support this
   - Remove the `@keyframes beam` rule from `globals.css`

**Validation:**
- [ ] `npm run build` — zero errors
- [ ] RAG panel opens and closes with a smooth scale+fade animation
- [ ] Timeline beam animates continuously
- [ ] No orphan CSS keyframes for removed animations

**Commit:** `feat: Framer Motion RAG panel and timeline beam animations`

---

## Stage 5 — Supabase: Project Setup + Schema

**Goal:** Connect the app to Supabase and define the data schema for dynamic content.

**Install:**
```bash
npm install @supabase/supabase-js
```

**Steps:**

1. Create a Supabase project at supabase.com. Note the project URL and anon key.

2. Add environment variables to Vercel (Settings → Environment Variables):
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   ```
   Also create a local `.env.local` file with the same keys (already gitignored).

3. Create `lib/supabase.ts`:
   - Export a browser client using `createBrowserClient` from `@supabase/supabase-js`
   - Export a server client using `createClient` with the service role key for server components

4. In the Supabase SQL editor, run the schema:
   ```sql
   create table projects (
     id uuid primary key default gen_random_uuid(),
     title text not null,
     badge text not null,
     description text not null,
     tags text[] not null default '{}',
     sort_order int not null default 0,
     created_at timestamptz default now()
   );

   create table experience (
     id uuid primary key default gen_random_uuid(),
     org text not null,
     date_range text not null,
     role text not null,
     description text not null,
     tags text[] not null default '{}',
     sort_order int not null default 0
   );
   ```

5. Enable Row Level Security (RLS) on both tables. Add a policy allowing public read access:
   ```sql
   alter table projects enable row level security;
   alter table experience enable row level security;
   create policy "public read" on projects for select using (true);
   create policy "public read" on experience for select using (true);
   ```

6. Create `lib/types.ts` with TypeScript interfaces matching the schema.

**Validation:**
- [ ] `npm run build` — zero errors
- [ ] `.env.local` exists and is gitignored
- [ ] Tables visible in Supabase dashboard
- [ ] Can query tables from Supabase SQL editor and get empty results (not errors)

**Commit:** `feat: Supabase client setup and schema`

---

## Stage 6 — Supabase: Seed + Wire Projects

**Goal:** Seed the projects table and replace hardcoded data in `Projects.tsx` and `Experience.tsx` with Supabase queries.

**Steps:**

1. Seed the `projects` table via Supabase SQL editor or dashboard with the 4 existing projects (Rithvik.ai Portfolio, WatchDawg, BoilerFrame, Pratigya). Include all fields.

2. Seed the `experience` table with the 2 existing entries.

3. Update `Projects.tsx`:
   - Make it an async server component
   - Import the server Supabase client from `lib/supabase.ts`
   - Replace the hardcoded `projects` array with `const { data: projects } = await supabase.from("projects").select("*").order("sort_order")`
   - Handle the case where `projects` is null (render nothing or an empty state)

4. Update `Experience.tsx`:
   - Same pattern — async server component, query `experience` table

5. Remove the hardcoded data arrays from both components.

**Validation:**
- [ ] `npm run build` — zero errors
- [ ] `npm run dev` — projects and experience sections render with data from Supabase
- [ ] Add a test row directly in Supabase dashboard, refresh page — new entry appears
- [ ] Delete the test row — it disappears on refresh

**Commit:** `feat: wire projects and experience to Supabase`

---

## Stage 7 — Admin Auth: Login Gate

**Goal:** Add a hidden "I am Rithvik" login trigger and Supabase-authenticated admin session.

**Install:**
```bash
npm install @supabase/ssr
```

**Steps:**

1. In Supabase dashboard → Authentication → create a user with Rithvik's email and a strong password. This is the only admin user.

2. Create `app/admin/login/page.tsx`:
   - Simple centered form: email + password inputs + submit button
   - On submit, call `supabase.auth.signInWithPassword()`
   - On success, redirect to `/admin`
   - Style to match the site's dark aesthetic

3. Create `app/admin/page.tsx`:
   - Server component that checks for an active session via Supabase SSR cookies
   - If no session, redirect to `/admin/login`
   - If session, render a simple "Logged in as Rithvik" confirmation page (full admin UI comes in Stage 8)

4. Create `middleware.ts` at the repo root:
   - Use `@supabase/ssr` to refresh session cookies on every request
   - Protect `/admin/*` routes: redirect unauthenticated requests to `/admin/login`

5. Add the hidden trigger to `Footer.tsx`:
   - A small, unobtrusive link/button with text "I am Rithvik" in the footer, styled as muted text
   - Links to `/admin/login`

6. Add a logout route: `app/admin/logout/route.ts` that calls `supabase.auth.signOut()` and redirects to `/`.

**Validation:**
- [ ] `npm run build` — zero errors
- [ ] Visiting `/admin` while logged out redirects to `/admin/login`
- [ ] Login with correct credentials → redirected to `/admin`
- [ ] Login with wrong credentials → error message shown
- [ ] Logout link works, session cleared, `/admin` redirects again
- [ ] "I am Rithvik" link visible in footer (subtle, not prominent)

**Commit:** `feat: admin login gate with Supabase auth`

---

## Stage 8 — Admin UI: Inline Project Editing

**Goal:** Allow the admin to add, edit, and delete projects directly through the UI without touching code or the Supabase dashboard.

**Steps:**

1. Update the Supabase RLS policy on `projects` to allow authenticated users to insert, update, and delete:
   ```sql
   create policy "admin write" on projects
     for all using (auth.role() = 'authenticated');
   ```

2. Create `app/admin/page.tsx` (full version):
   - Fetch all projects server-side
   - Render a list of project cards, each with Edit and Delete buttons
   - Include an "Add Project" button that opens an inline form
   - Style consistently with the site (dark cards, same border/radius tokens)

3. Create `app/admin/actions.ts` (Next.js Server Actions):
   - `createProject(formData)` — insert into `projects`, revalidate `/`
   - `updateProject(id, formData)` — update row, revalidate `/`
   - `deleteProject(id)` — delete row, revalidate `/`
   - All actions verify the user is authenticated before writing

4. Use `revalidatePath("/")` in each action so the live site updates immediately after any change.

5. Inline edit form fields: title, badge, description, tags (comma-separated input), sort_order.

**Validation:**
- [ ] `npm run build` — zero errors
- [ ] Add a new project in admin UI → appears on rithvik.ai homepage immediately
- [ ] Edit a project title → change reflected on homepage
- [ ] Delete a project → gone from homepage
- [ ] All write operations fail if not authenticated (test by hitting the server action endpoint directly)
- [ ] Sort order field controls the display order on the homepage

**Commit:** `feat: admin inline project CRUD with server actions`

---

## Stage 9 — RAG: Vector Store Setup

**Goal:** Enable the pgvector extension in Supabase and build a script that embeds all site content (bio, projects, experience, skills) for retrieval.

**Install:**
```bash
npm install ai @ai-sdk/anthropic
```

**Steps:**

1. Enable pgvector in Supabase SQL editor:
   ```sql
   create extension if not exists vector;
   ```

2. Create the embeddings table:
   ```sql
   create table embeddings (
     id uuid primary key default gen_random_uuid(),
     content text not null,
     metadata jsonb,
     embedding vector(1536)
   );

   create index on embeddings using ivfflat (embedding vector_cosine_ops);
   ```

3. Create `scripts/embed.ts`:
   - Defines an array of content chunks: bio paragraphs, each project (title + description), each experience entry, skills list, contact info
   - For each chunk, calls the Anthropic API to generate an embedding (use `claude` embeddings or OpenAI's `text-embedding-3-small` — whichever is available)
   - Upserts each embedding into the `embeddings` table
   - Run with: `npx tsx scripts/embed.ts`

4. Add a `tsconfig.scripts.json` if needed to run the script outside of Next.js context, or use `tsx` directly.

5. Run the embed script. Verify rows appear in the `embeddings` table in Supabase.

**Note:** Re-run `embed.ts` any time site content changes significantly.

**Validation:**
- [ ] pgvector extension enabled (no error in SQL editor)
- [ ] `embeddings` table exists with correct schema
- [ ] Running `npx tsx scripts/embed.ts` completes without errors
- [ ] Supabase dashboard shows N rows in `embeddings` table (one per content chunk)
- [ ] Spot-check: query a row and confirm `content` and `embedding` columns are populated

**Commit:** `feat: pgvector embeddings table and content embed script`

---

## Stage 10 — RAG: Chat API Route

**Goal:** Build the Next.js API route that accepts a user question, retrieves relevant content from the vector store, and streams a response from Claude.

**Steps:**

1. Create `app/api/chat/route.ts`:
   - Accepts `POST` with `{ message: string }` body
   - Generates an embedding for the user's message using the same model as Stage 9
   - Queries Supabase for the top 5 most similar chunks:
     ```sql
     select content, 1 - (embedding <=> $1) as similarity
     from embeddings
     order by embedding <=> $1
     limit 5
     ```
   - Constructs a system prompt: "You are RAG, Rithvik Augmented Generation. Answer questions about Rithvik using only the following context: [chunks]"
   - Streams a response from Claude using the Vercel AI SDK (`streamText` from `ai` + `@ai-sdk/anthropic`)
   - Returns a streaming response

2. Add `ANTHROPIC_API_KEY` to Vercel environment variables and `.env.local`.

3. Keep the route lightweight — no auth required (it's a public chatbot), but add rate limiting consideration as a comment for future work.

**Validation:**
- [ ] `npm run build` — zero errors
- [ ] `curl -X POST localhost:3000/api/chat -H "Content-Type: application/json" -d '{"message":"What projects has Rithvik built?"}' ` — returns a streamed response about WatchDawg, BoilerFrame, etc.
- [ ] Question about something not in the content → Claude responds appropriately ("I don't have information about that")
- [ ] Response is grounded in actual site content, not hallucinated

**Commit:** `feat: RAG chat API route with Claude streaming`

---

## Stage 11 — RAG: Live Chat UI

**Goal:** Connect the existing `RagBot.tsx` UI to the chat API, with streaming message display and loading states.

**Steps:**

1. Update `RagBot.tsx`:
   - Add `messages` state: `{ role: "user" | "bot", content: string }[]`, initialized with the two hardcoded preview messages replaced by a single welcome message
   - Add `input` state for the text field (remove `disabled`)
   - Add `loading` state for the send button
   - On submit: append user message to state, POST to `/api/chat`, read the streamed response, append bot message token by token as it streams

2. Use the Vercel AI SDK's `useChat` hook if it simplifies the implementation — it handles streaming, message state, and input management automatically. If using `useChat`, adapt `RagBot.tsx` to its API.

3. Remove the `disabled` attributes from the input and send button. Add `disabled={loading}` during active requests.

4. Auto-scroll the `.rag-messages` container to the bottom as new tokens arrive.

5. Add a typing indicator (three animated dots) while waiting for the first token.

**Validation:**
- [ ] `npm run build` — zero errors
- [ ] Open RAG panel → welcome message appears
- [ ] Type "What is Rithvik studying?" → user message appears, bot streams a response
- [ ] Bot response is accurate and grounded in content
- [ ] Typing indicator shows while waiting
- [ ] Messages scroll into view automatically
- [ ] Input clears after send
- [ ] Send button disabled during loading

**Commit:** `feat: live RAG chatbot with streaming Claude responses`

---

## Stage 12 — Polish: SEO + OG Image + Performance

**Goal:** Make the site production-ready with proper metadata, Open Graph image, and a clean Lighthouse score.

**Steps:**

1. **Metadata (`app/layout.tsx`):**
   - Add full metadata object: `title`, `description`, `openGraph` (title, description, url, siteName, type), `twitter` (card, title, description), `robots`, `canonical`

2. **OG Image (`app/opengraph-image.tsx`):**
   - Use Next.js's built-in OG image generation (`ImageResponse` from `next/og`)
   - Design: dark background, "Rithvik Praveen Kumar" in large white text, subtitle in muted, accent color bar at bottom
   - Size: 1200×630

3. **Favicon:**
   - Replace the default Next.js favicon with a custom one — a simple "R." in the accent color on dark background
   - Add as `app/favicon.ico` and `app/icon.tsx` (dynamic favicon via ImageResponse)

4. **Performance:**
   - Audit all images: confirm Purdue seal uses Next.js `<Image>` or has explicit width/height
   - Add `loading="lazy"` where appropriate
   - Confirm no render-blocking resources

5. **Accessibility quick pass:**
   - All interactive elements have `aria-label`
   - Color contrast passes WCAG AA for body text
   - Focus rings visible on keyboard navigation

**Validation:**
- [ ] `npm run build` — zero errors, no warnings
- [ ] Share rithvik.ai URL on Twitter/Slack → OG image preview appears correctly
- [ ] Lighthouse score: Performance ≥ 90, Accessibility ≥ 90, SEO = 100
- [ ] Tab through the entire page with keyboard — focus order is logical
- [ ] `curl -I https://rithvik.ai` — returns 200, correct content-type

**Commit:** `feat: SEO metadata, OG image, favicon, and accessibility pass`

---

## Stage 13 — Admin UI: Experience Editing (optional extension of Stage 8)

**Goal:** Extend the admin UI to also manage experience entries, following the same pattern as Stage 8.

**Steps:**

1. Add write RLS policy on `experience` table (same as projects in Stage 8).

2. Add server actions: `createExperience`, `updateExperience`, `deleteExperience` in `app/admin/actions.ts`.

3. Add an Experience section to `app/admin/page.tsx` with the same add/edit/delete UI pattern.

**Validation:**
- [ ] Same checklist as Stage 8, applied to experience entries
- [ ] Changes revalidate and appear on homepage immediately

**Commit:** `feat: admin inline experience CRUD`

---

## Running Checklist (apply after every stage)

Before committing any stage:
- [ ] `npm run build` passes with zero errors and zero TypeScript errors
- [ ] `npm run lint` passes
- [ ] Manually scroll through the full page on localhost:3000
- [ ] Check mobile layout at 375px width (Chrome DevTools)
- [ ] No console errors or warnings in the browser
- [ ] Push to `main` and confirm Vercel deploy succeeds at rithvik.ai

---

## Environment Variables Reference

| Variable | Where used | Required in Vercel |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase client | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase browser client | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server client | Yes |
| `ANTHROPIC_API_KEY` | Claude API (chat route) | Yes |

All must also exist in `.env.local` for local development. `.env.local` is gitignored.

---

## Stage Completion Summary

| Stage | Feature | Status |
|---|---|---|
| — | Static HTML/CSS foundation | ✅ complete (v0.1) |
| — | Next.js migration + Vercel deploy | ✅ complete (v0.2) |
| 1 | Framer Motion scroll reveal | ⬜ |
| 2 | Framer Motion nav + hero | ⬜ |
| 3 | Framer Motion bento grid | ⬜ |
| 4 | Framer Motion RAG panel + timeline | ⬜ |
| 5 | Supabase setup + schema | ⬜ |
| 6 | Seed + wire dynamic content | ⬜ |
| 7 | Admin auth + login gate | ⬜ |
| 8 | Admin inline project CRUD | ⬜ |
| 9 | Vector store + embed script | ⬜ |
| 10 | RAG chat API route | ⬜ |
| 11 | Live chat UI | ⬜ |
| 12 | SEO + OG image + performance | ⬜ |
| 13 | Admin experience CRUD (optional) | ⬜ |
