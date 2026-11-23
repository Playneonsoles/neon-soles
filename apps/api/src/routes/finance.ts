import { Prisma, prisma } from "@walk/db";
import { splitAmount } from "@walk/game";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { getConfigs } from "../lib/config";

/** Tableau de bord financier : réservé aux administrateurs (droit relu en base à chaque appel). */
export async function financeRoutes(app: FastifyInstance) {
  const admin = async (req: FastifyRequest, reply: FastifyReply) => {
    await app.authenticate(req, reply);
    if (reply.sent) return;
    const me = await prisma.users.findUnique({ where: { id: req.user.sub }, select: { is_admin: true } });
    if (!me?.is_admin) return reply.code(403).send({ error: "forbidden", message: "Administrators only." });
  };

  app.get("/admin/finance", { preHandler: admin, config: { rateLimit: { max: 0 /* REDACTED */, timeWindow: "1 minute" } } }, async (req) => {
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(3650).default(30) }).parse(req.query);
    const { game } = await getConfigs();
    const since = new Date(Date.now() - days * 86_400_000);
    const pow = (10n ** BigInt(app.env.WALK_DECIMALS)).toString(); // $WALK entiers → unités de base
    const P = Prisma.sql;

    const [market, shop, claims, rewards, orphans, recent] = await Promise.all([
      prisma.$queryRaw<{ d: string; n: bigint; vol: string; fee: string }[]>(P`
        SELECT (sold_at AT TIME ZONE 'Europe/Paris')::date::text AS d, count(*)::bigint AS n,
               (sum(price_walk)::numeric * ${pow}::numeric)::text AS vol, coalesce(sum(fee_lamports), 0)::text AS fee
        FROM listings WHERE status = 'sold' AND sold_at >= ${since} GROUP BY 1`),
      prisma.$queryRaw<{ d: string; n: bigint; spent: string }[]>(P`
        SELECT (created_at AT TIME ZONE 'Europe/Paris')::date::text AS d, count(*)::bigint AS n,
               (sum(price_walk)::numeric * ${pow}::numeric)::text AS spent
        FROM shop_orders WHERE status = 'paid' AND created_at >= ${since} GROUP BY 1`),
      prisma.$queryRaw<{ d: string; n: bigint; gross: string; fee: string; failed: bigint }[]>(P`
        SELECT (created_at AT TIME ZONE 'Europe/Paris')::date::text AS d,
               count(*) FILTER (WHERE status <> 'failed')::bigint AS n,
               coalesce(sum(amount) FILTER (WHERE status <> 'failed'), 0)::text AS gross,
               coalesce(sum(fee) FILTER (WHERE status <> 'failed'), 0)::text AS fee,
               count(*) FILTER (WHERE status = 'failed')::bigint AS failed
        FROM claims WHERE created_at >= ${since} GROUP BY 1`),
      prisma.$queryRaw<{ d: string; amount: string }[]>(P`
        SELECT (created_at AT TIME ZONE 'Europe/Paris')::date::text AS d, coalesce(sum(amount), 0)::text AS amount
        FROM ledger_entries WHERE kind = 'walk_reward' AND status IN ('pending', 'confirmed') AND created_at >= ${since} GROUP BY 1`),
      prisma.admin_audit.count({ where: { action: "market.orphan_payment", created_at: { gte: since } } }),
      prisma.$queryRaw<{ kind: string; at: Date; who: string | null; uid: string | null; amount: string; fee: string; sig: string | null }[]>(P`
        (SELECT 'market' AS kind, l.sold_at AS at, u.pseudo AS who, u.id::text AS uid, (l.price_walk::numeric * ${pow}::numeric)::text AS amount, coalesce(l.fee_lamports, 0)::text AS fee, l.tx_signature AS sig
           FROM listings l LEFT JOIN users u ON u.id = l.buyer_id WHERE l.status = 'sold' AND l.sold_at >= ${since})
        UNION ALL
        (SELECT 'shop', o.created_at, u.pseudo, u.id::text, (o.price_walk::numeric * ${pow}::numeric)::text, '0', o.tx_signature
           FROM shop_orders o LEFT JOIN users u ON u.id = o.user_id WHERE o.status = 'paid' AND o.created_at >= ${since})
        UNION ALL
        (SELECT 'claim', c.created_at, u.pseudo, u.id::text, (c.amount - c.fee)::text, '0', c.tx_signature
           FROM claims c LEFT JOIN users u ON u.id = c.user_id WHERE c.created_at >= ${since} AND c.status <> 'failed')
        ORDER BY at DESC LIMIT 50`),
    ]);

    const sum = (xs: string[]) => xs.reduce((a, b) => a + BigInt(b), 0n);
    const shopSpent = sum(shop.map((r) => r.spent));
    const [burn, pool, treasury] = splitAmount(shopSpent, game.split_upgrade);

    // Une ligne par jour, toutes catégories ensemble.
    const days_ = new Set([...market.map((r) => r.d), ...shop.map((r) => r.d), ...claims.map((r) => r.d), ...rewards.map((r) => r.d)]);
    const daily = [...days_].sort().reverse().map((d) => {
      const m = market.find((r) => r.d === d), s = shop.find((r) => r.d === d), c = claims.find((r) => r.d === d), w = rewards.find((r) => r.d === d);
      return {
        day: d, market_sales: Number(m?.n ?? 0n), market_volume: m?.vol ?? "0", market_fee_lamports: m?.fee ?? "0",
        shop_orders: Number(s?.n ?? 0n), shop_spent: s?.spent ?? "0",
        claims: Number(c?.n ?? 0n), claims_gross: c?.gross ?? "0", claims_fee: c?.fee ?? "0", rewards_credited: w?.amount ?? "0",
      };
    });

    return {
      days, decimals: app.env.WALK_DECIMALS, cluster: app.env.SOLANA_CLUSTER,
      totals: {
        market: { sales: Number(sum(market.map((r) => String(r.n)))), volume_walk: sum(market.map((r) => r.vol)).toString(), fees_lamports: sum(market.map((r) => r.fee)).toString() },
        shop: { orders: Number(sum(shop.map((r) => String(r.n)))), spent_walk: shopSpent.toString(), burned: String(burn), to_pool: String(pool), to_treasury: String(treasury) },
        claims: { count: Number(sum(claims.map((r) => String(r.n)))), gross: sum(claims.map((r) => r.gross)).toString(), fee: sum(claims.map((r) => r.fee)).toString(), failed: Number(sum(claims.map((r) => String(r.failed)))) },
        rewards_credited: sum(rewards.map((r) => r.amount)).toString(),
        orphan_payments: orphans,
      },
      split_upgrade: game.split_upgrade,
      daily,
      recent: recent.map((r) => ({ kind: r.kind, at: r.at, who: r.who, user_id: r.uid, amount: r.amount, fee: r.fee, signature: r.sig })),
    };
  });
}
