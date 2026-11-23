-- Migration 0020 : badges donnés par l'admin, et mode « test de retrait » par joueur.
CREATE TABLE IF NOT EXISTS user_badges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  code       VARCHAR(24) NOT NULL,
  granted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);
CREATE INDEX IF NOT EXISTS user_badges_user_idx ON user_badges (user_id);

-- Joueur dispensé des règles de retrait (ancienneté du compte, nombre minimal de marches, une seule demande par 24 h) : pour les tests.
ALTER TABLE users ADD COLUMN IF NOT EXISTS claim_exempt BOOLEAN NOT NULL DEFAULT false;
