import { effectiveStreak, parisDay, resolveShoeVisual } from "@walk/game";
import { dayString, getWalkStatus, prisma, settleUpgrades } from "@walk/db";
import { getConfigs } from "../lib/config";
import type { FastifyInstance } from "fastify";

export async function meRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: app.authenticate }, async (req, reply) => {
    const user = await prisma.users.findUnique({ where: { id: req.user.sub } });
    if (!user) return reply.code(401).send({ error: "unauthorized", message: "Compte introuvable." });

    await settleUpgrades(prisma, user.id);
    const today = parisDay();
    const { game: cfg } = await getConfigs();
    const [topShoe, sums, walk, badges] = await Promise.all([
      prisma.shoes.findFirst({ where: { owner_id: user.id, is_equipped: true, removed_at: null }, orderBy: { level: "desc" } }),
      prisma.ledger_entries.groupBy({ by: ["status"], where: { user_id: user.id }, _sum: { amount: true } }),
      getWalkStatus(prisma, user.id, cfg),
      prisma.user_badges.findMany({ where: { user_id: user.id }, orderBy: { created_at: "asc" }, select: { code: true } }),
    ]);
    const sum = (status: string) => sums.find((s) => s.status === status)?._sum.amount?.toFixed(0) ?? "0";
    // Réclamable = gains confirmés + montants déjà verrouillés ou réglés par des claims (ceux-ci sont négatifs).
    const claimable = (BigInt(sum("confirmed")) + BigInt(sum("locked")) + BigInt(sum("settled"))).toString();

    return {
      id: user.id, wallet: user.wallet, pseudo: user.pseudo, wallet_kind: user.wallet_kind,
      badges: badges.map((b) => b.code),
      is_admin: user.is_admin, status: user.status, claims_paused: cfg.claims_paused, claim_min: cfg.claim_min, claim_fee_pct: cfg.claim_fee_pct,
      profile_complete: Boolean(user.profile_completed_at),
      profile: user.profile_completed_at ? { avatar: user.avatar } : null,
      // Niveau du compte = niveau de la paire équipée la plus haute.
      level: topShoe?.level ?? 1,
      shoe: topShoe && { id: topShoe.id, level: topShoe.level, model: topShoe.model, upgrading_until: topShoe.upgrading_until, visual: resolveShoeVisual(topShoe.level, topShoe.attributes) },
      streak_days: effectiveStreak(dayString(user.last_walk_day), today, user.streak_days),
      last_walk_day: user.last_walk_day,
      // Une marche toutes les `cooldown_hours` heures, dans la limite de `daily_session_limit` par jour (minuit, heure de Paris).
      can_walk: walk.canWalk,
      walk_block: walk.reason,
      next_session_at: walk.nextAt,
      sessions_today: walk.sessionsToday,
      daily_session_limit: walk.limit,
      cooldown_hours: walk.cooldownHours,
      // Montants en unités de base du jeton (chaînes, jamais de flottants).
      balances: { pending: sum("pending"), confirmed: claimable, claimable },
    };
  });
}
