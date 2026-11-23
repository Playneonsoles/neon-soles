import { describe, expect, it } from "vitest";
import { forgeCostLamports, forgeCostWalk } from "../src/forge";

const c = { base_rate_per_min: 20, minutes_base: 5, minutes_step: 0.5, multiplier_step: 0.1, max_level: 20, daily_session_limit: 4,
  forge_sol: 0.03, forge_sol_growth: 1.3, forge_easy_max_level: 5, forge_walk_days_easy: 0.1, forge_walk_days_growth: 1.3 };

describe("forge", () => {
  it("niveau 1 -> 2 : 0,03 SOL et une petite fraction des gains d'une journée", () => {
    expect(forgeCostLamports(1, c)).toBe(30_000_000n);
    expect(forgeCostWalk(1, c)).toBe(40);
  });
  it("prix SOL constant jusqu'au niveau 5, puis croissant", () => {
    for (const n of [1, 2, 3, 4]) expect(forgeCostLamports(n, c)).toBe(30_000_000n);
    expect(forgeCostLamports(5, c)).toBeGreaterThan(30_000_000n);
    expect(forgeCostLamports(10, c)).toBeGreaterThan(forgeCostLamports(5, c));
  });
  it("le coût en $WALK suit les gains et augmente à chaque niveau", () => {
    let prev = 0;
    for (let n = 1; n < 20; n++) { const w = forgeCostWalk(n, c); expect(w).toBeGreaterThan(prev); prev = w; }
    expect(forgeCostWalk(1, { ...c, base_rate_per_min: 2 })).toBe(4);
  });
});
