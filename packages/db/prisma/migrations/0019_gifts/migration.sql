-- Migration 0019 : cadeaux aléatoires après une marche validée.
INSERT INTO game_config (key, value, category) VALUES
  ('gift_enabled', 'true'::jsonb, 'gifts'),
  ('gift_chance_pct', '12'::jsonb, 'gifts'),
  ('gift_max_per_day', '2'::jsonb, 'gifts'),
  ('gift_walk_min_pct', '25'::jsonb, 'gifts'),
  ('gift_walk_max_pct', '150'::jsonb, 'gifts'),
  ('gift_collectible_pct', '20'::jsonb, 'gifts')
ON CONFLICT (key) DO NOTHING;
