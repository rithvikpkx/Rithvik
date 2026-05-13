-- feat-theme stage 1: themes table + Rithvik Dark / Rithvik Light seed
-- Run this in the Supabase SQL editor (one-time).

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

-- Public read, service-role write (matches projects/experience pattern)
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read themes"
  ON themes FOR SELECT USING (true);

-- ── Seed: Rithvik Dark (current production palette) ──────────────────────────
INSERT INTO themes (slug, name, tokens, sort_order)
VALUES (
  'rithvik-dark',
  'Rithvik Dark',
  '{
    "bg":           "#08080e",
    "bg-soft":      "#0d0d16",
    "card":         "rgba(255,255,255,0.034)",
    "card-hover":   "rgba(255,255,255,0.056)",
    "border":       "rgba(255,255,255,0.07)",
    "border-hover": "rgba(255,255,255,0.14)",
    "text":         "#eeeef6",
    "muted":        "#82829a",
    "accent":       "#c2305e",
    "accent-glow":  "rgba(194,48,94,0.22)",
    "green":        "#4ade80"
  }'::jsonb,
  0
)
ON CONFLICT (slug) DO NOTHING;

-- ── Seed: Rithvik Light (proposal values; refined during stage 4) ────────────
INSERT INTO themes (slug, name, tokens, sort_order)
VALUES (
  'rithvik-light',
  'Rithvik Light',
  '{
    "bg":           "#fafaf7",
    "bg-soft":      "#f3f1ed",
    "card":         "#ffffff",
    "card-hover":   "#f7f4ee",
    "border":       "rgba(14,11,10,0.08)",
    "border-hover": "rgba(14,11,10,0.16)",
    "text":         "#0e0b0a",
    "muted":        "#6a655f",
    "accent":       "#c2305e",
    "accent-glow":  "rgba(194,48,94,0.12)",
    "green":        "#16a34a"
  }'::jsonb,
  1
)
ON CONFLICT (slug) DO NOTHING;
