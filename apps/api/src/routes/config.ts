import { PUBLIC_CONFIG_KEYS } from "@walk/game";
import { prisma } from "@walk/db";
import type { FastifyInstance } from "fastify";

export async function configRoutes(app: FastifyInstance) {
  app.get("/config/public", async (_req, reply) => {
    const rows = await prisma.game_config.findMany({ where: { key: { in: [...PUBLIC_CONFIG_KEYS] } } });
    reply.header("Cache-Control", "public, max-age=30");
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  });
}
