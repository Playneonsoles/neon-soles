import { type GameConfig } from "@walk/game";
import { Prisma, type PrismaClient } from "@prisma/client";
import { randomInt } from "node:crypto";

type Db = PrismaClient | Prisma.TransactionClient;
export type Gift = { type: "walk"; amount: string } | { type: "collectible"; code: string; name: string; rarity: string } | { type: "shoe"; model: string; name: string; level: number; rarity: string };

/** Tirage au sort : entier uniforme dans [0, n). */
const rnd = (n: number) => randomInt(0, Math.max(1, n));

/**
 * Cadeau aléatoire après une marche validée. Maximum `gift_max_per_day` par joueur sur 24 h.
 * Soit des $WALK bonus (une part du gain de la marche, confirmés tout de suite), soit un objet de collection que le joueur n'a pas encore.
 */
export async function rollGift(tx: Db, o: { userId: string; sessionId: string; reward: bigint }, cfg: GameConfig): Promise<Gift | null> {
  if (!cfg.gift_enabled || cfg.gift_chance_pct <= 0 || cfg.gift_max_per_day <= 0) return null;
  if (rnd(10_000) >= Math.round(cfg.gift_chance_pct * 100)) return null;
  const recent = await tx.ledger_entries.count({ where: { user_id: o.userId, kind: "gift", created_at: { gte: new Date(Date.now() - 86_400_000) } } });
  const recentItems = await tx.user_collectibles.count({ where: { user_id: o.userId, granted_by: null, created_at: { gte: new Date(Date.now() - 86_400_000) } } });
  if (recent + recentItems >= cfg.gift_max_per_day) return null;

  const shoe = await rollShoeGift(tx, o.userId, cfg);
  if (shoe) return shoe;

  if (rnd(10_000) < Math.round(cfg.gift_collectible_pct * 100)) {
    const owned = (await tx.user_collectibles.findMany({ where: { user_id: o.userId, removed_at: null }, select: { collectible_code: true } })).map((c) => c.collectible_code);
    const pool = await tx.collectibles.findMany({ where: { active: true, code: { notIn: owned } } });
    if (pool.length) {
      const c = pool[rnd(pool.length)]!;
      await tx.user_collectibles.create({ data: { user_id: o.userId, collectible_code: c.code } });
      return { type: "collectible", code: c.code, name: c.name, rarity: c.rarity };
    }
  }
  const lo = Math.round(cfg.gift_walk_min_pct * 100), hi = Math.max(lo, Math.round(cfg.gift_walk_max_pct * 100));
  const pct = BigInt(lo + rnd(hi - lo + 1)); // en centièmes de %
  let amount = (o.reward * pct) / 10_000n;
  if (amount <= 0n) return null;
  await tx.ledger_entries.create({ data: { user_id: o.userId, kind: "gift", amount: new Prisma.Decimal(amount.toString()), status: "confirmed", ref_id: o.sessionId } });
  return { type: "walk", amount: amount.toString() };
}

/**
 * Cadeau de chaussures, jusqu'à `gift_shoe_until` : une seule paire offerte par compte (source = 'gift'),
 * niveau au hasard entre 1 et `gift_shoe_level_max`, rareté tirée selon `gift_shoe_rarity_weights`
 * (jamais mythique : seules les raretés listées dans les poids sont possibles). La paire est ajoutée à l'inventaire, non équipée.
 */
async function rollShoeGift(tx: Db, userId: string, cfg: GameConfig): Promise<Gift | null> {
  if (Date.now() >= new Date(cfg.gift_shoe_until).getTime() || cfg.gift_shoe_chance_pct <= 0) return null;
  if (rnd(10_000) >= Math.round(cfg.gift_shoe_chance_pct * 100)) return null;
  if ((await tx.shoes.count({ where: { owner_id: userId, source: "gift" } })) > 0) return null;
  const allowed = Object.entries(cfg.gift_shoe_rarity_weights).filter(([r, w]) => w > 0 && r !== "mythic");
  const models = await tx.shoe_models.findMany({ where: { active: true, rarity: { in: allowed.map(([r]) => r) } } });
  const byRarity = allowed.map(([r, w]) => ({ r, w, list: models.filter((m) => m.rarity === r) })).filter((x) => x.list.length > 0);
  const total = byRarity.reduce((a, x) => a + x.w, 0);
  if (total <= 0) return null;
  let roll = randomInt(0, Math.round(total * 100)) / 100;
  const pick = byRarity.find((x) => (roll -= x.w) < 0) ?? byRarity[byRarity.length - 1]!;
  const model = pick.list[rnd(pick.list.length)]!;
  const level = 1 + rnd(Math.min(cfg.gift_shoe_level_max, cfg.max_level));
  await tx.shoes.create({ data: { owner_id: userId, model: model.code, level, is_equipped: false, source: "gift" } });
  return { type: "shoe", model: model.code, name: model.name, level, rarity: model.rarity };
}
