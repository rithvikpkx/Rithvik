-- Add the Rithvik Terminal theme (matrix-style green-on-black, mono font).
-- Run this once in the Supabase SQL editor if you've already seeded the
-- other themes and just want this new one.

INSERT INTO themes (slug, name, tokens, sort_order)
VALUES (
  'rithvik-terminal',
  'Rithvik Terminal',
  '{
    "bg":           "#001a00",
    "bg-soft":      "#002a00",
    "text":         "#00ff41",
    "muted":        "#008f24",
    "accent":       "#39ff14",
    "accent-glow":  "rgba(57,255,20,0.28)",
    "green":        "#39ff14",
    "font":         "var(--mono)"
  }'::jsonb,
  2
)
ON CONFLICT (slug) DO NOTHING;
