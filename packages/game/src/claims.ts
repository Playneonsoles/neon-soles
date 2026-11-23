/** Frais de claim en unités de base (pourcentage entier ou décimal, arrondi vers le haut au profit du pool). */
export function claimFee(gross: bigint, feePct: number): bigint {
  const bp = BigInt(Math.round(feePct * 100));
  const raw = gross * bp;
  return raw === 0n ? 0n : (raw + 9_999n) / 10_000n;
}

export interface ClaimCheck {
  ok: boolean;
  reason: "ok" | "paused" | "below_min" | "too_soon";
  nextAt?: Date;
}

/** Règles de la section 6.4 : pas en pause, minimum de claim, une fois par 24 h. */
export function canClaim(i: {
  claimable: bigint;
  minBase: bigint;
  paused: boolean;
  lastClaimAt: Date | null;
  now: Date;
}): ClaimCheck {
  if (i.paused) return { ok: false, reason: "paused" };
  if (i.lastClaimAt) {
    const next = new Date(i.lastClaimAt.getTime() + 24 * 3_600_000);
    if (i.now < next) return { ok: false, reason: "too_soon", nextAt: next };
  }
  if (i.claimable < i.minBase) return { ok: false, reason: "below_min" };
  return { ok: true, reason: "ok" };
}

/** Un claim « envoyé » n'est renvoyé qu'après ce délai : la première transaction a alors forcément expiré (pas de double paiement). */
export const RESEND_AFTER_MS = 3 * 60_000;
export const MAX_CLAIM_ATTEMPTS = 3;
