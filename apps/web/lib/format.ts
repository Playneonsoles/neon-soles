/** Unités de base du jeton → texte « 12,34 » sans passer par un flottant. */
export function formatWalk(units: string, locale = "en-US", decimals = Number(process.env.NEXT_PUBLIC_WALK_DECIMALS ?? 6)): string {
  const v = BigInt(units || "0");
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const cents = Number((v % base) / 10n ** BigInt(Math.max(decimals - 2, 0)));
  const sep = new Intl.NumberFormat(locale).formatToParts(1.1).find((p) => p.type === "decimal")?.value ?? ".";
  return `${whole.toLocaleString(locale)}${sep}${String(cents).padStart(2, "0")}`;
}
export const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** 5 quartiers de Neon City, un tous les 4 niveaux (noms dans le dictionnaire : district.0 à district.4). */
export const districtOf = (level: number) => Math.min(4, Math.floor((level - 1) / 4));
