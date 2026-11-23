import { createHash, randomInt } from "node:crypto";
import { prisma } from "@walk/db";
import { isValidSolanaAddress } from "@walk/solana";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { ensureUserWithShoe } from "../lib/accounts";
import { clientIp } from "../lib/client-ip";
import { getConfigs } from "../lib/config";
import { WindowLimiter } from "../lib/limiter";
import { langOf, sendWelcome } from "../lib/mailer";
import { recordLogin } from "../lib/login-events";
import { verifyTurnstile } from "../lib/turnstile";
import { SESSION_SECONDS, setSessionCookie } from "../plugins/session";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const newAccounts = new WindowLimiter(3_600_000);
const mails = new WindowLimiter(3_600_000);

/** Adresse canonique : en minuscules ; pour Gmail, sans points ni « +étiquette » (sinon une seule boîte = des milliers de comptes). */
export function canonEmail(raw: string): string {
  const [l, d] = raw.trim().toLowerCase().split("@");
  if (!l || !d) return raw.trim().toLowerCase();
  if (d === "gmail.com" || d === "googlemail.com") return `${l.split("+")[0]!.replace(/\./g, "")}@gmail.com`;
  return `${l.split("+")[0]}@${d}`;
}
// Adresses jetables courantes : refusées (anti-fermes de comptes).
const DISPOSABLE = new Set<string>([]); // REDACTED: donnée remplacée car trop risquée à publier (piratage, abus, triche).
const email = z.string().trim().max(254).email().transform(canonEmail).refine((e) => !DISPOSABLE.has(e.split("@")[1]!), "Disposable email addresses are not allowed.");
const name = z.string().trim().min(1).max(60).regex(/^[\p{L}\p{M}' .-]+$/u, "invalid name");
const wallet = z.string().refine(isValidSolanaAddress, "Invalid Solana address");
const mode = z.enum(["app", "browser"]).default("browser");

const startBody = z.object({
  website: z.string().max(200).optional(), // piège à robots : champ invisible, un humain ne le remplit jamais
  email, first_name: name.optional(), last_name: name.optional(), wallet: wallet.optional(),
  consent: z.literal(true).optional(), turnstile_token: z.string().max(2048).optional(),
});
const verifyBody = z.object({ email, code: z.string().regex(/^\d{6}$/), display_mode: mode });
const googleBody = z.object({ credential: z.string().min(20).max(4096), wallet: wallet.optional(), display_mode: mode });

const hash = (e: string, code: string) => createHash("sha256").update(`${e}:${code}`).digest("hex");

export async function emailAuthRoutes(app: FastifyInstance) {
  const behindCf = app.env.BEHIND_CLOUDFLARE === "true";
  // L'inscription par email exige le captcha Turnstile côté serveur : sans TURNSTILE_SECRET elle reste fermée (anti-bots).
  const emailOn = Boolean(app.env.RESEND_API_KEY && app.env.MAIL_FROM && app.env.TURNSTILE_SECRET);
  const googleOn = Boolean(app.env.GOOGLE_CLIENT_ID);
  const limit = { rateLimit: { max: 0 /* REDACTED */, timeWindow: "1 minute", keyGenerator: (r: FastifyRequest) => `authx:${clientIp(r, behindCf)}` } };

  /** Quels modes de connexion sans wallet sont actifs ? (le front affiche ou cache les boutons) */
  app.get("/auth/methods", async () => ({ email: emailOn, google: googleOn ? app.env.GOOGLE_CLIENT_ID : null }));

  async function sendMail(to: string, code: string) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${app.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: app.env.MAIL_FROM, to: [to], subject: `Neon Soles : ${code} is your login code`,
        text: `Your Neon Soles login code: ${code}\n\nIt expires in 10 minutes. If you did not ask for it, ignore this email.\nNever share this code. We will never ask for your wallet secret key.`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  }

  async function login(req: FastifyRequest, reply: FastifyReply, u: { id: string; wallet: string; session_version: number; status: string }, isNew: boolean, display: "app" | "browser") {
    if (u.status === "banned") return reply.code(403).send({ error: "banned", message: "Compte suspendu." });
    await recordLogin(req, { userId: u.id, isNew, mode: display });
    const token = await reply.jwtSign({ sub: u.id, wallet: u.wallet, v: u.session_version }, { expiresIn: SESSION_SECONDS });
    setSessionCookie(reply, token, app.env);
    return { ok: true, is_new: isNew };
  }

  /** Crée un compte email/Google : le wallet est une adresse PUBLIQUE générée dans le navigateur du joueur (jamais la clé). */
  async function createAccount(req: FastifyRequest, o: { wallet: string; email: string; first: string; last: string; provider: "email" | "google"; sub?: string }) {
    const { game } = await getConfigs();
    if (!newAccounts.take("global", 500) || !newAccounts.take(clientIp(req, behindCf), game.new_accounts_per_ip_per_hour)) return "too_many" as const;
    if (await prisma.users.findUnique({ where: { wallet: o.wallet }, select: { id: true } })) return "wallet_taken" as const;
    const u = await ensureUserWithShoe({ wallet: o.wallet, walletKind: o.provider, isAdmin: false });
    return prisma.users.update({
      where: { id: u.id },
      data: { email: o.email, first_name: o.first, last_name: o.last, auth_provider: o.provider, google_sub: o.sub ?? null, email_verified_at: new Date() },
    });
  }

  app.post("/auth/email/start", { config: limit }, async (req, reply) => {
    if (!emailOn) return reply.code(503).send({ error: "email_off", message: "Email login is not available yet." });
    const b = startBody.parse(req.body);
    const ip = clientIp(req, behindCf);
    if (b.website) return { mode: "signup", expires_in: CODE_TTL_MS / 1000 }; // robot : fausse réussite, rien n'est envoyé
    if (!(await verifyTurnstile(app.env.TURNSTILE_SECRET!, b.turnstile_token, ip))) {
      return reply.code(403).send({ error: "bot_check_failed", message: "Bot check failed. Reload the page and try again." });
    }
    // Coupe-circuit global : au-delà de 300 emails/heure pour tout le site, on s'arrête (attaque massive).
    if (!mails.take("global", 300) || !mails.take(`ip:${ip}`, 8) || !mails.take(`mail:${b.email}`, 5)) return reply.code(429).send({ error: "too_many_mails", message: "Too many attempts. Try again later." });
    const existing = await prisma.users.findUnique({ where: { email: b.email }, select: { id: true } });
    if (!existing && !(b.first_name && b.last_name && b.wallet && b.consent)) {
      return reply.code(404).send({ error: "no_account", message: "No account with this email. Fill in the sign-up form." });
    }
    if (!existing && (await prisma.users.findUnique({ where: { wallet: b.wallet! }, select: { id: true } }))) {
      return reply.code(409).send({ error: "wallet_taken", message: "Please try again." });
    }
    // Un code par minute et par email.
    const last = await prisma.email_codes.findFirst({ where: { email: b.email }, orderBy: { created_at: "desc" } });
    if (last && Date.now() - last.created_at.getTime() < 60_000) {
      return reply.code(429).send({ error: "code_too_soon", message: "Wait a minute before asking for another code." });
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await prisma.email_codes.deleteMany({ where: { expires_at: { lt: new Date(Date.now() - 3600_000) } } });
    await prisma.email_codes.create({
      data: { email: b.email, code_hash: hash(b.email, code), first_name: b.first_name, last_name: b.last_name, wallet: existing ? null : b.wallet, expires_at: new Date(Date.now() + CODE_TTL_MS) },
    });
    if (!(await sendMail(b.email, code))) return reply.code(502).send({ error: "mail_failed", message: "Could not send the email. Try again later." });
    return { mode: existing ? "login" : "signup", expires_in: CODE_TTL_MS / 1000 };
  });

  app.post("/auth/email/verify", { config: limit }, async (req, reply) => {
    if (!emailOn) return reply.code(503).send({ error: "email_off", message: "Email login is not available yet." });
    const b = verifyBody.parse(req.body);
    const row = await prisma.email_codes.findFirst({ where: { email: b.email, used: false, expires_at: { gt: new Date() } }, orderBy: { created_at: "desc" } });
    if (!row || row.attempts >= MAX_ATTEMPTS) return reply.code(401).send({ error: "bad_code", message: "Invalid or expired code. Ask for a new one." });
    if (row.code_hash !== hash(b.email, b.code)) {
      await prisma.email_codes.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
      return reply.code(401).send({ error: "bad_code", message: "Invalid or expired code. Ask for a new one." });
    }
    const used = await prisma.email_codes.updateMany({ where: { id: row.id, used: false }, data: { used: true } });
    if (used.count !== 1) return reply.code(401).send({ error: "bad_code", message: "Invalid or expired code. Ask for a new one." });

    const existing = await prisma.users.findUnique({ where: { email: b.email } });
    if (existing) {
      await prisma.users.update({ where: { id: existing.id }, data: { email_verified_at: existing.email_verified_at ?? new Date() } });
      return login(req, reply, existing, false, b.display_mode);
    }
    if (!row.wallet || !row.first_name || !row.last_name) return reply.code(400).send({ error: "bad_code", message: "Please start again." });
    const u = await createAccount(req, { wallet: row.wallet, email: b.email, first: row.first_name, last: row.last_name, provider: "email" });
    if (u === "too_many") return reply.code(429).send({ error: "too_many_accounts", message: "Too many accounts created from this connection. Try again later." });
    if (u === "wallet_taken") return reply.code(409).send({ error: "wallet_taken", message: "Please start again." });
    void sendWelcome(app.env, b.email, row.first_name, langOf(req));
    return login(req, reply, u, true, b.display_mode);
  });

  /** Google Identity Services : le navigateur envoie le jeton « credential », vérifié ici auprès de Google. */
  app.post("/auth/google", { config: limit }, async (req, reply) => {
    if (!googleOn) return reply.code(503).send({ error: "google_off", message: "Google login is not available yet." });
    const b = googleBody.parse(req.body);
    let info: { aud?: string; sub?: string; email?: string; email_verified?: string | boolean; given_name?: string; family_name?: string; exp?: string; iss?: string };
    try {
      const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(b.credential)}`, { signal: AbortSignal.timeout(6000) });
      if (!r.ok) throw new Error("bad token");
      info = (await r.json()) as typeof info;
    } catch { return reply.code(401).send({ error: "bad_google", message: "Google sign-in failed. Try again." }); }
    const verified = info.email_verified === true || info.email_verified === "true";
    if (info.aud !== app.env.GOOGLE_CLIENT_ID || !info.sub || !info.email || !verified || !/^(https:\/\/)?accounts\.google\.com$/.test(info.iss ?? "")) {
      return reply.code(401).send({ error: "bad_google", message: "Google sign-in failed. Try again." });
    }
    const mail = info.email.toLowerCase();
    let user = await prisma.users.findUnique({ where: { google_sub: info.sub } }) ?? await prisma.users.findUnique({ where: { email: mail } });
    if (user) {
      if (!user.google_sub) user = await prisma.users.update({ where: { id: user.id }, data: { google_sub: info.sub, email_verified_at: user.email_verified_at ?? new Date() } });
      return login(req, reply, user, false, b.display_mode);
    }
    if (!b.wallet) return { need_wallet: true, first_name: info.given_name ?? "", last_name: info.family_name ?? "" };
    const u = await createAccount(req, { wallet: b.wallet, email: mail, first: (info.given_name ?? "Player").slice(0, 60), last: (info.family_name ?? "-").slice(0, 60), provider: "google", sub: info.sub });
    if (u === "too_many") return reply.code(429).send({ error: "too_many_accounts", message: "Too many accounts created from this connection. Try again later." });
    if (u === "wallet_taken") return reply.code(409).send({ error: "wallet_taken", message: "Please start again." });
    void sendWelcome(app.env, mail, (info.given_name ?? "Player").slice(0, 60), langOf(req));
    return login(req, reply, u, true, b.display_mode);
  });
}
