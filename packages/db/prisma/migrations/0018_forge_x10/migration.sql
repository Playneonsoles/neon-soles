-- Migration 0018 : forge (3 chaussures de niveau n -> 1 de niveau n+1, payée en SOL + $WALK) et récompenses x10 (temporaire).
CREATE TABLE IF NOT EXISTS forges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  shoe_ids      UUID[] NOT NULL,
  from_level    SMALLINT NOT NULL,
  cost          NUMERIC(30,0) NOT NULL,
  burned        NUMERIC(30,0) NOT NULL,
  to_pool       NUMERIC(30,0) NOT NULL,
  to_treasury   NUMERIC(30,0) NOT NULL,
  sol_lamports  NUMERIC(30,0) NOT NULL,
  nonce         VARCHAR(32) NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  status        VARCHAR(16) NOT NULL DEFAULT 'awaiting_tx',
  tx_signature  VARCHAR(88) UNIQUE,
  result_shoe_id UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS forges_user_idx ON forges (user_id, created_at DESC);

INSERT INTO game_config (key, value, category) VALUES
  ('forge_enabled', 'true'::jsonb, 'shoes'),
  ('forge_sol', '0.03'::jsonb, 'shoes'),
  ('forge_sol_growth', '1.3'::jsonb, 'shoes'),
  ('forge_easy_max_level', '5'::jsonb, 'shoes'),
  ('forge_walk_days_easy', '0.1'::jsonb, 'shoes'),
  ('forge_walk_days_growth', '1.3'::jsonb, 'shoes')
ON CONFLICT (key) DO NOTHING;

-- Récompenses x10 pour la phase de test : gain par minute ET plafond journalier du pool.
UPDATE game_config SET value = to_jsonb((value #>> '{}')::numeric * 10), updated_at = now()
 WHERE key IN ('base_rate_per_min', 'daily_emission_cap') AND jsonb_typeof(value) = 'number';
