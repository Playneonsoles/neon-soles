-- Migration 0004 : une session de marche toutes les 3 h (réglable), au lieu d'une par jour.

-- 1) Plusieurs sessions par jour : on retire l'unicité (user_id, walk_day).
--    La course entre deux démarrages simultanés est évitée par un verrou applicatif (pg_advisory_xact_lock).
ALTER TABLE walk_sessions DROP CONSTRAINT IF EXISTS walk_sessions_user_id_walk_day_key;
CREATE INDEX IF NOT EXISTS walk_sessions_user_id_started_at_idx ON walk_sessions(user_id, started_at DESC);

-- 2) Catégorie de réglages : l'admin regroupe game_config par catégorie.
ALTER TABLE game_config ADD COLUMN IF NOT EXISTS category VARCHAR(24) NOT NULL DEFAULT 'general';

INSERT INTO game_config (key, value, category) VALUES
  ('session_cooldown_hours', '3'::jsonb, 'sessions'),
  ('daily_session_limit',    '4'::jsonb, 'sessions')
ON CONFLICT (key) DO NOTHING;

UPDATE game_config SET category = 'sessions' WHERE key IN
  ('session_cooldown_hours','daily_session_limit','minutes_base','minutes_step','min_speed_kmh','min_speed_step_kmh');
UPDATE game_config SET category = 'economy' WHERE key IN
  ('base_rate_per_min','emission_mode','emission_manual_factor','emission_tiers','daily_emission_cap','decay_enabled',
   'cost_base','cost_growth','upgrade_minutes_factor','split_upgrade','treasury_allocation','multiplier_step','max_level',
   'streak_bonus_pct','streak_bonus_cap_pct','parts_bonus_cap_pct');
UPDATE game_config SET category = 'market' WHERE key IN ('market_fee_pct','listing_fee','feature_fee','royalty_pct');
UPDATE game_config SET category = 'claims' WHERE key IN ('claim_fee_pct','claim_min','claims_paused');
UPDATE game_config SET category = 'chests' WHERE key = 'chest_rates';
UPDATE game_config SET category = 'anticheat' WHERE key = 'anticheat';

-- 3) Anti-triche : des sessions plus courtes demandent un minimum de marche valide plus bas (45 s au lieu de 60 s).
UPDATE game_config SET value = jsonb_set(value, '{min_valid_seconds}', '45') WHERE key = 'anticheat';
