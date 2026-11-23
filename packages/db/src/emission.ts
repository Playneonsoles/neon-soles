import { type GameConfig, addDays, applyProrata, emissionFactor, parisDay, prorataBp, walkToBaseUnits } from "@walk/game";
import { Prisma, type PrismaClient } from "@prisma/client";
import { activePlayers7d } from "./walk";

type Db = PrismaClient | Prisma.TransactionClient;
const dayDate = (day: string) => new Date(`${day}T00:00:00Z`);

/**
 * Crédite le gain d'une marche validée dans le grand livre.
 * Si le calcul de minuit de ce jour est déjà passé (marche terminée après 00:05), le gain est confirmé tout de suite
 * avec le prorata du jour ; sinon il reste « pending » jusqu'au calcul de minuit.
 */
export async function creditWalkReward(
  tx: Db, o: { userId: string; sessionId: string; day: string; reward: bigint },
): Promise<void> {
  if (o.reward <= 0n) return;
  const emission = await tx.daily_emissions.findUnique({ where: { day: dayDate(o.day) } });
  let amount = o.reward;
  let status = "pending";
  if (emission) {
    amount = applyProrata(o.reward, BigInt(Math.round(Number(emission.prorata ?? 1) * 10_000)));
    status = "confirmed";
    await tx.walk_sessions.update({ where: { id: o.sessionId }, data: { confirmed_reward: new Prisma.Decimal(amount.toString()) } });
  }
  await tx.ledger_entries.create({
    data: { user_id: o.userId, kind: "walk_reward", amount: new Prisma.Decimal(amount.toString()), status, ref_id: o.sessionId },
  });
}

export interface EmissionResult { day: string; skipped: boolean; earned: string; cap: string; prorataBp: string; sessions: number }

/**
 * Calcul de minuit pour un jour de jeu terminé : additionne les gains en attente de TOUTES les marches du jour,
 * applique le prorata si le budget est dépassé, passe les gains en « confirmed ». Idempotent (une ligne par jour).
 */
export async function runEmissionForDay(
  prisma: PrismaClient, day: string, cfg: GameConfig, decimals: number,
): Promise<EmissionResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('emission'))`;
    const done = await tx.daily_emissions.findUnique({ where: { day: dayDate(day) } });
    if (done) return { day, skipped: true, earned: "0", cap: "0", prorataBp: "10000", sessions: 0 };

    const agg = await tx.$queryRaw<{ earned: string; n: bigint }[]>`
      SELECT COALESCE(SUM(le.amount), 0)::text AS earned, COUNT(*)::bigint AS n
      FROM ledger_entries le JOIN walk_sessions ws ON ws.id = le.ref_id
      WHERE le.kind = 'walk_reward' AND le.status = 'pending' AND ws.walk_day = ${day}::date`;
    const earned = BigInt(agg[0]?.earned ?? "0");
    const cap = walkToBaseUnits(cfg.daily_emission_cap, decimals);
    const bp = prorataBp(earned, cap);

    // Un seul UPDATE : confirme les entrées (montant × prorata, arrondi vers le bas) et reporte le montant sur la marche.
    await tx.$executeRaw`
      WITH upd AS (
        UPDATE ledger_entries le SET amount = trunc(le.amount * ${bp.toString()}::numeric / 10000), status = 'confirmed'
        FROM walk_sessions ws
        WHERE le.ref_id = ws.id AND le.kind = 'walk_reward' AND le.status = 'pending' AND ws.walk_day = ${day}::date
        RETURNING le.ref_id AS session_id, le.amount AS amount
      )
      UPDATE walk_sessions ws SET confirmed_reward = upd.amount FROM upd WHERE ws.id = upd.session_id`;

    const active = await activePlayers7d(tx, day);
    await tx.daily_emissions.create({
      data: {
        day: dayDate(day), active_users: active, emission_factor: new Prisma.Decimal(emissionFactor(active, cfg)),
        earned_raw: new Prisma.Decimal(earned.toString()), cap: new Prisma.Decimal(cap.toString()),
        prorata: new Prisma.Decimal((Number(bp) / 10_000).toFixed(4)), burned: new Prisma.Decimal(0),
      },
    });
    return { day, skipped: false, earned: earned.toString(), cap: cap.toString(), prorataBp: bp.toString(), sessions: Number(agg[0]?.n ?? 0n) };
  }, { timeout: 60_000 });
}

/** Rattrape tous les jours passés qui ont des gains en attente et pas encore de calcul (worker arrêté la nuit, par exemple). */
export async function runDueEmissions(prisma: PrismaClient, cfg: GameConfig, decimals: number, now = new Date()): Promise<EmissionResult[]> {
  const today = parisDay(now);
  const rows = await prisma.$queryRaw<{ day: Date }[]>`
    SELECT DISTINCT ws.walk_day AS day
    FROM ledger_entries le JOIN walk_sessions ws ON ws.id = le.ref_id
    WHERE le.kind = 'walk_reward' AND le.status = 'pending' AND ws.walk_day < ${today}::date
    ORDER BY 1`;
  const out: EmissionResult[] = [];
  for (const r of rows) out.push(await runEmissionForDay(prisma, r.day.toISOString().slice(0, 10), cfg, decimals));
  return out;
}

export const yesterday = (now = new Date()) => addDays(parisDay(now), -1);
