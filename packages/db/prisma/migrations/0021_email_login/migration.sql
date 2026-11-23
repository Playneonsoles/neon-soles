-- Migration 0021 : connexion par email / Google pour les joueurs sans wallet.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email             VARCHAR(254);
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name        VARCHAR(60);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name         VARCHAR(60);
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider     VARCHAR(16);
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub        VARCHAR(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key      ON users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_key ON users (google_sub);

CREATE TABLE IF NOT EXISTS email_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      VARCHAR(254) NOT NULL,
  code_hash  VARCHAR(64) NOT NULL,
  first_name VARCHAR(60),
  last_name  VARCHAR(60),
  wallet     VARCHAR(44),
  attempts   INT NOT NULL DEFAULT 0,
  used       BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_codes_email_idx ON email_codes (email, created_at);
