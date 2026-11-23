import type { GameConfig } from "./config";
import { minutesForLevel, multiplierForLevel, streakBonusPct } from "./formulas";

export interface RewardInput {
  validSeconds: number;
  level: number;
  partsBonusPct: number; // bonus des pièces équipées (lot 4) ; plafonné par parts_bonus_cap_pct
  streakDays: number; // série incluant la session du jour
  emissionFactor: number;
  /** Facteurs multiplicatifs supplémentaires (rareté du modèle, quêtes, boost d'invitation…). 1 par défaut. */
  extraFactor?: number;
}

/**
 * Gains de la session en $WALK (2 décimales) :
 * minutes × taux de base × multiplicateur × bonus de pièces × bonus de série × facteur d'émission.
 * Les minutes sont plafonnées à la durée autorisée du niveau.
 */
export function computeReward(
  i: RewardInput,
  c: Pick<GameConfig, "base_rate_per_min" | "minutes_base" | "minutes_step" | "multiplier_step" | "max_level" | "parts_bonus_cap_pct" | "streak_bonus_pct" | "streak_bonus_cap_pct">,
): number {
  const minutes = Math.min(Math.max(i.validSeconds, 0) / 60, minutesForLevel(i.level, c));
  const parts = 1 + Math.min(Math.max(i.partsBonusPct, 0), c.parts_bonus_cap_pct) / 100;
  const streak = 1 + streakBonusPct(i.streakDays, c) / 100;
  const gross = minutes * c.base_rate_per_min * multiplierForLevel(i.level, c) * parts * streak * i.emissionFactor * Math.max(i.extraFactor ?? 1, 0);
  return Math.round(gross * 100) / 100;
}

/** Montant en $WALK (2 décimales) vers unités de base du jeton (decimals ≥ 2). */
export function walkToBaseUnits(amount: number, decimals: number): bigint {
  if (decimals < 2) throw new RangeError("decimals doit être ≥ 2");
  return BigInt(Math.round(amount * 100)) * 10n ** BigInt(decimals - 2);
}
