-- Migration 0017 : quêtes quotidiennes (calculées à partir des marches), classement hebdomadaire, invitations.
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(12) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS boost_until   TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS referrals (
  referee_id  UUID PRIMARY KEY REFERENCES users(id),   -- un compte ne peut être invité qu'une fois
  referrer_id UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals (referrer_id);

CREATE TABLE IF NOT EXISTS weekly_awards (
  week_start DATE PRIMARY KEY,                          -- lundi de la semaine récompensée (heure de Paris)
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  winners    INTEGER NOT NULL DEFAULT 0
);

INSERT INTO collectibles (code, name, kind, rarity) VALUES
  ('weekly_top10', 'Weekly Top 10', 'trophy', 'epic'),
  ('friend_badge', 'Walking Buddy', 'badge', 'rare')
ON CONFLICT (code) DO NOTHING;

INSERT INTO game_config (key, value, category) VALUES
  ('daily_quests',        '[{"id":"walks","metric":"walks","target":2},{"id":"distance","metric":"distance_m","target":1500},{"id":"minutes","metric":"valid_seconds","target":1200}]'::jsonb, 'quests'),
  ('quest_bonus_pct',     '3'::jsonb,    'quests'),     -- % de gains en plus par quête terminée, sur les marches suivantes du jour (3 quêtes = +9 %)
  ('invite_boost_pct',    '10'::jsonb,   'invites'),    -- % de gains en plus pendant le boost d'invitation
  ('invite_boost_days',   '7'::jsonb,    'invites'),
  ('invite_max',          '20'::jsonb,   'invites'),    -- invitations maximum par joueur
  ('ranking_top_n',       '10'::jsonb,   'ranking'),    -- les N premiers de la semaine gagnent le collectable
  ('ranking_min_km',      '3'::jsonb,    'ranking')     -- distance minimale (km) pour être récompensé
ON CONFLICT (key) DO NOTHING;
