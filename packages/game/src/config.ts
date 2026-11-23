import { z } from "zod";

/** Paramètres de jeu lus dans la table game_config. Aucune valeur d'économie n'est codée en dur. */
export const gameConfigSchema = z.object({
  base_rate_per_min: z.number().nonnegative(),
  emission_mode: z.enum(["auto", "manual"]),
  emission_manual_factor: z.number().nonnegative(),
  emission_tiers: z.array(z.object({ max_players: z.number().nullable(), factor: z.number() })),
  daily_emission_cap: z.number().nonnegative(),
  decay_enabled: z.boolean(),
  cost_base: z.number().positive(),
  cost_growth: z.number().positive(),
  upgrade_minutes_factor: z.number().positive(),
  split_upgrade: z.tuple([z.number(), z.number(), z.number()]),
  market_fee_pct: z.number(),
  listing_fee: z.number(),
  feature_fee: z.number(),
  royalty_pct: z.number(),
  treasury_allocation: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  claim_fee_pct: z.number(),
  claim_min: z.number(),
  chest_rates: z.object({
    session_chance_pct: z.number(),
    streak7_guaranteed: z.number(),
    level_up_guaranteed: z.number(),
    top10_min_rarity: z.string(),
    rarity: z.record(z.number()),
  }),
  streak_bonus_pct: z.number(),
  streak_bonus_cap_pct: z.number(),
  parts_bonus_cap_pct: z.number(),
  min_speed_kmh: z.number(),
  // Catégorie « sessions » : délai entre deux marches et plafond par jour (modifiables dans l'admin).
  session_cooldown_hours: z.number().min(0.5).max(168),
  daily_session_limit: z.number().int().min(1).max(24),
  min_speed_step_kmh: z.number(),
  multiplier_step: z.number(),
  minutes_base: z.number(),
  minutes_step: z.number(),
  max_level: z.number().int().positive(),
  claims_paused: z.boolean(),
  // Sécurité : un compte neuf ne retire pas tout de suite (freine les fermes de comptes).
  claim_min_account_age_hours: z.number().nonnegative(),
  claim_min_valid_walks: z.number().int().nonnegative(),
  new_accounts_per_ip_per_hour: z.number().int().positive(),
  // Rareté des chaussures : multiplicateur de gains par rareté du modèle (en plus du multiplicateur de niveau).
  rarity_multipliers: z.record(z.number().positive()).default({ common: 1, rare: 1.2, epic: 1.44, legendary: 1.87, mythic: 2.43 }),
  // Chaussures offertes aux testeurs (comptes créés avant cette date) : légendaire ou mythique, niveau min..max.
  tester_shoes_until: z.string().default("2026-11-26T23:59:59+01:00"),
  tester_level_min: z.number().int().min(1).default(10),
  tester_level_max: z.number().int().min(1).default(15),
  tester_mythic_pct: z.number().min(0).max(100).default(25),
  craft_min_level: z.number().int().min(1).default(4),
  // Pause pendant une marche : durée totale maximale de pause par marche (minutes). 0 = pause désactivée.
  walk_pause_max_minutes: z.number().min(0).max(240).default(30),
  // Cadeaux aléatoires à la fin d'une marche validée : $WALK bonus (% du gain de la marche) ou objet de collection.
  gift_enabled: z.boolean().default(true),
  gift_chance_pct: z.number().min(0).max(100).default(12),
  gift_max_per_day: z.number().int().min(0).default(2),
  gift_walk_min_pct: z.number().min(0).default(25),
  gift_walk_max_pct: z.number().min(0).default(150),
  gift_collectible_pct: z.number().min(0).max(100).default(20),
  // Cadeau de chaussures (période limitée) : une paire max par compte, niveau 1..gift_shoe_level_max, rareté tirée selon les poids (pas de mythique).
  gift_shoe_until: z.string().default("2026-11-26T23:59:59+01:00"),
  gift_shoe_chance_pct: z.number().min(0).max(100).default(20),
  gift_shoe_level_max: z.number().int().min(1).default(7),
  gift_shoe_rarity_weights: z.record(z.number().min(0)).default({ common: 50, rare: 30, epic: 15, legendary: 5 }),
  // Forge : 3 chaussures du même niveau n -> 1 chaussure de niveau n+1. Coût en SOL + en $WALK (proportionnel aux gains), plus cher après forge_easy_max_level.
  forge_enabled: z.boolean().default(true),
  forge_sol: z.number().min(0).default(0.03),
  forge_sol_growth: z.number().min(1).default(1.3),
  forge_easy_max_level: z.number().int().min(1).default(5),
  forge_walk_days_easy: z.number().min(0).default(0.1),
  forge_walk_days_growth: z.number().min(1).default(1.3),
  // Quêtes du jour (progression calculée à partir des marches validées), invitations, classement hebdomadaire.
  daily_quests: z.array(z.object({ id: z.string(), metric: z.enum(["walks", "distance_m", "valid_seconds"]), target: z.number().positive() }))
    .default([{ id: "walks", metric: "walks", target: 2 }, { id: "distance", metric: "distance_m", target: 1500 }, { id: "minutes", metric: "valid_seconds", target: 1200 }]),
  quest_bonus_pct: z.number().min(0).max(50).default(3),
  invite_boost_pct: z.number().min(0).max(100).default(10),
  invite_boost_days: z.number().min(0).max(60).default(7),
  invite_max: z.number().int().min(0).default(20),
  ranking_top_n: z.number().int().min(1).max(100).default(10),
  ranking_min_km: z.number().min(0).default(3),
  breaker_multiplier: z.number().positive(),
  breaker_floor_walk: z.number().nonnegative(),
  // Place de marché : prix en $WALK, frais TOUJOURS en SOL (jamais moins de 0,01 SOL, imposé par le schéma).
  market_enabled: z.boolean(),
  market_fee_min_sol: z.number().min(0.01),
  market_fee_lamports_per_walk: z.number().int().nonnegative(),
  market_min_price_walk: z.number().int().positive(),
  market_max_price_walk: z.number().int().positive(),
  market_reservation_minutes: z.number().min(1).max(30),
  // Boutique de chaussures : seuls les niveaux listés (2 à 5) s'achètent en $WALK ; au-delà, uniquement la place de marché.
  shoe_shop_enabled: z.boolean(),
  shoe_shop_prices: z.record(z.string().regex(/^\d+$/), z.number().int().positive()),
  // Usure et réparation : valeurs de départ basses, modifiables dans la console admin (catégorie « repair »).
  shoe_wear_enabled: z.boolean(),
  shoe_wear_per_walk: z.number().nonnegative(),
  shoe_worn_threshold: z.number().min(0).max(100),
  shoe_worn_reward_pct: z.number().min(0).max(100),
  shoe_broken_reward_pct: z.number().min(0).max(100),
  shoe_repair_base_cost: z.number().nonnegative(),
  shoe_repair_level_growth: z.number().min(1),
});

