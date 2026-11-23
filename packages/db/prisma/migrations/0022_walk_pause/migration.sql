-- Migration 0022 : pause pendant une marche (le temps en pause ne compte pas dans la fenêtre de la session).
ALTER TABLE walk_sessions ADD COLUMN IF NOT EXISTS paused_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE walk_sessions ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
