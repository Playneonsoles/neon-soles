-- Migration 0011 : usure et réparation des chaussures (valeurs de départ basses, modifiables dans la console admin).
ALTER TABLE shoes ADD COLUMN IF NOT EXISTS durability NUMERIC(5,2) NOT NULL DEFAULT 100;
ALTER TABLE shoes ADD CONSTRAINT shoes_durability_range CHECK (durability BETWEEN 0 AND 100);

CREATE TABLE IF NOT EXISTS repair_orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),
  shoe_id      UUID NOT NULL REFERENCES shoes(id),
  restore_pct  SMALLINT NOT NULL,             -- points de durabilité rendus (figé à la commande)
  price_walk   BIGINT NOT NULL,               -- prix figé à la commande
  status       VARCHAR(12) NOT NULL DEFAULT 'pending',
  expires_at   TIMESTAMPTZ NOT NULL,
  nonce        VARCHAR(32) NOT NULL,
  tx_signature VARCHAR(88) UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS repair_orders_user_idx ON repair_orders (user_id, created_at DESC);

INSERT INTO game_config (key, value, category) VALUES
  ('shoe_wear_enabled',       'true'::jsonb, 'repair'),   -- interrupteur général de l'usure
  ('shoe_wear_per_walk',      '1'::jsonb,    'repair'),   -- points de durabilité perdus par marche validée (soit 100 marches pour une paire neuve)
  ('shoe_worn_threshold',     '25'::jsonb,   'repair'),   -- en dessous : chaussure « usée »
  ('shoe_worn_reward_pct',    '85'::jsonb,   'repair'),   -- gain conservé quand elle est usée (%)
  ('shoe_broken_reward_pct',  '60'::jsonb,   'repair'),   -- gain conservé à 0 % de durabilité (%) : jamais bloquée, seulement moins efficace
  ('shoe_repair_base_cost',   '10'::jsonb,   'repair'),   -- $WALK pour réparer 100 points d'une chaussure niveau 1
  ('shoe_repair_level_growth','1.5'::jsonb,  'repair')    -- le coût est multiplié par cette valeur à chaque niveau
ON CONFLICT (key) DO NOTHING;
