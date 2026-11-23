import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma, finalizeSession, getWalkStatus, prisma, rewardPerMinute, settleUpgrades } from "@walk/db";
import { minSpeedForLevel, parisDay, sessionMaxSeconds } from "@walk/game";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { getConfigs } from "../lib/config";

const MAX_POINTS_PER_SESSION = 450;
const GRACE_S = 120; // marge après la durée max avant de refuser des points
const uuid = z.object({ id: z.string().uuid() });
const startBody = z.object({ device_hash: z.string().regex(/^[0-9a-f]{64}$/).optional() }).default({});
const pointsBody = z.object({
  points: z.array(z.object({
    ts: z.number().int(), // ms epoch
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(5000).nullable().default(null),
    speed: z.number().min(0).max(100).nullable().default(null),
    steps: z.number().int().min(0).max(100_000).nullable().default(null),
  })).min(1).max(40),
});

export async function walkRoutes(app: FastifyInstance) {
  // Identifiant de session signé : empêche d'envoyer des points pour une session dont on n'a pas le jeton.
  const sign = (id: string) => createHmac("sha256", app.env.JWT_SECRET).update(`walk:${id}`).digest("hex");
  const tokenOk = (req: FastifyRequest, id: string) => {
    const got = Buffer.from(String(req.headers["x-walk-session"] ?? ""));
    const want = Buffer.from(sign(id));
    return got.length === want.length && timingSafeEqual(got, want);
  };
  const bad = (reply: FastifyReply, code: number, error: string, message: string) => reply.code(code).send({ error, message });

  async function ownRunning(req: FastifyRequest, reply: FastifyReply, id: string) {
    const s = await prisma.walk_sessions.findUnique({ where: { id } });
    if (!s || s.user_id !== req.user.sub) { bad(reply, 404, "not_found", "Walk not found."); return null; }
    if (!tokenOk(req, id)) { bad(reply, 403, "bad_session_token", "Invalid walk token."); return null; }
    return s;
  }

  app.post("/walk/start", { preHandler: app.authenticate }, async (req, reply) => {
    const body = startBody.parse(req.body ?? {});
    const { game: cfg, anticheat } = await getConfigs();
    const user = await prisma.users.findUniqueOrThrow({ where: { id: req.user.sub } });
    if (user.status === "banned") return bad(reply, 403, "banned", "Account suspended.");
    if (!user.profile_completed_at) return bad(reply, 409, "profile_incomplete", "Create your character before walking.");

    await settleUpgrades(prisma, user.id);
    const shoe = await prisma.shoes.findFirst({ where: { owner_id: user.id, is_equipped: true, removed_at: null }, orderBy: { level: "desc" } });
    if (!shoe) return bad(reply, 409, "no_shoe", "No shoe equipped.");
    if (shoe.upgrading_until && shoe.upgrading_until > new Date()) return bad(reply, 409, "shoe_upgrading", "This shoe is being upgraded. Equip another one or wait for the upgrade to finish.");

    if (body.device_hash && body.device_hash !== user.device_hash) {
      await prisma.users.update({ where: { id: user.id }, data: { device_hash: body.device_hash } });
    }

    const now = new Date();
    const today = parisDay(now);

    // Une session restée « running » (app fermée) est terminée d'abord, sinon elle bloquerait le joueur.
    const stuck = await prisma.walk_sessions.findFirst({ where: { user_id: user.id, status: "running" } });
    if (stuck) {
      const stuckShoe = await prisma.shoes.findUnique({ where: { id: stuck.shoe_id } });
      const limitMs = ((stuckShoe ? sessionMaxSeconds(stuckShoe.level, cfg) : 0) + GRACE_S + 60 + cfg.walk_pause_max_minutes * 60) * 1000;
      if (now.getTime() - stuck.started_at.getTime() > limitMs) {
        await finalizeSession(prisma, stuck.id, cfg, anticheat, app.env.WALK_DECIMALS);
      }
    }

    // Verrou par joueur : deux démarrages simultanés ne peuvent pas passer le contrôle du délai en même temps.
    const out = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
      const status = await getWalkStatus(tx, user.id, cfg, now);
      if (!status.canWalk) return { status, session: null };
      const created = await tx.walk_sessions.create({
        data: { user_id: user.id, shoe_id: shoe.id, walk_day: new Date(`${today}T00:00:00Z`), started_at: now },
      });
      return { status, session: created };
    });
    if (!out.session) {
      const s = out.status;
      const msg = s.reason === "running" ? "A walk is already in progress."
        : s.reason === "daily_limit" ? "You have reached today's walk limit. Come back after midnight (Paris time)."
        : "Not yet: the delay between two walks has not elapsed.";
      return reply.code(409).send({ error: s.reason, message: msg, next_session_at: s.nextAt });
    }
    const session = out.session;
    return {
      session_id: session.id,
      session_token: sign(session.id),
      level: shoe.level,
      max_seconds: sessionMaxSeconds(shoe.level, cfg),
      min_speed_kmh: minSpeedForLevel(shoe.level, cfg),
      point_interval_s: 3,
      packet_interval_s: 15,
      max_pause_s: Math.round(cfg.walk_pause_max_minutes * 60),
      sessions_today: out.status.sessionsToday + 1,
      daily_session_limit: cfg.daily_session_limit,
      reward_per_minute: await rewardPerMinute(prisma, user.id, shoe.level, cfg, today, cfg.rarity_multipliers[(await prisma.shoe_models.findUnique({ where: { code: shoe.model }, select: { rarity: true } }))?.rarity ?? "common"] ?? 1), // $WALK estimés par minute valide
    };
  });

  app.post("/walk/:id/points", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const { points } = pointsBody.parse(req.body);
    const s = await ownRunning(req, reply, id);
    if (!s) return;
    if (s.status !== "running") return bad(reply, 409, "not_running", "This walk has ended.");
    if (s.paused_at) return bad(reply, 409, "walk_paused", "The walk is paused. Resume it first.");

    const { game: cfg } = await getConfigs();
    const shoe = await prisma.shoes.findUniqueOrThrow({ where: { id: s.shoe_id } });
    // Le temps passé en pause est ajouté à la fenêtre de la session.
    const maxMs = (sessionMaxSeconds(shoe.level, cfg) + GRACE_S) * 1000 + s.paused_ms;
    const now = Date.now(), start = s.started_at.getTime();
    if (now - start > maxMs + 30_000) return bad(reply, 409, "session_expired", "Maximum duration exceeded: end the walk.");

    // Points hors fenêtre [début − 5 s, maintenant + 30 s, début + durée max] ignorés.
    // Plafond de points par session (durée max de niveau 20 ≈ 290 points ; marge ×1,5) : évite de saturer la base.
    const stored = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM walk_points WHERE session_id = ${id}::uuid`;
    if (Number(stored[0]?.n ?? 0) + points.length > MAX_POINTS_PER_SESSION) {
      return bad(reply, 429, "too_many_points", "Too many points received for this walk.");
    }
    const ok = points.filter((p) => p.ts >= start - 5_000 && p.ts <= Math.min(now + 30_000, start + maxMs));
    if (ok.length) {
      const rows = ok.map((p) => Prisma.sql`(${id}::uuid, ${new Date(p.ts)}, ${p.lat}, ${p.lng}, ${p.accuracy}, ${p.speed}, ${p.steps})`);
      await prisma.$executeRaw`INSERT INTO walk_points (session_id, ts, lat, lng, accuracy_m, speed_ms, steps) VALUES ${Prisma.join(rows)}`;
    }
    return { accepted: ok.length, ignored: points.length - ok.length };
  });

  // Pause / reprise : le temps en pause est plafonné (walk_pause_max_minutes par marche) et ne compte pas dans la durée.
  app.post("/walk/:id/pause", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const s = await ownRunning(req, reply, id);
    if (!s) return;
    if (s.status !== "running") return bad(reply, 409, "not_running", "This walk has ended.");
    const { game: cfg } = await getConfigs();
    const capMs = cfg.walk_pause_max_minutes * 60_000;
    if (capMs <= 0 || s.paused_ms >= capMs) return bad(reply, 409, "pause_limit", "No more pause time available for this walk.");
    if (!s.paused_at) await prisma.walk_sessions.update({ where: { id }, data: { paused_at: new Date() } });
    return { ok: true, pause_left_s: Math.max(0, Math.round((capMs - s.paused_ms) / 1000)) };
  });

  app.post("/walk/:id/resume", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const s = await ownRunning(req, reply, id);
    if (!s) return;
    if (s.status !== "running") return bad(reply, 409, "not_running", "This walk has ended.");
    if (!s.paused_at) return { ok: true, pause_left_s: 0 };
    const { game: cfg } = await getConfigs();
    const capMs = cfg.walk_pause_max_minutes * 60_000;
    const total = s.paused_ms + (Date.now() - s.paused_at.getTime());
    if (total > capMs + 5_000) return bad(reply, 409, "pause_expired", "The pause lasted too long: the walk must be ended.");
    await prisma.walk_sessions.update({ where: { id }, data: { paused_ms: Math.min(total, capMs), paused_at: null } });
    return { ok: true, pause_left_s: Math.max(0, Math.round((capMs - total) / 1000)) };
  });

  app.post("/walk/:id/end", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = uuid.parse(req.params);
    const s = await ownRunning(req, reply, id);
    if (!s) return;
    const { game, anticheat } = await getConfigs();
    return finalizeSession(prisma, id, game, anticheat, app.env.WALK_DECIMALS);
  });

  // Statut de marche : peut-on démarrer maintenant, et sinon quand ? (réglages modifiables dans l'admin)
  app.get("/walk/status", { preHandler: app.authenticate }, async (req) => {
    const { game: cfg } = await getConfigs();
    const s = await getWalkStatus(prisma, req.user.sub, cfg);
    return {
      can_walk: s.canWalk, reason: s.reason, next_session_at: s.nextAt, sessions_today: s.sessionsToday,
      daily_session_limit: s.limit, cooldown_hours: s.cooldownHours,
    };
  });

  app.get("/walk/history", { preHandler: app.authenticate }, async (req) => {
    const rows = await prisma.walk_sessions.findMany({
      where: { user_id: req.user.sub }, orderBy: { walk_day: "desc" }, take: 30,
    });
    return {
      sessions: rows.map((r) => ({
        id: r.id, day: r.walk_day.toISOString().slice(0, 10), status: r.status, valid_seconds: r.valid_seconds,
        distance_m: r.distance_m, steps: r.steps, avg_speed_kmh: r.avg_speed_kmh && Number(r.avg_speed_kmh),
        estimated_reward: (r.estimated_reward ?? 0).toString(), confirmed_reward: r.confirmed_reward?.toString() ?? null,
      })),
    };
  });
}
