-- Add (or replace) the Rithvik Terminal theme.
-- Uses UPSERT so it works regardless of whether the row already exists.

INSERT INTO themes (slug, name, tokens, sort_order, published)
VALUES (
  'rithvik-terminal',
  'Rithvik Terminal',
  $${
    "bg":           "#001a00",
    "bg-soft":      "#002a00",
    "text":         "#00ff41",
    "muted":        "#008f24",
    "accent":       "#39ff14",
    "accent-glow":  "rgba(57,255,20,0.28)",
    "green":        "#39ff14",
    "font":         "var(--mono)"
  }$$::jsonb,
  2,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name       = EXCLUDED.name,
  tokens     = EXCLUDED.tokens,
  sort_order = EXCLUDED.sort_order,
  published  = EXCLUDED.published;
