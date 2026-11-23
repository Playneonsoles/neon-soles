import { nextParisMidnight } from "./time";

export interface AvailabilityInput {
  now: Date;
  lastStartedAt: Date | null; // début de la dernière session (toutes statuts)
  sessionsToday: number; // sessions démarrées aujourd'hui (jour de Paris)
  limit: number; // daily_session_limit
  cooldownHours: number; // session_cooldown_hours
  hasRunning: boolean;
}
export type WalkBlock = "running" | "cooldown" | "daily_limit";
export interface Availability {
  canWalk: boolean;
  reason: WalkBlock | null;
  nextAt: Date | null; // quand la prochaine marche sera possible
}

/** Une nouvelle marche est possible si aucune n'est en cours, si le délai est écoulé et si le plafond du jour n'est pas atteint. */
export function walkAvailability(i: AvailabilityInput): Availability {
  if (i.hasRunning) return { canWalk: false, reason: "running", nextAt: null };
  const cooldownEnd = i.lastStartedAt ? new Date(i.lastStartedAt.getTime() + i.cooldownHours * 3_600_000) : null;
  if (i.sessionsToday >= i.limit) {
    const midnight = nextParisMidnight(i.now);
    const nextAt = cooldownEnd && cooldownEnd > midnight ? cooldownEnd : midnight;
    return { canWalk: false, reason: "daily_limit", nextAt };
  }
  if (cooldownEnd && i.now < cooldownEnd) return { canWalk: false, reason: "cooldown", nextAt: cooldownEnd };
  return { canWalk: true, reason: null, nextAt: null };
}
