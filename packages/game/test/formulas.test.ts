import { describe, expect, it } from "vitest";
import {
  emissionFactor, minSpeedForLevel, minutesForLevel, multiplierForLevel,
  splitAmount, streakBonusPct, toBaseUnits, upgradeCost, upgradeMinutes,
} from "../src";

// Valeurs de départ de game_config (migration 0002).
const c = {
  base_rate_per_min: 2, minutes_base: 5, minutes_step: 0.5, multiplier_step: 0.1, max_level: 20,
  cost_base: 20, cost_growth: 1.38, upgrade_minutes_factor: 10,
  min_speed_kmh: 3, min_speed_step_kmh: 0.1, streak_bonus_pct: 2, streak_bonus_cap_pct: 20,
  emission_mode: "auto" as const, emission_manual_factor: 1,
  emission_tiers: [
    { max_players: 200, factor: 2 }, { max_players: 500, factor: 1.5 },
    { max_players: 2000, factor: 1.2 }, { max_players: null, factor: 1 },
  ],
};

describe("formules de la section 5", () => {
  it("minutes par jour : 5 au niveau 1, 14,5 au niveau 20", () => {
    expect(minutesForLevel(1, c)).toBe(5);
    expect(minutesForLevel(20, c)).toBe(14.5);
  });
  it("multiplicateur : ×1,0 au niveau 1, ×2,9 au niveau 20", () => {
    expect(multiplierForLevel(1, c)).toBe(1);
    expect(multiplierForLevel(20, c)).toBeCloseTo(2.9, 10);
  });
  it("coûts du tableau (niveaux 1→2, 5→6, 10→11, 19→20)", () => {
    expect(upgradeCost(1, c)).toBe(20);
    expect(upgradeCost(2, c)).toBe(28);
    expect(upgradeCost(5, c)).toBe(73);
    expect(upgradeCost(10, c)).toBe(363);
    expect(upgradeCost(19, c)).toBe(6590);
  });
  it("coût total 1→20 d'environ 23 900 $WALK", () => {
    let total = 0;
    for (let n = 1; n < 20; n++) total += upgradeCost(n, c);
    expect(total).toBeGreaterThan(23_800);
    expect(total).toBeLessThan(24_000);
  });
  it("temps d'amélioration : 10 min, 40 min, 1 h 30, 60 h 10", () => {
    expect(upgradeMinutes(1, c)).toBe(10);
    expect(upgradeMinutes(2, c)).toBe(40);
    expect(upgradeMinutes(3, c)).toBe(90);
    expect(upgradeMinutes(19, c)).toBe(3610);
  });
  it("vitesse minimale : 3 km/h au niveau 1, 4,9 au niveau 20", () => {
    expect(minSpeedForLevel(1, c)).toBe(3);
    expect(minSpeedForLevel(20, c)).toBe(4.9);
  });
  it("rejette les niveaux hors bornes", () => {
    expect(() => minutesForLevel(0, c)).toThrow();
    expect(() => upgradeCost(20, c)).toThrow();
  });
});

describe("série et émission", () => {
  it("bonus de série +2 %/jour plafonné à +20 %", () => {
    expect(streakBonusPct(0, c)).toBe(0);
    expect(streakBonusPct(5, c)).toBe(10);
    expect(streakBonusPct(10, c)).toBe(20);
    expect(streakBonusPct(40, c)).toBe(20);
  });
  it("facteur d'émission par paliers", () => {
    expect(emissionFactor(0, c)).toBe(2);
    expect(emissionFactor(200, c)).toBe(2);
    expect(emissionFactor(201, c)).toBe(1.5);
    expect(emissionFactor(1000, c)).toBe(1.2);
    expect(emissionFactor(5000, c)).toBe(1);
  });
  it("mode manuel", () => {
    expect(emissionFactor(5000, { ...c, emission_mode: "manual", emission_manual_factor: 3 })).toBe(3);
  });
});

describe("montants en unités de base", () => {
  it("conversion avec décimales", () => {
    expect(toBaseUnits(20, 6)).toBe(20_000_000n);
  });
  it("répartition 40/40/20 sans perte", () => {
    const [burn, pool, treasury] = splitAmount(toBaseUnits(28, 6), [40, 40, 20]) as [bigint, bigint, bigint];
    expect(burn + pool + treasury).toBe(28_000_000n);
    expect(burn).toBe(11_200_000n);
  });
  it("le reste d'arrondi va au dernier poste", () => {
    const parts = splitAmount(101n, [40, 40, 20]);
    expect(parts.reduce((a, b) => a + b, 0n)).toBe(101n);
  });
  it("refuse une répartition qui ne fait pas 100", () => {
    expect(() => splitAmount(100n, [40, 40, 10])).toThrow();
  });
});
