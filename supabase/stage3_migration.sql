-- Stage 3: education table + site_content seed
-- Run this in the Supabase SQL editor (one-time).

-- ── Education table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS education (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school         TEXT NOT NULL,
  school_url     TEXT,
  degree         TEXT NOT NULL,
  concentrations TEXT[],
  logo_path      TEXT,
  sort_order     INT DEFAULT 0,
  published      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- Public read, service-role write (matches projects/experience pattern)
ALTER TABLE education ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read education"
  ON education FOR SELECT USING (true);

-- Seed: current Purdue entry
INSERT INTO education (school, school_url, degree, concentrations, logo_path, sort_order)
VALUES (
  'Purdue University',
  'https://www.cs.purdue.edu/',
  'B.S. in Computer Science + Mathematics',
  ARRAY['Software Engineering', 'AI / ML'],
  '/images/purdue.png',
  0
)
ON CONFLICT DO NOTHING;

-- ── site_content seed ─────────────────────────────────────────────────────────

INSERT INTO site_content (key, value) VALUES
  ('hero.tagline',    'CS + Math @ Purdue'),
  ('hero.sub_line',   'Building at the intersection of AI, systems, and real-world problems.'),
  ('bento.location',  'West Lafayette, IN'),
  ('bento.building',  '{"title":"Rithvik.ai","description":"A full-stack AI-powered personal platform with a RAG chatbot, live admin UI, and project dashboard. Built with Next.js, Supabase, and Claude.","tags":["Next.js","Supabase","RAG","Claude API"]}'),
  ('bento.stats',     '[{"num":"4+","label":"Projects"},{"num":"2+","label":"Years coding"},{"num":"6+","label":"Languages"}]'),
  ('bento.stack',     '["Python","TypeScript","JavaScript","React","Next.js","Node.js","Supabase","AWS","Playwright","Vercel","Git","SQL","C","Java","NumPy","Pandas","scikit-learn","OpenAI API"]'),
  ('bento.interests', '["Full-Stack Engineering","AI Systems","Applied ML","Computer Systems","Startups","Research","Open Source"]'),
  ('contact.headline','Let''s connect.'),
  ('contact.sub',     'I''m always interested in software engineering, AI, startups, research, and ambitious technical projects.')
ON CONFLICT (key) DO NOTHING;
