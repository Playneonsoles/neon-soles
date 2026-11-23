import { Prisma, prisma } from "@walk/db";
import { listingPriceError, marketFeeLamports, repairCost, resolveShoeVisual, shoeShopPrice, splitAmount, toBaseUnits } from "@walk/game";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { getConfigs } from "../lib/config";
import { ata, chainParams, checkPayment, newNonce } from "../lib/payments";

const uuid = z.object({ id: z.string().uuid() });
const sig = z.object({ signature: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,88}$/) });
const err = (r: FastifyReply, s: number, error: string, message: string) => r.code(s).send({ error, message });

export async function marketRoutes(app: FastifyInstance) {
  // Garde commune : connecté, profil créé, compte non bloqué (rechecké par authenticate).
  const player = async (req: FastifyRequest, reply: FastifyReply) => {
    await app.authenticate(req, reply);
    if (reply.sent) return;
    const u = await prisma.users.findUnique({ where: { id: req.user.sub }, select: { profile_completed_at: true } });
    if (!u?.profile_completed_at) return err(reply, 409, "profile_incomplete", "Create your character first.");
  };
  const opts = { preHandler: player, config: { rateLimit: { max: 0 /* REDACTED */, timeWindow: "1 minute" } } };
  const chain = () => chainParams(app.env);
  const unavailable = (r: FastifyReply) => err(r, 503, "chain_unavailable", "Les paiements ne sont pas encore ouverts.");

  // ---------- Annonces ----------
  app.get("/market/listings", opts, async (req) => {
    const q = z.object({ kind: z.enum(["shoe", "collectible"]).optional(), mine: z.coerce.boolean().default(false), page: z.coerce.number().int().min(0).max(1000).default(0) }).parse(req.query);
    const rows = await prisma.listings.findMany({
      where: q.mine ? { seller_id: req.user.sub, status: { in: ["active", "reserved"] } } : { status: { in: ["active", "reserved"] }, ...(q.kind ? { kind: q.kind } : {}) },
      orderBy: { created_at: "desc" }, take: 24, skip: q.page * 24,
    });
    const shoeIds = rows.filter((r) => r.kind === "shoe").map((r) => r.item_id);
    const itemIds = rows.filter((r) => r.kind === "collectible").map((r) => r.item_id);
    const [shoes, items, sellers, models, catalog] = await Promise.all([
      prisma.shoes.findMany({ where: { id: { in: shoeIds } } }),
      prisma.user_collectibles.findMany({ where: { id: { in: itemIds } } }),
      prisma.users.findMany({ where: { id: { in: rows.map((r) => r.seller_id) } }, select: { id: true, pseudo: true } }),
      prisma.shoe_models.findMany(), prisma.collectibles.findMany(),
    ]);
    const { game } = await getConfigs();
    return {
      fee_min_sol: game.market_fee_min_sol,
      listings: rows.map((l) => {
        const seller = sellers.find((s) => s.id === l.seller_id);
        const shoe = shoes.find((s) => s.id === l.item_id), it = items.find((s) => s.id === l.item_id);
        const model = models.find((m) => m.code === shoe?.model), coll = catalog.find((c) => c.code === it?.collectible_code);
        return {
          id: l.id, kind: l.kind, price_walk: Number(l.price_walk), seller: { pseudo: seller?.pseudo ?? null }, mine: l.seller_id === req.user.sub,
          reserved: l.status === "reserved" && !!l.reserved_until && l.reserved_until > new Date(),
          fee_lamports: marketFeeLamports(Number(l.price_walk), game).toString(),
          shoe: shoe && { level: shoe.level, model_name: model?.name ?? shoe.model, rarity: model?.rarity ?? "common", visual: resolveShoeVisual(shoe.level, shoe.attributes) },
          collectible: it && { name: coll?.name ?? it.collectible_code, rarity: coll?.rarity ?? "common", kind: coll?.kind ?? "other" },
        };
      }),
    };
  });

  const createBody = z.object({ kind: z.enum(["shoe", "collectible"]), item_id: z.string().uuid(), price_walk: z.number() });
  app.post("/market/listings", opts, async (req, reply) => {
    const b = createBody.parse(req.body);
    const { game } = await getConfigs();
    if (!game.market_enabled) return err(reply, 503, "market_closed", "The marketplace is closed for now.");
    const priceErr = listingPriceError(b.price_walk, game);
    if (priceErr) return err(reply, 400, "bad_price", priceErr);
    try {
      const out = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${req.user.sub}::uuid FOR UPDATE`;
        if (b.kind === "shoe") {
          const mine = await tx.shoes.findMany({ where: { owner_id: req.user.sub, removed_at: null } });
          const shoe = mine.find((s) => s.id === b.item_id);
          if (!shoe) return "not_yours" as const;
          if (shoe.listing_id) return "already" as const;
          if (shoe.upgrading_until && shoe.upgrading_until > new Date()) return "upgrading" as const;
          // Le joueur garde toujours au moins une paire hors vente pour pouvoir marcher.
          if (!mine.some((s) => s.id !== shoe.id && !s.listing_id)) return "last_shoe" as const;
        } else {
          const it = await tx.user_collectibles.findFirst({ where: { id: b.item_id, user_id: req.user.sub, removed_at: null } });
          if (!it) return "not_yours" as const;
          if (it.listing_id) return "already" as const;
        }
        const l = await tx.listings.create({ data: { seller_id: req.user.sub, kind: b.kind, item_id: b.item_id, price_walk: BigInt(b.price_walk) } });
        if (b.kind === "shoe") {
          await tx.shoes.update({ where: { id: b.item_id }, data: { listing_id: l.id, is_equipped: false } });
          // Si la paire mise en vente était équipée, on équipe la plus haute des paires restantes.
          const left = await tx.shoes.findMany({ where: { owner_id: req.user.sub, removed_at: null, listing_id: null }, orderBy: { level: "desc" } });
          if (left.length && !left.some((s) => s.is_equipped)) await tx.shoes.update({ where: { id: (left[0] as { id: string }).id }, data: { is_equipped: true } });
        } else await tx.user_collectibles.update({ where: { id: b.item_id }, data: { listing_id: l.id } });
        return l.id;
      });
      if (out === "not_yours") return err(reply, 404, "not_found", "Objet introuvable.");
      if (out === "already") return err(reply, 409, "already_listed", "This item is already listed.");
      if (out === "upgrading") return err(reply, 409, "upgrading", "This shoe is being upgraded.");
      if (out === "last_shoe") return err(reply, 409, "last_shoe", "Garde au moins une paire pour marcher.");
      return { id: out };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return err(reply, 409, "already_listed", "This item is already listed.");
      throw e;
    }
  });

  async function release(tx: Prisma.TransactionClient, l: { id: string; kind: string; item_id: string }) {
    if (l.kind === "shoe") await tx.shoes.updateMany({ where: { id: l.item_id, listing_id: l.id }, data: { listing_id: null } });
    else await tx.user_collectibles.updateMany({ where: { id: l.item_id, listing_id: l.id }, data: { listing_id: null } });
  }

  app.delete("/market/listings/:id", opts, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const r = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM listings WHERE id = ${id}::uuid FOR UPDATE`;
      const l = await tx.listings.findUnique({ where: { id } });
      if (!l || l.seller_id !== req.user.sub) return "not_found" as const;
      // Un acheteur est en train de payer : on n'annule pas sous ses pieds avant la fin de sa réservation.
      if (l.status === "reserved" && l.reserved_until && l.reserved_until > new Date()) return "busy" as const;
      if (l.status !== "active" && l.status !== "reserved") return "not_found" as const;
      await tx.listings.update({ where: { id }, data: { status: "cancelled" } });
      await release(tx, l);
      return "ok" as const;
    });
    if (r === "not_found") return err(reply, 404, "not_found", "Annonce introuvable.");
    if (r === "busy") return err(reply, 409, "reserved", "A buyer is paying right now: try again in a few minutes.");
    return { ok: true };
  });

  // ---------- Achat : réserver, payer on-chain, confirmer ----------
  app.post("/market/listings/:id/reserve", opts, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const c = chain();
    if (!c) return unavailable(reply);
    const { game } = await getConfigs();
    if (!game.market_enabled) return err(reply, 503, "market_closed", "The marketplace is closed for now.");
    const buyer = await prisma.users.findUniqueOrThrow({ where: { id: req.user.sub } });
    const res = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM listings WHERE id = ${id}::uuid FOR UPDATE`;
      const l = await tx.listings.findUnique({ where: { id } });
      if (!l || !["active", "reserved"].includes(l.status)) return "gone" as const;
      if (l.seller_id === buyer.id) return "own" as const;
      const now = new Date();
      if (l.status === "reserved" && l.reserved_by !== buyer.id && l.reserved_until && l.reserved_until > now) return "busy" as const;
      const seller = await tx.users.findUniqueOrThrow({ where: { id: l.seller_id }, select: { wallet: true } });
      const nonce = newNonce();
      const fee = marketFeeLamports(Number(l.price_walk), game);
      const until = new Date(now.getTime() + game.market_reservation_minutes * 60_000);
      await tx.listings.update({ where: { id }, data: { status: "reserved", reserved_by: buyer.id, reserved_until: until, reservation_nonce: nonce, fee_lamports: fee } });
      return { l, seller: seller.wallet, nonce, fee, until };
    });
    if (res === "gone") return err(reply, 404, "gone", "Cette annonce n'est plus disponible.");
    if (res === "own") return err(reply, 409, "own_listing", "C'est ta propre annonce.");
    if (res === "busy") return err(reply, 409, "reserved", "Another player is buying this item right now.");
    return {
      payer: buyer.wallet, mint: c.mint, token_program: c.tokenProgram, decimals: c.decimals, treasury: c.treasury,
      seller_wallet: res.seller, seller_ata: ata(c.mint, res.seller, c.tokenProgram),
      amount_base: toBaseUnits(Number(res.l.price_walk), c.decimals).toString(),
      fee_lamports: res.fee.toString(), memo: `walk:mkt:${id}:${res.nonce}`, expires_at: res.until,
    };
  });

  app.post("/market/listings/:id/confirm", opts, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const { signature } = sig.parse(req.body);
    const c = chain();
    if (!c) return unavailable(reply);
    const buyer = await prisma.users.findUniqueOrThrow({ where: { id: req.user.sub } });
    const l = await prisma.listings.findUnique({ where: { id } });
    if (!l) return err(reply, 404, "gone", "Annonce introuvable.");
    // Déjà traité avec la même signature : réponse identique (le navigateur a pu réessayer).
    if (l.status === "sold" && l.buyer_id === buyer.id && l.tx_signature === signature) return { ok: true };
    if (l.status !== "reserved" || l.reserved_by !== buyer.id || !l.reservation_nonce || l.fee_lamports === null) {
      return err(reply, 409, "not_reserved", "No reservation in your name for this listing.");
    }
    const seller = await prisma.users.findUniqueOrThrow({ where: { id: l.seller_id }, select: { wallet: true } });
    const check = await checkPayment(c.rpc, signature, {
      payer: buyer.wallet, mint: c.mint, transfers: [{ destinationAta: ata(c.mint, seller.wallet, c.tokenProgram), amountBase: toBaseUnits(Number(l.price_walk), c.decimals) }],
      sol: { destination: c.treasury, minLamports: l.fee_lamports }, memo: `walk:mkt:${id}:${l.reservation_nonce}`,
    }).catch(() => ({ ok: false as const, reason: "Blockchain unreachable, try again in a moment." }));
    // Pas encore finalisée : le navigateur réessaie ; rien n'est modifié.
    if (!check.ok) return err(reply, 402, "payment_not_verified", check.reason);

    try {
      const out = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM listings WHERE id = ${id}::uuid FOR UPDATE`;
        const cur = await tx.listings.findUnique({ where: { id } });
        // Le paiement est valide mais l'objet n'est plus à ce nom (réservation expirée puis vendu) : on garde la trace pour remboursement.
        if (!cur || cur.status !== "reserved" || cur.reserved_by !== buyer.id || cur.reservation_nonce !== l.reservation_nonce) {
          await tx.admin_audit.create({ data: { admin_id: null, action: "market.orphan_payment", detail: { userId: buyer.id, listingId: id, signature } } });
          return "orphan" as const;
        }
        await tx.listings.update({ where: { id }, data: { status: "sold", buyer_id: buyer.id, tx_signature: signature, sold_at: new Date(), reserved_until: null } });
        if (cur.kind === "shoe") await tx.shoes.update({ where: { id: cur.item_id }, data: { owner_id: buyer.id, listing_id: null, is_equipped: false, source: "market" } });
        else await tx.user_collectibles.update({ where: { id: cur.item_id }, data: { user_id: buyer.id, listing_id: null } });
        return "ok" as const;
      });
      if (out === "orphan") return err(reply, 409, "orphan_payment", "Your payment was received but the item was sold in the meantime. It will be refunded: support has been notified.");
      return { ok: true };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return err(reply, 409, "signature_used", "This payment was already used.");
      throw e;
    }
  });

  // ---------- Boutique : chaussures niveaux 2 à 5 payées en $WALK (brûlé / pool / trésorerie) ----------
  app.get("/shop/shoes", opts, async () => {
    const { game } = await getConfigs();
    const levels = Object.keys(game.shoe_shop_prices).map(Number).sort((a, b) => a - b);
    return { enabled: game.shoe_shop_enabled, items: levels.map((level) => ({ level, price_walk: shoeShopPrice(level, game), visual: resolveShoeVisual(level, {}) })), split: game.split_upgrade };
  });

  app.post("/shop/shoes/:level/order", opts, async (req, reply) => {
    const { level } = z.object({ level: z.coerce.number().int().min(1).max(100) }).parse(req.params);
    const c = chain();
    if (!c) return unavailable(reply);
    const { game } = await getConfigs();
    const price = shoeShopPrice(level, game);
    if (price === null) return err(reply, 400, "not_for_sale", "This shoe is not sold in the shop: look for it on the marketplace.");
    const buyer = await prisma.users.findUniqueOrThrow({ where: { id: req.user.sub } });
    const nonce = newNonce();
    const order = await prisma.shop_orders.create({ data: { user_id: buyer.id, level, price_walk: BigInt(price), nonce, expires_at: new Date(Date.now() + 10 * 60_000) } });
    const [burn, pool, treasury] = splitAmount(toBaseUnits(price, c.decimals), game.split_upgrade);
    return {
      order_id: order.id, payer: buyer.wallet, mint: c.mint, token_program: c.tokenProgram, decimals: c.decimals, memo: `walk:shop:${order.id}:${nonce}`, expires_at: order.expires_at,
      burn_base: String(burn), transfers: [{ to_ata: ata(c.mint, c.pool, c.tokenProgram), owner: c.pool, amount_base: String(pool) }, { to_ata: ata(c.mint, c.treasury, c.tokenProgram), owner: c.treasury, amount_base: String(treasury) }],
    };
  });

  app.post("/shop/orders/:id/confirm", opts, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const { signature } = sig.parse(req.body);
    const c = chain();
    if (!c) return unavailable(reply);
    const { game } = await getConfigs();
    const order = await prisma.shop_orders.findUnique({ where: { id } });
    if (!order || order.user_id !== req.user.sub) return err(reply, 404, "not_found", "Commande introuvable.");
    if (order.status === "paid" && order.tx_signature === signature) return { ok: true, shoe_id: order.shoe_id };
    if (order.status !== "pending") return err(reply, 409, "closed", "This order is closed.");
    const buyer = await prisma.users.findUniqueOrThrow({ where: { id: req.user.sub } });
    // Montants recalculés depuis le prix FIGÉ de la commande, pas depuis la configuration du moment.
    const [burn, pool, treasury] = splitAmount(toBaseUnits(Number(order.price_walk), c.decimals), game.split_upgrade);
    const check = await checkPayment(c.rpc, signature, {
      payer: buyer.wallet, mint: c.mint, burnBase: burn,
      transfers: [{ destinationAta: ata(c.mint, c.pool, c.tokenProgram), amountBase: pool }, { destinationAta: ata(c.mint, c.treasury, c.tokenProgram), amountBase: treasury }],
      memo: `walk:shop:${order.id}:${order.nonce}`,
    }).catch(() => ({ ok: false as const, reason: "Blockchain unreachable, try again in a moment." }));
    if (!check.ok) return err(reply, 402, "payment_not_verified", check.reason);
    try {
      const shoe = await prisma.$transaction(async (tx) => {
        const fresh = await tx.shop_orders.updateMany({ where: { id, status: "pending" }, data: { status: "paid", tx_signature: signature } });
        if (fresh.count !== 1) return null;
        const s = await tx.shoes.create({ data: { owner_id: buyer.id, model: "starter", level: order.level, source: "shop" } });
        await tx.shop_orders.update({ where: { id }, data: { shoe_id: s.id } });
        return s;
      });
      if (!shoe) return err(reply, 409, "closed", "This order is closed.");
      return { ok: true, shoe_id: shoe.id };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return err(reply, 409, "signature_used", "This payment was already used.");
      throw e;
    }
  });

  // ---------- Réparation : rend de la durabilité à une chaussure, payée en $WALK (même répartition que les améliorations) ----------
  app.post("/shoes/:id/repair/order", opts, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const c = chain();
    if (!c) return unavailable(reply);
    const { game } = await getConfigs();
    const shoe = await prisma.shoes.findFirst({ where: { id, owner_id: req.user.sub, removed_at: null } });
    if (!shoe) return err(reply, 404, "not_found", "Chaussure introuvable.");
    const restore = Math.ceil(100 - Number(shoe.durability));
    if (restore <= 0) return err(reply, 409, "nothing_to_repair", "This shoe is in perfect condition.");
    const price = repairCost(shoe.level, restore, game);
    const nonce = newNonce();
    const order = await prisma.repair_orders.create({ data: { user_id: req.user.sub, shoe_id: shoe.id, restore_pct: restore, price_walk: BigInt(price), nonce, expires_at: new Date(Date.now() + 10 * 60_000) } });
    const buyer = await prisma.users.findUniqueOrThrow({ where: { id: req.user.sub } });
    const [burn, pool, treasury] = splitAmount(toBaseUnits(price, c.decimals), game.split_upgrade);
    return {
      order_id: order.id, price_walk: price, restore_pct: restore, payer: buyer.wallet, mint: c.mint, token_program: c.tokenProgram, decimals: c.decimals, memo: `walk:repair:${order.id}:${nonce}`, expires_at: order.expires_at,
      burn_base: String(burn), transfers: [{ to_ata: ata(c.mint, c.pool, c.tokenProgram), owner: c.pool, amount_base: String(pool) }, { to_ata: ata(c.mint, c.treasury, c.tokenProgram), owner: c.treasury, amount_base: String(treasury) }],
    };
  });

  app.post("/repair/orders/:id/confirm", opts, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const { signature } = sig.parse(req.body);
    const c = chain();
    if (!c) return unavailable(reply);
    const { game } = await getConfigs();
    const order = await prisma.repair_orders.findUnique({ where: { id } });
    if (!order || order.user_id !== req.user.sub) return err(reply, 404, "not_found", "Commande introuvable.");
    if (order.status === "paid" && order.tx_signature === signature) return { ok: true };
    if (order.status !== "pending") return err(reply, 409, "closed", "This order is closed.");
    const buyer = await prisma.users.findUniqueOrThrow({ where: { id: req.user.sub } });
    // Montants recalculés depuis le prix FIGÉ de la commande.
    const [burn, pool, treasury] = splitAmount(toBaseUnits(Number(order.price_walk), c.decimals), game.split_upgrade);
    const check = await checkPayment(c.rpc, signature, {
      payer: buyer.wallet, mint: c.mint, burnBase: burn,
      transfers: [{ destinationAta: ata(c.mint, c.pool, c.tokenProgram), amountBase: pool }, { destinationAta: ata(c.mint, c.treasury, c.tokenProgram), amountBase: treasury }],
      memo: `walk:repair:${order.id}:${order.nonce}`,
    }).catch(() => ({ ok: false as const, reason: "Blockchain unreachable, try again in a moment." }));
    if (!check.ok) return err(reply, 402, "payment_not_verified", check.reason);
    try {
      const done = await prisma.$transaction(async (tx) => {
        const fresh = await tx.repair_orders.updateMany({ where: { id, status: "pending" }, data: { status: "paid", tx_signature: signature } });
        if (fresh.count !== 1) return false;
        // Rend les points commandés, plafonnés à 100 (l'usure a pu continuer entre la commande et le paiement).
        await tx.$executeRaw`UPDATE shoes SET durability = LEAST(100, durability + ${order.restore_pct}) WHERE id = ${order.shoe_id}::uuid`;
        return true;
      });
      if (!done) return err(reply, 409, "closed", "This order is closed.");
      return { ok: true };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return err(reply, 409, "signature_used", "This payment was already used.");
      throw e;
    }
  });
}
