import { z } from "zod";
import { type ShoeEffect, visualTierForLevel } from "./visuals";

/** Avatars préparés : personnages ORIGINAUX inspirés d'archétypes du cinéma (jamais de personne réelle ni de personnage existant). L'index est stocké dans users.avatar. */
export const AVATARS = [
  { name: "Vale", role: "Secret Agent" }, { name: "Nova", role: "Space Pilot" }, { name: "Rook", role: "Pirate Captain" },
  { name: "Merlo", role: "Wizard" }, { name: "Dusty", role: "Cowboy" }, { name: "Kenji", role: "Samurai" },
  { name: "Sloane", role: "Detective" }, { name: "Atlas", role: "Superhero" }, { name: "Bjorn", role: "Viking Warrior" },
  { name: "Cipher", role: "Hacker" }, { name: "Brock", role: "Boxer" }, { name: "Vex", role: "Rock Star" },
  { name: "Marco", role: "Pastel Suit" }, { name: "Lola", role: "Disco Queen" }, { name: "Rico", role: "Speedboat Racer" }, { name: "Dex", role: "Roller Skater" },
] as const;

/** Anciens champs (genre, origine) : plus demandés à la création, conservés en base pour les anciens comptes. */
export const GENDERS = ["woman", "man", "non_binary"] as const;
export const APPEARANCES = [
  "asian", "south_asian", "european", "african", "north_american",
  "latin_american", "middle_eastern", "oceanian", "other",
] as const;
export type Gender = (typeof GENDERS)[number];
export type Appearance = (typeof APPEARANCES)[number];

/** Codes pays ISO 3166-1 alpha-2 ; les noms sont affichés par le navigateur (Intl.DisplayNames). */
export const COUNTRY_CODES: readonly string[] =
  ("AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT " +
  "MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG " +
  "UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW").split(" ");

const RESERVED = new Set(["admin", "administrator", "walk", "support", "moderator", "mod", "staff", "team", "official", "system", "root", "null"]);
const HANDLE_RE = /^@[a-z0-9_]{3,20}$/;

/** Nom de joueur : toujours en minuscules, toujours précédé de « @ » (stocké tel quel, unique). */
export function normalizeHandle(input: string): string {
  const t = input.trim().toLowerCase();
  return t.startsWith("@") ? t : `@${t}`;
}

export function handleError(input: string): string | null {
  const h = normalizeHandle(input);
  if (!HANDLE_RE.test(h)) return "3 to 20 characters: letters, numbers or _ (after the @).";
  if (/^@_|_$/.test(h) || h.includes("__")) return "No _ at the start, at the end, or doubled.";
  if (RESERVED.has(h.slice(1))) return "This name is reserved.";
  return null;
}

export const profileSchema = z.object({
  pseudo: z.string().max(24).refine((v) => handleError(v) === null, "Nom invalide").transform(normalizeHandle),
  avatar: z.number().int().min(0).max(AVATARS.length - 1),
});
export type ProfileInput = z.infer<typeof profileSchema>;

/** Caractéristiques cosmétiques ou bonus d'une chaussure (modifiables par l'admin, vides = déduites du niveau). */
export const SHOE_EFFECTS = ["glow", "sparkles", "aura", "trail", "lightning", "wings", "halo"] as const satisfies readonly ShoeEffect[];
export const shoeAttributesSchema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  effects: z.array(z.enum(SHOE_EFFECTS)).max(SHOE_EFFECTS.length).optional(),
}).strict();
export type ShoeAttributes = z.infer<typeof shoeAttributesSchema>;

/** Rendu final d'une chaussure : ses caractéristiques passent avant les effets du niveau. */
export function resolveShoeVisual(level: number, raw: unknown): { color: string; effects: readonly ShoeEffect[]; tier: string } {
  const tier = visualTierForLevel(level);
  const a = shoeAttributesSchema.safeParse(raw ?? {});
  const attrs = a.success ? a.data : {};
  return { color: attrs.color ?? tier.color, effects: attrs.effects ?? tier.effects, tier: tier.name };
}
