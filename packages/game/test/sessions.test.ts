import { describe, expect, it } from "vitest";
import { chestChancePerSession, sessionMaxSeconds, upgradeCost, minutesForLevel, multiplierForLevel } from "../src/formulas";
import { walkAvailability } from "../src/availability";
import { nextParisMidnight } from "../src/time";
import { computeReward } from "../src/rewards";

const c = {
  minutes_base: 5, minutes_step: 0.5, max_level: 20, daily_session_limit: 4, multiplier_step: 0.1,
  chest_rates: { session_chance_pct: 8, streak7_guaranteed: 1, level_up_guaranteed: 1, top10_min_rarity: "rare", rarity: {} },
  base_rate_per_min: 2, parts_bonus_cap_pct: 60, streak_bonus_pct: 2, streak_bonus_cap_pct: 20,
};

describe("durée d'une session (minutes du jour réparties)", () => {
  it("4 sessions/jour : 75 s au niveau 1, 217 s au niveau 20", () => {
    expect(sessionMaxSeconds(1, c)).toBe(75);
    expect(sessionMaxSeconds(20, c)).toBe(218);
  });
  it("1 session/jour : retrouve l'ancien comportement (5 min)", () => {
    expect(sessionMaxSeconds(1, { ...c, daily_session_limit: 1 })).toBe(300);
  });
  it("les gains quotidiens possibles restent ceux de la section 5 (≈10 $WALK au niveau 1)", () => {
    const one = computeReward({ validSeconds: sessionMaxSeconds(1, c), level: 1, partsBonusPct: 0, streakDays: 0, emissionFactor: 1 }, c);
    expect(one).toBe(2.5);
    expect(one * c.daily_session_limit).toBe(10);
  });
  it("même chose au niveau 20 (~84 $WALK par jour)", () => {
    const one = computeReward({ validSeconds: sessionMaxSeconds(20, c), level: 20, partsBonusPct: 0, streakDays: 0, emissionFactor: 1 }, c);
    expect(Math.abs(one * 4 - 84.1)).toBeLessThan(0.5);
  });
  it("la chance de coffre par session est divisée par le nombre de sessions", () => {
    expect(chestChancePerSession(c)).toBe(2);
    expect(chestChancePerSession({ ...c, daily_session_limit: 1 })).toBe(8);
  });
});

describe("prochain minuit à Paris", () => {
  it("hiver (UTC+1)", () => expect(nextParisMidnight(new Date("2026-11-22T12:00:00Z")).toISOString()).toBe("2026-11-22T23:00:00.000Z"));
  it("été (UTC+2)", () => expect(nextParisMidnight(new Date("2026-07-01T12:00:00Z")).toISOString()).toBe("2026-07-01T22:00:00.000Z"));
});

describe("disponibilité d'une marche", () => {
  const now = new Date("2026-11-22T12:00:00Z");
  const base = { now, lastStartedAt: null, sessionsToday: 0, limit: 4, cooldownHours: 3, hasRunning: false };
  it("libre au premier passage", () => expect(walkAvailability(base).canWalk).toBe(true));
  it("bloquée pendant le délai, avec l'heure de retour", () => {
    const r = walkAvailability({ ...base, lastStartedAt: new Date("2026-11-22T10:00:00Z"), sessionsToday: 1 });
    expect(r.canWalk).toBe(false);
    expect(r.reason).toBe("cooldown");
    expect(r.nextAt?.toISOString()).toBe("2026-11-22T13:00:00.000Z");
  });
  it("libre une fois le délai écoulé", () => {
    expect(walkAvailability({ ...base, lastStartedAt: new Date("2026-11-22T08:59:00Z"), sessionsToday: 1 }).canWalk).toBe(true);
  });
  it("plafond du jour : retour à minuit (Paris)", () => {
    const r = walkAvailability({ ...base, lastStartedAt: new Date("2026-11-22T08:00:00Z"), sessionsToday: 4 });
    expect(r.reason).toBe("daily_limit");
    expect(r.nextAt?.toISOString()).toBe("2026-11-22T23:00:00.000Z");
  });
  it("délai plus long que minuit : on attend la fin du délai", () => {
    const r = walkAvailability({ ...base, cooldownHours: 24, lastStartedAt: new Date("2026-11-22T20:00:00Z"), sessionsToday: 1, limit: 1 });
    expect(r.nextAt?.toISOString()).toBe("2026-11-23T20:00:00.000Z");
  });
  it("une session en cours bloque tout", () => expect(walkAvailability({ ...base, hasRunning: true }).reason).toBe("running"));
});
