import { describe, expect, it } from "vitest";
import { applyProrata, breakerTripped, prorataBp } from "../src/emission";
import { canClaim, claimFee } from "../src/claims";

const W = 1_000_000n; // 1 $WALK avec 6 décimales

describe("prorata du budget quotidien", () => {
  it("pas de réduction sous le budget", () => expect(prorataBp(5_000n * W, 6_000n * W)).toBe(10_000n));
  it("7 200 gagnés pour 6 000 de budget → 83,33 %", () => {
    const bp = prorataBp(7_200n * W, 6_000n * W);
    expect(bp).toBe(8_333n);
    expect(applyProrata(100n * W, bp)).toBe(83_330_000n);
  });
  it("la somme confirmée ne dépasse jamais le budget", () => {
    const bp = prorataBp(7_200n * W, 6_000n * W);
    const parts = [1_234_567n, 999_999_999n, 3_000_000_000n, 3_000_000_001n];
    const earned = parts.reduce((a, b) => a + b, 0n);
    const cap = earned - 500_000_000n;
    const b2 = prorataBp(earned, cap);
    const confirmed = parts.map((p) => applyProrata(p, b2)).reduce((a, b) => a + b, 0n);
    expect(confirmed <= cap).toBe(true);
    expect(bp > 0n).toBe(true);
  });
  it("aucun gain : 100 %", () => expect(prorataBp(0n, 6_000n * W)).toBe(10_000n));
});

describe("coupe-circuit", () => {
  it("ne se déclenche pas sous le plancher", () => expect(breakerTripped(900n * W, 10n * W, 3, 1_000n * W)).toBe(false));
  it("se déclenche au-dessus de 3 × la moyenne", () => expect(breakerTripped(4_000n * W, 1_000n * W, 3, 1_000n * W)).toBe(true));
  it("reste calme à 3 × la moyenne exactement", () => expect(breakerTripped(3_000n * W, 1_000n * W, 3, 1_000n * W)).toBe(false));
});

describe("claims", () => {
  it("frais de 2 %", () => expect(claimFee(100n * W, 2)).toBe(2n * W));
  it("frais arrondis vers le haut", () => expect(claimFee(101n, 2)).toBe(3n));
  it("refuse sous le minimum", () => {
    expect(canClaim({ claimable: 49n * W, minBase: 50n * W, paused: false, lastClaimAt: null, now: new Date() }).reason).toBe("below_min");
  });
  it("refuse pendant la pause", () => {
    expect(canClaim({ claimable: 90n * W, minBase: 50n * W, paused: true, lastClaimAt: null, now: new Date() }).reason).toBe("paused");
  });
  it("une fois par 24 h", () => {
    const now = new Date("2026-11-22T12:00:00Z");
    const r = canClaim({ claimable: 90n * W, minBase: 50n * W, paused: false, lastClaimAt: new Date("2026-11-22T00:00:00Z"), now });
    expect(r.reason).toBe("too_soon");
    expect(r.nextAt?.toISOString()).toBe("2026-11-23T00:00:00.000Z");
  });
  it("accepte un claim valide", () => {
    expect(canClaim({ claimable: 90n * W, minBase: 50n * W, paused: false, lastClaimAt: null, now: new Date() }).ok).toBe(true);
  });
});
