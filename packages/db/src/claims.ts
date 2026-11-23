import { type GameConfig, canClaim, claimFee, walkToBaseUnits } from "@walk/game";
import { Prisma, type PrismaClient } from "@prisma/client";

/** Solde réclamable : crédits confirmés moins les claims verrouillés ou réglés (en unités de base). */
export async function claimableOf(db: PrismaClient | Prisma.TransactionClient, userId: string): Promise<bigint> {
  const r = await db.$queryRaw<{ s: string }[]>`
    SELECT COALESCE(SUM(amount), 0)::text AS s FROM ledger_entries
    WHERE user_id = ${userId}::uuid AND status IN ('confirmed', 'locked', 'settled')`;
  return BigInt(r[0]?.s ?? "0");
}

export type CreateClaimResult =
  | { ok: true; claim: { id: string; amount: string; fee: string; net: string } }
  | { ok: false; reason: "paused" | "below_min" | "too_soon" | "banned" | "too_new"; nextAt?: Date };

/**
 * Crée un claim : verrouille le montant dans le grand livre (entrée négative « locked »), sous verrou de ligne sur le joueur
 * pour qu'un double clic ne puisse pas réclamer deux fois le même solde.
 */
export async function createClaim(
  prisma: PrismaClient, userId: string, cfg: GameConfig, decimals: number, now = new Date(),
): Promise<CreateClaimResult> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ status: string; created_at: Date; claim_exempt: boolean }[]>`SELECT status, created_at, claim_exempt FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
    if (locked[0]?.status === "banned") return { ok: false, reason: "banned" } as const;

    // Compte neuf : ancienneté minimale et nombre minimal de marches validées avant le premier retrait.
    const ageMs = now.getTime() - (locked[0]?.created_at?.getTime() ?? 0);
    const minAgeMs = cfg.claim_min_account_age_hours * 3_600_000;
    const validWalks = await tx.walk_sessions.count({ where: { user_id: userId, status: "valid" } });
    // Joueur en « mode test » (réglé par un admin) : ni ancienneté, ni marches minimales, ni limite de 24 h.
    const exempt = locked[0]?.claim_exempt === true;
    if (!exempt && (ageMs < minAgeMs || validWalks < cfg.claim_min_valid_walks)) {
      return { ok: false, reason: "too_new", nextAt: ageMs < minAgeMs ? new Date(now.getTime() + (minAgeMs - ageMs)) : undefined } as const;
    }

    const claimable = await claimableOf(tx, userId);
    const last = await tx.claims.findFirst({
      where: { user_id: userId, status: { in: ["queued", "sent", "confirmed"] } }, orderBy: { created_at: "desc" }, select: { created_at: true },
    });
    const check = canClaim({
      claimable, minBase: walkToBaseUnits(cfg.claim_min, decimals), paused: cfg.claims_paused, lastClaimAt: exempt ? null : last?.created_at ?? null, now,
    });
    if (!check.ok) return { ok: false, reason: check.reason as "paused" | "below_min" | "too_soon", nextAt: check.nextAt } as const;

    const fee = claimFee(claimable, cfg.claim_fee_pct);
    const claim = await tx.claims.create({
      data: { user_id: userId, amount: new Prisma.Decimal(claimable.toString()), fee: new Prisma.Decimal(fee.toString()), status: "queued" },
    });
    await tx.ledger_entries.create({
      data: { user_id: userId, kind: "claim", amount: new Prisma.Decimal((-claimable).toString()), status: "locked", ref_id: claim.id },
    });
    return { ok: true, claim: { id: claim.id, amount: claimable.toString(), fee: fee.toString(), net: (claimable - fee).toString() } } as const;
  });
}

/** Claim réglé : l'entrée verrouillée devient « settled » (le débit est définitif). */
export async function settleClaim(prisma: PrismaClient, claimId: string, signature: string) {
  await prisma.$transaction([
    prisma.claims.update({ where: { id: claimId }, data: { status: "confirmed", tx_signature: signature } }),
    prisma.ledger_entries.updateMany({ where: { ref_id: claimId, kind: "claim", status: "locked" }, data: { status: "settled", tx_signature: signature } }),
  ]);
}

/** Claim échoué définitivement : le montant est rendu au joueur (l'entrée verrouillée est annulée). */
export async function failClaim(prisma: PrismaClient, claimId: string) {
  await prisma.$transaction([
    prisma.claims.update({ where: { id: claimId }, data: { status: "failed" } }),
    prisma.ledger_entries.updateMany({ where: { ref_id: claimId, kind: "claim", status: "locked" }, data: { status: "cancelled" } }),
  ]);
}
