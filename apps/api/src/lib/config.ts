import { cachedConfigs, prisma } from "@walk/db";

/** Configuration de jeu et anti-triche, relue depuis game_config toutes les 30 s. */
export const getConfigs = cachedConfigs(prisma);
