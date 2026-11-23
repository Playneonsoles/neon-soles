import { type Gift, rollGift } from "./gifts";
import {
  type AnalysisResult, type AntiCheatConfig, type GameConfig, type RawPoint,
  addDays, analyzeSession, walkAvailability, type Availability, computeReward, effectiveStreak, emissionFactor, minSpeedForLevel, sessionMaxSeconds,
  nextStreak, parisDay, walkToBaseUnits, wearAfterWalk, wearRewardFactor,
} from "@walk/game";
import { Prisma, type PrismaClient } from "@prisma/client";
import { creditWalkReward } from "./emission";
import { bonusFactor, questProgress } from "./quests";

const dayDate = (day: string) => new Date(`${day}T00:00:00Z`);
export const dayString = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Joueurs actifs sur 7 jours (sessions non refusées), pour le facteur d'émission automatique. */
export async function activePlayers7d(db: PrismaClient | Prisma.TransactionClient, today: string): Promise<number> {
  const rows = await db.walk_sessions.groupBy({
    by: ["user_id"],
    where: { walk_day: { gte: dayDate(addDays(today, -6)) }, status: { not: "rejected" } },
  });
  return rows.length;
}

/** Gain estimé par minute valide pour ce joueur aujourd'hui (affiché en direct pendant la session). */
export async function rewardPerMinute(
  db: PrismaClient, userId: string, level: number, cfg: GameConfig, today: string, extraFactor = 1,
): Promise<number> {
  const user = await db.users.findUnique({ where: { id: userId } });
  const streak = nextStreak(dayString(user?.last_walk_day ?? null), today, effectiveStreak(dayString(user?.last_walk_day ?? null), today, user?.streak_days ?? 0));
  const factor = emissionFactor(await activePlayers7d(db, today), cfg);
  return computeReward({ validSeconds: 60, level, partsBonusPct: 0, streakDays: streak, emissionFactor: factor, extraFactor }, cfg);
}

export interface FinalizeResult {
  status: "valid" | "review" | "rejected";
  trust_score: number | null;
  valid_seconds: number;
  distance_m: number;
  steps: number;
  avg_speed_kmh: number;
  estimated_reward: string; // unités de base
  hint: string | null;
  gift?: Gift | null;
}

const HINTS: Record<string, string> = {
  gps_accuracy: "GPS signal too imprecise: walk in the open and turn on precise location.",
  too_slow: "Average speed too low for your level: speed up a little next time.",
  too_short: "Less than one minute of valid walking: the walk does not count.",
  too_few_points: "Not enough positions received: keep the screen on and the app open.",
};

/**
 * Termine une session : rejoue les points, calcule le score, crédite les gains « en attente » dans le grand livre.
 * Idempotent : verrou de ligne (SELECT … FOR UPDATE) et statut `running` vérifié dans la transaction.
 */
