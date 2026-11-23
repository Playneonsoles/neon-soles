import type { GameConfig } from "./config";
import { minutesForLevel, multiplierForLevel } from "./formulas";

type C = Pick<GameConfig, "base_rate_per_min" | "minutes_base" | "minutes_step" | "multiplier_step" | "max_level" | "daily_session_limit"
  | "forge_sol" | "forge_sol_growth" | "forge_easy_max_level" | "forge_walk_days_easy" | "forge_walk_days_growth">;

/** Gains d'une journée complète d'une chaussure de niveau n (sans bonus) : c'est la base du prix de la forge. */
export function dailyEarning(n: number, c: C): number {
  return c.base_rate_per_min * minutesForLevel(n, c) * multiplierForLevel(n, c) * c.daily_session_limit;
}

/** Facteur de renchérissement : 1 jusqu'au niveau forge_easy_max_level (très accessible), puis croissant à chaque niveau visé. */
function steepness(target: number, growth: number, easyMax: number): number {
  return target <= easyMax ? 1 : Math.pow(growth, target - easyMax);
}

/** Coût en $WALK pour forger 3 chaussures de niveau n en 1 de niveau n+1 : une fraction des gains d'une journée, puis de plus en plus. */
export function forgeCostWalk(n: number, c: C): number {
  const days = c.forge_walk_days_easy * steepness(n + 1, c.forge_walk_days_growth, c.forge_easy_max_level);
  return Math.max(1, Math.round(dailyEarning(n, c) * days));
}

/** Coût en lamports (SOL) pour la même forge : forge_sol jusqu'au niveau 5, puis croissant. */
export function forgeCostLamports(n: number, c: C): bigint {
  return BigInt(Math.round(c.forge_sol * steepness(n + 1, c.forge_sol_growth, c.forge_easy_max_level) * 1e9));
}
