-- Add 5 more themes and reorder the whole picker so light themes sort above dark.
-- Idempotent: re-run safely. New rows use ON CONFLICT DO NOTHING; the final
-- sort_order block is authoritative for every slug (new and existing).
--
-- New themes:
--   Monokai Pro Light (Filter Sun)  → light
--   Monokai Pro (Filter Octagon)    → dark
--   High Contrast Dark              → dark
--   High Contrast Light             → light
--   Tokyo Night Horizon             → dark (Horizon palette: coral on plum)

-- ── New light themes ─────────────────────────────────────────────────────────

INSERT INTO themes (slug, name, tokens, sort_order)
VALUES (
  'high-contrast-light',
  'High Contrast Light',
  '{
    "bg":           "#ffffff",
    "bg-soft":      "#f0f0f0",
    "text":         "#000000",
    "muted":        "#545454",
    "accent":       "#0f4a85",
    "accent-glow":  "rgba(15,74,133,0.18)",
    "green":        "#0a7d00"
  }'::jsonb,
  4
)
ON CONFLICT (slug) DO NOTHING;

-- ── New dark themes ──────────────────────────────────────────────────────────

INSERT INTO themes (slug, name, tokens, sort_order)
VALUES (
  'monokai-pro',
  'Monokai Pro (Filter Octagon)',
  '{
    "bg":           "#282a3a",
    "bg-soft":      "#222431",
    "text":         "#eaf2f1",
    "muted":        "#696d77",
    "accent":       "#ff657a",
    "accent-glow":  "rgba(255,101,122,0.25)",
    "green":        "#bad761"
  }'::jsonb,
  20
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO themes (slug, name, tokens, sort_order)
VALUES (
  'high-contrast-dark',
  'High Contrast Dark',
  '{
    "bg":           "#000000",
    "bg-soft":      "#0d0d0d",
    "text":         "#ffffff",
    "muted":        "#a6a6a6",
    "accent":       "#1aebff",
    "accent-glow":  "rgba(26,235,255,0.30)",
    "green":        "#3ff23f"
  }'::jsonb,
  21
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO themes (slug, name, tokens, sort_order)
VALUES (
  'tokyo-night-horizon',
  'Tokyo Night Horizon',
  '{
    "bg":           "#1c1e26",
    "bg-soft":      "#16161c",
    "text":         "#d5d8da",
    "muted":        "#6c6f93",
    "accent":       "#e95678",
    "accent-glow":  "rgba(233,86,120,0.25)",
    "green":        "#29d398"
  }'::jsonb,
  22
)
ON CONFLICT (slug) DO NOTHING;

-- ── Reorder: light themes (0–4) above dark themes (10–22) ─────────────────────
-- Light group, GitHub Light (the default) first; then existing relative order.
UPDATE themes SET sort_order = CASE slug
  WHEN 'github-light'         THEN 0
  WHEN 'rithvik-light'        THEN 1
  WHEN 'high-contrast-light'  THEN 4
  -- Dark group, Rithvik themes first; then existing relative order; new last.
  WHEN 'rithvik-dark'         THEN 10
  WHEN 'rithvik-terminal'     THEN 11
  WHEN 'one-dark-pro'         THEN 12
  WHEN 'dracula'              THEN 13
  WHEN 'github-dark'          THEN 14
  WHEN 'tokyo-night'          THEN 15
  WHEN 'night-owl'            THEN 16
  WHEN 'catppuccin-mocha'     THEN 17
  WHEN 'synthwave-84'         THEN 18
  WHEN 'ayu-mirage'           THEN 19
  WHEN 'monokai-pro'          THEN 20
  WHEN 'high-contrast-dark'   THEN 21
  WHEN 'tokyo-night-horizon'  THEN 22
  ELSE sort_order
END;
