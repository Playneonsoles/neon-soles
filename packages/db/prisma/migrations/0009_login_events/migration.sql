-- Migration 0009 : suivi des connexions (réservé à l'administrateur).
-- On n'enregistre PAS l'adresse IP : le pays est déduit à la connexion (en-tête du proxy) puis l'IP est oubliée.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS users_last_seen_idx ON users (last_seen_at);

CREATE TABLE IF NOT EXISTS login_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country CHAR(2),
  device VARCHAR(12) NOT NULL CHECK (device IN ('android', 'iphone', 'computer', 'other')),
  mode VARCHAR(8) NOT NULL CHECK (mode IN ('app', 'browser')),
  is_new BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_events_created_idx ON login_events (created_at DESC);
CREATE INDEX IF NOT EXISTS login_events_user_idx ON login_events (user_id, created_at DESC);

INSERT INTO game_config (key, value, category) VALUES
  ('login_events_retention_days', '90'::jsonb, 'privacy')
ON CONFLICT (key) DO NOTHING;
