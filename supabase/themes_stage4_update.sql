-- feat-theme stage 4: add fg-rgb and nav-glass tokens to existing theme rows.
-- Run this once in the Supabase SQL editor (the rows from stage 1 are missing these).

UPDATE themes
SET tokens = tokens || jsonb_build_object(
  'fg-rgb',    '255,255,255',
  'nav-glass', 'rgba(11,11,20,0.68)'
)
WHERE slug = 'rithvik-dark';

UPDATE themes
SET tokens = tokens || jsonb_build_object(
  'fg-rgb',    '14,11,10',
  'nav-glass', 'rgba(252,250,245,0.72)'
)
WHERE slug = 'rithvik-light';
