import { z } from "zod";

// Jeu sans NFT : plus de minter, de collection ni de stockage S3 pour les images de chaussures.
const schema = z.object({
  REDIS_URL: z.string().min(1),
  WALK_DECIMALS: z.coerce.number().int().min(2).max(12).default(6),
  SOLANA_RPC_URL: z.string().url(),
  WALK_MINT: z.string().min(32),
  WALK_TOKEN_PROGRAM: z.enum(["spl-token", "token-2022"]).default("spl-token"),
  // Portefeuille de récompenses : sa clé est un fichier monté hors dépôt (Secret Manager au lot 7), lue au démarrage seulement.
  REWARD_SECRET_KEY_FILE: z.string().min(1),
  REWARD_WALLET: z.string().min(32),                 // adresse publique, contrôlée au démarrage contre la clé
  RESERVE_ALERT_WALK: z.coerce.number().nonnegative().default(0), // alerte dans les journaux sous ce solde
});
export const loadEnv = (source: NodeJS.ProcessEnv = process.env) => schema.parse(source);
export type WorkerEnv = z.infer<typeof schema>;
