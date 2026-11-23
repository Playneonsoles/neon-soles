-- Migration 0003 : seuils anti-triche de la section 7 (clé `anticheat`, ajustable depuis l'admin).
INSERT INTO game_config (key, value) VALUES
  ('anticheat', '{"min_walk_kmh":2.5,"max_walk_kmh":7,"min_speed_share":0.8,"jump_m":50,"jump_window_s":3,"max_accuracy_m":30,"max_gap_s":10,"cadence_min":90,"cadence_max":140,"step_len_min_m":0.4,"step_len_max_m":1.1,"min_points":5,"min_valid_seconds":60,"review_below":60,"reject_below":30,"pen_speed":40,"pen_cadence":25,"pen_no_steps":10,"pen_step_len":15,"pen_perfect":45,"pen_jumps":20,"pen_device":25}'::jsonb)
ON CONFLICT (key) DO NOTHING;
