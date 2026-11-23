import type { GameConfig } from "./config";

type C<K extends keyof GameConfig> = Pick<GameConfig, K>;

function checkLevel(n: number, maxLevel: number) {
  if (!Number.isInteger(n) || n < 1 || n > maxLevel) throw new RangeError(`Niveau invalide : ${n}`);
}

/** minutes(n) = minutes_base + minutes_step × (n − 1) */
export function minutesForLevel(n: number, c: C<"minutes_base" | "minutes_step" | "max_level">): number {
  checkLevel(n, c.max_level);
  return c.minutes_base + c.minutes_step * (n - 1);
}

/** multiplicateur(n) = 1 + multiplier_step × (n − 1) */
export function multiplierForLevel(n: number, c: C<"multiplier_step" | "max_level">): number {
  checkLevel(n, c.max_level);
  return 1 + c.multiplier_step * (n - 1);
}

/** coût(n → n+1) = cost_base × cost_growth^(n−1), arrondi à l'unité de $WALK. */
export function upgradeCost(n: number, c: C<"cost_base" | "cost_growth" | "max_level">): number {
  checkLevel(n, c.max_level - 1);
  return Math.round(c.cost_base * Math.pow(c.cost_growth, n - 1));
}

/** temps d'amélioration(n) = upgrade_minutes_factor × n² minutes. */
export function upgradeMinutes(n: number, c: C<"upgrade_minutes_factor" | "max_level">): number {
  checkLevel(n, c.max_level - 1);
  return c.upgrade_minutes_factor * n * n;
}

/** Vitesse moyenne minimale exigée (km/h), hors tolérance de l'amortisseur. */
export function minSpeedForLevel(n: number, c: C<"min_speed_kmh" | "min_speed_step_kmh" | "max_level">): number {
  checkLevel(n, c.max_level);
  return Math.round((c.min_speed_kmh + c.min_speed_step_kmh * (n - 1)) * 100) / 100;
}

/** Bonus de série en % : streak_bonus_pct par jour, plafonné à streak_bonus_cap_pct. */
export function streakBonusPct(streakDays: number, c: C<"streak_bonus_pct" | "streak_bonus_cap_pct">): number {
  return Math.min(Math.max(streakDays, 0) * c.streak_bonus_pct, c.streak_bonus_cap_pct);
}

/** Facteur d'émission en mode auto (paliers selon les joueurs actifs sur 7 jours) ou manuel. */
export function emissionFactor(
  activePlayers7d: number,
  c: C<"emission_mode" | "emission_manual_factor" | "emission_tiers">,
): number {
  if (c.emission_mode === "manual") return c.emission_manual_factor;
  for (const t of c.emission_tiers) {
    if (t.max_players === null || activePlayers7d <= t.max_players) return t.factor;
  }
  return c.emission_tiers.at(-1)?.factor ?? 1;
}

/** Convertit un montant de $WALK (entier) en unités de base du jeton. */
export function toBaseUnits(amount: number, decimals: number): bigint {
  if (!Number.isInteger(amount)) throw new RangeError("Montant entier attendu");
  return BigInt(amount) * 10n ** BigInt(decimals);
}

/** Répartition d'une dépense selon des pourcentages entiers ; le reste d'arrondi va au dernier poste. */
export function splitAmount(total: bigint, pcts: readonly number[]): bigint[] {
  const sum = pcts.reduce((a, b) => a + b, 0);
  if (sum !== 100) throw new RangeError("La répartition doit totaliser 100 %");
  const parts = pcts.map((p) => (total * BigInt(p)) / 100n);
  const rest = total - parts.reduce((a, b) => a + b, 0n);
  parts[parts.length - 1] = (parts[parts.length - 1] as bigint) + rest;
  return parts;
}

/**
 * Durée maximale d'UNE session, en secondes. Le temps de marche rémunéré par jour (minutes(n)) est réparti
 * sur `daily_session_limit` sessions : plus on autorise de sessions, plus elles sont courtes, et les gains
 * quotidiens possibles restent ceux du tableau de la section 5 (donc budget et coûts d'amélioration inchangés).
 */
export function sessionMaxSeconds(
  n: number,
  c: Pick<GameConfig, "minutes_base" | "minutes_step" | "max_level" | "daily_session_limit">,
): number {
  return Math.round((minutesForLevel(n, c) * 60) / c.daily_session_limit);
}

/** Chance de coffre PAR SESSION en % : le tirage de la section 8 (8 %) s'entend par jour, donc divisé par le nombre de sessions. */
export function chestChancePerSession(c: Pick<GameConfig, "chest_rates" | "daily_session_limit">): number {
  return Math.round((c.chest_rates.session_chance_pct / c.daily_session_limit) * 100) / 100;
}
