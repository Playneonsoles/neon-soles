import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().default(4000),
  APP_DOMAIN: z.string().min(1),
  APP_ORIGIN: z.string().url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  ADMIN_WALLETS: z.string().default(""),
  WALK_DECIMALS: z.coerce.number().int().min(2).max(12).default(6),
  SOLANA_CLUSTER: z.enum(["devnet", "mainnet-beta"]).default("devnet"),
  // Adresses PUBLIQUES uniquement (jamais de clé privée dans l'API) : sans elles, marché et boutique répondent « indisponible ».
  SOLANA_RPC_URL: z.string().url().optional(),
  WALK_MINT: z.string().optional(),
  WALK_TOKEN_PROGRAM: z.enum(["spl-token", "token-2022"]).default("spl-token"), // à vérifier sur Solscan : « Token Program » du jeton
  TREASURY_WALLET: z.string().optional(),   // reçoit les frais SOL et 20 % des dépenses
  POOL_WALLET: z.string().optional(),       // pool de récompenses : reçoit 40 % des dépenses
  // Anti-bots (Cloudflare Turnstile, gratuit) : si TURNSTILE_SECRET est défini, la connexion exige un jeton valide.
  TURNSTILE_SECRET: z.string().optional(),
  // Connexion sans wallet (email / Google). Désactivée tant que les clés ne sont pas définies.
  RESEND_API_KEY: z.string().optional(),   // envoi des codes par email (resend.com)
  MAIL_FROM: z.string().optional(),        // ex. "Neon Soles <login@playneonsoles.com>"
  GOOGLE_CLIENT_ID: z.string().optional(),  // OAuth « Web » Google Cloud : active « Continuer avec Google »
  // À mettre à true UNIQUEMENT si le site est derrière Cloudflare ET que le pare-feu n'accepte que les IP de Cloudflare :
  // l'IP réelle du visiteur est alors lue dans CF-Connecting-IP (sinon toutes les limites de débit partageraient l'IP de Cloudflare).
  BEHIND_CLOUDFLARE: z.enum(["true", "false"]).default("false"),
});

const WEAK = /change-me|example|secret|password|^(.)\1+$/i;

export type Env = z.infer<typeof schema> & { adminWallets: string[] };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.parse(source);
  if (parsed.NODE_ENV === "production") {
    if (WEAK.test(parsed.JWT_SECRET)) throw new Error("JWT_SECRET looks like a sample value: generate it with openssl rand -hex 32");
    if (!parsed.APP_ORIGIN.startsWith("https://")) throw new Error("APP_ORIGIN must be https in production");
  }
  return {
    ...parsed,
    adminWallets: parsed.ADMIN_WALLETS.split(",").map((s) => s.trim()).filter(Boolean),
  };
}
