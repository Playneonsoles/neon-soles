import type { GameConfig } from "./config";

type WearCfg = Pick<GameConfig, "shoe_wear_enabled" | "shoe_wear_per_walk" | "shoe_worn_threshold" | "shoe_worn_reward_pct" | "shoe_broken_reward_pct">;
type RepairCfg = Pick<GameConfig, "shoe_repair_base_cost" | "shoe_repair_level_growth">;

/** Durabilité après une marche validée (jamais sous 0). */
export function wearAfterWalk(durability: number, c: WearCfg): number {
  if (!c.shoe_wear_enabled) return durability;
  return Math.max(0, Math.round((durability - c.shoe_wear_per_walk) * 100) / 100);
}

/** Part du gain conservée selon l'état : 100 % si neuve ; décroît de « usée » (seuil) vers « cassée » (0 %). La chaussure n'est jamais bloquée. */
export function wearRewardFactor(durability: number, c: WearCfg): number {
  if (!c.shoe_wear_enabled || durability >= c.shoe_worn_threshold) return 1;
  const worn = c.shoe_worn_reward_pct / 100, broken = c.shoe_broken_reward_pct / 100;
  const t = c.shoe_worn_threshold === 0 ? 0 : durability / c.shoe_worn_threshold; // 1 au seuil, 0 à zéro
  return broken + (worn - broken) * t;
}

/** Coût en $WALK entiers pour rendre `restorePct` points de durabilité à une chaussure de ce niveau (au moins 1). */
export function repairCost(level: number, restorePct: number, c: RepairCfg): number {
  if (restorePct <= 0) return 0;
  const full = c.shoe_repair_base_cost * Math.pow(c.shoe_repair_level_growth, Math.max(0, level - 1));
  return Math.max(1, Math.ceil((full * restorePct) / 100));
}
