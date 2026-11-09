-- v7 content model: ADDITIVE + idempotent. Nothing dropped or renamed; the current site keeps reading the same columns.
-- Reused as-is (same fact): projects.description (bullets) / tags / links / featured, experience.description / tags / location / org / role,
-- education.school / degree / logo_path. New columns only hold v7-specific copy that has no existing home.
-- Run: supabase db query --linked -f supabase/v7_content_migration.sql

alter table projects   add column if not exists headline text, add column if not exists kind text, add column if not exists icon text,
                       add column if not exists ctx text, add column if not exists v7_order int;
alter table experience add column if not exists period text;  -- short "2026 – now"; date_range keeps the long form for the old site
alter table education  add column if not exists focus text, add column if not exists grad text;

update projects set headline='A robotic arm driven by thought alone', kind='BCI / Hardware', icon='cpu', ctx='NeuroSky EEG headset and an Arduino', v7_order=0 where slug='mind-controlled-arm';
update projects set headline='Finds every frame a person appears in a video', kind='Computer vision', icon='crosshair', ctx='Full-stack MERN app on AWS Rekognition', v7_order=1 where slug='boilerframe';
update projects set headline='Classifies left, right and neutral thoughts from EEG', kind='BCI', icon='activity', ctx='16-channel OpenBCI headset', v7_order=2 where slug='eeg-thought-prediction';
update projects set headline='Modeled how public spending tracks happiness', kind='ML research', icon='trending-up', ctx='Columbia University SHAPE, team of four', v7_order=3 where slug='citizen-happiness';
update projects set headline='Turns any text into a downloadable QR code', kind='Web app', icon='grip', ctx='Python and Segno on AWS EC2', v7_order=4 where slug='qrify';
update projects set headline='One-click listings to Marketplace and eBay', kind='Volunteer', icon='users', ctx='Google Apps Script tool for a non-profit', v7_order=5 where slug='habitat-humanity-ecomm';

update experience set period='2026 – now' where slug='tinyml-research';
update experience set period='2025 – 2026' where slug='hack-the-future';
update experience set period='2025' where slug='code-ninjas-ir';
update experience set period='2023 – 2025' where slug='code-ninjas-sensei';

update education set focus='Software Engineering · AI/ML', grad='Expected {{graduation}}' where school='Purdue University';

-- ON CONFLICT DO UPDATE: re-running resets to the mockup copy. Strings raw, structures as JSON text.
insert into site_content (key, value) values
  ('v7.role', 'Software and AI engineer'),
  ('v7.status', 'CS + Math at Purdue · open to SWE and AI internships'),
  ('v7.line', 'I build brain-computer interfaces, computer vision, and ML small enough for a microcontroller.'),
  ('v7.thesis', '["Brain signals","Faces in video","Models on microcontrollers"]'),
  ('v7.about', '["I study computer science and math at Purdue. I like work that sits close to hardware: reading brain signals, finding people in video, and fitting models onto microcontrollers.","Right now I research TinyML at Purdue''s Snowball Lab. Before that I built a RAG learning platform for a non-profit serving 500+ learners, and spent two years teaching kids to code through game development."]'),
  ('v7.now', '{"city":"San Francisco","tz":"America/Los_Angeles","building":"rithvik.ai","researching":"TinyML on Edge Impulse","learning":"Energy-harvesting sensors"}'),
  ('v7.places', '[{"key":"home","city":"Boston","tz":"America/New_York","lat":42.36,"lng":-71.06},{"key":"school","city":"West Lafayette","tz":"America/Indiana/Indianapolis","lat":40.43,"lng":-86.91},{"key":"now","city":"San Francisco","tz":"America/Los_Angeles","lat":37.77,"lng":-122.42}]'),
  ('v7.stack', '{"Languages":["Python","JavaScript","TypeScript","C++","C#","SQL"],"Frameworks":["React","Next.js","Node.js","Express","TensorFlow","Keras","scikit-learn","Pandas"],"Infra and data":["AWS","MongoDB","Supabase","Vercel","Cloudflare","Google Apps Script"],"AI and hardware":["RAG","Ollama","Edge Impulse","TinyML","OpenBCI","NeuroSky","Arduino","EEG"]}'),
  ('v7.faq', '[["When can you start?","I''m open to SWE and AI internships for {{season and dates}}."],["Where are you based?","West Lafayette, Indiana during the school year. I''m in San Francisco right now."],["What kind of role fits best?","Software engineering or ML work, especially close to hardware: brain-computer interfaces, computer vision and TinyML."],["Can I see code?","Most projects link to their repositories; the rest are on GitHub at github.com/rithvikpkx."],["Work authorization?","{{owner to confirm}}"]]'),
  ('v7.numbers', '[["500+","learners on the RAG platform I built"],["40","kids taught to code through games"],["16","EEG channels decoded into left, right and neutral"],["6","projects, from headsets to the cloud"]]')
on conflict (key) do update set value = excluded.value;
