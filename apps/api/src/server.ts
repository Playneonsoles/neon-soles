import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import type { Env } from "./env";
import { clientIp } from "./lib/client-ip";
import { isOriginAllowed } from "./lib/origin";
import { SESSION_COOKIE, makeAuthenticate } from "./plugins/session";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { emailAuthRoutes } from "./routes/auth-email";
import { accountRoutes } from "./routes/account";
import { profileRoutes } from "./routes/profile";
import { claimRoutes } from "./routes/claims";
import { configRoutes } from "./routes/config";
import { connectionRoutes } from "./routes/connections";
import { ideaRoutes } from "./routes/ideas";
import { upgradeRoutes } from "./routes/upgrades";
import { engagementRoutes } from "./routes/engagement";
import { marketRoutes } from "./routes/market";
import { financeRoutes } from "./routes/finance";
import { meRoutes } from "./routes/me";
import { shoeRoutes } from "./routes/shoes";
import { walkRoutes } from "./routes/walk";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
    env: Env;
  }
}

export async function buildServer(env: Env): Promise<FastifyInstance> {
  const app = Fastify({
    // Les cookies et jetons ne doivent jamais apparaître dans les journaux.
    logger: env.NODE_ENV === "test" ? false : { redact: ["req.headers.cookie", "req.headers.authorization", "req.headers[\"x-walk-session\"]"] },
    // En production : un seul proxy de confiance (Caddy). `true` laisserait un client falsifier X-Forwarded-For
    // et contourner la limite de débit par IP.
    trustProxy: env.NODE_ENV === "production" ? 1 : false,
    bodyLimit: 64 * 1024, // un paquet de 40 points pèse ~6 Ko
    disableRequestLogging: false,
  });

  await app.register(helmet, {
    hsts: { maxAge: 31536000, includeSubDomains: true },
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  });
  await app.register(cors, { origin: env.APP_ORIGIN, credentials: true });
  await app.register(cookie);
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { algorithm: "HS256" },
    verify: { algorithms: ["HS256"] }, // refuse `alg: none` et tout autre algorithme
    cookie: { cookieName: SESSION_COOKIE, signed: false },
  });

  app.addHook("onRequest", async (req, reply) => {
    if (!isOriginAllowed(req.method, req.headers.origin, env.APP_ORIGIN)) {
      return reply.code(403).send({ error: "bad_origin", message: "Origin not allowed." });
    }
  });
  // Réponses de l'API jamais mises en cache (sauf /config/public, qui fixe son propre en-tête).
  app.addHook("onSend", async (_req, reply) => {
    if (!reply.hasHeader("cache-control")) reply.header("Cache-Control", "no-store");
  });

  // 60 requêtes/min par wallet (jeton vérifié), sinon par IP.
  await app.register(rateLimit, {
    global: true,
    max: 0 /* REDACTED */,
    timeWindow: "1 minute",
    keyGenerator: (req) => {
      const token = req.cookies?.[SESSION_COOKIE];
      if (token) {
        try {
          return `w:${app.jwt.verify<{ wallet: string }>(token).wallet}`;
        } catch {
          /* jeton invalide : on retombe sur l'IP */
        }
      }
      return `ip:${clientIp(req, env.BEHIND_CLOUDFLARE === "true")}`;
    },
  });

  app.decorate("env", env);
  app.decorate("authenticate", makeAuthenticate(env));

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: "invalid_request", issues: err.issues });
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) app.log.error(err);
    return reply.code(status).send({
      error: status >= 500 ? "internal_error" : "request_error",
      message: status >= 500 ? "Internal error." : err.message,
    });
  });

  app.get("/health", async () => ({ ok: true }));

  await app.register(
    async (v1) => {
      await v1.register(authRoutes);
      await v1.register(emailAuthRoutes);
      await v1.register(accountRoutes);
      await v1.register(meRoutes);
      await v1.register(profileRoutes);
      await v1.register(adminRoutes);
      await v1.register(marketRoutes);
      await v1.register(claimRoutes);
      await v1.register(financeRoutes);
      await v1.register(connectionRoutes);
      await v1.register(ideaRoutes);
      await v1.register(upgradeRoutes);
      await v1.register(engagementRoutes);
      await v1.register(configRoutes);
      await v1.register(shoeRoutes);
      await v1.register(walkRoutes);
    },
    { prefix: "/api/v1" },
  );

  return app;
}
