/** Jour de jeu au format AAAA-MM-JJ, heure de Paris (la remise à zéro se fait à minuit à Paris). */
export function parisDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

const dayNumber = (d: string) => Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000);
export const dayDiff = (a: string, b: string) => dayNumber(a) - dayNumber(b);
export const addDays = (day: string, n: number) => new Date((dayNumber(day) + n) * 86_400_000).toISOString().slice(0, 10);

/** Série après une session validée aujourd'hui. */
export function nextStreak(lastWalkDay: string | null, today: string, current: number): number {
  if (!lastWalkDay) return 1;
  const gap = dayDiff(today, lastWalkDay);
  if (gap === 0) return Math.max(current, 1);
  return gap === 1 ? current + 1 : 1;
}

/** Série à afficher : retombe à 0 si le joueur a manqué un jour. */
export function effectiveStreak(lastWalkDay: string | null, today: string, current: number): number {
  if (!lastWalkDay) return 0;
  return dayDiff(today, lastWalkDay) <= 1 ? current : 0;
}

/** Prochain minuit à Paris (début du jour de jeu suivant), en Date. */
export function nextParisMidnight(now: Date = new Date()): Date {
  const target = addDays(parisDay(now), 1);
  let t = Date.UTC(+target.slice(0, 4), +target.slice(5, 7) - 1, +target.slice(8, 10)) - 3 * 3_600_000;
  while (parisDay(new Date(t)) !== target) t += 15 * 60_000;
  return new Date(t);
}
