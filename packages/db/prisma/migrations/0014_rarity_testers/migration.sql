-- Migration 0014 : rareté (multiplicateur de gains), modèles légendaire/mythique supplémentaires, chaussures offertes aux testeurs.
INSERT INTO shoe_models (code, name, rarity, is_starter) VALUES
  ('solar_comet', 'Solar Comet', 'legendary', false),
  ('aurora_flux', 'Aurora Flux', 'mythic', false),
  ('eclipse_prime', 'Eclipse Prime', 'mythic', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO game_config (key, value, category) VALUES
  ('rarity_multipliers',  '{"common":1,"rare":1.2,"epic":1.44,"legendary":1.87,"mythic":2.43}'::jsonb, 'shoes'),
  ('tester_shoes_until',  '"2026-11-26T23:59:59+01:00"'::jsonb, 'testers'),   -- comptes créés avant cette date : chaussure offerte
  ('tester_level_min',    '10'::jsonb, 'testers'),
  ('tester_level_max',    '15'::jsonb, 'testers'),
  ('tester_mythic_pct',   '25'::jsonb, 'testers')                               -- % de chances d'une mythique (sinon légendaire)
ON CONFLICT (key) DO NOTHING;
