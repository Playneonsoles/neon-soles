-- Migration 0015 : page « Idées » (propositions d'amélioration + votes).
CREATE TABLE IF NOT EXISTS suggestions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id),               -- NULL = proposition de l'équipe
  body       VARCHAR(400) NOT NULL,
  status     VARCHAR(12) NOT NULL DEFAULT 'open',      -- open | planned | done | hidden
  votes      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS suggestions_rank_idx ON suggestions (status, votes DESC, created_at DESC);
CREATE TABLE IF NOT EXISTS suggestion_votes (
  suggestion_id UUID NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (suggestion_id, user_id)
);
INSERT INTO suggestions (body, status) VALUES
  ('Seasonal events with limited-time shoes and bonus rewards.', 'open'),
  ('Teams: walk together, share a team goal and a team ranking.', 'open'),
  ('Friend challenges: pick a distance and a duration, the winner takes a collectible.', 'open'),
  ('Local partners: get a perk at a café or shop when your walk passes by.', 'open'),
  ('Sync with Apple Health and Google Fit to confirm steps.', 'planned'),
  ('Shoe customization: choose colors and effects you unlocked.', 'open'),
  ('Ranking by city and by country, on top of the global one.', 'open'),
  ('Push notification when your next walk is ready.', 'planned'),
  ('Charity walks: part of a daily pool goes to a cause voted by players.', 'open'),
  ('Native iOS and Android app.', 'open'),
  ('A public page explaining exactly how cheating is detected and handled.', 'open'),
  ('Night mode and a colour-blind friendly palette.', 'open');
