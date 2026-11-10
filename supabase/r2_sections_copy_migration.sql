-- Owner review round 2 (S10: Questions, Contact, About, copy): no fixed claims about the owner ("close to the hardware",
-- the EEG phase), the Contact copy no longer says messages go "straight to my inbox", and the hero line is the
-- one the owner asked for. Every update is guarded on the stale text, so anything the owner has since edited
-- in place is left alone. Idempotent. Run: supabase db query --linked -f supabase/r2_sections_copy_migration.sql
update site_content set value = '[["What kind of role fits best?", "Software engineering or AI/ML internships."], ["Are you open to relocating?", "Yes. I''m happy to relocate for the right role."], ["Can I see code?", "Yes. Most projects link to their repositories, the rest are on GitHub at github.com/rithvikpkx, and this site''s code is public too."], ["Where are you based?", "West Lafayette, Indiana during the school year. I''m in San Francisco right now."], ["What''s the best way to reach you?", "Email. The Contact section opens a message window."], ["Can I ask this site questions?", "Yes. Press ⌘K or / to open the agent. It answers from what''s on this site and says so when it doesn''t know."], ["What''s playing on the record player?", "Chili Pepper by Fred Longshaw, recorded in 1927. It''s in the public domain."]]'
  where key = 'v7.faq' and (value like '%close to hardware%' or value like '%straight to my inbox%');
update site_content set value = '[["500+", "learners on the RAG platform"], ["40", "students taught to code"], ["6", "projects shipped"]]'
  where key = 'v7.numbers' and value like '%EEG channels%';
update site_content set value = '["I study computer science and math at Purdue.", "Right now I research TinyML at Purdue''s Snowball Lab. Before that I built a RAG learning platform for a non-profit serving 500+ learners, and spent two years teaching kids to code through game development."]'
  where key = 'v7.about' and value like '%close to hardware%';
update site_content set value = '["Software", "AI", "Research"]'
  where key = 'v7.thesis' and value like '%Brain signals%';
update site_content set value = 'CS + Math @ Purdue'
  where key = 'v7.status' and value = 'CS + Math at Purdue · open to SWE and AI internships';
update site_content set value = 'Building intelligent software for an intelligent world.'
  where key = 'v7.line' and value like 'I build brain-computer interfaces%';
update site_content set value = regexp_replace(value, ',\s*"(OpenBCI|NeuroSky|EEG)"', '', 'g')
  where key = 'v7.stack' and value ~ '"(OpenBCI|NeuroSky|EEG)"';