export async function finalizeSession(
  prisma: PrismaClient, sessionId: string, cfg: GameConfig, ac: AntiCheatConfig, decimals: number, now = new Date(),
): Promise<FinalizeResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM walk_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
    const s = await tx.walk_sessions.findUniqueOrThrow({ where: { id: sessionId } });
    const toResult = (r: Partial<FinalizeResult> = {}): FinalizeResult => ({
      status: s.status as FinalizeResult["status"], trust_score: s.trust_score, valid_seconds: s.valid_seconds ?? 0,
      distance_m: s.distance_m ?? 0, steps: s.steps ?? 0, avg_speed_kmh: Number(s.avg_speed_kmh ?? 0),
      estimated_reward: (s.estimated_reward ?? 0).toString(), hint: null, ...r,
    });
    if (s.status !== "running") return toResult();

    const [shoe, user] = await Promise.all([
      tx.shoes.findUniqueOrThrow({ where: { id: s.shoe_id } }),
      tx.users.findUniqueOrThrow({ where: { id: s.user_id } }),
    ]);
    const pts = await tx.$queryRaw<{ ts: Date; lat: number; lng: number; accuracy_m: number | null; steps: number | null }[]>`
      SELECT ts, lat, lng, accuracy_m, steps FROM walk_points WHERE session_id = ${sessionId}::uuid ORDER BY ts`;
    const raw: RawPoint[] = pts.map((p) => ({ ts: p.ts.getTime(), lat: p.lat, lng: p.lng, accuracy_m: p.accuracy_m, steps: p.steps }));

    // Plusieurs wallets sur le même appareil → comptes signalés.
    const sharing = user.device_hash
      ? await tx.users.findMany({ where: { device_hash: user.device_hash, id: { not: user.id } }, select: { id: true } })
      : [];
    // L'empreinte navigateur est envoyée par le client : deux téléphones identiques ont la même, et un tricheur peut
    // imiter celle d'un autre joueur. On pénalise donc seulement le score (revue manuelle sous 60), sans jamais
    // bannir ni signaler un compte automatiquement.

    const level = shoe.level;
    const a: AnalysisResult = analyzeSession(
      raw,
      { maxSeconds: sessionMaxSeconds(level, cfg), minSpeedKmh: minSpeedForLevel(level, cfg), sharedDevice: sharing.length > 0 },
      ac,
    );

    const today = s.walk_day.toISOString().slice(0, 10);
    const lastDay = dayString(user.last_walk_day);
    const streakNow = nextStreak(lastDay, today, effectiveStreak(lastDay, today, user.streak_days));
    const factor = emissionFactor(await activePlayers7d(tx, today), cfg);
    // Usure : une chaussure abîmée rapporte moins (jamais zéro) ; la réparation se paie en $WALK (voir /repair).
    const model = await tx.shoe_models.findUnique({ where: { code: shoe.model }, select: { rarity: true } });
    const rarityFactor = (cfg.rarity_multipliers[model?.rarity ?? "common"] ?? 1)
      * bonusFactor(await questProgress(tx, user.id, s.walk_day, cfg, sessionId), user.boost_until, cfg, now);
    const rewardWalk = a.verdict === "rejected" ? 0
      : computeReward({ validSeconds: a.validSeconds, level, partsBonusPct: 0, streakDays: streakNow, emissionFactor: factor, extraFactor: rarityFactor }, cfg)
        * wearRewardFactor(Number(shoe.durability), cfg);
    const reward = walkToBaseUnits(rewardWalk, decimals);

    await tx.walk_sessions.update({
      where: { id: sessionId },
      data: {
        ended_at: now, status: a.verdict, valid_seconds: a.validSeconds, distance_m: a.distanceM, steps: a.steps,
        avg_speed_kmh: a.avgSpeedKmh, trust_score: a.trustScore, estimated_reward: new Prisma.Decimal(reward.toString()),
      },
    });

    let gift: Gift | null = null;
    if (a.verdict === "valid") {
      // Série et gains « en attente » seulement pour une session validée (« review » : décision de l'admin, lot 3).
      await tx.users.update({ where: { id: user.id }, data: { streak_days: streakNow, last_walk_day: dayDate(today) } });
      await creditWalkReward(tx, { userId: user.id, sessionId, day: today, reward });
      if (cfg.shoe_wear_enabled) {
        await tx.shoes.update({ where: { id: shoe.id }, data: { durability: wearAfterWalk(Number(shoe.durability), cfg) } });
      }
      gift = await rollGift(tx, { userId: user.id, sessionId, reward }, cfg);
    }

    const hint = a.reasons.map((r) => HINTS[r]).find(Boolean) ?? null;
    return {
      status: a.verdict, trust_score: a.trustScore, valid_seconds: a.validSeconds, distance_m: a.distanceM,
      steps: a.steps, avg_speed_kmh: a.avgSpeedKmh, estimated_reward: reward.toString(), hint, gift,
    };
  }, { timeout: 20_000 });
}

export interface WalkStatus extends Availability {
  sessionsToday: number;
  limit: number;
  cooldownHours: number;
  runningSessionId: string | null;
}

/** Une marche est-elle possible maintenant ? Réglages lus dans game_config (délai et plafond modifiables dans l'admin). */
export async function getWalkStatus(
  db: PrismaClient | Prisma.TransactionClient,
  userId: string,
  cfg: Pick<GameConfig, "daily_session_limit" | "session_cooldown_hours">,
  now = new Date(),
): Promise<WalkStatus> {
  const today = parisDay(now);
  const [sessionsToday, last, running] = await Promise.all([
    db.walk_sessions.count({ where: { user_id: userId, walk_day: dayDate(today) } }),
    db.walk_sessions.findFirst({ where: { user_id: userId }, orderBy: { started_at: "desc" }, select: { started_at: true } }),
    db.walk_sessions.findFirst({ where: { user_id: userId, status: "running" }, select: { id: true } }),
  ]);
  const a = walkAvailability({
    now, lastStartedAt: last?.started_at ?? null, sessionsToday, limit: cfg.daily_session_limit,
    cooldownHours: cfg.session_cooldown_hours, hasRunning: Boolean(running),
  });
  return { ...a, sessionsToday, limit: cfg.daily_session_limit, cooldownHours: cfg.session_cooldown_hours, runningSessionId: running?.id ?? null };
}
