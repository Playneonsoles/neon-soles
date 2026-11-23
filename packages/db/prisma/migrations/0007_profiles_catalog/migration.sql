-- Migration 0007 : jeu SANS NFT. Profil joueur, catalogue de chaussures et de collectables, dons admin.

-- Profil : nom en « @ » (colonne pseudo existante, unique), genre, apparence, pays.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gender VARCHAR(16),
  ADD COLUMN IF NOT EXISTS appearance VARCHAR(20),
  ADD COLUMN IF NOT EXISTS country CHAR(2),
  ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banned_reason VARCHAR(200);
ALTER TABLE users ADD CONSTRAINT users_pseudo_format CHECK (pseudo IS NULL OR pseudo ~ '^@[a-z0-9_]{3,20}$') NOT VALID;
CREATE INDEX IF NOT EXISTS users_pseudo_prefix_idx ON users (pseudo text_pattern_ops);
CREATE INDEX IF NOT EXISTS users_wallet_prefix_idx ON users (wallet text_pattern_ops);

-- Catalogue des modèles de chaussures. Le panneau admin lit cette table : toute ligne ajoutée y apparaît toute seule.
CREATE TABLE IF NOT EXISTS shoe_models (
  code VARCHAR(32) PRIMARY KEY,
  name VARCHAR(48) NOT NULL,
  rarity VARCHAR(16) NOT NULL DEFAULT 'common',
  image_key VARCHAR(128),                      -- image 2D ou rendu 3D (.png / .webp / .glb) servi par le site
  is_starter BOOLEAN NOT NULL DEFAULT false,   -- donnée gratuitement à l'inscription
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO shoe_models (code, name, rarity, is_starter) VALUES
  ('starter', 'Starter Sneaker', 'common', true),
  ('neon_runner', 'Neon Runner', 'rare', false),
  ('violet_pulse', 'Violet Pulse', 'epic', false),
  ('golden_tower', 'Golden Tower', 'legendary', false)
ON CONFLICT (code) DO NOTHING;

-- Chaussures : plus de NFT. Origine, caractéristiques libres (couleur, effets), retrait en douceur.
ALTER TABLE shoes
  ADD COLUMN IF NOT EXISTS source VARCHAR(16) NOT NULL DEFAULT 'starter',   -- starter | admin | shop
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS shoes_owner_active_idx ON shoes (owner_id) WHERE removed_at IS NULL;

-- Collectables (autre catalogue, même principe).
CREATE TABLE IF NOT EXISTS collectibles (
  code VARCHAR(32) PRIMARY KEY,
  name VARCHAR(48) NOT NULL,
  kind VARCHAR(16) NOT NULL DEFAULT 'badge',   -- badge | trophy | skin | other
  rarity VARCHAR(16) NOT NULL DEFAULT 'common',
  image_key VARCHAR(128),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO collectibles (code, name, kind, rarity) VALUES
  ('founder_badge', 'Founder Badge', 'badge', 'legendary'),
  ('city_walker', 'City Walker', 'trophy', 'rare')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_collectibles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  collectible_code VARCHAR(32) NOT NULL REFERENCES collectibles(code),
  granted_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS user_collectibles_user_idx ON user_collectibles (user_id) WHERE removed_at IS NULL;

-- shop_items : les produits de l'atelier pointent vers le catalogue de chaussures par niveau, pas de lien NFT.
