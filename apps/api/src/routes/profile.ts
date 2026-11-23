import { Prisma, prisma } from "@walk/db";
import { handleError, normalizeHandle, profileSchema } from "@walk/game";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

export async function profileRoutes(app: FastifyInstance) {
  // Le nom est-il libre ? (pour l'écran de création ; limité par le rate-limit global)
  app.get("/profile/check", { preHandler: app.authenticate, config: { rateLimit: { max: 0 /* REDACTED */, timeWindow: "1 minute" } } }, async (req) => {
    const { pseudo } = z.object({ pseudo: z.string().max(40) }).parse(req.query);
    const err = handleError(pseudo);
    if (err) return { available: false, reason: err };
    const taken = await prisma.users.findUnique({ where: { pseudo: normalizeHandle(pseudo) }, select: { id: true } });
    return { available: !taken, reason: taken ? "This name is already taken." : null };
  });

  // Création du personnage : une seule fois (les changements ensuite passent par l'admin).
  app.put("/me/profile", { preHandler: app.authenticate }, async (req, reply) => {
    const body = profileSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_profile", message: body.error.issues[0]?.message ?? "Invalid profile." });
    const p = body.data;
    try {
      const res = await prisma.users.updateMany({
        where: { id: req.user.sub, profile_completed_at: null },
        data: { pseudo: p.pseudo, avatar: p.avatar, profile_completed_at: new Date() },
      });
      if (res.count === 0) return reply.code(409).send({ error: "profile_exists", message: "Your character is already created." });
      return { ok: true };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return reply.code(409).send({ error: "pseudo_taken", message: "This name is already taken." });
      }
      throw e;
    }
  });
}
