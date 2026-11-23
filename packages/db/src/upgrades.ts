import type { PrismaClient } from "@prisma/client";

/**
 * Termine les améliorations arrivées à échéance (paresseux : appelé à chaque lecture des chaussures, de /me et au départ d'une marche).
 * Verrou de ligne + vérification dans la transaction : sans danger si deux appels arrivent en même temps.
 */
export async function settleUpgrades(db: PrismaClient, userId: string, now = new Date()): Promise<void> {
  const due = await db.shoes.findMany({ where: { owner_id: userId, removed_at: null, upgrading_until: { lte: now } }, select: { id: true } });
  for (const { id } of due) {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM shoes WHERE id = ${id}::uuid FOR UPDATE`;
      const s = await tx.shoes.findUnique({ where: { id } });
      if (!s?.upgrading_until || s.upgrading_until > now) return;
      const up = await tx.upgrades.findFirst({ where: { shoe_id: id, status: "running" }, orderBy: { created_at: "desc" } });
      await tx.shoes.update({ where: { id }, data: { level: up?.to_level ?? s.level + 1, upgrading_until: null } });
      if (up) await tx.upgrades.update({ where: { id: up.id }, data: { status: "done" } });
    });
  }
}
