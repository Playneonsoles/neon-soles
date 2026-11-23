import { describe, expect, it } from "vitest";
import { repairCost, wearAfterWalk, wearRewardFactor } from "../src/wear";

const cfg = { shoe_wear_enabled: true, shoe_wear_per_walk: 1, shoe_worn_threshold: 25, shoe_worn_reward_pct: 85, shoe_broken_reward_pct: 60, shoe_repair_base_cost: 10, shoe_repair_level_growth: 1.5 };

describe("usure", () => {
  it("perd peu à chaque marche et ne descend jamais sous 0", () => {
    expect(wearAfterWalk(100, cfg)).toBe(99);
    expect(wearAfterWalk(0.5, cfg)).toBe(0);
  });
  it("désactivable depuis la config", () => {
    expect(wearAfterWalk(50, { ...cfg, shoe_wear_enabled: false })).toBe(50);
    expect(wearRewardFactor(0, { ...cfg, shoe_wear_enabled: false })).toBe(1);
  });
  it("gain complet tant que la chaussure est au-dessus du seuil, jamais nul même cassée", () => {
    expect(wearRewardFactor(100, cfg)).toBe(1);
    expect(wearRewardFactor(25, cfg)).toBe(1);
    expect(wearRewardFactor(0, cfg)).toBeCloseTo(0.6);
    expect(wearRewardFactor(12.5, cfg)).toBeCloseTo(0.725);
  });
});

describe("coût de réparation", () => {
  it("proportionnel aux points rendus, croît avec le niveau, minimum 1", () => {
    expect(repairCost(1, 100, cfg)).toBe(10);
    expect(repairCost(1, 50, cfg)).toBe(5);
    expect(repairCost(3, 100, cfg)).toBe(23); // 10 × 1.5² = 22.5 → 23
    expect(repairCost(1, 1, cfg)).toBe(1);
    expect(repairCost(5, 0, cfg)).toBe(0);
  });
});
