import { type GameConfig, antiCheatConfigSchema, nextStreak, parisDay, parseGameConfig } from "@walk/game";
import { Prisma, type PrismaClient } from "@prisma/client";
import { creditWalkReward } from "./emission";
import { dayString } from "./walk";

export async function audit(db: PrismaClient | Prisma.TransactionClient, adminId: string | null, action: string, detail: unknown) {
  await db.admin_audit.create({ data: { admin_id: adminId, action, detail: (detail ?? {}) as Prisma.InputJsonValue } });
}

export class ConfigError extends Error {}

/** Modifie un réglage : la valeur est validée par le même schéma que celui du jeu, l'ancienne est gardée dans l'historique. */
export async function updateConfig(prisma: PrismaClient, adminId: string | null, key: string, value: unknown): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const rows = await tx.game_config.findMany();
    const current = rows.find((r) => r.key === key);
    if (!current) throw new ConfigError(`Unknown setting: ${key}`);
    const next = rows.map((r) => (r.key === key ? { ...r, value } : r));
    try {
      if (key === "anticheat") antiCheatConfigSchema.parse(value);
      else parseGameConfig(next.filter((r) => r.key !== "anticheat"));
    } catch {
      throw new ConfigError(`Valeur invalide pour ${key}`);
    }
    await tx.game_config.update({ where: { key }, data: { value: value as Prisma.InputJsonValue, updated_by: adminId, updated_at: new Date() } });
    await tx.game_config_history.create({
      data: { key, old_value: current.value as Prisma.InputJsonValue, new_value: value as Prisma.InputJsonValue, changed_by: adminId },
    });
    await audit(tx, adminId, "config.update", { key });
  });
}

/** Valide ou refuse une marche en vérification manuelle. */
export async function reviewSession(
  prisma: PrismaClient, adminId: string, sessionId: string, decision: "approve" | "reject",
): Promise<"done" | "not_in_review"> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM walk_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
    const s = await tx.walk_sessions.findUnique({ where: { id: sessionId } });
    if (!s || s.status !== "review") return "not_in_review";
    const day = s.walk_day.toISOString().slice(0, 10);

    if (decision === "reject") {
      await tx.walk_sessions.update({ where: { id: sessionId }, data: { status: "rejected", estimated_reward: new Prisma.Decimal(0) } });
    } else {
      const user = await tx.users.findUniqueOrThrow({ where: { id: s.user_id } });
      const last = dayString(user.last_walk_day);
      // La série ne recule jamais : on ne la met à jour que si cette marche est plus récente que la dernière validée.
      if (!last || last < day) {
        await tx.users.update({
          where: { id: user.id },
          data: { streak_days: nextStreak(last, day, user.streak_days), last_walk_day: new Date(`${day}T00:00:00Z`) },
        });
      }
      await tx.walk_sessions.update({ where: { id: sessionId }, data: { status: "valid" } });
      await creditWalkReward(tx, { userId: s.user_id, sessionId, day, reward: BigInt((s.estimated_reward ?? 0).toString()) });
    }
    await audit(tx, adminId, `review.${decision}`, { sessionId, userId: s.user_id });
    return "done";
  });
}

/**
 * Coupe-circuit (section 6.4) : si les sorties de la dernière heure dépassent N × la moyenne horaire des 7 jours précédents,
 * les claims sont mis en pause automatiquement. Renvoie true si la pause vient d'être déclenchée.
 */
export async function checkBreaker(
  prisma: PrismaClient, cfg: GameConfig, decimals: number, breakerTripped: (a: bigint, b: bigint, m: number, f: bigint) => boolean, toBase: (n: number, d: number) => bigint,
): Promise<boolean> {
  if (cfg.claims_paused) return false;
  const r = await prisma.$queryRaw<{ last_hour: string; prev_week: string }[]>`
    SELECT
      COALESCE(SUM(amount - fee) FILTER (WHERE sent_at >= now() - interval '1 hour'), 0)::text AS last_hour,
      COALESCE(SUM(amount - fee) FILTER (WHERE sent_at >= now() - interval '7 days' AND sent_at < now() - interval '1 hour'), 0)::text AS prev_week
    FROM claims WHERE status IN ('sent', 'confirmed') AND sent_at IS NOT NULL`;
  const lastHour = BigInt(r[0]?.last_hour ?? "0");
  const avg = BigInt(r[0]?.prev_week ?? "0") / (7n * 24n);
  if (!breakerTripped(lastHour, avg, cfg.breaker_multiplier, toBase(cfg.breaker_floor_walk, decimals))) return false;
  await updateConfig(prisma, null, "claims_paused", true);
  await audit(prisma, null, "breaker.tripped", { lastHour: lastHour.toString(), avgHourly: avg.toString() });
  return true;
}

export { parisDay };
