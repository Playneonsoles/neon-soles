-- Migration 0016 : améliorations payées (commande + vérification on-chain) et craft.
ALTER TABLE upgrades ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES users(id);
ALTER TABLE upgrades ADD COLUMN IF NOT EXISTS nonce      VARCHAR(32);
ALTER TABLE upgrades ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
INSERT INTO game_config (key, value, category) VALUES
  ('craft_min_level', '4'::jsonb, 'shoes')   -- niveau minimal des chaussures données au craft (évite de transformer les chaussures de départ gratuites)
ON CONFLICT (key) DO NOTHING;
