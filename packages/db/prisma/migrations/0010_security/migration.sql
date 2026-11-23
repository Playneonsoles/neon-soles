-- Migration 0010 : durcissement (sessions révocables, comptes neufs, anti-bots).
-- session_version : la déconnexion et le blocage invalident immédiatement tous les jetons déjà émis.
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;

INSERT INTO game_config (key, value, category) VALUES
  ('claim_min_account_age_hours',  '0'::jsonb /* REDACTED */, 'security'),   -- un compte neuf ne peut pas retirer avant 24 h
  ('claim_min_valid_walks',        '0'::jsonb /* REDACTED */,  'security'),   -- ... ni avant 3 marches validées
  ('new_accounts_per_ip_per_hour', '0'::jsonb /* REDACTED */,  'security')    -- créations de comptes par adresse IP et par heure
ON CONFLICT (key) DO NOTHING;
