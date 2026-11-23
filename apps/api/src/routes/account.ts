import { createHash, randomBytes, randomInt } from "node:crypto";
import { prisma } from "@walk/db";
import { verifyWalletSignature } from "@walk/solana";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { clientIp } from "../lib/client-ip";
import { WindowLimiter } from "../lib/limiter";
import { langOf, sendGoodbye, sendMail } from "../lib/mailer";
import { clearSessionCookie } from "../plugins/session";

const TTL_MS = 10 * 60 * 1000;
const starts = new WindowLimiter(3_600_000);
const hash = (k: string, c: string) => createHash("sha256").update(`${k}:${c}`).digest("hex");
const startBody = z.object({ confirm: z.literal("DELETE") });
const confirmBody = z.object({
  code: z.string().regex(/^\d{6}$/).optional(),
  nonce: z.string().min(16).max(64).optional(),
  issued_at: z.string().datetime().optional(),
  signature: z.string().min(80).max(100).optional(),
});
const message = (wallet: string, nonce: string, issuedAt: string) =>
  `Neon Soles: permanently delete my account.\nWallet: ${wallet}\nNonce: ${nonce}\nIssued at: ${issuedAt}`;

/**
 * Suppression de compte, en 3 validations côté joueur (avertissement, mot « DELETE », preuve d'identité).
 * La preuve : code reçu par email, ou signature du wallet pour les comptes wallet.
 * Les données personnelles sont effacées ; les lignes de jeu (historique de gains, paiements) sont anonymisées, pas supprimées.
 */
export async function accountRoutes(app: FastifyInstance) {
  const behindCf = app.env.BEHIND_CLOUDFLARE === "true";
  const mailOn = Boolean(app.env.RESEND_API_KEY && app.env.MAIL_FROM);
  const limit = { rateLimit: { max: 0 /* REDACTED */, timeWindow: "1 minute", keyGenerator: (r: FastifyRequest) => `acct:${clientIp(r, behindCf)}` } };

  async function blockers(userId: string) {
    const u = await prisma.users.findUniqueOrThrow({ where: { id: userId } });
    if (u.is_admin || app.env.adminWallets.includes(u.wallet)) return { u, why: "Admin accounts cannot be deleted here." };
    if (u.status === "banned") return { u, why: "This account is suspended and cannot be deleted." };
    if (u.status === "deleted") return { u, why: "This account is already deleted." };
    const [claims, running, listings, parts] = await Promise.all([
      prisma.claims.count({ where: { user_id: userId, status: { in: ["queued", "sent"] } } }),
      prisma.walk_sessions.count({ where: { user_id: userId, status: "running" } }),
      prisma.listings.count({ where: { seller_id: userId, status: { in: ["active", "reserved"] } } }),
      prisma.market_listings.count({ where: { seller_id: userId, status: { in: ["active", "reserved"] } } }),
    ]);
    if (claims) return { u, why: "A withdrawal is in progress. Wait until it is finished." };
    if (running) return { u, why: "A walk is in progress. End it first." };
    if (listings + parts) return { u, why: "You have items for sale on the market. Remove them first." };
    return { u, why: null as string | null };
  }

  app.post("/account/delete/start", { preHandler: app.authenticate, config: limit }, async (req, reply) => {
    startBody.parse(req.body);
    if (!starts.take(req.user.sub, 5)) return reply.code(429).send({ error: "too_many", message: "Too many attempts. Try again later." });
    const { u, why } = await blockers(req.user.sub);
    if (why) return reply.code(409).send({ error: "delete_blocked", message: why });
    const now = new Date();
    if (u.email) {
      if (!mailOn) return reply.code(503).send({ error: "email_off", message: "Email is not available right now. Try again later." });
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const key = `del:${u.id}`;
      await prisma.email_codes.deleteMany({ where: { email: key } });
      await prisma.email_codes.create({ data: { email: key, code_hash: hash(key, code), expires_at: new Date(now.getTime() + TTL_MS) } });
      const ok = await sendMail(app.env, u.email, `Neon Soles: ${code} confirms the deletion of your account`,
        `Your confirmation code to DELETE your Neon Soles account: ${code}\n\nIt expires in 10 minutes. If you did not ask for this, ignore this email and change nothing: your account stays as it is.`);
      if (!ok) return reply.code(502).send({ error: "mail_failed", message: "Could not send the email. Try again later." });
      return { method: "email", email_hint: u.email.replace(/^(.).*(@.*)$/, "$1•••$2") };
    }
    const nonce = randomBytes(16).toString("hex"), issued = now.toISOString();
    await prisma.auth_nonces.create({ data: { nonce, wallet: u.wallet, expires_at: new Date(now.getTime() + TTL_MS) } });
    return { method: "wallet", nonce, issued_at: issued, message: message(u.wallet, nonce, issued) };
  });

  app.post("/account/delete/confirm", { preHandler: app.authenticate, config: limit }, async (req, reply) => {
    const b = confirmBody.parse(req.body);
    const { u, why } = await blockers(req.user.sub);
    if (why) return reply.code(409).send({ error: "delete_blocked", message: why });
    const fail = () => reply.code(401).send({ error: "bad_proof", message: "Invalid or expired confirmation. Start again." });

    if (u.email) {
      const key = `del:${u.id}`;
      const row = await prisma.email_codes.findFirst({ where: { email: key, used: false, expires_at: { gt: new Date() } }, orderBy: { created_at: "desc" } });
      if (!b.code || !row || row.attempts >= 5) return fail();
      if (row.code_hash !== hash(key, b.code)) { await prisma.email_codes.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } }); return fail(); }
      if ((await prisma.email_codes.updateMany({ where: { id: row.id, used: false }, data: { used: true } })).count !== 1) return fail();
    } else {
      if (!b.nonce || !b.issued_at || !b.signature) return fail();
      if (!verifyWalletSignature(message(u.wallet, b.nonce, b.issued_at), b.signature, u.wallet)) return fail();
      const used = await prisma.auth_nonces.updateMany({ where: { nonce: b.nonce, wallet: u.wallet, used: false, expires_at: { gt: new Date() } }, data: { used: true } });
      if (used.count !== 1) return fail();
    }

    const email = u.email, lang = langOf(req), short = u.id.replace(/-/g, "").slice(0, 8);
    await prisma.$transaction([
      // Données personnelles effacées ; le wallet est remplacé (la session actuelle devient invalide).
      prisma.users.update({ where: { id: u.id }, data: {
        status: "deleted", email: null, first_name: null, last_name: null, google_sub: null, auth_provider: null, email_verified_at: null,
        wallet: `del_${u.id}`, pseudo: `deleted-${short}`, gender: null, appearance: null, country: null, avatar: null, device_hash: null,
        referral_code: null, banned_reason: null, session_version: { increment: 1 },
      } }),
      // Les traces GPS sont des données personnelles : supprimées.
      prisma.$executeRaw`DELETE FROM walk_points WHERE session_id IN (SELECT id FROM walk_sessions WHERE user_id = ${u.id}::uuid)`,
      prisma.login_events.deleteMany({ where: { user_id: u.id } }),
      prisma.user_badges.deleteMany({ where: { user_id: u.id } }),
      prisma.email_codes.deleteMany({ where: { OR: [{ email: `del:${u.id}` }, ...(email ? [{ email }] : [])] } }),
      prisma.auth_nonces.deleteMany({ where: { wallet: u.wallet } }),
    ]);
    clearSessionCookie(reply, app.env);
    if (email) void sendGoodbye(app.env, email, lang);
    return { ok: true };
  });
}
