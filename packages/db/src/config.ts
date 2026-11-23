import { type AntiCheatConfig, type GameConfig, antiCheatConfigSchema, parseGameConfig } from "@walk/game";
import type { PrismaClient } from "@prisma/client";

/** Lit game_config (valeurs d'économie et seuils anti-triche). Jamais de valeur codée en dur. */
export async function loadConfigs(prisma: PrismaClient): Promise<{ game: GameConfig; anticheat: AntiCheatConfig }> {
  const rows = await prisma.game_config.findMany();
  const anticheat = rows.find((r) => r.key === "anticheat")?.value ?? {};
  return { game: parseGameConfig(rows.filter((r) => r.key !== "anticheat")), anticheat: antiCheatConfigSchema.parse(anticheat) };
}

/** Cache de 30 s pour limiter les lectures (les changements admin sont pris en compte sans redéploiement). */
export function cachedConfigs(prisma: PrismaClient, ttlMs = 30_000) {
  let value: Awaited<ReturnType<typeof loadConfigs>> | null = null;
  let at = 0;
  return async () => {
    if (!value || Date.now() - at > ttlMs) { value = await loadConfigs(prisma); at = Date.now(); }
    return value;
  };
}
