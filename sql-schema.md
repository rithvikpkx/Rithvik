# Supabase Schema

Paste the SQL block below into the Supabase SQL editor and run it.

```sql
-- Clear everything
drop table if exists site_content cascade;
drop table if exists experience cascade;
drop table if exists projects cascade;
drop function if exists set_updated_at cascade;

-- Auto-update updated_at on any row change
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Projects
create table projects (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        unique not null,
  title       text        not null,
  badge       text        not null,
  description text        not null,
  tags        text[]      not null default '{}',
  links       jsonb       not null default '{}',
  image_url   text,
  featured    boolean     not null default false,
  published   boolean     not null default true,
  sort_order  int         not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger projects_updated_at
  before update on projects
  for each row execute function set_updated_at();

-- Experience
create table experience (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        unique not null,
  org         text        not null,
  org_url     text,
  role        text        not null,
  type        text        not null default 'work',
  date_range  text        not null,
  start_date  date,
  end_date    date,
  description text        not null,
  tags        text[]      not null default '{}',
  location    text,
  featured    boolean     not null default false,
  published   boolean     not null default true,
  sort_order  int         not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger experience_updated_at
  before update on experience
  for each row execute function set_updated_at();

-- Freeform site content (edit any text on the site via admin UI)
create table site_content (
  key        text        primary key,
  value      text        not null,
  updated_at timestamptz not null default now()
);

create trigger site_content_updated_at
  before update on site_content
  for each row execute function set_updated_at();

-- RLS
alter table projects     enable row level security;
alter table experience   enable row level security;
alter table site_content enable row level security;

create policy "public read" on projects     for select using (published = true);
create policy "public read" on experience   for select using (published = true);
create policy "public read" on site_content for select using (true);
```

---

## Admin Write Policies

Run this after creating your Supabase auth user. Allows authenticated users (i.e. you) to insert, update, and delete.

```sql
create policy "admin write" on projects
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "admin write" on experience
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "admin write" on site_content
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
```

---

## Seed Data

Paste this separately after the schema runs.

```sql
insert into projects (slug, title, badge, description, tags, links, sort_order) values
  (
    'rithvik-ai',
    'Rithvik.ai Portfolio',
    'In Progress',
    'Personal portfolio website being built from the ground up — starting with static HTML/CSS and evolving into a full-stack AI-powered platform with a RAG chatbot and live admin UI.',
    array['Next.js', 'Supabase', 'RAG', 'Claude API'],
    '{"github": "https://github.com/rithvikpkx/Rithvik"}'::jsonb,
    0
  ),
  (
    'watchdawg',
    'WatchDawg',
    'Browser Monitor',
    'Cloud-running browser monitor that checks dynamic webpages, compares values against a baseline, and sends notifications when changes are detected.',
    array['TypeScript', 'Playwright', 'Automation'],
    '{}'::jsonb,
    1
  ),
  (
    'boilerframe',
    'BoilerFrame',
    'Full Stack',
    'Web app that uses AWS Rekognition to identify where a target person appears in uploaded video content.',
    array['JavaScript', 'AWS', 'Computer Vision'],
    '{}'::jsonb,
    2
  ),
  (
    'pratigya',
    'Pratigya Learning Platform',
    'AI Education',
    'AI-powered learning platform for rural learners, including lessons, quizzes, assignments, and a context-aware chatbot grounded in course content.',
    array['RAG', 'Full Stack', 'Education'],
    '{}'::jsonb,
    3
  );

insert into experience (slug, org, role, type, date_range, start_date, description, tags, location, sort_order) values
  (
    'purdue',
    'Purdue University',
    'B.S. Computer Science + Mathematics',
    'education',
    'Aug 2023 — Present',
    '2023-08-01',
    'Studying CS and Math with a focus on software engineering, AI systems, and applied mathematics. Building end-to-end projects alongside coursework.',
    array['CS', 'Mathematics', 'AI'],
    'West Lafayette, IN',
    0
  ),
  (
    'independent-projects',
    'Independent Projects',
    'Builder',
    'project',
    '2023 — Present',
    '2023-01-01',
    'Shipping full-stack and AI projects across web development, computer vision, browser automation, and education technology.',
    array['Full Stack', 'AI', 'Open Source'],
    null,
    1
  );
```
