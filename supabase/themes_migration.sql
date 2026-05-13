-- feat-theme: themes table + Rithvik Dark / Rithvik Light seed
-- Run once in the Supabase SQL editor.
--
-- Themes only need to define their primary palette. Surface tokens
-- (--card, --border, --nav-glass, --panel-glass) are derived in
-- globals.css via color-mix() so they auto-adapt to any theme.

CREATE TABLE IF NOT EXISTS themes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  tokens      JSONB NOT NULL,
  sort_order  INT DEFAULT 0,
  published   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read themes"
  ON themes FOR SELECT USING (true);

-- ── Seed: Rithvik Dark ───────────────────────────────────────────────────────
INSERT INTO themes (slug, name, tokens, sort_order)
VALUES (
  'rithvik-dark',
  'Rithvik Dark',
  '{
    "bg":           "#08080e",
    "bg-soft":      "#0d0d16",
    "text":         "#eeeef6",
    "muted":        "#82829a",
    "accent":       "#c2305e",
    "accent-glow":  "rgba(194,48,94,0.22)",
    "green":        "#4ade80"
  }'::jsonb,
  0
)
ON CONFLICT (slug) DO NOTHING;

-- ── Seed: Rithvik Light ──────────────────────────────────────────────────────
INSERT INTO themes (slug, name, tokens, sort_order)
VALUES (
  'rithvik-light',
  'Rithvik Light',
  '{
    "bg":           "#fafaf7",
    "bg-soft":      "#f3f1ed",
    "text":         "#0e0b0a",
    "muted":        "#6a655f",
    "accent":       "#c2305e",
    "accent-glow":  "rgba(194,48,94,0.14)",
    "green":        "#16a34a"
  }'::jsonb,
  1
)
ON CONFLICT (slug) DO NOTHING;

-- ── Seed: Rithvik Terminal (matrix-style green-on-black, mono font) ──────────
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
