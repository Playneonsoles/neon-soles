import { Prisma, prisma } from "@walk/db";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const ONLINE_WINDOW = "5 minutes";
let cache: { at: number; value: { players: number; online: number; registered: number; walkers24h: number } } | null = null;

interface TokenStats { market_cap: number | null; price_usd: number | null; change_24h: number | null; liquidity_usd: number | null; volume_24h: number | null; updated_at: string }
let tokenCache: { at: number; value: TokenStats | null } = { at: 0, value: null };

/** Cours du jeton via l'API publique de DexScreener (gratuite, sans clé) : on prend la paire la plus liquide. */
async function fetchTokenStats(mint: string): Promise<TokenStats | null> {
  const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`, { signal: AbortSignal.timeout(6000), headers: { Accept: "application/json" } });
  if (!r.ok) return null;
  const j = (await r.json()) as { pairs?: { chainId?: string; priceUsd?: string; marketCap?: number; fdv?: number; priceChange?: { h24?: number }; liquidity?: { usd?: number }; volume?: { h24?: number } }[] };
  const pairs = (j.pairs ?? []).filter((p) => p.chainId === "solana");
  pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
  const p = pairs[0];
  if (!p) return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const price = Number(p.priceUsd);
  return {
    market_cap: num(p.marketCap) ?? num(p.fdv), price_usd: Number.isFinite(price) ? price : null, change_24h: num(p.priceChange?.h24),
    liquidity_usd: num(p.liquidity?.usd), volume_24h: num(p.volume?.h24), updated_at: new Date().toISOString(),
  };
}

export async function connectionRoutes(app: FastifyInstance) {
  /** Public : capitalisation et cours du jeton. Mis en cache 60 s ; en cas d'échec de la source, on garde la dernière valeur (10 min au plus). */
  app.get("/token/stats", { config: { rateLimit: { max: 0 /* REDACTED */, timeWindow: "1 minute" } } }, async () => {
    if (!app.env.WALK_MINT) return { available: false };
    if (Date.now() - tokenCache.at > 60_000) {
      tokenCache.at = Date.now();
      try { const v = await fetchTokenStats(app.env.WALK_MINT); if (v) tokenCache = { at: Date.now(), value: v }; } catch { /* source indisponible : on garde l'ancienne valeur */ }
    }
    const v = tokenCache.value;
    if (!v || Date.now() - Date.parse(v.updated_at) > 600_000) return { available: false };
    return { available: true, ...v };
  });

  /** Public : total de joueurs et joueurs en ligne (actifs depuis moins de 5 minutes). Mis en cache 30 s. */
  app.get("/stats", { config: { rateLimit: { max: 0 /* REDACTED */, timeWindow: "1 minute" } } }, async () => {
    if (cache && Date.now() - cache.at < 30_000) return cache.value;
    const [row] = await prisma.$queryRaw<{ players: bigint; online: bigint; registered: bigint; walkers24h: bigint }[]>(Prisma.sql`
      SELECT count(*) FILTER (WHERE profile_completed_at IS NOT NULL)::bigint AS players,
             count(*) FILTER (WHERE last_seen_at > now() - interval '5 minutes')::bigint AS online,
             count(*)::bigint AS registered,
             (SELECT count(DISTINCT user_id) FROM walk_sessions WHERE started_at > now() - interval '24 hours' AND status <> 'rejected')::bigint AS walkers24h
      FROM users WHERE status <> 'banned'`);
    cache = { at: Date.now(), value: { players: Number(row?.players ?? 0n), online: Number(row?.online ?? 0n), registered: Number(row?.registered ?? 0n), walkers24h: Number(row?.walkers24h ?? 0n) } };
    return cache.value;
  });

  const admin = async (req: FastifyRequest, reply: FastifyReply) => {
    await app.authenticate(req, reply);
    if (reply.sent) return;
    const me = await prisma.users.findUnique({ where: { id: req.user.sub }, select: { is_admin: true } });
    if (!me?.is_admin) return reply.code(403).send({ error: "forbidden", message: "Administrators only." });
  };

  /** Suivi des connexions, réservé aux administrateurs. */
  app.get("/admin/connections", { preHandler: admin, config: { rateLimit: { max: 0 /* REDACTED */, timeWindow: "1 minute" } } }, async (req) => {
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(3650).default(30) }).parse(req.query);
    const since = new Date(Date.now() - days * 86_400_000);
    const P = Prisma.sql;
    const chartDays = Math.min(days, 30);
    const chartSince = new Date(Date.now() - chartDays * 86_400_000);

    const [totals, daily, countries, devices, recent, online] = await Promise.all([
      prisma.$queryRaw<{ logins: bigint; unique_players: bigint; new_players: bigint; app_logins: bigint }[]>(P`
        SELECT count(*)::bigint AS logins, count(DISTINCT user_id)::bigint AS unique_players,
               count(*) FILTER (WHERE is_new)::bigint AS new_players, count(*) FILTER (WHERE mode = 'app')::bigint AS app_logins
        FROM login_events WHERE created_at >= ${since}`),
      prisma.$queryRaw<{ d: string; n: bigint }[]>(P`
        SELECT (created_at AT TIME ZONE 'Europe/Paris')::date::text AS d, count(*)::bigint AS n
        FROM login_events WHERE created_at >= ${chartSince} GROUP BY 1 ORDER BY 1`),
      prisma.$queryRaw<{ country: string | null; n: bigint }[]>(P`
        SELECT country, count(*)::bigint AS n FROM login_events WHERE created_at >= ${since} GROUP BY 1 ORDER BY 2 DESC LIMIT 8`),
      prisma.$queryRaw<{ device: string; n: bigint }[]>(P`
        SELECT device, count(*)::bigint AS n FROM login_events WHERE created_at >= ${since} GROUP BY 1 ORDER BY 2 DESC`),
      prisma.$queryRaw<{ at: Date; user_id: string; pseudo: string | null; country: string | null; device: string; mode: string; is_new: boolean }[]>(P`
        SELECT e.created_at AS at, e.user_id::text AS user_id, u.pseudo, e.country, e.device, e.mode, e.is_new
        FROM login_events e JOIN users u ON u.id = e.user_id ORDER BY e.created_at DESC LIMIT 50`),
      prisma.$queryRaw<{ n: bigint }[]>(P`SELECT count(*)::bigint AS n FROM users WHERE last_seen_at > now() - interval '5 minutes'`),
    ]);
    const t = totals[0];
    return {
      days, online_now: Number(online[0]?.n ?? 0n), window: ONLINE_WINDOW,
      totals: {
        logins: Number(t?.logins ?? 0n), unique_players: Number(t?.unique_players ?? 0n),
        new_players: Number(t?.new_players ?? 0n), app_logins: Number(t?.app_logins ?? 0n),
      },
      daily: daily.map((r) => ({ day: r.d, logins: Number(r.n) })),
      countries: countries.map((r) => ({ country: r.country, logins: Number(r.n) })),
      devices: devices.map((r) => ({ device: r.device, logins: Number(r.n) })),
      recent,
    };
  });
}
