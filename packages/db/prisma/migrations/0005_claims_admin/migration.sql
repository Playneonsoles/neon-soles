-- Migration 0005 (lot 3) : claims, journal d'audit admin, réglages du coupe-circuit.
ALTER TABLE claims ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS claims_status_idx ON claims(status);
CREATE INDEX IF NOT EXISTS claims_user_id_created_at_idx ON claims(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ledger_entries_ref_id_idx ON ledger_entries(ref_id);

CREATE TABLE IF NOT EXISTS admin_audit (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID REFERENCES users(id),            -- NULL = action automatique du système (ex. coupe-circuit)
  action VARCHAR(48) NOT NULL,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_created_at_idx ON admin_audit(created_at DESC);

INSERT INTO game_config (key, value, category) VALUES
  ('breaker_multiplier',  '3'::jsonb,    'claims'),
  ('breaker_floor_walk',  '1000'::jsonb, 'claims')
ON CONFLICT (key) DO NOTHING;
