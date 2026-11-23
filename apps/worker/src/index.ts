import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { loadSecretKey } from "@walk/solana";
import { checkBreaker, prisma, runDueEmissions, cachedConfigs } from "@walk/db";
import { breakerTripped, parisDay, toBaseUnits } from "@walk/game";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { type Payer, processClaims, rewardBalance } from "./claims";
import { loadEnv } from "./env";
import { closeStaleSessions } from "./sessions";

// Lot 3 : calcul de minuit, envoi des claims, coupe-circuit, réserve ; + fin automatique des sessions.
const env = loadEnv();
// La clé est lue ici, une seule fois, depuis un fichier monté hors du dépôt ; elle n'est jamais journalisée.
const key = Keypair.fromSecretKey(loadSecretKey(env.REWARD_SECRET_KEY_FILE));
if (key.publicKey.toBase58() !== env.REWARD_WALLET) throw new Error("La clé du fichier ne correspond pas à REWARD_WALLET : démarrage refusé.");
const payer: Payer = { conn: new Connection(env.SOLANA_RPC_URL, "confirmed"), key, mint: new PublicKey(env.WALK_MINT), env };
const configs = cachedConfigs(prisma, 10_000);

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue("maintenance", { connection });
await queue.upsertJobScheduler("heartbeat", { every: 60_000 }, { name: "heartbeat" });
await queue.upsertJobScheduler("stale-sessions", { every: 60_000 }, { name: "stale-sessions" });
await queue.upsertJobScheduler("emission", { every: 5 * 60_000 }, { name: "emission" });
await queue.upsertJobScheduler("claims", { every: 30_000 }, { name: "claims" });
await queue.upsertJobScheduler("breaker", { every: 60 * 60_000 }, { name: "breaker" });
await queue.upsertJobScheduler("purge-logins", { every: 6 * 60 * 60_000 }, { name: "purge-logins" });

const parisMinutes = () => {
  const p = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  return Number(p.find((x) => x.type === "hour")?.value) * 60 + Number(p.find((x) => x.type === "minute")?.value);
};

const worker = new Worker(
  "maintenance",
  async (job) => {
    switch (job.name) {
      case "heartbeat": await prisma.$queryRaw`SELECT 1`; break;
      case "stale-sessions": { const n = await closeStaleSessions(env.WALK_DECIMALS); if (n) console.log(`[sessions] ${n} session(s) terminée(s)`); break; }
      case "emission": {
        // Le calcul de minuit tourne à partir de 00:05 (heure de Paris) ; il est idempotent et rattrape les jours manqués.
        if (parisMinutes() < 5) break;
        const { game } = await configs();
        const done = await runDueEmissions(prisma, game, env.WALK_DECIMALS);
        for (const r of done.filter((x) => !x.skipped)) console.log(`[emission] ${r.day} : ${r.sessions} marche(s), prorata ${r.prorataBp}/10000`);
        break;
      }
      case "purge-logins": {
        // Les connexions sont supprimées après `login_events_retention_days` jours (90 par défaut).
        const row = await prisma.game_config.findUnique({ where: { key: "login_events_retention_days" } });
        const days = Math.max(1, Number(row?.value ?? 90));
        const { count } = await prisma.login_events.deleteMany({ where: { created_at: { lt: new Date(Date.now() - days * 86_400_000) } } });
        if (count) console.log(`[privacy] ${count} connexion(s) supprimée(s) (> ${days} jours)`);
        break;
      }
      case "claims": { const n = await processClaims(payer); if (n) console.log(`[claims] ${n} claim(s) traité(s)`); break; }
      case "breaker": {
        const { game } = await configs();
        if (await checkBreaker(prisma, game, env.WALK_DECIMALS, breakerTripped, (w, d) => toBaseUnits(w, d))) console.error("[breaker] DÉCLENCHÉ : claims en pause");
        const bal = await rewardBalance(payer);
        if (env.RESERVE_ALERT_WALK > 0 && bal < toBaseUnits(env.RESERVE_ALERT_WALK, env.WALK_DECIMALS)) console.error(`[reserve] solde du portefeuille de récompenses bas : ${bal} (jour ${parisDay()})`);
        break;
      }
    }
  },
  { connection, concurrency: 1 },
);
worker.on("failed", (job, err) => console.error(`[worker] ${job?.name} en échec :`, err.message));

const stop = async () => {
  await worker.close(); await queue.close(); await connection.quit(); await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
console.log("[worker] démarré");
