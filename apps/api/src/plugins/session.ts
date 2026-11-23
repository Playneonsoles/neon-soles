import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@walk/db";
import type { Env } from "../env";

export const SESSION_COOKIE = "walk_session";
export const SESSION_SECONDS = 7 * 24 * 3600; // 7 jours, rafraîchi à chaque visite

export interface SessionPayload {
  sub: string; // users.id
  wallet: string;
  v: number; // users.session_version : changer cette valeur révoque tous les jetons déjà émis
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: SessionPayload;
    user: SessionPayload;
  }
}

/** Cookie httpOnly, Secure (hors dev), SameSite=Strict, 7 jours. */
export function setSessionCookie(reply: FastifyReply, token: string, env: Env) {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export function clearSessionCookie(reply: FastifyReply, env: Env) {
  reply.clearCookie(SESSION_COOKIE, {
    httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "strict", path: "/",
  });
}

/** Garde de route : vérifie le cookie, puis ré-émet un jeton neuf (session glissante de 7 jours). */
export function makeAuthenticate(env: Env) {
  return async function authenticate(req: FastifyRequest, reply: FastifyReply) {
    try {
      await req.jwtVerify({ onlyCookie: true });
    } catch {
      return reply.code(401).send({ error: "unauthorized", message: "Sign-in required." });
    }
    const { sub, wallet, v } = req.user;
    // Le jeton vit 7 jours : on revérifie le compte pour qu'un ban, une déconnexion ou une suppression agisse immédiatement.
    const account = await prisma.users.findUnique({ where: { id: sub }, select: { status: true, wallet: true, session_version: true } });
    if (!account || account.wallet !== wallet || account.status === "banned" || account.session_version !== v) {
      clearSessionCookie(reply, env);
      return reply.code(401).send({ error: "unauthorized", message: "Sign-in required." });
    }
    // Présence : au plus une écriture par minute et par joueur (sert au compteur « en ligne »).
    await prisma.$executeRaw`UPDATE users SET last_seen_at = now() WHERE id = ${sub}::uuid AND (last_seen_at IS NULL OR last_seen_at < now() - interval '60 seconds')`;
    const token = await reply.jwtSign({ sub, wallet, v }, { expiresIn: SESSION_SECONDS });
    setSessionCookie(reply, token, env);
  };
}
