-- Persist site_content values that the UI was only rendering via hardcoded
-- component fallbacks (Hero.tsx / Contact.tsx). Storing them makes the DB the
-- single source of truth so every consumer (homepage, /buffett, RAG) sees the
-- same values. Idempotent upsert keyed on `key`.
INSERT INTO site_content (key, value) VALUES
  ('hero.name.line2',     'Praveen Kumar'),
  ('contact.link.github', 'https://github.com/rithvikpkx'),
  ('contact.link.email',  'mailto:rithvikpkx@gmail.com')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = now();
