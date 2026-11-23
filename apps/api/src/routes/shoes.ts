import { prisma, settleUpgrades } from "@walk/db";
import { repairCost, resolveShoeVisual, upgradeCost, upgradeMinutes, wearRewardFactor } from "@walk/game";
import { getConfigs } from "../lib/config";
import type { FastifyInstance } from "fastify";

export async function shoeRoutes(app: FastifyInstance) {
  // Jeu sans NFT : les chaussures et collectables sont des lignes en base, affichées par le site et l'application.
  app.get("/shoes", { preHandler: app.authenticate }, async (req) => {
    const { game } = await getConfigs();
    await settleUpgrades(prisma, req.user.sub);
    const [shoes, items, models, catalog] = await Promise.all([
      prisma.shoes.findMany({ where: { owner_id: req.user.sub, removed_at: null }, orderBy: { level: "desc" } }),
      prisma.user_collectibles.findMany({ where: { user_id: req.user.sub, removed_at: null }, orderBy: { created_at: "desc" } }),
      prisma.shoe_models.findMany(),
      prisma.collectibles.findMany(),
    ]);
    const model = (c: string) => models.find((m) => m.code === c);
    return {
      shoes: shoes.map((s) => ({
        id: s.id, model: s.model, model_name: model(s.model)?.name ?? s.model, rarity: model(s.model)?.rarity ?? "common",
        image_key: model(s.model)?.image_key ?? null, level: s.level, is_equipped: s.is_equipped,
        upgrading_until: s.upgrading_until, source: s.source, visual: resolveShoeVisual(s.level, s.attributes),
        durability: Number(s.durability), reward_factor: wearRewardFactor(Number(s.durability), game),
        repair_cost_walk: repairCost(s.level, Math.ceil(100 - Number(s.durability)), game),
        listed: s.listing_id !== null,
        upgrade: s.level >= game.max_level ? null : { to_level: s.level + 1, cost_walk: upgradeCost(s.level, game), minutes: upgradeMinutes(s.level, game) },
      })),
      collectibles: items.map((i) => {
        const c = catalog.find((x) => x.code === i.collectible_code);
        return { id: i.id, code: i.collectible_code, name: c?.name ?? i.collectible_code, kind: c?.kind ?? "other", rarity: c?.rarity ?? "common", image_key: c?.image_key ?? null };
      }),
      craft_min_level: game.craft_min_level,
      parts: [], // pièces équipées : lot 4
    };
  });
}
