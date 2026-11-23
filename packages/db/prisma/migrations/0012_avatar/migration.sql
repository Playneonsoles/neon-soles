-- Migration 0012 : le joueur choisit un avatar préparé (personnage d'archétype de cinéma) ; plus de genre, d'origine ni de pays demandés.
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar SMALLINT;
ALTER TABLE users ADD CONSTRAINT users_avatar_range CHECK (avatar IS NULL OR avatar BETWEEN 0 AND 11);
