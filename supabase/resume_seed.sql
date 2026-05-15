-- Resume sync: align the projects + experience tables with the canonical
-- resume content. Idempotent (deletes target slugs before insert, updates
-- boilerframe in place).

------------------------------------------------------------------
-- PROJECTS
------------------------------------------------------------------

-- Drop the three rows that aren't on the resume. Per-marker rule of the embed
-- chain handles secondary cleanup on the next backfill.
DELETE FROM projects WHERE slug IN ('rithvik-ai', 'pratigya', 'watchdawg');

-- Make sure none of the new slugs already exist before the inserts below.
DELETE FROM projects WHERE slug IN (
  'qrify', 'citizen-happiness', 'eeg-thought-prediction',
  'habitat-humanity-ecomm', 'mind-controlled-arm'
);

-- BoilerFrame already exists; update content in place so existing embeddings
-- and FK relationships (if any) survive.
UPDATE projects SET
  title       = 'BoilerFrame',
  badge       = 'AI / Vision',
  description = 'Full-stack web app that ingests a target person''s reference images and a video, then pinpoints every appearance of that person in the footage. Built on the MERN stack with AWS Rekognition powering the facial-recognition pipeline.',
  tags        = ARRAY['React','Express','MongoDB','AWS Rekognition','MERN'],
  links       = '{"github":"https://github.com/rithvikpkx/BoilerFrame"}'::jsonb,
  featured    = true,
  published   = true,
  sort_order  = 1
WHERE slug = 'boilerframe';

INSERT INTO projects (slug, title, badge, description, tags, links, image_url, featured, published, sort_order) VALUES
  ('qrify',
   'QRIfy',
   'Web App',
   'Web app that turns user text into a downloadable QR code. Built to practice the full deploy loop: a Python + Segno backend, a hand-rolled HTML/CSS/JS frontend, and an AWS EC2 instance hosting it all.',
   ARRAY['Python','Segno','HTML','CSS','JavaScript','AWS EC2'],
   '{"github":"https://github.com/rithvikpkx/QRCode_Project"}'::jsonb,
   NULL, FALSE, TRUE, 2),

  ('citizen-happiness',
   'Predicting Citizen Happiness',
   'ML Research',
   'Trained a Lasso model to correlate national spending in military, education, and health with reported citizen happiness. Built as a 4-person team during Columbia University''s SHAPE program in NYC.',
   ARRAY['Python','Pandas','scikit-learn','Lasso','SHAPE'],
   '{"github":"https://github.com/rithvikpkx/HappinessProjectSHAPE","demo":"https://www.youtube.com/watch?v=eBzE83IjDZM"}'::jsonb,
   NULL, FALSE, TRUE, 3),

  ('eeg-thought-prediction',
   'Left/Right Thought Prediction (EEG)',
   'BCI',
   'Classifies left, right, and neutral thoughts from 16-channel EEG data captured with an OpenBCI headset. Current build pairs a stimulus-display program with TensorFlow models; ongoing work focuses on dataset collection and classification accuracy.',
   ARRAY['Python','OpenBCI','BrainFlow','TensorFlow','Keras','EEG'],
   '{"github":"https://github.com/rithvikpkx/OpenBCI-Project"}'::jsonb,
   NULL, FALSE, TRUE, 4),

  ('habitat-humanity-ecomm',
   'Habitat for Humanity E-Commerce',
   'Volunteer',
   'Built and rolled out an inventory-listing tool for Habitat for Humanity that posts items to Facebook Marketplace and eBay from a single interface. Authored training materials and onboarded staff to the new workflow.',
   ARRAY['Google Apps Script','JavaScript','Automation'],
   '{"github":"https://github.com/rithvikpkx"}'::jsonb,
   NULL, FALSE, TRUE, 5),

  ('mind-controlled-arm',
   'Mind-Controlled Robotic Arm',
   'BCI / Hardware',
   'Proof-of-concept that drives a robotic arm from thought alone using a NeuroSky EEG headset and an Arduino microprocessor. Built as a foundation for future BCI work translating intent into sign-language gestures for differently-abled users.',
   ARRAY['NeuroSky','Arduino','C++','Python','EEG'],
   -- demo-only: the YouTube walkthrough is the primary CTA on this card. The
   -- github repo (MindControlRoboticArm) is intentionally not surfaced here.
   '{"demo":"https://www.youtube.com/watch?v=W8EzUuWgi4o"}'::jsonb,
   NULL, FALSE, TRUE, 6);

