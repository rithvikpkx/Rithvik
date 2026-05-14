-- Add 11 popular editor themes to the theme picker.
-- Idempotent: re-run safely; existing slugs are skipped.
-- Sort orders begin at 10 to keep room for the three Rithvik themes (0–2).
--
-- Variants chosen for multi-flavor themes:
--   Ayu         → Ayu Mirage     (most distinctive of the three Ayus)
--   Catppuccin  → Catppuccin Mocha (the dark flavor in widest use)
--   Tokyo Night → canonical blue-accent variant

-- ── Dark themes ──────────────────────────────────────────────────────────────

INSERT INTO themes (slug, name, tokens, sort_order)
VALUES (
  'one-dark-pro',
  'One Dark Pro',
  '{
    "bg":           "#282c34",
    "bg-soft":      "#21252b",
    "text":         "#abb2bf",
    "muted":        "#5c6370",
    "accent":       "#61afef",
    "accent-glow":  "rgba(97,175,239,0.22)",
    "green":        "#98c379"
  }'::jsonb,
  10
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO themes (slug, name, tokens, sort_order)
VALUES (
  'dracula',
  'Dracula Official',
  '{
    "bg":           "#282a36",
    "bg-soft":      "#21222c",
    "text":         "#f8f8f2",
    "muted":        "#6272a4",
    "accent":       "#bd93f9",
    "accent-glow":  "rgba(189,147,249,0.25)",
    "green":        "#50fa7b"
  }'::jsonb,
  11
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO themes (slug, name, tokens, sort_order)
VALUES (
  'github-dark',
  'GitHub Dark',
  '{
    "bg":           "#0d1117",
    "bg-soft":      "#161b22",
    "text":         "#c9d1d9",
    "muted":        "#8b949e",
    "accent":       "#58a6ff",
    "accent-glow":  "rgba(88,166,255,0.22)",
    "green":        "#3fb950"
  }'::jsonb,
  12
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO themes (slug, name, tokens, sort_order)
VALUES (
  'tokyo-night',
  'Tokyo Night',
  '{
    "bg":           "#1a1b26",
    "bg-soft":      "#16161e",
    "text":         "#c0caf5",
    "muted":        "#565f89",
    "accent":       "#7aa2f7",
    "accent-glow":  "rgba(122,162,247,0.22)",
    "green":        "#9ece6a"
  }'::jsonb,
  13
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO themes (slug, name, tokens, sort_order)
VALUES (
  'night-owl',
  'Night Owl',
  '{
    "bg":           "#011627",
    "bg-soft":      "#01111d",
    "text":         "#d6deeb",
    "muted":        "#5f7e97",
    "accent":       "#82aaff",
    "accent-glow":  "rgba(130,170,255,0.22)",
    "green":        "#addb67"
  }'::jsonb,
  14
)
ON CONFLICT (slug) DO NOTHING;

-- ── Modern & aesthetic ──────────────────────────────────────────────────────

INSERT INTO themes (slug, name, tokens, sort_order)
VALUES (
  'catppuccin-mocha',
  'Catppuccin Mocha',
  '{
    "bg":           "#1e1e2e",
    "bg-soft":      "#181825",
    "text":         "#cdd6f4",
    "muted":        "#6c7086",
    "accent":       "#cba6f7",
    "accent-glow":  "rgba(203,166,247,0.22)",
    "green":        "#a6e3a1"
  }'::jsonb,
  20
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO themes (slug, name, tokens, sort_order)
VALUES (
  'synthwave-84',
  'SynthWave ''84',
  '{
    "bg":           "#241b2f",
    "bg-soft":      "#1e1729",
    "text":         "#f8f8f2",
    "muted":        "#b893ce",
    "accent":       "#ff7edb",
    "accent-glow":  "rgba(255,126,219,0.32)",
    "green":        "#72f1b8"
  }'::jsonb,
  21
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO themes (slug, name, tokens, sort_order)
VALUES (
  'ayu-mirage',
  'Ayu Mirage',
  '{
    "bg":           "#1f2430",
    "bg-soft":      "#191e2a",
    "text":         "#cbccc6",
    "muted":        "#707a8c",
    "accent":       "#ffcc66",
    "accent-glow":  "rgba(255,204,102,0.25)",
    "green":        "#87d96c"
  }'::jsonb,
  22
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO themes (slug, name, tokens, sort_order)
VALUES (
  'nord',
  'Nord',
  '{
    "bg":           "#2e3440",
    "bg-soft":      "#3b4252",
    "text":         "#d8dee9",
    "muted":        "#4c566a",
    "accent":       "#88c0d0",
    "accent-glow":  "rgba(136,192,208,0.25)",
    "green":        "#a3be8c"
  }'::jsonb,
  23
)
ON CONFLICT (slug) DO NOTHING;

-- ── Light themes ────────────────────────────────────────────────────────────

INSERT INTO themes (slug, name, tokens, sort_order)
VALUES (
  'github-light',
  'GitHub Light',
  '{
    "bg":           "#ffffff",
    "bg-soft":      "#f6f8fa",
    "text":         "#1f2328",
    "muted":        "#656d76",
    "accent":       "#0969da",
    "accent-glow":  "rgba(9,105,218,0.18)",
    "green":        "#1a7f37"
  }'::jsonb,
  30
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO themes (slug, name, tokens, sort_order)
VALUES (
  'atom-one-light',
  'Atom One Light',
  '{
    "bg":           "#fafafa",
    "bg-soft":      "#f0f0f0",
    "text":         "#383a42",
    "muted":        "#a0a1a7",
    "accent":       "#4078f2",
    "accent-glow":  "rgba(64,120,242,0.18)",
    "green":        "#50a14f"
  }'::jsonb,
  31
)
ON CONFLICT (slug) DO NOTHING;
