-- Remove two light themes from the picker. Idempotent.
DELETE FROM themes WHERE slug IN ('monokai-pro-light', 'atom-one-light');
