import { Prisma, audit, prisma } from "@walk/db";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const id = z.object({ id: z.string().uuid() });
const rl = (max: number, window: string) => ({ rateLimit: { max, timeWindow: window } });

export async function ideaRoutes(app: FastifyInstance) {
  // Public : la liste est lisible sans compte. Si le visiteur est connecté, on indique ses votes.
  app.get("/ideas", { config: rl(60, "1 minute") }, async (req) => {
    let uid: string | null = null;
    try { await req.jwtVerify(); uid = req.user.sub; } catch { /* visiteur anonyme */ }
    const rows = await prisma.suggestions.findMany({
      where: { status: { not: "hidden" } }, orderBy: [{ votes: "desc" }, { created_at: "desc" }], take: 200,
    });
    const mine = uid ? await prisma.suggestion_votes.findMany({ where: { user_id: uid, suggestion_id: { in: rows.map((r) => r.id) } }, select: { suggestion_id: true } }) : [];
    const voted = new Set(mine.map((m) => m.suggestion_id));
    return { ideas: rows.map((r) => ({ id: r.id, body: r.body, status: r.status, votes: r.votes, team: r.user_id === null, mine: voted.has(r.id) })) };
  });

  // Proposer une idée : 5 par jour et par joueur.
  app.post("/ideas", { preHandler: app.authenticate, config: rl(5, "1 day") }, async (req, reply) => {
    const b = z.object({ body: z.string().trim().min(10).max(400) }).parse(req.body);
    const s = await prisma.suggestions.create({ data: { user_id: req.user.sub, body: b.body } });
    // Le proposant vote d'office pour son idée.
    await prisma.$transaction([
      prisma.suggestion_votes.create({ data: { suggestion_id: s.id, user_id: req.user.sub } }),
      prisma.suggestions.update({ where: { id: s.id }, data: { votes: 1 } }),
    ]);
    return reply.code(201).send({ id: s.id });
  });

  // Voter / retirer son vote (bascule). Le compteur est recalculé dans la même transaction.
  app.post("/ideas/:id/vote", { preHandler: app.authenticate, config: rl(60, "1 minute") }, async (req, reply) => {
    const { id: sid } = id.parse(req.params);
    const exists = await prisma.suggestions.findFirst({ where: { id: sid, status: { not: "hidden" } }, select: { id: true } });
    if (!exists) return reply.code(404).send({ error: "not_found", message: "Idea not found." });
    const out = await prisma.$transaction(async (tx) => {
      const del = await tx.suggestion_votes.deleteMany({ where: { suggestion_id: sid, user_id: req.user.sub } });
      if (del.count === 0) await tx.suggestion_votes.create({ data: { suggestion_id: sid, user_id: req.user.sub } });
      const votes = await tx.suggestion_votes.count({ where: { suggestion_id: sid } });
      await tx.suggestions.update({ where: { id: sid }, data: { votes } });
      return { votes, mine: del.count === 0 };
    });
    return out;
  });

  // Administration : statut d'une idée (open | planned | done | hidden).
  const admin = async (req: FastifyRequest, reply: FastifyReply) => {
    await app.authenticate(req, reply);
    if (reply.sent) return;
    const me = await prisma.users.findUnique({ where: { id: req.user.sub }, select: { is_admin: true } });
    if (!me?.is_admin) return reply.code(403).send({ error: "forbidden", message: "Administrators only." });
  };
  app.post("/admin/ideas/:id", { preHandler: admin, config: rl(120, "1 minute") }, async (req, reply) => {
    const { id: sid } = id.parse(req.params);
    const b = z.object({ status: z.enum(["open", "planned", "done", "hidden"]) }).parse(req.body);
    const ok = await prisma.$transaction(async (tx) => {
      const r = await tx.suggestions.updateMany({ where: { id: sid }, data: { status: b.status } });
      if (r.count) await audit(tx, req.user.sub, "idea.status", { ideaId: sid, status: b.status });
      return r.count > 0;
    });
    return ok ? { ok: true } : reply.code(404).send({ error: "not_found", message: "Idea not found." });
  });
}