export type GameConfig = z.infer<typeof gameConfigSchema>;

/** Clés exposées publiquement par GET /config/public (coûts, minutes, probabilités). */
export const PUBLIC_CONFIG_KEYS = [
  "base_rate_per_min", "minutes_base", "minutes_step", "multiplier_step", "max_level",
  "cost_base", "cost_growth", "upgrade_minutes_factor", "min_speed_kmh", "min_speed_step_kmh",
  "chest_rates", "claim_min", "claim_fee_pct", "market_fee_pct", "listing_fee", "feature_fee",
  "streak_bonus_pct", "streak_bonus_cap_pct", "parts_bonus_cap_pct",
  "session_cooldown_hours", "daily_session_limit",
  "market_enabled", "market_fee_min_sol", "market_fee_lamports_per_walk", "market_min_price_walk", "market_max_price_walk",
  "shoe_shop_enabled", "shoe_shop_prices",
  "shoe_wear_enabled", "shoe_wear_per_walk", "shoe_worn_threshold", "shoe_worn_reward_pct", "shoe_broken_reward_pct",
  "shoe_repair_base_cost", "shoe_repair_level_growth",
  "daily_emission_cap", "rarity_multipliers", "tester_shoes_until", "tester_level_min", "tester_level_max", "craft_min_level",
  "forge_enabled", "forge_sol", "forge_sol_growth", "forge_easy_max_level", "forge_walk_days_easy", "forge_walk_days_growth", "daily_quests", "quest_bonus_pct", "invite_boost_pct", "invite_boost_days", "invite_max", "ranking_top_n", "ranking_min_km",
] as const;

/** Convertit les lignes de game_config en configuration validée (lève une erreur si une clé manque). */
export function parseGameConfig(rows: { key: string; value: unknown }[]): GameConfig {
  const obj: Record<string, unknown> = {};
  for (const r of rows) obj[r.key] = r.value;
  return gameConfigSchema.parse(obj);
}
