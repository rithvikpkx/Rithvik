-- Rewrites projects.description and experience.description from prose blurbs
-- into newline-separated bullet lines (one bullet per line, no dash prefix —
-- the bullet marker is rendered in CSS). Each line is a full sentence so the
-- text still reads cleanly if rendered as a plain paragraph.
--
-- Idempotent: plain UPDATEs keyed by slug; re-running sets the same values.
-- NOTE: supabase/resume_seed.sql still holds the old prose descriptions — if
-- that seed is re-applied it will overwrite these bullets.
--
-- After applying, re-embed primary content (edit mode -> SecondaryContextPanel
-- -> "Re-embed all primary content") so the RAG store reflects the new text.

-- ===== PROJECTS =====

update projects set description =
'Drives a robotic arm from thought alone — a proof-of-concept brain-computer interface.
Pairs a NeuroSky EEG headset with an Arduino microprocessor.
Built as a foundation for future BCI work translating intent into sign-language gestures for differently-abled users.'
where slug = 'mind-controlled-arm';

update projects set description =
'Full-stack web app that pinpoints every appearance of a target person in a video.
Ingests reference images and footage, then runs a facial-recognition pipeline.
Built on the MERN stack with AWS Rekognition.'
where slug = 'boilerframe';

update projects set description =
'Trained a Lasso model to correlate national spending with reported citizen happiness.
Analyzed spending across military, education, and health.
Built by a 4-person team during Columbia University''s SHAPE program in NYC.'
where slug = 'citizen-happiness';

update projects set description =
'Web app that turns user text into a downloadable QR code.
Python and Segno backend with a hand-rolled HTML/CSS/JS frontend.
Built to practice the full deploy loop, hosted on an AWS EC2 instance.'
where slug = 'qrify';

update projects set description =
'Built and rolled out an inventory-listing tool for Habitat for Humanity.
Posts items to Facebook Marketplace and eBay from a single interface.
Authored training materials and onboarded staff to the new workflow.'
where slug = 'habitat-humanity-ecomm';

update projects set description =
'Classifies left, right, and neutral thoughts from 16-channel EEG data captured with an OpenBCI headset.
Pairs a stimulus-display program with TensorFlow models.
Ongoing work focuses on dataset collection and classification accuracy.'
where slug = 'eeg-thought-prediction';

-- ===== EXPERIENCE =====

update experience set description =
'Researching TinyML systems for edge inference under Prof. Qiuyue "Shirley" Xue.
Optimizing and deploying small ML models onto low-power embedded hardware via Edge Impulse.
Investigating novel low-power designs, including piezoelectric microphones that act as both sensors and energy sources for on-device models.
Weighing model accuracy against hardware and energy constraints through implementation, experimentation, and literature review.'
where slug = 'tinyml-research';

update experience set description =
'Built a full-stack, AI-powered RAG learning platform for a non-profit serving 500+ underserved learners studying personal finance.
Wired the LLM workflow and vector retrieval that grounds chatbot answers in lesson content.
Added AI generation of quizzes and assignments, and shipped the core lesson-delivery UI and backend.
Translated non-technical product requirements into technical specs, working with designers and stakeholders end-to-end.'
where slug = 'hack-the-future';

update experience set description =
'Promoted role layered on top of Code Sensei duties.
Analyzed company revenue, costs, and margins to surface historical trends and key financial insights.
Delivered quarterly reports to colleagues and associates.
Democratized investment knowledge across the organization by fielding policy questions and teaching peers how to read company analysis.'
where slug = 'code-ninjas-ir';

update experience set description =
'Taught programming through game development to 40 students aged 5–12, covering JavaScript, C#, MakeCode, and 3D modeling/printing.
Built personalized skill-development paths with parents and ran demos for prospective families.
Organized hackathons and kept the learning environment positive, safe, and a little chaotic in the best way.'
where slug = 'code-ninjas-sensei';
