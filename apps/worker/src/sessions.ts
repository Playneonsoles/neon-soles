import { cachedConfigs, finalizeSession, prisma } from "@walk/db";
import { sessionMaxSeconds } from "@walk/game";

const getConfigs = cachedConfigs(prisma);

/** Termine les sessions restées « running » (app fermée, batterie vide) : fin automatique à la durée max + marge. */
export async function closeStaleSessions(decimals: number): Promise<number> {
  const { game, anticheat } = await getConfigs();
  const cutoffS = sessionMaxSeconds(game.max_level, game) + 180;
  const stale = await prisma.walk_sessions.findMany({
    where: { status: "running", started_at: { lt: new Date(Date.now() - cutoffS * 1000) } }, select: { id: true }, take: 50,
  });
  for (const s of stale) {
    try { await finalizeSession(prisma, s.id, game, anticheat, decimals); }
    catch (e) { console.error(`[sessions] fin automatique ${s.id} :`, e instanceof Error ? e.message : e); }
  }
  return stale.length;
}
