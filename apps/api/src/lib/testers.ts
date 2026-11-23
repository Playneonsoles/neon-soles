import { Prisma, audit, prisma } from "@walk/db";
import type { GameConfig } from "@walk/game";

/** Choix d'une chaussure de testeur : légendaire ou mythique (tirage selon tester_mythic_pct), niveau tiré entre min et max. */
async function pick(tx: Prisma.TransactionClient, cfg: GameConfig) {
  const wantMythic = Math.random() * 100 < cfg.tester_mythic_pct;
  const find = (rarity: string) => tx.shoe_models.findMany({ where: { rarity, active: true }, select: { code: true } });
  let pool = await find(wantMythic ? "mythic" : "legendary");
  if (pool.length === 0) pool = await find(wantMythic ? "legendary" : "mythic");
  if (pool.length === 0) return null;
  const model = pool[Math.floor(Math.random() * pool.length)]!.code;
  const lo = Math.min(cfg.tester_level_min, cfg.tester_level_max), hi = Math.max(cfg.tester_level_min, cfg.tester_level_max);
  const level = Math.min(cfg.max_level, lo + Math.floor(Math.random() * (hi - lo + 1)));
  return { model, level };
}

export const testerWindowOpen = (cfg: GameConfig, now = new Date()) => now.getTime() < new Date(cfg.tester_shoes_until).getTime();

/**
 * Offre la chaussure de testeur (une seule par compte, jamais deux fois : on regarde source = 'tester').
 * La chaussure est équipée ; la chaussure de départ reste dans l'inventaire.
 */
export async function grantTesterShoe(userId: string, cfg: GameConfig, byAdmin: string | null = null): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
    if ((await tx.shoes.count({ where: { owner_id: userId, source: "tester" } })) > 0) return false;
    const p = await pick(tx, cfg);
    if (!p) return false;
    await tx.shoes.updateMany({ where: { owner_id: userId, removed_at: null }, data: { is_equipped: false } });
    const s = await tx.shoes.create({ data: { owner_id: userId, model: p.model, level: p.level, is_equipped: true, source: "tester", granted_by: byAdmin } });
    if (byAdmin) await audit(tx, byAdmin, "shoe.tester", { userId, shoeId: s.id, model: p.model, level: p.level });
    return true;
  });
}