------------------------------------------------------------------
-- EXPERIENCE
------------------------------------------------------------------

-- Drop the redundant Purdue education-shaped experience row (the dedicated
-- Education section already covers school + degree).
DELETE FROM experience WHERE slug = 'purdue';

-- Make sure new slugs don't already exist.
DELETE FROM experience WHERE slug IN (
  'tinyml-research', 'hack-the-future', 'code-ninjas-ir', 'code-ninjas-sensei'
);

INSERT INTO experience (slug, org, org_url, role, type, date_range, start_date, end_date, description, tags, location, featured, published, sort_order) VALUES
  ('tinyml-research',
   'Snowball Lab, Purdue University',
   NULL,
   'Undergraduate Researcher, TinyML',
   'research',
   'Spring 2026 – Present',
   '2026-01-01', NULL,
   'Researching TinyML systems for edge inference under Prof. Qiuyue "Shirley" Xue, optimizing and deploying small ML models onto low-power embedded hardware via Edge Impulse. Investigating novel low-power system designs, including piezoelectric microphones that double as both sensing components and energy sources for microprocessors running on-device models. Weighing model accuracy against hardware and energy constraints through implementation, experimentation, and literature review.',
   ARRAY['TinyML','Edge Impulse','Embedded ML','Python','C/C++','Edge Inference'],
   'West Lafayette, IN', TRUE, TRUE, 1),

  ('hack-the-future',
   'Hack The Future @ Purdue',
   NULL,
   'Software Developer',
   'project',
   'Fall 2025 – Spring 2026',
   '2025-08-01', '2026-05-01',
   'Built a full-stack, AI-powered RAG learning platform for a non-profit serving 500+ underserved learners studying personal finance. Wired the LLM workflow + vector retrieval that grounds chatbot answers in lesson content, layered in AI generation of quizzes/assignments, and shipped the core lesson-delivery UI and backend. Translated non-technical product requirements into technical specs and worked alongside designers and stakeholders end-to-end.',
   ARRAY['React','Node.js','Express','MongoDB','Ollama','RAG','Vercel','Cloudflare'],
   'West Lafayette, IN', TRUE, TRUE, 2),

  ('code-ninjas-ir',
   'Code Ninjas',
   NULL,
   'Investor Relations Chair',
   'work',
   'Jan 2025 – Aug 2025',
   '2025-01-01', '2025-08-31',
   'Promoted role layered on top of Code Sensei duties. Analyzed company revenue, costs, and margins to surface historical trends and key financial insights, delivered quarterly reports to colleagues and associates, and democratized investment knowledge across the organization by fielding policy questions and teaching peers how to read company analysis.',
   ARRAY['Financial Analysis','Reporting','Investor Education'],
   'Northborough, MA', FALSE, TRUE, 3),

  ('code-ninjas-sensei',
   'Code Ninjas',
   NULL,
   'Code Sensei',
   'work',
   'May 2023 – Aug 2025',
   '2023-05-01', '2025-08-31',
   'Taught programming via game development to 40 students aged 5–12, covering JavaScript, C#, MakeCode, and 3D modeling/printing. Built personalized skill-development paths with parents, ran demos for prospective families, organized hackathons, and kept the learning environment positive, safe, and a little chaotic in the best way.',
   ARRAY['Teaching','JavaScript','C#','MakeCode','3D Modeling','Mentorship'],
   'Northborough, MA', FALSE, TRUE, 4);
