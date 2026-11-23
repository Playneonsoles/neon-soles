import { randomBytes } from "node:crypto";
import { prisma } from "@walk/db";
import { buildSignInMessage, isValidSolanaAddress, verifyWalletSignature } from "@walk/solana";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { ensureUserWithShoe } from "../lib/accounts";
import { clientIp } from "../lib/client-ip";
import { WindowLimiter } from "../lib/limiter";
import { recordLogin } from "../lib/login-events";
import { verifyTurnstile } from "../lib/turnstile";
import { getConfigs } from "../lib/config";
import { SESSION_SECONDS, clearSessionCookie, setSessionCookie } from "../plugins/session";

const NONCE_TTL_MS = 5 * 60 * 1000;
const address = z.string().refine(isValidSolanaAddress, "Invalid Solana address");

const nonceBody = z.object({ wallet: address, turnstile_token: z.string().max(2048).optional() });
const verifyBody = z.object({
  wallet: address,
  nonce: z.string().min(16).max(64),
  issued_at: z.string().datetime(),
  signature: z.string().min(80).max(100), // ed25519 en base64 : 88 caractères
  wallet_kind: z.string().max(40).optional(),
  display_mode: z.enum(["app", "browser"]).default("browser"), // app = site installé (PWA)
});

function walletKind(name?: string): "phantom" | "metamask" | "autre" {
  const n = (name ?? "").toLowerCase();
  if (n.includes("phantom")) return "phantom";
  if (n.includes("metamask")) return "metamask";
  return "autre";
}

// 10 requêtes/min sur l'authentification, par IP.
const newAccounts = new WindowLimiter(3_600_000);

export async function authRoutes(app: FastifyInstance) {
  const behindCf = app.env.BEHIND_CLOUDFLARE === "true";
  // 10 requêtes/min sur l'authentification, par adresse IP du visiteur.
  const authLimit = { rateLimit: { max: 0 /* REDACTED */, timeWindow: "1 minute", keyGenerator: (r: FastifyRequest) => `auth:${clientIp(r, behindCf)}` } };
  app.post("/auth/nonce", { config: authLimit }, async (req, reply) => {
    const { wallet, turnstile_token } = nonceBody.parse(req.body);
    if (app.env.TURNSTILE_SECRET && !(await verifyTurnstile(app.env.TURNSTILE_SECRET, turnstile_token, clientIp(req, behindCf)))) {
      return reply.code(403).send({ error: "bot_check_failed", message: "Bot check failed. Reload the page and try again." });
    }
    const nonce = randomBytes(16).toString("hex");
    const now = new Date();
    await prisma.auth_nonces.deleteMany({ where: { expires_at: { lt: new Date(now.getTime() - 3600_000) } } });
    await prisma.auth_nonces.create({
      data: { nonce, wallet, expires_at: new Date(now.getTime() + NONCE_TTL_MS) },
    });
    const issuedAt = now.toISOString();
    const message = buildSignInMessage({ domain: app.env.APP_DOMAIN, address: wallet, nonce, issuedAt });
    return { nonce, issued_at: issuedAt, message, expires_in: NONCE_TTL_MS / 1000 };
  });

  app.post("/auth/verify", { config: authLimit }, async (req, reply) => {
    const body = verifyBody.parse(req.body);

    if (Math.abs(Date.now() - new Date(body.issued_at).getTime()) > NONCE_TTL_MS * 2) {
      return reply.code(401).send({ error: "expired", message: "Message expired, please start again." });
    }
    // Le serveur reconstruit lui-même le message : domaine et adresse ne viennent jamais du client.
    const message = buildSignInMessage({
      domain: app.env.APP_DOMAIN, address: body.wallet, nonce: body.nonce, issuedAt: body.issued_at,
    });
    if (!verifyWalletSignature(message, body.signature, body.wallet)) {
      return reply.code(401).send({ error: "bad_signature", message: "Invalid signature." });
    }
    // Usage unique : la mise à jour conditionnelle est atomique.
    const consumed = await prisma.auth_nonces.updateMany({
      where: { nonce: body.nonce, wallet: body.wallet, used: false, expires_at: { gt: new Date() } },
      data: { used: true },
    });
    if (consumed.count !== 1) {
      return reply.code(401).send({ error: "bad_nonce", message: "Invalid or already used nonce." });
    }

    // Anti-fermes de comptes : plafond de créations de comptes par adresse IP et par heure (réglable : new_accounts_per_ip_per_hour).
    if (!(await prisma.users.findUnique({ where: { wallet: body.wallet }, select: { id: true } }))) {
      const { game } = await getConfigs();
      if (!newAccounts.take(clientIp(req, behindCf), game.new_accounts_per_ip_per_hour)) {
        return reply.code(429).send({ error: "too_many_accounts", message: "Too many accounts created from this connection. Try again later." });
      }
    }
    const isAdmin = app.env.adminWallets.includes(body.wallet);
    // Un compte = un wallet : le wallet n'est jamais modifié après la création.
    // À la création : chaussure de départ (niveau 1, sans NFT), dans une même transaction.
    const user = await ensureUserWithShoe({ wallet: body.wallet, walletKind: walletKind(body.wallet_kind), isAdmin });
    // Nouveau compte = uniquement la chaussure de départ de niveau 1 (les chaussures spéciales sont données à la main depuis l'admin).
    if (user.status === "banned") {
      return reply.code(403).send({ error: "banned", message: "Compte suspendu." });
    }

    await recordLogin(req, { userId: user.id, isNew: user.created, mode: body.display_mode });
    const token = await reply.jwtSign({ sub: user.id, wallet: user.wallet, v: user.session_version }, { expiresIn: SESSION_SECONDS });
    setSessionCookie(reply, token, app.env);
    return { user: { id: user.id, wallet: user.wallet, pseudo: user.pseudo, is_admin: user.is_admin } };
  });

  app.post("/auth/logout", { preHandler: app.authenticate }, async (req, reply) => {
    // Révocation côté serveur : tous les jetons déjà émis pour ce compte deviennent invalides, même s'ils ont été copiés.
    await prisma.users.update({ where: { id: req.user.sub }, data: { session_version: { increment: 1 } } });
    clearSessionCookie(reply, app.env);
    return { ok: true };
  });
}
