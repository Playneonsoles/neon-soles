import { Prisma, prisma, settleUpgrades } from "@walk/db";
import { forgeCostLamports, forgeCostWalk, splitAmount, toBaseUnits, upgradeCost, upgradeMinutes } from "@walk/game";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { getConfigs } from "../lib/config";
import { ata, chainParams, checkPayment, newNonce } from "../lib/payments";

const uuid = z.object({ id: z.string().uuid() });
const sig = z.object({ signature: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,88}$/) });
const err = (r: FastifyReply, s: number, error: string, message: string) => r.code(s).send({ error, message });
export const RARITY_ORDER = ["common", "rare", "epic", "legendary", "mythic"] as const;

/** Améliorer, équiper et fusionner (craft) les chaussures. Les paiements sont vérifiés sur la blockchain, comme la boutique. */
export async function upgradeRoutes(app: FastifyInstance) {
  const player = async (req: FastifyRequest, reply: FastifyReply) => {
    await app.authenticate(req, reply);
    if (reply.sent) return;
    const u = await prisma.users.findUnique({ where: { id: req.user.sub }, select: { profile_completed_at: true } });
    if (!u?.profile_completed_at) return err(reply, 409, "profile_incomplete", "Create your character first.");
  };
  const opts = { preHandler: player, config: { rateLimit: { max: 0 /* REDACTED */, timeWindow: "1 minute" } } };
  const chain = () => chainParams(app.env);

  // ---------- Équiper ----------
  app.post("/shoes/:id/equip", opts, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const ok = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${req.user.sub}::uuid FOR UPDATE`;
      const shoe = await tx.shoes.findFirst({ where: { id, owner_id: req.user.sub, removed_at: null, listing_id: null } });
      if (!shoe) return false;
      await tx.shoes.updateMany({ where: { owner_id: req.user.sub, removed_at: null }, data: { is_equipped: false } });
      await tx.shoes.update({ where: { id }, data: { is_equipped: true } });
      return true;
    });
    return ok ? { ok: true } : err(reply, 404, "not_found", "Shoe not found, or it is listed on the market.");
  });

  // ---------- Améliorer : commande puis confirmation du paiement ----------
  app.post("/shoes/:id/upgrade/order", opts, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const c = chain();
    if (!c) return err(reply, 503, "chain_unavailable", "Payments are not open yet.");
    const { game } = await getConfigs();
    await settleUpgrades(prisma, req.user.sub);
    const shoe = await prisma.shoes.findFirst({ where: { id, owner_id: req.user.sub, removed_at: null } });
    if (!shoe) return err(reply, 404, "not_found", "Shoe not found.");
    if (shoe.listing_id) return err(reply, 409, "listed", "This shoe is listed on the market.");
    if (shoe.upgrading_until && shoe.upgrading_until > new Date()) return err(reply, 409, "already_upgrading", "This shoe is already being upgraded.");
    if (shoe.level >= game.max_level) return err(reply, 409, "max_level", "This shoe is already at the maximum level.");
    const price = upgradeCost(shoe.level, game), minutes = upgradeMinutes(shoe.level, game);
    const nonce = newNonce();
    const [burn, pool, treasury] = splitAmount(toBaseUnits(price, c.decimals), game.split_upgrade);
    const buyer = await prisma.users.findUniqueOrThrow({ where: { id: req.user.sub } });
    const up = await prisma.upgrades.create({
      data: {
        shoe_id: shoe.id, user_id: req.user.sub, from_level: shoe.level, to_level: shoe.level + 1, cost: new Prisma.Decimal(price),
        burned: new Prisma.Decimal(burn.toString()), to_pool: new Prisma.Decimal(pool.toString()), to_treasury: new Prisma.Decimal(treasury.toString()),
        nonce, expires_at: new Date(Date.now() + 10 * 60_000), status: "awaiting_tx",
      },
    });
    return {
      order_id: up.id, price_walk: price, minutes, to_level: shoe.level + 1, payer: buyer.wallet, mint: c.mint, token_program: c.tokenProgram, decimals: c.decimals,
      memo: `walk:upgrade:${up.id}:${nonce}`, expires_at: up.expires_at, burn_base: String(burn),
      transfers: [{ to_ata: ata(c.mint, c.pool, c.tokenProgram), owner: c.pool, amount_base: String(pool) }, { to_ata: ata(c.mint, c.treasury, c.tokenProgram), owner: c.treasury, amount_base: String(treasury) }],
    };
  });

  app.post("/upgrade/orders/:id/confirm", opts, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const { signature } = sig.parse(req.body);
    const c = chain();
    if (!c) return err(reply, 503, "chain_unavailable", "Payments are not open yet.");
    const { game } = await getConfigs();
    const up = await prisma.upgrades.findUnique({ where: { id } });
    if (!up || up.user_id !== req.user.sub || !up.shoe_id || !up.nonce) return err(reply, 404, "not_found", "Order not found.");
    if (up.status !== "awaiting_tx") return up.tx_signature === signature ? { ok: true } : err(reply, 409, "closed", "This order is closed.");
    const buyer = await prisma.users.findUniqueOrThrow({ where: { id: req.user.sub } });
    // Montants recalculés depuis le prix figé de la commande.
    const [burn, pool, treasury] = [BigInt(up.burned?.toFixed(0) ?? "0"), BigInt(up.to_pool?.toFixed(0) ?? "0"), BigInt(up.to_treasury?.toFixed(0) ?? "0")];
    const check = await checkPayment(c.rpc, signature, {
      payer: buyer.wallet, mint: c.mint, burnBase: burn,
      transfers: [{ destinationAta: ata(c.mint, c.pool, c.tokenProgram), amountBase: pool }, { destinationAta: ata(c.mint, c.treasury, c.tokenProgram), amountBase: treasury }],
      memo: `walk:upgrade:${up.id}:${up.nonce}`,
    }).catch(() => ({ ok: false as const, reason: "Blockchain unreachable, try again in a moment." }));
    if (!check.ok) return err(reply, 402, "payment_not_verified", check.reason);
    try {
      const done = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM shoes WHERE id = ${up.shoe_id}::uuid FOR UPDATE`;
        const shoe = await tx.shoes.findUnique({ where: { id: up.shoe_id! } });
        if (!shoe || shoe.removed_at || shoe.level !== up.from_level || (shoe.upgrading_until && shoe.upgrading_until > new Date())) return false;
        const fresh = await tx.upgrades.updateMany({ where: { id, status: "awaiting_tx" }, data: { status: "running", tx_signature: signature } });
        if (fresh.count !== 1) return false;
        await tx.shoes.update({ where: { id: shoe.id }, data: { upgrading_until: new Date(Date.now() + upgradeMinutes(shoe.level, game) * 60_000) } });
        return true;
      });
      if (!done) return err(reply, 409, "closed", "This order is closed.");
      return { ok: true };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return err(reply, 409, "signature_used", "This payment was already used.");
      throw e;
    }
  });

  // ---------- Craft : 3 chaussures de même rareté -> 1 de la rareté suivante ----------
  app.post("/shoes/craft", opts, async (req, reply) => {
    const b = z.object({ ids: z.array(z.string().uuid()).length(3) }).parse(req.body);
    if (new Set(b.ids).size !== 3) return err(reply, 400, "bad_craft", "Pick three different shoes.");
    const { game } = await getConfigs();
    await settleUpgrades(prisma, req.user.sub);
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${req.user.sub}::uuid FOR UPDATE`;
      const shoes = await tx.shoes.findMany({ where: { id: { in: b.ids }, owner_id: req.user.sub, removed_at: null } });
      if (shoes.length !== 3) return { error: "Shoe not found." } as const;
      if (shoes.some((s) => s.listing_id)) return { error: "A shoe is listed on the market." } as const;
      if (shoes.some((s) => s.upgrading_until && s.upgrading_until > new Date())) return { error: "A shoe is being upgraded." } as const;
      if (shoes.some((s) => s.level < game.craft_min_level)) return { error: `Crafting needs shoes of level ${game.craft_min_level} or more.` } as const;
      const models = await tx.shoe_models.findMany({ where: { code: { in: shoes.map((s) => s.model) } } });
      const rar = shoes.map((s) => models.find((m) => m.code === s.model)?.rarity ?? "common");
      if (new Set(rar).size !== 1) return { error: "The three shoes must have the same rarity." } as const;
      const idx = RARITY_ORDER.indexOf(rar[0] as (typeof RARITY_ORDER)[number]);
      if (idx < 0 || idx >= RARITY_ORDER.length - 1) return { error: "Mythic shoes cannot be crafted further." } as const;
      const pool = await tx.shoe_models.findMany({ where: { rarity: RARITY_ORDER[idx + 1], active: true, is_starter: false } });
      if (pool.length === 0) return { error: "No model available for the next rarity yet." } as const;
      const model = pool[Math.floor(Math.random() * pool.length)]!;
      const level = Math.min(game.max_level, Math.max(1, Math.round(shoes.reduce((a, s) => a + s.level, 0) / 3)));
      const wasEquipped = shoes.some((s) => s.is_equipped);
      await tx.shoes.updateMany({ where: { id: { in: b.ids } }, data: { removed_at: new Date(), is_equipped: false } });
      if (wasEquipped) await tx.shoes.updateMany({ where: { owner_id: req.user.sub, removed_at: null }, data: { is_equipped: false } });
      const created = await tx.shoes.create({ data: { owner_id: req.user.sub, model: model.code, level, source: "craft", is_equipped: wasEquipped } });
      // Garde-fou : le joueur a toujours une chaussure équipée.
      if (!wasEquipped && !(await tx.shoes.count({ where: { owner_id: req.user.sub, removed_at: null, is_equipped: true } }))) {
        await tx.shoes.update({ where: { id: created.id }, data: { is_equipped: true } });
      }
      return { ok: true, shoe: { id: created.id, name: model.name, rarity: model.rarity, level } } as const;
    });
    if ("error" in result) return err(reply, 409, "bad_craft", result.error);
    return result;
  });

  // ---------- Forge : 3 chaussures du même niveau n -> 1 chaussure de niveau n+1 (SOL + $WALK, vérifié on-chain) ----------
  const forgeIds = z.object({ ids: z.array(z.string().uuid()).length(3) });
  const MODEL_RANK = (r: string | undefined) => Math.max(0, RARITY_ORDER.indexOf((r ?? "common") as (typeof RARITY_ORDER)[number]));

  app.get("/forge/info", opts, async () => {
    const { game } = await getConfigs();
    return {
      enabled: game.forge_enabled, easy_max_level: game.forge_easy_max_level,
      levels: Array.from({ length: Math.max(0, game.max_level - 1) }, (_, i) => i + 1).map((n) => ({ from: n, to: n + 1, walk: forgeCostWalk(n, game), sol: Number(forgeCostLamports(n, game)) / 1e9 })),
    };
  });

  /** Vérifie que les 3 chaussures peuvent être forgées ; renvoie leur niveau ou une erreur. */
  async function forgeCheck(db: Prisma.TransactionClient | typeof prisma, userId: string, ids: string[], maxLevel: number) {
    if (new Set(ids).size !== 3) return { error: "Pick three different shoes." } as const;
    const shoes = await db.shoes.findMany({ where: { id: { in: ids }, owner_id: userId, removed_at: null } });
    if (shoes.length !== 3) return { error: "Shoe not found." } as const;
    if (shoes.some((s) => s.listing_id)) return { error: "A shoe is listed on the market." } as const;
    if (shoes.some((s) => s.upgrading_until && s.upgrading_until > new Date())) return { error: "A shoe is being upgraded." } as const;
    const lv = shoes[0]!.level;
    if (shoes.some((s) => s.level !== lv)) return { error: "The three shoes must have the same level." } as const;
    if (lv >= maxLevel) return { error: "These shoes are already at the maximum level." } as const;
    return { shoes, level: lv } as const;
  }

  app.post("/forge/order", opts, async (req, reply) => {
    const { ids } = forgeIds.parse(req.body);
    const c = chain();
    if (!c) return err(reply, 503, "chain_unavailable", "Payments are not open yet.");
    const { game } = await getConfigs();
    if (!game.forge_enabled) return err(reply, 503, "forge_off", "The forge is closed for now.");
    await settleUpgrades(prisma, req.user.sub);
    const chk = await forgeCheck(prisma, req.user.sub, ids, game.max_level);
    if ("error" in chk) return err(reply, 409, "bad_forge", chk.error);
    const price = forgeCostWalk(chk.level, game), lamports = forgeCostLamports(chk.level, game);
    const nonce = newNonce();
    const [burn, pool, treasury] = splitAmount(toBaseUnits(price, c.decimals), game.split_upgrade);
    const buyer = await prisma.users.findUniqueOrThrow({ where: { id: req.user.sub } });
    const f = await prisma.forges.create({
      data: {
        user_id: req.user.sub, shoe_ids: ids, from_level: chk.level, cost: new Prisma.Decimal(toBaseUnits(price, c.decimals).toString()),
        burned: new Prisma.Decimal(burn.toString()), to_pool: new Prisma.Decimal(pool.toString()), to_treasury: new Prisma.Decimal(treasury.toString()),
        sol_lamports: new Prisma.Decimal(lamports.toString()), nonce, expires_at: new Date(Date.now() + 10 * 60_000),
      },
    });
    return {
      order_id: f.id, price_walk: price, price_sol: Number(lamports) / 1e9, to_level: chk.level + 1, payer: buyer.wallet, mint: c.mint, token_program: c.tokenProgram,
      decimals: c.decimals, memo: `walk:forge:${f.id}:${nonce}`, expires_at: f.expires_at, burn_base: String(burn), treasury: c.treasury, sol_lamports: lamports.toString(),
      transfers: [{ to_ata: ata(c.mint, c.pool, c.tokenProgram), owner: c.pool, amount_base: String(pool) }, { to_ata: ata(c.mint, c.treasury, c.tokenProgram), owner: c.treasury, amount_base: String(treasury) }],
    };
  });

  app.post("/forge/orders/:id/confirm", opts, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const { signature } = sig.parse(req.body);
    const c = chain();
    if (!c) return err(reply, 503, "chain_unavailable", "Payments are not open yet.");
    const { game } = await getConfigs();
    const f = await prisma.forges.findUnique({ where: { id } });
    if (!f || f.user_id !== req.user.sub) return err(reply, 404, "not_found", "Order not found.");
    if (f.status !== "awaiting_tx") return f.tx_signature === signature ? { ok: true } : err(reply, 409, "closed", "This order is closed.");
    const buyer = await prisma.users.findUniqueOrThrow({ where: { id: req.user.sub } });
    const check = await checkPayment(c.rpc, signature, {
      payer: buyer.wallet, mint: c.mint, burnBase: BigInt(f.burned.toFixed(0)),
      transfers: [{ destinationAta: ata(c.mint, c.pool, c.tokenProgram), amountBase: BigInt(f.to_pool.toFixed(0)) }, { destinationAta: ata(c.mint, c.treasury, c.tokenProgram), amountBase: BigInt(f.to_treasury.toFixed(0)) }],
      sol: { destination: c.treasury, minLamports: BigInt(f.sol_lamports.toFixed(0)) },
      memo: `walk:forge:${f.id}:${f.nonce}`,
    }).catch(() => ({ ok: false as const, reason: "Blockchain unreachable, try again in a moment." }));
    if (!check.ok) return err(reply, 402, "payment_not_verified", check.reason);
    try {
      const out = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${req.user.sub}::uuid FOR UPDATE`;
        const fresh = await tx.forges.updateMany({ where: { id, status: "awaiting_tx" }, data: { status: "paid", tx_signature: signature } });
        if (fresh.count !== 1) return { error: "This order is closed." } as const;
        const chk = await forgeCheck(tx, req.user.sub, f.shoe_ids, game.max_level);
        if ("error" in chk || chk.level !== f.from_level) {
          await tx.forges.update({ where: { id }, data: { status: "orphan" } });
          return { orphan: true } as const;
        }
        const models = await tx.shoe_models.findMany({ where: { code: { in: chk.shoes.map((s) => s.model) } } });
        const best = models.reduce<(typeof models)[number] | undefined>((a, m) => (!a || MODEL_RANK(m.rarity) > MODEL_RANK(a.rarity) ? m : a), undefined);
        const pool = best ? await tx.shoe_models.findMany({ where: { rarity: best.rarity, active: true, is_starter: false } }) : [];
        const model = pool.length ? pool[Math.floor(Math.random() * pool.length)]! : best ?? models[0];
        const wasEquipped = chk.shoes.some((s) => s.is_equipped);
        await tx.shoes.updateMany({ where: { id: { in: f.shoe_ids } }, data: { removed_at: new Date(), is_equipped: false } });
        if (wasEquipped) await tx.shoes.updateMany({ where: { owner_id: req.user.sub, removed_at: null }, data: { is_equipped: false } });
        const created = await tx.shoes.create({ data: { owner_id: req.user.sub, model: model?.code ?? chk.shoes[0]!.model, level: chk.level + 1, source: "forge", is_equipped: wasEquipped } });
        if (!wasEquipped && !(await tx.shoes.count({ where: { owner_id: req.user.sub, removed_at: null, is_equipped: true } }))) {
          await tx.shoes.update({ where: { id: created.id }, data: { is_equipped: true } });
        }
        await tx.forges.update({ where: { id }, data: { status: "done", result_shoe_id: created.id } });
        return { ok: true, shoe: { id: created.id, name: model?.name ?? "Shoe", rarity: model?.rarity ?? "common", level: chk.level + 1 } } as const;
      });
      if ("error" in out) return err(reply, 409, "closed", out.error);
      if ("orphan" in out) return err(reply, 409, "orphan_payment", "Your payment was received but the shoes changed in the meantime. It will be refunded: support has been notified.");
      return out;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return err(reply, 409, "signature_used", "This payment was already used.");
      throw e;
    }
  });
}
