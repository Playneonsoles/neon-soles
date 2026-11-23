/**
 * Effets visuels des chaussures selon le niveau (purement cosmétique, aucune incidence sur l'économie).
 * Le site et l'appli lisent la même table : un effet de plus tous les 3 niveaux.
 */
export type ShoeEffect = "glow" | "sparkles" | "aura" | "trail" | "lightning" | "wings" | "halo";

export interface VisualTier {
  readonly fromLevel: number;
  readonly name: string;
  readonly color: string;
  readonly effects: readonly ShoeEffect[];
}

export const VISUAL_TIERS: readonly VisualTier[] = [
  { fromLevel: 1, name: "Starter", color: "#39FF88", effects: [] },
  { fromLevel: 4, name: "Glow", color: "#39FF88", effects: ["glow"] },
  { fromLevel: 7, name: "Sparkle", color: "#67E8F9", effects: ["glow", "sparkles"] },
  { fromLevel: 10, name: "Aura", color: "#A78BFA", effects: ["glow", "sparkles", "aura"] },
  { fromLevel: 13, name: "Speed", color: "#FBBF24", effects: ["glow", "sparkles", "aura", "trail", "lightning"] },
  { fromLevel: 16, name: "Wings", color: "#F472B6", effects: ["glow", "sparkles", "aura", "trail", "lightning", "wings"] },
  { fromLevel: 19, name: "Legend", color: "#FDE68A", effects: ["glow", "sparkles", "aura", "trail", "lightning", "wings", "halo"] },
];

export function visualTierForLevel(level: number): VisualTier {
  const lv = Math.max(1, Math.floor(level));
  let tier = VISUAL_TIERS[0] as VisualTier;
  for (const t of VISUAL_TIERS) if (lv >= t.fromLevel) tier = t;
  return tier;
}

/** Produits complémentaires : niveau minimal du soulier pour les utiliser. Les prix sont dans la table shop_items (admin). */
export const PRODUCT_UNLOCK_LEVELS: Readonly<Record<string, number>> = {
  neon_laces: 2, air_cushion: 4, grip_sole: 7, turbo_gel: 10, storm_core: 13, wing_charm: 16, halo_crest: 19,
};
