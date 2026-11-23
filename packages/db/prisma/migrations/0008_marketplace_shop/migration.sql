-- Migration 0008 : place de marché entre joueurs + boutique de chaussures niveaux 2 à 5.
-- Prix en $WALK payé on-chain ; frais de la place de marché en SOL (minimum 0,01) versés à la trésorerie.
INSERT INTO game_config (key, value, category) VALUES
  ('market_enabled',               'true'::jsonb,    'marketplace'),
  ('market_fee_min_sol',           '0.01'::jsonb,    'marketplace'),
  ('market_fee_lamports_per_walk', '0'::jsonb,       'marketplace'),
  ('market_min_price_walk',        '10'::jsonb,      'marketplace'),
  ('market_max_price_walk',        '1000000'::jsonb, 'marketplace'),
  ('market_reservation_minutes',   '3'::jsonb,       'marketplace'),
  ('shoe_shop_enabled',            'true'::jsonb,    'shop'),
  ('shoe_shop_prices',             '{"2":30000,"3":61000,"4":124000,"5":250000}'::jsonb, 'shop')
ON CONFLICT (key) DO NOTHING;
-- Les anciens frais en $WALK de la place de marché ne servent plus (frais en SOL) : mis à zéro pour éviter toute confusion.
UPDATE game_config SET value = '0'::jsonb WHERE key IN ('market_fee_pct', 'listing_fee', 'feature_fee');

CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id),
  kind VARCHAR(12) NOT NULL CHECK (kind IN ('shoe', 'collectible')),
  item_id UUID NOT NULL,
  price_walk BIGINT NOT NULL CHECK (price_walk > 0),
  status VARCHAR(12) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reserved', 'sold', 'cancelled')),
  reserved_by UUID REFERENCES users(id),
  reserved_until TIMESTAMPTZ,
  reservation_nonce VARCHAR(32),
  fee_lamports BIGINT,
  buyer_id UUID REFERENCES users(id),
  tx_signature VARCHAR(88) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sold_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS listings_open_idx ON listings (kind, created_at DESC) WHERE status IN ('active', 'reserved');
CREATE INDEX IF NOT EXISTS listings_seller_idx ON listings (seller_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS listings_item_open_uidx ON listings (kind, item_id) WHERE status IN ('active', 'reserved');

ALTER TABLE shoes ADD COLUMN IF NOT EXISTS listing_id UUID;
ALTER TABLE user_collectibles ADD COLUMN IF NOT EXISTS listing_id UUID;

-- Commandes de la boutique : une commande = une chaussure, un paiement (signature unique).
CREATE TABLE IF NOT EXISTS shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  level SMALLINT NOT NULL,
  price_walk BIGINT NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  nonce VARCHAR(32) NOT NULL,
  tx_signature VARCHAR(88) UNIQUE,
  shoe_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_orders_user_idx ON shop_orders (user_id, created_at DESC);
