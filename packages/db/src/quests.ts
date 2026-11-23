import type { Prisma, PrismaClient } from "@prisma/client";
import type { GameConfig } from "@walk/game";

type Db = PrismaClient | Prisma.TransactionClient;
export interface QuestState { id: string; metric: string; target: number; value: number; done: boolean }

/**
 * Progression des quêtes du jour, calculée à partir des marches VALIDÉES du jour de jeu (aucune table de plus à tenir à jour).
 * `excludeSessionId` : ignore la session en cours de clôture (son bonus ne s'applique qu'aux marches suivantes).
 */
export async function questProgress(db: Db, userId: string, walkDay: Date, cfg: Pick<GameConfig, "daily_quests">, excludeSessionId?: string): Promise<QuestState[]> {
  const rows = await db.walk_sessions.findMany({
    where: { user_id: userId, walk_day: walkDay, status: "valid", ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}) },
    select: { distance_m: true, valid_seconds: true },
  });
  const totals: Record<string, number> = {
    walks: rows.length,
    distance_m: rows.reduce((a, r) => a + (r.distance_m ?? 0), 0),
    valid_seconds: rows.reduce((a, r) => a + (r.valid_seconds ?? 0), 0),
  };
  return cfg.daily_quests.map((q) => ({ id: q.id, metric: q.metric, target: q.target, value: totals[q.metric] ?? 0, done: (totals[q.metric] ?? 0) >= q.target }));
}

/** Facteur de gains dû aux quêtes déjà terminées ce jour-là et au boost d'invitation actif. */
export function bonusFactor(quests: QuestState[], boostUntil: Date | null, cfg: Pick<GameConfig, "quest_bonus_pct" | "invite_boost_pct">, now = new Date()): number {
  const q = 1 + (quests.filter((x) => x.done).length * cfg.quest_bonus_pct) / 100;
  const b = boostUntil && boostUntil > now ? 1 + cfg.invite_boost_pct / 100 : 1;
  return q * b;
}
