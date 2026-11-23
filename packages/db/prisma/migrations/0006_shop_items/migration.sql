-- Migration 0006 : produits complémentaires de l'atelier (prix modifiables par l'admin, jamais en dur dans le code).
CREATE TABLE IF NOT EXISTS shop_items (
  code VARCHAR(32) PRIMARY KEY,
  name VARCHAR(48) NOT NULL,
  kind VARCHAR(16) NOT NULL,                   -- laces | cushion | sole | booster | core | charm | crest
  unlock_level SMALLINT NOT NULL,
  price_walk NUMERIC(30,0) NOT NULL,           -- en unités de base du jeton
  network_fee_lamports BIGINT NOT NULL DEFAULT 0,  -- frais SOL éventuels (0 = seulement les frais réseau)
  effect VARCHAR(16) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS user_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  shoe_id UUID REFERENCES shoes(id),
  item_code VARCHAR(32) NOT NULL REFERENCES shop_items(code),
  tx_signature VARCHAR(88) UNIQUE,             -- un paiement ne peut servir qu'une fois
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_items_user_idx ON user_items(user_id);

-- Prix de départ (exemples, 6 décimales) : à régler dans l'admin.
INSERT INTO shop_items (code, name, kind, unlock_level, price_walk, effect) VALUES
 ('neon_laces',  'Neon Laces',  'laces',   2,  60000000, 'glow'),
 ('air_cushion', 'Air Cushion', 'cushion', 4,  90000000, 'sparkles'),
 ('grip_sole',   'Grip Sole',   'sole',    7, 130000000, 'aura'),
 ('turbo_gel',   'Turbo Gel',   'booster',10, 190000000, 'trail'),
 ('storm_core',  'Storm Core',  'core',   13, 280000000, 'lightning'),
 ('wing_charm',  'Wing Charm',  'charm',  16, 400000000, 'wings'),
 ('halo_crest',  'Halo Crest',  'crest',  19, 580000000, 'halo')
ON CONFLICT (code) DO NOTHING;
