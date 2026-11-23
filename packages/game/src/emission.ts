/** Prorata en points de base (10 000 = 100 %) : tous les gains du jour sont réduits si le budget est dépassé. */
export function prorataBp(earnedRaw: bigint, cap: bigint): bigint {
  if (earnedRaw <= 0n || earnedRaw <= cap) return 10_000n;
  return (cap * 10_000n) / earnedRaw;
}

/** Montant confirmé après prorata (arrondi vers le bas : jamais plus que le budget). */
export function applyProrata(amount: bigint, bp: bigint): bigint {
  return (amount * bp) / 10_000n;
}

/** Coupe-circuit : les claims sont mis en pause si les sorties de la dernière heure dépassent `multiplier` × la moyenne horaire. */
export function breakerTripped(
  lastHourOut: bigint,
  avgHourlyOut: bigint,
  multiplier: number,
  floor: bigint,
): boolean {
  if (lastHourOut <= floor) return false; // pas de déclenchement sur de petits montants (lancement)
  const limit = (avgHourlyOut * BigInt(Math.round(multiplier * 100))) / 100n;
  return lastHourOut > limit;
}
