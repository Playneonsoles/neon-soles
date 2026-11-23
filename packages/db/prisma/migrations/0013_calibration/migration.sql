-- Migration 0013 : calibrage de l'économie pour une offre initiale de 1 000 000 000 $WALK.
-- Repères : joueur niveau 1 ≈ 40 $WALK/jour (4 marches × 5 min × 2), niveau 20 ≈ 340 $WALK/jour (facteur d'émission 1,0).
-- Tout reste modifiable dans l'admin ; ces valeurs ÉCRASENT les anciens exemples (aucune donnée de production avant le lancement).
UPDATE game_config SET value = '250000'::jsonb WHERE key = 'daily_emission_cap';          -- ≈ 0,025 % de l'offre par jour (réserve de récompenses de 400 M ≈ 4,4 ans au plafond)
UPDATE game_config SET value = '{"2":35,"3":80,"4":140,"5":225}'::jsonb WHERE key = 'shoe_shop_prices'; -- ≈ 1,6 × le coût cumulé d'amélioration jusqu'à ce niveau
UPDATE game_config SET value = '500000'::jsonb WHERE key = 'market_max_price_walk';
UPDATE game_config SET value = '1.27'::jsonb WHERE key = 'shoe_repair_level_growth';     -- ≈ 2 % des gains d'un cycle d'usure au niveau 10, ≈ 11 % au niveau 20
-- Accessoires de l'atelier (6 décimales) : 60 → 580 $WALK, déjà cohérents avec les gains ; inchangés.
