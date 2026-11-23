import { randomBytes } from "node:crypto";
import { Prisma, prisma, questProgress } from "@walk/db";
import { addDays, parisDay } from "@walk/game";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { getConfigs } from "../lib/config";

const err = (r: FastifyReply, s: number, error: string, message: string) => r.code(s).send({ error, message });
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const newCode = () => Array.from(randomBytes(8), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");

/** Lundi (heure de Paris) de la semaine qui contient `day` (AAAA-MM-JJ). */
function mondayOf(day: string): string {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = dimanche
  return addDays(day, -((dow + 6) % 7));
}

/** Quêtes du jour, classement hebdomadaire par distance, invitations. */
export async function engagementRoutes(app: FastifyInstance) {
  const player = async (req: FastifyRequest, reply: FastifyReply) => {
    await app.authenticate(req, reply);
    if (reply.sent) return;
    const u = await prisma.users.findUnique({ where: { id: req.user.sub }, select: { profile_completed_at: true } });
    if (!u?.profile_completed_at) return err(reply, 409, "profile_incomplete", "Create your character first.");
  };
  const opts = { preHandler: player, config: { rateLimit: { max: 0 /* REDACTED */, timeWindow: "1 minute" } } };

  // ---------- Quêtes du jour ----------
  app.get("/quests", opts, async (req) => {
    const { game } = await getConfigs();
    const today = parisDay();
    const quests = await questProgress(prisma, req.user.sub, new Date(`${today}T00:00:00Z`), game);
    const u = await prisma.users.findUniqueOrThrow({ where: { id: req.user.sub }, select: { boost_until: true } });
    const boost = u.boost_until && u.boost_until > new Date();
    return {
      quests, done: quests.filter((q) => q.done).length, bonus_pct: quests.filter((q) => q.done).length * game.quest_bonus_pct,
      per_quest_pct: game.quest_bonus_pct, boost_pct: boost ? game.invite_boost_pct : 0, boost_until: boost ? u.boost_until : null,
    };
  });

  // ---------- Classement de la semaine ----------
  async function awardLastWeek(start: string, game: Awaited<ReturnType<typeof getConfigs>>["game"]) {
    const prev = addDays(start, -7);
    await prisma.$transaction(async (tx) => {
      const ins = await tx.$queryRaw<{ week_start: Date }[]>`INSERT INTO weekly_awards (week_start) VALUES (${prev}::date) ON CONFLICT DO NOTHING RETURNING week_start`;
      if (ins.length === 0) return; // déjà fait par un autre appel
      const top = await tx.$queryRaw<{ user_id: string }[]>`
        SELECT w.user_id FROM walk_sessions w JOIN users u ON u.id = w.user_id
        WHERE w.status = 'valid' AND w.walk_day >= ${prev}::date AND w.walk_day < ${start}::date AND u.status NOT IN ('banned','deleted')
        GROUP BY w.user_id HAVING sum(w.distance_m) >= ${Math.round(game.ranking_min_km * 1000)}
        ORDER BY sum(w.distance_m) DESC LIMIT ${game.ranking_top_n}`;
      for (const r of top) await tx.user_collectibles.create({ data: { user_id: r.user_id, collectible_code: "weekly_top10" } });
      await tx.$executeRaw`UPDATE weekly_awards SET winners = ${top.length} WHERE week_start = ${prev}::date`;
    });
  }

  app.get("/ranking", { config: { rateLimit: { max: 0 /* REDACTED */, timeWindow: "1 minute" } } }, async (req) => {
    const { game } = await getConfigs();
    const start = mondayOf(parisDay()), end = addDays(start, 7);
    await awardLastWeek(start, game).catch((e) => app.log.error(e));
    const top = await prisma.$queryRaw<{ id: string; pseudo: string | null; avatar: number | null; m: bigint }[]>`
      SELECT u.id, u.pseudo, u.avatar, sum(w.distance_m)::bigint AS m
      FROM walk_sessions w JOIN users u ON u.id = w.user_id
      WHERE w.status = 'valid' AND w.walk_day >= ${start}::date AND w.walk_day < ${end}::date AND u.status NOT IN ('banned','deleted') AND u.profile_completed_at IS NOT NULL
      GROUP BY u.id ORDER BY m DESC, u.created_at ASC LIMIT 20`;
    let mine: { rank: number; meters: number } | null = null;
    let meId: string | null = null;
    try {
      await req.jwtVerify();
      meId = req.user.sub;
      const [row] = await prisma.$queryRaw<{ m: bigint | null }[]>`
        SELECT sum(distance_m)::bigint AS m FROM walk_sessions WHERE user_id = ${req.user.sub}::uuid AND status = 'valid' AND walk_day >= ${start}::date AND walk_day < ${end}::date`;
      const meters = Number(row?.m ?? 0n);
      if (meters > 0) {
        const [r] = await prisma.$queryRaw<{ n: bigint }[]>`
          WITH t AS (SELECT user_id, sum(distance_m) AS m FROM walk_sessions WHERE status = 'valid' AND walk_day >= ${start}::date AND walk_day < ${end}::date GROUP BY user_id)
          SELECT count(*)::bigint AS n FROM t WHERE m > ${meters}`;
        mine = { rank: Number(r?.n ?? 0n) + 1, meters };
      }
    } catch { /* visiteur anonyme */ }
    const bd = await prisma.user_badges.findMany({ where: { user_id: { in: top.map((r) => r.id) } }, select: { user_id: true, code: true } });
    return {
      week_start: start, week_end: addDays(start, 6), top_n: game.ranking_top_n, min_km: game.ranking_min_km,
      top: top.map((r, i) => ({ rank: i + 1, pseudo: r.pseudo, avatar: r.avatar, meters: Number(r.m), me: r.id === meId, badges: bd.filter((b) => b.user_id === r.id).map((b) => b.code) })),
      mine,
    };
  });

  // ---------- Invitations ----------
  app.get("/referral", opts, async (req) => {
    const { game } = await getConfigs();
    let u = await prisma.users.findUniqueOrThrow({ where: { id: req.user.sub }, select: { referral_code: true, boost_until: true } });
    for (let i = 0; !u.referral_code && i < 5; i++) {
      try { u = await prisma.users.update({ where: { id: req.user.sub }, data: { referral_code: newCode() }, select: { referral_code: true, boost_until: true } }); }
      catch (e) { if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e; }
    }
    const invited = await prisma.referrals.count({ where: { referrer_id: req.user.sub } });
    const referred = await prisma.referrals.findUnique({ where: { referee_id: req.user.sub } });
    return { code: u.referral_code, invited, max: game.invite_max, boost_pct: game.invite_boost_pct, boost_days: game.invite_boost_days, boost_until: u.boost_until && u.boost_until > new Date() ? u.boost_until : null, referred: Boolean(referred) };
  });

  app.post("/referral/claim", { ...opts, config: { rateLimit: { max: 0 /* REDACTED */, timeWindow: "1 hour" } } }, async (req, reply) => {
    const { code } = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6,12}$/) }).parse(req.body);
    const { game } = await getConfigs();
    const out = await prisma.$transaction(async (tx) => {
      const me = await tx.users.findUniqueOrThrow({ where: { id: req.user.sub } });
      if (Date.now() - me.created_at.getTime() > 72 * 3_600_000) return "Invitations only work for accounts created in the last 3 days." as const;
      if (await tx.referrals.findUnique({ where: { referee_id: me.id } })) return "You already used an invitation." as const;
      const ref = await tx.users.findUnique({ where: { referral_code: code } });
      if (!ref || ref.id === me.id || ref.status === "banned") return "Invitation code not found." as const;
      if ((await tx.referrals.count({ where: { referrer_id: ref.id } })) >= game.invite_max) return "This player has reached the invitation limit." as const;
      await tx.referrals.create({ data: { referee_id: me.id, referrer_id: ref.id } });
      const until = new Date(Date.now() + game.invite_boost_days * 86_400_000);
      for (const uid of [me.id, ref.id]) {
        await tx.users.update({ where: { id: uid }, data: { boost_until: until } });
        await tx.user_collectibles.create({ data: { user_id: uid, collectible_code: "friend_badge" } });
      }
      return "ok" as const;
    }).catch((e) => (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" ? ("You already used an invitation." as const) : Promise.reject(e)));
    return out === "ok" ? { ok: true } : err(reply, 409, "invite_refused", out);
  });
}
