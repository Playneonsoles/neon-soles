import { describe, expect, it } from "vitest";
import { computeReward, walkToBaseUnits } from "../src/rewards";
import { addDays, effectiveStreak, nextStreak, parisDay } from "../src/time";

const c = {
  base_rate_per_min: 2, minutes_base: 5, minutes_step: 0.5, multiplier_step: 0.1, max_level: 20,
  parts_bonus_cap_pct: 60, streak_bonus_pct: 2, streak_bonus_cap_pct: 20,
};
const i = { validSeconds: 300, level: 1, partsBonusPct: 0, streakDays: 0, emissionFactor: 1 };

describe("gains (section 5 et 6.1)", () => {
  it("niveau 1 : 10 $WALK pour 5 min sans bonus", () => expect(computeReward(i, c)).toBe(10));
  it("niveau 20 : ~84 $WALK pour 14,5 min", () => expect(computeReward({ ...i, level: 20, validSeconds: 870 }, c)).toBe(84.1));
  it("facteur d'émission ×2 au lancement", () => expect(computeReward({ ...i, emissionFactor: 2 }, c)).toBe(20));
  it("série : +2 % par jour, plafond +20 %", () => {
    expect(computeReward({ ...i, streakDays: 5 }, c)).toBe(11);
    expect(computeReward({ ...i, streakDays: 30 }, c)).toBe(12);
  });
  it("bonus de pièces plafonné à +60 %", () => expect(computeReward({ ...i, partsBonusPct: 200 }, c)).toBe(16));
  it("les minutes sont plafonnées à la durée du niveau", () => expect(computeReward({ ...i, validSeconds: 3600 }, c)).toBe(10));
  it("conversion en unités de base", () => {
    expect(walkToBaseUnits(10.25, 6)).toBe(10_250_000n);
    expect(walkToBaseUnits(0.01, 9)).toBe(10_000_000n);
  });
});

describe("jour de jeu et série", () => {
  it("minuit se calcule à l'heure de Paris", () => {
    expect(parisDay(new Date("2026-11-22T22:59:00Z"))).toBe("2026-11-22");
    expect(parisDay(new Date("2026-11-22T23:01:00Z"))).toBe("2026-11-23");
    expect(parisDay(new Date("2026-07-01T22:30:00Z"))).toBe("2026-07-02"); // été : UTC+2
  });
  it("jours", () => expect(addDays("2026-02-28", 1)).toBe("2026-03-01"));
  it("série qui continue, se remet à 1 ou reste la même", () => {
    expect(nextStreak(null, "2026-11-22", 0)).toBe(1);
    expect(nextStreak("2026-11-21", "2026-11-22", 4)).toBe(5);
    expect(nextStreak("2026-11-20", "2026-11-22", 4)).toBe(1);
    expect(nextStreak("2026-11-22", "2026-11-22", 4)).toBe(4);
  });
  it("série affichée à 0 après un jour manqué", () => {
    expect(effectiveStreak("2026-11-21", "2026-11-22", 4)).toBe(4);
    expect(effectiveStreak("2026-11-19", "2026-11-22", 4)).toBe(0);
    expect(effectiveStreak(null, "2026-11-22", 0)).toBe(0);
  });
});
