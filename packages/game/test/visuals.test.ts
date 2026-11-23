import { describe, expect, it } from "vitest";
import { VISUAL_TIERS, visualTierForLevel } from "../src";

describe("visuels par niveau", () => {
  it("niveau 1 : aucun effet ; niveau 20 : tous", () => {
    expect(visualTierForLevel(1).effects).toHaveLength(0);
    expect(visualTierForLevel(20).effects).toContain("halo");
  });
  it("les effets ne font que s'ajouter", () => {
    for (let i = 1; i < VISUAL_TIERS.length; i++) {
      const prev = VISUAL_TIERS[i - 1]!.effects;
      expect(VISUAL_TIERS[i]!.effects.length).toBeGreaterThan(prev.length);
      for (const e of prev) expect(VISUAL_TIERS[i]!.effects).toContain(e);
    }
  });
  it("borne les niveaux hors plage", () => {
    expect(visualTierForLevel(0).name).toBe("Starter");
    expect(visualTierForLevel(99).name).toBe("Legend");
  });
});
