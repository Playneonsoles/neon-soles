-- Migration 0001 : schéma de la section 9 (SQL du cahier des charges, tel quel).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet VARCHAR(44) UNIQUE NOT NULL,
  pseudo VARCHAR(24) UNIQUE,
  wallet_kind VARCHAR(16),
  is_admin BOOLEAN NOT NULL DEFAULT false,
  streak_days INT NOT NULL DEFAULT 0,
  last_walk_day DATE,
  device_hash VARCHAR(64),
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE auth_nonces (
  nonce VARCHAR(64) PRIMARY KEY,
  wallet VARCHAR(44) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE game_config (
  key VARCHAR(64) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE game_config_history (
  id BIGSERIAL PRIMARY KEY, key VARCHAR(64), old_value JSONB, new_value JSONB,
  changed_by UUID REFERENCES users(id), changed_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE shoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id),
  model VARCHAR(32) NOT NULL DEFAULT 'starter',
  level SMALLINT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 20),
  is_equipped BOOLEAN NOT NULL DEFAULT true,
  upgrading_until TIMESTAMPTZ,
  asset_id VARCHAR(44) UNIQUE,
  metadata_uri VARCHAR(256),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE part_types (
  id SERIAL PRIMARY KEY,
  slot VARCHAR(16) NOT NULL,
  rarity VARCHAR(16) NOT NULL,
  name VARCHAR(48) NOT NULL,
  bonus_pct NUMERIC(5,2) NOT NULL,
  image_key VARCHAR(128) NOT NULL
);

CREATE TABLE parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id INT NOT NULL REFERENCES part_types(id),
  owner_id UUID NOT NULL REFERENCES users(id),
  equipped_on UUID REFERENCES shoes(id),
  state VARCHAR(16) NOT NULL DEFAULT 'free',
  source VARCHAR(16) NOT NULL,
  asset_id VARCHAR(44) UNIQUE,
  is_frozen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE walk_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  shoe_id UUID NOT NULL REFERENCES shoes(id),
  walk_day DATE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  valid_seconds INT DEFAULT 0,
  distance_m INT DEFAULT 0,
  steps INT DEFAULT 0,
  avg_speed_kmh NUMERIC(4,2),
  trust_score SMALLINT,
  status VARCHAR(16) NOT NULL DEFAULT 'running',
  estimated_reward NUMERIC(30,0) DEFAULT 0,
  confirmed_reward NUMERIC(30,0),
  UNIQUE (user_id, walk_day)
);

CREATE TABLE walk_points (
  session_id UUID REFERENCES walk_sessions(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ, lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  accuracy_m REAL, speed_ms REAL, steps INT
);

CREATE TABLE ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  kind VARCHAR(24) NOT NULL,
  amount NUMERIC(30,0) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  ref_id UUID,
  tx_signature VARCHAR(88),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(30,0) NOT NULL,
  fee NUMERIC(30,0) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'queued',
  tx_signature VARCHAR(88),
  attempts SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE upgrades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shoe_id UUID REFERENCES shoes(id), from_level SMALLINT, to_level SMALLINT,
  cost NUMERIC(30,0), burned NUMERIC(30,0), to_pool NUMERIC(30,0), to_treasury NUMERIC(30,0),
  parts_consumed UUID[], tx_signature VARCHAR(88) UNIQUE,
  status VARCHAR(16) DEFAULT 'awaiting_tx', created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE market_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID NOT NULL REFERENCES parts(id), seller_id UUID NOT NULL REFERENCES users(id),
  price NUMERIC(30,0) NOT NULL, status VARCHAR(16) DEFAULT 'active',
  buyer_id UUID REFERENCES users(id), reserved_until TIMESTAMPTZ,
  tx_signature VARCHAR(88) UNIQUE, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE chest_drops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id),
  trigger VARCHAR(24), roll INT, part_id UUID REFERENCES parts(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE nft_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind VARCHAR(16) NOT NULL,
  target_id UUID NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'queued',
  tx_signature VARCHAR(88), attempts SMALLINT DEFAULT 0, error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE nft_trees (
  address VARCHAR(44) PRIMARY KEY, capacity INT NOT NULL, minted INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE daily_emissions (
  day DATE PRIMARY KEY, active_users INT, emission_factor NUMERIC(4,2),
  earned_raw NUMERIC(30,0), cap NUMERIC(30,0), prorata NUMERIC(5,4), burned NUMERIC(30,0)
);

-- Index demandés
CREATE INDEX walk_sessions_user_id_walk_day_idx ON walk_sessions(user_id, walk_day);
CREATE INDEX ledger_entries_user_id_status_idx ON ledger_entries(user_id, status);
CREATE INDEX parts_owner_id_state_idx ON parts(owner_id, state);
CREATE INDEX market_listings_status_price_idx ON market_listings(status, price);
CREATE INDEX walk_points_session_id_ts_idx ON walk_points(session_id, ts);
